"use client";

import { useState } from "react";

import { answerMillioner, millionerFifty, millionerHint, startMillioner, walkAwayMillioner } from "@/lib/api";
import type { MillionerAnswerResult, MillionerState, Subject } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";
import TutorMascot from "../voice/TutorMascot";
import GameShell, { formatPoints } from "./GameShell";

/**
 * "Kim millioner bo'lishni xohlaydi?" uslubidagi o'yin: 15 savol qiyinlashib
 * boradi, 5- va 10-savoldan keyin yutuq kafolatlanadi, bitta xato — o'yin tugaydi.
 */
export default function Millionaire({ token, subject, onExit }: { token: string; subject: Subject; onExit: () => void }) {
  const [game, setGame] = useState<MillionerState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<MillionerAnswerResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showLadder, setShowLadder] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setIsBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function start() {
    const started = await run(() => startMillioner(token, subject));
    if (started) {
      setGame(started);
      setReveal(null);
      setSelected(null);
      setHint(null);
    }
  }

  async function lockAnswer() {
    if (!game || selected === null) return;
    const result = await run(() => answerMillioner(token, game.attempt_id, selected));
    if (result) setReveal(result);
  }

  function nextQuestion() {
    if (!reveal) return;
    setGame(reveal.game);
    setReveal(null);
    setSelected(null);
    setHint(null);
  }

  if (!game) {
    return (
      <GameShell title="Millioner" onBack={onExit} error={error}>
        <p className="text-sm text-gray-400">
          15 ta savol, har biri oldingisidan qiyinroq. 5- va 10-savoldan keyin yutuq kafolatlanadi. Bitta xato — o&apos;yin
          tugaydi. Ikki yordam bor: <b>50/50</b> va <b>Ustoz maslahati</b>.
        </p>
        <button
          onClick={start}
          disabled={isBusy}
          className="w-full rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {isBusy ? "Savollar tayyorlanmoqda..." : "O'yinni boshlash"}
        </button>
      </GameShell>
    );
  }

  const shown = reveal?.game ?? game;
  const isOver = shown.status === "finished";

  if (isOver && !reveal) {
    return (
      <GameShell title="Millioner" onBack={onExit} error={error}>
        <div className="space-y-2 text-center">
          <div className="mx-auto w-40">
            <TutorMascot emotion={shown.won ? "happy" : shown.level >= 5 ? "shocked" : "laughing"} amplitude={0} isActive />
          </div>
          <p className="text-lg font-bold text-white">{shown.won ? "Millioner bo'ldingiz!" : "O'yin tugadi"}</p>
          <p className="text-3xl font-bold text-yellow-400">{formatPoints(shown.prize)} ochko</p>
          <p className="text-sm text-gray-400">
            {shown.level} / {shown.prize_ladder.length} savol · +{shown.xp_earned} XP
          </p>
        </div>
        <button onClick={start} className="w-full rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 py-3 text-sm font-bold text-black">
          Yana o&apos;ynash
        </button>
      </GameShell>
    );
  }

  const question = game.question;
  if (!question) return null;
  const currentPrize = game.prize_ladder[game.level];

  return (
    <GameShell title="Millioner" onBack={onExit} error={error}>
      <button
        onClick={() => setShowLadder((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-sm"
      >
        <span className="text-gray-300">
          {game.level + 1}-savol · <b className="text-yellow-400">{formatPoints(currentPrize)}</b> ochko uchun
        </span>
        <span className="text-xs text-gray-500">{showLadder ? "Yopish" : "Zinapoya"}</span>
      </button>

      {showLadder && (
        <ol className="space-y-0.5 rounded-xl border border-gray-800 p-2 text-xs">
          {[...game.prize_ladder].reverse().map((prize, reversedIndex) => {
            const levelNumber = game.prize_ladder.length - reversedIndex;
            const isCurrent = levelNumber === game.level + 1;
            const isSafe = game.safe_levels.includes(levelNumber);
            return (
              <li
                key={prize}
                className={`flex justify-between rounded px-2 py-0.5 ${
                  isCurrent ? "bg-yellow-400 font-bold text-black" : levelNumber <= game.level ? "text-gray-600" : isSafe ? "text-white" : "text-gray-400"
                }`}
              >
                <span>{levelNumber}</span>
                <span>
                  {isSafe && "★ "}{formatPoints(prize)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
        <p className="mb-1 text-xs text-gray-500">{question.topic}</p>
        <MarkdownRenderer content={question.question} />
      </div>

      <div className="grid gap-2">
        {question.options.map((option, index) => {
          const isRemoved = question.removed.includes(index);
          const isCorrect = reveal && index === reveal.correct_index;
          const isWrongPick = reveal && index === selected && !reveal.correct;
          return (
            <button
              key={index}
              disabled={isRemoved || !!reveal || isBusy}
              onClick={() => setSelected(index)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                isRemoved
                  ? "invisible"
                  : isCorrect
                    ? "border-green-500 bg-green-500/20"
                    : isWrongPick
                      ? "border-red-500 bg-red-500/20"
                      : selected === index
                        ? "border-yellow-400 bg-yellow-400/15"
                        : "border-gray-700 hover:border-yellow-400/50"
              }`}
            >
              <span className="font-bold text-yellow-400">{"ABCD"[index]}:</span>
              <MarkdownRenderer content={option} />
            </button>
          );
        })}
      </div>

      {hint && !reveal && (
        <div className="rounded-xl bg-neon-violet/10 px-3 py-2 text-sm text-gray-200">
          <b>Ustoz:</b> {hint}
        </div>
      )}

      {reveal ? (
        <div className="space-y-3">
          <div className={`rounded-xl px-3 py-2 text-sm ${reveal.correct ? "bg-green-500/10" : "bg-red-500/10"}`}>
            <p className="font-semibold text-white">{reveal.correct ? "To'g'ri!" : "Afsus, noto'g'ri."}</p>
            {reveal.explanation && <MarkdownRenderer content={reveal.explanation} />}
          </div>
          <button onClick={nextQuestion} className="w-full rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 py-3 text-sm font-bold text-black">
            {reveal.game.status === "finished" ? "Natijani ko'rish" : "Keyingi savol"}
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={lockAnswer}
            disabled={selected === null || isBusy}
            className="w-full rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 py-3 text-sm font-bold text-black disabled:opacity-40"
          >
            Javobni tasdiqlash
          </button>
          <div className="flex gap-2 text-xs">
            <button
              onClick={async () => {
                const updated = await run(() => millionerFifty(token, game.attempt_id));
                if (updated) {
                  setGame(updated);
                  if (selected !== null && updated.question?.removed.includes(selected)) setSelected(null);
                }
              }}
              disabled={!game.lifelines.fifty || isBusy}
              className="flex-1 rounded-lg border border-gray-700 py-2 text-gray-200 disabled:opacity-30"
            >
              50 : 50
            </button>
            <button
              onClick={async () => {
                const result = await run(() => millionerHint(token, game.attempt_id));
                if (result) {
                  setHint(result.hint);
                  setGame({ ...game, lifelines: { ...game.lifelines, hint: false } });
                }
              }}
              disabled={!game.lifelines.hint || isBusy}
              className="flex-1 rounded-lg border border-gray-700 py-2 text-gray-200 disabled:opacity-30"
            >
              Ustoz maslahati
            </button>
            <button
              onClick={async () => {
                const updated = await run(() => walkAwayMillioner(token, game.attempt_id));
                if (updated) setGame(updated);
              }}
              disabled={game.level === 0 || isBusy}
              className="flex-1 rounded-lg border border-gray-700 py-2 text-gray-200 disabled:opacity-30"
            >
              Olib ketish
            </button>
          </div>
        </>
      )}
    </GameShell>
  );
}
