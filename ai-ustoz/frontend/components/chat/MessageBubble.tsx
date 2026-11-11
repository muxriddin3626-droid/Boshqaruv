"use client";

import clsx from "clsx";
import { useState } from "react";

import { splitEmotion } from "@/lib/emotion";
import type { ChatMessage } from "@/lib/types";
import { toSpeechText } from "@/lib/visuals/blocks";

import MarkdownRenderer from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: ChatMessage;
  /** MODUL 8: berilsa, assistant xabarlari ostida "Audio qilish" tugmasi chiqadi. */
  onGenerateAudio?: (content: string) => Promise<void>;
  /** Javob hali kelayotgan bo'lsa chizmalar chizilmaydi (blok chala bo'lishi mumkin). */
  isStreaming?: boolean;
  /** Ustoz javobini to'liq ovozda eshitish. */
  onSpeak?: (text: string) => void;
  onStopSpeaking?: () => void;
  speakState?: "idle" | "loading" | "speaking";
}

export default function MessageBubble({
  message,
  onGenerateAudio,
  isStreaming = false,
  onSpeak,
  onStopSpeaking,
  speakState = "idle",
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  // Javob boshidagi kayfiyat tegi ([happy] ...) yuzcha uchun — o'quvchiga ko'rsatilmaydi.
  const body = isUser ? message.content : splitEmotion(message.content).body;
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  async function handleGenerateAudio() {
    if (!onGenerateAudio || isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      // Chizma bloklari va formulalar ovozda o'qilmasin.
      await onGenerateAudio(toSpeechText(body));
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  return (
    <div className={clsx("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg",
          isUser
            ? "bg-gradient-to-br from-neon-violet to-neon-pink text-white"
            : "border border-neon-cyan/20 bg-surface text-gray-100"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">
            {message.voice && <span aria-label="Ovozli xabar">🎤 </span>}
            {message.content}
          </p>
        ) : (
          <>
            <MarkdownRenderer content={body} isStreaming={isStreaming} />
            {body && (onSpeak || onGenerateAudio) && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {onSpeak && (
                  <button
                    onClick={() => (speakState === "speaking" ? onStopSpeaking?.() : onSpeak(body))}
                    disabled={speakState === "loading"}
                    className="text-neon-cyan underline disabled:opacity-50"
                  >
                    {speakState === "speaking" ? "⏹ To'xtatish" : speakState === "loading" ? "Tayyorlanmoqda..." : "🔊 Eshitish"}
                  </button>
                )}
                {onGenerateAudio && (
                  <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="text-gray-400 underline disabled:opacity-50">
                    {isGeneratingAudio ? "Audio tayyorlanmoqda..." : "Ma'ruzalarga saqlash"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
