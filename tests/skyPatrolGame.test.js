import test from "node:test";
import assert from "node:assert/strict";

import {
  SKY_PATROL_DEPOT_SCORE,
  SKY_PATROL_FIGHTER_SCORE,
  SKY_PATROL_GUN_COOLDOWN_MS,
  SKY_PATROL_GUN_DRAIN_MS,
  SKY_PATROL_BOSS_SCORE,
  SKY_PATROL_BOSS_HP,
  SKY_PATROL_STARTING_LIVES,
  advanceSkyPatrolMission,
  createSkyPatrolDailyGame,
  createSkyPatrolGame,
  createSkyPatrolLayout,
  getSkyPatrolDailyMission,
  getSkyPatrolMissionConfig,
  spawnSkyPatrolPowerUp,
  getSkyPatrolTerrainRows,
  getSkyPatrolVisibleTerrainRows,
  stepSkyPatrolGame,
} from "../src/skyPatrolGame.js";

function constantRng(value) {
  return () => value;
}

function stepSkyPatrolFor(state, seconds, input = {}, rng = constantRng(0.5)) {
  let nextState = state;
  let remainingSeconds = seconds;
  while (remainingSeconds > 0) {
    const dt = Math.min(0.05, remainingSeconds);
    nextState = stepSkyPatrolGame(nextState, dt, input, rng);
    remainingSeconds = Number((remainingSeconds - dt).toFixed(6));
  }
  return nextState;
}

function expandTerrainSegments(row, columns) {
  const tiles = Array.from({ length: columns }, () => null);
  for (const segment of row.segments) {
    for (let offset = 0; offset < segment.length; offset += 1) {
      tiles[segment.startColumn + offset] = segment.terrain;
    }
  }
  return tiles;
}

function isSkyPatrolLandOrShoreTerrain(terrain) {
  return (
    terrain === "grass" ||
    terrain === "coastal-grass" ||
    terrain === "forest" ||
    terrain === "runway" ||
    terrain === "road" ||
    terrain === "beach"
  );
}

function isSkyPatrolWaterOrBeachTerrain(terrain) {
  return terrain === "deep-water" || terrain === "shallow-water" || terrain === "beach";
}

function getEightWayNeighbors(tilesByRow, rowIndex, column) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }
      neighbors.push(tilesByRow[rowIndex + rowOffset]?.[column + columnOffset]);
    }
  }
  return neighbors;
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

test("Sky Patrol water is shallow only when adjacent to land", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const rows = getSkyPatrolVisibleTerrainRows(layout, layout.tileSize * 60);
  const tilesByRow = rows.map((row) => expandTerrainSegments(row, layout.columns));

  let shallowWaterTiles = 0;
  for (let rowIndex = 1; rowIndex < tilesByRow.length - 1; rowIndex += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      if (tilesByRow[rowIndex][column] !== "shallow-water") {
        continue;
      }

      shallowWaterTiles += 1;
      const neighbors = [
        tilesByRow[rowIndex][column - 1],
        tilesByRow[rowIndex][column + 1],
        tilesByRow[rowIndex - 1]?.[column],
        tilesByRow[rowIndex + 1]?.[column],
      ];
      assert.ok(
        neighbors.some(isSkyPatrolLandOrShoreTerrain),
        `expected shallow water at row ${rowIndex}, column ${column} to touch land`,
      );
    }
  }

  assert.ok(shallowWaterTiles > 0);
});

test("Sky Patrol beach tiles are adjacent to other beach tiles", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const rows = getSkyPatrolTerrainRows(layout, 0, 220);
  const tilesByRow = rows.map((row) => expandTerrainSegments(row, layout.columns));

  let beachTiles = 0;
  for (let rowIndex = 1; rowIndex < tilesByRow.length - 1; rowIndex += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      if (tilesByRow[rowIndex][column] !== "beach") {
        continue;
      }

      beachTiles += 1;
      assert.ok(
        getEightWayNeighbors(tilesByRow, rowIndex, column).includes("beach"),
        `expected beach at row ${rowIndex}, column ${column} to touch another beach tile`,
      );
    }
  }

  assert.ok(beachTiles > 0);
});

