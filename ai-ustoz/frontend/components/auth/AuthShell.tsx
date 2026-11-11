"use client";

import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-gray-700 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan";

export function AuthShell({ children }: { children: ReactNode }) {
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

// Faqat aniq davlat kodini olib tashlaydi: "+998 ..." yoki 12 xonali "998...".
// 9 xonali "99 8.." (99-operator) raqamiga tegilmaydi.
function stripCountryCode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const hasCountryCode = raw.trim().startsWith("+998") || (digits.length === 12 && digits.startsWith("998"));
  return hasCountryCode ? raw.replace(/^\s*\+?\s*998\s*/, "") : raw;
}

export function PhoneInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-700 bg-black/30 focus-within:border-neon-cyan">
      <span className="flex items-center border-r border-gray-700 px-3 text-sm text-gray-400">+998</span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(stripCountryCode(e.target.value))}
        placeholder="90 123 45 67"
        maxLength={17}
        className="w-full bg-transparent px-3 py-2.5 text-sm text-white outline-none"
      />
    </div>
  );
}
