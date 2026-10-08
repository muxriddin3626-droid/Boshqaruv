import type {
  AudioLecture,
  BlitzAnswerResult,
  BlitzResult,
  BlitzStart,
  DrillResponse,
  DuelAnswerResult,
  DuelState,
  Flashcard,
  FlashcardReviewResult,
  Homework,
  HomeworkSubmitPayload,
  HomeworkSummary,
  Leaderboard,
  LeaderboardPeriod,
  LeaderboardScope,
  LoginResult,
  MatchingResult,
  MatchingStart,
  MillionerAnswerResult,
  MillionerState,
  MyStats,
  OnboardingPayload,
  OnboardingResult,
  PendingFlashcardReview,
  PendingTestResult,
  PlacementQuestion,
  PlanSettingsPayload,
  ProgressResponse,
  RadarPoint,
  StudyPlan,
  Subject,
  SubjectChoice,
  SyncPushResult,
  TestCatalog,
  TestCreatePayload,
  TestResult,
  TestSession,
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

// ---------------------------------------------------------------------------
// MODUL 8: Audio Lecture Engine
// ---------------------------------------------------------------------------

export async function generateAudioLecture(
  token: string,
  subject: Subject,
  lectureTitle: string,
  lectureText: string,
  lectureSummary?: string,
  voice = "onyx"
): Promise<AudioLecture> {
  const response = await fetch(`${API_BASE_URL}/api/v1/audio-lectures/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      subject,
      lecture_title: lectureTitle,
      lecture_text: lectureText,
      lecture_summary: lectureSummary ?? null,
      voice,
    }),
  });
  return (await assertOk(response, "Audio ma'ruza generatsiya qilib bo'lmadi")).json();
}

export async function fetchAudioLectures(token: string, subject?: Subject): Promise<AudioLecture[]> {
  const query = subject ? `?subject=${subject}` : "";
  const response = await fetch(`${API_BASE_URL}/api/v1/audio-lectures${query}`, {
    headers: authHeaders(token),
  });
  return (await assertOk(response, "Audio kutubxonani olib bo'lmadi")).json();
}

export async function setAudioLectureSaved(token: string, lectureId: string, isSaved: boolean): Promise<AudioLecture> {
  const response = await fetch(`${API_BASE_URL}/api/v1/audio-lectures/${lectureId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ is_saved: isSaved }),
  });
  return (await assertOk(response, "Audio ma'ruza holatini yangilab bo'lmadi")).json();
}

export async function deleteAudioLecture(token: string, lectureId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/audio-lectures/${lectureId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  await assertOk(response, "Audio ma'ruzani o'chirib bo'lmadi");
}

export async function fetchPlacementTest(subjects: SubjectChoice): Promise<PlacementQuestion[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/onboarding/placement-test?subjects=${subjects}`);
  return (await assertOk(response, "Kirish testini yuklab bo'lmadi")).json();
}

/** Backend `detail` xabarini (masalan "raqam band") foydalanuvchiga ko'rsatish uchun ajratib oladi. */
async function errorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export async function submitOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "So'rovnomani yuborib bo'lmadi"));
  return response.json();
}

export async function loginWithPhone(phone: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "Kirib bo'lmadi. Qayta urinib ko'ring."));
  return response.json();
}

/** "90 123-45-67", "+998901234567" -> "901234567"; noto'g'ri bo'lsa null. */
export function phoneDigits(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) digits = digits.slice(3);
  return digits.length === 9 ? digits : null;
}

export async function fetchTestCatalog(): Promise<TestCatalog> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tests/catalog`);
  return (await assertOk(response, "Testlar ro'yxatini yuklab bo'lmadi")).json();
}

export async function createTest(token: string, payload: TestCreatePayload): Promise<TestSession> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tests`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "Testni boshlab bo'lmadi"));
  return response.json();
}

export async function fetchActiveTest(token: string): Promise<TestSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tests/active`, { headers: authHeaders(token) });
  return (await assertOk(response, "Faol testni tekshirib bo'lmadi")).json();
}

export async function fetchTest(token: string, attemptId: string): Promise<TestSession | TestResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tests/${attemptId}`, { headers: authHeaders(token) });
  return (await assertOk(response, "Testni yuklab bo'lmadi")).json();
}

export async function saveTestAnswer(
  token: string,
  attemptId: string,
  questionId: string,
  choice: number | null
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tests/${attemptId}/answers`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ question_id: questionId, choice }),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "Javobni saqlab bo'lmadi"));
}

