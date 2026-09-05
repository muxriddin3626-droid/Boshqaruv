export type Subject = "kimyo" | "biologiya";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WeakSpot {
  topic: string;
  mistake_description: string;
  severity: number;
  resolved: boolean;
}

export interface ProgressResponse {
  subject: Subject;
  current_lesson_title: string | null;
  current_step: string | null;
  average_score: number | null;
  weak_spots: WeakSpot[];
}

export type VoiceMode = "tutor" | "debate";

export interface VoiceSessionResponse {
  client_secret: string;
  expires_at: number;
  model: string;
  mode: VoiceMode;
}

// ---------------------------------------------------------------------------
// MODUL 1: Flashcards & Spaced Repetition
// ---------------------------------------------------------------------------

export interface Flashcard {
  id: string;
  subject: Subject;
  front_text: string;
  back_text: string;
  next_review_at: string;
}

export interface FlashcardReviewResult {
  flashcard_id: string;
  stage: number;
  status: "active" | "mastered";
  next_review_at: string;
}

// ---------------------------------------------------------------------------
// MODUL 3: Weakness Radar & Targeted Drill
// ---------------------------------------------------------------------------

export interface RadarPoint {
  category: string;
  mastery_percentage: number;
  sample_size: number;
}

export interface DrillQuestion {
  category: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface DrillResponse {
  subject: Subject;
  target_categories: string[];
  questions: DrillQuestion[];
}

// ---------------------------------------------------------------------------
// MODUL 5: Offline Sync
// ---------------------------------------------------------------------------

export interface PendingFlashcardReview {
  client_action_id: string;
  flashcard_id: string;
  remembered: boolean;
  reviewed_at: string;
}

export interface PendingTestResult {
  client_action_id: string;
  subject: Subject;
  test_type: string;
  score: number;
  max_score: number;
  details: Record<string, unknown>;
  taken_at: string;
}

export interface SyncPushResult {
  applied: number;
  skipped_duplicate: number;
  failed: number;
}
