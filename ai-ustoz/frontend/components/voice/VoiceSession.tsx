"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createVoiceSession } from "@/lib/api";
import type { Subject, VoiceMode } from "@/lib/types";

import { createRealtimeEventHandler, type Emotion, type Phase, type RealtimeUpdate } from "./realtimeEvents";
import TutorMascot from "./TutorMascot";
import { useAudioVisualizer } from "./useAudioVisualizer";

// GA Realtime API: SDP offer ephemeral kalit bilan shu manzilga yuboriladi (model sessiyada belgilangan).
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
// Bitta sessiya chegarasi: Realtime API daqiqasiga pullik, cheksiz ochiq qolmasin.
const SESSION_LIMIT_SECONDS = 10 * 60;
const CAPTION_MAX_CHARS = 220;

const PHASE_LABEL: Record<Phase, string> = {
  listening: "Tinglayapman...",
  thinking: "O'ylayapman...",
  speaking: "Gapiryapman...",
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * OpenAI Realtime API bilan to'g'ridan-to'g'ri WebRTC ulanish:
 * 1. Backenddan ephemeral client_secret olinadi (audio backend orqali oqmaydi).
 * 2. Mikrofon oqimi RTCPeerConnection'ga qo'shiladi, SDP offer/answer almashinadi.
 * 3. "oai-events" data channel orqali model `set_emotion` chaqiradi — yuzcha
 *    kayfiyati almashadi; model gapi esa yuzcha ostida subtitr bo'lib chiqadi.
 *
 * MODUL 2: "Munozara rejimi" — backend system promptni almashtiradi, frontend
 * faqat rejimni tanlab beradi.
 */
export default function VoiceSession({ token, subject }: { token: string; subject: Subject }) {
  const [mode, setMode] = useState<VoiceMode>("tutor");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [phase, setPhase] = useState<Phase>("listening");
  const [caption, setCaption] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const amplitude = useAudioVisualizer(remoteStream);

  const stopVoiceSession = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setRemoteStream(null);
    setIsConnected(false);
    setEmotion("neutral");
    setPhase("listening");
    setCaption("");
    setElapsedSeconds(0);
  }, []);

  useEffect(() => stopVoiceSession, [stopVoiceSession]);

  useEffect(() => {
    if (!isConnected) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isConnected]);

  useEffect(() => {
    if (elapsedSeconds >= SESSION_LIMIT_SECONDS) stopVoiceSession();
  }, [elapsedSeconds, stopVoiceSession]);

  function applyUpdate(update: RealtimeUpdate) {
    if (update.emotion) setEmotion(update.emotion);
    if (update.phase) setPhase(update.phase);
    if (update.captionReset) setCaption("");
    if (update.captionAppend) {
      const delta = update.captionAppend;
      setCaption((prev) => (prev + delta).slice(-CAPTION_MAX_CHARS));
    }
    if (update.error) setError(update.error);

    const channel = dataChannelRef.current;
    if (channel?.readyState === "open") {
      update.send.forEach((clientEvent) => channel.send(JSON.stringify(clientEvent)));
    }
  }

  async function startVoiceSession() {
    setError(null);
    setIsConnecting(true);
    try {
      const session = await createVoiceSession(token, subject, mode);

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (audioElRef.current) {
          audioElRef.current.srcObject = event.streams[0];
        }
      };

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = micStream;
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

      const handleEvent = createRealtimeEventHandler();
      const channel = pc.createDataChannel("oai-events");
      dataChannelRef.current = channel;
      channel.onmessage = (message) => {
        try {
          applyUpdate(handleEvent(JSON.parse(message.data)));
        } catch {
          // JSON bo'lmagan xabar — e'tiborsiz qoldiriladi
        }
      };
      // Ustoz suhbatni o'zi boshlaydi (salomlashib, birinchi savolni beradi).
      channel.onopen = () => channel.send(JSON.stringify({ type: "response.create" }));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.client_secret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const reason = await sdpResponse.text().catch(() => "");
        throw new Error(`OpenAI ovozli aloqani ulamadi (${sdpResponse.status})${reason ? `: ${reason.slice(0, 160)}` : ""}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setIsConnected(true);
    } catch (err) {
      const isMicDenied = err instanceof DOMException && err.name === "NotAllowedError";
      setError(
        isMicDenied
          ? "Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida mikrofonni yoqing."
          : err instanceof Error
            ? err.message
            : "Ovozli suhbatni boshlab bo'lmadi"
      );
      stopVoiceSession();
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {isConnected && (
        <div className="flex w-full items-center justify-between text-xs">
          <span className="font-mono text-gray-400">
            {formatClock(elapsedSeconds)} / {formatClock(SESSION_LIMIT_SECONDS)}
          </span>
          <button
            onClick={stopVoiceSession}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 hover:text-white"
          >
            <span className="h-2.5 w-2.5 rounded-sm bg-current" />
            To&apos;xtatish
          </button>
        </div>
      )}

      <TutorMascot emotion={emotion} amplitude={amplitude} isActive={isConnected} />
      <audio ref={audioElRef} autoPlay hidden />

      {isConnected && <p className="text-xs text-gray-500">{PHASE_LABEL[phase]}</p>}
      {isConnected && caption && (
        <p className="max-h-24 w-full overflow-y-auto text-center text-sm leading-relaxed text-gray-200">{caption}</p>
      )}

      {!isConnected && (
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
              className={`rounded-full px-3 py-1 ${
                mode === option.value ? "bg-neon-pink text-white" : "bg-surface text-gray-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {!isConnected && (
        <button
          onClick={startVoiceSession}
          disabled={isConnecting}
          className="rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isConnecting ? "Ulanmoqda..." : "Ovozli suhbatni boshlash"}
        </button>
      )}
    </div>
  );
}
