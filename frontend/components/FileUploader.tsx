
interface FileUploaderProps {
  file: File | null;
  error: string;
  loading: boolean;
  onFileChange: (file?: File) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export default function FileUploader({
  file,
  error,
  loading,
  onFileChange,
  onContinue,
  onCancel,
}: FileUploaderProps) {
  return (
    <div className="workflow-container">
      <button className="back-link" onClick={onCancel}>
        ← Volver al inicio
      </button>

      <span className="eyebrow">PASO 01 · PREPARA TU SESIÓN</span>
      <h1 className="page-title">Comencemos por tus ideas.</h1>
      <p className="page-description">
        Comparte el material que quieres estudiar. El tutor lo utilizará
        como base para acompañarte durante el aprendizaje.
      </p>

      <div className="upload-card">
        <div className="upload-card-heading">
          <div className="feature-icon lilac">↥</div>
          <div>
            <h3>Material de estudio</h3>
            <p>Selecciona un archivo Markdown de tu dispositivo.</p>
          </div>
        </div>

        <label className="dropzone">
          <input
            type="file"
            accept=".md,text/markdown,text/plain"
            onChange={(event) =>
              onFileChange(event.target.files?.[0])
            }
          />

          <span className="upload-cloud">↑</span>
          <strong>
            {file ? file.name : "Arrastra tu conocimiento aquí"}
          </strong>
          <span>
            {file
              ? `${(file.size / 1024).toFixed(1)} KB · Archivo seleccionado`
              : "o haz clic para explorar tus archivos"}
          </span>
          <span className="file-format">.MD · MARKDOWN</span>
        </label>

        {error && <p className="error-message">{error}</p>}

        <div className="privacy-note">
          <span>ⓘ</span>
            <p>
              Tu material se utilizará para preparar la sesión de aprendizaje
              y generar preguntas basadas en su contenido.
            </p>
        </div>

        <div className="card-actions">
          <button className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="primary-button"
            disabled={!file || loading}
            onClick={onContinue}
          >
            {loading ? "Preparando material..." : "Continuar"}
            {!loading && <span> →</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
