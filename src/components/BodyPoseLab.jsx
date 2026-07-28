import { useEffect, useReducer, useRef } from "react";

import {
  POSE_QUEST_ACTIONS,
  POSE_QUEST_PHASES,
  POSE_QUEST_STEPS,
  createPoseQuestState,
  getPoseQuestProgress,
  reducePoseQuest,
} from "../poseQuest.js";
import "./BodyPoseLab.css";

const PART_LABELS = Object.freeze({
  head: "head",
  eyes: "eyes",
  shoulders: "shoulders",
  arms: "arms",
  torso: "torso",
  fingers: "fingers",
  fingertips: "fingertips",
});

export default function BodyPoseLab({ poseStatus }) {
  const [quest, dispatch] = useReducer(
    reducePoseQuest,
    undefined,
    createPoseQuestState,
  );
  const poseStatusRef = useRef(poseStatus);
  poseStatusRef.current = poseStatus;
  const progress = getPoseQuestProgress(quest);
  const currentStep = POSE_QUEST_STEPS[quest.stepIndex];
  const detected = Boolean(poseStatus?.detected);
  const parts = poseStatus?.parts ?? {};

  useEffect(() => {
    if (quest.phase !== POSE_QUEST_PHASES.RUNNING) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      dispatch({
        type: POSE_QUEST_ACTIONS.SAMPLE,
        poseStatus: poseStatusRef.current,
        now: globalThis.performance?.now?.() ?? Date.now(),
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [quest.phase]);

  return (
    <section
      aria-labelledby="pose-quest-title"
      className="card panel body-pose-panel pose-quest"
    >
      <header className="pose-quest-header">
        <div>
          <span className="pose-quest-kicker">Experimental body lab</span>
          <h2 id="pose-quest-title">Pose Quest</h2>
          <p>
            Clear three short visibility checks to learn where body tracking
            works best. Nothing is recorded or uploaded.
          </p>
        </div>
        <span
          className={`pose-quest-detection ${detected ? "ready" : ""}`}
          role="status"
        >
          {detected ? "Pose visible" : "Step into frame"}
        </span>
      </header>

      {quest.phase === POSE_QUEST_PHASES.READY ? (
        <div className="pose-quest-intro">
          <span aria-hidden="true">◇</span>
          <h3>Three checks. About 20 seconds.</h3>
          <p>
            Use the camera challenge, or skip any check with the keyboard,
            pointer, or touch if body tracking is not comfortable for you.
          </p>
          <button
            onClick={() =>
              dispatch({ type: POSE_QUEST_ACTIONS.START })
            }
            type="button"
          >
            Start Pose Quest
          </button>
        </div>
      ) : quest.phase === POSE_QUEST_PHASES.COMPLETE ? (
        <div
          aria-live="polite"
          className="pose-quest-result"
          role="status"
        >
          <span aria-hidden="true">✓</span>
          <h3>Your tracking space is mapped.</h3>
          <p>
            {progress.skipped === 0
              ? "All three camera checks stayed clear."
              : `${progress.completed - progress.skipped} camera ${
                  progress.completed - progress.skipped === 1
                    ? "check"
                    : "checks"
                } cleared · ${progress.skipped} skipped.`}
          </p>
          <button
            onClick={() =>
              dispatch({ type: POSE_QUEST_ACTIONS.RESTART })
            }
            type="button"
          >
            Run it again
          </button>
        </div>
      ) : (
        <div className="pose-quest-active">
          <div className="pose-quest-progress-copy">
            <span>
              Check {quest.stepIndex + 1} of {POSE_QUEST_STEPS.length}
            </span>
            <strong>{currentStep.title}</strong>
          </div>
          <div
            aria-label={`${progress.percent}% of checks complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress.percent}
            className="pose-quest-overall-progress"
            role="progressbar"
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>

          <div className="pose-quest-challenge">
            <div
              aria-label={`${Math.round(
                quest.holdProgress * 100,
              )}% steady`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(quest.holdProgress * 100)}
              className="pose-quest-hold"
              role="progressbar"
              style={{ "--pose-hold": quest.holdProgress }}
            >
              <span
                style={{
                  transform: `scale(${0.72 + quest.holdProgress * 0.28})`,
                }}
              >
                {Math.round(quest.holdProgress * 100)}%
              </span>
            </div>
            <div>
              <h3>{currentStep.instruction}</h3>
              <p>
                Hold the required areas in view until the ring completes.
                Moving out of frame safely resets this check.
              </p>
              <ul aria-label="Required visible areas">
                {currentStep.requiredParts.map((part) => (
                  <li className={parts[part] ? "visible" : ""} key={part}>
                    <span aria-hidden="true">
                      {parts[part] ? "✓" : "○"}
                    </span>
                    {PART_LABELS[part]}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pose-quest-actions">
            <button
              className="secondary"
              onClick={() =>
                dispatch({ type: POSE_QUEST_ACTIONS.SKIP_STEP })
              }
              type="button"
            >
              Skip this tracking check
            </button>
            <button
              className="quiet"
              onClick={() =>
                dispatch({ type: POSE_QUEST_ACTIONS.RESTART })
              }
              type="button"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      <details className="pose-quest-diagnostics">
        <summary>Advanced pose diagnostics</summary>
        <div className="body-pose-status-grid">
          <div>
            <strong>Pose</strong>
            <span>{detected ? "detected" : "not detected"}</span>
          </div>
          <div>
            <strong>Confidence</strong>
            <span>
              {Number.isFinite(poseStatus?.score)
                ? poseStatus.score.toFixed(3)
                : "0.000"}
            </span>
          </div>
          <div>
            <strong>Keypoints</strong>
            <span>{poseStatus?.keypointsCount ?? 0}</span>
          </div>
        </div>
        <div className="body-part-list">
          {Object.entries(PART_LABELS).map(([part, label]) => (
            <div className={parts[part] ? "active" : "inactive"} key={part}>
              {label}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
