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

export interface VoiceSessionResponse {
  client_secret: string;
  expires_at: number;
  model: string;
}
