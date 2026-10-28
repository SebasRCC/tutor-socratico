
interface TutorQuestion {
  message: string;
  options: string[];
}

interface TutorHistoryItem {
  question: string;
  answer: string;
}

interface TutorPanelProps {
  question: TutorQuestion;
  history: TutorHistoryItem[];
  questionIndex: number;
  feedback: string;
  topicLabel: string;
  objectiveLabel: string;
  onAnswer: (option: string) => void;
  onClearFeedback: () => void;
  onReset: () => void;
}

export default function TutorPanel({
  question,
  history,
  questionIndex,
  feedback,
  topicLabel,
  objectiveLabel,
  onAnswer,
  onClearFeedback,
  onReset,
}: TutorPanelProps) {
  const progress = Math.min(history.length * 20, 100);

  return (
    <div className="tutor-container">
      <div className="tutor-heading">
        <div>
          <span className="eyebrow">
            PASO 03 · EXPLOREMOS JUNTOS
          </span>
          <h1 className="page-title">Tu espacio para pensar.</h1>
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
              </div>
            ))}

            {/* Retroalimentación de la última respuesta */}
            {feedback && (
              <div className="chat-message tutor-message">
                <div className="chat-avatar">✳</div>
                <div className="chat-message-content">
                  <span className="chat-author">
                    Tutor socrático · Reflexión
                  </span>
                  <div className="chat-bubble feedback-bubble">
                    <strong>Sigamos profundizando</strong>
                    <p>{feedback}</p>
                    <button
                      className="text-button"
                      onClick={onClearFeedback}
                    >
                      Continuar reflexionando →
                    </button>
                  </div>
                </div>
              </div>
            )}

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

          <div className="reflection-card">
            <span className="reflection-icon">✳</span>
            <h3>Un recordatorio</h3>
            <p>
              No busques solamente acertar. Piensa por qué una
              opción tiene sentido para ti.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
