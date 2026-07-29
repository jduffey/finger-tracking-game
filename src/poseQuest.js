export const POSE_QUEST_HOLD_MS = 1_200;
export const POSE_QUEST_MIN_KEYPOINT_SCORE = 0.2;
export const POSE_QUEST_FRAME_MARGIN = 0.04;

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
    id: "reach",
    title: "Airplane reach",
    instruction:
      "Stretch both arms out to the sides like airplane wings.",
    coaching:
      "Face the camera and bring both hands close to shoulder height.",
    silhouette: "reach",
  }),
  Object.freeze({
    id: "statue",
    title: "Victory statue",
    instruction:
      "Lift both hands above your head to make a wide V.",
    coaching:
      "Keep your face and shoulders visible between your raised arms.",
    silhouette: "statue",
  }),
  Object.freeze({
    id: "stance",
    title: "Hero stance",
    instruction:
      "Place both hands near your hips and point your elbows out.",
    coaching:
      "Stand tall enough for your shoulders, elbows, wrists, and hips to stay in frame.",
    silhouette: "stance",
  }),
]);

const STEP_REQUIREMENTS = Object.freeze({
  reach: Object.freeze([
    Object.freeze({
      id: "outline",
      label: "Shoulders, elbows, and wrists visible",
    }),
    Object.freeze({
      id: "wide",
      label: "Both arms reaching out",
    }),
    Object.freeze({
      id: "level",
      label: "Hands near shoulder height",
    }),
  ]),
  statue: Object.freeze([
    Object.freeze({
      id: "outline",
      label: "Face, shoulders, elbows, and wrists visible",
    }),
    Object.freeze({
      id: "raised",
      label: "Both hands above your head",
    }),
    Object.freeze({
      id: "wide",
      label: "Arms spread into a V",
    }),
  ]),
  stance: Object.freeze([
    Object.freeze({
      id: "outline",
      label: "Shoulders, elbows, wrists, and hips visible",
    }),
    Object.freeze({
      id: "hands",
      label: "Both hands close to your hips",
    }),
    Object.freeze({
      id: "elbows",
      label: "Elbows pointing out",
    }),
    Object.freeze({
      id: "upright",
      label: "Torso standing tall",
    }),
  ]),
});

function getRequirementResults(stepId, matches = {}) {
  return (STEP_REQUIREMENTS[stepId] ?? []).map((requirement) => ({
    ...requirement,
    met: Boolean(matches[requirement.id]),
  }));
}

function isUsableKeypoint(point) {
  if (
    !point ||
    !Number.isFinite(point.u) ||
    !Number.isFinite(point.v) ||
    !Number.isFinite(point.score) ||
    point.score < POSE_QUEST_MIN_KEYPOINT_SCORE
  ) {
    return false;
  }
  const u = Number.isFinite(point.uRaw) ? point.uRaw : point.u;
  const v = Number.isFinite(point.vRaw) ? point.vRaw : point.v;
  return (
    u >= -POSE_QUEST_FRAME_MARGIN &&
    u <= 1 + POSE_QUEST_FRAME_MARGIN &&
    v >= -POSE_QUEST_FRAME_MARGIN &&
    v <= 1 + POSE_QUEST_FRAME_MARGIN
  );
}

function getKeypointMap(poseStatus) {
  const map = {};
  for (const point of Array.isArray(poseStatus?.keypoints)
    ? poseStatus.keypoints
    : []) {
    if (point?.name && isUsableKeypoint(point)) {
      map[point.name] = point;
    }
  }
  return map;
}

function hasKeypoints(map, names) {
  return names.every((name) => Boolean(map[name]));
}

function distance(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(a.u - b.u, a.v - b.v);
}

function midpoint(a, b) {
  if (!a || !b) {
    return null;
  }
  return {
    u: (a.u + b.u) / 2,
    v: (a.v + b.v) / 2,
  };
}

function span(a, b) {
  return a && b ? Math.abs(a.u - b.u) : 0;
}

function areOnOppositeSides(a, b, centerU, minimumDistance) {
  if (!a || !b || !Number.isFinite(centerU)) {
    return false;
  }
  const aOffset = a.u - centerU;
  const bOffset = b.u - centerU;
  return (
    aOffset * bOffset < 0 &&
    Math.abs(aOffset) >= minimumDistance &&
    Math.abs(bOffset) >= minimumDistance
  );
}

