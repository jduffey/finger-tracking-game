import test from "node:test";
import assert from "node:assert/strict";
import { detectPose, detectPoses, getLastPoseMeta } from "../src/poseTracking.js";

function createPose(id, xOffset = 0) {
  return {
    id,
    score: 0.9,
    keypoints: [
      { name: "nose", x: 20 + xOffset, y: 30, score: 0.95 },
      { name: "left_wrist", x: 35 + xOffset, y: 90, score: 0.8 },
      { name: "right_wrist", x: 65 + xOffset, y: 90, score: 0.82 },
    ],
  };
}

function createVideo() {
  return {
    readyState: 2,
    videoWidth: 100,
    videoHeight: 200,
  };
}

test("detectPoses returns normalized multi-pose results up to the requested max", async () => {
  let estimateConfig = null;
  const detector = {
    async estimatePoses(_video, config) {
      estimateConfig = config;
      return [createPose("person-1"), createPose("person-2", 10)];
    },
  };

  const poses = await detectPoses(detector, createVideo(), { maxPoses: 4 });

  assert.deepEqual(estimateConfig, { maxPoses: 4, flipHorizontal: false });
  assert.equal(poses.length, 2);
  assert.equal(poses[0].id, "person-1");
  assert.equal(poses[0].keypoints[0].u, 0.8);
  assert.equal(poses[0].keypoints[0].v, 0.15);
  assert.deepEqual(getLastPoseMeta(), {
    posesDetected: 2,
    invalid: false,
    reason: "ok",
  });
});

test("detectPose keeps the first-pose compatibility API", async () => {
  let estimateConfig = null;
  const detector = {
    async estimatePoses(_video, config) {
      estimateConfig = config;
      return [createPose("person-1")];
    },
  };

  const pose = await detectPose(detector, createVideo());

  assert.deepEqual(estimateConfig, { maxPoses: 1, flipHorizontal: false });
  assert.equal(pose.id, "person-1");
});
