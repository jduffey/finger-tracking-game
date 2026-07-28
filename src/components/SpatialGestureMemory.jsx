import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { GESTURE_DEFINITIONS } from "../gestures/constants.js";
import {
  SPATIAL_MEMORY_ACTIONS,
  SPATIAL_MEMORY_DEFAULTS,
  SPATIAL_MEMORY_PHASES,
  calculateSpatialMemoryScores,
  createSpatialMemoryExperience,
  getSpatialMemoryGestureLabel,
  getSpatialMemoryNextTransitionAt,
  getSpatialMemoryPresentation,
  getSpatialMemoryStepLabel,
  normalizeSpatialMemorySequence,
  reduceSpatialMemoryExperience,
} from "../spatialMemoryExperience.js";

const ICON_BY_GESTURE = Object.freeze({
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
});

const SHORTCUTS = Object.freeze([
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "-",
]);

const SHORTCUT_BY_GESTURE = new Map(
  GESTURE_DEFINITIONS.map((gesture, index) => [
    gesture.id,
    SHORTCUTS[index],
  ]),
);
const GESTURE_BY_SHORTCUT = new Map(
  [...SHORTCUT_BY_GESTURE.entries()].map(([gestureId, shortcut]) => [
    shortcut,
    gestureId,
  ]),
);

const PHASE_STEPS = Object.freeze([
  { id: SPATIAL_MEMORY_PHASES.OBSERVE, label: "Observe" },
  { id: SPATIAL_MEMORY_PHASES.READY, label: "Ready" },
  { id: SPATIAL_MEMORY_PHASES.REPRODUCE, label: "Reproduce" },
  { id: SPATIAL_MEMORY_PHASES.RESULT, label: "Result" },
]);

