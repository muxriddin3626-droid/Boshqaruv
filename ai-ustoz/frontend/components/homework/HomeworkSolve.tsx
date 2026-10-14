"use client";

import { useEffect, useRef, useState } from "react";

import { submitHomework } from "@/lib/api";
import type { Homework } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";
import TutorMascot from "../voice/TutorMascot";
import { compressPhoto } from "./photo";

const DRAFT_PREFIX = "ai_ustoz_hw_draft_";

interface Draft {
  mcq: Record<string, number>;
  texts: string[];
}

function readDraft(id: string, problemCount: number): Draft {
  try {
    const saved = JSON.parse(window.localStorage.getItem(DRAFT_PREFIX + id) ?? "null") as Draft | null;
    if (saved && Array.isArray(saved.texts)) {
      return { mcq: saved.mcq ?? {}, texts: Array.from({ length: problemCount }, (_, i) => saved.texts[i] ?? "") };
    }
  } catch {
    // Qoralama o'qilmasa — bo'sh boshlanadi.
  }
  return { mcq: {}, texts: Array.from({ length: problemCount }, () => "") };
}

function writeDraft(id: string, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    // Saqlash ishlamasa ham vazifa topshiriladi.
  }
}

export const dueFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Tashkent",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Ochiq vazifani bajarish: test qismi + masalalar (matn va/yoki daftar rasmi). */
export default function HomeworkSolve({
  token,
  homework,
  onChecked,
}: {
  token: string;
  homework: Homework;
  onChecked: (checked: Homework) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({ mcq: {}, texts: homework.problems.map(() => "") }));
  const [photos, setPhotos] = useState<(string | null)[]>(() => homework.problems.map(() => null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    setDraft(readDraft(homework.id, homework.problems.length));
    loadedRef.current = true;
  }, [homework.id, homework.problems.length]);

  useEffect(() => {
    if (loadedRef.current) writeDraft(homework.id, draft);
  }, [draft, homework.id]);

  async function attachPhoto(index: number, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await compressPhoto(file);
      setPhotos((prev) => prev.map((photo, i) => (i === index ? dataUrl : photo)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasmni yuklab bo'lmadi");
    }
  }

  const unanswered =
    homework.questions.filter((q) => draft.mcq[q.id] === undefined).length +
    homework.problems.filter((_, i) => !draft.texts[i]?.trim() && !photos[i]).length;

  async function submit() {
    if (unanswered > 0 && !window.confirm(`${unanswered} ta topshiriq bo'sh. Baribir tekshirishga yuborasizmi?`)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const checked = await submitHomework(token, homework.id, {
        mcq_answers: draft.mcq,
        solutions: homework.problems.map((_, i) => ({ text: draft.texts[i] ?? "", photo: photos[i] })),
      });
      writeDraft(homework.id, null);
      onChecked(checked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vazifani yuborib bo'lmadi");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="w-36">
          <TutorMascot emotion="thinking" amplitude={0} isActive />
        </div>
        <p className="font-semibold text-white">AI Ustoz tekshiryapti...</p>
        <p className="text-sm text-gray-400">Har bir masalani bosqichma-bosqich ko&apos;rib chiqmoqda. Bu 10-30 soniya oladi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-xl px-3 py-2 text-sm ${homework.is_overdue ? "bg-red-500/10 text-red-300" : "bg-neon-violet/10 text-gray-200"}`}>
        {homework.is_overdue
          ? `Muddat o'tib ketdi (${dueFormatter.format(new Date(homework.due_at))}). Hozir bajaring — kechikkan vazifaga bonus XP berilmaydi.`
          : `Muddat: ${dueFormatter.format(new Date(homework.due_at))} gacha. O'z vaqtida topshirsangiz +10 XP bonus.`}
      </div>

      {homework.questions.length > 0 && (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-white">1-qism. Test ({homework.questions.length} ta savol)</p>
          {homework.questions.map((question, index) => (
            <div key={question.id} className="rounded-xl border border-gray-800 bg-black/20 p-3">
              <div className="mb-2 flex gap-2 text-sm">
                <span className="text-gray-500">{index + 1}.</span>
                <MarkdownRenderer content={question.question} />
              </div>
              <div className="grid gap-1.5">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, mcq: { ...prev.mcq, [question.id]: optionIndex } }))}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                      draft.mcq[question.id] === optionIndex ? "border-neon-cyan bg-neon-cyan/10" : "border-gray-700 hover:border-neon-violet/50"
                    }`}
                  >
                    <span className="font-bold text-neon-cyan">{"ABCD"[optionIndex]})</span>
                    <MarkdownRenderer content={option} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {homework.problems.length > 0 && (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-white">2-qism. Masalalar</p>
          <p className="text-xs text-gray-400">
            Yechimni bosqichma-bosqich yozing: berilganlar, formula, hisob, javob. Daftarda yechgan bo&apos;lsangiz — rasmini
            yuboring, AI Ustoz qo&apos;lyozmangizni o&apos;qiydi.
          </p>
          {homework.problems.map((problem, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-gray-800 bg-black/20 p-3" data-testid={`problem-${index}`}>
              <div className="flex gap-2 text-sm">
                <span className="font-bold text-neon-pink">{index + 1}-masala.</span>
                <MarkdownRenderer content={problem} />
              </div>
              <textarea
                value={draft.texts[index] ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, texts: prev.texts.map((t, i) => (i === index ? e.target.value : t)) }))}
                rows={4}
                maxLength={4000}
                placeholder="Berilgan: ...  Formula: ...  Hisob: ...  Javob: ..."
                aria-label={`${index + 1}-masala yechimi`}
                className="w-full resize-y rounded-lg border border-gray-700 bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-neon-cyan"
              />
              {photos[index] ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos[index] ?? ""} alt={`${index + 1}-masala daftar rasmi`} className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.map((photo, i) => (i === index ? null : photo)))}
                    className="text-xs text-red-300 underline"
                  >
                    Rasmni olib tashlash
                  </button>
                </div>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-600 px-3 py-1.5 text-xs text-gray-300">
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Daftar rasmini qo&apos;shish
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    data-testid={`photo-input-${index}`}
                    onChange={(e) => {
                      void attachPhoto(index, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </section>
      )}

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button
        onClick={submit}
        className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-3 text-sm font-bold text-white"
      >
        Tekshirishga yuborish
      </button>
    </div>
  );
}
