"use client";

import { useState } from "react";

import ChatWindow from "@/components/chat/ChatWindow";
import VoiceSession from "@/components/voice/VoiceSession";
import type { Subject } from "@/lib/types";

/**
 * Asosiy sahifa: fan tanlash, matnli chat va ovozli suhbat (Neon Orb) bir joyda.
 *
 * NOTE: `token` bu yerda Supabase Auth sessiyasidan olinishi kerak
 * (masalan, `supabase.auth.getSession()`). Bu skeletonda soddalik uchun
 * localStorage'dan o'qiladi — production'da to'liq auth oqimi bilan almashtiring.
 */
export default function HomePage() {
  const [subject, setSubject] = useState<Subject>("kimyo");
  const [token] = useState<string>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("ai_ustoz_token") ?? "" : ""
  );

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

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">
          AI <span className="text-neon-cyan">Ustoz</span>
        </h1>
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

      <section className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-3">
        <div className="flex items-center justify-center rounded-2xl border border-neon-violet/20 bg-surface/40 md:col-span-1">
          <VoiceSession token={token} />
        </div>
        <div className="rounded-2xl border border-neon-cyan/20 bg-surface/40 p-4 md:col-span-2">
          <ChatWindow token={token} subject={subject} />
        </div>
      </section>
    </main>
  );
}
