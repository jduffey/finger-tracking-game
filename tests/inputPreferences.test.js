import test from "node:test";
import assert from "node:assert/strict";

import {
  adaptHandForCamera,
  adaptPoseForCamera,
  expandPointerRangeForSeatedPlay,
  getCursorSmoothingAlpha,
  getPinchThresholds,
  selectPreferredHand,
} from "../src/inputPreferences.js";

test("selectPreferredHand honors a visible dominant hand and falls back safely", () => {
  const hands = [
    { id: "left", label: "Left" },
    { id: "right", label: "Right" },
  ];

  assert.equal(selectPreferredHand(hands, "right")?.id, "right");
  assert.equal(selectPreferredHand(hands, "left")?.id, "left");
  assert.equal(
    selectPreferredHand(
      [
        { id: "first", handedness: "Right" },
        { id: "second", handedness: "Left" },
      ],
      "left",
    )?.id,
    "second",
  );
  assert.equal(selectPreferredHand([hands[0]], "right")?.id, "left");
  assert.equal(selectPreferredHand([], "left"), null);
});

test("cursor smoothing keeps the historic default while higher values steady more", () => {
  assert.equal(getCursorSmoothingAlpha(0.35), 0.35);
  assert.ok(getCursorSmoothingAlpha(0.8) < getCursorSmoothingAlpha(0.35));
  assert.ok(getCursorSmoothingAlpha(0.1) > getCursorSmoothingAlpha(0.35));
});

test("pinch sensitivity preserves hysteresis around the chosen start threshold", () => {
  assert.deepEqual(getPinchThresholds(0.045), {
    start: 0.045,
    end: 0.06,
  });
  assert.deepEqual(getPinchThresholds(0.09), {
    start: 0.09,
    end: 0.105,
  });
});

test("seated play expands a smaller movement range without changing its default", () => {
  const point = { u: 0.25, v: 0.25, confidence: 0.9 };
  assert.equal(expandPointerRangeForSeatedPlay(point, false), point);
  assert.deepEqual(expandPointerRangeForSeatedPlay(point, true), {
    u: 0.21999999999999997,
    v: 0.18,
    confidence: 0.9,
  });
  assert.deepEqual(
    expandPointerRangeForSeatedPlay({ u: 0, v: 1 }, true),
    { u: 0, v: 1 },
  );
});

test("camera adaptation flips hand and pose coordinates only in direct-view mode", () => {
  const hand = {
    label: "Right",
    indexTip: { u: 0.8, v: 0.2, uRaw: 0.82 },
    thumbTip: { u: 0.7, v: 0.3, uRaw: 0.72 },
    fingerTips: {
      index: { u: 0.8, v: 0.2, uRaw: 0.82 },
      thumb: { u: 0.7, v: 0.3, uRaw: 0.72 },
    },
    landmarks: [{ u: 0.9, v: 0.4, uRaw: 0.92 }, null],
  };
  const pose = {
    keypoints: [{ name: "nose", u: 0.75, v: 0.1, uRaw: 0.76 }],
  };

  assert.equal(adaptHandForCamera(hand, true), hand);
  assert.equal(adaptPoseForCamera(pose, true), pose);

  const directHand = adaptHandForCamera(hand, false);
  assert.ok(Math.abs(directHand.indexTip.u - 0.2) < 1e-12);
  assert.ok(Math.abs(directHand.indexTip.uRaw - 0.18) < 1e-12);
  assert.ok(Math.abs(directHand.landmarks[0].u - 0.1) < 1e-12);
  assert.equal(directHand.landmarks[1], null);

  const directPose = adaptPoseForCamera(pose, false);
  assert.equal(directPose.keypoints[0].u, 0.25);
  assert.ok(Math.abs(directPose.keypoints[0].uRaw - 0.24) < 1e-12);
});
