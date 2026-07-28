import test from "node:test";
import assert from "node:assert/strict";

import {
  SPATIAL_MEMORY_ACTIONS,
  SPATIAL_MEMORY_DEFAULTS,
  SPATIAL_MEMORY_PHASES,
  calculateSpatialMemoryScores,
  confirmSpatialMemoryReady,
  createSpatialMemoryExperience,
  getSpatialMemoryNextTransitionAt,
  getSpatialMemoryPresentation,
  getSpatialMemoryTeachingCue,
  isSpatialMemoryComboSupported,
  normalizeSpatialMemorySequence,
  reduceSpatialMemoryExperience,
  registerSpatialMemoryGesture,
  tickSpatialMemoryExperience,
  toSpatialMemoryLegacyState,
} from "../src/spatialMemoryExperience.js";

const SEQUENCE = [
  "swipe_left",
  ["pinch_grab", "open_palm"],
  "circle",
];

function createRound(overrides = {}) {
  return createSpatialMemoryExperience({
    sequence: SEQUENCE,
    now: 1_000,
    teachingStepDurationMs: 1_000,
    mistakeAllowance: 2,
    ...overrides,
  });
}

function advanceToReproduce(state = createRound()) {
  const ready = tickSpatialMemoryExperience(state, { now: 4_000 });
  return confirmSpatialMemoryReady(ready, { now: 4_100 });
}

test("sequence normalization accepts only supported bounded gesture steps", () => {
  const oversizedCombo = [
    "swipe_left",
    "swipe_left",
    "open_palm",
    "circle",
  ];
  const normalized = normalizeSpatialMemorySequence([
    "swipe_right",
    ["not-real"],
    oversizedCombo,
    null,
    ...Array.from(
      { length: SPATIAL_MEMORY_DEFAULTS.maxSequenceLength + 10 },
      () => "pinch_grab",
    ),
  ]);

  assert.deepEqual(normalized[0], "swipe_right");
  assert.deepEqual(normalized[1], ["swipe_left", "open_palm"]);
  assert.equal(
    normalized.length,
    SPATIAL_MEMORY_DEFAULTS.maxSequenceLength - 2,
  );
  assert.deepEqual(normalizeSpatialMemorySequence("not-an-array"), []);
});

test("normalization degrades impossible simultaneous pairs into playable steps", () => {
  assert.equal(
    isSpatialMemoryComboSupported(["pinch_grab", "open_palm"]),
    true,
  );
  assert.equal(
    isSpatialMemoryComboSupported(["expand", "compress"]),
    false,
  );
  assert.equal(
    isSpatialMemoryComboSupported(["pinch_grab", "pinch_release"]),
    false,
  );
  assert.deepEqual(
    normalizeSpatialMemorySequence([
      ["expand", "compress"],
      ["pinch_grab", "pinch_release"],
      ["swipe_left", "open_palm"],
    ]),
    ["expand", "pinch_grab", ["swipe_left", "open_palm"]],
  );
});

test("controlled experiences without a clock remain paused until explicitly started", () => {
  const suspended = createSpatialMemoryExperience({
    sequence: ["circle", "open_palm"],
  });
  assert.equal(suspended.phase, SPATIAL_MEMORY_PHASES.OBSERVE);
  assert.equal(suspended.observeStartedAt, null);
  assert.equal(getSpatialMemoryNextTransitionAt(suspended), null);
  assert.equal(
    tickSpatialMemoryExperience(suspended, { now: 1_000_000 }),
    suspended,
  );

  const started = reduceSpatialMemoryExperience(suspended, {
    type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
    sequence: suspended.sequence,
    now: 25_000,
  });
  assert.equal(started.observeStartedAt, 25_000);
  assert.ok(getSpatialMemoryNextTransitionAt(started) > 25_000);
});

