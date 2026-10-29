// dto/tutor-response.dto.ts
export interface TutorResponseDto {
  sessionId: string;
  feedback: string | null;
  turn: {
    turnId: string;
    message: string;
    options: { id: string; label: string }[];
    sources: {
      sourceId: string;
      name: string;
      chunkId: string;
    }[];
  };
}