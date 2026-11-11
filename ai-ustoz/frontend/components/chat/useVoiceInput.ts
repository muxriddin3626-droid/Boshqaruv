"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { voiceTranscribe } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;
export type VoiceInputState = "idle" | "recording" | "transcribing";

const MAX_RECORDING_MS = 60_000;

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Ovozli xabar: bir bosish — yozish, ikkinchi bosish — yuborish. Avval brauzerning o'zi
 * nutqni matnga aylantiradi (bepul, uz-UZ); u bo'lmasa yoki ishlamasa — ovoz yozib olinib,
 * serverda matnga aylantiriladi.
 */
export function useVoiceInput(token: string, onText: (text: string) => void, onError: (message: string) => void) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const useServerRef = useRef(false);
  const timerRef = useRef<number>();
  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);
  onTextRef.current = onText;
  onErrorRef.current = onError;

  const finish = useCallback((text: string) => {
    window.clearTimeout(timerRef.current);
    setInterim("");
    setState("idle");
    if (text.trim()) onTextRef.current(text.trim());
  }, []);

  const startServerRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setState("transcribing");
        try {
          finish(await voiceTranscribe(token, new Blob(chunks, { type: recorder.mimeType })));
        } catch (err) {
          finish("");
          onErrorRef.current(err instanceof Error ? err.message : "Ovozni tushunib bo'lmadi");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      timerRef.current = window.setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORDING_MS);
    } catch {
      onErrorRef.current("Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida mikrofonni yoqing.");
    }
  }, [finish, token]);

  const start = useCallback(() => {
    const Ctor = useServerRef.current ? null : recognitionCtor();
    if (!Ctor) {
      void startServerRecording();
      return;
    }
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "uz-UZ";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = "";
    let lastInterim = "";
    let failed = false;
    recognition.onresult = (event: any) => {
      lastInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else lastInterim += result[0].transcript;
      }
      setInterim(`${finalText}${lastInterim}`.trim());
    };
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      failed = true;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onErrorRef.current("Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida mikrofonni yoqing.");
      } else {
        // Brauzer o'zbek nutqini taniy olmadi — keyingi safar ovoz serverda matnga aylantiriladi.
        useServerRef.current = true;
        onErrorRef.current("Telefon nutqni taniy olmadi — 🎙 ni yana bosib, qaytadan gapiring.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      finish(failed ? "" : `${finalText}${lastInterim}`);
    };
    try {
      recognition.start();
      setState("recording");
      timerRef.current = window.setTimeout(() => recognition.stop(), MAX_RECORDING_MS);
    } catch {
      useServerRef.current = true;
      void startServerRecording();
    }
  }, [finish, startServerRecording]);

  const stop = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    else if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === "idle") start();
    else if (state === "recording") stop();
  }, [start, state, stop]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      recognitionRef.current?.abort?.();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    },
    []
  );

  return { state, interim, toggle };
}
