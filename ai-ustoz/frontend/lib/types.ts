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

// ---------------------------------------------------------------------------
// MODUL 8: Audio Lecture Engine
// ---------------------------------------------------------------------------

export interface AudioLecture {
  id: string;
  subject: Subject;
  grade: number | null;
  lecture_title: string;
  lecture_summary: string | null;
  audio_url: string;
  duration_seconds: number;
  is_saved: boolean;
  created_at: string;
}

export type SubjectChoice = Subject | "ikkalasi";
export type TargetExam = "dtm" | "milliy_sertifikat" | "ikkalasi";
export type CertLevel = "A+" | "A" | "B+" | "B" | "C+" | "C";
export type SelfLevel = "boshlangich" | "orta" | "yuqori";

export interface PlacementQuestion {
  id: string;
  subject: Subject;
  category: string;
  question: string;
  options: string[];
}

export interface OnboardingPayload {
  full_name: string;
  phone: string;
  password: string;
  current_grade: number;
  is_graduate: boolean;
  subjects: SubjectChoice;
  target_exam: TargetExam;
  target_score: number | null;
  target_cert_level: CertLevel | null;
  target_university: string | null;
  self_level: SelfLevel;
  exam_month: string | null;
  daily_study_minutes: number;
  study_months: number;
  study_days_per_week: number;
  placement_answers: Record<string, number>;
}

export interface OnboardingResult {
  access_token: string;
  user_id: string;
  placement: { subject: Subject; correct: number; total: number }[];
  plan_weeks: number;
  first_topic: string | null;
}

export interface LoginResult {
  access_token: string;
  full_name: string;
  subjects: SubjectChoice;
}

export type TestKind = "dtm_mock" | "topic" | "milliy_sertifikat";

export interface CatalogTopic {
  category: string;
  topic: string;
}

export interface TestCatalog {
  topics: Record<Subject, CatalogTopic[]>;
  dtm_questions_per_subject: number;
  dtm_first_weight: number;
  dtm_second_weight: number;
  dtm_seconds_per_question: number;
  ms_question_count: number;
  ms_seconds_per_question: number;
  ms_is_official: boolean;
}

export interface TestCreatePayload {
  kind: TestKind;
  subject?: Subject;
  topic?: string;
  question_count?: 10 | 20;
  first_subject?: Subject;
  dtm_blocks?: "both" | "first" | "second";
}

export interface TestQuestion {
  id: string;
  subject: Subject;
  topic: string;
  question: string;
  options: string[];
}

export interface TestSession {
  attempt_id: string;
  kind: TestKind;
  subject: string;
  topic: string | null;
  status: "active";
  questions: TestQuestion[];
  answers: Record<string, number>;
  deadline_at: string;
  server_now: string;
  max_score: number;
}

export interface TestReviewItem {
  question_id: string;
  subject: Subject;
  topic: string;
  question: string;
  options: string[];
  chosen: number | null;
  correct_index: number;
  explanation: string;
}

export interface TestResult {
  attempt_id: string;
  kind: TestKind;
  subject: string;
  status: "finished";
  score: number;
  max_score: number;
  percent: number;
  correct_count: number;
  total: number;
  xp_earned: number;
  duration_seconds: number;
  per_subject: { subject: Subject; correct: number; total: number; score: number; max_score: number }[];
  per_topic: { subject: Subject; category: string; topic: string; correct: number; total: number }[];
  review: TestReviewItem[];
  ms_level: string | null;
  ms_is_official: boolean;
}

export interface MyStats {
  xp_total: number;
  week_xp: number;
  streak: number;
  longest_streak: number;
}

export interface MillionerQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  removed: number[];
}

export interface MillionerState {
  attempt_id: string;
  status: "active" | "finished";
  level: number;
  prize_ladder: number[];
  safe_levels: number[];
  lifelines: { fifty: boolean; hint: boolean };
  question: MillionerQuestion | null;
  prize: number;
  won: boolean;
  xp_earned: number;
}

export interface MillionerAnswerResult {
  correct: boolean;
  correct_index: number;
  explanation: string;
  game: MillionerState;
}

export interface BlitzStart {
  attempt_id: string;
  statements: { id: string; topic: string; text: string }[];
  deadline_at: string;
  server_now: string;
}

export interface BlitzAnswerResult {
  correct: boolean;
  statement_is_true: boolean;
  points: number;
  combo: number;
  multiplier: number;
  score: number;
}

export interface BlitzResult {
  score: number;
  correct: number;
  wrong: number;
  best_combo: number;
  xp_earned: number;
}

export interface MatchingStart {
  attempt_id: string;
  title: string;
  topic: string;
  left: string[];
  right: string[];
  deadline_at: string;
  server_now: string;
}

export interface MatchingResult {
  correct: boolean;
  matched: [number, number][];
  mistakes: number;
  finished: boolean;
  time_is_up: boolean;
  xp_earned: number;
  explanation: string | null;
}

