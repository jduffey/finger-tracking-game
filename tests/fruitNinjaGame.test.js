import test from "node:test";
import assert from "node:assert/strict";
import {
  FRUIT_NINJA_BASE_SCORE,
  FRUIT_NINJA_BOMB_PENALTY,
  FRUIT_NINJA_COMBO_BONUS,
  computeSwipeSegments,
  createFruitNinjaGame,
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

test("stepFruitNinjaGame leaves targets and score unchanged after gameover", () => {
  const state = createFruitNinjaGame(800, 600);
  state.status = "gameover";
  state.score = 250;
  state.lives = 0;
  state.targets = [
    {
      id: "fruit-1",
      kind: "fruit",
      label: "Sun Peach",
      x: 80,
      y: 80,
      vx: 120,
      vy: 0,
      radius: 28,
      rotation: 0,
      spin: 1.2,
      fill: "#ff6b57",
      accent: "#ffd4bf",
      missed: false,
    },
  ];
  state.bladeTrail = [
    { x: 20, y: 80, timestamp: 0 },
    { x: 140, y: 80, timestamp: 40 },
  ];

  const nextState = stepFruitNinjaGame(
    state,
    0.016,
    { active: true, x: 200, y: 80 },
    60,
    () => 0.5,
  );

  assert.equal(nextState.status, "gameover");
  assert.equal(nextState.score, 250);
  assert.equal(nextState.lives, 0);
  assert.equal(nextState.targets.length, 1);
  assert.deepEqual(nextState.targets[0], state.targets[0]);
  assert.equal(nextState.popups.length, 0);
  assert.equal(nextState.particles.length, 0);
  assert.equal(nextState.message, "Round over. Restart to launch another wave.");
});
