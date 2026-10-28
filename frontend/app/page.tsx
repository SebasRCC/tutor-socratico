
"use client";

import Sidebar from "@/components/Sidebar";
import TopicSelector from "@/components/TopicSelector";
import TutorPanel from "@/components/TutorPanel";
import { useState } from "react";
import FileUploader from "../components/FileUploader";
import Header from "../components/Header";
import WelcomeScreen from "../components/WelcomeScreen";

type Stage = "welcome" | "upload" | "topics" | "tutor";

const demoTopics = [
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

const demoQuestions = [
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
      "Interesante. Ahora pensemos en tu explicación: ¿cómo comprobarías que ese concepto realmente se entiende?",
    options: [
      "Pediría que se explique la idea con otras palabras.",
      "Buscaría un caso donde el concepto no se cumpla.",
      "Repetiría la definición hasta memorizarla.",
    ],
  },
  {
    message:
      "Vamos un paso más allá. ¿Qué harías si encuentras un ejemplo que contradice tu explicación inicial?",
    options: [
      "Revisaría mis supuestos y buscaría nueva evidencia.",
      "Ignoraría el ejemplo porque no coincide con mi idea.",
      "Cambiaría mi conclusión sin analizar el caso.",
    ],
  },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [file, setFile] = useState<File | null>(null);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedObjective, setSelectedObjective] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<
    { question: string; answer: string; feedback: string }[]
  >([]);
  const [error, setError] = useState("");

  const currentTopic = demoTopics.find(
    (topic) => topic.id === selectedTopic,
  );

  const currentQuestion =
    demoQuestions[questionIndex % demoQuestions.length];

  function handleFileChange(selectedFile?: File) {
    setError("");

    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".md")) {
      setError("Por ahora solo aceptamos archivos con extensión .md.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }

  function startTutor() {
    if (!selectedTopic || !selectedObjective) {
      setError("Selecciona un tema y un objetivo para continuar.");
      return;
    }

    setError("");
    setFeedback("");
    setHistory([]);
    setQuestionIndex(0);
    setStage("tutor");
  }

  function answerQuestion(option: string) {
    const responseFeedback =
      "¡Gracias por compartir tu razonamiento! Lo importante no es solo elegir una respuesta, sino comprender por qué la eliges. Sigamos explorando la idea.";

    setHistory((previous) => [
      ...previous,
      {
        question: currentQuestion.message,
        answer: option,
        feedback: responseFeedback,
      },
    ]);

    setFeedback(responseFeedback);
    setQuestionIndex((previous) => previous + 1);
  }

  function resetApp() {
    setStage("welcome");
    setFile(null);
    setSelectedTopic("");
    setSelectedObjective("");
    setQuestionIndex(0);
    setFeedback("");
    setHistory([]);
    setError("");
  }


  return (
    <main className="app-shell">
    <Sidebar stage={stage} onReset={resetApp} />

      <section className="main-area">
      <Header stage={stage} />

        <div className="content">
          {stage === "welcome" && (
            <WelcomeScreen onStart={() => setStage("upload")} />
          )}

          {stage === "upload" && (
            <FileUploader
              file={file}
              error={error}
              onFileChange={handleFileChange}
              onCancel={() => setStage("welcome")}
              onContinue={() => {
                setError("");
                setStage("topics");
              }}
            />
          )}

          {stage === "topics" && (
            <TopicSelector
              topics={demoTopics}
              selectedTopic={selectedTopic}
              selectedObjective={selectedObjective}
              error={error}
              onTopicChange={(topicId) => {
                setSelectedTopic(topicId);
                setSelectedObjective("");
                setError("");
              }}
              onObjectiveChange={setSelectedObjective}
              onStart={startTutor}
              onBack={() => setStage("upload")}
            />
          )}

          {stage === "tutor" && (
            <TutorPanel
              question={currentQuestion}
              history={history}
              questionIndex={questionIndex}
              feedback={feedback}
              topicLabel={currentTopic?.label ?? ""}
              objectiveLabel={
                currentTopic?.objectives.find(
                  (objective) => objective.id === selectedObjective
                )?.label ?? ""
              }
              onAnswer={answerQuestion}
              onClearFeedback={() => setFeedback("")}
              onReset={resetApp}
            />
          )}

          <footer className="app-footer">
            <span>SOCRIA © 2026</span>
            <span>Hecho para aprender pensando <span className="footer-star">✳</span></span>
          </footer>
        </div>
      </section>
    </main>
  );
}
