"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { voiceSpeak } from "@/lib/api";

/**
 * Ustoz javobini ovozda o'qish. Bir xil javob qayta tinglansa, server qayta chaqirilmaydi
 * (ovoz xotirada saqlanadi — pul ikki marta ketmaydi). `amplitude` — yuzcha og'zi uchun.
 */
export function useSpeaker(token: string, onError: (message: string) => void) {
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [amplitude, setAmplitude] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef(new Map<string, string>());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setSpeakingKey(null);
  }, []);

  /** Brauzer ovozni faqat bosishdan keyin chalishga ruxsat beradi (iPhone) — birinchi bosishda "ochib" qo'yamiz. */
  const unlock = useCallback(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.play().catch(() => undefined);
    audioRef.current = audio;
  }, []);

  const play = useCallback(
    async (key: string, text: string, full: boolean) => {
      const cacheKey = `${key}:${full ? "full" : "short"}`;
      stop();
      let source = cacheRef.current.get(cacheKey);
      if (!source) {
        setLoadingKey(key);
        try {
          const result = await voiceSpeak(token, text, full);
          source = `data:${result.audio_mime};base64,${result.audio_base64}`;
          cacheRef.current.set(cacheKey, source);
        } catch (err) {
          onErrorRef.current(err instanceof Error ? err.message : "Javobni ovozga aylantirib bo'lmadi");
          return;
        } finally {
          setLoadingKey(null);
        }
      }
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.onended = () => setSpeakingKey(null);
      audio.onerror = () => setSpeakingKey(null);
      audio.src = source;
      setSpeakingKey(key);
      audio.play().catch(() => setSpeakingKey(null));
    },
    [stop, token]
  );

  // Gapirayotganda og'iz harakati.
  useEffect(() => {
    if (!speakingKey) {
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
  }, [speakingKey]);

  useEffect(() => () => audioRef.current?.pause(), []);

  return { play, stop, unlock, speakingKey, loadingKey, amplitude };
}
