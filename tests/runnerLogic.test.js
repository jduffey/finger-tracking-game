import test from "node:test";
import assert from "node:assert/strict";
import {
  canRunnerStartJump,
  computeRunnerTrackGridLayout,
  getRunnerTrackIndexFromNormalized,
  getRunnerTrackOffsetFromIndex,
  shouldCollectRunnerCoin,
} from "../src/gameLogic.js";

test("getRunnerTrackIndexFromNormalized resolves 4x4 index buckets", () => {
  assert.equal(getRunnerTrackIndexFromNormalized(0.0, 4), 0);
  assert.equal(getRunnerTrackIndexFromNormalized(0.26, 4), 1);
  assert.equal(getRunnerTrackIndexFromNormalized(0.51, 4), 2);
  assert.equal(getRunnerTrackIndexFromNormalized(0.99, 4), 3);
});

test("getRunnerTrackIndexFromNormalized clamps out-of-range and invalid values", () => {
  assert.equal(getRunnerTrackIndexFromNormalized(-2, 4), 0);
  assert.equal(getRunnerTrackIndexFromNormalized(2, 4), 3);
  assert.equal(getRunnerTrackIndexFromNormalized(Number.NaN, 4), 1);
});

test("getRunnerTrackOffsetFromIndex returns centered offsets for 4x4", () => {
  assert.equal(getRunnerTrackOffsetFromIndex(0, 4), -1.5);
  assert.equal(getRunnerTrackOffsetFromIndex(1, 4), -0.5);
  assert.equal(getRunnerTrackOffsetFromIndex(2, 4), 0.5);
  assert.equal(getRunnerTrackOffsetFromIndex(3, 4), 1.5);
});

test("computeRunnerTrackGridLayout centers focal point and splits rows around horizon", () => {
  const layout = computeRunnerTrackGridLayout(1200, 800, 4);
  assert.equal(layout.focalPoint.x, 600);
  assert.equal(layout.focalPoint.y, 400);
  assert.equal(layout.horizonY, 400);

  assert.ok(layout.rowYs[0] < layout.horizonY);
  assert.ok(layout.rowYs[1] < layout.horizonY);
  assert.ok(layout.rowYs[2] > layout.horizonY);
  assert.ok(layout.rowYs[3] > layout.horizonY);
});

test("computeRunnerTrackGridLayout maintains equal node spacing", () => {
  const layout = computeRunnerTrackGridLayout(1280, 720, 4);
  const xStepA = layout.columnXs[1] - layout.columnXs[0];
  const xStepB = layout.columnXs[2] - layout.columnXs[1];
  const xStepC = layout.columnXs[3] - layout.columnXs[2];
  const yStepA = layout.rowYs[1] - layout.rowYs[0];
  const yStepB = layout.rowYs[2] - layout.rowYs[1];
  const yStepC = layout.rowYs[3] - layout.rowYs[2];

  assert.ok(Math.abs(xStepA - layout.trackSpacing) < 1e-9);
  assert.ok(Math.abs(xStepB - layout.trackSpacing) < 1e-9);
  assert.ok(Math.abs(xStepC - layout.trackSpacing) < 1e-9);
  assert.ok(Math.abs(yStepA - layout.trackSpacing) < 1e-9);
  assert.ok(Math.abs(yStepB - layout.trackSpacing) < 1e-9);
  assert.ok(Math.abs(yStepC - layout.trackSpacing) < 1e-9);
});

test("canRunnerStartJump only allows jumps when grounded and not rising", () => {
  assert.equal(canRunnerStartJump(0, 0), true);
  assert.equal(canRunnerStartJump(1.9, -10), true);
  assert.equal(canRunnerStartJump(2.1, -10), false);
  assert.equal(canRunnerStartJump(0, 30), false);
});

test("shouldCollectRunnerCoin requires near-z, 2D track match, and jump-height match", () => {
  const collectableCoin = { z: 20, trackX: 0.5, trackY: -0.5, height: 100, value: 1 };
  assert.equal(shouldCollectRunnerCoin(collectableCoin, 0.7, -0.3, 80), true);

  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, z: 120 }, 0.7, -0.3, 80),
    false,
  );
  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, trackX: -1.5 }, 0.7, -0.3, 80),
    false,
  );
  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, trackY: 1.5 }, 0.7, -0.3, 80),
    false,
  );
  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, height: 200 }, 0.7, -0.3, 80),
    false,
  );
});
