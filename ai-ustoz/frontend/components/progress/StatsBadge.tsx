"use client";

import { useEffect, useState } from "react";

import { fetchMyStats } from "@/lib/api";
import type { MyStats } from "@/lib/types";

const REFRESH_MS = 30_000;

export function FlameIcon({ isLit, className = "h-4 w-4" }: { isLit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.2.8 2 1.8 2 1.3 0 2-1.1 1.7-2.7C16.6 10.6 19 13.4 19 16a7 7 0 0 1-14 0c0-4.2 3.8-6.6 7-14Z"
        fill={isLit ? "#fb923c" : "#4b5563"}
      />
      {isLit && <path d="M12 21a3 3 0 0 1-3-3c0-1.8 1.6-2.8 3-5.5 1.4 2.7 3 3.7 3 5.5a3 3 0 0 1-3 3Z" fill="#fde047" />}
    </svg>
  );
}

/**
 * Sarlavhadagi streak va XP nishoni. XP o'yin/test tugaganda o'zgaradi —
 * shuning uchun bo'lim almashganda (`refreshKey`), oyna qayta ochilganda va
 * har 30 soniyada yangilanadi.
 */
export default function StatsBadge({ token, refreshKey, onClick }: { token: string; refreshKey: string; onClick: () => void }) {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetchMyStats(token)
        .then((next) => !isCancelled && setStats(next))
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      isCancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [token, refreshKey]);

  if (!stats) return null;

  return (
    <button
      onClick={onClick}
      title={`Streak: ${stats.streak} kun ketma-ket · Jami ${stats.xp_total} XP`}
      aria-label={`Reyting: ${stats.streak} kunlik streak, ${stats.xp_total} XP`}
      className="flex items-center gap-2 rounded-full border border-gray-800 bg-surface px-3 py-1 text-xs font-semibold"
    >
      <span className={`flex items-center gap-0.5 ${stats.streak > 0 ? "text-orange-400" : "text-gray-500"}`}>
        <FlameIcon isLit={stats.streak > 0} />
        {stats.streak}
      </span>
      <span className="text-neon-violet">{stats.xp_total} XP</span>
    </button>
  );
}
