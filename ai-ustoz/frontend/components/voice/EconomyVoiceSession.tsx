"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { voiceTranscribe, voiceTurn } from "@/lib/api";
import type { Subject, VoiceMode, VoiceTurnResponse } from "@/lib/types";

import { EMOTIONS, type Emotion, type Phase } from "./realtimeEvents";
import TutorMascot from "./TutorMascot";

// Bitta ovozli dars chegarasi va jimlikda o'zi to'xtash (kunlik chegara serverda).
const SESSION_LIMIT_SECONDS = 30 * 60;
const IDLE_LIMIT_SECONDS = 90;
const CAPTION_MAX_CHARS = 400;
// Bo'sh WAV: iPhone'da ovozni keyinroq (fetch'dan so'ng) chalish uchun audio birinchi bosishda "ochiladi".
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const PHASE_LABEL: Record<Phase, string> = {
  listening: "Tinglayapman — gapiring...",
  thinking: "O'ylayapman...",
  speaking: "Gapiryapman...",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function formatClock(totalSeconds: number): string {
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function toEmotion(value: string): Emotion {
  return (EMOTIONS as readonly string[]).includes(value) ? (value as Emotion) : "neutral";
}

/**
 * Tejamkor ovozli dars: o'quvchi gapini brauzerning o'zi matnga aylantiradi (bepul, uz-UZ),
 * server javobni matnli AI bilan yozadi va MP3 qilib qaytaradi. Navbat bilan ishlaydi:
 * tinglash -> o'ylash -> gapirish -> yana tinglash. Brauzer nutqni taniy olmasa —
 * "bosib gapirish" (yozuv serverda matnga aylanadi).
 */
export default function EconomyVoiceSession({ token, subject }: { token: string; subject: Subject }) {
  const [mode, setMode] = useState<VoiceMode>("tutor");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("listening");
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [caption, setCaption] = useState("");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [amplitude, setAmplitude] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [canRecognize, setCanRecognize] = useState(true);
  const [recording, setRecording] = useState(false);

  const runningRef = useRef(false);
  const modeRef = useRef<VoiceMode>("tutor");
  const recognitionRef = useRef<Recognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishSpeechRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastActivityRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => setCanRecognize(recognitionCtor() !== null), []);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const stopAll = useCallback((message?: string) => {
    runningRef.current = false;
    setRunning(false);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort?.();
    abortRef.current?.abort();
    audioRef.current?.pause();
    finishSpeechRef.current?.();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
    setPhase("listening");
    setEmotion("neutral");
    setHeard("");
    setElapsed(0);
    if (message) setError(message);
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // Taymer: dars uzunligi va jimlik.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!running) return;
    if (elapsed >= SESSION_LIMIT_SECONDS) stopAll("Bitta ovozli dars 30 daqiqa — dam olib, qaytadan boshlang.");
    else if (phase === "listening" && !recording && Date.now() - lastActivityRef.current >= IDLE_LIMIT_SECONDS * 1000)
      stopAll("Uzoq jimlik bo'ldi — suhbat to'xtatildi. Davom etish uchun qaytadan boshlang.");
  }, [elapsed, running, phase, recording, stopAll]);

  // Gapirayotganda yuzcha og'zi harakatlanadi.
  useEffect(() => {
    if (phase !== "speaking" || !running) {
      setAmplitude(0);
      return;
    }
    let frame = 0;
    const tick = (time: number) => {
      setAmplitude(0.2 + 0.4 * Math.abs(Math.sin(time / 110)) * (0.6 + 0.4 * Math.sin(time / 37)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, running]);

  function speak(turn: VoiceTurnResponse): Promise<void> {
    return new Promise((resolve) => {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      const done = () => {
        audio.onended = null;
        audio.onerror = null;
        finishSpeechRef.current = null;
        resolve();
      };
      finishSpeechRef.current = done;
      audio.onended = done;
      audio.onerror = done;
      audio.src = `data:${turn.audio_mime};base64,${turn.audio_base64}`;
      setPhase("speaking");
      audio.play().catch(done);
    });
  }

  function listen() {
    if (!runningRef.current) return;
    setPhase("listening");
    const Ctor = recognitionCtor();
    if (!Ctor) return; // "Bosib gapirish" tugmasini kutamiz
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "uz-UZ";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalText = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setHeard(`${finalText}${interim}`.trim());
      lastActivityRef.current = Date.now();
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed")
        stopAll("Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida mikrofonni yoqing.");
      else if (event.error === "language-not-supported")
        stopAll("Brauzeringiz o'zbek nutqini tanimaydi — Google Chrome'da oching.");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!runningRef.current) return;
      const text = finalText.trim();
      if (text) void respond(text);
      else window.setTimeout(listen, 150); // jimlik — yana tinglaymiz
    };
    try {
      recognition.start();
    } catch {
      window.setTimeout(listen, 300);
    }
  }

  async function respond(text: string, reset = false) {
    if (!runningRef.current) return;
    setPhase("thinking");
    lastActivityRef.current = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const turn = await voiceTurn(token, { subject, mode: modeRef.current, text, reset }, controller.signal);
      if (!runningRef.current) return;
      setEmotion(toEmotion(turn.emotion));
      setCaption(turn.text.slice(-CAPTION_MAX_CHARS));
      setHeard("");
      if (turn.audio_base64) await speak(turn);
      lastActivityRef.current = Date.now();
      listen();
    } catch (err) {
      if (controller.signal.aborted) return;
      stopAll(err instanceof Error ? err.message : "Ustoz javob bera olmadi");
    }
  }

  async function start() {
    setError(null);
    setCaption("");
    // Ovozni birinchi bosishning o'zida "ochamiz" (iPhone fetch'dan keyin o'zi chalishga ruxsat bermaydi).
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = SILENT_WAV;
    audio.play().catch(() => undefined);
    runningRef.current = true;
    setRunning(true);
    lastActivityRef.current = Date.now();
    await respond("", true); // ustoz o'zi salomlashib, birinchi savolni beradi
  }

  function interrupt() {
    audioRef.current?.pause();
    finishSpeechRef.current?.();
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (!runningRef.current) return;
        setPhase("thinking");
        try {
          const text = await voiceTranscribe(token, new Blob(chunks, { type: recorder.mimeType }));
          setHeard(text);
          if (text) await respond(text);
          else setPhase("listening");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ovozni tushunib bo'lmadi");
          setPhase("listening");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      lastActivityRef.current = Date.now();
    } catch {
      setError("Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida mikrofonni yoqing.");
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3" data-testid="economy-voice">
      {running && (
        <div className="flex w-full items-center justify-between text-xs">
          <span className="font-mono text-gray-400">
            {formatClock(elapsed)} / {formatClock(SESSION_LIMIT_SECONDS)}
          </span>
          <button
            onClick={() => stopAll()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 hover:text-white"
          >
            <span className="h-2.5 w-2.5 rounded-sm bg-current" />
            To&apos;xtatish
          </button>
        </div>
      )}

      <TutorMascot emotion={emotion} amplitude={amplitude} isActive={running} />

      {running && <p className="text-xs text-gray-500">{recording ? "Yozib olinmoqda..." : PHASE_LABEL[phase]}</p>}
      {running && caption && (
        <p className="max-h-24 w-full overflow-y-auto text-center text-sm leading-relaxed text-gray-200" data-testid="voice-caption">
          {caption}
        </p>
      )}
      {running && heard && <p className="w-full text-center text-xs italic text-neon-cyan">Siz: {heard}</p>}

      {running && phase === "speaking" && (
        <button onClick={interrupt} className="rounded-full border border-neon-cyan/50 px-4 py-1.5 text-xs text-neon-cyan">
          Gapni bo&apos;lib, javob beraman
        </button>
      )}
      {running && !canRecognize && phase === "listening" && (
        <button
          onClick={() => void toggleRecording()}
          className={`rounded-full px-6 py-2 text-sm font-semibold text-white ${recording ? "bg-red-500" : "bg-neon-violet"}`}
        >
          {recording ? "⏹ Tugatdim" : "🎙 Gapirish"}
        </button>
      )}

      {!running && (
        <div className="flex gap-2 text-xs">
          {(
            [
              { value: "tutor" as VoiceMode, label: "Repetitor rejimi" },
              { value: "debate" as VoiceMode, label: "Munozara rejimi" },
            ]
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className={`rounded-full px-3 py-1 ${mode === option.value ? "bg-neon-pink text-white" : "bg-surface text-gray-400"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="break-words text-center text-sm text-red-400 [overflow-wrap:anywhere]">{error}</p>}

      {!running && (
        <button
          onClick={() => void start()}
          className="rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet px-6 py-2 text-sm font-semibold text-white"
        >
          Ovozli darsni boshlash
        </button>
      )}
    </div>
  );
}
