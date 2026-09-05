"use client";

import { useState } from "react";

import ChatWindow from "@/components/chat/ChatWindow";
import FlashcardDeck from "@/components/flashcards/FlashcardDeck";
import VoiceSession from "@/components/voice/VoiceSession";
import TargetedDrill from "@/components/weakness/TargetedDrill";
import WeaknessRadarChart from "@/components/weakness/WeaknessRadarChart";
import { useOnlineSync } from "@/hooks/useOnlineSync";
import { downloadLessonConspect } from "@/lib/api";
import type { Subject } from "@/lib/types";

type TabKey = "suhbat" | "flashcards" | "radar";

const TABS: { key: TabKey; label: string }[] = [
  { key: "suhbat", label: "Suhbat" },
  { key: "flashcards", label: "Flashcard'lar" },
  { key: "radar", label: "Zaif nuqtalar" },
];

/**
 * Asosiy sahifa: fan tanlash + 3 ta bo'lim (Suhbat/Ovoz, Flashcard'lar,
 * Weakness Radar) va PDF konspekt tugmasi bir joyda.
 *
 * NOTE: `token` bu yerda Supabase Auth sessiyasidan olinishi kerak
 * (masalan, `supabase.auth.getSession()`). Bu skeletonda soddalik uchun
 * localStorage'dan o'qiladi — production'da to'liq auth oqimi bilan almashtiring.
 */
export default function HomePage() {
  const [subject, setSubject] = useState<Subject>("kimyo");
  const [activeTab, setActiveTab] = useState<TabKey>("suhbat");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [token] = useState<string>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("ai_ustoz_token") ?? "" : ""
  );

  const { isOnline, isSyncing } = useOnlineSync(token);

  if (!token) {
    return (
      <main className="flex h-screen items-center justify-center text-center text-gray-400">
        <p>
          Tizimga kirish tokeni topilmadi. Supabase Auth orqali login qiling va tokenni
          <code className="mx-1 rounded bg-surface px-2 py-1">ai_ustoz_token</code>
          nomi bilan localStorage&apos;ga saqlang.
        </p>
      </main>
    );
  }

  async function handleDownloadConspect() {
    setIsDownloadingPdf(true);
    try {
      await downloadLessonConspect(token, subject);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">
          AI <span className="text-neon-cyan">Ustoz</span>
        </h1>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}`}
            title={isOnline ? "Onlayn" : "Offlayn"}
          />
          <span className="text-gray-400">
            {isSyncing ? "Sinxronlanmoqda..." : isOnline ? "Onlayn" : "Offlayn — o'zgarishlar saqlanmoqda"}
          </span>
        </div>

        <div className="flex gap-2">
          {(["kimyo", "biologiya"] as Subject[]).map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                subject === s ? "bg-neon-violet text-white" : "bg-surface text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <nav className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeTab === tab.key ? "bg-neon-cyan text-black" : "bg-surface text-gray-400"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <button
          onClick={handleDownloadConspect}
          disabled={isDownloadingPdf}
          className="ml-auto rounded-full border border-neon-pink/50 px-4 py-1.5 text-sm text-neon-pink disabled:opacity-50"
        >
          {isDownloadingPdf ? "Tayyorlanmoqda..." : "PDF konspekt"}
        </button>
      </nav>

      {activeTab === "suhbat" && (
        <section className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-3">
          <div className="flex items-center justify-center rounded-2xl border border-neon-violet/20 bg-surface/40 md:col-span-1">
            <VoiceSession token={token} subject={subject} />
          </div>
          <div className="rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4 md:col-span-2">
            <ChatWindow token={token} subject={subject} />
          </div>
        </section>
      )}

      {activeTab === "flashcards" && (
        <section className="flex-1 overflow-hidden rounded-2xl border border-neon-violet/20 bg-surface/40 p-4">
          <FlashcardDeck token={token} subject={subject} />
        </section>
      )}

      {activeTab === "radar" && (
        <section className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4">
          <WeaknessRadarChart token={token} subject={subject} />
          <TargetedDrill token={token} subject={subject} />
        </section>
      )}
    </main>
  );
}
