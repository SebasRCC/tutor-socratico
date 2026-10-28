
import type {
    LearningGoalResponse,
    SessionResponse,
    SourceResponse,
    Topic,
    TopicsResponse,
    TutorResponse,
    TutorTurn
} from "@/types/tutor";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const USE_MOCK_API =
  process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Error de API: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Datos simulados para trabajar antes de que exista el backend.

const mockTopics: Topic[] = [
  {
    id: "t1",
    label: "Fundamentos del tema",
    description: "Comprende las ideas esenciales y sus relaciones.",
    objectives: [
      { id: "o1", label: "Explicar los conceptos principales" },
      { id: "o2", label: "Relacionar conceptos con ejemplos" },
    ],
  },
  {
    id: "t2",
    label: "Aplicación práctica",
    description: "Lleva la teoría a situaciones concretas.",
    objectives: [
      { id: "o3", label: "Resolver un caso práctico" },
      { id: "o4", label: "Justificar una solución" },
    ],
  },
  {
    id: "t3",
    label: "Análisis y reflexión",
    description: "Profundiza, compara y evalúa ideas.",
    objectives: [
      { id: "o5", label: "Comparar diferentes perspectivas" },
      { id: "o6", label: "Argumentar una conclusión" },
    ],
  },
];

const mockQuestions = [
  {
    message:
      "Imagina que debes explicar este concepto a alguien que nunca lo ha estudiado. ¿Qué idea considerarías indispensable para que pueda comprenderlo?",
    options: [
      "Empezaría por definir el concepto con mis propias palabras.",
      "Presentaría primero un ejemplo de la vida cotidiana.",
      "Explicaría directamente todos los detalles técnicos.",
    ],
  },
  {
    message:
      "Interesante. ¿Cómo comprobarías que esa explicación realmente se entiende?",
    options: [
      "Pediría que se explique la idea con otras palabras.",
      "Buscaría un caso donde el concepto no se cumpla.",
      "Repetiría la definición hasta memorizarla.",
    ],
  },
  {
    message:
      "¿Qué harías si encuentras un ejemplo que contradice tu explicación inicial?",
    options: [
      "Revisaría mis supuestos y buscaría nueva evidencia.",
      "Ignoraría el ejemplo porque no coincide con mi idea.",
      "Cambiaría mi conclusión sin analizar el caso.",
    ],
  },
];

function makeMockTurn(index: number): TutorTurn {
  const question = mockQuestions[index % mockQuestions.length];

  return {
    turnId: `mock-turn-${index + 1}`,
    message: question.message,
    options: question.options.map((label, optionIndex) => ({
      id: `mock-option-${index + 1}-${optionIndex + 1}`,
      label,
    })),
    sources: [],
  };
}

// 1. Crear una sesión
export async function createSession(): Promise<SessionResponse> {
  if (USE_MOCK_API) {
    return { sessionId: `mock-session-${Date.now()}` };
  }

  return request<SessionResponse>("/sessions", {
    method: "POST",
  });
}

// 2. Subir un archivo Markdown
export async function uploadSource(
  sessionId: string,
  file: File,
): Promise<SourceResponse> {
  if (USE_MOCK_API) {
    return {
      sourceId: "mock-source-1",
      name: file.name,
      chunksCount: 1,
    };
  }

  const formData = new FormData();
  formData.append("file", file);

  return request<SourceResponse>(
    `/sessions/${sessionId}/sources`,
    {
      method: "POST",
      body: formData,
    },
  );
}

// 3. Obtener temas
export async function getTopics(
  sessionId: string,
): Promise<TopicsResponse> {
  if (USE_MOCK_API) {
    return { topics: mockTopics };
  }

  return request<TopicsResponse>(
    `/sessions/${sessionId}/topics`,
  );
}

// 4. Iniciar el objetivo de aprendizaje
export async function startLearningGoal(
  sessionId: string,
  topicId: string,
  objectiveId: string,
): Promise<LearningGoalResponse> {
  if (USE_MOCK_API) {
    return {
      sessionId,
      feedback: null,
      turn: makeMockTurn(0),
    };
  }

  return request<LearningGoalResponse>(
    `/sessions/${sessionId}/learning-goal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, objectiveId }),
    },
  );
}

// 5. Enviar una opción elegida
export async function sendTutorResponse(
  sessionId: string,
  turnId: string,
  optionId: string,
): Promise<TutorResponse> {
  if (USE_MOCK_API) {
    const currentIndex = Number(
      turnId.replace("mock-turn-", ""),
    );

    return {
      sessionId,
      feedback:
        "¡Gracias por compartir tu razonamiento! Lo importante no es solo elegir una respuesta, sino comprender por qué la eliges. Sigamos explorando la idea.",
      turn: makeMockTurn(
        Number.isFinite(currentIndex) ? currentIndex : 0,
      ),
    };
  }

  return request<TutorResponse>(
    `/sessions/${sessionId}/responses`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnId, optionId }),
    },
  );
}
