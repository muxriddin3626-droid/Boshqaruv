import type { ProgressResponse, Subject, VoiceSessionResponse } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Backendga xabar yuboradi va SSE oqimini o'qib, har bir matn bo'lagini
 * (delta) `onDelta` callback orqali qaytaradi. Oqim tugagach `onDone` chaqiriladi.
 */
export async function streamChatMessage(
  token: string,
  subject: Subject,
  message: string,
  onDelta: (chunk: string) => void,
  onDone: () => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, message }),
  });

  if (!response.body) {
    throw new Error("Server javob oqimini qaytarmadi");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: done")) {
        onDone();
        return;
      }
      if (line.startsWith("data: ")) {
        onDelta(line.slice("data: ".length));
      }
    }
  }
  onDone();
}

export async function fetchProgress(token: string, subject: Subject): Promise<ProgressResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/progress/${subject}`, {
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error("Progress ma'lumotini olib bo'lmadi");
  return response.json();
}

export async function createVoiceSession(token: string): Promise<VoiceSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/voice/session`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error("Ovozli sessiya yaratib bo'lmadi");
  return response.json();
}
