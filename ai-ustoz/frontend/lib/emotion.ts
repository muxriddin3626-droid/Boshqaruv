import { EMOTIONS, type Emotion } from "@/components/voice/realtimeEvents";

const TAG = /^\s*\[([a-z]{3,10})\]\s*/;

/**
 * Ustoz javobi boshidagi kayfiyat tegini ajratadi: "[happy] Barakalla!" -> happy + "Barakalla!".
 * Oqim (stream) davomida teg hali to'liq kelmagan bo'lsa ("[hap"), matn bo'sh ko'rsatiladi.
 */
export function splitEmotion(content: string): { emotion: Emotion | null; body: string } {
  const match = content.match(TAG);
  if (match) {
    const emotion = (EMOTIONS as readonly string[]).includes(match[1]) ? (match[1] as Emotion) : null;
    return { emotion, body: content.slice(match[0].length) };
  }
  if (/^\s*\[[a-z]{0,10}$/.test(content)) return { emotion: null, body: "" };
  return { emotion: null, body: content };
}
