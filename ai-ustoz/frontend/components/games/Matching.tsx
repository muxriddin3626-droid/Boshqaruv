"use client";

import { useEffect, useRef, useState } from "react";

import { matchPair, startMatching } from "@/lib/api";
import type { MatchingResult, MatchingStart, Subject } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";
import GameShell, { formatClock } from "./GameShell";

const PAIR_COLORS = [
  "border-cyan-400 bg-cyan-400/15",
  "border-violet-400 bg-violet-400/15",
  "border-pink-400 bg-pink-400/15",
  "border-yellow-400 bg-yellow-400/15",
  "border-green-400 bg-green-400/15",
  "border-orange-400 bg-orange-400/15",
];

type Side = "left" | "right";

/** Atamani ta'rifi bilan juftlash: chap va o'ng ustundan bittadan tanlanadi. */
export default function Matching({ token, subject, onExit }: { token: string; subject: Subject; onExit: () => void }) {
  const [game, setGame] = useState<MatchingStart | null>(null);
  const [selected, setSelected] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });
  const [matched, setMatched] = useState<[number, number][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<{ left: number; right: number } | null>(null);
  const [result, setResult] = useState<MatchingResult | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!game || result) return;
    const deadline = new Date(game.deadline_at).getTime();
    const tick = () => setRemainingMs(deadline - (Date.now() + offsetRef.current));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [game, result]);

  async function start() {
    setIsBusy(true);
    setError(null);
    try {
      const started = await startMatching(token, subject);
      offsetRef.current = new Date(started.server_now).getTime() - Date.now();
      setGame(started);
      setMatched([]);
      setMistakes(0);
      setSelected({ left: null, right: null });
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'yinni boshlab bo'lmadi");
    } finally {
      setIsBusy(false);
    }
  }

  async function pick(side: Side, index: number) {
    if (!game || isBusy) return;
    const next = { ...selected, [side]: selected[side] === index ? null : index };
    setSelected(next);
    if (next.left === null || next.right === null) return;

    setIsBusy(true);
    try {
      const response = await matchPair(token, game.attempt_id, next.left, next.right);
      setMatched(response.matched);
      setMistakes(response.mistakes);
      if (!response.correct && !response.time_is_up) {
        setWrongFlash({ left: next.left, right: next.right });
        window.setTimeout(() => setWrongFlash(null), 600);
      }
      if (response.finished) setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Javob yuborilmadi");
    } finally {
      setSelected({ left: null, right: null });
      setIsBusy(false);
    }
  }

  if (!game) {
    return (
      <GameShell title="Juftlash" onBack={onExit} error={error}>
        <p className="text-sm text-gray-400">
          6 ta juft: chap ustundagi har bir elementni o&apos;ng ustundagi mosi bilan juftlang. 3 daqiqa vaqt bor — xatosiz va
          30 soniyada topsangiz bonus XP.
        </p>
        <button onClick={start} disabled={isBusy} className="w-full rounded-xl bg-gradient-to-br from-neon-pink to-neon-violet py-3 text-sm font-bold text-white disabled:opacity-50">
          {isBusy ? "Tayyorlanmoqda..." : "Boshlash"}
        </button>
      </GameShell>
    );
  }

  const pairOf = (side: Side, index: number) => matched.findIndex((pair) => pair[side === "left" ? 0 : 1] === index);

  const cell = (side: Side, index: number, text: string) => {
    const pairIndex = pairOf(side, index);
    const isWrong = wrongFlash && wrongFlash[side] === index;
    const isSelected = selected[side] === index;
    return (
      <button
        key={`${side}-${index}`}
        onClick={() => pick(side, index)}
        disabled={pairIndex >= 0 || !!result}
        className={`min-h-[3.5rem] w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
          pairIndex >= 0
            ? PAIR_COLORS[pairIndex % PAIR_COLORS.length]
            : isWrong
              ? "border-red-500 bg-red-500/20"
              : isSelected
                ? "border-white bg-white/10"
                : "border-gray-700 hover:border-neon-violet/60"
        }`}
      >
        <MarkdownRenderer content={text} />
      </button>
    );
  };

  return (
    <GameShell
      title="Juftlash"
      onBack={onExit}
      error={error}
      right={!result && <span className="font-mono text-lg font-bold text-white">{formatClock(remainingMs)}</span>}
    >
      <div>
        <p className="text-sm font-medium text-white">{game.title}</p>
        <p className="text-xs text-gray-500">
          {game.topic} · {matched.length}/{game.left.length} juft · {mistakes} xato
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">{game.left.map((text, i) => cell("left", i, text))}</div>
        <div className="space-y-2">{game.right.map((text, i) => cell("right", i, text))}</div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl bg-neon-violet/10 p-3 text-center">
            <p className="font-semibold text-white">
              {result.time_is_up ? "Vaqt tugadi" : mistakes === 0 ? "Mukammal — xatosiz!" : "Hammasi topildi!"}
            </p>
            <p className="text-sm text-gray-400">
              {matched.length}/{game.left.length} juft · {mistakes} xato · +{result.xp_earned} XP
            </p>
          </div>
          {result.explanation && (
            <div className="rounded-xl border border-gray-800 p-3 text-sm text-gray-300">
              <MarkdownRenderer content={result.explanation} />
            </div>
          )}
          <button onClick={start} disabled={isBusy} className="w-full rounded-xl bg-gradient-to-br from-neon-pink to-neon-violet py-3 text-sm font-bold text-white">
            Yana o&apos;ynash
          </button>
        </div>
      )}
    </GameShell>
  );
}
