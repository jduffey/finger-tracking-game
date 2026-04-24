import { createScopedLogger } from "./logger.js";

const skyPatrolLog = createScopedLogger("skyPatrolGame");

export const SKY_PATROL_STARTING_LIVES = 3;
export const SKY_PATROL_FIGHTER_SCORE = 160;
export const SKY_PATROL_TURRET_SCORE = 220;
export const SKY_PATROL_DEPOT_SCORE = 340;

const SKY_PATROL_MAX_STEP_SECONDS = 0.05;
const SKY_PATROL_ELEMENT_SCALE = 1;
export const SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS = 130;
const SKY_PATROL_ENEMY_SPAWN_COOLDOWN_MS = 680;
const SKY_PATROL_GROUND_SPAWN_COOLDOWN_MS = 1320;
const SKY_PATROL_PLAYER_INVULNERABLE_MS = 980;
const SKY_PATROL_RESTART_COOLDOWN_MS = 700;
const SKY_PATROL_EXPLOSION_TTL_MS = 460;
const SKY_PATROL_SCORE_BURST_TTL_MS = 760;
const SKY_PATROL_DAMAGE_FLASH_MS = 320;
const SKY_PATROL_SCROLL_TILES_BUFFER = 2;
const SKY_PATROL_SECONDARY_ISLAND_THRESHOLD = 0.72;
const SKY_PATROL_RUNWAY_PERIOD_ROWS = 140;
const SKY_PATROL_RUNWAY_START_ROW = 42;
const SKY_PATROL_RUNWAY_END_ROW = 45;
const SKY_PATROL_ROAD_PERIOD_ROWS = 88;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positiveModulo(value, divisor) {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) {
    return 0;
  }
  return ((value % divisor) + divisor) % divisor;
}

function randomBetween(min, max, rng = Math.random) {
  return min + rng() * Math.max(0, max - min);
}

