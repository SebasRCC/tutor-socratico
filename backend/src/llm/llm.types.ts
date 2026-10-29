export interface GeneratedTopic {
  label: string;
  objectives: { label: string }[];
}

export interface TutorInput {
  operation: 'PRIMERA_INTERVENCION' | 'PROCESAR_RESPUESTA';
  topic: string;
  objective: string;
  fragments: string[];
  history?: { role: 'user' | 'assistant'; content: string }[];
  currentTurn?: {
    turnId: string;
    message: string;
    options: { id: string; label: string }[];
  };
  selectedOption?: { id: string; text: string };
}