test("Sky Patrol grass only varies when adjacent to water or beach", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const rows = getSkyPatrolVisibleTerrainRows(layout, layout.tileSize * 60);
  const tilesByRow = rows.map((row) => expandTerrainSegments(row, layout.columns));
  const terrains = new Set(tilesByRow.flat());

  assert.ok(terrains.has("grass"));
  assert.ok(terrains.has("coastal-grass"));
  assert.equal(terrains.has("forest"), false);

  for (let rowIndex = 1; rowIndex < tilesByRow.length - 1; rowIndex += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      const terrain = tilesByRow[rowIndex][column];
      const neighbors = [
        tilesByRow[rowIndex][column - 1],
        tilesByRow[rowIndex][column + 1],
        tilesByRow[rowIndex - 1]?.[column],
        tilesByRow[rowIndex + 1]?.[column],
      ];
      const touchesWaterOrBeach = neighbors.some(isSkyPatrolWaterOrBeachTerrain);

      if (terrain === "coastal-grass") {
        assert.equal(
          touchesWaterOrBeach,
          true,
          `expected coastal grass at row ${rowIndex}, column ${column} to touch water or beach`,
        );
      }
      if (terrain === "grass") {
        assert.equal(
          touchesWaterOrBeach,
          false,
          `expected interior grass at row ${rowIndex}, column ${column} not to touch water or beach`,
        );
      }
    }
  }
});

test("getSkyPatrolVisibleTerrainRows keeps built ground features relatively sparse", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const rowTerrains = new Map();

  for (let scroll = 0; scroll < layout.tileSize * 240; scroll += layout.tileSize) {
    for (const row of getSkyPatrolVisibleTerrainRows(layout, scroll)) {
      const terrainSet = rowTerrains.get(row.worldRow) ?? new Set();
      for (const segment of row.segments) {
        terrainSet.add(segment.terrain);
      }
      rowTerrains.set(row.worldRow, terrainSet);
    }
  }

  let builtFeatureRows = 0;
  let runwayRows = 0;
  for (const terrains of rowTerrains.values()) {
    if (terrains.has("runway")) {
      runwayRows += 1;
    }
    if (terrains.has("runway") || terrains.has("road")) {
      builtFeatureRows += 1;
    }
  }

  assert.ok(runwayRows > 0);
  assert.ok(builtFeatureRows / rowTerrains.size < 0.06);
});

test("getSkyPatrolVisibleTerrainRows keeps rows continuous across tile boundaries", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const beforeWrap = getSkyPatrolVisibleTerrainRows(layout, layout.tileSize * 0.99).find(
    (row) => row.worldRow === 0,
  );
  const afterWrap = getSkyPatrolVisibleTerrainRows(layout, layout.tileSize * 1.01).find(
    (row) => row.worldRow === 0,
  );

  assert.ok(beforeWrap);
  assert.ok(afterWrap);
  assert.ok(
    Math.abs(afterWrap.y - beforeWrap.y) < 2,
    `expected terrain row 0 to move continuously, saw ${beforeWrap.y} -> ${afterWrap.y}`,
  );
});

test("createSkyPatrolGame starts with a centered ship and full lives", () => {
  const game = createSkyPatrolGame(960, 720, constantRng(0.5));

  assert.equal(game.status, "playing");
  assert.equal(game.lives, SKY_PATROL_STARTING_LIVES);
  assert.equal(game.ship.x, game.layout.width / 2);
  assert.equal(game.airEnemies.length, 0);
});

test("createSkyPatrolLayout scales the player ship up without resizing enemies", () => {
  const layout = createSkyPatrolLayout(960, 720);

  assert.ok(Math.abs(layout.playerWidth - 79.2) < 0.001);
  assert.ok(Math.abs(layout.playerHeight - 97.2) < 0.001);
  assert.ok(Math.abs(layout.enemyWidth - 46.464) < 0.001);
  assert.ok(Math.abs(layout.enemyHeight - 54.432) < 0.001);
});

test("createSkyPatrolLayout makes enemy shots large enough to read", () => {
  const layout = createSkyPatrolLayout(960, 720);

  assert.ok(layout.enemyShotWidth >= 11);
  assert.ok(layout.enemyShotHeight >= 26);
});

