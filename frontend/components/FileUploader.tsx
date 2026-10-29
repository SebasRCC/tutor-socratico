
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

      <span className="page-title">PASO 01 · PREPAREMOS LA SESIÓN</span>
      <p className="page-description">
        Sube el material
      </p>

      <div className="upload-card">
        <div className="upload-card-heading">

          <div>
            <h3>Selecciona un archivo Markdown de tu dispositivo.</h3>
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
