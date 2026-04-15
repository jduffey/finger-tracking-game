import test from "node:test";
import assert from "node:assert/strict";

import {
  SKY_PATROL_DEPOT_SCORE,
  SKY_PATROL_FIGHTER_SCORE,
  SKY_PATROL_STARTING_LIVES,
  createSkyPatrolGame,
  createSkyPatrolLayout,
  getSkyPatrolVisibleTerrainRows,
  stepSkyPatrolGame,
} from "../src/skyPatrolGame.js";

function constantRng(value) {
  return () => value;
}

test("getSkyPatrolVisibleTerrainRows yields water, land, and runway terrain bands", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const terrains = new Set();

  for (let scroll = 0; scroll < layout.tileSize * 150; scroll += layout.tileSize * 6) {
    for (const row of getSkyPatrolVisibleTerrainRows(layout, scroll)) {
      for (const segment of row.segments) {
        terrains.add(segment.terrain);
      }
    }
  }

  assert.ok(terrains.has("deep-water"));
  assert.ok(terrains.has("grass") || terrains.has("forest"));
  assert.ok(terrains.has("runway"));
});

test("createSkyPatrolGame starts with a centered ship and full lives", () => {
  const game = createSkyPatrolGame(960, 720, constantRng(0.5));

  assert.equal(game.status, "playing");
  assert.equal(game.lives, SKY_PATROL_STARTING_LIVES);
  assert.equal(game.ship.x, game.layout.width / 2);
  assert.equal(game.airEnemies.length, 0);
});

test("stepSkyPatrolGame scrolls the map, steers the ship, and fires twin shots with a cooldown", () => {
  const initial = createSkyPatrolGame(960, 720, constantRng(0.5));
  const first = stepSkyPatrolGame(
    initial,
    0.016,
    {
      pointerActive: true,
      pointerX: 220,
      pointerY: 260,
      fireRequested: true,
    },
    constantRng(0.5),
  );
  const second = stepSkyPatrolGame(
    first,
    0.016,
    {
      pointerActive: true,
      pointerX: 220,
      pointerY: 260,
      fireRequested: true,
    },
    constantRng(0.5),
  );

  assert.ok(first.scrollOffset > initial.scrollOffset);
  assert.ok(first.ship.x < initial.ship.x);
  assert.ok(first.ship.y < initial.ship.y);
  assert.equal(first.playerShots.length, 2);
  assert.equal(second.playerShots.length, 2);
});

test("stepSkyPatrolGame awards score when a fighter is destroyed", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const state = {
    ...createSkyPatrolGame(960, 720, constantRng(0.5)),
    airEnemies: [
      {
        id: "fighter-1",
        kind: "fighter",
        x: 320,
        y: 220,
        width: layout.enemyWidth,
        height: layout.enemyHeight,
        startX: 320,
        speedY: layout.enemyFlightSpeed,
        swayAmplitude: 0,
        swayHz: 1,
        driftX: 0,
        phase: 0,
        lifeMs: 0,
        hp: 1,
        shotCooldownMs: 999,
      },
    ],
    groundTargets: [],
    playerShots: [
      {
        id: "player-shot-1",
        kind: "player",
        x: 320,
        y: 232,
        width: layout.playerShotWidth,
        height: layout.playerShotHeight,
        vx: 0,
        vy: -layout.playerShotSpeed,
      },
    ],
    enemyShots: [],
    enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
    groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
  };

  const next = stepSkyPatrolGame(state, 0.016, {}, constantRng(0.5));

  assert.equal(next.score, SKY_PATROL_FIGHTER_SCORE);
  assert.equal(next.airEnemies.length, 0);
  assert.ok(next.explosions.length > 0);
});

test("stepSkyPatrolGame can spawn ground targets over the scrolling terrain", () => {
  const game = createSkyPatrolGame(960, 720, constantRng(0.5));
  const next = stepSkyPatrolGame(
    {
      ...game,
      scrollOffset: game.layout.tileSize * 48,
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: 0,
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.ok(next.groundTargets.length >= 1);
});

test("stepSkyPatrolGame enters game over on a hit and restarts on pinch", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const base = createSkyPatrolGame(960, 720, constantRng(0.5));
  const state = {
    ...base,
    enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
    groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    enemyShots: [
      {
        id: "enemy-shot-1",
        kind: "fighter",
        x: base.ship.x,
        y: base.ship.y,
        width: layout.enemyShotWidth,
        height: layout.enemyShotHeight,
        vx: 0,
        vy: layout.enemyShotSpeed,
      },
    ],
    lives: 1,
  };

  const gameOver = stepSkyPatrolGame(state, 0.016, {}, constantRng(0.5));
  assert.equal(gameOver.status, "gameover");
  assert.equal(gameOver.lives, 0);

  const restarted = stepSkyPatrolGame(
    {
      ...gameOver,
      restartCooldownMs: 0,
    },
    0.016,
    {
      fireRequested: true,
    },
    constantRng(0.5),
  );

  assert.equal(restarted.status, "playing");
  assert.equal(restarted.lives, SKY_PATROL_STARTING_LIVES);
  assert.equal(restarted.score, 0);
});

test("stepSkyPatrolGame awards depot score when a ground target is destroyed", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const state = {
    ...createSkyPatrolGame(960, 720, constantRng(0.5)),
    airEnemies: [],
    groundTargets: [
      {
        id: "depot-1",
        kind: "depot",
        x: 400,
        y: 260,
        width: layout.depotWidth,
        height: layout.depotHeight,
        hp: 1,
        score: SKY_PATROL_DEPOT_SCORE,
        shotCooldownMs: Number.POSITIVE_INFINITY,
      },
    ],
    playerShots: [
      {
        id: "player-shot-1",
        kind: "player",
        x: 400,
        y: 270,
        width: layout.playerShotWidth,
        height: layout.playerShotHeight,
        vx: 0,
        vy: -layout.playerShotSpeed,
      },
    ],
    enemyShots: [],
    enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
    groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
  };

  const next = stepSkyPatrolGame(state, 0.016, {}, constantRng(0.5));

  assert.equal(next.score, SKY_PATROL_DEPOT_SCORE);
  assert.equal(next.groundTargets.length, 0);
});