function hashNoise(a, b = 0) {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function createTerrainSegments(tiles) {
  const safeTiles = Array.isArray(tiles) ? tiles : [];
  if (safeTiles.length === 0) {
    return [];
  }

  const segments = [];
  let currentTerrain = safeTiles[0];
  let segmentStart = 0;

  for (let index = 1; index <= safeTiles.length; index += 1) {
    const terrain = safeTiles[index] ?? null;
    if (terrain === currentTerrain) {
      continue;
    }

    segments.push({
      terrain: currentTerrain,
      startColumn: segmentStart,
      length: index - segmentStart,
    });
    currentTerrain = terrain;
    segmentStart = index;
  }

  return segments;
}

function getCenteredRect(entity) {
  return {
    x: entity.x - entity.width / 2,
    y: entity.y - entity.height / 2,
    width: entity.width,
    height: entity.height,
  };
}

function intersectsRect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function createExplosion(id, x, y, kind = "hit") {
  return {
    id,
    x,
    y,
    kind,
    ageMs: 0,
    ttlMs: SKY_PATROL_EXPLOSION_TTL_MS,
  };
}

function advanceExplosions(explosions, dtMs) {
  return (Array.isArray(explosions) ? explosions : [])
    .map((explosion) => ({
      ...explosion,
      ageMs: explosion.ageMs + dtMs,
    }))
    .filter((explosion) => explosion.ageMs < explosion.ttlMs);
}

function createScoreBurst(id, x, y, value) {
  return {
    id,
    x,
    y,
    value,
    ageMs: 0,
    ttlMs: SKY_PATROL_SCORE_BURST_TTL_MS,
  };
}

function advanceScoreBursts(scoreBursts, dtMs) {
  return (Array.isArray(scoreBursts) ? scoreBursts : [])
    .map((burst) => ({
      ...burst,
      ageMs: burst.ageMs + dtMs,
    }))
    .filter((burst) => burst.ageMs < burst.ttlMs);
}

function createPlayerShip(layout) {
  return {
    x: layout.width / 2,
    y: layout.height * 0.78,
    width: layout.playerWidth,
    height: layout.playerHeight,
    invulnerableMs: 0,
  };
}

function createProjectile(id, kind, x, y, width, height, vx, vy) {
  return { id, kind, x, y, width, height, vx, vy };
}

function createAirEnemy(layout, nextId, rng = Math.random) {
  const width = layout.enemyWidth * randomBetween(0.92, 1.06, rng);
  const height = layout.enemyHeight * randomBetween(0.92, 1.08, rng);
  const startX = randomBetween(width / 2 + 16, layout.width - width / 2 - 16, rng);
  return {
    id: `fighter-${nextId}`,
    kind: "fighter",
    x: startX,
    y: -height - randomBetween(layout.tileSize, layout.tileSize * 4, rng),
    width,
    height,
    startX,
    speedY: randomBetween(layout.enemyFlightSpeed * 0.92, layout.enemyFlightSpeed * 1.22, rng),
    swayAmplitude: randomBetween(layout.width * 0.05, layout.width * 0.12, rng),
    swayHz: randomBetween(1.2, 2.05, rng),
    driftX: randomBetween(-layout.width * 0.02, layout.width * 0.02, rng),
    phase: randomBetween(0, Math.PI * 2, rng),
    lifeMs: 0,
    hp: 2,
    maxHp: 2,
    shotCooldownMs: randomBetween(320, 920, rng),
  };
}

function isLandTerrain(terrain) {
  return terrain === "grass" || terrain === "forest" || terrain === "runway" || terrain === "road";
}

function createSkyPatrolTerrainRow(layout, worldRow) {
  const tiles = Array.from({ length: layout.columns }, (_, column) =>
    hashNoise(worldRow, column + 0.2) > 0.85 ? "shallow-water" : "deep-water",
  );
  const primaryCenter =
    layout.columns *
    (0.52 + Math.sin(worldRow * 0.052) * 0.15 + Math.sin(worldRow * 0.018 + 1.6) * 0.06);
  const primaryHalfWidth =
    layout.columns *
    (0.14 + 0.06 * ((Math.sin(worldRow * 0.037) + 1) * 0.5) + 0.03 * hashNoise(worldRow, 9));
  const islands = [
    {
      center: primaryCenter,
      halfWidth: Math.max(3.2, primaryHalfWidth),
    },
  ];
  const secondaryChance = hashNoise(worldRow, 41);
  if (secondaryChance > SKY_PATROL_SECONDARY_ISLAND_THRESHOLD) {
    const direction = secondaryChance > 0.72 ? -1 : 1;
    const center =
      primaryCenter + direction * (primaryHalfWidth + layout.columns * (0.08 + 0.05 * secondaryChance));
    const halfWidth = layout.columns * (0.04 + 0.024 * hashNoise(worldRow, 91));
    if (center > -halfWidth && center < layout.columns + halfWidth) {
      islands.push({ center, halfWidth });
    }
  }

  for (const island of islands) {
    for (let column = 0; column < layout.columns; column += 1) {
      const distanceFromCenter = Math.abs(column - island.center);
      const coastDepth = island.halfWidth - distanceFromCenter;
      if (coastDepth < -0.2) {
        continue;
      }

      if (coastDepth < 0.5) {
        tiles[column] = "beach";
      } else if (coastDepth < 1.45) {
        tiles[column] = hashNoise(worldRow + 13, column + 7) > 0.48 ? "grass" : "forest";
      } else {
        tiles[column] = hashNoise(worldRow + 29, column + 17) > 0.68 ? "forest" : "grass";
      }
    }
  }

  for (let column = 1; column < layout.columns - 1; column += 1) {
    if (tiles[column] === "deep-water") {
      const leftTerrain = tiles[column - 1];
      const rightTerrain = tiles[column + 1];
      if (isLandTerrain(leftTerrain) || isLandTerrain(rightTerrain) || leftTerrain === "beach" || rightTerrain === "beach") {
        tiles[column] = "shallow-water";
      }
    }
  }

  const runwayBand = positiveModulo(worldRow, SKY_PATROL_RUNWAY_PERIOD_ROWS);
  if (
    runwayBand >= SKY_PATROL_RUNWAY_START_ROW &&
    runwayBand <= SKY_PATROL_RUNWAY_END_ROW &&
    primaryHalfWidth > 5
  ) {
    const runwayHalfWidth = Math.max(2, Math.min(Math.floor(primaryHalfWidth * 0.24), 4));
    const runwayCenter = Math.round(primaryCenter + Math.sin(worldRow * 0.09) * 1.4);
    for (let column = runwayCenter - runwayHalfWidth; column <= runwayCenter + runwayHalfWidth; column += 1) {
      if (column < 0 || column >= layout.columns || !isLandTerrain(tiles[column])) {
        continue;
      }
      tiles[column] = "runway";
    }
  }

  const roadBand = positiveModulo(worldRow + 17, SKY_PATROL_ROAD_PERIOD_ROWS);
  if (roadBand === 0) {
    const roadCenter = Math.round(primaryCenter + Math.sin(worldRow * 0.11) * 1.8);
    for (let column = roadCenter; column <= roadCenter; column += 1) {
      if (column < 0 || column >= layout.columns || !isLandTerrain(tiles[column])) {
        continue;
      }
      tiles[column] = "road";
    }
  }

  return {
    worldRow,
    segments: createTerrainSegments(tiles),
  };
}

export function getSkyPatrolTerrainRows(layout, startWorldRow, rowCount) {
  if (!layout) {
    return [];
  }

  const safeStartWorldRow = Number.isFinite(startWorldRow) ? Math.floor(startWorldRow) : 0;
  const safeRowCount = Math.max(0, Number.isFinite(rowCount) ? Math.ceil(rowCount) : 0);

  return Array.from({ length: safeRowCount }, (_, index) =>
    createSkyPatrolTerrainRow(layout, safeStartWorldRow + index),
  );
}

export function getSkyPatrolTerrainScrollMetrics(layout, scrollOffset) {
  if (!layout || !Number.isFinite(layout.tileSize) || layout.tileSize <= 0) {
    return {
      baseWorldRow: 0,
      rowOffset: 0,
      safeScrollOffset: 0,
      startWorldRow: -1,
    };
  }

  const safeScrollOffset = Math.max(0, Number.isFinite(scrollOffset) ? scrollOffset : 0);
  const baseWorldRow = Math.floor(safeScrollOffset / layout.tileSize);

  return {
    baseWorldRow,
    rowOffset: safeScrollOffset - baseWorldRow * layout.tileSize,
    safeScrollOffset,
    startWorldRow: -baseWorldRow - 1,
  };
}

export function getSkyPatrolVisibleTerrainRows(layout, scrollOffset) {
  if (!layout) {
    return [];
  }

  const { rowOffset, startWorldRow } = getSkyPatrolTerrainScrollMetrics(layout, scrollOffset);
  return getSkyPatrolTerrainRows(
    layout,
    startWorldRow,
    layout.visibleTerrainRows + SKY_PATROL_SCROLL_TILES_BUFFER + 1,
  )
    .map((row, index) => {
      const rowIndex = index - 1;
      return {
        ...row,
        y: rowIndex * layout.tileSize + rowOffset,
      };
    })
    .filter((row) => row.y > -layout.tileSize && row.y < layout.height + layout.tileSize);
}

function createGroundTarget(layout, scrollOffset, nextId, rng = Math.random) {
  const { startWorldRow } = getSkyPatrolTerrainScrollMetrics(layout, scrollOffset);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const spawnWorldRow = startWorldRow - 1 - attempt;
    const terrainRow = createSkyPatrolTerrainRow(layout, spawnWorldRow);
    const viableSegments = terrainRow.segments.filter(
      (segment) => isLandTerrain(segment.terrain) && segment.length >= 2,
    );
    if (viableSegments.length === 0) {
      continue;
    }

    const segment = viableSegments[Math.floor(rng() * viableSegments.length)] ?? viableSegments[0];
    const kind = segment.length >= 3 && rng() > 0.64 ? "depot" : "turret";
    const width = kind === "depot" ? layout.depotWidth : layout.turretWidth;
    const height = kind === "depot" ? layout.depotHeight : layout.turretHeight;
    const segmentLeft = segment.startColumn * layout.tileSize;
    const segmentWidth = segment.length * layout.tileSize;
    const jitterSpan = Math.max(0, segmentWidth * 0.18);
    const x = clamp(
      segmentLeft + segmentWidth / 2 + randomBetween(-jitterSpan, jitterSpan, rng),
      width / 2 + 10,
      layout.width - width / 2 - 10,
    );

    return {
      id: `${kind}-${nextId}`,
      kind,
      x,
      y: -height - randomBetween(layout.tileSize * 0.8, layout.tileSize * 3.4, rng),
      width,
      height,
      hp: kind === "depot" ? 4 : 2,
      maxHp: kind === "depot" ? 4 : 2,
      score: kind === "depot" ? SKY_PATROL_DEPOT_SCORE : SKY_PATROL_TURRET_SCORE,
      siteTerrain: segment.terrain,
      siteSpan: segment.length,
      shotCooldownMs: kind === "turret" ? randomBetween(620, 1120, rng) : Number.POSITIVE_INFINITY,
    };
  }

  return null;
}

