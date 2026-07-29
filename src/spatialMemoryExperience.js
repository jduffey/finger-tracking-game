import {
  ALL_GESTURE_IDS,
  GESTURE_DEFINITIONS,
} from "./gestures/constants.js";

export const SPATIAL_MEMORY_EXPERIENCE_VERSION = 1;

export const SPATIAL_MEMORY_PHASES = Object.freeze({
  IDLE: "idle",
  OBSERVE: "observe",
  READY: "ready",
  REPRODUCE: "reproduce",
  RESULT: "result",
});

export const SPATIAL_MEMORY_ACTIONS = Object.freeze({
  START_ROUND: "start-round",
  TICK: "tick",
  CONFIRM_READY: "confirm-ready",
  GESTURE_INPUT: "gesture-input",
  RESET: "reset",
});

export const SPATIAL_MEMORY_DEFAULTS = Object.freeze({
  teachingStepDurationMs: 1_500,
  mistakeAllowance: 2,
  minimumConfidence: 0.7,
  falsePositiveWindowMs: 750,
  comboWindowMs: 1_200,
  maxSequenceLength: 32,
  maxGesturesPerStep: 2,
});

const GESTURE_ID_SET = new Set(ALL_GESTURE_IDS);
const GESTURE_BY_ID = new Map(
  GESTURE_DEFINITIONS.map((gesture) => [gesture.id, gesture]),
);
const INCOMPATIBLE_COMBO_PAIRS = new Set([
  ["pinch_grab", "pinch_release"].sort().join("|"),
  ["swipe_left", "swipe_right"].sort().join("|"),
]);

const TEACHING_INSTRUCTIONS = Object.freeze({
  swipe_left: "Sweep one hand clearly from right to left.",
  swipe_right: "Sweep one hand clearly from left to right.",
  pinch_grab: "Bring your thumb and index finger together.",
  pinch_release: "Open a held pinch into a relaxed hand.",
  open_palm: "Face an open hand toward the camera.",
  push_forward: "Move one open hand gently toward the camera.",
  circle: "Trace one complete circle with your pointer.",
  expand: "Move both hands away from the center.",
  compress: "Move both hands toward the center.",
  rotate_twist: "Turn both hands around a shared center.",
  symmetric_swipe: "Sweep both hands together in the same direction.",
});

function finiteNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finiteNumber(value, 0)));
}