const SPATIAL_MEMORY_STYLES = `
  .sgmx-shell {
    --sgmx-cyan: #67e8f9;
    --sgmx-blue: #60a5fa;
    --sgmx-violet: #c084fc;
    --sgmx-green: #6ee7b7;
    --sgmx-amber: #fcd34d;
    background:
      radial-gradient(circle at 14% -10%, rgba(34, 211, 238, 0.18), transparent 36%),
      radial-gradient(circle at 94% 4%, rgba(168, 85, 247, 0.15), transparent 34%),
      linear-gradient(150deg, rgba(8, 15, 31, 0.98), rgba(12, 22, 43, 0.98));
    border: 1px solid rgba(103, 232, 249, 0.3);
    color: #e8f4ff;
    display: grid;
    gap: clamp(0.75rem, 1.6vw, 1.15rem);
    overflow: hidden;
    padding: clamp(0.85rem, 2vw, 1.35rem);
    position: relative;
  }

  .sgmx-shell::before {
    background-image:
      linear-gradient(rgba(103, 232, 249, 0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(103, 232, 249, 0.055) 1px, transparent 1px);
    background-size: 32px 32px;
    content: "";
    inset: 0;
    mask-image: linear-gradient(to bottom, black, transparent 72%);
    pointer-events: none;
    position: absolute;
  }

  .sgmx-shell > * {
    position: relative;
    z-index: 1;
  }

  .sgmx-header {
    align-items: start;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }

  .sgmx-kicker {
    color: var(--sgmx-cyan);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    margin: 0 0 0.25rem;
    text-transform: uppercase;
  }

  .sgmx-title {
    color: #f8fbff;
    font-size: clamp(1.35rem, 3vw, 2rem);
    line-height: 1.05;
    margin: 0;
  }

  .sgmx-subtitle {
    color: #b9cbe4;
    line-height: 1.45;
    margin: 0.4rem 0 0;
    max-width: 66ch;
  }

  .sgmx-round-badge {
    background: rgba(15, 31, 56, 0.86);
    border: 1px solid rgba(96, 165, 250, 0.46);
    border-radius: 999px;
    color: #dbeafe;
    flex: 0 0 auto;
    font-size: 0.78rem;
    font-weight: 800;
    padding: 0.48rem 0.72rem;
  }

  .sgmx-phase-list {
    counter-reset: phase;
    display: grid;
    gap: 0.45rem;
    grid-template-columns: repeat(4, 1fr);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sgmx-phase {
    align-items: center;
    color: #7f95b2;
    display: flex;
    font-size: 0.75rem;
    font-weight: 750;
    gap: 0.42rem;
    min-width: 0;
  }

  .sgmx-phase::before {
    align-items: center;
    background: rgba(21, 38, 65, 0.9);
    border: 1px solid rgba(127, 149, 178, 0.35);
    border-radius: 999px;
    content: counter(phase);
    counter-increment: phase;
    display: inline-flex;
    flex: 0 0 1.65rem;
    height: 1.65rem;
    justify-content: center;
  }

  .sgmx-phase::after {
    background: rgba(127, 149, 178, 0.24);
    content: "";
    flex: 1;
    height: 1px;
    min-width: 0.25rem;
  }

  .sgmx-phase:last-child::after {
    display: none;
  }

  .sgmx-phase.is-active {
    color: #ecfeff;
  }

  .sgmx-phase.is-active::before {
    background: rgba(8, 145, 178, 0.34);
    border-color: var(--sgmx-cyan);
    box-shadow: 0 0 18px rgba(103, 232, 249, 0.22);
  }

  .sgmx-phase.is-complete {
    color: #a7f3d0;
  }

  .sgmx-phase.is-complete::before {
    background: rgba(5, 150, 105, 0.28);
    border-color: var(--sgmx-green);
    content: "✓";
  }

  .sgmx-main-grid {
    display: grid;
    gap: clamp(0.75rem, 1.7vw, 1.2rem);
    grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.65fr);
  }

  .sgmx-stage {
    align-items: center;
    background:
      radial-gradient(circle at center, rgba(37, 99, 235, 0.18), transparent 62%),
      rgba(3, 10, 24, 0.76);
    border: 1px solid rgba(103, 232, 249, 0.38);
    border-radius: 18px;
    display: flex;
    justify-content: center;
    min-height: clamp(250px, 42vh, 430px);
    overflow: hidden;
    padding: clamp(1rem, 3vw, 2rem);
    position: relative;
    text-align: center;
  }

  .sgmx-stage::before {
    background:
      linear-gradient(rgba(96, 165, 250, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96, 165, 250, 0.08) 1px, transparent 1px);
    background-size: 28px 28px;
    content: "";
    inset: 0;
    pointer-events: none;
    position: absolute;
  }

  .sgmx-stage-content {
    display: grid;
    gap: 0.72rem;
    justify-items: center;
    max-width: 620px;
    position: relative;
    width: 100%;
    z-index: 1;
  }

  .sgmx-stage-kicker {
    color: var(--sgmx-cyan);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }

  .sgmx-stage-heading {
    color: #f8fbff;
    font-size: clamp(1.3rem, 3vw, 2.1rem);
    line-height: 1.15;
    margin: 0;
  }

  .sgmx-stage-copy {
    color: #bfd0e7;
    line-height: 1.5;
    margin: 0;
    max-width: 56ch;
  }

  .sgmx-teaching-card {
    animation: sgmx-teach-in 360ms ease-out both;
    display: grid;
    gap: 0.65rem;
    justify-items: center;
    width: 100%;
  }

  .sgmx-gesture-icons {
    display: flex;
    gap: 0.65rem;
    justify-content: center;
  }

  .sgmx-hero-icon {
    align-items: center;
    animation: sgmx-icon-breathe 1.45s ease-in-out infinite;
    background:
      linear-gradient(145deg, rgba(30, 64, 175, 0.58), rgba(88, 28, 135, 0.42));
    border: 1px solid rgba(103, 232, 249, 0.72);
    border-radius: 24px;
    box-shadow:
      0 0 0 7px rgba(103, 232, 249, 0.05),
      0 0 34px rgba(34, 211, 238, 0.25);
    display: inline-flex;
    font-size: clamp(2.75rem, 7vw, 4.75rem);
    height: clamp(92px, 16vw, 132px);
    justify-content: center;
    width: clamp(92px, 16vw, 132px);
  }

  .sgmx-teaching-detail {
    color: #d8e8f9;
    font-size: 0.96rem;
    line-height: 1.45;
    margin: 0;
  }

  .sgmx-teach-progress {
    background: rgba(96, 165, 250, 0.14);
    border-radius: 999px;
    height: 4px;
    max-width: 360px;
    overflow: hidden;
    width: 78%;
  }

  .sgmx-teach-progress > span {
    animation: sgmx-teach-progress var(--sgmx-teach-duration, 1500ms) linear both;
    background: linear-gradient(90deg, var(--sgmx-cyan), var(--sgmx-violet));
    display: block;
    height: 100%;
    transform-origin: left;
  }

  .sgmx-hidden-symbol,
  .sgmx-result-symbol {
    align-items: center;
    background: rgba(30, 41, 74, 0.72);
    border: 1px solid rgba(192, 132, 252, 0.5);
    border-radius: 999px;
    display: inline-flex;
    font-size: 2.5rem;
    height: 92px;
    justify-content: center;
    width: 92px;
  }

  .sgmx-result-symbol.is-success {
    border-color: rgba(110, 231, 183, 0.72);
    box-shadow: 0 0 26px rgba(16, 185, 129, 0.18);
  }

  .sgmx-ready-button {
    margin-top: 0.25rem;
    min-height: 50px;
    padding-inline: 1.2rem;
  }

  .sgmx-side {
    align-content: start;
    display: grid;
    gap: 0.7rem;
  }

  .sgmx-panel {
    background: rgba(10, 21, 41, 0.76);
    border: 1px solid rgba(96, 165, 250, 0.22);
    border-radius: 14px;
    padding: 0.8rem;
  }

  .sgmx-panel-title {
    color: #c7d8ec;
    font-size: 0.74rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    margin: 0 0 0.6rem;
    text-transform: uppercase;
  }

  .sgmx-sequence {
    display: grid;
    gap: 0.42rem;
    grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sgmx-step {
    align-items: center;
    aspect-ratio: 1;
    background: rgba(25, 43, 73, 0.74);
    border: 1px solid rgba(100, 130, 172, 0.35);
    border-radius: 10px;
    color: #91a7c4;
    display: flex;
    font-size: 0.8rem;
    font-weight: 800;
    justify-content: center;
    min-height: 40px;
  }

  .sgmx-step.is-current {
    border-color: var(--sgmx-cyan);
    box-shadow: 0 0 13px rgba(103, 232, 249, 0.18);
    color: #ecfeff;
  }

  .sgmx-step.is-complete {
    background: rgba(5, 150, 105, 0.2);
    border-color: rgba(110, 231, 183, 0.55);
    color: #a7f3d0;
  }

  .sgmx-step.is-hidden {
    color: #c4b5fd;
  }

  .sgmx-step.is-review {
    aspect-ratio: auto;
    display: grid;
    font-size: 1rem;
    gap: 0.2rem;
    min-height: 58px;
    padding: 0.35rem;
  }

  .sgmx-step-label {
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .sgmx-score-grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sgmx-score {
    background: rgba(18, 35, 61, 0.72);
    border-radius: 10px;
    display: grid;
    gap: 0.12rem;
    min-width: 0;
    padding: 0.62rem;
  }

  .sgmx-score span {
    color: #91a9c7;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .sgmx-score strong {
    color: #f2f7ff;
    font-size: 1.08rem;
    overflow-wrap: anywhere;
  }

  .sgmx-score small {
    color: #9fb2cc;
    font-size: 0.67rem;
  }

  .sgmx-live-status {
    color: #c5d7ed;
    font-size: 0.82rem;
    line-height: 1.4;
    margin: 0;
  }

  .sgmx-live-status[data-tone="warning"] {
    color: #fde68a;
  }

  .sgmx-controls {
    background: rgba(4, 11, 25, 0.72);
    border: 1px solid rgba(103, 232, 249, 0.2);
    border-radius: 16px;
    margin: 0;
    min-width: 0;
    padding: 0.75rem;
  }

  .sgmx-controls legend {
    color: #d7e8f8;
    font-size: 0.82rem;
    font-weight: 800;
    padding: 0 0.35rem;
  }

  .sgmx-controls-help {
    color: #91a8c4;
    font-size: 0.75rem;
    margin: 0 0 0.6rem;
  }

  .sgmx-gesture-grid {
    display: grid;
    gap: 0.42rem;
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  }

  .sgmx-gesture-button {
    align-items: center;
    background: rgba(22, 42, 70, 0.82);
    border: 1px solid rgba(96, 165, 250, 0.32);
    border-radius: 11px;
    color: #e6f2ff;
    display: grid;
    gap: 0.08rem 0.45rem;
    grid-template-columns: 1.7rem 1fr auto;
    min-height: 50px;
    padding: 0.42rem 0.5rem;
    text-align: left;
    touch-action: manipulation;
    transition:
      border-color 140ms ease,
      background 140ms ease,
      transform 140ms ease;
  }

  .sgmx-gesture-button:not(:disabled):hover {
    background: rgba(25, 70, 103, 0.88);
    border-color: var(--sgmx-cyan);
    transform: translateY(-1px);
  }

  .sgmx-gesture-button:focus-visible {
    outline: 3px solid var(--sgmx-amber);
    outline-offset: 2px;
  }

  .sgmx-gesture-button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .sgmx-button-icon {
    font-size: 1.25rem;
    grid-row: 1 / span 2;
  }

  .sgmx-button-label {
    font-size: 0.75rem;
    font-weight: 780;
    line-height: 1.1;
  }

  .sgmx-shortcut {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    color: #aebfd4;
    font-family: ui-monospace, monospace;
    font-size: 0.66rem;
    grid-row: 1 / span 2;
    padding: 0.12rem 0.28rem;
  }

  .sgmx-actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    justify-content: space-between;
  }

  .sgmx-actions-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .sgmx-actions button {
    min-height: 44px;
  }

  .sgmx-sr-only {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  @keyframes sgmx-teach-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes sgmx-icon-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }

  @keyframes sgmx-teach-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  @media (max-width: 820px) {
    .sgmx-main-grid {
      grid-template-columns: 1fr;
    }

    .sgmx-stage {
      min-height: 290px;
    }

    .sgmx-side {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .sgmx-header {
      display: grid;
    }

    .sgmx-round-badge {
      justify-self: start;
    }

    .sgmx-phase {
      display: grid;
      gap: 0.2rem;
      justify-items: center;
      text-align: center;
    }

    .sgmx-phase::after {
      display: none;
    }

    .sgmx-side,
    .sgmx-score-grid {
      grid-template-columns: 1fr;
    }

    .sgmx-gesture-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sgmx-gesture-button {
      grid-template-columns: 1.5rem 1fr;
    }

    .sgmx-shortcut {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sgmx-motion-safe,
    .sgmx-motion-safe::before,
    .sgmx-teaching-card,
    .sgmx-hero-icon,
    .sgmx-teach-progress > span,
    .sgmx-gesture-button {
      animation: none !important;
      scroll-behavior: auto !important;
      transition: none !important;
    }

    .sgmx-teach-progress > span {
      transform: scaleX(1);
    }
  }

  :root[data-reduced-motion="true"] .sgmx-motion-safe,
  :root[data-reduced-motion="true"] .sgmx-motion-safe::before,
  :root[data-reduced-motion="true"] .sgmx-teaching-card,
  :root[data-reduced-motion="true"] .sgmx-hero-icon,
  :root[data-reduced-motion="true"] .sgmx-teach-progress > span,
  :root[data-reduced-motion="true"] .sgmx-gesture-button {
    animation: none !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }

  :root[data-reduced-motion="true"] .sgmx-teach-progress > span {
    transform: scaleX(1);
  }
`;

