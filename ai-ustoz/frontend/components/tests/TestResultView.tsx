"use client";

import { useState } from "react";

import type { TestResult } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";

const SUBJECT_LABEL: Record<string, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} daq ${seconds % 60} s` : `${seconds} s`;
}

export default function TestResultView({ result, onClose }: { result: TestResult; onClose: () => void }) {
  const [showOnlyMistakes, setShowOnlyMistakes] = useState(true);
  const isDtm = result.kind === "dtm_mock";
  const weakTopics = result.per_topic.filter((t) => t.correct < t.total).slice(0, 5);
  const review = showOnlyMistakes ? result.review.filter((item) => item.chosen !== item.correct_index) : result.review;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-neon-cyan/30 bg-black/20 p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-gray-500">{isDtm ? "DTM ball" : "Natija"}</p>
        <p className="mt-1 text-4xl font-bold text-white">
          {isDtm ? result.score.toFixed(1) : result.correct_count}
          <span className="text-lg text-gray-500"> / {isDtm ? result.max_score.toFixed(1) : result.total}</span>
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {result.percent}% · {result.correct_count} ta to&apos;g&apos;ri · {formatDuration(result.duration_seconds)}
        </p>
        {result.ms_level && <p className="mt-2 text-lg font-semibold text-neon-cyan">Daraja: {result.ms_level}</p>}
        {result.kind === "milliy_sertifikat" && !result.ms_is_official && (
          <p className="mt-2 text-xs text-gray-500">
            Bu Milliy Sertifikat uslubidagi mashq — rasmiy format va daraja chegaralari hali tasdiqlanmagan, shuning
            uchun daraja ko&apos;rsatilmaydi.
          </p>
        )}
        <p className="mt-3 inline-block rounded-full bg-neon-violet/20 px-3 py-1 text-sm text-neon-violet">
          +{result.xp_earned} XP
        </p>
      </div>

      {isDtm && result.per_subject.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {result.per_subject.map((s) => (
            <div key={s.subject} className="rounded-xl border border-gray-800 p-3">
              <p className="text-sm text-gray-300">{SUBJECT_LABEL[s.subject]}</p>
              <p className="text-lg font-semibold text-white">
                {s.score.toFixed(1)} <span className="text-sm text-gray-500">/ {s.max_score.toFixed(1)} ball</span>
              </p>
              <p className="text-xs text-gray-500">
                {s.correct} / {s.total} to&apos;g&apos;ri
              </p>
            </div>
          ))}
        </div>
      )}

      {weakTopics.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">Takrorlash kerak bo&apos;lgan mavzular</p>
          {weakTopics.map((t) => {
            const percent = Math.round((t.correct / t.total) * 100);
            return (
              <div key={`${t.subject}-${t.topic}`} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">{t.topic}</span>
                  <span className="text-gray-500">
                    {t.correct}/{t.total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-800">
                  <div
                    className={`h-full rounded-full ${percent < 50 ? "bg-red-400" : "bg-yellow-400"}`}
                    style={{ width: `${Math.max(percent, 4)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Savollar tahlili</p>
          <div className="flex gap-1 text-xs">
            {[
              { value: true, label: "Xatolar" },
              { value: false, label: "Hammasi" },
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => setShowOnlyMistakes(option.value)}
                className={`rounded-full px-3 py-1 ${showOnlyMistakes === option.value ? "bg-neon-cyan text-black" : "bg-surface text-gray-400"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {review.length === 0 && <p className="text-sm text-gray-500">Xato yo&apos;q — barakalla!</p>}
        {review.map((item) => {
          const number = result.review.indexOf(item) + 1;
          return (
            <div key={item.question_id} className="rounded-xl border border-gray-800 p-3">
              <p className="mb-1 text-xs text-gray-500">
                {number}-savol · {item.topic}
                {item.chosen === null && <span className="ml-2 text-yellow-400">javob berilmagan</span>}
              </p>
              <MarkdownRenderer content={item.question} />
              <div className="mt-2 space-y-1.5">
                {item.options.map((option, index) => {
                  const isCorrect = index === item.correct_index;
                  const isChosenWrong = index === item.chosen && !isCorrect;
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                        isCorrect
                          ? "border-green-500/60 bg-green-500/10"
                          : isChosenWrong
                            ? "border-red-500/60 bg-red-500/10"
                            : "border-gray-800 text-gray-400"
                      }`}
                    >
                      <span className="mt-0.5 font-mono text-xs">{"ABCD"[index]}</span>
                      <MarkdownRenderer content={option} />
                    </div>
                  );
                })}
              </div>
              {item.explanation && (
                <div className="mt-2 rounded-lg bg-neon-violet/10 px-3 py-2 text-sm text-gray-300">
                  <MarkdownRenderer content={item.explanation} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-3 text-sm font-semibold text-white"
      >
        Yangi test
      </button>
    </div>
  );
}
