import test from "node:test";
import assert from "node:assert/strict";
import { computeFistClenchMeta, HAND_LANDMARK_INDEX } from "../src/fistDetection.js";

function createPoint(u, v) {
  return { u, v };
}

function createPoint3D(x, y, z) {
  return { x, y, z };
}

function createLandmarks(pointMap) {
  const landmarks = Array.from({ length: 21 }, () => null);
  for (const [index, point] of Object.entries(pointMap)) {
    landmarks[Number(index)] = point;
  }
  return landmarks;
}

function createHand({ landmarks, landmarks3D = null }) {
  return {
    landmarks,
    landmarks3D,
  };
}

function createOpenHand() {
  return createHand({
    landmarks: createLandmarks({
      0: createPoint(0.5, 0.82),
      1: createPoint(0.42, 0.75),
      2: createPoint(0.35, 0.69),
      3: createPoint(0.27, 0.62),
      4: createPoint(0.19, 0.56),
      5: createPoint(0.44, 0.64),
      6: createPoint(0.42, 0.5),
      7: createPoint(0.4, 0.36),
      8: createPoint(0.39, 0.22),
      9: createPoint(0.5, 0.62),
      10: createPoint(0.5, 0.46),
      11: createPoint(0.5, 0.3),
      12: createPoint(0.5, 0.14),
      13: createPoint(0.56, 0.64),
      14: createPoint(0.58, 0.5),
      15: createPoint(0.6, 0.37),
      16: createPoint(0.62, 0.24),
      17: createPoint(0.62, 0.68),
      18: createPoint(0.66, 0.57),
      19: createPoint(0.69, 0.46),
      20: createPoint(0.72, 0.36),
    }),
  });
}

function createClosedFist() {
  return createHand({
    landmarks: createLandmarks({
      0: createPoint(0.5, 0.82),
      1: createPoint(0.42, 0.75),
      2: createPoint(0.46, 0.72),
      3: createPoint(0.5, 0.7),
      4: createPoint(0.54, 0.69),
      5: createPoint(0.44, 0.66),
      6: createPoint(0.47, 0.61),
      7: createPoint(0.5, 0.62),
      8: createPoint(0.54, 0.67),
      9: createPoint(0.5, 0.65),
      10: createPoint(0.52, 0.6),
      11: createPoint(0.55, 0.61),
      12: createPoint(0.58, 0.67),
      13: createPoint(0.56, 0.66),
      14: createPoint(0.57, 0.62),
      15: createPoint(0.6, 0.63),
      16: createPoint(0.62, 0.68),
      17: createPoint(0.61, 0.69),
      18: createPoint(0.62, 0.66),
      19: createPoint(0.64, 0.67),
      20: createPoint(0.66, 0.71),
    }),
  });
}

function createForeshortenedOpenHand3D() {
  const landmarks = createLandmarks({
    0: createPoint(0.5, 0.8),
    1: createPoint(0.43, 0.74),
    2: createPoint(0.38, 0.71),
    3: createPoint(0.33, 0.69),
    4: createPoint(0.28, 0.68),
    5: createPoint(0.45, 0.64),
    6: createPoint(0.44, 0.59),
    7: createPoint(0.43, 0.55),
    8: createPoint(0.42, 0.51),
    9: createPoint(0.5, 0.63),
    10: createPoint(0.5, 0.58),
    11: createPoint(0.5, 0.54),
    12: createPoint(0.5, 0.5),
    13: createPoint(0.55, 0.64),
    14: createPoint(0.56, 0.59),
    15: createPoint(0.57, 0.55),
    16: createPoint(0.58, 0.51),
    17: createPoint(0.6, 0.66),
    18: createPoint(0.62, 0.62),
    19: createPoint(0.64, 0.58),
    20: createPoint(0.66, 0.55),
  });
  const landmarks3D = createLandmarks({
    [HAND_LANDMARK_INDEX.WRIST]: createPoint3D(0, 0.05, 0.04),
    [HAND_LANDMARK_INDEX.THUMB_CMC]: createPoint3D(-0.03, 0.03, 0.03),
    [HAND_LANDMARK_INDEX.THUMB_MCP]: createPoint3D(-0.05, 0.015, 0.015),
    [HAND_LANDMARK_INDEX.THUMB_IP]: createPoint3D(-0.07, 0.0, -0.005),
    [HAND_LANDMARK_INDEX.THUMB_TIP]: createPoint3D(-0.09, -0.015, -0.025),
    [HAND_LANDMARK_INDEX.INDEX_MCP]: createPoint3D(-0.025, 0, 0.02),
    [HAND_LANDMARK_INDEX.INDEX_PIP]: createPoint3D(-0.028, -0.035, -0.005),
    [HAND_LANDMARK_INDEX.INDEX_DIP]: createPoint3D(-0.03, -0.07, -0.03),
    [HAND_LANDMARK_INDEX.INDEX_TIP]: createPoint3D(-0.032, -0.105, -0.055),
    [HAND_LANDMARK_INDEX.MIDDLE_MCP]: createPoint3D(0, -0.002, 0.02),
    [HAND_LANDMARK_INDEX.MIDDLE_PIP]: createPoint3D(0, -0.04, -0.005),
    [HAND_LANDMARK_INDEX.MIDDLE_DIP]: createPoint3D(0, -0.078, -0.03),
    [HAND_LANDMARK_INDEX.MIDDLE_TIP]: createPoint3D(0, -0.116, -0.056),
    [HAND_LANDMARK_INDEX.RING_MCP]: createPoint3D(0.025, 0, 0.022),
    [HAND_LANDMARK_INDEX.RING_PIP]: createPoint3D(0.028, -0.034, -0.002),
    [HAND_LANDMARK_INDEX.RING_DIP]: createPoint3D(0.03, -0.068, -0.026),
    [HAND_LANDMARK_INDEX.RING_TIP]: createPoint3D(0.032, -0.102, -0.05),
    [HAND_LANDMARK_INDEX.PINKY_MCP]: createPoint3D(0.05, 0.008, 0.026),
    [HAND_LANDMARK_INDEX.PINKY_PIP]: createPoint3D(0.064, -0.02, 0.005),
    [HAND_LANDMARK_INDEX.PINKY_DIP]: createPoint3D(0.078, -0.048, -0.015),
    [HAND_LANDMARK_INDEX.PINKY_TIP]: createPoint3D(0.092, -0.076, -0.035),
  });

  return createHand({ landmarks, landmarks3D });
}

test("open hand stays inactive", () => {
  const meta = computeFistClenchMeta(createOpenHand(), false);

  assert.equal(meta.active, false);
  assert.equal(meta.nonThumbExtendedCount >= 2, true);
  assert.equal(meta.nonThumbCurledCount, 0);
});

test("closed fist activates", () => {
  const meta = computeFistClenchMeta(createClosedFist(), false);

  assert.equal(meta.active, true);
  assert.equal(meta.nonThumbCurledCount >= 3, true);
  assert.equal(meta.nonThumbExtendedCount, 0);
});

test("foreshortened open palm stays inactive when 3D landmarks show finger extension", () => {
  const meta = computeFistClenchMeta(createForeshortenedOpenHand3D(), true);

  assert.equal(meta.active, false);
  assert.equal(meta.nonThumbExtendedCount >= 2, true);
});