function normalizeTime(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function statusForPhase(phase, outcome = null) {
  if (phase === SPATIAL_MEMORY_PHASES.OBSERVE) {
    return "observing";
  }
  if (phase === SPATIAL_MEMORY_PHASES.READY) {
    return "ready";
  }
  if (phase === SPATIAL_MEMORY_PHASES.REPRODUCE) {
    return "playing";
  }
  if (phase === SPATIAL_MEMORY_PHASES.RESULT) {
    return outcome === "success" ? "completed" : "failed";
  }
  return "idle";
}

export function getSpatialMemoryGestureLabel(gestureId) {
  return GESTURE_BY_ID.get(gestureId)?.label ?? gestureId;
}

export function getSpatialMemoryStepLabel(step) {
  const ids = Array.isArray(step) ? step : [step];
  return ids.map(getSpatialMemoryGestureLabel).join(" + ");
}

export function isSpatialMemoryComboSupported(gestureIds) {
  if (
    !Array.isArray(gestureIds) ||
    gestureIds.length !== 2 ||
    gestureIds[0] === gestureIds[1]
  ) {
    return false;
  }
  const definitions = gestureIds.map((gestureId) =>
    GESTURE_BY_ID.get(gestureId),
  );
  if (
    definitions.some((definition) => !definition) ||
    definitions.some((definition) => definition.group !== "single")
  ) {
    return false;
  }
  return !INCOMPATIBLE_COMBO_PAIRS.has(
    [...gestureIds].sort().join("|"),
  );
}

export function normalizeSpatialMemorySequence(sequence) {
  if (!Array.isArray(sequence)) {
    return [];
  }
  const normalized = [];
  for (const rawStep of sequence.slice(
    0,
    SPATIAL_MEMORY_DEFAULTS.maxSequenceLength,
  )) {
    const candidateIds = Array.isArray(rawStep) ? rawStep : [rawStep];
    const ids = [];
    for (const gestureId of candidateIds) {
      if (
        typeof gestureId === "string" &&
        GESTURE_ID_SET.has(gestureId) &&
        !ids.includes(gestureId)
      ) {
        ids.push(gestureId);
      }
      if (ids.length === SPATIAL_MEMORY_DEFAULTS.maxGesturesPerStep) {
        break;
      }
    }
    if (ids.length === 1) {
      normalized.push(ids[0]);
    } else if (ids.length > 1 && isSpatialMemoryComboSupported(ids)) {
      normalized.push(ids);
    } else if (ids.length > 1) {
      // Retain a playable step rather than allowing an impossible combination.
      normalized.push(ids[0]);
    }
  }
  return normalized;
}

function countGestures(sequence) {
  return sequence.reduce(
    (total, step) => total + (Array.isArray(step) ? step.length : 1),
    0,
  );
}

export function calculateSpatialMemoryScores({
  sequenceLength = 0,
  completedSteps = 0,
  recognitionCorrectInputs = 0,
  attempts = 0,
  mistakesUsed = 0,
  mistakeAllowance = SPATIAL_MEMORY_DEFAULTS.mistakeAllowance,
  outcome = null,
} = {}) {
  const normalizedLength = Math.max(
    0,
    boundedInteger(sequenceLength, 0, 0, SPATIAL_MEMORY_DEFAULTS.maxSequenceLength),
  );
  const normalizedCompleted = Math.min(
    normalizedLength,
    Math.max(0, boundedInteger(completedSteps, 0, 0, normalizedLength)),
  );
  const normalizedAttempts = Math.max(
    0,
    boundedInteger(attempts, 0, 0, Number.MAX_SAFE_INTEGER),
  );
  const normalizedCorrect = Math.min(
    normalizedAttempts,
    Math.max(
      0,
      boundedInteger(
        recognitionCorrectInputs,
        0,
        0,
        normalizedAttempts,
      ),
    ),
  );
  const normalizedAllowance = Math.max(
    0,
    boundedInteger(mistakeAllowance, 0, 0, 10),
  );
  const normalizedMistakes = Math.max(
    0,
    boundedInteger(mistakesUsed, 0, 0, Number.MAX_SAFE_INTEGER),
  );

  const memoryAccuracy =
    normalizedLength > 0 ? normalizedCompleted / normalizedLength : 0;
  const recognitionAccuracy =
    normalizedAttempts > 0 ? normalizedCorrect / normalizedAttempts : 0;
  const restraint =
    1 -
    Math.min(
      1,
      normalizedMistakes / Math.max(1, normalizedAllowance + 1),
    );
  const completionBonus = outcome === "success" ? 300 : 0;
  const memoryScore = Math.round(memoryAccuracy * 700 + completionBonus);
  const recognitionScore =
    normalizedAttempts > 0
      ? Math.round(recognitionAccuracy * 800 + restraint * 200)
      : 0;
  const combinedScore = Math.round(
    memoryScore * 0.7 + recognitionScore * 0.3,
  );

  return {
    memoryAccuracy,
    recognitionAccuracy,
    memoryScore,
    recognitionScore,
    combinedScore,
    maximumScore: 1_000,
  };
}

function calculateScoresForState(state, outcome = state.result?.outcome) {
  return calculateSpatialMemoryScores({
    sequenceLength: state.sequence.length,
    completedSteps: state.completedSteps,
    recognitionCorrectInputs: state.recognitionCorrectInputs,
    attempts: state.attempts,
    mistakesUsed: state.mistakesUsed,
    mistakeAllowance: state.mistakeAllowance,
    outcome,
  });
}

function createIdleState({
  round = 1,
  teachingStepDurationMs = SPATIAL_MEMORY_DEFAULTS.teachingStepDurationMs,
  mistakeAllowance = SPATIAL_MEMORY_DEFAULTS.mistakeAllowance,
  minimumConfidence = SPATIAL_MEMORY_DEFAULTS.minimumConfidence,
  falsePositiveWindowMs = SPATIAL_MEMORY_DEFAULTS.falsePositiveWindowMs,
  comboWindowMs = SPATIAL_MEMORY_DEFAULTS.comboWindowMs,
} = {}) {
  return {
    version: SPATIAL_MEMORY_EXPERIENCE_VERSION,
    phase: SPATIAL_MEMORY_PHASES.IDLE,
    status: "idle",
    active: false,
    round: Math.max(1, boundedInteger(round, 1, 1, 999)),
    sequence: [],
    sequenceLength: 0,
    totalGestureCount: 0,
    teachingIndex: 0,
    observeStartedAt: null,
    phaseStartedAt: null,
    teachingStepDurationMs: boundedInteger(
      teachingStepDurationMs,
      SPATIAL_MEMORY_DEFAULTS.teachingStepDurationMs,
      500,
      10_000,
    ),
    currentStepIndex: 0,
    stepProgressIds: [],
    comboStartedAt: null,
    completedSteps: 0,
    recognitionCorrectInputs: 0,
    attempts: 0,
    ignoredInputs: 0,
    mistakeAllowance: boundedInteger(
      mistakeAllowance,
      SPATIAL_MEMORY_DEFAULTS.mistakeAllowance,
      0,
      10,
    ),
    mistakesUsed: 0,
    minimumConfidence: clamp01(
      finiteNumber(
        minimumConfidence,
        SPATIAL_MEMORY_DEFAULTS.minimumConfidence,
      ),
    ),
    falsePositiveWindowMs: boundedInteger(
      falsePositiveWindowMs,
      SPATIAL_MEMORY_DEFAULTS.falsePositiveWindowMs,
      0,
      5_000,
    ),
    comboWindowMs: boundedInteger(
      comboWindowMs,
      SPATIAL_MEMORY_DEFAULTS.comboWindowMs,
      300,
      5_000,
    ),
    lastInput: null,
    lastMistakeGestureId: null,
    lastMistakeAt: null,
    lastCameraFrameId: null,
    lastCameraDecisionAt: null,
    lastCameraDecisionStepIndex: null,
    result: null,
    scores: calculateSpatialMemoryScores(),
    announcement:
      "Spatial Gesture Memory is ready. Start a round when you are comfortable.",
    transitionCount: 0,
  };
}

export function createSpatialMemoryExperience(options = {}) {
  const idle = createIdleState(options);
  const sequence = normalizeSpatialMemorySequence(options.sequence);
  if (sequence.length === 0) {
    return idle;
  }
  return startSpatialMemoryExperience(idle, {
    ...options,
    sequence,
  });
}

export function startSpatialMemoryExperience(
  previousState,
  {
    sequence,
    now,
    round = previousState?.round ?? 1,
    teachingStepDurationMs =
      previousState?.teachingStepDurationMs ??
      SPATIAL_MEMORY_DEFAULTS.teachingStepDurationMs,
    mistakeAllowance =
      previousState?.mistakeAllowance ??
      SPATIAL_MEMORY_DEFAULTS.mistakeAllowance,
    minimumConfidence =
      previousState?.minimumConfidence ??
      SPATIAL_MEMORY_DEFAULTS.minimumConfidence,
    falsePositiveWindowMs =
      previousState?.falsePositiveWindowMs ??
      SPATIAL_MEMORY_DEFAULTS.falsePositiveWindowMs,
    comboWindowMs =
      previousState?.comboWindowMs ??
      SPATIAL_MEMORY_DEFAULTS.comboWindowMs,
  } = {},
) {
  const normalizedSequence = normalizeSpatialMemorySequence(sequence);
  if (normalizedSequence.length === 0) {
    return {
      ...createIdleState({
        round,
        teachingStepDurationMs,
        mistakeAllowance,
        minimumConfidence,
        falsePositiveWindowMs,
        comboWindowMs,
      }),
      announcement:
        "This round has no usable gestures. Start again to create a new sequence.",
    };
  }
  const startedAt = Number.isFinite(now) ? normalizeTime(now) : null;
  const firstLabel = getSpatialMemoryStepLabel(normalizedSequence[0]);
  const next = {
    ...createIdleState({
      round,
      teachingStepDurationMs,
      mistakeAllowance,
      minimumConfidence,
      falsePositiveWindowMs,
      comboWindowMs,
    }),
    phase: SPATIAL_MEMORY_PHASES.OBSERVE,
    status: statusForPhase(SPATIAL_MEMORY_PHASES.OBSERVE),
    active: true,
    sequence: normalizedSequence,
    sequenceLength: normalizedSequence.length,
    totalGestureCount: countGestures(normalizedSequence),
    observeStartedAt: startedAt,
    phaseStartedAt: startedAt,
    announcement: `Observe step 1 of ${normalizedSequence.length}: ${firstLabel}.`,
    transitionCount: (previousState?.transitionCount ?? 0) + 1,
  };
  return {
    ...next,
    scores: calculateScoresForState(next),
  };
}

export function getSpatialMemoryNextTransitionAt(state) {
  if (
    state?.phase !== SPATIAL_MEMORY_PHASES.OBSERVE ||
    !Number.isFinite(state.observeStartedAt)
  ) {
    return null;
  }
  return (
    state.observeStartedAt +
    (state.teachingIndex + 1) * state.teachingStepDurationMs
  );
}

export function tickSpatialMemoryExperience(state, { now = 0 } = {}) {
  if (
    state?.phase !== SPATIAL_MEMORY_PHASES.OBSERVE ||
    state.sequence.length === 0 ||
    !Number.isFinite(state.observeStartedAt)
  ) {
    return state;
  }
  const timestamp = normalizeTime(now);
  const elapsed = Math.max(0, timestamp - state.observeStartedAt);
  const teachingIndex = Math.max(
    state.teachingIndex,
    Math.floor(elapsed / state.teachingStepDurationMs),
  );
  if (teachingIndex >= state.sequence.length) {
    return {
      ...state,
      phase: SPATIAL_MEMORY_PHASES.READY,
      status: statusForPhase(SPATIAL_MEMORY_PHASES.READY),
      active: true,
      teachingIndex: state.sequence.length,
      phaseStartedAt: timestamp,
      announcement: `The ${state.sequence.length}-step sequence is now hidden. Confirm when you are ready to reproduce it.`,
      transitionCount: state.transitionCount + 1,
    };
  }
  if (teachingIndex === state.teachingIndex) {
    return state;
  }
  return {
    ...state,
    teachingIndex,
    announcement: `Observe step ${teachingIndex + 1} of ${state.sequence.length}: ${getSpatialMemoryStepLabel(state.sequence[teachingIndex])}.`,
    transitionCount: state.transitionCount + 1,
  };
}

export function confirmSpatialMemoryReady(state, { now = 0 } = {}) {
  if (state?.phase !== SPATIAL_MEMORY_PHASES.READY) {
    return state;
  }
  return {
    ...state,
    phase: SPATIAL_MEMORY_PHASES.REPRODUCE,
    status: statusForPhase(SPATIAL_MEMORY_PHASES.REPRODUCE),
    active: true,
    phaseStartedAt: normalizeTime(now),
    currentStepIndex: 0,
    stepProgressIds: [],
    comboStartedAt: null,
    announcement: `Reproduce the hidden sequence. Step 1 of ${state.sequence.length}.`,
    transitionCount: state.transitionCount + 1,
  };
}

function finishExperience(state, { outcome, reason, now }) {
  const scores = calculateScoresForState(state, outcome);
  const success = outcome === "success";
  return {
    ...state,
    phase: SPATIAL_MEMORY_PHASES.RESULT,
    status: statusForPhase(SPATIAL_MEMORY_PHASES.RESULT, outcome),
    active: false,
    phaseStartedAt: normalizeTime(now),
    scores,
    result: {
      outcome,
      reason,
      completedSteps: state.completedSteps,
      sequenceLength: state.sequence.length,
      mistakesUsed: state.mistakesUsed,
      ...scores,
    },
    announcement: success
      ? `Sequence complete. Memory score ${scores.memoryScore}. Recognition score ${scores.recognitionScore}.`
      : `Round ended after ${state.mistakesUsed} mistakes. You recalled ${state.completedSteps} of ${state.sequence.length} steps.`,
    transitionCount: state.transitionCount + 1,
  };
}

export function registerSpatialMemoryGesture(
  state,
  {
    gestureId,
    confidence = 1,
    source = "camera",
    now = 0,
    frameId = null,
  } = {},
) {
  if (
    state?.phase !== SPATIAL_MEMORY_PHASES.REPRODUCE ||
    !GESTURE_ID_SET.has(gestureId)
  ) {
    return state;
  }
  const timestamp = Math.max(
    normalizeTime(now),
    Number.isFinite(state.lastInput?.at) ? state.lastInput.at : 0,
  );
  const normalizedConfidence = clamp01(confidence);
  if (normalizedConfidence < state.minimumConfidence) {
    return {
      ...state,
      ignoredInputs: state.ignoredInputs + 1,
      lastInput: {
        gestureId,
        confidence: normalizedConfidence,
        source,
        accepted: false,
        reason: "low-confidence",
        at: timestamp,
      },
      announcement: "A low-confidence gesture was ignored. Try it once more.",
    };
  }

  const expected = state.sequence[state.currentStepIndex];
  const expectedIds = Array.isArray(expected) ? expected : [expected];
  const comboExpired =
    state.stepProgressIds.length > 0 &&
    Number.isFinite(state.comboStartedAt) &&
    timestamp - state.comboStartedAt > state.comboWindowMs;
  const currentProgressIds = comboExpired ? [] : state.stepProgressIds;
  const sameCameraFrame =
    source === "camera" &&
    ((frameId !== null && frameId === state.lastCameraFrameId) ||
      (frameId === null && timestamp === state.lastCameraDecisionAt));
  const canCompleteCurrentCombo =
    sameCameraFrame &&
    currentProgressIds.length > 0 &&
    expectedIds.includes(gestureId) &&
    !currentProgressIds.includes(gestureId) &&
    state.lastCameraDecisionStepIndex === state.currentStepIndex;
  if (sameCameraFrame && !canCompleteCurrentCombo) {
    return {
      ...state,
      ignoredInputs: state.ignoredInputs + 1,
      lastInput: {
        gestureId,
        confidence: normalizedConfidence,
        source,
        accepted: false,
        reason: "same-camera-frame",
        at: timestamp,
        frameId,
      },
      announcement:
        "An extra detector event from the same camera frame was ignored.",
    };
  }
  if (currentProgressIds.includes(gestureId)) {
    return {
      ...state,
      ignoredInputs: state.ignoredInputs + 1,
      lastInput: {
        gestureId,
        confidence: normalizedConfidence,
        source,
        accepted: false,
        reason: "combo-duplicate",
        at: timestamp,
        frameId,
      },
      announcement:
        "That part of the combined gesture is already counted. Continue with the other part.",
    };
  }

  const isExpected = expectedIds.includes(gestureId);
  if (!isExpected) {
    const isRepeatedFalsePositive =
      state.lastMistakeGestureId === gestureId &&
      Number.isFinite(state.lastMistakeAt) &&
      timestamp - state.lastMistakeAt <= state.falsePositiveWindowMs;
    if (isRepeatedFalsePositive) {
      return {
        ...state,
        ignoredInputs: state.ignoredInputs + 1,
        lastInput: {
          gestureId,
          confidence: normalizedConfidence,
          source,
          accepted: false,
          reason: "repeated-false-positive",
          at: timestamp,
        },
        announcement:
          "A repeated detector event was ignored and did not use another try.",
      };
    }

    const mistakesUsed = state.mistakesUsed + 1;
    const attempts = state.attempts + 1;
    const next = {
      ...state,
      attempts,
      mistakesUsed,
      stepProgressIds: currentProgressIds,
      comboStartedAt: comboExpired ? null : state.comboStartedAt,
      lastMistakeGestureId: gestureId,
      lastMistakeAt: timestamp,
      lastInput: {
        gestureId,
        confidence: normalizedConfidence,
        source,
        accepted: true,
        correct: false,
        at: timestamp,
        frameId,
      },
      lastCameraFrameId: source === "camera" ? frameId : state.lastCameraFrameId,
      lastCameraDecisionAt:
        source === "camera" ? timestamp : state.lastCameraDecisionAt,
      lastCameraDecisionStepIndex:
        source === "camera"
          ? state.currentStepIndex
          : state.lastCameraDecisionStepIndex,
    };
    if (mistakesUsed > state.mistakeAllowance) {
      return finishExperience(next, {
        outcome: "failed",
        reason: "mistake-limit",
        now: timestamp,
      });
    }
    const mistakesRemaining = state.mistakeAllowance - mistakesUsed;
    return {
      ...next,
      scores: calculateScoresForState(next),
      announcement: `That was not the next gesture. ${mistakesRemaining} ${mistakesRemaining === 1 ? "try" : "tries"} remaining; the sequence stays in place.`,
    };
  }

  const stepProgressIds = [...currentProgressIds, gestureId];
  const attempts = state.attempts + 1;
  const recognitionCorrectInputs = state.recognitionCorrectInputs + 1;
  const baseNext = {
    ...state,
    attempts,
    recognitionCorrectInputs,
    stepProgressIds,
    comboStartedAt:
      stepProgressIds.length < expectedIds.length
        ? comboExpired
          ? timestamp
          : state.comboStartedAt ?? timestamp
        : null,
    lastMistakeGestureId: null,
    lastMistakeAt: null,
    lastInput: {
      gestureId,
      confidence: normalizedConfidence,
      source,
      accepted: true,
      correct: true,
      at: timestamp,
      frameId,
    },
    lastCameraFrameId: source === "camera" ? frameId : state.lastCameraFrameId,
    lastCameraDecisionAt:
      source === "camera" ? timestamp : state.lastCameraDecisionAt,
    lastCameraDecisionStepIndex:
      source === "camera"
        ? state.currentStepIndex
        : state.lastCameraDecisionStepIndex,
  };
  if (stepProgressIds.length < expectedIds.length) {
    return {
      ...baseNext,
      scores: calculateScoresForState(baseNext),
      announcement:
        comboExpired
          ? "The combined-gesture window restarted. Add the other gesture now."
          : "First half recognized. Add the other gesture within the pairing window.",
    };
  }

  const completedSteps = state.completedSteps + 1;
  const currentStepIndex = state.currentStepIndex + 1;
  const progressed = {
    ...baseNext,
    completedSteps,
    currentStepIndex,
    stepProgressIds: [],
    comboStartedAt: null,
  };
  if (currentStepIndex >= state.sequence.length) {
    return finishExperience(progressed, {
      outcome: "success",
      reason: "sequence-complete",
      now: timestamp,
    });
  }
  return {
    ...progressed,
    scores: calculateScoresForState(progressed),
    announcement: `Correct. Continue with hidden step ${currentStepIndex + 1} of ${state.sequence.length}.`,
  };
}

export function resetSpatialMemoryExperience(state, options = {}) {
  return {
    ...createIdleState({
      round: options.round ?? state?.round ?? 1,
      teachingStepDurationMs:
        options.teachingStepDurationMs ?? state?.teachingStepDurationMs,
      mistakeAllowance:
        options.mistakeAllowance ?? state?.mistakeAllowance,
      minimumConfidence:
        options.minimumConfidence ?? state?.minimumConfidence,
      falsePositiveWindowMs:
        options.falsePositiveWindowMs ?? state?.falsePositiveWindowMs,
      comboWindowMs: options.comboWindowMs ?? state?.comboWindowMs,
    }),
    transitionCount: (state?.transitionCount ?? 0) + 1,
  };
}

export function reduceSpatialMemoryExperience(state, action = {}) {
  const current = state ?? createSpatialMemoryExperience();
  switch (action.type) {
    case SPATIAL_MEMORY_ACTIONS.START_ROUND:
      return startSpatialMemoryExperience(current, action);
    case SPATIAL_MEMORY_ACTIONS.TICK:
      return tickSpatialMemoryExperience(current, action);
    case SPATIAL_MEMORY_ACTIONS.CONFIRM_READY:
      return confirmSpatialMemoryReady(current, action);
    case SPATIAL_MEMORY_ACTIONS.GESTURE_INPUT:
      return registerSpatialMemoryGesture(current, action);
    case SPATIAL_MEMORY_ACTIONS.RESET:
      return resetSpatialMemoryExperience(current, action);
    default:
      return current;
  }
}

export function getSpatialMemoryTeachingCue(state) {
  if (
    state?.phase !== SPATIAL_MEMORY_PHASES.OBSERVE ||
    state.teachingIndex >= state.sequence.length
  ) {
    return null;
  }
  const step = state.sequence[state.teachingIndex];
  const ids = Array.isArray(step) ? step : [step];
  return {
    step,
    ids,
    label: getSpatialMemoryStepLabel(step),
    description: ids
      .map(
        (gestureId) =>
          GESTURE_BY_ID.get(gestureId)?.description ??
          getSpatialMemoryGestureLabel(gestureId),
      )
      .join(" Then "),
    instruction: ids
      .map(
        (gestureId) =>
          TEACHING_INSTRUCTIONS[gestureId] ??
          `Perform ${getSpatialMemoryGestureLabel(gestureId)}.`,
      )
      .join(" At the same time, "),
    stepNumber: state.teachingIndex + 1,
    stepCount: state.sequence.length,
  };
}

export function getSpatialMemoryPresentation(state) {
  const current =
    state && typeof state === "object"
      ? state
      : createSpatialMemoryExperience();
  const phase = current.phase ?? SPATIAL_MEMORY_PHASES.IDLE;
  const teachingCue = getSpatialMemoryTeachingCue(current);
  const mistakesRemaining = Math.max(
    0,
    (current.mistakeAllowance ?? 0) - (current.mistakesUsed ?? 0),
  );
  const base = {
    phase,
    phaseLabel:
      phase === SPATIAL_MEMORY_PHASES.IDLE
        ? "Start"
        : phase === SPATIAL_MEMORY_PHASES.OBSERVE
          ? "Observe"
          : phase === SPATIAL_MEMORY_PHASES.READY
            ? "Ready"
            : phase === SPATIAL_MEMORY_PHASES.REPRODUCE
              ? "Reproduce"
              : "Result",
    announcement: current.announcement ?? "",
    teachingCue,
    visibleTeachingStep: teachingCue?.step ?? null,
    sequenceHidden:
      phase === SPATIAL_MEMORY_PHASES.READY ||
      phase === SPATIAL_MEMORY_PHASES.REPRODUCE,
    canConfirmReady: phase === SPATIAL_MEMORY_PHASES.READY,
    canSubmitGesture: phase === SPATIAL_MEMORY_PHASES.REPRODUCE,
    mistakesRemaining,
    progress: {
      current:
        phase === SPATIAL_MEMORY_PHASES.OBSERVE
          ? Math.min(current.teachingIndex + 1, current.sequence.length)
          : Math.min(current.currentStepIndex + 1, current.sequence.length),
      completed: current.completedSteps ?? 0,
      total: current.sequence.length,
    },
  };

  if (phase === SPATIAL_MEMORY_PHASES.OBSERVE) {
    return {
      ...base,
      heading: "Watch one gesture at a time",
      instruction:
        "Each gesture appears once. Focus on its direction and position; the whole sequence will be hidden next.",
    };
  }
  if (phase === SPATIAL_MEMORY_PHASES.READY) {
    return {
      ...base,
      heading: "The sequence is hidden",
      instruction:
        "Take a breath and picture the order. Start reproducing only when you feel ready.",
    };
  }
  if (phase === SPATIAL_MEMORY_PHASES.REPRODUCE) {
    return {
      ...base,
      heading: "Reproduce from memory",
      instruction: `Perform hidden step ${Math.min(current.currentStepIndex + 1, current.sequence.length)} of ${current.sequence.length}. Wrong detections are forgiven while tries remain.`,
    };
  }
  if (phase === SPATIAL_MEMORY_PHASES.RESULT) {
    return {
      ...base,
      heading:
        current.result?.outcome === "success"
          ? "Sequence complete"
          : "Good attempt",
      instruction:
        current.result?.outcome === "success"
          ? "Your recall and gesture recognition are scored separately below."
          : "Review the sequence, then try again when you are ready.",
    };
  }
  return {
    ...base,
    heading: "Remember a sequence in space",
    instruction:
      "Start a round to watch a short sequence, hide it, and reproduce it with gestures or accessible controls.",
  };
}

/**
 * Compatibility adapter for App integrations that still consume the original
 * flat spatial-memory shape. Expected gesture data is exposed only while the
 * reducer is in Reproduce; Observe and Ready therefore gate legacy handlers.
 */
export function toSpatialMemoryLegacyState(experience, previousState = {}) {
  const current =
    experience && typeof experience === "object"
      ? experience
      : createSpatialMemoryExperience();
  const scores = current.scores ?? calculateScoresForState(current);
  const isReproducing =
    current.phase === SPATIAL_MEMORY_PHASES.REPRODUCE;
  const expectedStep = isReproducing
    ? current.sequence[current.currentStepIndex] ?? null
    : null;
  return {
    ...previousState,
    active: Boolean(current.active),
    status: current.status,
    round: current.round,
    sequence: current.sequence,
    sequenceLength: current.sequence.length,
    currentStepIndex: current.currentStepIndex,
    stepProgressIds: current.stepProgressIds,
    expectedStep,
    expectedLabel: expectedStep
      ? getSpatialMemoryStepLabel(expectedStep)
      : current.phase === SPATIAL_MEMORY_PHASES.RESULT
        ? "Round complete"
        : current.phase === SPATIAL_MEMORY_PHASES.READY
          ? "Sequence hidden"
          : "Observe",
    message: current.announcement,
    accuracy: scores.recognitionAccuracy,
    score: scores.combinedScore,
    memoryScore: scores.memoryScore,
    recognitionScore: scores.recognitionScore,
    attempts: current.attempts,
    correctSteps: current.completedSteps,
    mistakesUsed: current.mistakesUsed,
    mistakeAllowance: current.mistakeAllowance,
  };
}
