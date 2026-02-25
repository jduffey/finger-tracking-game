import test from "node:test";
import assert from "node:assert/strict";
import {
  canRunnerStartJump,
  getRunnerLaneFromNormalizedX,
  shouldCollectRunnerCoin,
} from "../src/gameLogic.js";

test("getRunnerLaneFromNormalizedX resolves left/center/right with debounce bounds", () => {
  assert.equal(getRunnerLaneFromNormalizedX(0.05, 0.06), -1);
  assert.equal(getRunnerLaneFromNormalizedX(0.5, 0.06), 0);
  assert.equal(getRunnerLaneFromNormalizedX(0.95, 0.06), 1);
});

test("getRunnerLaneFromNormalizedX clamps out-of-range inputs and falls back for invalid values", () => {
  assert.equal(getRunnerLaneFromNormalizedX(-2, 0.06), -1);
  assert.equal(getRunnerLaneFromNormalizedX(2, 0.06), 1);
  assert.equal(getRunnerLaneFromNormalizedX(Number.NaN, 0.06), 0);
});

test("canRunnerStartJump only allows jumps when grounded and not rising", () => {
  assert.equal(canRunnerStartJump(0, 0), true);
  assert.equal(canRunnerStartJump(1.9, -10), true);
  assert.equal(canRunnerStartJump(2.1, -10), false);
  assert.equal(canRunnerStartJump(0, 30), false);
});

test("shouldCollectRunnerCoin requires near-z, lane match, and jump-height match", () => {
  const collectableCoin = { z: 20, lane: 1, height: 100, value: 1 };
  assert.equal(shouldCollectRunnerCoin(collectableCoin, 0.74, 80), true);

  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, z: 120 }, 0.74, 80),
    false,
  );
  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, lane: -1 }, 0.74, 80),
    false,
  );
  assert.equal(
    shouldCollectRunnerCoin({ ...collectableCoin, height: 200 }, 0.74, 80),
    false,
  );
});
