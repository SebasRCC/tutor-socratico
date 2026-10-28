
interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({
  onStart,
}: WelcomeScreenProps) {
  return (
    <>
      <div className="welcome-banner">
        <div className="welcome-copy">


          <h1>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. <br />
          </h1>

          <p>
            Lorempsum dolor sit amet, consectetur adipiscing elit. Sed
            euismod, nisl vel tincidunt lacinia, nunc est aliquam
            nunc, eget aliquam nisl nunc euismod nunc.
          </p>

          <button className="primary-button" onClick={onStart}>
            Comenzar a aprender <span>→</span>
          </button>

          <div className="banner-footnote">
            <span>✦</span> A tu ritmo, paso a paso
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-sun">✳</div>

          <div className="art-book">
            <div className="book-page page-left">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="book-page page-right">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="floating-note note-one">¿Por qué?</div>
          <div className="floating-note note-two">Explora ✦</div>
          <div className="floating-dot dot-one" />
          <div className="floating-dot dot-two" />
        </div>
      </div>

      <div className="section-heading">
        <div>
          <span className="eyebrow">TU EXPERIENCIA</span>
          <h2>Una forma diferente de aprender</h2>
        </div>

        <span className="muted-label">Tres pasos sencillos</span>
      </div>

      <div className="feature-grid">
        <article className="feature-card">
          <div className="feature-icon lilac">↗</div>
          <span className="feature-index">01 / PREPARA</span>
          <h3>Tu material, tu camino</h3>
          <p>
            Comienza con tus propios apuntes y contenido de estudio.
          </p>
        </article>

        <article className="feature-card">
          <div className="feature-icon mint">◎</div>
          <span className="feature-index">02 / ENFOCA</span>
          <h3>Define qué aprender</h3>
          <p>
            Elige un tema y un objetivo que quieras comprender mejor.
          </p>
        </article>

        <article className="feature-card">
          <div className="feature-icon peach">✳</div>
          <span className="feature-index">03 / DESCUBRE</span>
          <h3>Piensa por ti mismo</h3>
          <p>
            Responde preguntas y descubre nuevas formas de razonar.
          </p>
        </article>
      </div>
    </>
  );
}
