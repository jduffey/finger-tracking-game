import test from "node:test";
import assert from "node:assert/strict";
import {
  FRUIT_NINJA_BASE_SCORE,
  FRUIT_NINJA_BOMB_PENALTY,
  FRUIT_NINJA_COMBO_BONUS,
  computeSwipeSegments,
  scoreSliceBatch,
  segmentIntersectsCircle,
} from "../src/fruitNinjaGame.js";

test("computeSwipeSegments keeps only fast enough motion segments", () => {
  const segments = computeSwipeSegments(
    [
      { x: 10, y: 20, timestamp: 0 },
      { x: 130, y: 20, timestamp: 100 },
      { x: 150, y: 24, timestamp: 210 },
    ],
    { minSpeed: 700, minLength: 16 },
  );

  assert.equal(segments.length, 1);
  assert.equal(Math.round(segments[0].distance), 120);
  assert.ok(segments[0].speed >= 700);
});

test("segmentIntersectsCircle detects slices through a target body", () => {
  assert.equal(
    segmentIntersectsCircle(
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 50, y: 20, radius: 12 },
      0,
    ),
    true,
  );

  assert.equal(
    segmentIntersectsCircle(
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 50, y: 40, radius: 10 },
      0,
    ),
    false,
  );
});

test("scoreSliceBatch compounds combo scoring across fruit slices", () => {
  const scored = scoreSliceBatch(["fruit", "fruit", "fruit"], 0);

  assert.equal(
    scored.points,
    FRUIT_NINJA_BASE_SCORE * 3 + FRUIT_NINJA_COMBO_BONUS * 3,
  );
  assert.equal(scored.nextComboCount, 3);
  assert.equal(scored.bombHit, false);
});

test("scoreSliceBatch resets combo and applies bomb penalty", () => {
  const scored = scoreSliceBatch(["bomb"], 2);

  assert.equal(scored.points, -FRUIT_NINJA_BOMB_PENALTY);
  assert.equal(scored.nextComboCount, 0);
  assert.equal(scored.bombHit, true);
});
