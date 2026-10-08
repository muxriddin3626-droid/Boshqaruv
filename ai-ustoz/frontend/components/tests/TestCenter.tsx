"use client";

import { useEffect, useState, type ReactNode } from "react";

import { createTest, fetchActiveTest, fetchTestCatalog } from "@/lib/api";
import type { Subject, TestCatalog, TestCreatePayload, TestResult, TestSession } from "@/lib/types";

import TestResultView from "./TestResultView";
import TestRunner from "./TestRunner";

const SUBJECT_LABEL: Record<Subject, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };
const OTHER: Record<Subject, Subject> = { kimyo: "biologiya", biologiya: "kimyo" };

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-neon-violet/20 bg-black/20 p-4">
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs ${
        selected ? "border-neon-cyan bg-neon-cyan/15 text-white" : "border-gray-700 text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function TestCenter({ token, subject }: { token: string; subject: Subject }) {
  const [catalog, setCatalog] = useState<TestCatalog | null>(null);
  const [session, setSession] = useState<TestSession | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [firstSubject, setFirstSubject] = useState<Subject>("biologiya");
  const [dtmBlocks, setDtmBlocks] = useState<"both" | "first" | "second">("both");
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState<10 | 20>(10);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTestCatalog(), fetchActiveTest(token)])
      .then(([loadedCatalog, active]) => {
        if (cancelled) return;
        setCatalog(loadedCatalog);
        setSession(active);
      })
      .catch(() => !cancelled && setError("Testlarni yuklab bo'lmadi. Internetni tekshiring."))
      .finally(() => !cancelled && setIsChecking(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (catalog) setTopic(catalog.topics[subject][0]?.topic ?? "");
  }, [catalog, subject]);

  async function start(key: string, payload: TestCreatePayload) {
    setError(null);
    setStarting(key);
    try {
      setSession(await createTest(token, payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testni boshlab bo'lmadi");
    } finally {
      setStarting(null);
    }
  }

  if (isChecking) return <p className="text-sm text-gray-500">Yuklanmoqda...</p>;

  if (result) {
    return (
      <TestResultView
        result={result}
        onClose={() => {
          setResult(null);
          setSession(null);
        }}
      />
    );
  }

  if (session) {
    return (
      <TestRunner
        key={session.attempt_id}
        token={token}
        session={session}
        onFinished={(finished) => {
          setResult(finished);
          setSession(null);
        }}
      />
    );
  }

  if (!catalog) return <p className="text-sm text-red-400">{error}</p>;

  const dtmQuestionMinutes = catalog.dtm_seconds_per_question / 60;
  const dtmOptions = [
    { value: "both" as const, label: `Ikkala fan · ${catalog.dtm_questions_per_subject * 2} savol` },
    { value: "first" as const, label: `Faqat 1-fan (${SUBJECT_LABEL[firstSubject]})` },
    { value: "second" as const, label: `Faqat 2-fan (${SUBJECT_LABEL[OTHER[firstSubject]]})` },
  ];
  const dtmQuestionTotal = catalog.dtm_questions_per_subject * (dtmBlocks === "both" ? 2 : 1);
  const topicsByCategory = catalog.topics[subject].reduce<Record<string, string[]>>((groups, item) => {
    (groups[item.category] ??= []).push(item.topic);
    return groups;
  }, {});

  const startLabel = (key: string, label: string) =>
    starting === key ? "Savollar tayyorlanmoqda..." : label;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {starting && (
        <p className="text-xs text-gray-500">
          Yangi savollar tuzilib, tekshirilayotgan bo&apos;lsa, bu bir daqiqagacha cho&apos;zilishi mumkin.
        </p>
      )}

      <Card
        title="DTM sinov testi"
        description={`Haqiqiy imtihondek: har fandan ${catalog.dtm_questions_per_subject} savol, 1-fan har savoli ${catalog.dtm_first_weight} ball, 2-fan ${catalog.dtm_second_weight} ball. Har savolga ${dtmQuestionMinutes} daqiqa.`}
      >
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">1-fan (asosiy, {catalog.dtm_first_weight} ball):</p>
          <div className="flex gap-2">
            {(["biologiya", "kimyo"] as Subject[]).map((s) => (
              <Pill key={s} selected={firstSubject === s} onClick={() => setFirstSubject(s)}>
                {SUBJECT_LABEL[s]}
              </Pill>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {dtmOptions.map((option) => (
            <Pill key={option.value} selected={dtmBlocks === option.value} onClick={() => setDtmBlocks(option.value)}>
              {option.label}
            </Pill>
          ))}
        </div>
        <button
          onClick={() => start("dtm", { kind: "dtm_mock", first_subject: firstSubject, dtm_blocks: dtmBlocks })}
          disabled={starting !== null}
          className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {startLabel("dtm", `Boshlash · ${dtmQuestionTotal} savol · ${(dtmQuestionTotal * dtmQuestionMinutes) / 60} soat`)}
        </button>
      </Card>

      <Card title="Mavzu bo'yicha test" description={`${SUBJECT_LABEL[subject]}: bitta mavzuni mustahkamlash uchun.`}>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
        >
          {Object.entries(topicsByCategory).map(([category, topics]) => (
            <optgroup key={category} label={category}>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex gap-2">
          {([10, 20] as const).map((count) => (
            <Pill key={count} selected={questionCount === count} onClick={() => setQuestionCount(count)}>
              {count} savol
            </Pill>
          ))}
        </div>
        <button
          onClick={() => start("topic", { kind: "topic", subject, topic, question_count: questionCount })}
          disabled={starting !== null || !topic}
          className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {startLabel("topic", "Boshlash")}
        </button>
      </Card>

      <Card
        title="Milliy Sertifikat mashqi"
        description={`${SUBJECT_LABEL[subject]}: ${catalog.ms_question_count} savol, barcha mavzulardan.`}
      >
        {!catalog.ms_is_official && (
          <p className="rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
            Taxminiy format: rasmiy Milliy Sertifikat formati (savollar soni, turlari, daraja chegaralari) hali
            tasdiqlanmagan. Natijada foiz ko&apos;rsatiladi, daraja (A+, B...) ko&apos;rsatilmaydi.
          </p>
        )}
        <button
          onClick={() => start("ms", { kind: "milliy_sertifikat", subject })}
          disabled={starting !== null}
          className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {startLabel("ms", "Boshlash")}
        </button>
      </Card>
    </div>
  );
}
