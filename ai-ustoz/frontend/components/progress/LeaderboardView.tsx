"use client";

import { useEffect, useState } from "react";

import { fetchLeaderboard, fetchMyStats } from "@/lib/api";
import type { Leaderboard, LeaderboardPeriod, LeaderboardScope, MyStats } from "@/lib/types";

import { FlameIcon } from "./StatsBadge";

const MEDAL = ["bg-yellow-400 text-black", "bg-gray-300 text-black", "bg-orange-400 text-black"];

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (next: T) => void }) {
  return (
    <div className="flex rounded-full bg-surface p-0.5 text-xs">
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`rounded-full px-3 py-1 font-medium transition ${value === option.key ? "bg-neon-violet text-white" : "text-gray-400"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/30 p-2 text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

/** Reyting: haftalik/umumiy XP, butun platforma yoki faqat o'z sinfi. */
export default function LeaderboardView({ token }: { token: string }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [scope, setScope] = useState<LeaderboardScope>("all");
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setError(null);
    Promise.all([fetchLeaderboard(token, period, scope), fetchMyStats(token)])
      .then(([nextBoard, nextStats]) => {
        if (isCancelled) return;
        setBoard(nextBoard);
        setStats(nextStats);
      })
      .catch((err) => !isCancelled && setError(err instanceof Error ? err.message : "Reytingni yuklab bo'lmadi"));
    return () => {
      isCancelled = true;
    };
  }, [token, period, scope]);

  const isMeListed = board?.rows.some((row) => row.is_me) ?? false;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {stats && (
        <div className="space-y-3 rounded-2xl border border-neon-violet/30 bg-neon-violet/5 p-4">
          <div className="flex items-center gap-3">
            <FlameIcon isLit={stats.streak > 0} className="h-10 w-10" />
            <div>
              <p className="text-lg font-bold text-white">{stats.streak} kunlik streak</p>
              <p className="text-xs text-gray-400">
                {stats.streak > 0 ? "Har kuni bitta test yoki o'yin — olov o'chmasin!" : "Bugun bitta test yoki o'yin o'tkazib, streakni boshlang."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="shu hafta XP" value={stats.week_xp} />
            <Stat label="jami XP" value={stats.xp_total} />
            <Stat label="eng uzun streak" value={stats.longest_streak} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toggle
          value={period}
          onChange={setPeriod}
          options={[
            { key: "week", label: "Shu hafta" },
            { key: "all", label: "Umumiy" },
          ]}
        />
        <Toggle
          value={scope}
          onChange={setScope}
          options={[
            { key: "all", label: "Hammasi" },
            { key: "grade", label: "Mening sinfim" },
          ]}
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {board && board.rows.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">
          {period === "week" ? "Bu hafta hali hech kim XP to'plamadi — birinchi bo'ling!" : "Reyting hali bo'sh."}
        </p>
      )}

      {board && board.rows.length > 0 && (
        <ol className="space-y-1.5" data-testid="leaderboard">
          {board.rows.map((row) => (
            <li
              key={`${row.rank}-${row.name}-${row.xp}-${row.is_me}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${row.is_me ? "border border-neon-cyan/60 bg-neon-cyan/10" : "bg-surface"}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${MEDAL[row.rank - 1] ?? "bg-gray-800 text-gray-300"}`}
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-white">
                {row.name}
                {row.is_me && <span className="ml-1 text-neon-cyan">(siz)</span>}
                <span className="ml-1 text-xs text-gray-500">· {row.grade}-sinf</span>
              </span>
              {row.streak > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-orange-400">
                  <FlameIcon isLit className="h-3.5 w-3.5" />
                  {row.streak}
                </span>
              )}
              <span className="w-16 text-right font-mono font-semibold text-neon-violet">{row.xp}</span>
            </li>
          ))}
        </ol>
      )}

      {board && !isMeListed && (
        <p className="rounded-xl border border-dashed border-gray-700 px-3 py-2 text-center text-sm text-gray-400">
          Sizning o&apos;rningiz: <b className="text-white">{board.my_rank}</b> · {board.my_xp} XP
        </p>
      )}
    </div>
  );
}
