"use client";

import { useEffect, useState, type ReactNode } from "react";

import { fetchPlacementTest, phoneDigits, submitOnboarding } from "@/lib/api";
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

import { AuthShell as Shell, PhoneInput, inputClass } from "../auth/AuthShell";
import MarkdownRenderer from "../chat/MarkdownRenderer";
import PlanSettingsFields, { STUDY_MONTHS, monthsUntil } from "../plan/PlanSettingsFields";

const DONT_KNOW = -1;
const STEP_TITLES = ["Tanishaylik", "Maqsadingiz", "Hozirgi darajangiz", "Vaqt va reja", "Kirish testi"];
const GRADES = [5, 6, 7, 8, 9, 10, 11];
const CERT_LEVELS: CertLevel[] = ["A+", "A", "B+", "B", "C+", "C"];
function closestMonths(monthsLeft: number): number {
  return STUDY_MONTHS.filter((months) => months <= monthsLeft).at(-1) ?? STUDY_MONTHS[0];
}

const SUBJECT_LABELS: Record<Subject, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };

interface FormState {
  fullName: string;
  phone: string;
  password: string;
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
  studyMonths: number | null;
  daysPerWeek: number | null;
}

const INITIAL_FORM: FormState = {
  fullName: "",
  phone: "",
  password: "",
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
  studyMonths: null,
  daysPerWeek: null,
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

/**
 * Kirish so'rovnomasi: yangi o'quvchi profilini yig'adi, qisqa kirish testini
 * o'tkazadi va oxirida backendda akkaunt yaratib, kirish tokenini qaytaradi.
 * Javoblar AI Ustoz system promptiga tushadi, test natijasi esa Weakness
 * Radar'ni birinchi kundanoq to'ldiradi.
 */
export default function OnboardingWizard({
  onComplete,
  onSwitchToLogin,
}: {
  onComplete: (token: string, preferredSubject: Subject) => void;
  onSwitchToLogin: () => void;
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
  const digits = phoneDigits(form.phone);
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
    form.fullName.trim().length >= 2 &&
      digits !== null &&
      form.password.length >= 6 &&
      (form.grade !== null || form.isGraduate) &&
      form.subjects !== null,
    form.targetExam !== null && isScoreValid,
    form.selfLevel !== null,
    form.dailyMinutes !== null &&
      form.studyMonths !== null &&
      form.daysPerWeek !== null &&
      (form.examMonthUnknown || form.examMonth !== ""),
    questions !== null && questions.every((q) => answers[q.id] !== undefined),
  ][step];

  async function handleSubmit() {
    if (!digits || !form.subjects || !form.targetExam || !form.selfLevel) return;
    if (form.dailyMinutes === null || form.studyMonths === null || form.daysPerWeek === null) return;
    const payload: OnboardingPayload = {
      full_name: form.fullName.trim(),
      phone: `+998${digits}`,
      password: form.password,
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
      study_months: form.studyMonths,
      study_days_per_week: form.daysPerWeek,
      placement_answers: answers,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      setResult(await submitOnboarding(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotlarni saqlab bo'lmadi. Qayta urinib ko'ring.");
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
        <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-gray-200" data-testid="plan-ready">
          <p className="font-semibold text-white">O&apos;quv rejangiz tayyor: {result.plan_weeks} hafta</p>
          {result.first_topic && <p>Birinchi dars: &quot;{result.first_topic}&quot;</p>}
        </div>
        <p className="text-sm text-gray-400">
          Reja sinfingiz, vaqtingiz va kirish testi natijasiga qarab tuzildi: zaif bo&apos;limlarga ko&apos;proq vaqt
          ajratildi. AI Ustoz har kuni darsni rejadagi mavzudan boshlaydi — &quot;Reja&quot; bo&apos;limida ko&apos;rasiz.
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
          <p className="text-sm text-gray-400">
            Akkauntingiz bormi?{" "}
            <button type="button" onClick={onSwitchToLogin} className="text-neon-cyan underline">
              Kirish
            </button>
          </p>
          <Field label="Ismingiz">
            <input
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Masalan: Dilnoza Karimova"
              maxLength={100}
              className={inputClass}
            />
          </Field>
          <Field label="Telefon raqamingiz" hint="Keyingi safar shu raqam bilan kirasiz.">
            <PhoneInput value={form.phone} onChange={(value) => update("phone", value)} />
          </Field>
          <Field label="Parol o'ylab toping" hint="Kamida 6 ta belgi.">
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              maxLength={128}
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
              onChange={(e) => {
                const examMonth = e.target.value;
                const left = monthsUntil(examMonth);
                // Imtihongacha qolgan muddatga eng yaqin variantni taklif qilamiz (o'quvchi o'zgartira oladi).
                setForm((prev) => ({
                  ...prev,
                  examMonth,
                  studyMonths: prev.studyMonths ?? (left ? closestMonths(left) : null),
                }));
              }}
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
          <PlanSettingsFields
            value={{ months: form.studyMonths, days: form.daysPerWeek, minutes: form.dailyMinutes }}
            examMonthsLeft={!form.examMonthUnknown && form.examMonth ? monthsUntil(form.examMonth) : null}
            onChange={(next) =>
              setForm((prev) => ({ ...prev, studyMonths: next.months, daysPerWeek: next.days, dailyMinutes: next.minutes }))
            }
          />
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

      {error && (
        <div className="space-y-1">
          <p className="text-sm text-red-400">{error}</p>
          {step === 4 && (
            <button type="button" onClick={() => setStep(0)} className="text-sm text-neon-cyan underline">
              Telefon raqamni o&apos;zgartirish
            </button>
          )}
        </div>
      )}

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
