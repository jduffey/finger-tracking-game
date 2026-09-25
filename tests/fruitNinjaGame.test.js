import test from "node:test";
import assert from "node:assert/strict";
import {
  FRUIT_NINJA_BASE_SCORE,
  FRUIT_NINJA_BOMB_PENALTY,
  FRUIT_NINJA_COMBO_BONUS,
  createFruitNinjaGame,
  createFruitNinjaLayout,
  computeSwipeSegments,
  scoreSliceBatch,
  segmentIntersectsCircle,
  stepFruitNinjaGame,
} from "../src/fruitNinjaGame.js";

function constantRng(value) {
  return () => value;
}

test("createFruitNinjaLayout scales targets up by fifty percent", () => {
  const layout = createFruitNinjaLayout(960, 720);
  assert.equal(layout.targetRadius, 56.16);
});

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

test("stepFruitNinjaGame spawns targets that can rise to roughly the top quarter of the screen", () => {
  const game = createFruitNinjaGame(960, 720);
  const nextState = stepFruitNinjaGame(
    {
      ...game,
      spawnCooldownMs: 0,
    },
    0,
    null,
    0,
    constantRng(0.5),
  );

  assert.equal(nextState.targets.length, 1);
  const target = nextState.targets[0];
  assert.ok(Math.abs(Math.abs(target.vx) - nextState.layout.width * 0.155 * 0.7) < 0.001);

  let simulatedState = nextState;
  let highestY = target.y;
  for (let index = 0; index < 240; index += 1) {
    const nextStep = stepFruitNinjaGame(simulatedState, 1 / 60, null, (index + 1) * 16, () => 1);
    const activeTarget = nextStep.targets.find((candidate) => candidate.id === target.id);
    if (!activeTarget) {
      break;
    }
    highestY = Math.min(highestY, activeTarget.y);
    simulatedState = nextStep;
    if (activeTarget.vy >= 0) {
      break;
    }
  }

  assert.ok(highestY >= nextState.layout.height * 0.19);
  assert.ok(highestY <= nextState.layout.height * 0.29);
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
