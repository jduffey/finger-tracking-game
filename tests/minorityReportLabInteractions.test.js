import test from "node:test";
import assert from "node:assert/strict";
import {
  getMinorityReportAnchoredZoomTransform,
  getMinorityReportFocusTransform,
  getMinorityReportZoomTransform,
  normalizeMinorityReportStageTransform,
  shouldUseMinorityReportZoom,
} from "../src/minorityReportLabInteractions.js";

test("shouldUseMinorityReportZoom activates as soon as both hands are pinching", () => {
  assert.equal(
    shouldUseMinorityReportZoom(
      {
        present: true,
        pinchBothActive: true,
      },
      {
        twoHandManipulationActive: false,
      },
    ),
    true,
  );
});

test("shouldUseMinorityReportZoom stays off when two-hand pinch is not active", () => {
  assert.equal(
    shouldUseMinorityReportZoom(
      {
        present: true,
        pinchBothActive: false,
      },
      {
        twoHandManipulationActive: false,
      },
    ),
    false,
  );
});

test("getMinorityReportZoomTransform keeps stage zoom-only and clamps scale", () => {
  assert.deepEqual(
    getMinorityReportZoomTransform(
      { x: 120, y: -44, scale: 1.3, rotation: 1.2 },
      0.5,
      1,
    ),
    { x: 120, y: -44, scale: 2.6, rotation: 0 },
  );
});

test("normalizeMinorityReportStageTransform clears stage translation and rotation", () => {
  assert.deepEqual(
    normalizeMinorityReportStageTransform({ x: 75, y: 30, scale: 0.8, rotation: 0.9 }),
    { x: 75, y: 30, scale: 0.8, rotation: 0 },
  );
});

test("getMinorityReportFocusTransform centers a sector and scales it toward fullscreen", () => {
  assert.deepEqual(
    getMinorityReportFocusTransform(
      { width: 960, height: 640 },
      { centerX: 160, centerY: 120, width: 260, height: 180 },
    ),
    {
      x: 832,
      y: 520,
      scale: 2.6,
      rotation: 0,
    },
  );
});

test("getMinorityReportAnchoredZoomTransform keeps the pinch anchor stable while zooming out", () => {
  assert.deepEqual(
    getMinorityReportAnchoredZoomTransform({
      baseTransform: { x: 832, y: 520, scale: 2.6, rotation: 0 },
      baseDistance: 0.5,
      currentDistance: 0.25,
      stageSize: { width: 960, height: 640 },
      baseLocalAnchor: { x: 160, y: 120 },
      currentMidpoint: { x: 0.5, y: 0.5 },
    }),
    { x: 416, y: 260, scale: 1.3, rotation: 0 },
  );
});
