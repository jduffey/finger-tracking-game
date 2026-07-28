import { useEffect, useReducer, useRef } from "react";

import {
  POSE_QUEST_ACTIONS,
  POSE_QUEST_PHASES,
  POSE_QUEST_STEPS,
  createPoseQuestState,
  evaluatePoseQuestStep,
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

const POSE_SILHOUETTES = Object.freeze({
  reach: Object.freeze({
    segments: Object.freeze([
      Object.freeze([50, 29, 50, 66]),
      Object.freeze([50, 38, 28, 38]),
      Object.freeze([28, 38, 10, 38]),
      Object.freeze([50, 38, 72, 38]),
      Object.freeze([72, 38, 90, 38]),
      Object.freeze([50, 66, 35, 91]),
      Object.freeze([50, 66, 65, 91]),
    ]),
    joints: Object.freeze([
      Object.freeze([28, 38]),
      Object.freeze([10, 38]),
      Object.freeze([72, 38]),
      Object.freeze([90, 38]),
    ]),
  }),
  statue: Object.freeze({
    segments: Object.freeze([
      Object.freeze([50, 29, 50, 66]),
      Object.freeze([50, 38, 35, 29]),
      Object.freeze([35, 29, 22, 8]),
      Object.freeze([50, 38, 65, 29]),
      Object.freeze([65, 29, 78, 8]),
      Object.freeze([50, 66, 35, 91]),
      Object.freeze([50, 66, 65, 91]),
    ]),
    joints: Object.freeze([
      Object.freeze([35, 29]),
      Object.freeze([22, 8]),
      Object.freeze([65, 29]),
      Object.freeze([78, 8]),
    ]),
  }),
  stance: Object.freeze({
    segments: Object.freeze([
      Object.freeze([50, 29, 50, 66]),
      Object.freeze([50, 38, 27, 48]),
      Object.freeze([27, 48, 40, 65]),
      Object.freeze([50, 38, 73, 48]),
      Object.freeze([73, 48, 60, 65]),
      Object.freeze([50, 66, 35, 91]),
      Object.freeze([50, 66, 65, 91]),
    ]),
    joints: Object.freeze([
      Object.freeze([27, 48]),
      Object.freeze([40, 65]),
      Object.freeze([73, 48]),
      Object.freeze([60, 65]),
    ]),
  }),
});

function PoseSilhouette({ stepId }) {
  const silhouette = POSE_SILHOUETTES[stepId] ?? POSE_SILHOUETTES.reach;
  return (
    <svg
      aria-hidden="true"
      className="pose-quest-silhouette"
      focusable="false"
      viewBox="0 0 100 100"
    >
      <circle cx="50" cy="19" r="9" />
      {silhouette.segments.map(([x1, y1, x2, y2], index) => (
        <line
          key={`${x1}-${y1}-${x2}-${y2}-${index}`}
          x1={x1}
          x2={x2}
          y1={y1}
          y2={y2}
        />
      ))}
      {silhouette.joints.map(([cx, cy], index) => (
        <circle
          className="pose-quest-silhouette-joint"
          cx={cx}
          cy={cy}
          key={`${cx}-${cy}-${index}`}
          r="2.8"
        />
      ))}
    </svg>
  );
}

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
  const stepEvaluation = evaluatePoseQuestStep(currentStep, poseStatus);
  const detected = Boolean(poseStatus?.detected);
  const parts = poseStatus?.parts ?? {};
  const detectionCopy = !detected
    ? "Step into frame"
    : stepEvaluation.satisfied
      ? "Pose matched · hold steady"
      : `Next: ${stepEvaluation.nextRequirement?.label ?? "Match the silhouette"}`;

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
            Match three playful silhouettes and hold each pose steady. Nothing
            is recorded or uploaded.
          </p>
        </div>
        <span
          className={`pose-quest-detection ${
            stepEvaluation.satisfied ? "ready" : ""
          }`}
          role="status"
        >
          {detectionCopy}
        </span>
      </header>

      {quest.phase === POSE_QUEST_PHASES.READY ? (
        <div className="pose-quest-intro">
          <span aria-hidden="true">◇</span>
          <h3>Three poses. About 20 seconds.</h3>
          <p>
            Copy each silhouette, or skip any pose with the keyboard, pointer,
            or touch if body tracking is not comfortable for you.
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
          <h3>Pose Quest complete.</h3>
          <p>
            {progress.skipped === 0
              ? "You matched and held all three silhouettes."
              : `${progress.completed - progress.skipped} ${
                  progress.completed - progress.skipped === 1
                    ? "pose"
                    : "poses"
                } held · ${progress.skipped} skipped.`}
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
              <PoseSilhouette stepId={currentStep.silhouette} />
              <span className="pose-quest-hold-value">
                {Math.round(quest.holdProgress * 100)}%
              </span>
            </div>
            <div>
              <h3>{currentStep.instruction}</h3>
              <p>{currentStep.coaching}</p>
              <ul aria-label="Pose clues">
                {stepEvaluation.requirements.map((requirement) => (
                  <li
                    className={requirement.met ? "visible" : ""}
                    key={requirement.id}
                  >
                    <span aria-hidden="true">
                      {requirement.met ? "✓" : "○"}
                    </span>
                    {requirement.label}
                  </li>
                ))}
              </ul>
              <p className="pose-quest-hold-note">
                Match the clues, then stay steady until the ring completes.
                Moving out of frame safely resets the hold.
              </p>
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
              Skip this pose
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
          <div>
            <strong>Current silhouette</strong>
            <span>
              {stepEvaluation.satisfied
                ? "matched"
                : stepEvaluation.nextRequirement?.id ?? "not detected"}
            </span>
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
