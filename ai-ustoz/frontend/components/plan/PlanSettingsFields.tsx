"use client";

import type { ReactNode } from "react";

export const STUDY_MONTHS = [1, 2, 3, 6, 9, 12];
export const DAYS_PER_WEEK = [3, 4, 5, 6, 7];
export const DAILY_MINUTES = [
  { value: 30, label: "30 daq" },
  { value: 45, label: "45 daq" },
  { value: 60, label: "1 soat" },
  { value: 90, label: "1.5 soat" },
  { value: 120, label: "2 soat" },
  { value: 180, label: "3 soat" },
];

export interface PlanSettingsValue {
  months: number | null;
  days: number | null;
  minutes: number | null;
}

/** Imtihon oyigacha qolgan oylar (1-24 oralig'ida bo'lmasa — null). */
export function monthsUntil(examMonth: string, today = new Date()): number | null {
  const [year, month] = examMonth.split("-").map(Number);
  if (!year || !month) return null;
  const months = (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
  return months >= 1 && months <= 24 ? months : null;
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes / 5) * 5;
  if (minutes < 60) return `${minutes} daq`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} soat ${rest} daq` : `${hours} soat`;
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-3.5 py-2 text-sm transition ${
        selected ? "border-neon-cyan bg-neon-cyan/15 text-white" : "border-gray-700 text-gray-300 hover:border-neon-violet/60"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-200">{label}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** "Necha oy / haftada necha kun / kuniga qancha" — so'rovnomada ham, Reja bo'limida ham bir xil. */
export default function PlanSettingsFields({
  value,
  onChange,
  examMonthsLeft = null,
}: {
  value: PlanSettingsValue;
  onChange: (next: PlanSettingsValue) => void;
  examMonthsLeft?: number | null;
}) {
  const weekly = value.days && value.minutes ? value.days * value.minutes : null;
  const plannedMonths = value.months && examMonthsLeft ? Math.min(value.months, examMonthsLeft) : value.months;
  return (
    <div className="space-y-4">
      <Group
        label="Necha oy ichida tayyorlanmoqchisiz?"
        hint={examMonthsLeft ? `Imtihongacha taxminan ${examMonthsLeft} oy qoldi.` : "Shu muddatga haftalik reja tuziladi."}
      >
        {STUDY_MONTHS.map((months) => (
          <Option key={months} selected={value.months === months} onClick={() => onChange({ ...value, months })}>
            {months} oy
          </Option>
        ))}
      </Group>
      <Group label="Haftada necha kun o'qiysiz?">
        {DAYS_PER_WEEK.map((days) => (
          <Option key={days} selected={value.days === days} onClick={() => onChange({ ...value, days })}>
            {days === 7 ? "Har kuni" : `${days} kun`}
          </Option>
        ))}
      </Group>
      <Group label="Kuniga qancha vaqt ajratasiz?">
        {DAILY_MINUTES.map((option) => (
          <Option key={option.value} selected={value.minutes === option.value} onClick={() => onChange({ ...value, minutes: option.value })}>
            {option.label}
          </Option>
        ))}
      </Group>
      {weekly && plannedMonths && (
        <p className="rounded-xl bg-neon-violet/10 px-3 py-2 text-sm text-gray-200" data-testid="plan-preview">
          Haftasiga <b>{formatDuration(weekly)}</b>, {plannedMonths} oyda jami taxminan{" "}
          <b>{formatDuration(Math.round((weekly * plannedMonths * 52) / 12))}</b> dars.
          {examMonthsLeft && value.months && value.months > examMonthsLeft && " Reja imtihongacha qisqartiriladi."}
        </p>
      )}
    </div>
  );
}
