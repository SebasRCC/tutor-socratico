
type Stage = "welcome" | "upload" | "topics" | "tutor";

interface SidebarProps {
  stage: Stage;
  onReset: () => void;
}

const steps = [
  { id: "upload", number: "01", label: "Material" },
  { id: "topics", number: "02", label: "Objetivo" },
  { id: "tutor", number: "03", label: "Aprendizaje" },
] as const;

export default function Sidebar({ stage, onReset }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        onClick={onReset}
        aria-label="Ir al inicio"
      >
        <span className="brand-icon">T</span>
        <span>
          <strong>ThinkAgora</strong>
        </span>
      </button>

      <div className="sidebar-label">TU ESPACIO</div>

      <button className="nav-item active" onClick={onReset}>
        <span className="nav-icon">⌂</span>
        Mi aprendizaje
      </button>

      <div className="sidebar-divider" />

      <div className="sidebar-label">SESIÓN ACTUAL</div>

      {steps.map((step, index) => {
        const active = stage === step.id;

        const completed =
          (step.id === "upload" &&
            (stage === "topics" || stage === "tutor")) ||
          (step.id === "topics" && stage === "tutor");

        return (
          <div className="step-row" key={step.id}>
            <span
              className={`step-number ${active ? "selected" : ""} ${
                completed ? "completed" : ""
              }`}
            >
              {completed ? "✓" : step.number}
            </span>

            <span className={active ? "step-active" : ""}>
              {step.label}
            </span>

            {index < steps.length - 1 && (
              <span className="step-line" />
            )}
          </div>
        );
      })}

      <div className="sidebar-spacer" />



      <div className="profile">
        <div className="avatar">E</div>
        <div>
          <strong>Estudiante</strong>
          <small>Sesión de aprendizaje</small>
        </div>
        <span className="profile-menu">···</span>
      </div>
    </aside>
  );
}
