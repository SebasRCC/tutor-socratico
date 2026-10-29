
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

    </header>
  );
}
