
"use client";

import { useState } from "react";

import FileUploader from "@/components/FileUploader";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import TopicSelector from "@/components/TopicSelector";
import TutorPanel from "@/components/TutorPanel";
import WelcomeScreen from "@/components/WelcomeScreen";

import {
  createSession,
  getTopics,
  sendTutorResponse,
  startLearningGoal,
  uploadSource,
} from "@/lib/api";

import type {
  Stage,
  Topic,
  TutorHistoryItem,
  TutorTurn,
} from "@/types/tutor";

export default function Home() {
  // Estado de la sesión y del tutor
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState<TutorTurn | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Estado de la interfaz
  const [stage, setStage] = useState<Stage>("welcome");
  const [file, setFile] = useState<File | null>(null);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedObjective, setSelectedObjective] = useState("");
  const [history, setHistory] = useState<TutorHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentTopic = topics.find(
    (topic) => topic.id === selectedTopic,
  );

  // Selección y validación del archivo
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

  // Crear sesión, subir material y obtener temas

  async function handleContinueUpload() {
    if (!file) {
      setError("Selecciona un archivo Markdown para continuar.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const session = await createSession();
      setSessionId(session.sessionId);

      await uploadSource(session.sessionId, file);

      const result = await getTopics(session.sessionId);
      setTopics(result.topics);

      setSelectedTopic("");
      setSelectedObjective("");
      setStage("topics");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo preparar la sesión.",
      );
    } finally {
      setLoading(false);
    }
  }


  // Iniciar la tutoría con el tema y objetivo elegidos

  async function startTutor() {
    if (!sessionId || !selectedTopic || !selectedObjective) {
      setError("Selecciona un tema y un objetivo para continuar.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await startLearningGoal(
        sessionId,
        selectedTopic,
        selectedObjective,
      );

      setCurrentTurn(result.turn);
      setHistory([]);
      setStage("tutor");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la tutoría.",
      );
    } finally {
      setLoading(false);
    }
  }


  // Enviar una respuesta y recibir la siguiente pregunta
  async function answerQuestion(optionLabel: string) {
    if (!sessionId || !currentTurn || loading) return;

    const answeredTurn = currentTurn;

    const selectedOption = answeredTurn.options.find(
      (option) => option.label === optionLabel,
    );

    if (!selectedOption) {
      setError("No se encontró la opción seleccionada.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await sendTutorResponse(
        sessionId,
        answeredTurn.turnId,
        selectedOption.id,
      );

      setHistory((previous) => [
        ...previous,
        {
          question: answeredTurn.message,
          answer: selectedOption.label,
          feedback: result.feedback,
        },
      ]);

      setCurrentTurn(result.turn);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar la respuesta.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Reiniciar la aplicación

  function resetApp() {
    setStage("welcome");
    setSessionId(null);
    setCurrentTurn(null);
    setTopics([]);
    setFile(null);
    setSelectedTopic("");
    setSelectedObjective("");
    setHistory([]);
    setError("");
    setLoading(false);
  }


  return (
    <main className="app-shell">
      <Sidebar stage={stage} onReset={resetApp} />

      <section className="main-area">
        <Header stage={stage} />

        <div className="content">
          {stage === "welcome" && (
            <WelcomeScreen
              onStart={() => setStage("upload")}
            />
          )}

          {stage === "upload" && (
            <FileUploader
              file={file}
              error={error}
              loading={loading}
              onFileChange={handleFileChange}
              onCancel={() => {
                setError("");
                setStage("welcome");
              }}
              onContinue={handleContinueUpload}
            />
          )}

          {stage === "topics" && (
            <TopicSelector
              topics={topics}
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
              onBack={() => {
                setError("");
                setStage("upload");
              }}
            />
          )}


          {stage === "tutor" && currentTurn && (
            <TutorPanel
              question={{
                message: currentTurn.message,
                options: currentTurn.options.map((option) => option.label),
              }}
              history={history}
              questionIndex={history.length}
              topicLabel={currentTopic?.label ?? ""}
              objectiveLabel={
                currentTopic?.objectives.find(
                  (objective) => objective.id === selectedObjective,
                )?.label ?? ""
              }
              onAnswer={answerQuestion}
              onReset={resetApp}
            />
          )}


          {loading && (
            <p role="status">Preparando tu sesión...</p>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}


        </div>
      </section>
    </main>
  );
}
