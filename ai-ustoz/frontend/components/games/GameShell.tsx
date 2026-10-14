"use client";

import type { ReactNode } from "react";

export function formatPoints(points: number): string {
  return points.toLocaleString("ru-RU").replace(/,/g, " ");
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function GameShell({
  title,
  onBack,
  error,
  right,
  children,
}: {
  title: string;
  onBack: () => void;
  error?: string | null;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-white">
          ← O&apos;yinlar
        </button>
        <p className="font-semibold text-white">{title}</p>
        <div className="min-w-[4rem] text-right">{right}</div>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {children}
    </div>
  );
}
