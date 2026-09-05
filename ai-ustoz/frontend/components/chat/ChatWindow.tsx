"use client";

import { useEffect, useRef, useState } from "react";

import { fetchProgress, streamChatMessage } from "@/lib/api";
import type { ChatMessage, ProgressResponse, Subject } from "@/lib/types";

import MessageBubble from "./MessageBubble";

const SUBJECT_LABELS: Record<Subject, string> = {
  kimyo: "Kimyo",
  biologiya: "Biologiya",
};

export default function ChatWindow({ token, subject }: { token: string; subject: Subject }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProgress(token, subject)
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [token, subject]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);
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
    <div className="flex h-full flex-col">
      {progress?.current_lesson_title && (
        <div className="mb-3 rounded-xl border border-neon-cyan/30 bg-surface/80 px-4 py-3 text-sm text-neon-cyan">
          Kecha <strong>{progress.current_lesson_title}</strong> mavzusida
          {progress.current_step ? <> "{progress.current_step}"</> : null} to&apos;xtagandik — davom etamiz.
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-gray-500">
            {SUBJECT_LABELS[subject]} bo&apos;yicha savolingizni yozing. AI Ustoz sizni tinglayapti.
          </p>
        )}
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
      </div>

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
          onClick={handleSend}
          disabled={isSending}
          className="rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Yuborish
        </button>
      </div>
    </div>
  );
}
