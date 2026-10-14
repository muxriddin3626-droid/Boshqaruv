"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Berilgan MediaStream'ning ovoz amplitudasini (0..1 oralig'ida) real-vaqtda
 * hisoblab beradi. Neon Orb shu qiymatga qarab "tebranadi".
 */
export function useAudioVisualizer(stream: MediaStream | null): number {
  const [amplitude, setAmplitude] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setAmplitude(0);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAmplitude(Math.min(average / 128, 1));
      frameRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return amplitude;
}
