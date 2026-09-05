import type {
  DrillResponse,
  Flashcard,
  FlashcardReviewResult,
  PendingFlashcardReview,
  PendingTestResult,
  ProgressResponse,
  RadarPoint,
  Subject,
  SyncPushResult,
  VoiceMode,
  VoiceSessionResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function assertOk(response: Response, errorMessage: string): Promise<Response> {
  if (!response.ok) throw new Error(errorMessage);
  return response;
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
  return (await assertOk(response, "Progress ma'lumotini olib bo'lmadi")).json();
}

export async function createVoiceSession(
  token: string,
  subject: Subject,
  mode: VoiceMode = "tutor"
): Promise<VoiceSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/voice/session`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, mode }),
  });
  return (await assertOk(response, "Ovozli sessiya yaratib bo'lmadi")).json();
}

// ---------------------------------------------------------------------------
// MODUL 1: Flashcards & Spaced Repetition
// ---------------------------------------------------------------------------

export async function fetchDueFlashcards(token: string, subject: Subject): Promise<Flashcard[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/flashcards/due?subject=${subject}`, {
    headers: authHeaders(token),
  });
  return (await assertOk(response, "Flashcard'larni olib bo'lmadi")).json();
}

export async function reviewFlashcard(
  token: string,
  flashcardId: string,
  remembered: boolean
): Promise<FlashcardReviewResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/flashcards/review`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ flashcard_id: flashcardId, remembered }),
  });
  return (await assertOk(response, "Flashcard natijasini saqlab bo'lmadi")).json();
}

// ---------------------------------------------------------------------------
// MODUL 3: Weakness Radar & Targeted Drill
// ---------------------------------------------------------------------------

export async function fetchWeaknessRadar(token: string, subject: Subject): Promise<RadarPoint[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/weakness/radar?subject=${subject}`, {
    headers: authHeaders(token),
  });
  return (await assertOk(response, "Weakness Radar ma'lumotini olib bo'lmadi")).json();
}

export async function requestTargetedDrill(
  token: string,
  subject: Subject,
  questionCount = 10
): Promise<DrillResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/weakness/drill`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, question_count: questionCount }),
  });
  return (await assertOk(response, "Maqsadli testni generatsiya qilib bo'lmadi")).json();
}

export async function submitTestResult(
  token: string,
  subject: Subject,
  testType: string,
  score: number,
  maxScore: number,
  details: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/progress/test-results`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, test_type: testType, score, max_score: maxScore, details }),
  });
  await assertOk(response, "Test natijasini saqlab bo'lmadi");
}

// ---------------------------------------------------------------------------
// MODUL 4: Auto-PDF Konspekt Generator
// ---------------------------------------------------------------------------

/** PDF konspektni backenddan olib, brauzerda yuklab olish oynasini ochadi. */
export async function downloadLessonConspect(token: string, subject: Subject, lessonTitle?: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/conspect/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, lesson_title: lessonTitle ?? null }),
  });
  await assertOk(response, "PDF konspekt generatsiya qilib bo'lmadi");

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ai-ustoz-konspekt-${subject}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// MODUL 5: Offline Sync
// ---------------------------------------------------------------------------

export async function pushOfflineSync(
  token: string,
  flashcardReviews: PendingFlashcardReview[],
  testResults: PendingTestResult[]
): Promise<SyncPushResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/sync/push`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ flashcard_reviews: flashcardReviews, test_results: testResults }),
  });
  return (await assertOk(response, "Offline ma'lumotlarni sinxronlab bo'lmadi")).json();
}