function evaluateReach(map) {
  const requiredNames = [
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
  ];
  const outline = hasKeypoints(map, requiredNames);
  const shoulderCenter = midpoint(
    map.left_shoulder,
    map.right_shoulder,
  );
  const shoulderSpan = span(map.left_shoulder, map.right_shoulder);
  const minimumOutwardReach = Math.max(0.08, shoulderSpan * 0.62);
  const wristsOpposed = areOnOppositeSides(
    map.left_wrist,
    map.right_wrist,
    shoulderCenter?.u,
    minimumOutwardReach,
  );
  const elbowsOpposed = areOnOppositeSides(
    map.left_elbow,
    map.right_elbow,
    shoulderCenter?.u,
    Math.max(0.05, shoulderSpan * 0.42),
  );
  const wide =
    outline &&
    shoulderSpan >= 0.08 &&
    wristsOpposed &&
    elbowsOpposed &&
    span(map.left_wrist, map.right_wrist) >= shoulderSpan * 1.6;
  const shoulderLineV = shoulderCenter?.v ?? 0;
  const verticalTolerance = Math.max(0.1, shoulderSpan * 0.6);
  const level =
    outline &&
    Math.abs(map.left_wrist.v - shoulderLineV) <= verticalTolerance &&
    Math.abs(map.right_wrist.v - shoulderLineV) <= verticalTolerance &&
    Math.abs(map.left_elbow.v - shoulderLineV) <=
      verticalTolerance * 1.25 &&
    Math.abs(map.right_elbow.v - shoulderLineV) <=
      verticalTolerance * 1.25;
  return { outline, wide, level };
}

function evaluateStatue(map) {
  const requiredNames = [
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
  ];
  const outline = hasKeypoints(map, requiredNames);
  const shoulderCenter = midpoint(
    map.left_shoulder,
    map.right_shoulder,
  );
  const shoulderSpan = span(map.left_shoulder, map.right_shoulder);
  const headTolerance = Math.max(0.035, shoulderSpan * 0.14);
  const raised =
    outline &&
    map.left_wrist.v <= map.nose.v + headTolerance &&
    map.right_wrist.v <= map.nose.v + headTolerance;
  const minimumWristOffset = Math.max(0.07, shoulderSpan * 0.55);
  const wristsOpposed = areOnOppositeSides(
    map.left_wrist,
    map.right_wrist,
    shoulderCenter?.u,
    minimumWristOffset,
  );
  const elbowsBelowHands =
    outline &&
    map.left_elbow.v >= map.left_wrist.v + 0.035 &&
    map.right_elbow.v >= map.right_wrist.v + 0.035;
  const wide =
    outline &&
    shoulderSpan >= 0.08 &&
    wristsOpposed &&
    elbowsBelowHands &&
    span(map.left_wrist, map.right_wrist) >= shoulderSpan * 1.25;
  return { outline, raised, wide };
}

function evaluateStance(map) {
  const requiredNames = [
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
  ];
  const outline = hasKeypoints(map, requiredNames);
  const shoulderCenter = midpoint(
    map.left_shoulder,
    map.right_shoulder,
  );
  const hipCenter = midpoint(map.left_hip, map.right_hip);
  const shoulderSpan = span(map.left_shoulder, map.right_shoulder);
  const torsoHeight = distance(shoulderCenter, hipCenter);
  const handTolerance = Math.max(
    0.11,
    Math.min(0.2, torsoHeight * 0.58),
  );
  const directHandDistances = [
    distance(map.left_wrist, map.left_hip),
    distance(map.right_wrist, map.right_hip),
  ];
  const crossedHandDistances = [
    distance(map.left_wrist, map.right_hip),
    distance(map.right_wrist, map.left_hip),
  ];
  const handDistances =
    directHandDistances[0] + directHandDistances[1] <=
    crossedHandDistances[0] + crossedHandDistances[1]
      ? directHandDistances
      : crossedHandDistances;
  const hands =
    outline &&
    handDistances.every((handDistance) => handDistance <= handTolerance);
  const elbows =
    outline &&
    shoulderSpan >= 0.08 &&
    span(map.left_elbow, map.right_elbow) >= shoulderSpan * 1.18;
  const upright =
    outline &&
    shoulderCenter.v < hipCenter.v &&
    Math.abs(shoulderCenter.u - hipCenter.u) <=
      Math.max(0.08, shoulderSpan * 0.5);
  return { outline, hands, elbows, upright };
}

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

export function evaluatePoseQuestStep(step, poseStatus) {
  const stepId = step?.id;
  let matches = {};
  const keypointMap = getKeypointMap(poseStatus);

  if (poseStatus?.detected) {
    switch (stepId) {
      case "reach":
        matches = evaluateReach(keypointMap);
        break;
      case "statue":
        matches = evaluateStatue(keypointMap);
        break;
      case "stance":
        matches = evaluateStance(keypointMap);
        break;
      default:
        break;
    }
  }

  const requirements = getRequirementResults(stepId, matches);
  const satisfied =
    requirements.length > 0 &&
    requirements.every((requirement) => requirement.met);
  const nextRequirement =
    requirements.find((requirement) => !requirement.met) ?? null;

  return {
    satisfied,
    requirements,
    nextRequirement,
  };
}

export function isPoseQuestStepSatisfied(step, poseStatus) {
  return evaluatePoseQuestStep(step, poseStatus).satisfied;
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