function nowMs() {
  try {
    return globalThis.performance?.now?.() ?? Date.now();
  } catch {
    return 0;
  }
}

function getSequenceToken(state) {
  const sequence = normalizeSpatialMemorySequence(state?.sequence);
  return `${state?.roundStartAt ?? "none"}:${state?.round ?? 1}:${JSON.stringify(sequence)}`;
}

function buildLegacyResultExperience(experience, legacyState) {
  const sequence = normalizeSpatialMemorySequence(
    legacyState?.sequence?.length
      ? legacyState.sequence
      : experience.sequence,
  );
  const succeeded = legacyState?.status === "completed";
  const sequenceLength = sequence.length;
  const completedSteps = succeeded
    ? sequenceLength
    : Math.min(
        sequenceLength,
        Math.max(
          0,
          Number.isFinite(legacyState?.correctSteps)
            ? Math.round(legacyState.correctSteps)
            : Number.isFinite(legacyState?.currentStepIndex)
              ? Math.round(legacyState.currentStepIndex)
              : 0,
        ),
      );
  const attempts = Math.max(
    completedSteps,
    Number.isFinite(legacyState?.attempts)
      ? Math.round(legacyState.attempts)
      : completedSteps,
  );
  const recognitionCorrectInputs = Math.min(
    attempts,
    succeeded
      ? attempts
      : Math.max(
          completedSteps,
          Number.isFinite(legacyState?.accuracy)
            ? Math.round(attempts * legacyState.accuracy)
            : completedSteps,
        ),
  );
  const mistakesUsed = Math.max(0, attempts - recognitionCorrectInputs);
  const outcome = succeeded ? "success" : "failed";
  const scores = calculateSpatialMemoryScores({
    sequenceLength,
    completedSteps,
    recognitionCorrectInputs,
    attempts,
    mistakesUsed,
    mistakeAllowance: experience.mistakeAllowance,
    outcome,
  });
  return {
    ...experience,
    phase: SPATIAL_MEMORY_PHASES.RESULT,
    status: legacyState.status,
    sequence,
    sequenceLength,
    completedSteps,
    currentStepIndex: completedSteps,
    attempts,
    recognitionCorrectInputs,
    mistakesUsed,
    scores,
    result: {
      outcome,
      reason: succeeded ? "sequence-complete" : "legacy-round-ended",
      completedSteps,
      sequenceLength,
      mistakesUsed,
      ...scores,
    },
    announcement:
      legacyState?.message ??
      (succeeded ? "Sequence complete." : "Round ended. Try again."),
  };
}

