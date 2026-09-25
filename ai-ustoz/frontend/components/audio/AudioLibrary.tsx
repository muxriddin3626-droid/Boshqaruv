"use client";

import { useEffect, useState } from "react";

import { deleteAudioLecture, fetchAudioLectures, setAudioLectureSaved } from "@/lib/api";
import type { AudioLecture, Subject } from "@/lib/types";

import AudioPlayer from "./AudioPlayer";

/**
 * MODUL 8: Audio Lecture Engine — shaxsiy audio kutubxona (User Audio Dashboard).
 * AI Ustoz javoblaridan yaratilgan audio ma'ruzalar ro'yxati.
 */
export default function AudioLibrary({ token, subject }: { token: string; subject: Subject }) {
  const [lectures, setLectures] = useState<AudioLecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadLectures() {
    setIsLoading(true);
    try {
      const data = await fetchAudioLectures(token, subject);
      setLectures(data);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLectures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subject]);

  async function handleToggleSave(lecture: AudioLecture) {
    const updated = await setAudioLectureSaved(token, lecture.id, !lecture.is_saved);
    setLectures((prev) => prev.map((item) => (item.id === lecture.id ? updated : item)));
  }

  async function handleDelete(lecture: AudioLecture) {
    await deleteAudioLecture(token, lecture.id);
    setLectures((prev) => prev.filter((item) => item.id !== lecture.id));
  }

  if (isLoading) {
    return <p className="text-center text-gray-500">Audio kutubxona yuklanmoqda...</p>;
  }

  if (lectures.length === 0) {
    return (
      <p className="text-center text-gray-500">
        Hali saqlangan audio ma&apos;ruza yo&apos;q. Suhbat bo&apos;limida AI Ustoz javobi ostidagi{" "}
        <span className="text-neon-cyan">&quot;Audio qilish&quot;</span> tugmasidan foydalaning.
      </p>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto">
      {lectures.map((lecture) => (
        <div key={lecture.id} className="space-y-1.5">
          <AudioPlayer lecture={lecture} />
          <div className="flex justify-end gap-4 px-1 text-xs">
            <button onClick={() => handleToggleSave(lecture)} className="text-neon-cyan">
              {lecture.is_saved ? "Kutubxonadan olib tashlash" : "Kutubxonaga saqlash"}
            </button>
            <button onClick={() => handleDelete(lecture)} className="text-red-400">
              O&apos;chirish
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
