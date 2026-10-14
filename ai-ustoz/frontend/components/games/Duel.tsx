"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { answerDuel, cancelDuel, createDuel, fetchDuel, joinDuel } from "@/lib/api";
import type { DuelPlayer, DuelState, Subject } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";
import TutorMascot from "../voice/TutorMascot";
import GameShell, { formatClock } from "./GameShell";

const STORAGE_KEY = "ai_ustoz_duel";
const POLL_MS = 1500;
const FEEDBACK_MS = 900;
const CODE_CHARS = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
const SUBJECT_LABEL: Record<Subject, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };

type Feedback = { questionId: string; choice: number; correct: boolean; correctIndex: number };

function rememberDuel(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Saqlash ishlamasa ham duel davom etadi — faqat sahifa yangilanganda tiklanmaydi.
  }
}

function storedDuel(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function PlayerBar({ label, player, total, accent }: { label: string; player: DuelPlayer | null; total: number; accent: string }) {
  const answered = player?.answered ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate text-gray-300">
          {label}
          {player?.finished && <span className="ml-1 text-gray-500">· tugatdi</span>}
        </span>
        <span className="font-mono text-white">
          {player?.correct ?? 0} to&apos;g&apos;ri · {answered}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div className={`h-full transition-all ${accent}`} style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

/**
 * Do'st bilan duel: biri kod yaratadi, ikkinchisi kodni kiritadi, ikkalasi bir xil
 * 10 savolga javob beradi. Ko'proq to'g'ri javob (teng bo'lsa — tezroq) yutadi.
 * Holat har 1.5 soniyada serverdan olinadi; g'olibni server aniqlaydi.
 */
export default function Duel({ token, subject, onExit }: { token: string; subject: Subject; onExit: () => void }) {
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const pollingRef = useRef(false);
  // Javob yuborilgandan oldin boshlangan so'rov eski holatni qaytarib, savolni qayta ko'rsatmasin.
  const versionRef = useRef(0);

  const applyDuel = useCallback((next: DuelState) => {
    offsetRef.current = new Date(next.server_now).getTime() - Date.now();
    setDuel(next);
    rememberDuel(next.status === "waiting" || next.status === "active" ? next.id : null);
  }, []);

  useEffect(() => {
    const id = storedDuel();
    if (!id) return;
    fetchDuel(token, id)
      .then((restored) => {
        if (restored.status === "waiting" || restored.status === "active") applyDuel(restored);
        else rememberDuel(null);
      })
      .catch(() => rememberDuel(null));
  }, [applyDuel, token]);

  const liveId = duel?.status === "waiting" || duel?.status === "active" ? duel.id : null;
  useEffect(() => {
    if (!liveId) return;
    const timer = window.setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      const version = versionRef.current;
      try {
        const next = await fetchDuel(token, liveId);
        if (version === versionRef.current) applyDuel(next);
      } catch {
        // Bitta muvaffaqiyatsiz so'rov — keyingisi qayta urinadi.
      } finally {
        pollingRef.current = false;
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [applyDuel, liveId, token]);

  useEffect(() => {
    if (duel?.status !== "active" || !duel.deadline_at) return;
    const deadline = new Date(duel.deadline_at).getTime();
    const tick = () => setRemainingMs(deadline - (Date.now() + offsetRef.current));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [duel?.status, duel?.deadline_at]);

  async function run(action: () => Promise<DuelState>) {
    setIsBusy(true);
    setError(null);
    try {
      versionRef.current += 1;
      applyDuel(await action());
      setFeedback(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setIsBusy(false);
    }
  }

  async function pick(questionId: string, choice: number) {
    if (!duel || isBusy || feedback) return;
    setIsBusy(true);
    setError(null);
    versionRef.current += 1;
    try {
      const response = await answerDuel(token, duel.id, questionId, choice);
      setFeedback({ questionId, choice, correct: response.correct, correctIndex: response.correct_index });
      window.setTimeout(() => {
        versionRef.current += 1;
        applyDuel(response.duel);
        setFeedback(null);
      }, FEEDBACK_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Javob yuborilmadi");
      // Masalan, vaqt tugagan bo'lsa — haqiqiy holatni olamiz.
      fetchDuel(token, duel.id).then(applyDuel).catch(() => undefined);
    } finally {
      setIsBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function leave() {
    rememberDuel(null);
    setDuel(null);
    setFeedback(null);
    setError(null);
  }

  // --- Lobbi: yaratish yoki kod bilan qo'shilish
  if (!duel) {
    return (
      <GameShell title="Do'st bilan duel" onBack={onExit} error={error}>
        <p className="text-sm text-gray-400">
          Ikkalangizga bir xil 10 ta savol. Ko&apos;proq to&apos;g&apos;ri javob bergan yutadi, teng bo&apos;lsa — tezrog&apos;i.
          G&apos;olibga +30 XP.
        </p>
        <button
          onClick={() => run(() => createDuel(token, subject))}
          disabled={isBusy}
          className="w-full rounded-xl bg-gradient-to-br from-orange-400 to-neon-pink py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {isBusy ? "Savollar tayyorlanmoqda..." : `${SUBJECT_LABEL[subject]} bo'yicha duel yaratish`}
        </button>
        <div className="rounded-xl border border-gray-800 p-3">
          <p className="mb-2 text-sm text-gray-300">Do&apos;stingiz kod yubordimi?</p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (codeInput.length === 6) void run(() => joinDuel(token, codeInput));
            }}
          >
            <input
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value.toUpperCase().replace(CODE_CHARS, "").slice(0, 6))}
              placeholder="KOD"
              aria-label="Duel kodi"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-black/30 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-gray-600"
            />
            <button
              type="submit"
              disabled={isBusy || codeInput.length !== 6}
              className="rounded-lg bg-neon-violet px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Qo&apos;shilish
            </button>
          </form>
        </div>
      </GameShell>
    );
  }

  const total = duel.questions.length || 10;
  const opponentLabel = duel.opponent?.name ?? "Raqib";

  // --- Kutish: kodni do'stga yuborish
  if (duel.status === "waiting") {
    return (
      <GameShell title="Do'st bilan duel" onBack={onExit} error={error}>
        <div className="space-y-3 rounded-2xl border border-orange-400/30 bg-orange-400/5 p-5 text-center">
          <p className="text-sm text-gray-400">Bu kodni do&apos;stingizga yuboring</p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em] text-white" data-testid="duel-code">
            {duel.code}
          </p>
          <button onClick={() => copyCode(duel.code)} className="rounded-lg border border-gray-700 px-4 py-1.5 text-sm text-gray-200">
            {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
          <p className="animate-pulse text-sm text-gray-500">Do&apos;stingiz kutilmoqda... ({SUBJECT_LABEL[duel.subject]}, 10 daqiqa ichida)</p>
        </div>
        <button
          onClick={() => run(() => cancelDuel(token, duel.id))}
          disabled={isBusy}
          className="w-full rounded-xl border border-gray-700 py-2.5 text-sm text-gray-300"
        >
          Bekor qilish
        </button>
      </GameShell>
    );
  }

  if (duel.status === "cancelled" || duel.status === "expired") {
    return (
      <GameShell title="Do'st bilan duel" onBack={onExit} error={error}>
        <p className="text-center text-sm text-gray-400">
          {duel.status === "expired" ? "Do'stingiz 10 daqiqa ichida qo'shilmadi." : "Duel bekor qilindi."}
        </p>
        <button onClick={leave} className="w-full rounded-xl bg-gradient-to-br from-orange-400 to-neon-pink py-3 text-sm font-bold text-white">
          Yangi duel
        </button>
      </GameShell>
    );
  }

  // --- Natija
  if (duel.status === "finished") {
    const title = duel.result === "win" ? "Siz yutdingiz!" : duel.result === "loss" ? `${opponentLabel} yutdi` : "Durang!";
    return (
      <GameShell title="Do'st bilan duel" onBack={onExit} error={error}>
        <div className="space-y-2 text-center">
          <div className="mx-auto w-36">
            <TutorMascot emotion={duel.result === "win" ? "happy" : duel.result === "loss" ? "laughing" : "shocked"} amplitude={0} isActive />
          </div>
          <p className="text-xl font-bold text-white">{title}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { label: "Siz", player: duel.me },
              { label: opponentLabel, player: duel.opponent },
            ].map(({ label, player }) => (
              <div key={label} className="rounded-xl bg-surface p-3">
                <p className="truncate text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-white">
                  {player?.correct ?? 0}/{total}
                </p>
                <p className="text-xs text-gray-500">{player?.seconds != null ? `${Math.round(player.seconds)} soniya` : "—"}</p>
              </div>
            ))}
          </div>
          <p className="inline-block rounded-full bg-neon-violet/20 px-3 py-1 text-sm text-neon-violet">+{duel.xp_earned} XP</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-white">Savollar tahlili</p>
          {duel.questions.map((question, index) => {
            const mine = duel.my_answers[question.id];
            const isRight = mine === question.correct_index;
            return (
              <div key={question.id} className={`rounded-xl border p-3 text-sm ${isRight ? "border-green-500/30" : "border-red-500/30"}`}>
                <p className="mb-1 text-xs text-gray-500">
                  {index + 1}. {question.topic}
                </p>
                <MarkdownRenderer content={question.question} />
                <p className="mt-1 text-xs">
                  <span className={isRight ? "text-green-400" : "text-red-400"}>
                    Siz: {mine === undefined ? "javob yo'q" : "ABCD"[mine]}
                  </span>
                  {!isRight && question.correct_index !== null && (
                    <span className="text-green-400"> · To&apos;g&apos;ri: {"ABCD"[question.correct_index]}</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <button onClick={leave} className="w-full rounded-xl bg-gradient-to-br from-orange-400 to-neon-pink py-3 text-sm font-bold text-white">
          Yana duel
        </button>
      </GameShell>
    );
  }

  // --- O'yin
  const current = feedback
    ? duel.questions.find((question) => question.id === feedback.questionId)
    : duel.questions.find((question) => duel.my_answers[question.id] === undefined);
  const isLow = remainingMs < 30_000;
  const scoreboard = (
    <div className="space-y-2 rounded-xl border border-gray-800 bg-black/30 p-3">
      <PlayerBar label="Siz" player={duel.me} total={total} accent="bg-neon-cyan" />
      <PlayerBar label={opponentLabel} player={duel.opponent} total={total} accent="bg-orange-400" />
    </div>
  );

  return (
    <GameShell
      title="Do'st bilan duel"
      onBack={onExit}
      error={error}
      right={<span className={`font-mono text-lg font-bold ${isLow ? "text-red-400" : "text-white"}`}>{formatClock(remainingMs)}</span>}
    >
      {scoreboard}

      {!current || remainingMs <= 0 ? (
        <p className="animate-pulse py-6 text-center text-sm text-gray-400">
          {remainingMs <= 0 ? "Vaqt tugadi, natija hisoblanmoqda..." : `Siz tugatdingiz. ${opponentLabel} tugatishini kutamiz...`}
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
            <p className="mb-1 text-xs text-gray-500">
              {duel.questions.indexOf(current) + 1}/{total} · {current.topic}
            </p>
            <MarkdownRenderer content={current.question} />
          </div>
          <div className="grid gap-2">
            {current.options.map((option, index) => {
              const isCorrect = feedback && index === feedback.correctIndex;
              const isWrongPick = feedback && index === feedback.choice && !feedback.correct;
              return (
                <button
                  key={index}
                  disabled={isBusy || !!feedback}
                  onClick={() => pick(current.id, index)}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    isCorrect
                      ? "border-green-500 bg-green-500/20"
                      : isWrongPick
                        ? "border-red-500 bg-red-500/20"
                        : "border-gray-700 hover:border-orange-400/60"
                  }`}
                >
                  <span className="font-bold text-orange-400">{"ABCD"[index]}:</span>
                  <MarkdownRenderer content={option} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </GameShell>
  );
}
