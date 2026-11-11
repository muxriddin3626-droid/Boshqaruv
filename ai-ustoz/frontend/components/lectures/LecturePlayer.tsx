"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { mediaUrl, saveLectureProgress } from "@/lib/api";
import type { Lecture } from "@/lib/types";

import MarkdownRenderer from "../chat/MarkdownRenderer";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SPEED_KEY = "ai_ustoz_lecture_speed";
const SAVE_EVERY_MS = 10_000;
const SKIP_SECONDS = 15;
const SUBJECT_LABEL = { kimyo: "Kimyo", biologiya: "Biologiya" } as const;

export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(Math.floor(totalSeconds % 60)).padStart(2, "0")}`;
}

function readSpeed(): number {
  try {
    const saved = Number(window.localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
}

function PlayIcon({ isPlaying }: { isPlaying: boolean }) {
  return isPlaying ? (
    <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

function SkipButton({ seconds, onClick }: { seconds: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={seconds < 0 ? `${-seconds} soniya orqaga` : `${seconds} soniya oldinga`}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-xs font-semibold text-gray-200"
    >
      {seconds < 0 ? `−${-seconds}` : `+${seconds}`}
    </button>
  );
}

/**
 * Ma'ruza pleyeri: oxirgi to'xtagan joydan davom etadi, holatni har 10 soniyada,
 * pauzada, oxirida va sahifa yopilganda saqlaydi. Telefon qulflanganda ham
 * boshqarish mumkin (Media Session).
 */
export default function LecturePlayer({
  token,
  lecture,
  onBack,
  onXp,
}: {
  token: string;
  lecture: Lecture;
  onBack: () => void;
  onXp: (xp: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(lecture.duration_seconds);
  const [speed, setSpeed] = useState(1);
  const [showText, setShowText] = useState(false);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(lecture.progress?.completed ?? false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(-1);
  // Faqat haqiqatan tinglangan bo'lsa saqlanadi: shunchaki ochish "boshlagan" deb hisoblanmasin.
  const hasPlayedRef = useRef(false);
  const durationRef = useRef(lecture.duration_seconds);
  const onXpRef = useRef(onXp);
  onXpRef.current = onXp;

  const src = lecture.audio_url ? mediaUrl(lecture.audio_url) : "";

  const save = useCallback(
    async (ended = false, keepalive = false) => {
      const audio = audioRef.current;
      if (!audio || !hasPlayedRef.current) return;
      const position = ended ? durationRef.current : audio.currentTime;
      if (!ended && Math.abs(position - lastSavedRef.current) < 1) return;
      lastSavedRef.current = position;
      try {
        const result = await saveLectureProgress(token, lecture.id, position, ended, keepalive);
        if (result.progress.completed) setIsCompleted(true);
        if (result.xp_awarded > 0) onXpRef.current(result.xp_awarded);
      } catch {
        // Saqlanmasa keyingi urinishda saqlanadi — tinglash to'xtamasin.
      }
    },
    [lecture.id, token]
  );

  useEffect(() => setSpeed(readSpeed()), []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
    try {
      window.localStorage.setItem(SPEED_KEY, String(speed));
    } catch {
      // Tezlik eslab qolinmasa ham ishlaydi.
    }
  }, [speed]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => void save(), SAVE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, save]);

  useEffect(() => {
    const onHide = () => void save(false, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void save(false, true); // boshqa bo'limga o'tilganda
    };
  }, [save]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: lecture.title ?? lecture.topic,
      artist: "AI Ustoz",
      album: `${SUBJECT_LABEL[lecture.subject]} · ${lecture.category}`,
    });
    const audio = () => audioRef.current;
    navigator.mediaSession.setActionHandler("play", () => void audio()?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio()?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-SKIP_SECONDS));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(SKIP_SECONDS));
    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward"] as const) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, [lecture]); // eslint-disable-line react-hooks/exhaustive-deps

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || duration, audio.currentTime + seconds));
  }

  function seekTo(seconds: number, autoplay = false) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setTime(seconds);
    if (autoplay) void audio.play().catch(() => undefined);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError("Audioni ijro etib bo'lmadi. Internetni tekshiring.");
      }
    } else {
      audio.pause();
    }
  }

  const currentSection = lecture.sections.reduce((found, section, index) => (time >= section.start_seconds ? index : found), 0);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-white">
        ← Ma&apos;ruzalar
      </button>

      <div className="space-y-4 rounded-2xl border border-neon-violet/30 bg-gradient-to-b from-neon-violet/10 to-transparent p-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-neon-cyan">
            {SUBJECT_LABEL[lecture.subject]} · {lecture.category}
          </p>
          <p className="text-lg font-bold text-white" data-testid="lecture-title">
            {lecture.title ?? lecture.topic}
          </p>
          {isCompleted && <p className="text-xs text-green-400">Oxirigacha tinglangan</p>}
        </div>

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          data-testid="lecture-audio"
          onLoadedMetadata={(event) => {
            const audio = event.currentTarget;
            durationRef.current = audio.duration || lecture.duration_seconds;
            setDuration(durationRef.current);
            audio.playbackRate = speed;
            const saved = lecture.progress?.position_seconds ?? 0;
            if (saved > 5 && saved < (audio.duration || lecture.duration_seconds) - 5) {
              audio.currentTime = saved;
              setTime(saved);
              setResumedFrom(saved);
            }
          }}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onPlay={() => {
            hasPlayedRef.current = true;
            setIsPlaying(true);
          }}
          onPause={() => {
            setIsPlaying(false);
            void save();
          }}
          onEnded={() => {
            setIsPlaying(false);
            void save(true);
          }}
          onError={() => setError("Audio yuklanmadi. Sahifani yangilab ko'ring.")}
        />

        {resumedFrom !== null && (
          <p className="rounded-lg bg-neon-cyan/10 px-3 py-1.5 text-xs text-neon-cyan" data-testid="resume-note">
            Oxirgi marta {formatClock(resumedFrom)} da to&apos;xtagan edingiz — shu joydan davom etadi.{" "}
            <button onClick={() => seekTo(0)} className="underline">
              Boshidan
            </button>
          </p>
        )}

        <div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(time, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Ma'ruza vaqti"
            className="w-full accent-neon-cyan"
          />
          <div className="flex justify-between font-mono text-xs text-gray-500">
            <span data-testid="lecture-time">{formatClock(time)}</span>
            <span>{formatClock(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <SkipButton seconds={-SKIP_SECONDS} onClick={() => skip(-SKIP_SECONDS)} />
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pauza" : "Tinglash"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-neon-violet to-neon-cyan text-white"
          >
            <PlayIcon isPlaying={isPlaying} />
          </button>
          <SkipButton seconds={SKIP_SECONDS} onClick={() => skip(SKIP_SECONDS)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex gap-1" role="group" aria-label="Tezlik">
            {SPEEDS.map((option) => (
              <button
                key={option}
                onClick={() => setSpeed(option)}
                aria-pressed={speed === option}
                className={`rounded px-2 py-1 ${speed === option ? "bg-neon-pink text-white" : "text-gray-400"}`}
              >
                {option}x
              </button>
            ))}
          </div>
          {src && (
            <a href={src} download={`${lecture.topic}.mp3`} className="text-neon-cyan underline">
              Yuklab olish
            </a>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-white">Bo&apos;limlar</p>
        <ol className="space-y-1" data-testid="lecture-sections">
          {lecture.sections.map((section, index) => (
            <li key={section.title}>
              <button
                onClick={() => seekTo(section.start_seconds, true)}
                aria-current={index === currentSection ? "true" : undefined}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  index === currentSection ? "bg-neon-cyan/10 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
              >
                <span>
                  {index + 1}. {section.title}
                </span>
                <span className="font-mono text-xs text-gray-500">{formatClock(section.start_seconds)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-gray-800 p-3">
        <button onClick={() => setShowText(!showText)} className="text-sm text-neon-cyan underline">
          {showText ? "Matnni yashirish" : "Ma'ruza matnini o'qish (konspekt)"}
        </button>
        {showText && (
          <div className="mt-3 space-y-4 text-sm text-gray-200">
            {lecture.sections.map((section) => (
              <div key={section.title}>
                <p className="font-semibold text-white">{section.title}</p>
                <MarkdownRenderer content={section.markdown} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
