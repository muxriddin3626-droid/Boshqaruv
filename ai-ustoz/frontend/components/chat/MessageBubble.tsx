import clsx from "clsx";

import type { ChatMessage } from "@/lib/types";

import MarkdownRenderer from "./MarkdownRenderer";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

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
          <MarkdownRenderer content={message.content} />
        )}
      </div>
    </div>
  );
}
