import assert from "node:assert/strict";
import test from "node:test";

import {
  POSE_QUEST_ACTIONS,
  POSE_QUEST_HOLD_MS,
  POSE_QUEST_PHASES,
  POSE_QUEST_STEPS,
  createPoseQuestState,
  getPoseQuestProgress,
  isPoseQuestStepSatisfied,
  reducePoseQuest,
} from "../src/poseQuest.js";

function poseWith(...visibleParts) {
  return {
    detected: true,
    parts: Object.fromEntries(
      visibleParts.map((part) => [part, true]),
    ),
  };
}

test("Pose Quest teaches three increasingly complete framing checks", () => {
  assert.deepEqual(
    POSE_QUEST_STEPS.map(({ id }) => id),
    ["frame", "reach", "detail"],
  );
  assert.equal(
    isPoseQuestStepSatisfied(
      POSE_QUEST_STEPS[0],
      poseWith("head", "shoulders", "torso"),
    ),
    true,
  );
  assert.equal(
    isPoseQuestStepSatisfied(
      POSE_QUEST_STEPS[0],
      poseWith("head", "shoulders"),
    ),
    false,
  );
});

test("a step requires an uninterrupted stable hold", () => {
  let state = reducePoseQuest(createPoseQuestState(), {
    type: POSE_QUEST_ACTIONS.START,
  });
  const visible = poseWith("head", "shoulders", "torso");
  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SAMPLE,
    poseStatus: visible,
    now: 1_000,
  });
  assert.equal(state.holdProgress, 0);

  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SAMPLE,
    poseStatus: visible,
    now: 1_000 + POSE_QUEST_HOLD_MS / 2,
  });
  assert.equal(state.holdProgress, 0.5);

  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SAMPLE,
    poseStatus: { detected: false },
    now: 1_800,
  });
  assert.equal(state.holdStartedAt, null);
  assert.equal(state.holdProgress, 0);
});

test("completed and explicitly skipped checks produce an honest result", () => {
  let state = reducePoseQuest(createPoseQuestState(), {
    type: POSE_QUEST_ACTIONS.START,
  });
  const clearStep = (poseStatus, now) => {
    state = reducePoseQuest(state, {
      type: POSE_QUEST_ACTIONS.SAMPLE,
      poseStatus,
      now,
    });
    state = reducePoseQuest(state, {
      type: POSE_QUEST_ACTIONS.SAMPLE,
      poseStatus,
      now: now + POSE_QUEST_HOLD_MS,
    });
  };

  clearStep(poseWith("head", "shoulders", "torso"), 1_000);
  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SKIP_STEP,
  });
  clearStep(
    poseWith(
      "head",
      "shoulders",
      "arms",
      "torso",
      "fingertips",
    ),
    4_000,
  );

  assert.equal(state.phase, POSE_QUEST_PHASES.COMPLETE);
  assert.deepEqual(getPoseQuestProgress(state), {
    completed: 3,
    total: 3,
    percent: 100,
    skipped: 1,
  });
});
