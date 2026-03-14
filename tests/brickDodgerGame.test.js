import test from "node:test";
import assert from "node:assert/strict";
import {
  BRICK_DODGER_BONUS_SCORE,
  BRICK_DODGER_STARTING_LIVES,
  createBrickDodgerGame,
  createBrickDodgerLayout,
  getBrickDodgerHazardSpeed,
  getBrickDodgerSpawnDelayMs,
  getBrickDodgerWaveHazardCount,
  spawnBrickDodgerWave,
  stepBrickDodgerGame,
} from "../src/brickDodgerGame.js";

function constantRng(value) {
  return () => value;
}

test("createBrickDodgerGame starts with survival scoring and shields", () => {
  const game = createBrickDodgerGame(960, 720);
  assert.equal(game.status, "playing");
  assert.equal(game.lives, BRICK_DODGER_STARTING_LIVES);
  assert.equal(game.score, 0);
  assert.equal(game.hazards.length, 0);
});

test("brick dodger spawn pacing ramps up while adding more hazards", () => {
  assert.ok(getBrickDodgerSpawnDelayMs(90_000) < getBrickDodgerSpawnDelayMs(0));
  assert.ok(getBrickDodgerWaveHazardCount(60_000) > getBrickDodgerWaveHazardCount(0));

  const layout = createBrickDodgerLayout(960, 720);
  assert.ok(getBrickDodgerHazardSpeed(layout, 100_000) > getBrickDodgerHazardSpeed(layout, 0));
});

test("spawnBrickDodgerWave adds hazards and can place a bonus in an open lane", () => {
  const initial = createBrickDodgerGame(960, 720);
  const spawned = spawnBrickDodgerWave(
    {
      ...initial,
      elapsedMs: 70_000,
    },
    constantRng(0),
  );

  assert.ok(spawned.hazards.length >= 2);
  assert.equal(spawned.bonuses.length, 1);
  assert.ok(
    !spawned.hazards.some((hazard) => hazard.laneIndex === spawned.bonuses[0].laneIndex),
  );
});

test("stepBrickDodgerGame awards bonus score and streaks on collection", () => {
  const layout = createBrickDodgerLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.laneCenters[2] },
    hazards: [],
    bonuses: [
      {
        id: "bonus-1",
        laneIndex: 2,
        x: layout.laneCenters[2],
        y: layout.playerY,
        size: layout.bonusSize,
        vy: 0,
      },
    ],
    score: 10,
    lives: BRICK_DODGER_STARTING_LIVES,
    elapsedMs: 0,
    survivalMs: 0,
    survivalScoreRemainder: 0,
    bonusStreak: 1,
    invulnerabilityMs: 0,
    status: "playing",
    message: "",
    nextHazardId: 1,
    nextBonusId: 2,
    spawnTimerMs: 5_000,
  };

  const next = stepBrickDodgerGame(state, 1 / 60, layout.laneCenters[2], constantRng(0.8));
  assert.equal(next.bonuses.length, 0);
  assert.equal(next.score, 10 + BRICK_DODGER_BONUS_SCORE + 50);
  assert.equal(next.bonusStreak, 2);
});

test("stepBrickDodgerGame removes a shield and ends the run on the last hit", () => {
  const layout = createBrickDodgerLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.laneCenters[1] },
    hazards: [
      {
        id: "hazard-1",
        laneIndex: 1,
        x: layout.laneCenters[1],
        y: layout.playerY,
        width: layout.hazardWidth,
        height: layout.hazardHeight,
        vy: 0,
      },
    ],
    bonuses: [],
    score: 0,
    lives: 1,
    elapsedMs: 0,
    survivalMs: 0,
    survivalScoreRemainder: 0,
    bonusStreak: 3,
    invulnerabilityMs: 0,
    status: "playing",
    message: "",
    nextHazardId: 2,
    nextBonusId: 1,
    spawnTimerMs: 5_000,
  };

  const next = stepBrickDodgerGame(state, 1 / 60, layout.laneCenters[1], constantRng(0.8));
  assert.equal(next.hazards.length, 0);
  assert.equal(next.lives, 0);
  assert.equal(next.status, "gameover");
  assert.equal(next.bonusStreak, 0);
});

test("stepBrickDodgerGame does not award a bonus after a lethal collision", () => {
  const layout = createBrickDodgerLayout(960, 720);
  const laneX = layout.laneCenters[1];
  const state = {
    layout,
    player: { x: laneX },
    hazards: [
      {
        id: "hazard-1",
        laneIndex: 1,
        x: laneX,
        y: layout.playerY,
        width: layout.hazardWidth,
        height: layout.hazardHeight,
        vy: 0,
      },
    ],
    bonuses: [
      {
        id: "bonus-1",
        laneIndex: 1,
        x: laneX,
        y: layout.playerY,
        size: layout.bonusSize,
        vy: 0,
      },
    ],
    score: 125,
    lives: 1,
    elapsedMs: 0,
    survivalMs: 0,
    survivalScoreRemainder: 0,
    bonusStreak: 2,
    invulnerabilityMs: 0,
    status: "playing",
    message: "",
    nextHazardId: 2,
    nextBonusId: 2,
    spawnTimerMs: 5_000,
  };

  const next = stepBrickDodgerGame(state, 1 / 60, laneX, constantRng(0.8));
  assert.equal(next.score, 125);
  assert.equal(next.lives, 0);
  assert.equal(next.status, "gameover");
  assert.equal(next.bonusStreak, 0);
  assert.equal(next.message, "Run over");
});
