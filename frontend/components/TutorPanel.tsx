import type { TutorHistoryItem, TutorSource } from "@/types/tutor";

function ConsultedSources({ sources }: { sources: TutorSource[] }) {
  if (sources.length === 0) return null;

  const documents = new Map<string, { name: string; chunkIds: Set<string> }>();
  for (const source of sources) {
    const document = documents.get(source.sourceId) ?? {
      name: source.name,
      chunkIds: new Set<string>(),
    };
    document.chunkIds.add(source.chunkId);
    documents.set(source.sourceId, document);
  }

  return (
    <div className="chat-author">
      <p>
        Material consultado: {Array.from(documents.values()).map((document) =>
          `${document.name} · ${document.chunkIds.size} ${document.chunkIds.size === 1 ? "fragmento" : "fragmentos"}`,
        ).join("; ")}
      </p>
      <details>
        <summary>Ver fragmentos consultados</summary>
        {Array.from(documents.entries()).map(([sourceId, document]) => (
          <div key={sourceId}>
            <strong>{document.name}</strong>
            <ul>
              {Array.from(document.chunkIds).map((chunkId) => (
                <li key={chunkId} style={{ overflowWrap: "anywhere" }}>{chunkId}</li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </div>
  );
}

interface TutorQuestion {
  message: string;
  options: string[];
}

interface TutorPanelProps {
  question: TutorQuestion;
  history: TutorHistoryItem[];
  sources: TutorSource[];
  questionIndex: number;
  topicLabel: string;
  objectiveLabel: string;
  onAnswer: (option: string) => void;
  onReset: () => void;
}

export default function TutorPanel({
  question,
  history,
  sources,
  questionIndex,
  topicLabel,
  objectiveLabel,
  onAnswer,
  onReset,
}: TutorPanelProps) {
  const progress = Math.min(history.length * 20, 100);

  return (
    <div className="tutor-container">
      <div className="tutor-heading">
        <div>
          <h1 className="page-title">PASO 03 · EXPLOREMOS JUNTOS</h1>
          <p className="page-description">
            Cada respuesta abre una nueva pregunta. Construyamos
            tu aprendizaje juntos.
          </p>
        </div>

        <button className="secondary-button" onClick={onReset}>
          Terminar demo
        </button>
      </div>

      <div className="tutor-layout">
        <section className="conversation-card">
          <div className="conversation-header">
            <div className="tutor-avatar">✳</div>
            <div>
              <strong>Tu tutor socrático</strong>
              <small>
                <span className="status-dot" /> Acompañándote
              </small>
            </div>
            <span className="demo-label">DEMO</span>
          </div>

          <div className="chat-messages">
            {/* Mensaje inicial del tutor */}
            <div className="chat-message tutor-message">
              <div className="chat-avatar">✳</div>
              <div className="chat-message-content">
                <span className="chat-author">Tutor socrático</span>
                <div className="chat-bubble">
                  ¡Hola! Vamos a explorar{" "}
                  <strong>{topicLabel}</strong>. No necesitas
                  conocer todas las respuestas: iremos razonando
                  paso a paso.
                </div>
              </div>
            </div>

            {/* Conversaciones anteriores */}
            {history.map((item, index) => (
              <div className="chat-turn" key={`${index}-${item.question}`}>
                <div className="chat-message tutor-message">
                  <div className="chat-avatar">✳</div>
                  <div className="chat-message-content">
                    <span className="chat-author">
                      Tutor socrático
                    </span>
                    <div className="chat-bubble">
                      {item.question}
                    </div>
                    <ConsultedSources sources={item.sources} />
                  </div>
                </div>

                <div className="chat-message student-message">
                  <div className="chat-message-content">
                    <span className="chat-author">Tú</span>
                    <div className="chat-bubble">
                      {item.answer}
                    </div>
                  </div>
                  <div className="student-avatar">Tú</div>
                </div>
                {item.feedback && (
                  <div className="chat-message tutor-message">
                    <div className="chat-avatar">✳</div>
                    <div className="chat-message-content">
                      <span className="chat-author">Tutor socrático</span>
                      <div className="chat-bubble feedback-bubble">
                        <strong>Retroalimentación</strong>
                        <p>{item.feedback}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Pregunta actual */}
            <div className="chat-message tutor-message">
              <div className="chat-avatar">✳</div>
              <div className="chat-message-content">
                <span className="chat-author">
                  Tutor socrático
                </span>
                <div className="chat-bubble">
                  {question.message}
                </div>
                <ConsultedSources sources={sources} />
              </div>
            </div>

            {/* Opciones de respuesta de la pregunta actual */}
            <div className="chat-options">
              <span className="chat-options-label">
                ¿Qué piensas?
              </span>

              {question.options.map((option, index) => (
                <button
                  className="answer-option"
                  key={`${questionIndex}-${index}`}
                  onClick={() => onAnswer(option)}
                >
                  <span className="option-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                  <span className="option-arrow">↗</span>
                </button>
              ))}
            </div>
          </div>

          <div className="conversation-footer">
            <span>✦ Aprender también es cuestionar.</span>
            <span>{history.length} respuestas</span>
          </div>
        </section>

        <aside className="learning-sidebar">
          <div className="learning-card">
            <span className="eyebrow">TU OBJETIVO</span>
            <h3>{topicLabel}</h3>
            <p>{objectiveLabel}</p>

            <div className="learning-divider" />

            <div className="progress-heading">
              <span>Conversación</span>
              <strong>{history.length} respuestas</strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <small className="progress-caption">
              {history.length === 0
                ? "Tu recorrido comienza con una pregunta."
                : "Cada respuesta te ayuda a construir tu aprendizaje."}
            </small>
          </div>


        </aside>
      </div>
    </div>
  );
}
