"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { answerBlitz, finishBlitz, startBlitz } from "@/lib/api";
import type { BlitzResult, BlitzStart, Subject } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";
import GameShell, { formatClock } from "./GameShell";

/**
 * 60 soniyada iloji boricha ko'p "to'g'ri/noto'g'ri" tasdiq. Ketma-ket to'g'ri
 * javoblar kombo beradi (3+ — x2, 6+ — x3). Javob bosilishi bilan keyingi tasdiq
 * chiqadi; server natijasi orqadan keladi (tezlik sezilmasin).
 */
export default function Blitz({ token, subject, onExit }: { token: string; subject: Subject; onExit: () => void }) {
  const [game, setGame] = useState<BlitzStart | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [result, setResult] = useState<BlitzResult | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const pendingRef = useRef<Promise<unknown>[]>([]);
  const sequenceRef = useRef(0);
  const appliedSequenceRef = useRef(0);
  const finishedRef = useRef(false);

  const finish = useCallback(async () => {
    if (!game || finishedRef.current) return;
    finishedRef.current = true;
    await Promise.allSettled(pendingRef.current);
    try {
      setResult(await finishBlitz(token, game.attempt_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Natijani olib bo'lmadi");
    }
  }, [game, token]);

  useEffect(() => {
    if (!game || result) return;
    const deadline = new Date(game.deadline_at).getTime();
    const tick = () => {
      const left = deadline - (Date.now() + offsetRef.current);
      setRemainingMs(left);
      if (left <= 0) void finish();
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [finish, game, result]);

  async function start() {
    setIsStarting(true);
    setError(null);
    try {
      const started = await startBlitz(token, subject);
      offsetRef.current = new Date(started.server_now).getTime() - Date.now();
      finishedRef.current = false;
      pendingRef.current = [];
      sequenceRef.current = 0;
      appliedSequenceRef.current = 0;
      setGame(started);
      setIndex(0);
      setScore(0);
      setCombo(0);
      setMultiplier(1);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'yinni boshlab bo'lmadi");
    } finally {
      setIsStarting(false);
    }
  }

  function answer(isTrue: boolean) {
    if (!game || finishedRef.current) return;
    const statement = game.statements[index];
    const sequence = ++sequenceRef.current;
    const request = answerBlitz(token, game.attempt_id, statement.id, isTrue)
      .then((response) => {
        setScore((prev) => Math.max(prev, response.score));
        // Javoblar tarmoqda aralashib kelishi mumkin — kombo faqat eng so'nggisidan olinadi.
        if (sequence > appliedSequenceRef.current) {
          appliedSequenceRef.current = sequence;
          setCombo(response.combo);
          setMultiplier(response.multiplier);
          setFlash(response.correct ? "correct" : "wrong");
          window.setTimeout(() => setFlash(null), 350);
        }
      })
      .catch(() => undefined);
    pendingRef.current.push(request);

    if (index + 1 >= game.statements.length) void finish();
    else setIndex(index + 1);
  }

  if (result) {
    return (
      <GameShell title="Tezkor blits" onBack={onExit}>
        <div className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-widest text-gray-500">Natija</p>
          <p className="text-5xl font-bold text-neon-cyan">{result.score}</p>
          <p className="text-sm text-gray-400">
            {result.correct} to&apos;g&apos;ri · {result.wrong} xato · eng uzun kombo {result.best_combo}
          </p>
          <p className="inline-block rounded-full bg-neon-violet/20 px-3 py-1 text-sm text-neon-violet">+{result.xp_earned} XP</p>
        </div>
        <button onClick={start} disabled={isStarting} className="w-full rounded-xl bg-gradient-to-br from-neon-cyan to-neon-violet py-3 text-sm font-bold text-white">
          {isStarting ? "Tayyorlanmoqda..." : "Yana o'ynash"}
        </button>
      </GameShell>
    );
  }

  if (!game) {
    return (
      <GameShell title="Tezkor blits" onBack={onExit} error={error}>
        <p className="text-sm text-gray-400">
          60 soniya. Har bir tasdiq to&apos;g&apos;rimi yoki noto&apos;g&apos;ri — tez qaror qil. Ketma-ket 3 ta to&apos;g&apos;ri
          javob — ochko ikki barobar, 6 ta — uch barobar. Bitta xato komboni yo&apos;qotadi.
        </p>
        <button
          onClick={start}
          disabled={isStarting}
          className="w-full rounded-xl bg-gradient-to-br from-neon-cyan to-neon-violet py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {isStarting ? "Savollar tayyorlanmoqda..." : "Boshlash"}
        </button>
      </GameShell>
    );
  }

  const statement = game.statements[Math.min(index, game.statements.length - 1)];
  const isLow = remainingMs < 10_000;

  return (
    <GameShell
      title="Tezkor blits"
      onBack={onExit}
      error={error}
      right={<span className={`font-mono text-lg font-bold ${isLow ? "text-red-400" : "text-white"}`}>{formatClock(remainingMs)}</span>}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          Ochko: <b className="text-white">{score}</b>
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${multiplier > 1 ? "bg-orange-500 text-black" : "bg-surface text-gray-500"}`}>
          {combo > 0 ? `kombo ${combo} · x${multiplier}` : "x1"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
        <div className="h-full bg-neon-cyan transition-all" style={{ width: `${Math.max(0, Math.min(100, remainingMs / 600))}%` }} />
      </div>

      <div
        className={`flex min-h-[10rem] flex-col justify-center rounded-2xl border-2 p-5 text-center transition-colors ${
          flash === "correct" ? "border-green-500 bg-green-500/10" : flash === "wrong" ? "border-red-500 bg-red-500/10" : "border-gray-800 bg-black/30"
        }`}
      >
        <p className="mb-2 text-xs text-gray-500">{statement.topic}</p>
        <div className="text-lg">
          <MarkdownRenderer content={statement.text} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => answer(false)} className="rounded-2xl bg-red-500/90 py-5 text-lg font-bold text-white active:scale-95">
          Noto&apos;g&apos;ri
        </button>
        <button onClick={() => answer(true)} className="rounded-2xl bg-green-500/90 py-5 text-lg font-bold text-white active:scale-95">
          To&apos;g&apos;ri
        </button>
      </div>
    </GameShell>
  );
}
