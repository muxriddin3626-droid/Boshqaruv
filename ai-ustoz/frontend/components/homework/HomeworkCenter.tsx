"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { assignHomework, fetchHomework, fetchHomeworkList } from "@/lib/api";
import type { Homework, HomeworkSummary, Subject } from "@/lib/types";

import HomeworkResultView from "./HomeworkResultView";
import HomeworkSolve, { dueFormatter } from "./HomeworkSolve";

const SUBJECT_LABEL: Record<Subject, string> = { kimyo: "Kimyo", biologiya: "Biologiya" };

/** Suhbatdagi "Uyga vazifa olish" tugmasidan kelgan so'rov (`id` — har bosishda yangi). */
export interface HomeworkRequest {
  id: number;
  subject: Subject;
}

/**
 * Uy vazifasi bo'limi: AI Ustoz bergan vazifalar ro'yxati, bajarish va tekshiruv natijasi.
 * Vazifa mavzusi — o'quv rejadagi joriy mavzu (backend tanlaydi).
 */
export default function HomeworkCenter({
  token,
  subject,
  request = null,
  onRequestHandled,
}: {
  token: string;
  subject: Subject;
  request?: HomeworkRequest | null;
  onRequestHandled?: () => void;
}) {
  const [items, setItems] = useState<HomeworkSummary[] | null>(null);
  const [current, setCurrent] = useState<Homework | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef<number | null>(null);

  const reload = useCallback(() => {
    fetchHomeworkList(token)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Vazifalarni yuklab bo'lmadi"));
  }, [token]);

  useEffect(reload, [reload]);

  const requestNew = useCallback(
    async (forSubject: Subject) => {
      setIsAssigning(true);
      setError(null);
      try {
        setCurrent(await assignHomework(token, forSubject));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Vazifa olib bo'lmadi");
      } finally {
        setIsAssigning(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!request || handledRef.current === request.id) return;
    handledRef.current = request.id;
    onRequestHandled?.();
    void requestNew(request.subject);
  }, [request, onRequestHandled, requestNew]);

  async function open(id: string) {
    setError(null);
    try {
      setCurrent(await fetchHomework(token, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vazifani yuklab bo'lmadi");
    }
  }

  function backToList() {
    setCurrent(null);
    reload();
  }

  if (isAssigning) {
    return (
      <p className="py-10 text-center text-sm text-gray-400" data-testid="homework-assigning">
        AI Ustoz bugungi mavzu bo&apos;yicha vazifa tuzyapti va masalalarni o&apos;zi yechib tekshiryapti...
      </p>
    );
  }

  if (current) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={backToList} className="text-sm text-gray-400 hover:text-white">
            ← Vazifalar
          </button>
          <span className="text-xs text-gray-500">{SUBJECT_LABEL[current.subject]}</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-neon-pink">Uyga vazifa</p>
          <p className="text-lg font-bold text-white">{current.topic}</p>
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        {current.status === "checked" ? (
          <HomeworkResultView homework={current} onNext={backToList} />
        ) : (
          <HomeworkSolve token={token} homework={current} onChecked={setCurrent} />
        )}
      </div>
    );
  }

  const openForSubject = items?.find((item) => item.status === "assigned" && item.subject === subject);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="space-y-2 rounded-2xl border border-neon-pink/30 bg-neon-pink/5 p-4">
        <p className="font-semibold text-white">Uyga vazifa</p>
        <p className="text-sm text-gray-400">
          Darsdan keyin AI Ustoz rejadagi mavzu bo&apos;yicha 5 ta test va 2 ta masala beradi. Yechimni yozing yoki daftar
          rasmini yuboring — u har bir bosqichni tekshirib, xatoingizni ko&apos;rsatadi.
        </p>
        <button
          onClick={() => (openForSubject ? open(openForSubject.id) : requestNew(subject))}
          className="w-full rounded-xl bg-gradient-to-br from-neon-pink to-neon-violet py-2.5 text-sm font-semibold text-white"
        >
          {openForSubject ? "Ochiq vazifani davom ettirish" : `${SUBJECT_LABEL[subject]} bo'yicha vazifa olish`}
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {items === null && !error && <p className="text-sm text-gray-500">Yuklanmoqda...</p>}
      {items?.length === 0 && <p className="text-center text-sm text-gray-500">Hali vazifa berilmagan.</p>}

      <ul className="space-y-2" data-testid="homework-list">
        {items?.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => open(item.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-surface px-3 py-2.5 text-left text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-white">{item.topic}</span>
                <span className="text-xs text-gray-500">
                  {SUBJECT_LABEL[item.subject]} ·{" "}
                  {item.status === "checked"
                    ? `tekshirildi · +${item.xp_earned} XP`
                    : item.is_overdue
                      ? "muddati o'tgan"
                      : `${dueFormatter.format(new Date(item.due_at))} gacha`}
                </span>
              </span>
              {item.status === "checked" ? (
                <span className="font-mono font-bold text-neon-cyan">{item.percent}%</span>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-xs ${item.is_overdue ? "bg-red-500/15 text-red-300" : "bg-yellow-500/15 text-yellow-200"}`}>
                  {item.is_overdue ? "Kechikdi" : "Bajarilmagan"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