test("Observe reveals exactly one teaching step and advances deterministically", () => {
  const initial = createRound();
  const initialPresentation = getSpatialMemoryPresentation(initial);
  const initialCue = getSpatialMemoryTeachingCue(initial);

  assert.equal(initial.phase, SPATIAL_MEMORY_PHASES.OBSERVE);
  assert.equal(initialPresentation.visibleTeachingStep, "swipe_left");
  assert.equal(initialCue.stepNumber, 1);
  assert.match(initialCue.instruction, /right to left/i);
  assert.equal(getSpatialMemoryNextTransitionAt(initial), 2_000);

  const second = tickSpatialMemoryExperience(initial, { now: 2_250 });
  assert.equal(second.teachingIndex, 1);
  assert.deepEqual(
    getSpatialMemoryPresentation(second).visibleTeachingStep,
    ["pinch_grab", "open_palm"],
  );
  assert.equal(getSpatialMemoryNextTransitionAt(second), 3_000);
  assert.equal(
    tickSpatialMemoryExperience(second, { now: 1_100 }).teachingIndex,
    1,
  );

  const lateTick = tickSpatialMemoryExperience(second, { now: 4_500 });
  assert.equal(lateTick.phase, SPATIAL_MEMORY_PHASES.READY);
  assert.equal(
    getSpatialMemoryPresentation(lateTick).visibleTeachingStep,
    null,
  );
});

test("Ready and Reproduce keep the full sequence hidden from presentation data", () => {
  const ready = tickSpatialMemoryExperience(createRound(), { now: 4_000 });
  const readyPresentation = getSpatialMemoryPresentation(ready);
  assert.equal(readyPresentation.sequenceHidden, true);
  assert.equal(readyPresentation.teachingCue, null);
  assert.equal(readyPresentation.canConfirmReady, true);
  assert.doesNotMatch(readyPresentation.instruction, /swipe|pinch|palm|circle/i);

  const reproduce = confirmSpatialMemoryReady(ready, { now: 4_100 });
  const reproducePresentation = getSpatialMemoryPresentation(reproduce);
  assert.equal(reproduce.phase, SPATIAL_MEMORY_PHASES.REPRODUCE);
  assert.equal(reproducePresentation.sequenceHidden, true);
  assert.equal(reproducePresentation.visibleTeachingStep, null);
  assert.equal(reproducePresentation.canSubmitGesture, true);
  assert.doesNotMatch(
    reproducePresentation.instruction,
    /swipe|pinch|palm|circle/i,
  );
});

test("gesture input is inert until the player explicitly enters Reproduce", () => {
  const observing = createRound();
  assert.equal(
    registerSpatialMemoryGesture(observing, {
      gestureId: "swipe_left",
      now: 1_200,
    }),
    observing,
  );

  const ready = tickSpatialMemoryExperience(observing, { now: 4_000 });
  assert.equal(
    registerSpatialMemoryGesture(ready, {
      gestureId: "swipe_left",
      now: 4_050,
    }),
    ready,
  );
});

test("a correct sequence produces independent perfect memory and recognition scores", () => {
  let state = advanceToReproduce();
  state = registerSpatialMemoryGesture(state, {
    gestureId: "swipe_left",
    source: "camera",
    now: 4_200,
  });
  state = registerSpatialMemoryGesture(state, {
    gestureId: "open_palm",
    source: "accessible-control",
    now: 4_300,
  });
  assert.equal(state.completedSteps, 1);
  assert.deepEqual(state.stepProgressIds, ["open_palm"]);

  state = registerSpatialMemoryGesture(state, {
    gestureId: "pinch_grab",
    source: "keyboard-shortcut",
    now: 4_400,
  });
  state = registerSpatialMemoryGesture(state, {
    gestureId: "circle",
    now: 4_500,
  });

  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.RESULT);
  assert.equal(state.status, "completed");
  assert.equal(state.result.outcome, "success");
  assert.equal(state.result.memoryScore, 1_000);
  assert.equal(state.result.recognitionScore, 1_000);
  assert.equal(state.result.combinedScore, 1_000);
  assert.match(state.announcement, /Memory score 1000/i);
});

test("combined gestures ignore already-counted halves instead of spending a try", () => {
  let state = advanceToReproduce();
  state = registerSpatialMemoryGesture(state, {
    gestureId: "swipe_left",
    now: 4_200,
  });
  state = registerSpatialMemoryGesture(state, {
    gestureId: "pinch_grab",
    now: 4_300,
  });
  const duplicate = registerSpatialMemoryGesture(state, {
    gestureId: "pinch_grab",
    now: 4_350,
  });

  assert.equal(duplicate.attempts, state.attempts);
  assert.equal(duplicate.ignoredInputs, 1);
  assert.equal(duplicate.lastInput.reason, "combo-duplicate");

  const completedCombo = registerSpatialMemoryGesture(duplicate, {
    gestureId: "open_palm",
    now: 4_400,
  });
  assert.equal(completedCombo.completedSteps, 2);
  assert.equal(completedCombo.currentStepIndex, 2);
});

