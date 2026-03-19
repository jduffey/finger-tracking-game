import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyOffAxisState, deriveOffAxisHeadState } from "../src/offAxisHeadTracking.js";

function point(name, u, v, score = 0.9) {
  return { name, u, v, score };
}

test("deriveOffAxisHeadState returns an empty state when pose is missing", () => {
  assert.deepEqual(deriveOffAxisHeadState(null), createEmptyOffAxisState());
});

test("deriveOffAxisHeadState detects a centered head with usable confidence", () => {
  const pose = {
    keypoints: [
      point("nose", 0.5, 0.41),
      point("left_eye", 0.46, 0.36),
      point("right_eye", 0.54, 0.36),
      point("left_ear", 0.41, 0.38, 0.7),
      point("right_ear", 0.59, 0.38, 0.7),
    ],
  };

  const state = deriveOffAxisHeadState(pose);
  assert.equal(state.detected, true);
  assert.match(state.status, /Head tracked|Low-confidence head lock/);
  assert.ok(state.confidence > 0.5);
  assert.ok(Math.abs(state.offsetX) < 0.2);
  assert.ok(Math.abs(state.offsetY) < 0.35);
});

test("deriveOffAxisHeadState reflects lateral movement and depth changes", () => {
  const previous = createEmptyOffAxisState();
  previous.detected = true;

  const pose = {
    keypoints: [
      point("nose", 0.66, 0.39),
      point("left_eye", 0.59, 0.34),
      point("right_eye", 0.71, 0.35),
      point("left_ear", 0.54, 0.37, 0.65),
      point("right_ear", 0.77, 0.39, 0.65),
    ],
  };

  const state = deriveOffAxisHeadState(pose, previous);
  assert.equal(state.detected, true);
  assert.ok(state.offsetX > 0.05);
  assert.ok(state.cameraShiftXPx > 0);
  assert.ok(state.chamberRotationDeg > 0);
  assert.ok(state.depth > 0);
});
