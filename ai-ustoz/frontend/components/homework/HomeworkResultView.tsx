"use client";

import { useState } from "react";

import type { Homework, HomeworkProblemReview } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";
import TutorMascot from "../voice/TutorMascot";
import type { Emotion } from "../voice/realtimeEvents";

function verdict(percent: number, isLate: boolean): { emotion: Emotion; title: string } {
  if (percent >= 85) return { emotion: "happy", title: isLate ? "Zo'r yechim, lekin kechikding!" : "Barakalla, a'lo!" };
  if (percent >= 60) return { emotion: "thinking", title: "Yomon emas — xatolar ustida ishlaymiz" };
  if (percent >= 30) return { emotion: "laughing", title: "Ha-ha, bu yerda tuzatadigan joy ko'p!" };
  return { emotion: "angry", title: "Bu vazifa emas, qoralama-ku! Qaytadan o'qib chiq." };
}

function StepMark({ ok }: { ok: boolean }) {
  return ok ? (
    <svg viewBox="0 0 16 16" aria-label="to'g'ri" className="mt-0.5 h-4 w-4 shrink-0 text-green-400">
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" aria-label="xato" className="mt-0.5 h-4 w-4 shrink-0 text-red-400">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProblemReview({ review, index, studentText }: { review: HomeworkProblemReview; index: number; studentText: string }) {
  const [showSolution, setShowSolution] = useState(false);
  const share = review.max_score ? review.score / review.max_score : 0;
  return (
    <div className="space-y-2 rounded-xl border border-gray-800 bg-black/20 p-3 text-sm" data-testid={`review-${index}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <span className="font-bold text-neon-pink">{index + 1}.</span>
          <MarkdownRenderer content={review.problem} />
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-bold ${share >= 0.7 ? "bg-green-500/15 text-green-400" : share >= 0.4 ? "bg-yellow-500/15 text-yellow-300" : "bg-red-500/15 text-red-400"}`}>
          {review.score}/{review.max_score}
        </span>
      </div>
      {(studentText || review.has_photo) && (
        <p className="rounded-lg bg-surface px-2 py-1 text-xs text-gray-400">
          Sizning yechimingiz: {studentText || ""}
          {review.has_photo && " (daftar rasmi bilan)"}
        </p>
      )}
      {review.steps.length > 0 && (
        <ul className="space-y-1">
          {review.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-gray-300">
              <StepMark ok={step.ok} />
              <div className="min-w-0">
                <b className="text-white">{step.step}:</b>
                <MarkdownRenderer content={step.comment} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {review.comment && (
        <div className="rounded-lg bg-neon-violet/10 px-2 py-1.5 text-gray-200">
          <b>Ustoz:</b>
          <MarkdownRenderer content={review.comment} />
        </div>
      )}
      <button onClick={() => setShowSolution(!showSolution)} className="text-xs text-neon-cyan underline">
        {showSolution ? "Yechimni yashirish" : "To'g'ri javob va namunaviy yechim"}
      </button>
      {showSolution && (
        <div className="space-y-1 rounded-lg border border-green-500/20 p-2 text-gray-300">
          <div>
            <b className="text-green-400">Javob:</b>
            <MarkdownRenderer content={review.answer} />
          </div>
          <ol className="list-decimal space-y-0.5 pl-5">
            {review.solution_steps.map((step, i) => (
              <li key={i}>
                <MarkdownRenderer content={step} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Tekshirilgan vazifa: ball, XP, har masala bo'yicha bosqichma-bosqich izoh va test tahlili. */
export default function HomeworkResultView({ homework, onNext }: { homework: Homework; onNext: () => void }) {
  const result = homework.result;
  if (!result) return null;
  const { emotion, title } = verdict(result.percent, homework.is_late);
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <div className="mx-auto w-32">
          <TutorMascot emotion={emotion} amplitude={0} isActive />
        </div>
        <p className="text-lg font-bold text-white">{title}</p>
        <p className="text-3xl font-bold text-neon-cyan" data-testid="homework-percent">
          {result.percent}%
        </p>
        <p className="text-sm text-gray-400">
          {homework.score}/{homework.max_score} ball · <span className="text-neon-violet">+{homework.xp_earned} XP</span>
          {homework.is_late && <span className="text-red-300"> · kechikkan (bonus yo&apos;q)</span>}
        </p>
      </div>

      {result.problems.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-semibold text-white">Masalalar tahlili</p>
          {result.problems.map((review, index) => (
            <ProblemReview key={index} review={review} index={index} studentText={homework.submissions?.[index]?.text ?? ""} />
          ))}
        </section>
      )}

      {result.mcq.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-semibold text-white">
            Test: {result.mcq.filter((m) => m.correct).length}/{result.mcq.length} to&apos;g&apos;ri
          </p>
          {result.mcq.map((item, index) => (
            <div key={item.question_id} className={`rounded-xl border p-3 text-sm ${item.correct ? "border-green-500/30" : "border-red-500/30"}`}>
              <div className="flex gap-2">
                <span className="text-gray-500">{index + 1}.</span>
                <MarkdownRenderer content={item.question} />
              </div>
              <p className="mt-1 text-xs">
                <span className={item.correct ? "text-green-400" : "text-red-400"}>
                  Siz: {item.choice === null || item.choice === undefined ? "javob yo'q" : "ABCD"[item.choice]}
                </span>
                {!item.correct && <span className="text-green-400"> · To&apos;g&apos;ri: {"ABCD"[item.correct_index]}</span>}
              </p>
              {!item.correct && item.explanation && (
                <div className="mt-1 text-xs text-gray-400">
                  <MarkdownRenderer content={item.explanation} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <button onClick={onNext} className="w-full rounded-xl border border-gray-700 py-2.5 text-sm text-gray-200">
        Vazifalar ro&apos;yxatiga qaytish
      </button>
    </div>
  );
}
