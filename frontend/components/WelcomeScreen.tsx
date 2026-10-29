
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

          <button className="primary-button text-xl" onClick={onStart}>
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

    </>
  );
}
