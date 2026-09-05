"use client";

import { useState } from "react";

import { requestTargetedDrill, submitTestResult } from "@/lib/api";
import { generateClientActionId, queuePendingTestResult } from "@/lib/offlineDb";
import type { DrillResponse, Subject } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";

type TopicBreakdown = Record<string, { correct: number; total: number }>;

/**
 * MODUL 3: "Zaif Nuqtalarni Ishlash" tugmasi.
 *
 * Bazadagi `user_weakness_radar` (weak_spots asosida hisoblangan) eng past
 * mastery'li bo'limlaridan AI orqali maqsadli DTM-uslubidagi test tuziladi.
 * Test yakunida natija `test_results`ga yoziladi va shu orqali Weakness
 * Radar avtomatik qayta hisoblanadi (backend tomonida).
 */
export default function TargetedDrill({ token, subject }: { token: string; subject: Subject }) {
  const [drill, setDrill] = useState<DrillResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);

  async function startDrill() {
    setIsLoading(true);
    setResult(null);
    setAnswers({});
    try {
      const response = await requestTargetedDrill(token, subject, 8);
      setDrill(response);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitDrill() {
    if (!drill) return;

    const breakdown: TopicBreakdown = {};
    let correctCount = 0;

    drill.questions.forEach((question, index) => {
      const isCorrect = answers[index] === question.correct_index;
      if (isCorrect) correctCount += 1;

      const entry = breakdown[question.category] ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (isCorrect) entry.correct += 1;
      breakdown[question.category] = entry;
    });

    const score = correctCount;
    const maxScore = drill.questions.length;
    const details = { topic_breakdown: breakdown };

    try {
      await submitTestResult(token, subject, "oraliq", score, maxScore, details);
    } catch {
      await queuePendingTestResult({
        client_action_id: generateClientActionId(),
        subject,
        test_type: "oraliq",
        score,
        max_score: maxScore,
        details,
        taken_at: new Date().toISOString(),
      });
    }

    setResult({ correct: correctCount, total: maxScore });
  }

  if (!drill) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-gray-400">
          Radar&apos;dagi eng zaif bo&apos;limlaringizdan maxsus tayyorlangan test bilan mashq qiling.
        </p>
        <button
          onClick={startDrill}
          disabled={isLoading}
          className="rounded-xl bg-gradient-to-br from-neon-pink to-neon-violet px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isLoading ? "Tayyorlanmoqda..." : "Zaif Nuqtalarni Ishlash"}
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-semibold text-neon-cyan">
          Natija: {result.correct} / {result.total}
        </p>
        <p className="text-sm text-gray-400">Bo&apos;limlar: {drill.target_categories.join(", ")}</p>
        <button
          onClick={() => setDrill(null)}
          className="mt-2 rounded-xl border border-neon-violet/40 px-5 py-2 text-sm text-gray-200"
        >
          Yopish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      <p className="text-xs uppercase tracking-widest text-neon-pink">
        Maqsad: {drill.target_categories.join(", ")}
      </p>

      {drill.questions.map((question, index) => (
        <div key={index} className="rounded-xl border border-neon-violet/20 bg-surface/60 p-4">
          <p className="mb-2 text-xs text-neon-cyan">{question.category}</p>
          <MarkdownRenderer content={question.question} />
          <div className="mt-3 space-y-2">
            {question.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  answers[index] === optionIndex
                    ? "border-neon-cyan bg-neon-cyan/10"
                    : "border-gray-700 hover:border-neon-violet/50"
                }`}
              >
                <input
                  type="radio"
                  name={`question-${index}`}
                  checked={answers[index] === optionIndex}
                  onChange={() => setAnswers((prev) => ({ ...prev, [index]: optionIndex }))}
                  className="accent-neon-violet"
                />
                <MarkdownRenderer content={option} />
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={submitDrill}
        disabled={Object.keys(answers).length !== drill.questions.length}
        className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        Testni yakunlash
      </button>
    </div>
  );
}
