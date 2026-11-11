"use client";

import { useEffect, useState } from "react";

import { createTest, fetchPlan, updatePlan } from "@/lib/api";
import type { PlanTopic, StudyPlan, Subject } from "@/lib/types";

import PlanSettingsFields, { formatDuration, type PlanSettingsValue } from "./PlanSettingsFields";

const SUBJECT_LABEL: Record<Subject, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };
const SUBJECT_DOT: Record<Subject, string> = { kimyo: "bg-neon-cyan", biologiya: "bg-green-400" };

const STATUS: Record<StudyPlan["status"], { label: (plan: StudyPlan) => string; className: string }> = {
  on_track: { label: () => "Rejaga mos", className: "bg-green-500/15 text-green-400" },
  ahead: { label: () => "Rejadan oldindasiz", className: "bg-neon-cyan/15 text-neon-cyan" },
  behind: { label: (plan) => `${plan.behind_weeks} hafta orqada`, className: "bg-red-500/15 text-red-400" },
  done: { label: () => "Barcha mavzular o'tildi", className: "bg-neon-violet/20 text-neon-violet" },
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-label="o'tildi" className="h-4 w-4 shrink-0 text-green-400">
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsForm({
  initial,
  isFirstTime,
  onSaved,
  onCancel,
  token,
}: {
  initial: PlanSettingsValue;
  isFirstTime: boolean;
  onSaved: (plan: StudyPlan) => void;
  onCancel?: () => void;
  token: string;
}) {
  const [value, setValue] = useState<PlanSettingsValue>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value.months || !value.days || !value.minutes) return;
    setIsSaving(true);
    setError(null);
    try {
      onSaved(await updatePlan(token, { study_months: value.months, study_days_per_week: value.days, daily_study_minutes: value.minutes }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejani saqlab bo'lmadi");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neon-violet/30 bg-black/20 p-4">
      <div>
        <p className="font-semibold text-white">{isFirstTime ? "O'quv rejangizni tuzaylik" : "Rejani o'zgartirish"}</p>
        <p className="text-xs text-gray-400">
          {isFirstTime
            ? "Sinfingiz, vaqtingiz va natijalaringizga qarab haftalik reja tuziladi. AI Ustoz darsni shu rejadan o'tadi."
            : "Reja bugundan qayta tuziladi. O'tilgan mavzular saqlanib qoladi."}
        </p>
      </div>
      <PlanSettingsFields value={value} onChange={setValue} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm text-gray-300">
            Bekor qilish
          </button>
        )}
        <button
          onClick={save}
          disabled={isSaving || !value.months || !value.days || !value.minutes}
          className="flex-1 rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isSaving ? "Tuzilmoqda..." : isFirstTime ? "Rejani tuzish" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

function TodayCard({
  plan,
  topic,
  onListenLecture,
  onStartLesson,
  onTakeTest,
  isStartingTest,
}: {
  plan: StudyPlan;
  topic: PlanTopic;
  onListenLecture: () => void;
  onStartLesson: () => void;
  onTakeTest: () => void;
  isStartingTest: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/5 p-4" data-testid="today-lesson">
      <div>
        <p className="text-xs uppercase tracking-widest text-neon-cyan">Bugungi dars · {plan.daily_minutes} daqiqa</p>
        <p className="mt-1 text-lg font-bold text-white">{topic.topic}</p>
        <p className="text-xs text-gray-400">
          {SUBJECT_LABEL[topic.subject]} · {topic.category} · maktabda {topic.grade}-sinfda
          {topic.is_new && <span className="ml-1 rounded bg-orange-400/20 px-1.5 text-orange-300">siz uchun yangi</span>}
        </p>
      </div>
      <ol className="space-y-1 text-sm">
        {plan.lesson_outline.map((part, index) => (
          <li key={part.label} className="flex justify-between text-gray-300">
            <span>
              {index + 1}. {part.label}
            </span>
            <span className="font-mono text-gray-500">{part.minutes} daq</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-2 sm:grid-cols-3">
        <button onClick={onListenLecture} className="rounded-xl border border-neon-violet/60 py-2.5 text-sm text-neon-violet">
          Ma&apos;ruzani tinglash
        </button>
        <button onClick={onStartLesson} className="rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white">
          Darsni boshlash
        </button>
        <button
          onClick={onTakeTest}
          disabled={isStartingTest}
          className="rounded-xl border border-neon-cyan/50 py-2.5 text-sm text-neon-cyan disabled:opacity-50"
        >
          {isStartingTest ? "Test tayyorlanmoqda..." : "Mavzu testini topshirish"}
        </button>
      </div>
      <p className="text-xs text-gray-500">Mavzu testidan 70% va undan yuqori olsangiz, reja keyingi mavzuga o&apos;tadi.</p>
    </div>
  );
}

/**
 * Shaxsiy o'quv reja: bugungi dars, haftalar bo'yicha mavzular va sozlamalar.
 * "Darsni boshlash" Suhbat bo'limida AI Ustoz bilan darsni ochadi.
 */
export default function StudyPlanView({
  token,
  onStartLesson,
  onListenLecture,
  onOpenTests,
}: {
  token: string;
  onStartLesson: (subject: Subject, topic: string) => void;
  onListenLecture: (subject: Subject, topic: string) => void;
  onOpenTests: () => void;
}) {
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [isStartingTest, setIsStartingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    fetchPlan(token)
      .then((next) => !isCancelled && setPlan(next))
      .catch((err) => !isCancelled && setError(err instanceof Error ? err.message : "O'quv rejani yuklab bo'lmadi"));
    return () => {
      isCancelled = true;
    };
  }, [token]);

  async function takeTest(topic: PlanTopic) {
    setIsStartingTest(true);
    setError(null);
    try {
      await createTest(token, { kind: "topic", subject: topic.subject, topic: topic.topic, question_count: 10 });
      onOpenTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testni boshlab bo'lmadi");
      setIsStartingTest(false);
    }
  }

  if (error && plan === undefined) return <p className="text-sm text-red-400">{error}</p>;
  if (plan === undefined) return <p className="text-sm text-gray-500">Yuklanmoqda...</p>;

  if (plan === null || isEditing) {
    return (
      <div className="mx-auto max-w-lg">
        <SettingsForm
          token={token}
          isFirstTime={plan === null}
          initial={plan ? { months: plan.study_months, days: plan.days_per_week, minutes: plan.daily_minutes } : { months: null, days: null, minutes: null }}
          onCancel={plan ? () => setIsEditing(false) : undefined}
          onSaved={(next) => {
            setPlan(next);
            setIsEditing(false);
          }}
        />
      </div>
    );
  }

  const status = STATUS[plan.status];
  const week = Math.min(plan.current_week, plan.total_weeks);
  const percent = plan.topic_count ? Math.round((plan.completed_count / plan.topic_count) * 100) : 0;
  const visibleWeeks = showAllWeeks ? plan.weeks : plan.weeks.filter((item) => item.week >= week && item.week < week + 4);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="space-y-3 rounded-2xl border border-neon-violet/30 bg-neon-violet/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-white">
              {plan.effective_months} oylik reja · {week}/{plan.total_weeks}-hafta
            </p>
            <p className="text-xs text-gray-400">
              Haftada {plan.days_per_week} kun × {plan.daily_minutes} daqiqa = {formatDuration(plan.weekly_minutes)}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label(plan)}</span>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>O&apos;tilgan mavzular</span>
            <span>
              {plan.completed_count}/{plan.topic_count}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-800">
            <div className="h-full bg-gradient-to-r from-neon-violet to-neon-cyan" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {plan.is_tight && plan.suggested_daily_minutes && (
          <p className="rounded-lg bg-orange-400/10 px-3 py-2 text-xs text-orange-200">
            Bu muddatga barcha mavzular to&apos;liq sig&apos;maydi — reja siqilgan. Kuniga taxminan{" "}
            <b>{plan.suggested_daily_minutes} daqiqa</b> ajratsangiz, har bir mavzu to&apos;liq o&apos;tiladi.
          </p>
        )}
        <button onClick={() => setIsEditing(true)} className="text-xs text-neon-cyan underline">
          Rejani o&apos;zgartirish
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {plan.current ? (
        <TodayCard
          plan={plan}
          topic={plan.current}
          isStartingTest={isStartingTest}
          onListenLecture={() => plan.current && onListenLecture(plan.current.subject, plan.current.topic)}
          onStartLesson={() => plan.current && onStartLesson(plan.current.subject, plan.current.topic)}
          onTakeTest={() => plan.current && takeTest(plan.current)}
        />
      ) : (
        <div className="rounded-2xl border border-neon-violet/30 p-4 text-sm text-gray-300">
          Barcha mavzular o&apos;tildi. Endi &quot;Testlar&quot; bo&apos;limida DTM va Milliy Sertifikat sinov testlari bilan
          takrorlang.
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">Haftalar</p>
          <button onClick={() => setShowAllWeeks(!showAllWeeks)} className="text-xs text-gray-400 underline">
            {showAllWeeks ? "Faqat yaqin haftalar" : `Hammasi (${plan.total_weeks})`}
          </button>
        </div>
        {visibleWeeks.map((item) => {
          const isCurrent = item.week === week;
          return (
            <div
              key={item.week}
              className={`rounded-xl border p-3 text-sm ${isCurrent ? "border-neon-cyan/60 bg-neon-cyan/5" : "border-gray-800 bg-surface"} ${
                item.week < week ? "opacity-60" : ""
              }`}
            >
              <p className="mb-1.5 text-xs font-semibold text-gray-400">
                {item.week}-hafta{isCurrent && <span className="ml-1 text-neon-cyan">· shu hafta</span>}
              </p>
              {item.kind === "revision" ? (
                <p className="text-gray-300">Umumiy takrorlash va DTM / Milliy Sertifikat sinov testlari</p>
              ) : (
                <ul className="space-y-1">
                  {item.items.map((entry, index) => (
                    <li key={`${entry.topic}-${index}`} className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${SUBJECT_DOT[entry.subject]}`} title={SUBJECT_LABEL[entry.subject]} />
                      <span className={`min-w-0 flex-1 truncate ${entry.completed ? "text-gray-500 line-through" : "text-gray-200"}`}>
                        {entry.topic}
                      </span>
                      {entry.completed ? <CheckIcon /> : <span className="font-mono text-xs text-gray-500">{formatDuration(entry.minutes)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
