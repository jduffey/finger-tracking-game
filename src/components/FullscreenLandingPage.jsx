import { FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID } from "../fullscreenModeLanding.js";

function getLandingBoxStyle(box, holdProgress = 0) {
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    "--hold-progress": holdProgress,
    "--preview-accent": box.accent,
  };
}

export function WebcamBackground({ videoRef, overlayCanvasRef, cameraObjectFit }) {
  return (
    <>
      <video
        ref={videoRef}
        className="camera-video fullscreen-camera-video"
        style={{ objectFit: cameraObjectFit }}
        playsInline
        muted
        autoPlay
      />
      <canvas ref={overlayCanvasRef} className="camera-overlay" />
    </>
  );
}

function HeaderControls() {
  return (
    <div className="fullscreen-camera-landing-top-controls">
      <button className="fullscreen-camera-landing-pill secondary" type="button">
        <span className="fullscreen-camera-pill-icon info" aria-hidden="true" />
        How to use
      </button>
      <button className="fullscreen-camera-landing-pill secondary" type="button">
        <span className="fullscreen-camera-pill-icon settings" aria-hidden="true" />
        Settings
      </button>
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="fullscreen-camera-landing-header">
      <div className="fullscreen-camera-landing-title-row">
        <span className="fullscreen-camera-landing-hand-mark" aria-hidden="true" />
        <div>
          <h1>Finger Tracking Demos</h1>
          <p>Hover your index finger over any demo to launch it</p>
        </div>
      </div>
      <span className="fullscreen-camera-landing-instruction">
        <span className="fullscreen-camera-landing-clock" aria-hidden="true" />
        Hover for 1 second to select
      </span>
    </header>
  );
}

export function DemoSection({ section }) {
  return (
    <section
      className={`fullscreen-camera-landing-panel ${section.kind}`}
      style={{
        left: `${section.left}px`,
        top: `${section.top}px`,
        width: `${section.width}px`,
        height: `${section.height}px`,
        "--panel-padding": `${section.padding}px`,
      }}
    >
      <h2>
        <span
          className={`fullscreen-camera-landing-section-icon ${section.icon}`}
          aria-hidden="true"
        />
        {section.title}
      </h2>
    </section>
  );
}

export function DemoTile({ item, active, holdProgress, onSelect }) {
  return (
    <button
      key={item.id}
      aria-label={`Open ${item.label}`}
      className={`fullscreen-camera-mode-landing-box ${item.kind} ${active ? "active" : ""}`}
      data-route={item.route}
      onClick={(event) => onSelect(event, item.id)}
      type="button"
      style={getLandingBoxStyle(item, active ? holdProgress : 0)}
    >
      <span
        className={`fullscreen-camera-mode-preview ${item.previewType}`}
        aria-hidden="true"
      />
      <span className="fullscreen-camera-mode-landing-title">{item.label}</span>
      <span className="fullscreen-camera-mode-landing-hint">
        {active ? "Keep hovering" : "Hover to play"}
      </span>
    </button>
  );
}

function BackToInputTestButton({ item, active, holdProgress, onSelect }) {
  if (!item) {
    return null;
  }

  return (
    <button
      className={`fullscreen-camera-landing-back ${active ? "active" : ""}`}
      data-route={item.route}
      onClick={(event) => onSelect(event, item.id)}
      style={getLandingBoxStyle(item, active ? holdProgress : 0)}
      type="button"
    >
      <span aria-hidden="true">←</span>
      Back to Input Test
    </button>
  );
}

export function FooterStatus({ handDetected, fps }) {
  return (
    <div className="fullscreen-camera-landing-footer">
      <span className={`fullscreen-camera-landing-status ${handDetected ? "ok" : "warn"}`}>
        <span className="fullscreen-camera-landing-status-dot" aria-hidden="true" />
        {handDetected ? "Tracking Active" : "Hand not detected"}
        <span className="fullscreen-camera-landing-status-separator" />
        FPS: {Math.round(fps)}
      </span>
      <span className="fullscreen-camera-landing-helper">
        Point your <strong>index finger</strong> to explore
      </span>
    </div>
  );
}

export default function FullscreenLandingPage({
  viewportStyle,
  layout,
  state,
  holdProgress,
  handDetected,
  fps,
  onSelect,
}) {
  const demoItems =
    layout?.boxes?.filter((box) => box.id !== FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID) ?? [];
  const backItem =
    layout?.boxes?.find((box) => box.id === FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID) ?? null;

  return (
    <div
      className="fullscreen-camera-mode-landing"
      style={{
        ...(viewportStyle ?? {}),
        "--landing-scale": layout?.scale ?? 1,
      }}
    >
      <HeaderControls />
      <LandingHeader />
      {(layout?.sections ?? []).map((section) => (
        <DemoSection key={section.id} section={section} />
      ))}
      {demoItems.map((item) => (
        <DemoTile
          key={item.id}
          item={item}
          active={state?.holdModeId === item.id}
          holdProgress={holdProgress}
          onSelect={onSelect}
        />
      ))}
      <BackToInputTestButton
        item={backItem}
        active={state?.holdModeId === backItem?.id}
        holdProgress={holdProgress}
        onSelect={onSelect}
      />
      <FooterStatus handDetected={handDetected} fps={fps} />
    </div>
  );
}
