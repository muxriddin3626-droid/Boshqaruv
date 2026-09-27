"use client";

import { useEffect, useRef, useState } from "react";

import type { AudioLecture } from "@/lib/types";

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2];

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const SUBJECT_LABELS: Record<AudioLecture["subject"], string> = {
  kimyo: "Kimyo",
  biologiya: "Biologiya",
};

/**
 * MODUL 8: Audio Lecture Engine — kompakt audio pleyer.
 * Play/Pause, progress bar (seek), tezlik boshqaruvi (1x-2x) va
 * ma'ruza konspektini ko'rish/yashirish tugmasi.
 */
export default function AudioPlayer({ lecture }: { lecture: AudioLecture }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(lecture.duration_seconds);
  const [speed, setSpeed] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(event.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }

  return (
    <div className="rounded-xl border border-neon-violet/20 bg-surface/60 p-4">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={lecture.audio_url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || lecture.duration_seconds)}
        hidden
      />

      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{lecture.lecture_title}</p>
          <p className="text-xs text-gray-500">
            {SUBJECT_LABELS[lecture.subject]}
            {lecture.grade ? ` · ${lecture.grade}-sinf` : ""}
          </p>
        </div>
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "To'xtatish" : "Ijro etish"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-violet to-neon-cyan text-white"
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="w-full accent-neon-cyan"
      />

      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{formatTime(currentTime)}</span>
        <div className="flex gap-1">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setSpeed(option)}
              className={`rounded px-1.5 py-0.5 ${
                speed === option ? "bg-neon-pink text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {option}x
            </button>
          ))}
        </div>
        <span>{formatTime(duration)}</span>
      </div>

      {lecture.lecture_summary && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <button onClick={() => setShowSummary((prev) => !prev)} className="text-xs text-neon-cyan underline">
            {showSummary ? "Konspektni yashirish" : "Konspektni ko'rish"}
          </button>
          {showSummary && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-gray-300">
              {lecture.lecture_summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
