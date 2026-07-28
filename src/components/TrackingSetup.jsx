import {
  READINESS_STEPS,
  TRACKING_READINESS_STATES,
  getCameraErrorPresentation,
  getReadinessProgress,
} from "../trackingReadiness.js";
import "../trackingSetup.css";

function SetupProgress({ readiness }) {
  const progress = getReadinessProgress(readiness);
  const ready = readiness?.status === TRACKING_READINESS_STATES.READY;

  return (
    <ol
      aria-label="Tracking setup progress"
      className="tracking-setup-steps"
      style={{ "--tracking-progress": progress }}
    >
      {READINESS_STEPS.map((step, index) => {
        const completed =
          ready ||
          index < (readiness?.activeStep ?? 0);
        const active = !ready && index === (readiness?.activeStep ?? 0);

        return (
          <li
            aria-current={active ? "step" : undefined}
            className={`${completed ? "completed" : ""} ${active ? "active" : ""}`}
            key={step.id}
          >
            <span className="tracking-setup-step-index" aria-hidden="true">
              {completed ? "✓" : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SetupError({ readiness, onRetry, onContinueWithoutCamera }) {
  const presentation = getCameraErrorPresentation(readiness?.status);
  if (!presentation) {
    return null;
  }

  return (
    <div className="tracking-setup-error" role="alert">
      <span className="tracking-setup-error-icon" aria-hidden="true">
        !
      </span>
      <div>
        <h2>{presentation.title}</h2>
        <p>{presentation.message}</p>
        <div className="tracking-setup-actions">
          <button className="tracking-primary-action" onClick={onRetry} type="button">
            {presentation.primaryAction}
          </button>
          <button
            className="tracking-secondary-action"
            onClick={onContinueWithoutCamera}
            type="button"
          >
            {presentation.secondaryAction}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrackingSetup({
  readiness,
  videoRef,
  devices = [],
  onBack,
  onStart,
  onRetry,
  onStop,
  onDeviceChange,
  onContinueWithoutCamera,
  onContinue,
}) {
  const status = readiness?.status ?? TRACKING_READINESS_STATES.IDLE;
  const idle = status === TRACKING_READINESS_STATES.IDLE;
  const ready = status === TRACKING_READINESS_STATES.READY;
  const loading =
    status === TRACKING_READINESS_STATES.REQUESTING_CAMERA ||
    status === TRACKING_READINESS_STATES.LOADING_MODEL;
  const hasError = Boolean(getCameraErrorPresentation(status));

  return (
    <div className="tracking-setup-page">
      <header className="tracking-setup-header">
        <button className="tracking-back-button" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> Home
        </button>
        <span className="tracking-privacy-chip">Camera processing stays on this device</span>
      </header>

      <main className="tracking-setup-main">
        <section className="tracking-setup-intro" aria-labelledby="tracking-setup-title">
          <span className="tracking-setup-kicker">Camera & tracking setup</span>
          <h1 id="tracking-setup-title">Get ready to move.</h1>
          <p>
            Motion Arcade uses your camera to estimate hand or body landmarks in real time.
            Camera frames are not uploaded by the application.
          </p>
          <SetupProgress readiness={readiness} />
        </section>

        <section
          aria-busy={loading}
          aria-labelledby="tracking-preview-title"
          className="tracking-setup-stage"
        >
          <h2 className="sr-only" id="tracking-preview-title">
            Camera preview and setup status
          </h2>
          <div className={`tracking-camera-frame ${ready ? "ready" : ""}`}>
            <video
              aria-label="Live mirrored camera preview"
              autoPlay
              muted
              playsInline
              ref={videoRef}
            />
            <div className="tracking-camera-guide" aria-hidden="true">
              <span className="tracking-camera-guide-hand">✋</span>
              <span>Keep your hand inside this area</span>
            </div>
            {loading ? (
              <div aria-live="polite" className="tracking-camera-loading" role="status">
                <span className="tracking-camera-spinner" aria-hidden="true" />
                <strong>
                  {status === TRACKING_READINESS_STATES.REQUESTING_CAMERA
                    ? "Waiting for camera permission…"
                    : "Preparing hand tracking…"}
                </strong>
              </div>
            ) : null}
            {ready ? (
              <div className="tracking-camera-success" role="status">
                <span aria-hidden="true">✓</span>
                <strong>Tracking ready</strong>
              </div>
            ) : null}
          </div>

          {hasError ? (
            <SetupError
              onContinueWithoutCamera={onContinueWithoutCamera}
              onRetry={onRetry}
              readiness={readiness}
            />
          ) : (
            <div className="tracking-setup-card">
              {idle ? (
                <>
                  <h2>Before you start</h2>
                  <ul>
                    <li>Use a well-lit space with your face and hands visible.</li>
                    <li>Place the device on a stable surface about an arm’s length away.</li>
                    <li>You can stop the camera at any time from Settings.</li>
                  </ul>
                  <div className="tracking-setup-actions">
                    <button className="tracking-primary-action" onClick={onStart} type="button">
                      Enable camera
                    </button>
                    <button
                      className="tracking-secondary-action"
                      onClick={onContinueWithoutCamera}
                      type="button"
                    >
                      Explore without camera
                    </button>
                  </div>
                </>
              ) : ready ? (
                <>
                  <h2>You’re ready</h2>
                  <p>
                    Point to move the cursor. Touch your thumb and index finger together to
                    pinch.
                  </p>
                  <div className="tracking-setup-actions">
                    <button className="tracking-primary-action" onClick={onContinue} type="button">
                      Continue to Home
                    </button>
                    <button className="tracking-secondary-action" onClick={onStop} type="button">
                      Stop camera
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Make tracking comfortable</h2>
                  <p>
                    Keep movements relaxed and inside the frame. You can adjust dwell time,
                    smoothing, dominant hand, mirror mode, and seated play in Settings.
                  </p>
                  {devices.length > 1 ? (
                    <label className="tracking-device-select" htmlFor="tracking-camera-device">
                      <span>Camera</span>
                      <select
                        id="tracking-camera-device"
                        onChange={(event) => onDeviceChange(event.target.value)}
                        value={readiness?.selectedDeviceId ?? ""}
                      >
                        {devices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || "Camera"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