test("combined gesture halves must arrive within the pairing window", () => {
  let state = advanceToReproduce();
  state = registerSpatialMemoryGesture(state, {
    gestureId: "swipe_left",
    now: 4_200,
  });
  state = registerSpatialMemoryGesture(state, {
    gestureId: "pinch_grab",
    now: 4_300,
  });
  const restarted = registerSpatialMemoryGesture(state, {
    gestureId: "open_palm",
    now: 5_600,
  });

  assert.equal(restarted.completedSteps, 1);
  assert.deepEqual(restarted.stepProgressIds, ["open_palm"]);
  assert.equal(restarted.comboStartedAt, 5_600);
  assert.match(restarted.announcement, /window restarted/i);

  const completed = registerSpatialMemoryGesture(restarted, {
    gestureId: "pinch_grab",
    now: 5_700,
  });
  assert.equal(completed.completedSteps, 2);
});

test("one camera frame cannot advance two steps or consume multiple mistakes", () => {
  let state = advanceToReproduce(
    createSpatialMemoryExperience({
      sequence: ["swipe_left", "circle"],
      now: 1_000,
      teachingStepDurationMs: 1_000,
    }),
  );
  state = registerSpatialMemoryGesture(state, {
    gestureId: "open_palm",
    source: "camera",
    frameId: 10,
    now: 4_200,
  });
  const extraWrongEvent = registerSpatialMemoryGesture(state, {
    gestureId: "pinch_grab",
    source: "camera",
    frameId: 10,
    now: 4_200,
  });
  assert.equal(extraWrongEvent.mistakesUsed, 1);
  assert.equal(extraWrongEvent.lastInput.reason, "same-camera-frame");

  state = registerSpatialMemoryGesture(extraWrongEvent, {
    gestureId: "swipe_left",
    source: "camera",
    frameId: 11,
    now: 4_300,
  });
  const prematureNextStep = registerSpatialMemoryGesture(state, {
    gestureId: "circle",
    source: "camera",
    frameId: 11,
    now: 4_300,
  });
  assert.equal(prematureNextStep.completedSteps, 1);
  assert.equal(prematureNextStep.phase, SPATIAL_MEMORY_PHASES.REPRODUCE);
  assert.equal(prematureNextStep.lastInput.reason, "same-camera-frame");

  const completed = registerSpatialMemoryGesture(prematureNextStep, {
    gestureId: "circle",
    source: "camera",
    frameId: 12,
    now: 4_400,
  });
  assert.equal(completed.phase, SPATIAL_MEMORY_PHASES.RESULT);
});

test("one camera frame may contain both compatible halves of a combo", () => {
  const round = createSpatialMemoryExperience({
    sequence: [["pinch_grab", "open_palm"]],
    now: 1_000,
    teachingStepDurationMs: 1_000,
  });
  let state = confirmSpatialMemoryReady(
    tickSpatialMemoryExperience(round, { now: 2_000 }),
    { now: 2_100 },
  );
  state = registerSpatialMemoryGesture(state, {
    gestureId: "pinch_grab",
    source: "camera",
    frameId: "combo-frame",
    now: 2_200,
  });
  state = registerSpatialMemoryGesture(state, {
    gestureId: "open_palm",
    source: "camera",
    frameId: "combo-frame",
    now: 2_200,
  });

  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.RESULT);
  assert.equal(state.result.outcome, "success");
});

