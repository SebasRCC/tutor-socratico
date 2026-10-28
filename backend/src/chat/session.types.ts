import type { Conversation } from './conversation';
import type { TutorResponseDto } from './dto/session-responses.dto';

export interface Topic {
  id: string;
  label: string;
  objectives: { id: string; label: string }[];
}

export interface Session {
  sessionId: string;
  conversation: Conversation;
  topics: Topic[];
  topicId: string | null;
  objectiveId: string | null;
  currentTurn: TutorResponseDto['turn'] | null;
}
