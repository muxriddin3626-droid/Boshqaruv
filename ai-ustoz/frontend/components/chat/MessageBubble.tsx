"use client";

import clsx from "clsx";
import { useState } from "react";

import type { ChatMessage } from "@/lib/types";

import MarkdownRenderer from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: ChatMessage;
  /** MODUL 8: berilsa, assistant xabarlari ostida "Audio qilish" tugmasi chiqadi. */
  onGenerateAudio?: (content: string) => Promise<void>;
}

export default function MessageBubble({ message, onGenerateAudio }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  async function handleGenerateAudio() {
    if (!onGenerateAudio || isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      await onGenerateAudio(message.content);
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
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <MarkdownRenderer content={message.content} />
            {onGenerateAudio && message.content && (
              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio}
                className="mt-2 text-xs text-neon-cyan underline disabled:opacity-50"
              >
                {isGeneratingAudio ? "Audio tayyorlanmoqda..." : "Audio qilish"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
