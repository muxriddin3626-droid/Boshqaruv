/**
 * OpenAI Realtime data channel hodisalarini UI holatiga aylantiradi.
 * React'ga bog'liq emas — komponent faqat qaytgan `RealtimeUpdate`ni qo'llaydi.
 */

export const EMOTIONS = ["neutral", "thinking", "happy", "laughing", "shocked", "angry"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export type Phase = "listening" | "thinking" | "speaking";

export interface RealtimeUpdate {
  emotion?: Emotion;
  phase?: Phase;
  captionReset?: boolean;
  captionAppend?: string;
  error?: string;
  /** Data channel orqali OpenAI'ga yuboriladigan javob hodisalari. */
  send: Record<string, unknown>[];
}

// Model faqat `set_emotion` chaqirib, gapirmasdan javobni tugatsa, uni gapirtirish
// uchun yangi javob so'raladi. Model har safar yana faqat funksiya chaqirsa,
// cheksiz aylanib qolmasligi uchun ketma-ket so'rovlar soni cheklanadi.
const MAX_CONSECUTIVE_FOLLOW_UPS = 2;

function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (EMOTIONS as readonly string[]).includes(value);
}

function parseEmotion(rawArguments: unknown): Emotion | null {
  if (typeof rawArguments !== "string") return null;
  try {
    const parsed = JSON.parse(rawArguments) as { emotion?: unknown };
    return isEmotion(parsed.emotion) ? parsed.emotion : null;
  } catch {
    return null;
  }
}

interface OutputItem {
  type?: string;
}

type ServerEvent = Record<string, any>;

export function createRealtimeEventHandler() {
  let consecutiveFollowUps = 0;

  return function handle(event: ServerEvent): RealtimeUpdate {
    switch (event.type) {
      case "response.function_call_arguments.done": {
        const emotion = event.name === "set_emotion" ? parseEmotion(event.arguments) : null;
        return {
          ...(emotion ? { emotion } : {}),
          // Har qanday funksiya chaqiruviga javob qaytariladi, aks holda model kutib qoladi.
          send: [
            {
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ ok: !!emotion }) },
            },
          ],
        };
      }

      case "response.done": {
        const response = event.response ?? {};
        const output: OutputItem[] = Array.isArray(response.output) ? response.output : [];
        const calledTool = output.some((item) => item.type === "function_call");
        const spoke = output.some((item) => item.type === "message");

        if (spoke) consecutiveFollowUps = 0;
        const shouldFollowUp =
          calledTool && !spoke && response.status !== "cancelled" && consecutiveFollowUps < MAX_CONSECUTIVE_FOLLOW_UPS;
        if (shouldFollowUp) {
          consecutiveFollowUps += 1;
          return { send: [{ type: "response.create" }] };
        }
        return { phase: "listening", send: [] };
      }

      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta":
        return { phase: "speaking", captionAppend: String(event.delta ?? ""), send: [] };

      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done":
        return { send: [] };

      case "response.created":
        return { phase: "thinking", captionReset: true, send: [] };

      case "input_audio_buffer.speech_started":
        // O'quvchi gapira boshladi: uning gapi tugaguncha yangi javob ketma-ketligi hisoblanmaydi.
        consecutiveFollowUps = 0;
        return { phase: "listening", send: [] };

      case "input_audio_buffer.speech_stopped":
        return { phase: "thinking", send: [] };

      case "error":
        return { error: String(event.error?.message ?? "Ovozli aloqada xatolik"), send: [] };

      default:
        return { send: [] };
    }
  };
}