export interface DuelPlayer {
  name: string;
  answered: number;
  correct: number;
  finished: boolean;
  seconds: number | null;
}

export interface DuelQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  /** Faqat duel tugagandan keyin keladi. */
  correct_index: number | null;
}

export interface DuelState {
  id: string;
  code: string;
  subject: Subject;
  status: "waiting" | "active" | "finished" | "cancelled" | "expired";
  is_host: boolean;
  me: DuelPlayer;
  opponent: DuelPlayer | null;
  questions: DuelQuestion[];
  my_answers: Record<string, number>;
  deadline_at: string | null;
  server_now: string;
  result: "win" | "loss" | "draw" | null;
  xp_earned: number;
}

export interface DuelAnswerResult {
  correct: boolean;
  correct_index: number;
  explanation: string;
  duel: DuelState;
}

export type LeaderboardPeriod = "week" | "all";
export type LeaderboardScope = "all" | "grade";

export interface LeaderboardRow {
  rank: number;
  name: string;
  grade: number;
  xp: number;
  streak: number;
  is_me: boolean;
}

export interface Leaderboard {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  rows: LeaderboardRow[];
  my_rank: number;
  my_xp: number;
}

export interface PlanSettingsPayload {
  study_months: number;
  study_days_per_week: number;
  daily_study_minutes: number;
}

export interface PlanTopic {
  subject: Subject;
  category: string;
  topic: string;
  grade: number;
  is_new: boolean;
  minutes: number;
  first_week: number | null;
  last_week: number | null;
  completed: boolean;
  percent: number | null;
}

export interface PlanWeek {
  week: number;
  kind: "study" | "revision";
  items: { subject: Subject; topic: string; minutes: number; completed: boolean }[];
}

export interface StudyPlan {
  study_months: number;
  effective_months: number;
  days_per_week: number;
  daily_minutes: number;
  weekly_minutes: number;
  start_date: string;
  exam_month: string | null;
  total_weeks: number;
  current_week: number;
  status: "on_track" | "behind" | "ahead" | "done";
  behind_weeks: number;
  is_tight: boolean;
  suggested_daily_minutes: number | null;
  completed_count: number;
  topic_count: number;
  current: PlanTopic | null;
  lesson_outline: { label: string; minutes: number }[];
  topics: PlanTopic[];
  weeks: PlanWeek[];
}

export interface HomeworkStep {
  step: string;
  ok: boolean;
  comment: string;
}

export interface HomeworkProblemReview {
  problem: string;
  answer: string;
  solution_steps: string[];
  score: number;
  max_score: number;
  final_answer_correct: boolean;
  steps: HomeworkStep[];
  mistake: string;
  comment: string;
  has_photo: boolean;
}

export interface HomeworkMcqReview {
  question_id: string;
  question: string;
  options: string[];
  choice: number | null;
  correct_index: number;
  correct: boolean;
  explanation: string;
}

export interface Homework {
  id: string;
  subject: Subject;
  category: string;
  topic: string;
  status: "assigned" | "checked";
  assigned_at: string;
  due_at: string;
  is_overdue: boolean;
  questions: { id: string; question: string; options: string[] }[];
  problems: string[];
  submissions: { text: string; has_photo: boolean }[] | null;
  result: { percent: number; mcq: HomeworkMcqReview[]; problems: HomeworkProblemReview[] } | null;
  score: number | null;
  max_score: number | null;
  xp_earned: number;
  is_late: boolean;
  checked_at: string | null;
  server_now: string;
}

export interface HomeworkSummary {
  id: string;
  subject: Subject;
  topic: string;
  status: "assigned" | "checked";
  assigned_at: string;
  due_at: string;
  is_overdue: boolean;
  percent: number | null;
  xp_earned: number;
}

export interface HomeworkSubmitPayload {
  mcq_answers: Record<string, number>;
  solutions: { text: string; photo: string | null }[];
}

export interface LectureProgress {
  position_seconds: number;
  completed: boolean;
  listen_count: number;
}

export interface Lecture {
  id: string;
  subject: Subject;
  category: string;
  topic: string;
  title: string | null;
  status: "generating" | "ready" | "failed";
  sections: { title: string; markdown: string; start_seconds: number }[];
  audio_url: string | null;
  duration_seconds: number;
  progress: LectureProgress | null;
}

export interface LectureCatalogItem {
  category: string;
  topic: string;
  lecture_id: string | null;
  status: "none" | "generating" | "ready" | "failed";
  duration_seconds: number;
  progress: LectureProgress | null;
}

export interface LectureCatalog {
  subject: Subject;
  grade_band: number;
  items: LectureCatalogItem[];
}

export interface IllustrationState {
  id: string;
  status: "generating" | "ready" | "failed";
  image_url: string | null;
}
