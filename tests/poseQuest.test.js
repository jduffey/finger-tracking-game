import assert from "node:assert/strict";
import test from "node:test";

import {
  POSE_QUEST_ACTIONS,
  POSE_QUEST_HOLD_MS,
  POSE_QUEST_PHASES,
  POSE_QUEST_STEPS,
  createPoseQuestState,
  evaluatePoseQuestStep,
  getPoseQuestProgress,
  isPoseQuestStepSatisfied,
  reducePoseQuest,
} from "../src/poseQuest.js";

function point(name, u, v, score = 0.9, extra = {}) {
  return { name, u, v, score, ...extra };
}

function poseWithKeypoints(keypoints) {
  return {
    detected: true,
    score: 0.9,
    keypoints,
    keypointsCount: keypoints.length,
  };
}

function createReachPose() {
  return poseWithKeypoints([
    point("nose", 0.5, 0.16),
    point("left_shoulder", 0.38, 0.34),
    point("right_shoulder", 0.62, 0.34),
    point("left_elbow", 0.25, 0.35),
    point("right_elbow", 0.75, 0.35),
    point("left_wrist", 0.1, 0.36),
    point("right_wrist", 0.9, 0.36),
    point("left_hip", 0.42, 0.68),
    point("right_hip", 0.58, 0.68),
  ]);
}

function createStatuePose() {
  return poseWithKeypoints([
    point("nose", 0.5, 0.18),
    point("left_shoulder", 0.38, 0.36),
    point("right_shoulder", 0.62, 0.36),
    point("left_elbow", 0.31, 0.25),
    point("right_elbow", 0.69, 0.25),
    point("left_wrist", 0.22, 0.06),
    point("right_wrist", 0.78, 0.06),
  ]);
}

function createStancePose() {
  return poseWithKeypoints([
    point("nose", 0.5, 0.16),
    point("left_shoulder", 0.38, 0.32),
    point("right_shoulder", 0.62, 0.32),
    point("left_elbow", 0.24, 0.48),
    point("right_elbow", 0.76, 0.48),
    point("left_wrist", 0.42, 0.66),
    point("right_wrist", 0.58, 0.66),
    point("left_hip", 0.42, 0.66),
    point("right_hip", 0.58, 0.66),
  ]);
}

test("Pose Quest teaches three distinct held silhouettes", () => {
  assert.deepEqual(
    POSE_QUEST_STEPS.map(({ id }) => id),
    ["reach", "statue", "stance"],
  );

  const poses = [createReachPose(), createStatuePose(), createStancePose()];
  POSE_QUEST_STEPS.forEach((step, index) => {
    const evaluation = evaluatePoseQuestStep(step, poses[index]);
    assert.equal(evaluation.satisfied, true);
    assert.equal(
      evaluation.requirements.every(({ met }) => met),
      true,
    );
    assert.equal(evaluation.nextRequirement, null);
  });
});

test("visible landmarks do not pass until their geometry matches the clue", () => {
  const relaxedPose = poseWithKeypoints([
    point("left_shoulder", 0.38, 0.34),
    point("right_shoulder", 0.62, 0.34),
    point("left_elbow", 0.41, 0.48),
    point("right_elbow", 0.59, 0.48),
    point("left_wrist", 0.43, 0.62),
    point("right_wrist", 0.57, 0.62),
  ]);

  const evaluation = evaluatePoseQuestStep(
    POSE_QUEST_STEPS[0],
    relaxedPose,
  );

  assert.equal(evaluation.requirements[0].met, true);
  assert.equal(evaluation.requirements[1].met, false);
  assert.equal(evaluation.requirements[2].met, false);
  assert.equal(isPoseQuestStepSatisfied(POSE_QUEST_STEPS[0], relaxedPose), false);
});

test("pose checks retain forgiving confidence and frame-edge thresholds", () => {
  const nearEdgePose = createReachPose();
  nearEdgePose.keypoints = nearEdgePose.keypoints.map((keypoint) =>
    keypoint.name === "left_wrist"
      ? { ...keypoint, u: 0, uRaw: -0.03 }
      : keypoint,
  );
  assert.equal(
    isPoseQuestStepSatisfied(POSE_QUEST_STEPS[0], nearEdgePose),
    true,
  );

  const outsideFramePose = {
    ...nearEdgePose,
    keypoints: nearEdgePose.keypoints.map((keypoint) =>
      keypoint.name === "left_wrist"
        ? { ...keypoint, uRaw: -0.05 }
        : keypoint,
    ),
  };
  assert.equal(
    evaluatePoseQuestStep(POSE_QUEST_STEPS[0], outsideFramePose)
      .requirements[0].met,
    false,
  );

  const lowConfidencePose = createStatuePose();
  lowConfidencePose.keypoints = lowConfidencePose.keypoints.map((keypoint) =>
    keypoint.name === "right_wrist"
      ? { ...keypoint, score: 0.19 }
      : keypoint,
  );
  assert.equal(
    isPoseQuestStepSatisfied(POSE_QUEST_STEPS[1], lowConfidencePose),
    false,
  );
});

test("a matched silhouette requires an uninterrupted stable hold", () => {
  let state = reducePoseQuest(createPoseQuestState(), {
    type: POSE_QUEST_ACTIONS.START,
  });
  const matchedPose = createReachPose();
  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SAMPLE,
    poseStatus: matchedPose,
    now: 1_000,
  });
  assert.equal(state.holdProgress, 0);

  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SAMPLE,
    poseStatus: matchedPose,
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

test("completed and explicitly skipped poses produce an honest result", () => {
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

  clearStep(createReachPose(), 1_000);
  state = reducePoseQuest(state, {
    type: POSE_QUEST_ACTIONS.SKIP_STEP,
  });
  clearStep(createStancePose(), 4_000);

  assert.equal(state.phase, POSE_QUEST_PHASES.COMPLETE);
  assert.deepEqual(getPoseQuestProgress(state), {
    completed: 3,
    total: 3,
    percent: 100,
    skipped: 1,
  });
});
