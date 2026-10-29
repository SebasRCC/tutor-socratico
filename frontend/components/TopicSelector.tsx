
interface Objective {
  id: string;
  label: string;
}

interface Topic {
  id: string;
  label: string;
  description?: string;
  objectives: Objective[];
}

interface TopicSelectorProps {
  topics: Topic[];
  selectedTopic: string;
  selectedObjective: string;
  error: string;
  onTopicChange: (topicId: string) => void;
  onObjectiveChange: (objectiveId: string) => void;
  onStart: () => void;
  onBack: () => void;
}

export default function TopicSelector({
  topics,
  selectedTopic,
  selectedObjective,
  error,
  onTopicChange,
  onObjectiveChange,
  onStart,
  onBack,
}: TopicSelectorProps) {
  const currentTopic = topics.find(
    (topic) => topic.id === selectedTopic
  );

  return (
    <div className="workflow-container">
      <button className="back-link" onClick={onBack}>
        ← Volver al material
      </button>

      <h1 className="page-title">PASO 02 · ELIGE TU DIRECCIÓN</h1>
      <p className="page-description">
        El aprendizaje funciona mejor cuando tienes una meta clara.
        Escoge el tema que más te interese y define tu objetivo.
      </p>

      <div className="topic-grid">
        {topics.map((topic, index) => (
          <button
            key={topic.id}
            className={`topic-card ${
              selectedTopic === topic.id ? "topic-selected" : ""
            }`}
            onClick={() => onTopicChange(topic.id)}
          >
            <span className={`topic-symbol topic-symbol-${index}`}>
              {["◈", "↗", "✳"][index % 3]}
            </span>
            <span className="topic-check">
              {selectedTopic === topic.id ? "✓" : "+"}
            </span>
            <strong>{topic.label}</strong>
            <span>{topic.description ?? "Explora este tema y sus objetivos de aprendizaje."}</span>
          </button>
        ))}
      </div>

      {currentTopic && (
        <div className="objective-panel">
          <h3>Define tu objetivo</h3>
          <p>¿Qué te gustaría conseguir al estudiar este tema?</p>

          <div className="objective-list">
            {currentTopic.objectives.map((objective) => (
              <label
                className={`objective-option ${
                  selectedObjective === objective.id
                    ? "objective-selected"
                    : ""
                }`}
                key={objective.id}
              >
                <input
                  type="radio"
                  name="objective"
                  value={objective.id}
                  checked={selectedObjective === objective.id}
                  onChange={() => onObjectiveChange(objective.id)}
                />
                <span className="radio-visual" />
                <span>{objective.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      <div className="workflow-footer">

        <button
          className="primary-button"
          disabled={!selectedTopic || !selectedObjective}
          onClick={onStart}
        >
          Iniciar tutoría <span>→</span>
        </button>
      </div>
    </div>
  );
}