function PhaseProgress({ phase }) {
  const activeIndex = PHASE_STEPS.findIndex((step) => step.id === phase);
  return (
    <ol className="sgmx-phase-list" aria-label="Round phases">
      {PHASE_STEPS.map((step, index) => (
        <li
          className={[
            "sgmx-phase",
            index === activeIndex ? "is-active" : "",
            activeIndex > index ? "is-complete" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-current={index === activeIndex ? "step" : undefined}
          key={step.id}
        >
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function SequenceProgress({ experience }) {
  const sequence = experience.sequence ?? [];
  if (sequence.length === 0) {
    return (
      <p className="sgmx-live-status">
        Your sequence will appear here as numbered steps.
      </p>
    );
  }
  const phase = experience.phase;
  const isResult = phase === SPATIAL_MEMORY_PHASES.RESULT;
  const hidden =
    phase === SPATIAL_MEMORY_PHASES.READY ||
    phase === SPATIAL_MEMORY_PHASES.REPRODUCE;
  return (
    <ol
      className="sgmx-sequence"
      aria-label={
        hidden
          ? `${sequence.length} hidden sequence steps`
          : isResult
            ? "Sequence review"
            : "Teaching progress"
      }
    >
      {sequence.map((step, index) => {
        const isCurrent =
          phase === SPATIAL_MEMORY_PHASES.OBSERVE
            ? index === experience.teachingIndex
            : phase === SPATIAL_MEMORY_PHASES.REPRODUCE
              ? index === experience.currentStepIndex
              : false;
        const isComplete =
          phase === SPATIAL_MEMORY_PHASES.REPRODUCE &&
          index < experience.currentStepIndex;
        const ids = Array.isArray(step) ? step : [step];
        return (
          <li
            className={[
              "sgmx-step",
              isCurrent ? "is-current" : "",
              isComplete ? "is-complete" : "",
              hidden ? "is-hidden" : "",
              isResult ? "is-review" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={
              isResult
                ? `Step ${index + 1}: ${getSpatialMemoryStepLabel(step)}`
                : hidden
                  ? `Hidden step ${index + 1}${isComplete ? ", completed" : isCurrent ? ", current" : ""}`
                  : `Teaching step ${index + 1}${isCurrent ? ", current" : ""}`
            }
            key={`step-${index}`}
          >
            {isResult ? (
              <>
                <span aria-hidden="true">
                  {ids.map((id) => ICON_BY_GESTURE[id] ?? "✦").join(" ")}
                </span>
                <span className="sgmx-step-label">
                  {getSpatialMemoryStepLabel(step)}
                </span>
              </>
            ) : hidden ? (
              <span aria-hidden="true">{isComplete ? "✓" : "●"}</span>
            ) : (
              index + 1
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ScoreTile({ label, value, detail }) {
  return (
    <div className="sgmx-score">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function ExperienceStage({
  experience,
  presentation,
  onConfirmReady,
  readyButtonRef,
}) {
  const teachingCue = presentation.teachingCue;
  if (experience.phase === SPATIAL_MEMORY_PHASES.OBSERVE && teachingCue) {
    return (
      <div
        className="sgmx-stage-content sgmx-teaching-card sgmx-motion-safe"
        key={`teaching-${experience.teachingIndex}`}
      >
        <p className="sgmx-stage-kicker">
          Step {teachingCue.stepNumber} of {teachingCue.stepCount} · Watch
        </p>
        <div className="sgmx-gesture-icons" aria-hidden="true">
          {teachingCue.ids.map((gestureId) => (
            <span className="sgmx-hero-icon" key={gestureId}>
              {ICON_BY_GESTURE[gestureId] ?? "✦"}
            </span>
          ))}
        </div>
        <h3 className="sgmx-stage-heading">{teachingCue.label}</h3>
        <p className="sgmx-teaching-detail">{teachingCue.instruction}</p>
        <p className="sgmx-stage-copy">{teachingCue.description}</p>
        <div
          className="sgmx-teach-progress"
          aria-hidden="true"
          style={{
            "--sgmx-teach-duration": `${experience.teachingStepDurationMs}ms`,
          }}
        >
          <span />
        </div>
      </div>
    );
  }

  if (experience.phase === SPATIAL_MEMORY_PHASES.READY) {
    return (
      <div className="sgmx-stage-content">
        <span className="sgmx-hidden-symbol" aria-hidden="true">
          🔒
        </span>
        <p className="sgmx-stage-kicker">Sequence hidden</p>
        <h3 className="sgmx-stage-heading">{presentation.heading}</h3>
        <p className="sgmx-stage-copy">{presentation.instruction}</p>
        <button
          className="sgmx-ready-button"
          type="button"
          onClick={onConfirmReady}
          ref={readyButtonRef}
        >
          I’m ready — reproduce
        </button>
      </div>
    );
  }

  if (experience.phase === SPATIAL_MEMORY_PHASES.REPRODUCE) {
    return (
      <div className="sgmx-stage-content">
        <span className="sgmx-hidden-symbol" aria-hidden="true">
          {experience.currentStepIndex + 1}
        </span>
        <p className="sgmx-stage-kicker">
          Hidden step {experience.currentStepIndex + 1} of{" "}
          {experience.sequence.length}
        </p>
        <h3 className="sgmx-stage-heading">{presentation.heading}</h3>
        <p className="sgmx-stage-copy">{presentation.instruction}</p>
        <p
          className="sgmx-live-status"
          data-tone={experience.mistakesUsed > 0 ? "warning" : "neutral"}
        >
          {presentation.mistakesRemaining} forgiving{" "}
          {presentation.mistakesRemaining === 1 ? "try" : "tries"} left
          {experience.stepProgressIds.length > 0
            ? " · Combined gesture partly recognized"
            : ""}
        </p>
      </div>
    );
  }

  if (experience.phase === SPATIAL_MEMORY_PHASES.RESULT) {
    const success = experience.result?.outcome === "success";
    return (
      <div className="sgmx-stage-content">
        <span
          className={`sgmx-result-symbol ${success ? "is-success" : ""}`}
          aria-hidden="true"
        >
          {success ? "✓" : "↻"}
        </span>
        <p className="sgmx-stage-kicker">
          {success ? "Sequence complete" : "Round review"}
        </p>
        <h3 className="sgmx-stage-heading">{presentation.heading}</h3>
        <p className="sgmx-stage-copy">{presentation.instruction}</p>
      </div>
    );
  }

  return (
    <div className="sgmx-stage-content">
      <span className="sgmx-hidden-symbol" aria-hidden="true">
        ◈
      </span>
      <p className="sgmx-stage-kicker">Watch · Hide · Recall</p>
      <h3 className="sgmx-stage-heading">{presentation.heading}</h3>
      <p className="sgmx-stage-copy">{presentation.instruction}</p>
    </div>
  );
}

/**
 * Backward-compatible props:
 * - state, onStart and onReset continue to work with the current App.
 *
 * Controlled experience props for full Observe → Result integration:
 * - experienceState: state from create/reduceSpatialMemoryExperience.
 * - onExperienceAction(action): dispatch every model action.
 * - onGestureInput(id, meta): optional legacy bridge for accessible controls
 *   when experienceState is not controlled.
 */
export default function SpatialGestureMemory({
  state,
  experienceState,
  onExperienceAction,
  onGestureInput,
  onStart,
  onReset,
  teachingStepDurationMs = SPATIAL_MEMORY_DEFAULTS.teachingStepDurationMs,
  mistakeAllowance = SPATIAL_MEMORY_DEFAULTS.mistakeAllowance,
}) {
  const [localExperience, localDispatch] = useReducer(
    reduceSpatialMemoryExperience,
    undefined,
    () =>
      createSpatialMemoryExperience({
        teachingStepDurationMs,
        mistakeAllowance,
      }),
  );
  const lastLegacySequenceTokenRef = useRef(null);
  const readyButtonRef = useRef(null);
  const firstGestureButtonRef = useRef(null);
  const previousPhaseRef = useRef(null);
  const isControlled =
    experienceState &&
    typeof experienceState === "object" &&
    typeof onExperienceAction === "function";
  const baseExperience = isControlled ? experienceState : localExperience;

  const dispatchExperience = useCallback(
    (action) => {
      if (isControlled) {
        onExperienceAction(action);
      } else {
        localDispatch(action);
      }
    },
    [isControlled, onExperienceAction],
  );

  useEffect(() => {
    if (isControlled || state?.status !== "playing") {
      return;
    }
    const sequence = normalizeSpatialMemorySequence(state?.sequence);
    if (sequence.length === 0) {
      return;
    }
    const token = getSequenceToken(state);
    if (lastLegacySequenceTokenRef.current === token) {
      return;
    }
    lastLegacySequenceTokenRef.current = token;
    localDispatch({
      type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
      sequence,
      round: state?.round ?? 1,
      now: nowMs(),
      teachingStepDurationMs,
      mistakeAllowance,
    });
  }, [
    isControlled,
    mistakeAllowance,
    state?.round,
    state?.roundStartAt,
    state?.sequence,
    state?.status,
    teachingStepDurationMs,
  ]);

  useEffect(() => {
    if (baseExperience?.phase !== SPATIAL_MEMORY_PHASES.OBSERVE) {
      return undefined;
    }
    if (!Number.isFinite(baseExperience.observeStartedAt)) {
      dispatchExperience({
        type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
        sequence: baseExperience.sequence,
        round: baseExperience.round,
        now: nowMs(),
        teachingStepDurationMs: baseExperience.teachingStepDurationMs,
        mistakeAllowance: baseExperience.mistakeAllowance,
      });
      return undefined;
    }
    const transitionAt = getSpatialMemoryNextTransitionAt(baseExperience);
    if (!Number.isFinite(transitionAt)) {
      return undefined;
    }
    const delay = Math.max(0, transitionAt - nowMs()) + 16;
    const timeoutId = globalThis.setTimeout(() => {
      dispatchExperience({
        type: SPATIAL_MEMORY_ACTIONS.TICK,
        now: nowMs(),
      });
    }, delay);
    return () => globalThis.clearTimeout(timeoutId);
  }, [
    baseExperience?.observeStartedAt,
    baseExperience?.phase,
    baseExperience?.teachingIndex,
    baseExperience?.teachingStepDurationMs,
    dispatchExperience,
  ]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = baseExperience?.phase ?? null;
    if (
      baseExperience?.phase === SPATIAL_MEMORY_PHASES.READY &&
      previousPhase === SPATIAL_MEMORY_PHASES.OBSERVE
    ) {
      readyButtonRef.current?.focus({ preventScroll: true });
    } else if (
      baseExperience?.phase === SPATIAL_MEMORY_PHASES.REPRODUCE &&
      previousPhase === SPATIAL_MEMORY_PHASES.READY
    ) {
      firstGestureButtonRef.current?.focus({ preventScroll: true });
    }
  }, [baseExperience?.phase]);

  const experience = useMemo(() => {
    if (
      !isControlled &&
      (state?.status === "completed" || state?.status === "failed") &&
      baseExperience.phase !== SPATIAL_MEMORY_PHASES.RESULT
    ) {
      return buildLegacyResultExperience(baseExperience, state);
    }
    return baseExperience;
  }, [baseExperience, isControlled, state]);
  const presentation = useMemo(
    () => getSpatialMemoryPresentation(experience),
    [experience],
  );
  const phaseIndex = PHASE_STEPS.findIndex(
    (step) => step.id === experience.phase,
  );

  const startOrNextRound = useCallback(() => {
    if (typeof onStart === "function") {
      onStart();
      return;
    }
    if (experience.sequence.length > 0) {
      dispatchExperience({
        type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
        sequence: experience.sequence,
        round:
          experience.phase === SPATIAL_MEMORY_PHASES.RESULT
            ? experience.round + 1
            : experience.round,
        now: nowMs(),
        teachingStepDurationMs,
        mistakeAllowance,
      });
    }
  }, [
    dispatchExperience,
    experience.phase,
    experience.round,
    experience.sequence,
    mistakeAllowance,
    onStart,
    teachingStepDurationMs,
  ]);

  const replayTeaching = useCallback(() => {
    if (!isControlled && typeof onStart === "function") {
      onStart();
      return;
    }
    if (experience.sequence.length === 0) {
      startOrNextRound();
      return;
    }
    dispatchExperience({
      type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
      sequence: experience.sequence,
      round: experience.round,
      now: nowMs(),
      teachingStepDurationMs,
      mistakeAllowance,
    });
  }, [
    dispatchExperience,
    experience.round,
    experience.sequence,
    isControlled,
    mistakeAllowance,
    onStart,
    startOrNextRound,
    teachingStepDurationMs,
  ]);

  const confirmReady = useCallback(() => {
    dispatchExperience({
      type: SPATIAL_MEMORY_ACTIONS.CONFIRM_READY,
      now: nowMs(),
    });
  }, [dispatchExperience]);

  const submitGesture = useCallback(
    (gestureId, source = "accessible-control") => {
      if (!presentation.canSubmitGesture) {
        return;
      }
      const timestamp = nowMs();
      dispatchExperience({
        type: SPATIAL_MEMORY_ACTIONS.GESTURE_INPUT,
        gestureId,
        confidence: 1,
        source,
        now: timestamp,
      });
      if (!isControlled && typeof onGestureInput === "function") {
        onGestureInput(gestureId, {
          confidence: 1,
          source,
          timestamp,
        });
      }
    },
    [
      dispatchExperience,
      isControlled,
      onGestureInput,
      presentation.canSubmitGesture,
    ],
  );

  const reset = useCallback(() => {
    dispatchExperience({
      type: SPATIAL_MEMORY_ACTIONS.RESET,
      round: 1,
    });
    lastLegacySequenceTokenRef.current = null;
    onReset?.();
  }, [dispatchExperience, onReset]);

  const handleShortcut = useCallback(
    (event) => {
      if (
        !presentation.canSubmitGesture ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      const gestureId = GESTURE_BY_SHORTCUT.get(event.key);
      if (!gestureId) {
        return;
      }
      event.preventDefault();
      submitGesture(gestureId, "keyboard-shortcut");
    },
    [presentation.canSubmitGesture, submitGesture],
  );

  const legacyScore = Math.round(state?.score ?? 0);
  const memoryScore = experience.scores?.memoryScore ?? 0;
  const recognitionScore = experience.scores?.recognitionScore ?? 0;
  const resultVisible = experience.phase === SPATIAL_MEMORY_PHASES.RESULT;

  return (
    <section
      className="card panel spatial-memory-panel sgmx-shell sgmx-motion-safe"
      aria-labelledby="spatial-memory-title"
      data-experience-phase={experience.phase}
      onKeyDown={handleShortcut}
    >
      <style>{SPATIAL_MEMORY_STYLES}</style>
      <p
        className="sgmx-sr-only"
        role={resultVisible ? "alert" : "status"}
        aria-live={resultVisible ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {presentation.announcement}
      </p>

      <header className="sgmx-header">
        <div>
          <p className="sgmx-kicker">Memory + movement</p>
          <h2 className="sgmx-title" id="spatial-memory-title">
            Spatial Gesture Memory
          </h2>
          <p className="sgmx-subtitle">
            Learn one gesture at a time. Once hidden, recall the sequence with
            camera gestures or any accessible control below.
          </p>
        </div>
        <span className="sgmx-round-badge">
          Round {experience.round ?? state?.round ?? 1}
        </span>
      </header>

      <PhaseProgress phase={experience.phase} />

      <div className="sgmx-main-grid">
        <div
          className="sgmx-stage"
          aria-label={`${presentation.phaseLabel}: ${presentation.heading}`}
        >
          <ExperienceStage
            experience={experience}
            presentation={presentation}
            onConfirmReady={confirmReady}
            readyButtonRef={readyButtonRef}
          />
        </div>

        <aside className="sgmx-side" aria-label="Round summary">
          <div className="sgmx-panel">
            <h3 className="sgmx-panel-title">
              {resultVisible ? "Sequence review" : "Sequence"}
            </h3>
            <SequenceProgress experience={experience} />
          </div>

          <div className="sgmx-panel">
            <h3 className="sgmx-panel-title">Live score</h3>
            <div className="sgmx-score-grid">
              <ScoreTile
                label="Memory"
                value={`${memoryScore} / 1000`}
                detail={`${experience.completedSteps ?? 0} of ${experience.sequence.length} steps`}
              />
              <ScoreTile
                label="Recognition"
                value={`${recognitionScore} / 1000`}
                detail={`${Math.round((experience.scores?.recognitionAccuracy ?? state?.accuracy ?? 0) * 100)}% input accuracy`}
              />
              <ScoreTile
                label="Forgiving tries"
                value={`${presentation.mistakesRemaining}`}
                detail={`${experience.mistakesUsed ?? 0} used`}
              />
              <ScoreTile
                label={resultVisible ? "Combined" : "Phase"}
                value={
                  resultVisible
                    ? `${experience.scores?.combinedScore ?? legacyScore}`
                    : presentation.phaseLabel
                }
                detail={
                  resultVisible
                    ? legacyScore > 0
                      ? `Legacy game score ${legacyScore}`
                      : "70% memory · 30% recognition"
                    : `${Math.max(0, phaseIndex + 1)} of 4`
                }
              />
            </div>
          </div>

          <div className="sgmx-panel">
            <h3 className="sgmx-panel-title">Status</h3>
            <p
              className="sgmx-live-status"
              data-tone={experience.mistakesUsed > 0 ? "warning" : "neutral"}
            >
              {presentation.announcement}
            </p>
          </div>
        </aside>
      </div>

      <fieldset
        className="sgmx-controls"
        aria-describedby="sgmx-controls-help"
        disabled={!presentation.canSubmitGesture}
      >
        <legend>Accessible gesture controls</legend>
        <p className="sgmx-controls-help" id="sgmx-controls-help">
          Every camera gesture has an equal mouse, touch, and keyboard
          alternative. Controls unlock only during Reproduce.
        </p>
        <div className="sgmx-gesture-grid">
          {GESTURE_DEFINITIONS.map((gesture, index) => {
            const shortcut = SHORTCUT_BY_GESTURE.get(gesture.id);
            return (
              <button
                className="sgmx-gesture-button"
                type="button"
                key={gesture.id}
                onClick={() => submitGesture(gesture.id)}
                ref={index === 0 ? firstGestureButtonRef : undefined}
                aria-label={`Use ${gesture.label} gesture. Keyboard shortcut ${shortcut}.`}
                aria-keyshortcuts={shortcut}
                disabled={!presentation.canSubmitGesture}
              >
                <span className="sgmx-button-icon" aria-hidden="true">
                  {ICON_BY_GESTURE[gesture.id] ?? "✦"}
                </span>
                <span className="sgmx-button-label">{gesture.label}</span>
                <kbd className="sgmx-shortcut" aria-hidden="true">
                  {shortcut}
                </kbd>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="sgmx-actions">
        <div className="sgmx-actions-group">
          {experience.phase === SPATIAL_MEMORY_PHASES.IDLE ||
          experience.phase === SPATIAL_MEMORY_PHASES.RESULT ? (
            <button type="button" onClick={startOrNextRound}>
              {experience.phase === SPATIAL_MEMORY_PHASES.RESULT
                ? "Start next round"
                : "Start round"}
            </button>
          ) : null}
          {experience.sequence.length > 0 &&
          (experience.phase === SPATIAL_MEMORY_PHASES.OBSERVE ||
            experience.phase === SPATIAL_MEMORY_PHASES.READY) ? (
            <button
              type="button"
              className="secondary"
              onClick={replayTeaching}
            >
              Replay teaching
            </button>
          ) : null}
        </div>
        <button type="button" className="secondary" onClick={reset}>
          Reset progress
        </button>
      </div>
    </section>
  );
}
