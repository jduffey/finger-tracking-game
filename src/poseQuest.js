export const POSE_QUEST_HOLD_MS = 1_200;

export const POSE_QUEST_PHASES = Object.freeze({
  READY: "ready",
  RUNNING: "running",
  COMPLETE: "complete",
});

export const POSE_QUEST_ACTIONS = Object.freeze({
  START: "start",
  SAMPLE: "sample",
  SKIP_STEP: "skip-step",
  RESTART: "restart",
});

export const POSE_QUEST_STEPS = Object.freeze([
  Object.freeze({
    id: "frame",
    title: "Find your frame",
    instruction:
      "Keep your head, shoulders, and torso visible inside the camera.",
    requiredParts: Object.freeze(["head", "shoulders", "torso"]),
  }),
  Object.freeze({
    id: "reach",
    title: "Show your reach",
    instruction:
      "Lift both arms into view and keep your fingers where the camera can see them.",
    requiredParts: Object.freeze(["arms", "fingers"]),
  }),
  Object.freeze({
    id: "detail",
    title: "Hold a clear signal",
    instruction:
      "Keep your upper body and fingertips visible together for one final check.",
    requiredParts: Object.freeze([
      "head",
      "shoulders",
      "arms",
      "torso",
      "fingertips",
    ]),
  }),
]);

function normalizeNow(value, fallback = 0) {
  return Math.max(
    fallback,
    Number.isFinite(value) ? value : fallback,
  );
}

function completeCurrentStep(state, { skipped = false } = {}) {
  const step = POSE_QUEST_STEPS[state.stepIndex];
  if (!step) {
    return state;
  }
  const completedStepIds = [...state.completedStepIds, step.id];
  const skippedStepIds = skipped
    ? [...state.skippedStepIds, step.id]
    : state.skippedStepIds;
  const nextIndex = state.stepIndex + 1;
  return {
    ...state,
    phase:
      nextIndex >= POSE_QUEST_STEPS.length
        ? POSE_QUEST_PHASES.COMPLETE
        : POSE_QUEST_PHASES.RUNNING,
    stepIndex: Math.min(nextIndex, POSE_QUEST_STEPS.length - 1),
    completedStepIds,
    skippedStepIds,
    holdStartedAt: null,
    holdProgress: 0,
  };
}

export function createPoseQuestState() {
  return {
    phase: POSE_QUEST_PHASES.READY,
    stepIndex: 0,
    completedStepIds: [],
    skippedStepIds: [],
    holdStartedAt: null,
    holdProgress: 0,
  };
}

export function isPoseQuestStepSatisfied(step, poseStatus) {
  if (!step || !poseStatus?.detected) {
    return false;
  }
  const parts = poseStatus.parts ?? {};
  return step.requiredParts.every((part) => Boolean(parts[part]));
}

export function reducePoseQuest(state, action) {
  const current = state?.phase ? state : createPoseQuestState();
  switch (action?.type) {
    case POSE_QUEST_ACTIONS.START:
      if (current.phase !== POSE_QUEST_PHASES.READY) {
        return current;
      }
      return {
        ...current,
        phase: POSE_QUEST_PHASES.RUNNING,
      };

    case POSE_QUEST_ACTIONS.SAMPLE: {
      if (current.phase !== POSE_QUEST_PHASES.RUNNING) {
        return current;
      }
      const step = POSE_QUEST_STEPS[current.stepIndex];
      if (!isPoseQuestStepSatisfied(step, action.poseStatus)) {
        if (current.holdStartedAt === null && current.holdProgress === 0) {
          return current;
        }
        return {
          ...current,
          holdStartedAt: null,
          holdProgress: 0,
        };
      }
      const now = normalizeNow(action.now);
      const holdStartedAt =
        current.holdStartedAt === null ? now : current.holdStartedAt;
      const holdProgress = Math.min(
        1,
        Math.max(0, (now - holdStartedAt) / POSE_QUEST_HOLD_MS),
      );
      if (holdProgress >= 1) {
        return completeCurrentStep(current);
      }
      return {
        ...current,
        holdStartedAt,
        holdProgress,
      };
    }

    case POSE_QUEST_ACTIONS.SKIP_STEP:
      return current.phase === POSE_QUEST_PHASES.RUNNING
        ? completeCurrentStep(current, { skipped: true })
        : current;

    case POSE_QUEST_ACTIONS.RESTART:
      return createPoseQuestState();

    default:
      return current;
  }
}

export function getPoseQuestProgress(state) {
  const completed = state?.completedStepIds?.length ?? 0;
  return {
    completed,
    total: POSE_QUEST_STEPS.length,
    percent: Math.round((completed / POSE_QUEST_STEPS.length) * 100),
    skipped: state?.skippedStepIds?.length ?? 0,
  };
}
