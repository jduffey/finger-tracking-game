import test from "node:test";
import assert from "node:assert/strict";
import {
  BRICK_DODGER_BONUS_SCORE,
  BRICK_DODGER_MAX_LIVES,
  BRICK_DODGER_NEAR_MISS_SCORE,
  BRICK_DODGER_SLOW_TIME_MS,
  BRICK_DODGER_STAGE_DURATION_MS,
  BRICK_DODGER_STARTING_LIVES,
  advanceBrickDodgerStage,
  createBrickDodgerGame,
  createBrickDodgerLayout,
  getBrickDodgerNearMissMultiplier,
  getBrickDodgerResultStats,
  getBrickDodgerHazardSpeed,
  getBrickDodgerSpawnDelayMs,
  getBrickDodgerStageConfig,
  getBrickDodgerWaveHazardCount,
  spawnBrickDodgerPickup,
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
  assert.equal(game.stage, 1);
  assert.equal(game.stageConfig.name, "Warm-Up");
  assert.equal(game.threatLevel.label, "Low");
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
  assert.equal(
    spawned.laneTelegraphs.length,
    spawned.hazards.length + spawned.bonuses.length,
  );
  assert.ok(spawned.laneTelegraphs.every((telegraph) => telegraph.arrivalMs > 0));
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

test("named stages expose increasingly severe but capped threat settings", () => {
  const opening = getBrickDodgerStageConfig(1);
  const severe = getBrickDodgerStageConfig(4);
  const endless = getBrickDodgerStageConfig(12);

  assert.equal(opening.name, "Warm-Up");
  assert.equal(severe.name, "Six-Lane Scramble");
  assert.ok(severe.speedMultiplier > opening.speedMultiplier);
  assert.ok(severe.spawnMultiplier < opening.spawnMultiplier);
  assert.equal(endless.threatLevel, 5);
  assert.equal(endless.threatLabel, "Extreme");
  assert.equal(endless.durationMs, BRICK_DODGER_STAGE_DURATION_MS);
});

test("shield and slow-time pickups create distinct defensive choices", () => {
  const game = createBrickDodgerGame(960, 720);
  const collectAtPlayer = (state) => ({
    ...state,
    bonuses: state.bonuses.map((bonus) => ({
      ...bonus,
      y: state.layout.playerY,
      vy: 0,
    })),
    spawnTimerMs: 5_000,
  });

  const shieldDrop = collectAtPlayer(
    spawnBrickDodgerPickup(
      {
        ...game,
        lives: 2,
      },
      "shield",
      2,
    ),
  );
  const shielded = stepBrickDodgerGame(
    {
      ...shieldDrop,
      player: { x: shieldDrop.layout.laneCenters[2] },
    },
    1 / 60,
    shieldDrop.layout.laneCenters[2],
    constantRng(0.8),
  );
  assert.equal(shielded.lives, 3);
  assert.equal(shielded.stats.shieldPickups, 1);
  assert.equal(shielded.stats.pickupsCollected, 1);

  const fullShield = stepBrickDodgerGame(
    collectAtPlayer(
      spawnBrickDodgerPickup(
        {
          ...game,
          lives: BRICK_DODGER_MAX_LIVES,
          player: { x: game.layout.laneCenters[2] },
        },
        "shield",
        2,
      ),
    ),
    1 / 60,
    game.layout.laneCenters[2],
    constantRng(0.8),
  );
  assert.equal(fullShield.lives, BRICK_DODGER_MAX_LIVES);

  const slowDrop = collectAtPlayer(
    spawnBrickDodgerPickup(
      {
        ...game,
        player: { x: game.layout.laneCenters[2] },
      },
      "slow-time",
      2,
    ),
  );
  const slowed = stepBrickDodgerGame(
    slowDrop,
    1 / 60,
    slowDrop.layout.laneCenters[2],
    constantRng(0.8),
  );
  assert.equal(slowed.slowTimeMs, BRICK_DODGER_SLOW_TIME_MS);
  assert.equal(slowed.stats.slowTimePickups, 1);
});

test("slow time measurably reduces hazard travel until its timer expires", () => {
  const game = createBrickDodgerGame(960, 720);
  const hazard = {
    id: "hazard-slow-test",
    laneIndex: 0,
    x: game.layout.laneCenters[0],
    y: 100,
    width: game.layout.hazardWidth,
    height: game.layout.hazardHeight,
    vy: 300,
  };
  const base = {
    ...game,
    hazards: [hazard],
    spawnTimerMs: 5_000,
  };
  const normal = stepBrickDodgerGame(base, 0.05, base.player.x, constantRng(0.8));
  const slowed = stepBrickDodgerGame(
    {
      ...base,
      slowTimeMs: 1_000,
    },
    0.05,
    base.player.x,
    constantRng(0.8),
  );
  assert.equal(normal.hazards[0].y, 115);
  assert.equal(slowed.hazards[0].y, 108.25);
});

test("near misses build a capped multiplier and award skill score", () => {
  const game = createBrickDodgerGame(960, 720);
  const playerLane = 2;
  const hazardLane = 3;
  const createNearHazard = (id) => ({
    id,
    laneIndex: hazardLane,
    x: game.layout.laneCenters[hazardLane],
    y: game.layout.playerY - 5,
    width: game.layout.hazardWidth,
    height: game.layout.hazardHeight,
    vy: 200,
    nearMissAwarded: false,
  });
  const state = {
    ...game,
    player: { x: game.layout.laneCenters[playerLane] },
    hazards: [createNearHazard("hazard-near-1")],
    spawnTimerMs: 5_000,
  };
  const first = stepBrickDodgerGame(
    state,
    0.05,
    state.player.x,
    constantRng(0.8),
  );
  assert.equal(first.nearMissStreak, 1);
  assert.equal(first.nearMissMultiplier, 1);
  assert.equal(first.score, BRICK_DODGER_NEAR_MISS_SCORE + 1);
  assert.equal(first.stats.nearMisses, 1);

  const second = stepBrickDodgerGame(
    {
      ...first,
      hazards: [...first.hazards, createNearHazard("hazard-near-2")],
    },
    0.05,
    first.player.x,
    constantRng(0.8),
  );
  assert.equal(second.nearMissStreak, 2);
  assert.equal(second.nearMissMultiplier, 1.5);
  assert.equal(
    second.score - first.score,
    Math.round(BRICK_DODGER_NEAR_MISS_SCORE * 1.5) + 1,
  );
  assert.equal(getBrickDodgerNearMissMultiplier(100), 4);
});

test("stage completion pauses for a recap then advances with progress intact", () => {
  const game = createBrickDodgerGame(960, 720);
  const completed = stepBrickDodgerGame(
    {
      ...game,
      stageElapsedMs: BRICK_DODGER_STAGE_DURATION_MS - 10,
      stageNearMisses: 4,
      stagePickups: 2,
      score: 1200,
      spawnTimerMs: 5_000,
    },
    0.02,
    game.player.x,
    constantRng(0.8),
  );
  assert.equal(completed.status, "stage_recap");
  assert.equal(completed.lastStageRecap.name, "Warm-Up");
  assert.equal(completed.lastStageRecap.nearMisses, 4);
  assert.equal(completed.stats.stagesCleared, 1);

  const advanced = stepBrickDodgerGame(
    {
      ...completed,
      stageRecapMs: 20,
    },
    0.05,
    completed.player.x,
    constantRng(0.8),
  );
  assert.equal(advanced.status, "playing");
  assert.equal(advanced.stage, 2);
  assert.equal(advanced.stageConfig.name, "Crosswind");
  assert.equal(advanced.score, completed.score);
  assert.equal(advanced.stats.stagesCleared, 1);

  assert.equal(advanceBrickDodgerStage(advanced).stage, 3);
});

test("game over records a structured stage and mastery result", () => {
  const game = createBrickDodgerGame(960, 720);
  const laneX = game.layout.laneCenters[1];
  const terminal = stepBrickDodgerGame(
    {
      ...game,
      stage: 3,
      stageConfig: getBrickDodgerStageConfig(3),
      player: { x: laneX },
      lives: 1,
      nearMissStreak: 6,
      nearMissMultiplier: 2.5,
      stats: {
        ...game.stats,
        stagesCleared: 2,
        nearMisses: 12,
        bestNearMissStreak: 8,
      },
      hazards: [
        {
          id: "hazard-final",
          laneIndex: 1,
          x: laneX,
          y: game.layout.playerY,
          width: game.layout.hazardWidth,
          height: game.layout.hazardHeight,
          vy: 0,
        },
      ],
      spawnTimerMs: 5_000,
    },
    1 / 60,
    laneX,
    constantRng(0.8),
  );
  const result = getBrickDodgerResultStats(terminal);
  assert.equal(terminal.status, "gameover");
  assert.equal(result.stageReached, 3);
  assert.equal(result.stagesCleared, 2);
  assert.equal(result.nearMisses, 12);
  assert.equal(result.bestMultiplier, 3);
  assert.equal(result.hitsTaken, 1);
});