export async function finishTest(token: string, attemptId: string): Promise<TestResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tests/${attemptId}/finish`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return (await assertOk(response, "Testni yakunlab bo'lmadi")).json();
}

export async function fetchMyStats(token: string): Promise<MyStats> {
  const response = await fetch(`${API_BASE_URL}/api/v1/leaderboard/me`, { headers: authHeaders(token) });
  return (await assertOk(response, "Natijalarni yuklab bo'lmadi")).json();
}

export async function fetchLeaderboard(token: string, period: LeaderboardPeriod, scope: LeaderboardScope): Promise<Leaderboard> {
  const query = new URLSearchParams({ period, scope });
  const response = await fetch(`${API_BASE_URL}/api/v1/leaderboard?${query}`, { headers: authHeaders(token) });
  return (await assertOk(response, "Reytingni yuklab bo'lmadi")).json();
}

async function postGame<T>(token: string, path: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/games${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorDetail(response, fallback));
  return response.json();
}

export const startMillioner = (token: string, subject: Subject) =>
  postGame<MillionerState>(token, "/millioner", { subject }, "O'yinni boshlab bo'lmadi");
export const answerMillioner = (token: string, id: string, choice: number) =>
  postGame<MillionerAnswerResult>(token, `/millioner/${id}/answer`, { choice }, "Javobni yuborib bo'lmadi");
export const millionerFifty = (token: string, id: string) =>
  postGame<MillionerState>(token, `/millioner/${id}/fifty`, undefined, "50/50 ishlamadi");
export const millionerHint = (token: string, id: string) =>
  postGame<{ hint: string }>(token, `/millioner/${id}/hint`, undefined, "Maslahat olib bo'lmadi");
export const walkAwayMillioner = (token: string, id: string) =>
  postGame<MillionerState>(token, `/millioner/${id}/walk-away`, undefined, "Xatolik yuz berdi");

export const startBlitz = (token: string, subject: Subject) =>
  postGame<BlitzStart>(token, "/blitz", { subject }, "O'yinni boshlab bo'lmadi");
export const answerBlitz = (token: string, id: string, questionId: string, isTrue: boolean) =>
  postGame<BlitzAnswerResult>(token, `/blitz/${id}/answer`, { question_id: questionId, is_true: isTrue }, "Javob yuborilmadi");
export const finishBlitz = (token: string, id: string) =>
  postGame<BlitzResult>(token, `/blitz/${id}/finish`, undefined, "Natijani olib bo'lmadi");

export const startMatching = (token: string, subject: Subject) =>
  postGame<MatchingStart>(token, "/matching", { subject }, "O'yinni boshlab bo'lmadi");
export const matchPair = (token: string, id: string, left: number, right: number) =>
  postGame<MatchingResult>(token, `/matching/${id}/match`, { left, right }, "Javob yuborilmadi");

async function duelRequest<T>(token: string, path: string, method: "GET" | "POST", body: unknown, fallback: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/duels${path}`, {
    method,
    headers: authHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorDetail(response, fallback));
  return response.json();
}

export const createDuel = (token: string, subject: Subject) =>
  duelRequest<DuelState>(token, "", "POST", { subject }, "Duel yaratib bo'lmadi");
export const joinDuel = (token: string, code: string) =>
  duelRequest<DuelState>(token, "/join", "POST", { code }, "Duelga qo'shilib bo'lmadi");
export const fetchDuel = (token: string, id: string) =>
  duelRequest<DuelState>(token, `/${id}`, "GET", undefined, "Duel holatini olib bo'lmadi");
export const answerDuel = (token: string, id: string, questionId: string, choice: number) =>
  duelRequest<DuelAnswerResult>(token, `/${id}/answer`, "POST", { question_id: questionId, choice }, "Javob yuborilmadi");
export const cancelDuel = (token: string, id: string) =>
  duelRequest<DuelState>(token, `/${id}/cancel`, "POST", undefined, "Bekor qilib bo'lmadi");

/** Reja hali tuzilmagan bo'lsa (eski akkaunt) — null. */
export async function fetchPlan(token: string): Promise<StudyPlan | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/plan`, { headers: authHeaders(token) });
  if (response.status === 404) return null;
  return (await assertOk(response, "O'quv rejani yuklab bo'lmadi")).json();
}

export async function updatePlan(token: string, payload: PlanSettingsPayload): Promise<StudyPlan> {
  const response = await fetch(`${API_BASE_URL}/api/v1/plan`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "Rejani saqlab bo'lmadi"));
  return response.json();
}

export async function fetchHomeworkList(token: string): Promise<HomeworkSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/homework`, { headers: authHeaders(token) });
  return (await assertOk(response, "Vazifalarni yuklab bo'lmadi")).json();
}

/** Shu fan bo'yicha ochiq vazifa bo'lsa — o'sha qaytadi, aks holda yangisi tuziladi. */
export async function assignHomework(token: string, subject: Subject, topic?: string): Promise<Homework> {
  const response = await fetch(`${API_BASE_URL}/api/v1/homework`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ subject, topic: topic ?? null }),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "Vazifa olib bo'lmadi"));
  return response.json();
}

export async function fetchHomework(token: string, id: string): Promise<Homework> {
  const response = await fetch(`${API_BASE_URL}/api/v1/homework/${id}`, { headers: authHeaders(token) });
  return (await assertOk(response, "Vazifani yuklab bo'lmadi")).json();
}

export async function submitHomework(token: string, id: string, payload: HomeworkSubmitPayload): Promise<Homework> {
  const response = await fetch(`${API_BASE_URL}/api/v1/homework/${id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await errorDetail(response, "Vazifani yuborib bo'lmadi"));
  return response.json();
}
