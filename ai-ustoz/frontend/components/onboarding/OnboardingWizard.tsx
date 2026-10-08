"use client";

import { useEffect, useState, type ReactNode } from "react";

import { fetchPlacementTest, submitOnboarding } from "@/lib/api";
import type {
  CertLevel,
  OnboardingPayload,
  OnboardingResult,
  PlacementQuestion,
  SelfLevel,
  Subject,
  SubjectChoice,
  TargetExam,
} from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";

const DONT_KNOW = -1;
const STEP_TITLES = ["Tanishaylik", "Maqsadingiz", "Hozirgi darajangiz", "Vaqt", "Kirish testi"];
const GRADES = [5, 6, 7, 8, 9, 10, 11];
const CERT_LEVELS: CertLevel[] = ["A+", "A", "B+", "B", "C+", "C"];
const DAILY_MINUTES = [
  { value: 30, label: "30 daqiqa" },
  { value: 60, label: "1 soat" },
  { value: 120, label: "2 soat" },
  { value: 180, label: "3+ soat" },
];
const SUBJECT_LABELS: Record<Subject, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };

interface FormState {
  fullName: string;
  grade: number | null;
  isGraduate: boolean;
  subjects: SubjectChoice | null;
  targetExam: TargetExam | null;
  targetScore: string;
  certLevel: CertLevel | null;
  university: string;
  selfLevel: SelfLevel | null;
  examMonth: string;
  examMonthUnknown: boolean;
  dailyMinutes: number | null;
}

