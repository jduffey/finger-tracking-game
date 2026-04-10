import test from "node:test";
import assert from "node:assert/strict";
import {
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
    { x: 0, y: 0, scale: 2.6, rotation: 0 },
  );
});

test("normalizeMinorityReportStageTransform clears stage translation and rotation", () => {
  assert.deepEqual(
    normalizeMinorityReportStageTransform({ x: 75, y: 30, scale: 0.8, rotation: 0.9 }),
    { x: 0, y: 0, scale: 0.8, rotation: 0 },
  );
});
