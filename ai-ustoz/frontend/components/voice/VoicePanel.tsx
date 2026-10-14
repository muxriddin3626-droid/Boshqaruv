"use client";

import { useEffect, useState } from "react";

import { fetchVoiceOptions } from "@/lib/api";
import type { Subject } from "@/lib/types";

import EconomyVoiceSession from "./EconomyVoiceSession";
import VoiceSession from "./VoiceSession";

/**
 * Ovozli dars: standart — tejamkor rejim (arzon). Jonli (Premium, OpenAI Realtime) faqat
 * administrator yoki REALTIME_VOICE_FOR_STUDENTS yoqilgan bo'lsa ko'rinadi.
 */
export default function VoicePanel({ token, subject }: { token: string; subject: Subject }) {
  const [premiumAllowed, setPremiumAllowed] = useState(false);
  const [engine, setEngine] = useState<"economy" | "premium">("economy");

  useEffect(() => {
    fetchVoiceOptions(token)
      .then((options) => setPremiumAllowed(options.premium_allowed))
      .catch(() => setPremiumAllowed(false));
  }, [token]);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {premiumAllowed && (
        <div className="flex gap-1 rounded-full bg-surface p-1 text-[11px]" data-testid="voice-engine">
          {(
            [
              { value: "economy" as const, label: "Tejamkor ovoz" },
              { value: "premium" as const, label: "Jonli (Premium)" },
            ]
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setEngine(option.value)}
              className={`rounded-full px-3 py-1 ${engine === option.value ? "bg-neon-cyan text-black" : "text-gray-400"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {engine === "premium" && premiumAllowed ? (
        <VoiceSession token={token} subject={subject} />
      ) : (
        <EconomyVoiceSession token={token} subject={subject} />
      )}
    </div>
  );
}
