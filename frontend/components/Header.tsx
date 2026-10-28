
type Stage = "welcome" | "upload" | "topics" | "tutor";

interface HeaderProps {
  stage: Stage;
}

export default function Header({ stage }: HeaderProps) {
  const titles: Record<Stage, string> = {
    welcome: "Inicio",
    upload: "Material de estudio",
    topics: "Objetivo de aprendizaje",
    tutor: "Tutor socrático",
  };

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Mi aprendizaje</span>
        <span>/</span>
        <strong>{titles[stage]}</strong>
      </div>

      <div className="topbar-right">
        <span className="demo-badge">
          <span className="status-dot" />
          Prototipo interactivo
        </span>

        <button
          className="help-button"
          title="Información"
          onClick={() =>
            alert(
              "El prototipo utiliza datos de demostración. La integración con el backend se realizará después."
            )
          }
        >
          ?
        </button>
      </div>
    </header>
  );
}
