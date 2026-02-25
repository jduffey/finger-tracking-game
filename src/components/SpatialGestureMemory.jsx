import { GESTURE_DEFINITIONS } from "../gestures/constants";

const ICON_BY_GESTURE = {
  swipe_left: "⬅",
  swipe_right: "➡",
  pinch_grab: "🤏",
  pinch_release: "🫳",
  open_palm: "✋",
  push_forward: "⏩",
  circle: "⭕",
  expand: "👐",
  compress: "🤝",
  rotate_twist: "🌀",
  symmetric_swipe: "↔",
};

function getGestureLabel(gestureId) {
  return GESTURE_DEFINITIONS.find((gesture) => gesture.id === gestureId)?.label ?? gestureId;
}

function StepToken({ step, active, done }) {
  const ids = Array.isArray(step) ? step : [step];
  return (
    <div className={`sgm-step-token ${active ? "active" : ""} ${done ? "done" : ""}`}>
      {ids.map((id, index) => (
        <span key={`${id}-${index}`} title={getGestureLabel(id)}>
          {ICON_BY_GESTURE[id] ?? "✦"}
        </span>
      ))}
    </div>
  );
}

export default function SpatialGestureMemory({ state, onStart, onReset }) {
  const expected = state?.expectedStep;
  const expectedIds = Array.isArray(expected) ? expected : expected ? [expected] : [];

  return (
    <section className="card panel spatial-memory-panel">
      <h2>Spatial Gesture Memory</h2>
      <p className="small-text">
        Reproduce the neon sequence in order. Higher rounds add two-hand + simultaneous gestures.
      </p>

      <div className="sgm-neon-stage">
        <div className="sgm-grid" />
        <div className="sgm-next-gesture">
          {expectedIds.length ? (
            expectedIds.map((id) => (
              <div className="sgm-icon" key={id} title={getGestureLabel(id)}>
                {ICON_BY_GESTURE[id] ?? "✦"}
              </div>
            ))
          ) : (
            <div className="sgm-icon muted">⏵</div>
          )}
          <strong>{state?.expectedLabel ?? "Press Start"}</strong>
        </div>
      </div>

      <div className="stats-grid">
        <div><strong>Round</strong><span>{state?.round ?? 1}</span></div>
        <div><strong>Sequence</strong><span>{state?.sequenceLength ?? 0}</span></div>
        <div><strong>Accuracy</strong><span>{Math.round((state?.accuracy ?? 0) * 100)}%</span></div>
        <div><strong>Time</strong><span>{(state?.elapsedSeconds ?? 0).toFixed(1)}s</span></div>
        <div><strong>Smoothness</strong><span>{Math.round((state?.smoothness ?? 0) * 100)}%</span></div>
        <div><strong>Score</strong><span>{Math.round(state?.score ?? 0)}</span></div>
      </div>

      <div className="sgm-sequence-row">
        {(state?.sequence ?? []).map((step, index) => (
          <StepToken
            key={`step-${index}`}
            step={step}
            active={index === state.currentStepIndex}
            done={index < state.currentStepIndex}
          />
        ))}
      </div>

      <div className="sgm-feedback">
        <strong>You did:</strong> <span>{state?.lastActionLabel ?? "—"}</span>
      </div>
      <p className={`small-text ${state?.status === "failed" ? "error-text" : ""}`}>
        {state?.message ?? ""}
      </p>

      <div className="stats-grid sgm-history-grid">
        <div><strong>Best Score</strong><span>{Math.round(state?.highScore ?? 0)}</span></div>
        <div><strong>Best Round</strong><span>{state?.bestRound ?? 1}</span></div>
        <div><strong>Success Rate</strong><span>{Math.round((state?.successRate ?? 0) * 100)}%</span></div>
        <div><strong>Adaptive Level</strong><span>{state?.difficultyLevel ?? 1}</span></div>
      </div>

      <div className="button-row">
        <button type="button" onClick={onStart}>Start / Next Round</button>
        <button type="button" className="secondary" onClick={onReset}>Reset Progress</button>
      </div>
    </section>
  );
}
