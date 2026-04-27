import test from "node:test";
import assert from "node:assert/strict";

import {
  SKY_PATROL_DEPOT_SCORE,
  SKY_PATROL_FIGHTER_SCORE,
  SKY_PATROL_GUN_COOLDOWN_MS,
  SKY_PATROL_GUN_DRAIN_MS,
  SKY_PATROL_STARTING_LIVES,
  createSkyPatrolGame,
  createSkyPatrolLayout,
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
