"use client";

import { useEffect, useRef, useState } from "react";

import { fetchPlan, fetchProgress, generateAudioLecture, streamChatMessage } from "@/lib/api";
import type { ChatMessage, ProgressResponse, Subject } from "@/lib/types";

import MessageBubble from "./MessageBubble";

const SUBJECT_LABELS: Record<Subject, string> = {
  kimyo: "Kimyo",
  biologiya: "Biologiya",
};

// Kamida 2 savol-javobdan keyin (dars boshlangach) uyga vazifa taklif qilinadi.
const MESSAGES_BEFORE_HOMEWORK = 4;

/** "Reja" bo'limidan kelgan "Darsni boshlash" so'rovi (`id` — har bosishda yangi). */
export interface LessonRequest {
  id: number;
  topic: string;
}

export function lessonStartMessage(topic: string): string {
  return `Bugungi darsni boshlaylik: "${topic}".`;
}

export default function ChatWindow({
  token,
  subject,
  lessonRequest = null,
  onLessonRequestHandled,
  onRequestHomework,
}: {
  token: string;
  subject: Subject;
  lessonRequest?: LessonRequest | null;
  /** Chaqiruvchi so'rovni tozalaydi — bo'lim qayta ochilganda dars ikkinchi marta boshlanmasin. */
  onLessonRequestHandled?: () => void;
  /** Dars oxirida "Uyga vazifa olish" — Uy vazifasi bo'limini ochadi. */
  onRequestHomework?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [todayTopic, setTodayTopic] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const handledLessonRef = useRef<number | null>(null);

  useEffect(() => {
    fetchProgress(token, subject)
      .then(setProgress)
      .catch(() => setProgress(null));
    // Rejadagi shu fan bo'yicha birinchi o'tilmagan mavzu — bugungi dars.
    fetchPlan(token)
      .then((plan) => setTodayTopic(plan?.topics.find((t) => t.subject === subject && !t.completed)?.topic ?? null))
      .catch(() => setTodayTopic(null));
  }, [token, subject]);

  useEffect(() => {
    if (!lessonRequest || handledLessonRef.current === lessonRequest.id) return;
    handledLessonRef.current = lessonRequest.id;
    onLessonRequestHandled?.();
    void handleSend(lessonStartMessage(lessonRequest.topic));
  }, [lessonRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleGenerateAudio(content: string) {
    const title = content.slice(0, 60).trim() || "AI Ustoz ma'ruzasi";
    await generateAudioLecture(token, subject, title, content);
  }

  async function handleSend(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || isSending) return;

    if (preset === undefined) setInput("");
    setIsSending(true);
    // Telefonda suhbat oynasi yuzcha ostida — javob ko'rinishi uchun unga suriladi.
    if (window.matchMedia("(max-width: 767px)").matches) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      await streamChatMessage(
        token,
        subject,
        text,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            updated[lastIndex] = { ...updated[lastIndex], content: updated[lastIndex].content + chunk };
            return updated;
          });
        },
        () => setIsSending(false)
      );
    } catch {
      setIsSending(false);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Serverga ulanishda xatolik yuz berdi. Qayta urinib ko'r.",
        };
        return updated;
      });
    }
  }

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      {progress?.current_lesson_title && (
        <div className="mb-3 rounded-xl border border-neon-cyan/30 bg-surface/80 px-4 py-3 text-sm text-neon-cyan">
          Kecha <strong>{progress.current_lesson_title}</strong> mavzusida
          {progress.current_step ? <> "{progress.current_step}"</> : null} to&apos;xtagandik — davom etamiz.
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && todayTopic && (
          <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-neon-cyan">Rejadagi bugungi dars</p>
            <p className="font-semibold text-white">{todayTopic}</p>
            <button
              onClick={() => handleSend(lessonStartMessage(todayTopic))}
              disabled={isSending}
              className="w-full rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Darsni boshlash
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className={`${todayTopic ? "mt-4" : "mt-10"} text-center text-gray-500`}>
            {SUBJECT_LABELS[subject]} bo&apos;yicha savolingizni yozing. AI Ustoz sizni tinglayapti.
          </p>
        )}
        {messages.map((message, index) => {
          const isStreamingThisMessage = isSending && index === messages.length - 1;
          return (
            <MessageBubble
              key={index}
              message={message}
              isStreaming={isStreamingThisMessage}
              onGenerateAudio={
                message.role === "assistant" && !isStreamingThisMessage ? handleGenerateAudio : undefined
              }
            />
          );
        })}
      </div>

      {onRequestHomework && messages.length >= MESSAGES_BEFORE_HOMEWORK && !isSending && (
        <button
          onClick={onRequestHomework}
          className="mt-2 self-center rounded-full border border-neon-pink/50 px-4 py-1.5 text-xs font-semibold text-neon-pink"
        >
          Darsni tugatdim — uyga vazifa olish
        </button>
      )}

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Savolingizni shu yerga yozing..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-neon-violet/30 bg-surface px-4 py-3 text-sm text-gray-100 outline-none focus:border-neon-cyan"
        />
        <button
          onClick={() => handleSend()}
          disabled={isSending}
          className="rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Yuborish
        </button>
      </div>
    </div>
  );
}