test("createSkyPatrolLayout scales player shots up for readability", () => {
  const layout = createSkyPatrolLayout(960, 720);

  assert.ok(Math.abs(layout.playerShotWidth - 11.7504) < 0.001);
  assert.ok(Math.abs(layout.playerShotHeight - 33) < 0.001);
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

test("stepSkyPatrolGame schedules enemy plane waves at the reduced density", () => {
  const game = createSkyPatrolGame(960, 720, constantRng(0.5));
  const next = stepSkyPatrolGame(
    {
      ...game,
      enemySpawnCooldownMs: 0,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.equal(next.airEnemies.length, 1);
  assert.ok(next.enemySpawnCooldownMs > 1200);
});

test("stepSkyPatrolGame drains guns into cooldown before gradually recharging", () => {
  const game = {
    ...createSkyPatrolGame(960, 720, constantRng(0.5)),
    enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
    groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
  };

  const overheated = stepSkyPatrolFor(
    game,
    SKY_PATROL_GUN_DRAIN_MS / 1000,
    { fireRequested: true },
    constantRng(0.5),
  );

  assert.equal(overheated.gunStatus, "cooldown");
  assert.equal(overheated.gunCharge, 0);
  assert.equal(overheated.gunCooldownMs, SKY_PATROL_GUN_COOLDOWN_MS);

  const cooling = stepSkyPatrolFor(overheated, 1, {}, constantRng(0.5));

  assert.equal(cooling.gunStatus, "cooldown");
  assert.equal(cooling.gunCharge, 0);
  assert.equal(cooling.gunCooldownMs, SKY_PATROL_GUN_COOLDOWN_MS - 1000);

  const recharging = stepSkyPatrolFor(cooling, 1, {}, constantRng(0.5));

  assert.equal(recharging.gunStatus, "recharging");
  assert.equal(recharging.gunCharge, 0);
  assert.equal(recharging.gunCooldownMs, 0);

  const halfRecovered = stepSkyPatrolFor(recharging, SKY_PATROL_GUN_DRAIN_MS / 2000, {}, constantRng(0.5));

  assert.equal(halfRecovered.gunStatus, "recharging");
  assert.ok(Math.abs(halfRecovered.gunCharge - 0.5) < 0.001);

  const ready = stepSkyPatrolFor(halfRecovered, SKY_PATROL_GUN_DRAIN_MS / 2000, {}, constantRng(0.5));

  assert.equal(ready.gunStatus, "ready");
  assert.equal(ready.gunCharge, 1);
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
  assert.equal(next.targetsDestroyed, 1);
  assert.equal(next.airEnemies.length, 0);
  assert.ok(next.explosions.length > 0);
  assert.equal(next.scoreBursts.length, 1);
  assert.equal(next.scoreBursts[0].value, SKY_PATROL_FIGHTER_SCORE);
  assert.equal(next.scoreBursts[0].x, 320);
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
  assert.ok(next.groundTargets[0].siteTerrain);
  assert.ok(next.groundTargets[0].siteSpan > 0);
  assert.ok(next.groundSpawnCooldownMs > 1000);
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
  assert.ok(gameOver.damageFlashMs > 0);

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

test("stepSkyPatrolGame uses the larger enemy shot bounds for player collisions", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const base = createSkyPatrolGame(960, 720, constantRng(0.5));
  const barelyOverlappingShotX = base.ship.x + base.ship.width / 2 + layout.enemyShotWidth / 2 - 1;
  const state = {
    ...base,
    enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
    groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    enemyShots: [
      {
        id: "enemy-shot-1",
        kind: "fighter",
        x: barelyOverlappingShotX,
        y: base.ship.y,
        width: layout.enemyShotWidth,
        height: layout.enemyShotHeight,
        vx: 0,
        vy: 0,
      },
    ],
  };

  const next = stepSkyPatrolGame(state, 0, {}, constantRng(0.5));

  assert.equal(next.lives, SKY_PATROL_STARTING_LIVES - 1);
  assert.equal(next.enemyShots.length, 0);
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
  assert.equal(next.targetsDestroyed, 1);
  assert.equal(next.groundTargets.length, 0);
  assert.equal(next.scoreBursts.length, 1);
  assert.equal(next.scoreBursts[0].value, SKY_PATROL_DEPOT_SCORE);
});

test("Sky Patrol daily missions replay the same deterministic opening wave", () => {
  const first = createSkyPatrolDailyGame(960, 720, {
    date: "2026-07-28T12:00:00Z",
  });
  const second = createSkyPatrolDailyGame(960, 720, {
    date: "2026-07-28T23:59:59Z",
  });

  assert.deepEqual(first.challenge, second.challenge);
  assert.deepEqual(
    getSkyPatrolDailyMission("2026-07-28T00:00:01Z"),
    getSkyPatrolDailyMission("2026-07-28T22:30:00Z"),
  );

  const openingState = (game) => ({
    ...game,
    enemySpawnCooldownMs: 0,
    groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
  });
  const firstWave = stepSkyPatrolGame(openingState(first), 0.016);
  const replayedWave = stepSkyPatrolGame(openingState(second), 0.016);

  assert.deepEqual(firstWave.airEnemies, replayedWave.airEnemies);
  assert.equal(firstWave.randomState, replayedWave.randomState);

  const dayKeyOnly = createSkyPatrolDailyGame(960, 720, {
    dayKey: "2000-01-01",
  });
  assert.equal(
    dayKeyOnly.challenge.seed,
    getSkyPatrolDailyMission("2000-01-01T00:00:00Z").seed,
  );
  assert.equal(
    dayKeyOnly.challenge.routeId,
    getSkyPatrolDailyMission("2000-01-01T00:00:00Z").routeId,
  );
});

test("Sky Patrol launch safety delays hostile fire without blocking movement", () => {
  const game = createSkyPatrolGame(960, 720);
  const enemy = {
    id: "fighter-safe",
    kind: "fighter",
    x: game.layout.width / 2,
    y: game.layout.height * 0.25,
    width: game.layout.enemyWidth,
    height: game.layout.enemyHeight,
    startX: game.layout.width / 2,
    speedY: 0,
    swayAmplitude: 0,
    swayHz: 1,
    driftX: 0,
    phase: 0,
    lifeMs: 0,
    hp: 2,
    maxHp: 2,
    shotCooldownMs: 0,
  };
  const protectedStep = stepSkyPatrolGame(
    {
      ...game,
      airEnemies: [enemy],
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    { pointerActive: true, pointerX: 240, pointerY: 320 },
    constantRng(0.5),
  );

  assert.equal(protectedStep.enemyShots.length, 0);
  assert.notEqual(protectedStep.ship.x, game.ship.x);

  const liveStep = stepSkyPatrolGame(
    {
      ...protectedStep,
      startSafetyMs: 0,
      airEnemies: [{ ...protectedStep.airEnemies[0], shotCooldownMs: 0 }],
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.equal(liveStep.enemyShots.length, 1);
});

test("later Sky Patrol missions introduce fast and heavy enemy archetypes", () => {
  const game = createSkyPatrolGame(960, 720);
  const missionConfig = getSkyPatrolMissionConfig(2);
  const next = stepSkyPatrolGame(
    {
      ...game,
      mission: 2,
      missionConfig,
      enemySpawnCooldownMs: 0,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.equal(next.airEnemies.length, 1);
  assert.equal(next.airEnemies[0].kind, "interceptor");
  assert.equal(next.airEnemies[0].hp, 1);
  assert.ok(next.threatTelegraphs.some((item) => item.kind === "interceptor"));
});

test("Sky Patrol chains rapid eliminations into combo scoring and accuracy", () => {
  const game = createSkyPatrolGame(960, 720);
  const makeEnemy = (id, x) => ({
    id,
    kind: "fighter",
    score: SKY_PATROL_FIGHTER_SCORE,
    x,
    y: 220,
    width: game.layout.enemyWidth,
    height: game.layout.enemyHeight,
    startX: x,
    speedY: 0,
    swayAmplitude: 0,
    swayHz: 1,
    driftX: 0,
    phase: 0,
    lifeMs: 0,
    hp: 1,
    maxHp: 1,
    shotCooldownMs: Number.POSITIVE_INFINITY,
  });
  const makeShot = (id, x) => ({
    id,
    kind: "player",
    x,
    y: 232,
    width: game.layout.playerShotWidth,
    height: game.layout.playerShotHeight,
    vx: 0,
    vy: -game.layout.playerShotSpeed,
  });
  const next = stepSkyPatrolGame(
    {
      ...game,
      airEnemies: [makeEnemy("fighter-1", 280), makeEnemy("fighter-2", 520)],
      playerShots: [makeShot("shot-1", 280), makeShot("shot-2", 520)],
      shotsFired: 2,
      missionShotsFired: 2,
      stats: { ...game.stats, shotsFired: 2 },
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.equal(next.comboCount, 2);
  assert.equal(next.bestCombo, 2);
  assert.equal(next.shotsHit, 2);
  assert.equal(next.missionProgress, 2);
  assert.equal(next.score, 333);
});

test("Sky Patrol shields absorb a hit and collectible tools alter the sortie", () => {
  const game = spawnSkyPatrolPowerUp(
    createSkyPatrolGame(960, 720),
    "shield",
    480,
    720 * 0.78,
  );
  const collected = stepSkyPatrolGame(
    {
      ...game,
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0,
    {},
    constantRng(0.5),
  );

  assert.equal(collected.shieldCharges, 1);
  assert.equal(collected.powerUps.length, 0);

  const shielded = stepSkyPatrolGame(
    {
      ...collected,
      enemyShots: [
        {
          id: "enemy-shot-shield",
          kind: "fighter",
          x: collected.ship.x,
          y: collected.ship.y,
          width: collected.layout.enemyShotWidth,
          height: collected.layout.enemyShotHeight,
          vx: 0,
          vy: 0,
        },
      ],
    },
    0,
    {},
    constantRng(0.5),
  );

  assert.equal(shielded.lives, SKY_PATROL_STARTING_LIVES);
  assert.equal(shielded.shieldCharges, 0);
  assert.equal(shielded.stats.shieldsUsed, 1);

  const wingmen = stepSkyPatrolGame(
    {
      ...shielded,
      ship: { ...shielded.ship, invulnerableMs: 0 },
    },
    0,
    { wingmanRequested: true, fireRequested: true },
    constantRng(0.5),
  );
  assert.ok(wingmen.wingmanActiveMs > 0);
  assert.equal(wingmen.playerShots.length, 3);
});

test("holding fire through an overheat automatically calls an available wingman", () => {
  const game = createSkyPatrolGame(960, 720);
  const next = stepSkyPatrolGame(
    {
      ...game,
      gunStatus: "cooldown",
      gunCharge: 0,
      gunCooldownMs: 1200,
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    { fireRequested: true },
    constantRng(0.5),
  );

  assert.equal(next.wingmanCharges, 0);
  assert.ok(next.wingmanActiveMs > 0);
  assert.equal(next.stats.wingmanUses, 1);
});

test("Sky Patrol checkpoints recap a goal and advance into the boss mission", () => {
  const game = createSkyPatrolGame(960, 720);
  const enemy = {
    id: "fighter-goal",
    kind: "fighter",
    score: SKY_PATROL_FIGHTER_SCORE,
    x: 320,
    y: 220,
    width: game.layout.enemyWidth,
    height: game.layout.enemyHeight,
    startX: 320,
    speedY: 0,
    swayAmplitude: 0,
    swayHz: 1,
    driftX: 0,
    phase: 0,
    lifeMs: 0,
    hp: 1,
    maxHp: 1,
    shotCooldownMs: Number.POSITIVE_INFINITY,
  };
  const checkpoint = stepSkyPatrolGame(
    {
      ...game,
      missionProgress: game.missionConfig.targetGoal - 1,
      airEnemies: [enemy],
      playerShots: [
        {
          id: "goal-shot",
          kind: "player",
          x: 320,
          y: 232,
          width: game.layout.playerShotWidth,
          height: game.layout.playerShotHeight,
          vx: 0,
          vy: -game.layout.playerShotSpeed,
        },
      ],
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.equal(checkpoint.status, "checkpoint");
  assert.equal(checkpoint.stats.missionsCleared, 1);
  assert.equal(checkpoint.lastMissionRecap.targetsDestroyed, 6);
  assert.ok(checkpoint.lastMissionRecap.checkpointBonus > 0);

  const bossMission = advanceSkyPatrolMission(
    {
      ...checkpoint,
      mission: 3,
      missionConfig: getSkyPatrolMissionConfig(3),
    },
    constantRng(0.5),
  );
  assert.equal(bossMission.mission, 4);
  assert.equal(bossMission.airEnemies[0].kind, "ace");
  assert.equal(bossMission.airEnemies[0].hp, SKY_PATROL_BOSS_HP);
  assert.equal(bossMission.threatTelegraphs[0].label, "Boss incoming");
});

test("defeating the storm ace produces a structured victory result", () => {
  const game = createSkyPatrolGame(960, 720);
  const missionConfig = getSkyPatrolMissionConfig(4);
  const victory = stepSkyPatrolGame(
    {
      ...game,
      mission: 4,
      missionConfig,
      missionProgress: 0,
      stats: { ...game.stats, missionsCleared: 3 },
      airEnemies: [
        {
          id: "ace-final",
          kind: "ace",
          isBoss: true,
          score: SKY_PATROL_BOSS_SCORE,
          x: 480,
          y: 180,
          width: game.layout.enemyWidth * 2,
          height: game.layout.enemyHeight * 2,
          startX: 480,
          speedY: 0,
          swayAmplitude: 0,
          swayHz: 1,
          driftX: 0,
          phase: 0,
          lifeMs: 0,
          hp: 1,
          maxHp: SKY_PATROL_BOSS_HP,
          shotCooldownMs: Number.POSITIVE_INFINITY,
        },
      ],
      playerShots: [
        {
          id: "ace-shot",
          kind: "player",
          x: 480,
          y: 190,
          width: game.layout.playerShotWidth,
          height: game.layout.playerShotHeight,
          vx: 0,
          vy: -game.layout.playerShotSpeed,
        },
      ],
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    {},
    constantRng(0.5),
  );

  assert.equal(victory.status, "gameover");
  assert.equal(victory.outcome, "victory");
  assert.equal(victory.result.bossDefeated, true);
  assert.equal(victory.result.missionsCleared, 4);
  assert.equal(victory.result.totalMissions, 4);
});

test("the storm ace escalates from a three-shot pattern to an enraged spread", () => {
  const game = createSkyPatrolGame(960, 720);
  const missionConfig = getSkyPatrolMissionConfig(4);
  const ace = {
    id: "ace-pattern",
    kind: "ace",
    isBoss: true,
    x: 480,
    y: 150,
    width: game.layout.enemyWidth * 2.35,
    height: game.layout.enemyHeight * 2.35,
    startX: 480,
    speedY: 0,
    swayAmplitude: 0,
    swayHz: 1,
    driftX: 0,
    phase: 0,
    lifeMs: 0,
    hp: SKY_PATROL_BOSS_HP,
    maxHp: SKY_PATROL_BOSS_HP,
    shotCooldownMs: 0,
  };
  const opening = stepSkyPatrolGame(
    {
      ...game,
      mission: 4,
      missionConfig,
      startSafetyMs: 0,
      airEnemies: [ace],
      enemySpawnCooldownMs: Number.POSITIVE_INFINITY,
      groundSpawnCooldownMs: Number.POSITIVE_INFINITY,
    },
    0.016,
    {},
    constantRng(0.5),
  );
  assert.equal(opening.enemyShots.length, 3);

  const enraged = stepSkyPatrolGame(
    {
      ...opening,
      airEnemies: [
        {
          ...opening.airEnemies[0],
          hp: SKY_PATROL_BOSS_HP / 2,
          shotCooldownMs: 0,
        },
      ],
      enemyShots: [],
    },
    0.016,
    {},
    constantRng(0.5),
  );
  assert.equal(enraged.enemyShots.length, 5);
  assert.ok(enraged.airEnemies[0].shotCooldownMs < opening.airEnemies[0].shotCooldownMs);
});
