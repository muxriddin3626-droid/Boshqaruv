"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import TutorMascot from "@/components/voice/TutorMascot";
import { EMOTIONS } from "@/components/voice/realtimeEvents";

/** Faqat dev rejimida: yuzchaning barcha kayfiyatlarini OpenAI kalitisiz ko'rib chiqish. */
export default function MascotPreviewPage() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  useEffect(() => {
    if (!isSpeaking) {
      setAmplitude(0);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = () => {
      const t = (performance.now() - startedAt) / 1000;
      setAmplitude(Math.max(0, 0.45 + 0.4 * Math.sin(t * 11) * Math.sin(t * 3.1)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isSpeaking]);

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Yuzcha kayfiyatlari</h1>
        <button
          onClick={() => setIsSpeaking((value) => !value)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300"
        >
          {isSpeaking ? "Gapirishni to'xtatish" : "Gapirishni ko'rsatish"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {EMOTIONS.map((emotion) => (
          <div key={emotion} className="flex flex-col items-center gap-2 rounded-2xl border border-gray-800 p-4">
            <TutorMascot emotion={emotion} amplitude={amplitude} isActive />
            <span className="font-mono text-xs text-gray-400">{emotion}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
