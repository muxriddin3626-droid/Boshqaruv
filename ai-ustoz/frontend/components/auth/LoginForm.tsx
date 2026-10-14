"use client";

import { useState, type FormEvent } from "react";

import { loginWithPhone, phoneDigits } from "@/lib/api";
import type { Subject } from "@/lib/types";

import { AuthShell, PhoneInput, inputClass } from "./AuthShell";

export default function LoginForm({
  onLoggedIn,
  onSwitchToRegister,
}: {
  onLoggedIn: (token: string, preferredSubject: Subject) => void;
  onSwitchToRegister: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const digits = phoneDigits(phone);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!digits || !password) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await loginWithPhone(`+998${digits}`, password);
      onLoggedIn(result.access_token, result.subjects === "biologiya" ? "biologiya" : "kimyo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirib bo'lmadi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-xl font-bold text-white">Kirish</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-200">Telefon raqam</p>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-200">Parol</p>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={!digits || !password || isSubmitting}
          className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isSubmitting ? "Kirilmoqda..." : "Kirish"}
        </button>
      </form>
      <p className="text-center text-sm text-gray-400">
        Akkauntingiz yo&apos;qmi?{" "}
        <button type="button" onClick={onSwitchToRegister} className="text-neon-cyan underline">
          Ro&apos;yxatdan o&apos;tish
        </button>
      </p>
      <p className="text-center text-xs text-gray-500">
        Parolni unutdingizmi? Administratorga murojaat qiling.
      </p>
    </AuthShell>
  );
}
