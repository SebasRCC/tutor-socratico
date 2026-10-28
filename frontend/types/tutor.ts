
export type Stage = "welcome" | "upload" | "topics" | "tutor";

export interface Objective {
  id: string;
  label: string;
}

export interface Topic {
  id: string;
  label: string;
  description?: string;
  objectives: Objective[];
}

export interface TutorOption {
  id: string;
  label: string;
}

export interface TutorSource {
  sourceId: string;
  name: string;
  chunkId: string;
}

export interface TutorTurn {
  turnId: string;
  message: string;
  options: TutorOption[];
  sources: TutorSource[];
}

export interface TutorHistoryItem {
  question: string;
  answer: string;
  feedback: string;
}

export interface SessionResponse {
  sessionId: string;
}

export interface SourceResponse {
  sourceId: string;
  name: string;
  chunksCount: number;
}

export interface TopicsResponse {
  topics: Topic[];
}

export interface LearningGoalResponse {
  sessionId: string;
  feedback: string | null;
  turn: TutorTurn;
}

export interface TutorResponse {
  sessionId: string;
  feedback: string;
  turn: TutorTurn;
}
