export const EMBEDDING_DIMENSIONS = 1024;

export interface Chunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    heading: string;
    position: number;
    charCount: number;
  };
}

export interface IndexedChunk extends Chunk {
  sessionId: string;
  sourceId: string;
}
