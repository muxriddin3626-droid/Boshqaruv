"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { finishTest, saveTestAnswer } from "@/lib/api";
import type { TestResult, TestSession } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";

const KIND_TITLE: Record<string, string> = {
  dtm_mock: "DTM sinov testi",
  topic: "Mavzu bo'yicha test",
  milliy_sertifikat: "Milliy Sertifikat mashqi",
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/**
 * Test ishlash ekrani. Vaqt server soatiga moslashtiriladi (brauzer soati
 * noto'g'ri bo'lsa ham to'g'ri hisoblanadi); har javob darhol serverga saqlanadi.
 */
export default function TestRunner({
  token,
  session,
  onFinished,
}: {
  token: string;
  session: TestSession;
  onFinished: (result: TestResult) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(session.answers);
  const [current, setCurrent] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  const clockOffsetRef = useRef(new Date(session.server_now).getTime() - Date.now());
  const finishingRef = useRef(false);
  // Saqlashlar ketma-ket yuboriladi: tez bosilganda so'rovlar teskari tartibda
  // yetib, eski javob saqlanib qolmasligi uchun.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const questions = session.questions;
  const question = questions[current];
  const answeredCount = Object.keys(answers).length;

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    try {
      await saveQueueRef.current;
      onFinished(await finishTest(token, session.attempt_id));
    } catch {
      finishingRef.current = false;
      setIsFinishing(false);
      setSaveError("Testni yakunlab bo'lmadi. Internetni tekshirib, qayta bosing.");
    }
  }, [onFinished, session.attempt_id, token]);

  useEffect(() => {
    const deadline = new Date(session.deadline_at).getTime();
    const tick = () => {
      const left = deadline - (Date.now() + clockOffsetRef.current);
      setRemainingMs(left);
      if (left <= 0) void finish();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [finish, session.deadline_at]);

  function setLocalAnswer(questionId: string, value: number | null | undefined) {
    setAnswers((prev) => {
      const updated = { ...prev };
      if (value === null || value === undefined) delete updated[questionId];
      else updated[questionId] = value;
      return updated;
    });
  }

  function choose(choice: number) {
    const questionId = question.id;
    const previous = answersRef.current[questionId];
    const next = previous === choice ? null : choice;
    setLocalAnswer(questionId, next);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        await saveTestAnswer(token, session.attempt_id, questionId, next);
        setSaveError(null);
      } catch (err) {
        // Faqat shu javob hali ekranda bo'lsa qaytariladi (keyingi bosish uni almashtirmagan bo'lsa).
        if ((answersRef.current[questionId] ?? null) === next) setLocalAnswer(questionId, previous);
        setSaveError(err instanceof Error ? err.message : "Javobni saqlab bo'lmadi");
      }
    });
  }

  const isLowTime = remainingMs < 5 * 60 * 1000;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{KIND_TITLE[session.kind]}</p>
          <p className="truncate text-xs text-gray-500">{session.topic ?? `${answeredCount} / ${questions.length} javob berildi`}</p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-sm ${
            isLowTime ? "bg-red-500/15 text-red-400" : "bg-surface text-gray-200"
          }`}
          aria-label="Qolgan vaqt"
        >
          {formatRemaining(remainingMs)}
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {questions.map((q, index) => (
          <button
            key={q.id}
            onClick={() => setCurrent(index)}
            aria-label={`${index + 1}-savol`}
            className={`h-8 w-8 shrink-0 rounded-md text-xs font-medium ${
              index === current
                ? "bg-neon-cyan text-black"
                : answers[q.id] !== undefined
                  ? "bg-neon-violet/40 text-white"
                  : "bg-surface text-gray-400"
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-neon-violet/20 bg-black/20 p-4">
        <p className="mb-2 text-xs text-neon-cyan">
          {current + 1}-savol · {question.topic}
        </p>
        <MarkdownRenderer content={question.question} />
        <div className="mt-4 space-y-2">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => choose(index)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${
                answers[question.id] === index
                  ? "border-neon-cyan bg-neon-cyan/10"
                  : "border-gray-700 hover:border-neon-violet/50"
              }`}
            >
              <span className="mt-0.5 font-mono text-xs text-gray-400">{"ABCD"[index]}</span>
              <MarkdownRenderer content={option} />
            </button>
          ))}
        </div>
      </div>

      {saveError && <p className="text-sm text-red-400">{saveError}</p>}

      {confirmFinish ? (
        <div className="space-y-2 rounded-xl border border-neon-pink/40 p-3">
          <p className="text-sm text-gray-200">
            {questions.length - answeredCount > 0
              ? `${questions.length - answeredCount} ta savolga javob berilmagan. Baribir yakunlaysizmi?`
              : "Testni yakunlaysizmi?"}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmFinish(false)} className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300">
              Davom etish
            </button>
            <button
              onClick={finish}
              disabled={isFinishing}
              className="flex-1 rounded-lg bg-neon-pink py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isFinishing ? "Tekshirilmoqda..." : "Yakunlash"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            disabled={current === 0}
            className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 disabled:opacity-30"
          >
            Oldingi
          </button>
          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent((i) => i + 1)}
              className="flex-1 rounded-lg bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white"
            >
              Keyingi
            </button>
          ) : (
            <button
              onClick={() => setConfirmFinish(true)}
              className="flex-1 rounded-lg bg-gradient-to-br from-neon-pink to-neon-violet py-2.5 text-sm font-semibold text-white"
            >
              Yakunlash
            </button>
          )}
          {current < questions.length - 1 && (
            <button onClick={() => setConfirmFinish(true)} className="rounded-lg border border-neon-pink/40 px-3 py-2.5 text-sm text-neon-pink">
              Yakunlash
            </button>
          )}
        </div>
      )}
    </div>
  );
}