const INITIAL_FORM: FormState = {
  fullName: "",
  grade: null,
  isGraduate: false,
  subjects: null,
  targetExam: null,
  targetScore: "",
  certLevel: null,
  university: "",
  selfLevel: null,
  examMonth: "",
  examMonthUnknown: false,
  dailyMinutes: null,
};

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2.5 text-sm transition ${
        selected
          ? "border-neon-cyan bg-neon-cyan/15 text-white"
          : "border-gray-700 text-gray-300 hover:border-neon-violet/60"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-200">{label}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-700 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan";

/**
 * Kirish so'rovnomasi: yangi o'quvchi profilini yig'adi, qisqa kirish testini
 * o'tkazadi va oxirida backendda akkaunt yaratib, kirish tokenini qaytaradi.
 * Javoblar AI Ustoz system promptiga tushadi, test natijasi esa Weakness
 * Radar'ni birinchi kundanoq to'ldiradi.
 */
export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: (token: string, preferredSubject: Subject) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [questions, setQuestions] = useState<PlacementQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const needsScore = form.targetExam === "dtm" || form.targetExam === "ikkalasi";
  const needsCertLevel = form.targetExam === "milliy_sertifikat" || form.targetExam === "ikkalasi";
  const scoreNumber = form.targetScore === "" ? null : Number(form.targetScore);
  const isScoreValid = scoreNumber === null || (Number.isInteger(scoreNumber) && scoreNumber >= 0 && scoreNumber <= 189);

  useEffect(() => {
    if (step !== 4 || !form.subjects) return;
    setQuestions(null);
    setAnswers({});
    setError(null);
    fetchPlacementTest(form.subjects)
      .then(setQuestions)
      .catch(() => setError("Kirish testini yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring."));
  }, [step, form.subjects]);

  const canContinue = [
    form.fullName.trim().length >= 2 && (form.grade !== null || form.isGraduate) && form.subjects !== null,
    form.targetExam !== null && isScoreValid,
    form.selfLevel !== null,
    form.dailyMinutes !== null && (form.examMonthUnknown || form.examMonth !== ""),
    questions !== null && questions.every((q) => answers[q.id] !== undefined),
  ][step];

  async function handleSubmit() {
    if (!form.subjects || !form.targetExam || !form.selfLevel || form.dailyMinutes === null) return;
    const payload: OnboardingPayload = {
      full_name: form.fullName.trim(),
      current_grade: form.isGraduate ? 11 : (form.grade ?? 11),
      is_graduate: form.isGraduate,
      subjects: form.subjects,
      target_exam: form.targetExam,
      target_score: needsScore ? scoreNumber : null,
      target_cert_level: needsCertLevel ? form.certLevel : null,
      target_university: form.university.trim() || null,
      self_level: form.selfLevel,
      exam_month: !form.examMonthUnknown && form.examMonth ? `${form.examMonth}-01` : null,
      daily_study_minutes: form.dailyMinutes,
      placement_answers: answers,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      setResult(await submitOnboarding(payload));
    } catch {
      setError("Ma'lumotlarni saqlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    if (step < 4) setStep(step + 1);
    else void handleSubmit();
  }

  if (result) {
    const preferredSubject: Subject = form.subjects === "biologiya" ? "biologiya" : "kimyo";
    return (
      <Shell>
        <h2 className="text-xl font-bold text-white">Tayyor, {form.fullName.trim().split(" ")[0]}!</h2>
        <p className="text-sm text-gray-400">Kirish testi natijangiz:</p>
        <div className="space-y-2">
          {result.placement.map((item) => (
            <div
              key={item.subject}
              className="flex items-center justify-between rounded-xl border border-neon-violet/30 bg-black/20 px-4 py-3"
            >
              <span className="text-gray-200">{SUBJECT_LABELS[item.subject]}</span>
              <span className="text-lg font-semibold text-neon-cyan">
                {item.correct} / {item.total}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-400">
          AI Ustoz zaif bo&apos;limlaringizni aniqladi va darsni aynan o&apos;sha joydan boshlaydi. Natijalar
          &quot;Zaif nuqtalar&quot; bo&apos;limida.
        </p>
        <button
          onClick={() => onComplete(result.access_token, preferredSubject)}
          className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 text-sm font-semibold text-white"
        >
          Darsni boshlash
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-2">
        <div className="flex gap-1.5">
          {STEP_TITLES.map((title, index) => (
            <div
              key={title}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-neon-cyan" : "bg-gray-700"}`}
            />
          ))}
        </div>
        <p className="text-xs uppercase tracking-widest text-neon-pink">
          {step + 1}/{STEP_TITLES.length} · {STEP_TITLES[step]}
        </p>
      </div>

      {step === 0 && (
        <>
          <Field label="Ismingiz">
            <input
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Masalan: Dilnoza Karimova"
              maxLength={100}
              className={inputClass}
            />
          </Field>
          <Field label="Nechanchi sinfdasiz?">
            <div className="flex flex-wrap gap-2">
              {GRADES.map((grade) => (
                <Chip
                  key={grade}
                  selected={!form.isGraduate && form.grade === grade}
                  onClick={() => setForm((prev) => ({ ...prev, grade, isGraduate: false }))}
                >
                  {grade}
                </Chip>
              ))}
              <Chip
                selected={form.isGraduate}
                onClick={() => setForm((prev) => ({ ...prev, grade: null, isGraduate: true }))}
              >
                Bitiruvchi
              </Chip>
            </div>
          </Field>
          <Field label="Qaysi fanga tayyorlanyapsiz?">
            <div className="flex flex-wrap gap-2">
              <Chip selected={form.subjects === "kimyo"} onClick={() => update("subjects", "kimyo")}>
                Kimyo
              </Chip>
              <Chip selected={form.subjects === "biologiya"} onClick={() => update("subjects", "biologiya")}>
                Biologiya
              </Chip>
              <Chip selected={form.subjects === "ikkalasi"} onClick={() => update("subjects", "ikkalasi")}>
                Ikkalasi
              </Chip>
            </div>
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <Field label="Qaysi imtihonga tayyorlanyapsiz?">
            <div className="flex flex-wrap gap-2">
              <Chip selected={form.targetExam === "dtm"} onClick={() => update("targetExam", "dtm")}>
                DTM (OTMga kirish)
              </Chip>
              <Chip
                selected={form.targetExam === "milliy_sertifikat"}
                onClick={() => update("targetExam", "milliy_sertifikat")}
              >
                Milliy Sertifikat
              </Chip>
              <Chip selected={form.targetExam === "ikkalasi"} onClick={() => update("targetExam", "ikkalasi")}>
                Ikkalasi
              </Chip>
            </div>
          </Field>
          {needsScore && (
            <Field label="DTM'dan maqsad ballingiz" hint="0 dan 189 gacha. Bilmasangiz, bo'sh qoldiring.">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={189}
                value={form.targetScore}
                onChange={(e) => update("targetScore", e.target.value)}
                placeholder="Masalan: 175"
                className={`${inputClass} ${isScoreValid ? "" : "border-red-500"}`}
              />
            </Field>
          )}
          {needsCertLevel && (
            <Field label="Milliy Sertifikatdan qaysi daraja kerak?">
              <div className="flex flex-wrap gap-2">
                {CERT_LEVELS.map((level) => (
                  <Chip key={level} selected={form.certLevel === level} onClick={() => update("certLevel", level)}>
                    {level}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
          <Field label="Qaysi OTM yoki yo'nalish? (ixtiyoriy)">
            <input
              value={form.university}
              onChange={(e) => update("university", e.target.value)}
              placeholder="Masalan: Toshkent tibbiyot akademiyasi"
              maxLength={255}
              className={inputClass}
            />
          </Field>
        </>
      )}

      {step === 2 && (
        <Field label="Fanni hozir qanday bilasiz?" hint="Rostini ayting — dars shunga qarab tuziladi.">
          <div className="grid gap-2">
            {(
              [
                ["boshlangich", "Boshlang'ich", "Asoslarni ham yaxshi bilmayman, noldan boshlash kerak"],
                ["orta", "O'rta", "Asoslarni bilaman, lekin masalalarda qiynalaman"],
                ["yuqori", "Yuqori", "Ko'p mavzuni bilaman, murakkab masalalarni ishlashim kerak"],
              ] as [SelfLevel, string, string][]
            ).map(([value, title, description]) => (
              <button
                key={value}
                type="button"
                onClick={() => update("selfLevel", value)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  form.selfLevel === value
                    ? "border-neon-cyan bg-neon-cyan/15"
                    : "border-gray-700 hover:border-neon-violet/60"
                }`}
              >
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-gray-400">{description}</p>
              </button>
            ))}
          </div>
        </Field>
      )}

      {step === 3 && (
        <>
          <Field label="Imtihon qachon?" hint="Oy va yilni tanlang.">
            <input
              type="month"
              value={form.examMonth}
              disabled={form.examMonthUnknown}
              onChange={(e) => update("examMonth", e.target.value)}
              className={`${inputClass} disabled:opacity-40`}
            />
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={form.examMonthUnknown}
                onChange={(e) => update("examMonthUnknown", e.target.checked)}
                className="accent-neon-violet"
              />
              Hali aniq emas
            </label>
          </Field>
          <Field label="Kuniga qancha vaqt ajrata olasiz?">
            <div className="flex flex-wrap gap-2">
              {DAILY_MINUTES.map((option) => (
                <Chip
                  key={option.value}
                  selected={form.dailyMinutes === option.value}
                  onClick={() => update("dailyMinutes", option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </Field>
        </>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Qisqa test — bilmasangiz taxmin qilmang, &quot;Bilmayman&quot;ni bosing. Shunda AI zaif joyingizni aniqroq
            topadi.
          </p>
          {!questions && !error && <p className="text-sm text-gray-500">Yuklanmoqda...</p>}
          {questions?.map((question, index) => (
            <div key={question.id} className="rounded-xl border border-neon-violet/20 bg-black/20 p-4">
              <p className="mb-1 text-xs text-neon-cyan">
                {index + 1}. {SUBJECT_LABELS[question.subject]} · {question.category}
              </p>
              <MarkdownRenderer content={question.question} />
              <div className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      answers[question.id] === optionIndex
                        ? "border-neon-cyan bg-neon-cyan/10"
                        : "border-gray-700 hover:border-neon-violet/50"
                    }`}
                  >
                    <MarkdownRenderer content={option} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: DONT_KNOW }))}
                  className={`block w-full rounded-lg border border-dashed px-3 py-2 text-left text-sm ${
                    answers[question.id] === DONT_KNOW
                      ? "border-neon-pink bg-neon-pink/10 text-white"
                      : "border-gray-700 text-gray-400"
                  }`}
                >
                  Bilmayman
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-xl border border-gray-700 px-5 py-3 text-sm text-gray-300"
          >
            Orqaga
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canContinue || isSubmitting}
          className="flex-1 rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {step < 4 ? "Davom etish" : isSubmitting ? "Saqlanmoqda..." : "Yakunlash"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center p-4 sm:items-center">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-neon-violet/20 bg-surface/60 p-5 sm:p-6">
        <h1 className="text-lg font-bold text-white">
          AI <span className="text-neon-cyan">Ustoz</span>
        </h1>
        {children}
      </div>
    </main>
  );
}