function createEmptyState(layout) {
  return {
    layout,
    ship: createPlayerShip(layout),
    scrollOffset: 0,
    elapsedMs: 0,
    score: 0,
    targetsDestroyed: 0,
    lives: SKY_PATROL_STARTING_LIVES,
    status: "playing",
    message: "Pinch to fire twin cannons.",
    airEnemies: [],
    groundTargets: [],
    playerShots: [],
    enemyShots: [],
    explosions: [],
    scoreBursts: [],
    damageFlashMs: 0,
    fireCooldownMs: 0,
    enemySpawnCooldownMs: 320,
    groundSpawnCooldownMs: 540,
    restartCooldownMs: 0,
    nextFighterId: 1,
    nextGroundTargetId: 1,
    nextPlayerShotId: 1,
    nextEnemyShotId: 1,
    nextFxId: 1,
    nextScoreBurstId: 1,
  };
}

export function createSkyPatrolLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(320, Number.isFinite(height) ? height : 320);
  const minDimension = Math.min(safeWidth, safeHeight);
  const tileSize = clamp(minDimension * 0.032, 18, 26);
  const playerWidth = clamp(safeWidth * 0.055, 46, 74) * SKY_PATROL_ELEMENT_SCALE;
  const playerHeight = clamp(safeHeight * 0.09, 54, 86) * SKY_PATROL_ELEMENT_SCALE;
  const enemyWidth = clamp(playerWidth * 0.88, 40, 68);
  const enemyHeight = clamp(playerHeight * 0.84, 46, 78);
  const turretWidth = clamp(tileSize * 1.55, 24, 36);
  const turretHeight = clamp(tileSize * 1.32, 22, 34);
  const depotWidth = clamp(tileSize * 2.45, 38, 58);
  const depotHeight = clamp(tileSize * 1.65, 24, 42);
  const playerShotWidth = clamp(tileSize * 0.34, 5, 9);
  const playerShotHeight = clamp(tileSize * 0.96, 14, 22);
  const enemyShotWidth = clamp(tileSize * 0.3, 5, 8);
  const enemyShotHeight = clamp(tileSize * 0.82, 12, 20);

  return {
    width: safeWidth,
    height: safeHeight,
    tileSize,
    columns: Math.ceil(safeWidth / tileSize) + 1,
    visibleTerrainRows: Math.ceil(safeHeight / tileSize) + SKY_PATROL_SCROLL_TILES_BUFFER,
    scrollSpeed: Math.max(82, safeHeight * 0.18),
    playerWidth,
    playerHeight,
    enemyWidth,
    enemyHeight,
    turretWidth,
    turretHeight,
    depotWidth,
    depotHeight,
    playerShotWidth,
    playerShotHeight,
    enemyShotWidth,
    enemyShotHeight,
    playerShotSpeed: Math.max(360, safeHeight * 0.98),
    enemyShotSpeed: Math.max(180, safeHeight * 0.42),
    groundShotSpeed: Math.max(160, safeHeight * 0.34),
    enemyFlightSpeed: Math.max(110, safeHeight * 0.22),
    playerLerpPerSecond: 18,
    playerMinX: playerWidth / 2 + 12,
    playerMaxX: safeWidth - playerWidth / 2 - 12,
    playerMinY: clamp(safeHeight * 0.18, 68, 118),
    playerMaxY: safeHeight - playerHeight / 2 - 18,
  };
}

