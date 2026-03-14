import test from "node:test";
import assert from "node:assert/strict";
import {
  FRUIT_NINJA_BASE_SCORE,
  FRUIT_NINJA_BOMB_PENALTY,
  FRUIT_NINJA_COMBO_BONUS,
  createFruitNinjaGame,
  computeSwipeSegments,
  scoreSliceBatch,
  segmentIntersectsCircle,
  stepFruitNinjaGame,
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

test("scoreSliceBatch is order-independent when fruit and bombs land together", () => {
  const fruitThenBomb = scoreSliceBatch(["fruit", "bomb"], 2);
  const bombThenFruit = scoreSliceBatch(["bomb", "fruit"], 2);

  assert.deepEqual(fruitThenBomb, bombThenFruit);
});

test("stepFruitNinjaGame scores simultaneous fruit and bomb slices consistently", () => {
  const game = createFruitNinjaGame(960, 720);
  const fruit = {
    id: "fruit-1",
    kind: "fruit",
    label: "Sky Plum",
    x: 320,
    y: 240,
    vx: 0,
    vy: 0,
    radius: 32,
    rotation: 0,
    spin: 0,
    fill: "#59b7ff",
    accent: "#e3f4ff",
    missed: false,
  };
  const bomb = {
    id: "bomb-1",
    kind: "bomb",
    label: "Bomb",
    x: 380,
    y: 240,
    vx: 0,
    vy: 0,
    radius: 32,
    rotation: 0,
    spin: 0,
    fill: "#111827",
    accent: "#ff7b6b",
    missed: false,
  };
  const bladeTrail = [
    { x: 260, y: 240, timestamp: 0 },
    { x: 430, y: 240, timestamp: 90 },
  ];

  const fruitFirst = stepFruitNinjaGame(
    { ...game, comboCount: 2, targets: [fruit, bomb], bladeTrail },
    0.016,
    { active: true, x: 430, y: 240 },
    90,
    () => 0.5,
  );
  const bombFirst = stepFruitNinjaGame(
    { ...game, comboCount: 2, targets: [bomb, fruit], bladeTrail },
    0.016,
    { active: true, x: 430, y: 240 },
    90,
    () => 0.5,
  );

  assert.equal(fruitFirst.score, bombFirst.score);
  assert.equal(fruitFirst.comboCount, bombFirst.comboCount);
  assert.equal(fruitFirst.lives, bombFirst.lives);
});
