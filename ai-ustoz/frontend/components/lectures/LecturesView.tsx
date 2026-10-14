"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchLecture, fetchLectureCatalog, requestLecture } from "@/lib/api";
import type { Lecture, LectureCatalog, LectureCatalogItem, Subject } from "@/lib/types";

import AudioLibrary from "../audio/AudioLibrary";
import LecturePlayer, { formatClock } from "./LecturePlayer";

const POLL_MS = 4000;

/** "Reja" bo'limidagi "Ma'ruzani tinglash" so'rovi (`id` — har bosishda yangi). */
export interface LectureRequest {
  id: number;
  subject: Subject;
  topic: string;
}

function ItemStatus({ item }: { item: LectureCatalogItem }) {
  if (item.status === "generating") {
    return <span className="animate-pulse text-xs text-yellow-200">Tayyorlanmoqda...</span>;
  }
  if (item.status !== "ready") {
    return <span className="text-xs text-neon-cyan">{item.status === "failed" ? "Qayta urinish" : "Tayyorlash"}</span>;
  }
  if (item.progress?.completed) {
    return <span className="text-xs text-green-400">Tinglangan · {formatClock(item.duration_seconds)}</span>;
  }
  if (item.progress && item.progress.position_seconds > 0) {
    return (
      <span className="text-xs text-neon-cyan">
        Davom: {formatClock(item.progress.position_seconds)} / {formatClock(item.duration_seconds)}
      </span>
    );
  }
  return <span className="text-xs text-white">Tinglash · {formatClock(item.duration_seconds)}</span>;
}

/**
 * Ma'ruzalar: dastur mavzulari bo'yicha audio ma'ruzalar (bir marta tayyorlanadi,
 * keyin istalgancha qayta eshitiladi) va Suhbatdan saqlangan javob audiolari.
 */
export default function LecturesView({
  token,
  subject,
  request = null,
  onRequestHandled,
}: {
  token: string;
  subject: Subject;
  request?: LectureRequest | null;
  onRequestHandled?: () => void;
}) {
  const [catalog, setCatalog] = useState<LectureCatalog | null>(null);
  const [open, setOpen] = useState<Lecture | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef<number | null>(null);

  const reload = useCallback(() => {
    fetchLectureCatalog(token, subject)
      .then(setCatalog)
      .catch((err) => setError(err instanceof Error ? err.message : "Ma'ruzalarni yuklab bo'lmadi"));
  }, [token, subject]);

  useEffect(reload, [reload]);

  const openTopic = useCallback(
    async (topicSubject: Subject, topic: string) => {
      setError(null);
      try {
        const lecture = await requestLecture(token, topicSubject, topic);
        if (lecture.status === "ready") {
          setWaitingFor(null);
          setOpen(lecture);
        } else {
          setWaitingFor(lecture.id); // tayyor bo'lgach avtomatik ochiladi
          reload();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ma'ruzani tayyorlab bo'lmadi");
      }
    },
    [reload, token]
  );

  useEffect(() => {
    if (!request || handledRef.current === request.id) return;
    handledRef.current = request.id;
    onRequestHandled?.();
    void openTopic(request.subject, request.topic);
  }, [request, onRequestHandled, openTopic]);

  // Tayyorlanayotgan ma'ruza bor ekan — holatni so'rab turamiz.
  const hasGenerating = waitingFor !== null || (catalog?.items.some((item) => item.status === "generating") ?? false);
  useEffect(() => {
    if (!hasGenerating || open) return;
    const timer = window.setInterval(async () => {
      reload();
      if (!waitingFor) return;
      try {
        const lecture = await fetchLecture(token, waitingFor);
        if (lecture.status === "ready") {
          setWaitingFor(null);
          setOpen(lecture);
        } else if (lecture.status === "failed") {
          setWaitingFor(null);
          setError("Ma'ruzani tayyorlab bo'lmadi. Qayta urinib ko'ring.");
        }
      } catch {
        // Keyingi so'rovda qayta uriniladi.
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasGenerating, open, reload, token, waitingFor]);

  const showXp = useCallback((xp: number) => {
    setToast(`Ma'ruza oxirigacha tinglandi: +${xp} XP`);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  if (open) {
    return (
      <>
        {toast && (
          <p className="mx-auto mb-3 max-w-lg rounded-xl bg-neon-violet/20 px-3 py-2 text-center text-sm font-semibold text-neon-violet" data-testid="lecture-xp">
            {toast}
          </p>
        )}
        <LecturePlayer
          key={open.id}
          token={token}
          lecture={open}
          onXp={showXp}
          onBack={() => {
            setOpen(null);
            reload();
          }}
        />
      </>
    );
  }

  let lastCategory = "";
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="space-y-1 rounded-2xl border border-neon-violet/30 bg-neon-violet/5 p-4">
        <p className="font-semibold text-white">Audio ma&apos;ruzalar</p>
        <p className="text-sm text-gray-400">
          Har mavzu bo&apos;yicha 7-10 daqiqalik ma&apos;ruza: tushunchalar, formulalar, namunaviy masala va DTM tuzoqlari.
          Bir marta tayyorlanadi — keyin yo&apos;lda ham qayta-qayta eshiting, qayerda to&apos;xtaganingiz eslab qolinadi.
        </p>
      </div>

      {waitingFor && (
        <p className="animate-pulse rounded-xl bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100" data-testid="lecture-waiting">
          AI Ustoz ma&apos;ruzani yozib, ovozga aylantiryapti (1-2 daqiqa). Tayyor bo&apos;lishi bilan o&apos;zi ochiladi.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {!catalog && !error && <p className="text-sm text-gray-500">Yuklanmoqda...</p>}

      <ul className="space-y-1.5" data-testid="lecture-list">
        {catalog?.items.map((item) => {
          const header = item.category !== lastCategory ? item.category : null;
          lastCategory = item.category;
          return (
            <li key={item.topic}>
              {header && <p className="mb-1 mt-3 text-xs uppercase tracking-widest text-gray-500">{header}</p>}
              <button
                onClick={() => void openTopic(subject, item.topic)}
                disabled={item.status === "generating"}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-surface px-3 py-2.5 text-left text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-gray-100">{item.topic}</span>
                <ItemStatus item={item} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 pt-2">
        <p className="text-sm font-medium text-white">Suhbatdan saqlangan audio javoblar</p>
        <AudioLibrary token={token} subject={subject} />
      </div>
    </div>
  );
}