export function createSkyPatrolGame(width, height, rng = Math.random) {
  const layout = createSkyPatrolLayout(width, height);
  const state = createEmptyState(layout);
  skyPatrolLog.info("Created sky patrol state", {
    width: layout.width,
    height: layout.height,
    tileSize: layout.tileSize,
  });
  return state;
}

function restartSkyPatrolGame(state, rng = Math.random) {
  return createSkyPatrolGame(state.layout.width, state.layout.height, rng);
}

export function stepSkyPatrolGame(state, dtSeconds, input = {}, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }

  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, SKY_PATROL_MAX_STEP_SECONDS);
  const dtMs = safeDt * 1000;
  const layout = state.layout;
  const pointerActive =
    input.pointerActive !== false &&
    Number.isFinite(input.pointerX) &&
    Number.isFinite(input.pointerY);
  const fireRequested = Boolean(input.fireRequested);

  let ship = {
    ...state.ship,
    invulnerableMs: Math.max(0, state.ship.invulnerableMs - dtMs),
  };

  const nextStateBase = {
    ...state,
    elapsedMs: state.elapsedMs + dtMs,
    ship,
    explosions: advanceExplosions(state.explosions, dtMs),
    scoreBursts: advanceScoreBursts(state.scoreBursts, dtMs),
    damageFlashMs: Math.max(0, (state.damageFlashMs ?? 0) - dtMs),
    fireCooldownMs: Math.max(0, state.fireCooldownMs - dtMs),
    enemySpawnCooldownMs: Math.max(0, state.enemySpawnCooldownMs - dtMs),
    groundSpawnCooldownMs: Math.max(0, state.groundSpawnCooldownMs - dtMs),
    restartCooldownMs: Math.max(0, state.restartCooldownMs - dtMs),
  };

  if (nextStateBase.status !== "playing") {
    if (fireRequested && nextStateBase.restartCooldownMs <= 0) {
      return restartSkyPatrolGame(nextStateBase, rng);
    }
    return nextStateBase;
  }

  if (pointerActive) {
    const desiredX = clamp(input.pointerX, layout.playerMinX, layout.playerMaxX);
    const desiredY = clamp(input.pointerY, layout.playerMinY, layout.playerMaxY);
    const lerp = 1 - Math.exp(-layout.playerLerpPerSecond * safeDt);
    ship = {
      ...ship,
      x: ship.x + (desiredX - ship.x) * lerp,
      y: ship.y + (desiredY - ship.y) * lerp,
    };
  }

  let scrollOffset = nextStateBase.scrollOffset + layout.scrollSpeed * safeDt;
  let score = nextStateBase.score;
  let targetsDestroyed = nextStateBase.targetsDestroyed ?? 0;
  let lives = nextStateBase.lives;
  let status = nextStateBase.status;
  let message = nextStateBase.message;
  let fireCooldownMs = nextStateBase.fireCooldownMs;
  let enemySpawnCooldownMs = nextStateBase.enemySpawnCooldownMs;
  let groundSpawnCooldownMs = nextStateBase.groundSpawnCooldownMs;
  let restartCooldownMs = nextStateBase.restartCooldownMs;
  let nextFighterId = nextStateBase.nextFighterId;
  let nextGroundTargetId = nextStateBase.nextGroundTargetId;
  let nextPlayerShotId = nextStateBase.nextPlayerShotId;
  let nextEnemyShotId = nextStateBase.nextEnemyShotId;
  let nextFxId = nextStateBase.nextFxId;
  let nextScoreBurstId = nextStateBase.nextScoreBurstId;
  const explosions = [...nextStateBase.explosions];
  const scoreBursts = [...nextStateBase.scoreBursts];
  let damageFlashMs = nextStateBase.damageFlashMs;
  let playerShots = nextStateBase.playerShots.map((shot) => ({ ...shot }));
  let enemyShots = nextStateBase.enemyShots.map((shot) => ({ ...shot }));
  let airEnemies = nextStateBase.airEnemies.map((enemy) => ({ ...enemy }));
  let groundTargets = nextStateBase.groundTargets.map((target) => ({ ...target }));

  if (fireRequested && fireCooldownMs <= 0) {
    const wingOffset = ship.width * 0.18;
    playerShots.push(
      createProjectile(
        `player-shot-${nextPlayerShotId}`,
        "player",
        ship.x - wingOffset,
        ship.y - ship.height * 0.42,
        layout.playerShotWidth,
        layout.playerShotHeight,
        -40,
        -layout.playerShotSpeed,
      ),
    );
    nextPlayerShotId += 1;
    playerShots.push(
      createProjectile(
        `player-shot-${nextPlayerShotId}`,
        "player",
        ship.x + wingOffset,
        ship.y - ship.height * 0.42,
        layout.playerShotWidth,
        layout.playerShotHeight,
        40,
        -layout.playerShotSpeed,
      ),
    );
    nextPlayerShotId += 1;
    fireCooldownMs = SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS;
  }

  if (enemySpawnCooldownMs <= 0) {
    const spawnCount = rng() > 0.8 ? 2 : 1;
    for (let index = 0; index < spawnCount; index += 1) {
      airEnemies.push(createAirEnemy(layout, nextFighterId, rng));
      nextFighterId += 1;
    }
    enemySpawnCooldownMs = randomBetween(
      SKY_PATROL_ENEMY_SPAWN_COOLDOWN_MS * 0.72,
      SKY_PATROL_ENEMY_SPAWN_COOLDOWN_MS * 1.18,
      rng,
    );
  }

  if (groundSpawnCooldownMs <= 0) {
    const nextTarget = createGroundTarget(layout, scrollOffset, nextGroundTargetId, rng);
    if (nextTarget) {
      groundTargets.push(nextTarget);
      nextGroundTargetId += 1;
      groundSpawnCooldownMs = randomBetween(
        SKY_PATROL_GROUND_SPAWN_COOLDOWN_MS * 0.82,
        SKY_PATROL_GROUND_SPAWN_COOLDOWN_MS * 1.2,
        rng,
      );
    } else {
      groundSpawnCooldownMs = 220;
    }
  }

  const shipRect = getCenteredRect(ship);
  const offscreenMargin = layout.tileSize * 2.2;

  playerShots = playerShots
    .map((shot) => ({
      ...shot,
      x: shot.x + shot.vx * safeDt,
      y: shot.y + shot.vy * safeDt,
    }))
    .filter(
      (shot) =>
        shot.y + shot.height / 2 >= -offscreenMargin &&
        shot.y - shot.height / 2 <= layout.height + offscreenMargin &&
        shot.x + shot.width / 2 >= -offscreenMargin &&
        shot.x - shot.width / 2 <= layout.width + offscreenMargin,
    );

  enemyShots = enemyShots
    .map((shot) => ({
      ...shot,
      x: shot.x + shot.vx * safeDt,
      y: shot.y + shot.vy * safeDt,
    }))
    .filter(
      (shot) =>
        shot.y - shot.height / 2 <= layout.height + offscreenMargin &&
        shot.y + shot.height / 2 >= -offscreenMargin &&
        shot.x + shot.width / 2 >= -offscreenMargin &&
        shot.x - shot.width / 2 <= layout.width + offscreenMargin,
    );

  const queuedEnemyShots = [];
  airEnemies = airEnemies
    .map((enemy) => {
      const lifeMs = enemy.lifeMs + dtMs;
      const x = clamp(
        enemy.startX +
          Math.sin((lifeMs / 1000) * enemy.swayHz + enemy.phase) * enemy.swayAmplitude +
          enemy.driftX * (lifeMs / 1000),
        enemy.width / 2 + 10,
        layout.width - enemy.width / 2 - 10,
      );
      const y = enemy.y + (enemy.speedY + layout.scrollSpeed * 0.35) * safeDt;
      let shotCooldownMs = enemy.shotCooldownMs - dtMs;

      if (shotCooldownMs <= 0 && y > layout.height * 0.12 && y < layout.height * 0.74) {
        const dx = ship.x - x;
        const dy = Math.max(48, ship.y - y);
        const length = Math.max(1, Math.hypot(dx, dy));
        queuedEnemyShots.push(
          createProjectile(
            `enemy-shot-${nextEnemyShotId}`,
            "fighter",
            x,
            y + enemy.height * 0.38,
            layout.enemyShotWidth,
            layout.enemyShotHeight,
            (dx / length) * layout.enemyShotSpeed * 0.26,
            (dy / length) * layout.enemyShotSpeed,
          ),
        );
        nextEnemyShotId += 1;
        shotCooldownMs = randomBetween(820, 1320, rng);
      }

      return {
        ...enemy,
        x,
        y,
        lifeMs,
        shotCooldownMs,
      };
    })
    .filter((enemy) => enemy.y - enemy.height / 2 <= layout.height + offscreenMargin);

  groundTargets = groundTargets
    .map((target) => {
      const nextTarget = {
        ...target,
        y: target.y + layout.scrollSpeed * safeDt,
        shotCooldownMs: target.shotCooldownMs - dtMs,
      };
      if (
        nextTarget.kind === "turret" &&
        nextTarget.shotCooldownMs <= 0 &&
        nextTarget.y > layout.height * 0.14 &&
        nextTarget.y < layout.height * 0.78
      ) {
        const dx = ship.x - nextTarget.x;
        const dy = Math.max(44, ship.y - nextTarget.y);
        const length = Math.max(1, Math.hypot(dx, dy));
        queuedEnemyShots.push(
          createProjectile(
            `enemy-shot-${nextEnemyShotId}`,
            "turret",
            nextTarget.x,
            nextTarget.y - nextTarget.height * 0.24,
            layout.enemyShotWidth,
            layout.enemyShotHeight,
            (dx / length) * layout.groundShotSpeed * 0.18,
            (dy / length) * layout.groundShotSpeed,
          ),
        );
        nextEnemyShotId += 1;
        nextTarget.shotCooldownMs = randomBetween(980, 1540, rng);
      }
      return nextTarget;
    })
    .filter((target) => target.y - target.height / 2 <= layout.height + offscreenMargin);

  enemyShots.push(...queuedEnemyShots);

  const remainingPlayerShots = [];
  for (const shot of playerShots) {
    const shotRect = getCenteredRect(shot);
    let hit = false;

    for (const enemy of airEnemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      if (intersectsRect(shotRect, getCenteredRect(enemy))) {
        enemy.hp -= 1;
        hit = true;
        if (enemy.hp <= 0) {
          score += SKY_PATROL_FIGHTER_SCORE;
          targetsDestroyed += 1;
          scoreBursts.push(
            createScoreBurst(`score-burst-${nextScoreBurstId}`, enemy.x, enemy.y, SKY_PATROL_FIGHTER_SCORE),
          );
          nextScoreBurstId += 1;
          message = "Fighter down.";
          explosions.push(createExplosion(`fx-${nextFxId}`, enemy.x, enemy.y, "air"));
          nextFxId += 1;
        } else {
          explosions.push(createExplosion(`fx-${nextFxId}`, shot.x, shot.y, "spark"));
          nextFxId += 1;
        }
        break;
      }
    }

    if (!hit) {
      for (const target of groundTargets) {
        if (target.hp <= 0) {
          continue;
        }
        if (intersectsRect(shotRect, getCenteredRect(target))) {
          target.hp -= 1;
          hit = true;
          if (target.hp <= 0) {
            score += target.score;
            targetsDestroyed += 1;
            scoreBursts.push(
              createScoreBurst(`score-burst-${nextScoreBurstId}`, target.x, target.y, target.score),
            );
            nextScoreBurstId += 1;
            message = target.kind === "depot" ? "Depot demolished." : "Turret eliminated.";
            explosions.push(createExplosion(`fx-${nextFxId}`, target.x, target.y, "ground"));
            nextFxId += 1;
          } else {
            explosions.push(createExplosion(`fx-${nextFxId}`, shot.x, shot.y, "spark"));
            nextFxId += 1;
          }
          break;
        }
      }
    }

    if (!hit) {
      remainingPlayerShots.push(shot);
    }
  }
  playerShots = remainingPlayerShots;
  airEnemies = airEnemies.filter((enemy) => enemy.hp > 0);
  groundTargets = groundTargets.filter((target) => target.hp > 0);

  function registerPlayerHit(hitX, hitY) {
    if (ship.invulnerableMs > 0 || status !== "playing") {
      return;
    }

    lives -= 1;
    damageFlashMs = SKY_PATROL_DAMAGE_FLASH_MS;
    explosions.push(createExplosion(`fx-${nextFxId}`, hitX, hitY, lives <= 0 ? "crash" : "player"));
    nextFxId += 1;
    ship = {
      ...ship,
      x: layout.width / 2,
      y: layout.height * 0.78,
      invulnerableMs: lives > 0 ? SKY_PATROL_PLAYER_INVULNERABLE_MS : 0,
    };
    if (lives <= 0) {
      status = "gameover";
      message = "Squadron down. Pinch to relaunch.";
      restartCooldownMs = Math.max(restartCooldownMs, SKY_PATROL_RESTART_COOLDOWN_MS);
    } else {
      message = "Direct hit. Regroup and re-engage.";
    }
  }

  if (ship.invulnerableMs <= 0) {
    const survivingEnemyShots = [];
    for (const shot of enemyShots) {
      const shotRect = getCenteredRect(shot);
      if (intersectsRect(shotRect, shipRect)) {
        registerPlayerHit(shot.x, shot.y);
        continue;
      }
      survivingEnemyShots.push(shot);
    }
    enemyShots = survivingEnemyShots;

    if (status === "playing" && ship.invulnerableMs <= 0) {
      const collidingEnemy = airEnemies.find((enemy) => intersectsRect(getCenteredRect(enemy), shipRect));
      if (collidingEnemy) {
        registerPlayerHit(collidingEnemy.x, collidingEnemy.y);
        airEnemies = airEnemies.filter((enemy) => enemy.id !== collidingEnemy.id);
      }
    }

    if (status === "playing" && ship.invulnerableMs <= 0) {
      const collidingGroundTarget = groundTargets.find((target) =>
        intersectsRect(getCenteredRect(target), shipRect),
      );
      if (collidingGroundTarget) {
        registerPlayerHit(collidingGroundTarget.x, collidingGroundTarget.y);
        groundTargets = groundTargets.filter((target) => target.id !== collidingGroundTarget.id);
      }
    }
  }

  return {
    ...nextStateBase,
    ship,
    scrollOffset,
    score,
    targetsDestroyed,
    lives,
    status,
    message,
    playerShots,
    enemyShots,
    airEnemies,
    groundTargets,
    explosions,
    scoreBursts,
    damageFlashMs,
    fireCooldownMs,
    enemySpawnCooldownMs,
    groundSpawnCooldownMs,
    restartCooldownMs,
    nextFighterId,
    nextGroundTargetId,
    nextPlayerShotId,
    nextEnemyShotId,
    nextFxId,
    nextScoreBurstId,
  };
}