test("wrong recognition is forgiving and repeated detector noise costs only one try", () => {
  let state = advanceToReproduce();
  state = registerSpatialMemoryGesture(state, {
    gestureId: "circle",
    now: 4_200,
  });
  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.REPRODUCE);
  assert.equal(state.mistakesUsed, 1);
  assert.equal(getSpatialMemoryPresentation(state).mistakesRemaining, 1);

  const repeatedNoise = registerSpatialMemoryGesture(state, {
    gestureId: "circle",
    now: 4_300,
  });
  assert.equal(repeatedNoise.mistakesUsed, 1);
  assert.equal(repeatedNoise.ignoredInputs, 1);
  assert.equal(repeatedNoise.lastInput.reason, "repeated-false-positive");

  state = registerSpatialMemoryGesture(repeatedNoise, {
    gestureId: "pinch_grab",
    now: 4_800,
  });
  assert.equal(state.mistakesUsed, 2);
  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.REPRODUCE);

  state = registerSpatialMemoryGesture(state, {
    gestureId: "swipe_right",
    now: 5_400,
  });
  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.RESULT);
  assert.equal(state.status, "failed");
  assert.equal(state.result.reason, "mistake-limit");
  assert.equal(state.completedSteps, 0);
});

test("low-confidence recognition events are observable but do not affect scoring", () => {
  const state = advanceToReproduce();
  const ignored = registerSpatialMemoryGesture(state, {
    gestureId: "swipe_left",
    confidence: 0.2,
    now: 4_200,
  });

  assert.equal(ignored.attempts, 0);
  assert.equal(ignored.mistakesUsed, 0);
  assert.equal(ignored.ignoredInputs, 1);
  assert.equal(ignored.lastInput.reason, "low-confidence");
  assert.match(ignored.announcement, /ignored/i);
});

test("memory and recognition scoring measure different failure dimensions", () => {
  const strongMemoryNoisyRecognition = calculateSpatialMemoryScores({
    sequenceLength: 4,
    completedSteps: 4,
    recognitionCorrectInputs: 4,
    attempts: 6,
    mistakesUsed: 2,
    mistakeAllowance: 2,
    outcome: "success",
  });
  const partialMemoryCleanRecognition = calculateSpatialMemoryScores({
    sequenceLength: 4,
    completedSteps: 2,
    recognitionCorrectInputs: 2,
    attempts: 2,
    mistakesUsed: 0,
    mistakeAllowance: 2,
    outcome: "failed",
  });

  assert.equal(strongMemoryNoisyRecognition.memoryScore, 1_000);
  assert.ok(strongMemoryNoisyRecognition.recognitionScore < 1_000);
  assert.equal(partialMemoryCleanRecognition.recognitionScore, 1_000);
  assert.equal(partialMemoryCleanRecognition.memoryScore, 350);
});

test("the reducer exposes deterministic phase actions and reset semantics", () => {
  let state = createSpatialMemoryExperience();
  const idle = state;
  state = reduceSpatialMemoryExperience(state, {
    type: "unknown-action",
  });
  assert.equal(state, idle);

  state = reduceSpatialMemoryExperience(state, {
    type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
    sequence: ["circle", "open_palm"],
    now: 10,
    teachingStepDurationMs: 500,
  });
  state = reduceSpatialMemoryExperience(state, {
    type: SPATIAL_MEMORY_ACTIONS.TICK,
    now: 1_010,
  });
  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.READY);

  state = reduceSpatialMemoryExperience(state, {
    type: SPATIAL_MEMORY_ACTIONS.CONFIRM_READY,
    now: 1_020,
  });
  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.REPRODUCE);

  state = reduceSpatialMemoryExperience(state, {
    type: SPATIAL_MEMORY_ACTIONS.RESET,
  });
  assert.equal(state.phase, SPATIAL_MEMORY_PHASES.IDLE);
  assert.deepEqual(state.sequence, []);
  assert.equal(state.transitionCount, 4);
});

test("the legacy adapter gates expected gesture data until Reproduce", () => {
  const observing = createRound();
  const observingLegacy = toSpatialMemoryLegacyState(observing, {
    highScore: 900,
  });
  assert.equal(observingLegacy.active, true);
  assert.equal(observingLegacy.status, "observing");
  assert.equal(observingLegacy.expectedStep, null);
  assert.equal(observingLegacy.highScore, 900);

  const reproducing = advanceToReproduce(observing);
  const reproducingLegacy = toSpatialMemoryLegacyState(reproducing);
  assert.equal(reproducingLegacy.status, "playing");
  assert.equal(reproducingLegacy.expectedStep, "swipe_left");
  assert.equal(reproducingLegacy.expectedLabel, "Swipe Left");
  assert.equal(reproducingLegacy.memoryScore, 0);
});
