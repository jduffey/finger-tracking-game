import { createScopedLogger } from "./logger.js";

const skyPatrolLog = createScopedLogger("skyPatrolGame");

export const SKY_PATROL_STARTING_LIVES = 3;
export const SKY_PATROL_FIGHTER_SCORE = 160;
export const SKY_PATROL_TURRET_SCORE = 220;
export const SKY_PATROL_DEPOT_SCORE = 340;
export const SKY_PATROL_GUN_DRAIN_MS = 3000;
export const SKY_PATROL_GUN_COOLDOWN_MS = 2000;
export const SKY_PATROL_MISSION_COUNT = 4;
export const SKY_PATROL_CHECKPOINT_MS = 2200;
export const SKY_PATROL_START_SAFETY_MS = 2600;
export const SKY_PATROL_WINGMAN_DURATION_MS = 6000;
export const SKY_PATROL_POWER_UP_DURATION_MS = 5200;
export const SKY_PATROL_BOSS_SCORE = 2500;
export const SKY_PATROL_BOSS_HP = 48;

const SKY_PATROL_MAX_STEP_SECONDS = 0.05;
const SKY_PATROL_ELEMENT_SCALE = 1;
const SKY_PATROL_PLAYER_SCALE = 1.5;
const SKY_PATROL_PLAYER_SHOT_SCALE = 1.5;
export const SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS = 130;
const SKY_PATROL_ENEMY_SPAWN_COOLDOWN_MS = 1360;
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
const SKY_PATROL_COMBO_WINDOW_MS = 2200;
const SKY_PATROL_DEFAULT_SEED = 0xa341316c;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || SKY_PATROL_DEFAULT_SEED;
}

function normalizeSeed(seed) {
  if (Number.isFinite(seed)) {
    return Number(seed) >>> 0 || SKY_PATROL_DEFAULT_SEED;
  }
  return hashSeed(seed);
}

export function nextSkyPatrolRandom(seedState) {
  const state = (normalizeSeed(seedState) + SKY_PATROL_DEFAULT_SEED) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return {
    state,
    value: ((value ^ (value >>> 15)) >>> 0) / 4294967296,
  };
}

export function createSkyPatrolSeededRng(seed) {
  let state = normalizeSeed(seed);
  return () => {
    const next = nextSkyPatrolRandom(state);
    state = next.state;
    return next.value;
  };
}

function normalizeDailyDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

export function getSkyPatrolDailyMission(date = new Date()) {
  const dayKey = normalizeDailyDate(date).toISOString().slice(0, 10);
  const seed = hashSeed(`sky-patrol:${dayKey}`);
  const routeNames = ["Blue Current", "Island Chain", "Sunset Front"];
  return {
    id: `sky-patrol-daily-${dayKey}`,
    mode: "daily",
    dayKey,
    seed,
    routeId: seed % routeNames.length,
    routeName: routeNames[seed % routeNames.length],
    totalMissions: SKY_PATROL_MISSION_COUNT,
  };
}

export function getSkyPatrolMissionConfig(mission = 1, routeId = 0) {
  const normalizedMission = Math.max(
    1,
    Number.isFinite(mission) ? Math.floor(mission) : 1,
  );
  const definitions = [
    {
      name: "Coastal Sweep",
      goalText: "Destroy 6 threats",
      targetGoal: 6,
      airSpawnMultiplier: 1,
      groundSpawnMultiplier: 1,
      archetypes: ["fighter"],
    },
    {
      name: "Island Shield",
      goalText: "Destroy 8 threats",
      targetGoal: 8,
      airSpawnMultiplier: 0.88,
      groundSpawnMultiplier: 0.92,
      archetypes: ["fighter", "interceptor"],
    },
    {
      name: "Runway Breaker",
      goalText: "Destroy 10 threats",
      targetGoal: 10,
      airSpawnMultiplier: 0.78,
      groundSpawnMultiplier: 0.8,
      archetypes: ["fighter", "interceptor", "bomber"],
    },
    {
      name: "Ace of Storms",
      goalText: "Defeat the storm ace",
      targetGoal: 1,
      airSpawnMultiplier: 1,
      groundSpawnMultiplier: 1,
      archetypes: ["ace"],
      boss: true,
    },
  ];
  const definition =
    definitions[Math.min(definitions.length - 1, normalizedMission - 1)];
  return {
    mission: normalizedMission,
    routeId: Math.abs(Number.isFinite(routeId) ? Math.floor(routeId) : 0) % 3,
    ...definition,
  };
}

function createStats(overrides = {}) {
  return {
    missionsCleared: 0,
    shotsFired: 0,
    shotsHit: 0,
    targetsDestroyed: 0,
    airTargetsDestroyed: 0,
    groundTargetsDestroyed: 0,
    bossDefeated: false,
    powerUpsCollected: 0,
    wingmanUses: 0,
    shieldsUsed: 0,
    hitsTaken: 0,
    bestCombo: 0,
    checkpointBonus: 0,
    elapsedMs: 0,
    ...overrides,
  };
}

function normalizeStats(state) {
  return createStats(state?.stats);
}

export function getSkyPatrolResultStats(state) {
  if (!state?.layout) {
    return null;
  }
  if (state.result) {
    return state.result;
  }
  const stats = normalizeStats(state);
  return {
    outcome: state.outcome ?? (state.status === "gameover" ? "defeat" : "in_progress"),
    score: Math.max(0, state.score ?? 0),
    missionReached: state.mission ?? 1,
    missionsCleared: stats.missionsCleared,
    totalMissions: state.totalMissions ?? SKY_PATROL_MISSION_COUNT,
    livesRemaining: Math.max(0, state.lives ?? 0),
    targetsDestroyed: state.targetsDestroyed ?? stats.targetsDestroyed,
    airTargetsDestroyed: stats.airTargetsDestroyed,
    groundTargetsDestroyed: stats.groundTargetsDestroyed,
    bossDefeated: stats.bossDefeated,
    shotsFired: stats.shotsFired,
    shotsHit: stats.shotsHit,
    accuracy:
      stats.shotsFired > 0
        ? Math.min(100, Math.round((stats.shotsHit / stats.shotsFired) * 100))
        : 0,
    bestCombo: stats.bestCombo,
    powerUpsCollected: stats.powerUpsCollected,
    wingmanUses: stats.wingmanUses,
    shieldsUsed: stats.shieldsUsed,
    checkpointBonus: stats.checkpointBonus,
    elapsedMs: Math.round(stats.elapsedMs),
    lastMissionRecap: state.lastMissionRecap ?? null,
    challenge: state.challenge ?? null,
  };
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
    bank: 0,
    invulnerableMs: 0,
  };
}

function createProjectile(id, kind, x, y, width, height, vx, vy) {
  return { id, kind, x, y, width, height, vx, vy };
}

function createAirEnemy(
  layout,
  nextId,
  rng = Math.random,
  missionConfig = getSkyPatrolMissionConfig(),
  forcedKind,
) {
  const archetypes = missionConfig.archetypes ?? ["fighter"];
  const archetypeRoll = rng();
  const kind =
    forcedKind ??
    archetypes[
      Math.min(archetypes.length - 1, Math.floor(archetypeRoll * archetypes.length))
    ] ??
    "fighter";
  const sizeScale =
    kind === "ace" ? 2.35 : kind === "bomber" ? 1.42 : kind === "interceptor" ? 0.86 : 1;
  const width =
    layout.enemyWidth * randomBetween(0.92, 1.06, rng) * sizeScale;
  const height =
    layout.enemyHeight * randomBetween(0.92, 1.08, rng) * sizeScale;
  const startX = randomBetween(width / 2 + 16, layout.width - width / 2 - 16, rng);
  const speedScale =
    kind === "ace" ? 0.38 : kind === "bomber" ? 0.68 : kind === "interceptor" ? 1.42 : 1;
  const hp =
    kind === "ace"
      ? SKY_PATROL_BOSS_HP
      : kind === "bomber"
        ? 5
        : kind === "interceptor"
          ? 1
          : 2;
  const score =
    kind === "ace"
      ? SKY_PATROL_BOSS_SCORE
      : kind === "bomber"
        ? 480
        : kind === "interceptor"
          ? 210
          : SKY_PATROL_FIGHTER_SCORE;
  return {
    id: `${kind}-${nextId}`,
    kind,
    archetype: kind,
    x: startX,
    y:
      kind === "ace"
        ? layout.height * 0.16
        : -height - randomBetween(layout.tileSize, layout.tileSize * 4, rng),
    width,
    height,
    startX,
    speedY:
      randomBetween(layout.enemyFlightSpeed * 0.92, layout.enemyFlightSpeed * 1.22, rng) *
      speedScale,
    swayAmplitude:
      kind === "ace"
        ? layout.width * 0.18
        : randomBetween(layout.width * 0.05, layout.width * 0.12, rng),
    swayHz:
      kind === "bomber"
        ? randomBetween(0.72, 1.05, rng)
        : randomBetween(1.2, 2.05, rng),
    driftX: randomBetween(-layout.width * 0.02, layout.width * 0.02, rng),
    phase: randomBetween(0, Math.PI * 2, rng),
    lifeMs: 0,
    hp,
    maxHp: hp,
    score,
    isBoss: kind === "ace",
    shotCooldownMs:
      kind === "ace"
        ? 420
        : kind === "bomber"
          ? randomBetween(480, 720, rng)
          : randomBetween(320, 920, rng),
  };
}

function isLandTerrain(terrain) {
  return (
    terrain === "grass" ||
    terrain === "coastal-grass" ||
    terrain === "forest" ||
    terrain === "runway" ||
    terrain === "road"
  );
}

function isShoreTerrain(terrain) {
  return terrain === "beach" || isLandTerrain(terrain);
}

function isWaterOrBeachTerrain(terrain) {
  return terrain === "deep-water" || terrain === "shallow-water" || terrain === "beach";
}

function createSkyPatrolTerrainRow(layout, worldRow) {
  const tiles = Array.from({ length: layout.columns }, () => "deep-water");
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
        tiles[column] = "grass";
      } else {
        tiles[column] = "grass";
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

function expandTerrainRow(row, columns) {
  const tiles = Array.from({ length: columns }, () => "deep-water");
  for (const segment of row.segments) {
    for (let offset = 0; offset < segment.length; offset += 1) {
      tiles[segment.startColumn + offset] = segment.terrain;
    }
  }
  return tiles;
}

function getTerrainNeighbors8(tilesByRow, rowIndex, column) {
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

function applySkyPatrolBeachAdjacency(rows, columns) {
  const tilesByRow = rows.map((row) => expandTerrainRow(row, columns));
  return rows.map((row, rowIndex) => {
    const tiles = tilesByRow[rowIndex].map((terrain, column) => {
      if (terrain !== "beach") {
        return terrain;
      }

      return getTerrainNeighbors8(tilesByRow, rowIndex, column).includes("beach")
        ? terrain
        : "grass";
    });

    return {
      ...row,
      segments: createTerrainSegments(tiles),
    };
  });
}

function applySkyPatrolCoastalTerrain(rows, columns) {
  const tilesByRow = rows.map((row) => expandTerrainRow(row, columns));
  return rows.map((row, rowIndex) => {
    const tiles = tilesByRow[rowIndex].map((terrain, column) => {
      const neighbors = [
        tilesByRow[rowIndex][column - 1],
        tilesByRow[rowIndex][column + 1],
        tilesByRow[rowIndex - 1]?.[column],
        tilesByRow[rowIndex + 1]?.[column],
      ];

      if (terrain === "deep-water" && neighbors.some(isShoreTerrain)) {
        return "shallow-water";
      }
      if (terrain === "grass" && neighbors.some(isWaterOrBeachTerrain)) {
        return "coastal-grass";
      }
      return terrain;
    });

    return {
      ...row,
      segments: createTerrainSegments(tiles),
    };
  });
}

export function getSkyPatrolTerrainRows(layout, startWorldRow, rowCount) {
  if (!layout) {
    return [];
  }

  const safeStartWorldRow = Number.isFinite(startWorldRow) ? Math.floor(startWorldRow) : 0;
  const safeRowCount = Math.max(0, Number.isFinite(rowCount) ? Math.ceil(rowCount) : 0);

  const terrainMarginRows = safeRowCount > 0 ? 1 : 0;
  const rows = Array.from({ length: safeRowCount + terrainMarginRows * 2 }, (_, index) =>
    createSkyPatrolTerrainRow(layout, safeStartWorldRow - terrainMarginRows + index),
  );
  return applySkyPatrolCoastalTerrain(
    applySkyPatrolBeachAdjacency(rows, layout.columns),
    layout.columns,
  ).slice(terrainMarginRows, terrainMarginRows + safeRowCount);
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
    const terrainRow =
      getSkyPatrolTerrainRows(layout, spawnWorldRow - 1, 3).find(
        (row) => row.worldRow === spawnWorldRow,
      ) ?? createSkyPatrolTerrainRow(layout, spawnWorldRow);
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

function createPowerUp(layout, id, type, x, y) {
  return {
    id: `power-up-${id}`,
    type,
    x: clamp(x, layout.powerUpSize / 2, layout.width - layout.powerUpSize / 2),
    y,
    width: layout.powerUpSize,
    height: layout.powerUpSize,
    vy: layout.scrollSpeed * 0.62,
    ageMs: 0,
    ttlMs: 9000,
  };
}

export function spawnSkyPatrolPowerUp(state, type = "wingman", x, y) {
  if (!state?.layout) {
    return state;
  }
  const normalizedType =
    type === "shield" || type === "overdrive" || type === "repair"
      ? type
      : "wingman";
  const id = state.nextPowerUpId ?? 1;
  return {
    ...state,
    powerUps: [
      ...(state.powerUps ?? []),
      createPowerUp(
        state.layout,
        id,
        normalizedType,
        Number.isFinite(x) ? x : state.ship.x,
        Number.isFinite(y) ? y : -state.layout.powerUpSize,
      ),
    ],
    nextPowerUpId: id + 1,
  };
}

function createStepRng(state, explicitRng) {
  if (typeof explicitRng === "function") {
    return {
      rng: explicitRng,
      getRandomState: () => state.randomState,
    };
  }
  if (Number.isFinite(state.randomState)) {
    let randomState = state.randomState;
    return {
      rng: () => {
        const next = nextSkyPatrolRandom(randomState);
        randomState = next.state;
        return next.value;
      },
      getRandomState: () => randomState,
    };
  }
  return {
    rng: Math.random,
    getRandomState: () => state.randomState,
  };
}

function createEmptyState(layout, metadata = {}) {
  const mission = 1;
  const missionConfig = getSkyPatrolMissionConfig(
    mission,
    metadata.challenge?.routeId ?? 0,
  );
  return {
    layout,
    ship: createPlayerShip(layout),
    scrollOffset: 0,
    elapsedMs: 0,
    score: 0,
    targetsDestroyed: 0,
    mission,
    totalMissions:
      metadata.challenge?.totalMissions ?? SKY_PATROL_MISSION_COUNT,
    missionConfig,
    missionProgress: 0,
    missionStartScore: 0,
    missionShotsFired: 0,
    missionShotsHit: 0,
    missionHitsTaken: 0,
    checkpointMs: 0,
    lastMissionRecap: null,
    lives: SKY_PATROL_STARTING_LIVES,
    status: "playing",
    message: "Pinch to fire twin cannons.",
    airEnemies: [],
    groundTargets: [],
    playerShots: [],
    enemyShots: [],
    explosions: [],
    scoreBursts: [],
    threatTelegraphs: [],
    powerUps: [],
    damageFlashMs: 0,
    fireCooldownMs: 0,
    gunCharge: 1,
    gunCooldownMs: 0,
    gunStatus: "ready",
    startSafetyMs: SKY_PATROL_START_SAFETY_MS,
    comboCount: 0,
    comboExpiresMs: 0,
    bestCombo: 0,
    shotsFired: 0,
    shotsHit: 0,
    shieldCharges: 0,
    wingmanCharges: 1,
    wingmanActiveMs: 0,
    overdriveMs: 0,
    enemySpawnCooldownMs: 640,
    groundSpawnCooldownMs: 540,
    restartCooldownMs: 0,
    nextFighterId: 1,
    nextGroundTargetId: 1,
    nextPlayerShotId: 1,
    nextEnemyShotId: 1,
    nextFxId: 1,
    nextScoreBurstId: 1,
    nextTelegraphId: 1,
    nextPowerUpId: 1,
    stats: createStats(),
    outcome: null,
    result: null,
    ...metadata,
  };
}

export function createSkyPatrolLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(320, Number.isFinite(height) ? height : 320);
  const minDimension = Math.min(safeWidth, safeHeight);
  const tileSize = clamp(minDimension * 0.032, 18, 26);
  const basePlayerWidth = clamp(safeWidth * 0.055, 46, 74) * SKY_PATROL_ELEMENT_SCALE;
  const basePlayerHeight = clamp(safeHeight * 0.09, 54, 86) * SKY_PATROL_ELEMENT_SCALE;
  const playerWidth = basePlayerWidth * SKY_PATROL_PLAYER_SCALE;
  const playerHeight = basePlayerHeight * SKY_PATROL_PLAYER_SCALE;
  const enemyWidth = clamp(basePlayerWidth * 0.88, 40, 68);
  const enemyHeight = clamp(basePlayerHeight * 0.84, 46, 78);
  const turretWidth = clamp(tileSize * 1.55, 24, 36);
  const turretHeight = clamp(tileSize * 1.32, 22, 34);
  const depotWidth = clamp(tileSize * 2.45, 38, 58);
  const depotHeight = clamp(tileSize * 1.65, 24, 42);
  const playerShotWidth = clamp(tileSize * 0.34, 5, 9) * SKY_PATROL_PLAYER_SHOT_SCALE;
  const playerShotHeight = clamp(tileSize * 0.96, 14, 22) * SKY_PATROL_PLAYER_SHOT_SCALE;
  const enemyShotWidth = clamp(tileSize * 0.58, 11, 15);
  const enemyShotHeight = clamp(tileSize * 1.18, 26, 32);

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
    powerUpSize: clamp(tileSize * 1.65, 30, 44),
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

export function createSkyPatrolDailyGame(width, height, options = {}) {
  const normalizedOptions =
    options instanceof Date || typeof options === "string" ? { date: options } : options;
  const baseChallenge = getSkyPatrolDailyMission(
    normalizedOptions?.date ?? normalizedOptions?.dayKey,
  );
  const challenge = {
    ...baseChallenge,
    ...(normalizedOptions?.dayKey ? { dayKey: String(normalizedOptions.dayKey) } : {}),
    ...(normalizedOptions?.seed !== undefined
      ? { seed: normalizeSeed(normalizedOptions.seed) }
      : {}),
  };
  challenge.id = `sky-patrol-daily-${challenge.dayKey}`;
  const layout = createSkyPatrolLayout(width, height);
  return createEmptyState(layout, {
    challenge,
    randomState: challenge.seed,
    initialRandomState: challenge.seed,
  });
}

export function restartSkyPatrolGame(state, rng = Math.random) {
  if (state.challenge?.mode === "daily") {
    return createSkyPatrolDailyGame(state.layout.width, state.layout.height, {
      date: state.challenge.dayKey,
      dayKey: state.challenge.dayKey,
      seed: state.challenge.seed,
    });
  }
  return createSkyPatrolGame(state.layout.width, state.layout.height, rng);
}

export function advanceSkyPatrolMission(state, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }
  const mission = Math.max(1, (state.mission ?? 1) + 1);
  const missionConfig = getSkyPatrolMissionConfig(
    mission,
    state.challenge?.routeId ?? state.missionConfig?.routeId ?? 0,
  );
  let nextState = {
    ...state,
    mission,
    missionConfig,
    missionProgress: 0,
    missionStartScore: state.score,
    missionShotsFired: 0,
    missionShotsHit: 0,
    missionHitsTaken: 0,
    checkpointMs: 0,
    status: "playing",
    message: `${missionConfig.name}: ${missionConfig.goalText}`,
    airEnemies: [],
    groundTargets: [],
    playerShots: [],
    enemyShots: [],
    powerUps: [],
    threatTelegraphs: [],
    lives: Math.min(SKY_PATROL_STARTING_LIVES, (state.lives ?? 0) + 1),
    shieldCharges: Math.min(2, (state.shieldCharges ?? 0) + 1),
    wingmanCharges: Math.min(3, (state.wingmanCharges ?? 0) + 1),
    startSafetyMs: 1500,
    enemySpawnCooldownMs: missionConfig.boss ? Number.POSITIVE_INFINITY : 720,
    groundSpawnCooldownMs: missionConfig.boss ? Number.POSITIVE_INFINITY : 620,
    gunCharge: 1,
    gunCooldownMs: 0,
    gunStatus: "ready",
    result: null,
  };
  if (missionConfig.boss) {
    const boss = createAirEnemy(state.layout, state.nextFighterId, rng, missionConfig, "ace");
    nextState = {
      ...nextState,
      airEnemies: [boss],
      nextFighterId: state.nextFighterId + 1,
      threatTelegraphs: [
        {
          id: `telegraph-${state.nextTelegraphId ?? 1}`,
          entityId: boss.id,
          kind: "ace",
          x: boss.x,
          ageMs: 0,
          durationMs: 1800,
          label: "Boss incoming",
        },
      ],
      nextTelegraphId: (state.nextTelegraphId ?? 1) + 1,
    };
  }
  return nextState;
}

function completeSkyPatrolMission(state) {
  const stats = normalizeStats(state);
  const accuracy =
    (state.missionShotsFired ?? 0) > 0
      ? Math.min(
          100,
          Math.round(
            ((state.missionShotsHit ?? 0) / state.missionShotsFired) * 100,
          ),
        )
      : 0;
  const checkpointBonus =
    (state.lives ?? 0) * 200 +
    Math.round(accuracy * 5) +
    ((state.missionHitsTaken ?? 0) === 0 ? 500 : 0);
  const recap = {
    mission: state.mission,
    name: state.missionConfig?.name ?? `Mission ${state.mission}`,
    goal: state.missionConfig?.goalText ?? "",
    targetsDestroyed: state.missionProgress ?? 0,
    scoreEarned:
      state.score + checkpointBonus - (state.missionStartScore ?? 0),
    accuracy,
    bestCombo: state.bestCombo ?? 0,
    hitsTaken: state.missionHitsTaken ?? 0,
    livesRemaining: state.lives,
    checkpointBonus,
    clean: (state.missionHitsTaken ?? 0) === 0,
  };
  const completedStats = {
    ...stats,
    missionsCleared: stats.missionsCleared + 1,
    checkpointBonus: stats.checkpointBonus + checkpointBonus,
    bossDefeated:
      stats.bossDefeated || Boolean(state.missionConfig?.boss),
  };
  const campaignComplete =
    (state.mission ?? 1) >=
    (state.totalMissions ?? SKY_PATROL_MISSION_COUNT);
  const completed = {
    ...state,
    score: state.score + checkpointBonus,
    stats: completedStats,
    lastMissionRecap: recap,
    airEnemies: [],
    groundTargets: [],
    playerShots: [],
    enemyShots: [],
    threatTelegraphs: [],
    powerUps: [],
    checkpointMs: campaignComplete ? 0 : SKY_PATROL_CHECKPOINT_MS,
    status: campaignComplete ? "gameover" : "checkpoint",
    outcome: campaignComplete ? "victory" : null,
    message: campaignComplete
      ? "Storm ace defeated. Patrol complete."
      : recap.clean
        ? `Clean checkpoint — ${recap.name}`
        : `${recap.name} complete`,
  };
  if (!campaignComplete) {
    return completed;
  }
  return {
    ...completed,
    result: getSkyPatrolResultStats(completed),
    restartCooldownMs: SKY_PATROL_RESTART_COOLDOWN_MS,
  };
}

export function stepSkyPatrolGame(state, dtSeconds, input = {}, rng) {
  if (!state?.layout) {
    return state;
  }

  const safeDt = clamp(
    Number.isFinite(dtSeconds) ? dtSeconds : 0,
    0,
    SKY_PATROL_MAX_STEP_SECONDS,
  );
  const dtMs = safeDt * 1000;
  const random = createStepRng(state, rng);
  rng = random.rng;
  const layout = state.layout;
  const pointerActive =
    input.pointerActive !== false &&
    Number.isFinite(input.pointerX) &&
    Number.isFinite(input.pointerY);
  const fireRequested = Boolean(input.fireRequested);
  const missionConfig =
    state.missionConfig ??
    getSkyPatrolMissionConfig(state.mission, state.challenge?.routeId ?? 0);
  const overdriveActive = (state.overdriveMs ?? 0) > 0;
  const drainDuration = overdriveActive
    ? SKY_PATROL_GUN_DRAIN_MS * 1.7
    : SKY_PATROL_GUN_DRAIN_MS;
  let gunCharge = clamp(Number.isFinite(state.gunCharge) ? state.gunCharge : 1, 0, 1);
  let gunCooldownMs = Math.max(0, Number.isFinite(state.gunCooldownMs) ? state.gunCooldownMs : 0);
  let gunStatus =
    state.gunStatus === "cooldown" || state.gunStatus === "recharging" ? state.gunStatus : "ready";

  if (gunStatus === "cooldown") {
    gunCooldownMs = Math.max(0, gunCooldownMs - dtMs);
    if (gunCooldownMs <= 0) {
      gunStatus = "recharging";
      gunCharge = 0;
    }
  } else if (gunStatus === "recharging") {
    gunCharge = Math.min(1, gunCharge + dtMs / drainDuration);
    if (gunCharge >= 1) {
      gunCharge = 1;
      gunStatus = "ready";
    }
  } else if (fireRequested && gunCharge > 0) {
    gunCharge = Math.max(0, gunCharge - dtMs / drainDuration);
    if (gunCharge <= 0) {
      gunCharge = 0;
      gunCooldownMs = SKY_PATROL_GUN_COOLDOWN_MS;
      gunStatus = "cooldown";
    }
  } else if (gunCharge < 1) {
    gunCharge = Math.min(1, gunCharge + dtMs / drainDuration);
  }

  let ship = {
    ...state.ship,
    invulnerableMs: Math.max(0, state.ship.invulnerableMs - dtMs),
  };

  const stats = normalizeStats(state);
  const nextStateBase = {
    ...state,
    elapsedMs: state.elapsedMs + dtMs,
    mission: state.mission ?? 1,
    totalMissions: state.totalMissions ?? SKY_PATROL_MISSION_COUNT,
    missionConfig,
    missionProgress: state.missionProgress ?? 0,
    missionShotsFired: state.missionShotsFired ?? 0,
    missionShotsHit: state.missionShotsHit ?? 0,
    missionHitsTaken: state.missionHitsTaken ?? 0,
    ship,
    explosions: advanceExplosions(state.explosions ?? [], dtMs),
    scoreBursts: advanceScoreBursts(state.scoreBursts ?? [], dtMs),
    threatTelegraphs: (state.threatTelegraphs ?? [])
      .map((telegraph) => ({
        ...telegraph,
        ageMs: (telegraph.ageMs ?? 0) + dtMs,
      }))
      .filter((telegraph) => telegraph.ageMs < telegraph.durationMs),
    powerUps: state.powerUps ?? [],
    damageFlashMs: Math.max(0, (state.damageFlashMs ?? 0) - dtMs),
    fireCooldownMs: Math.max(0, (state.fireCooldownMs ?? 0) - dtMs),
    gunCharge,
    gunCooldownMs,
    gunStatus,
    startSafetyMs: Math.max(0, (state.startSafetyMs ?? 0) - dtMs),
    comboCount:
      (state.comboExpiresMs ?? 0) > 0 && state.comboExpiresMs - dtMs <= 0
        ? 0
        : state.comboCount ?? 0,
    comboExpiresMs: Math.max(0, (state.comboExpiresMs ?? 0) - dtMs),
    bestCombo: state.bestCombo ?? 0,
    shotsFired: state.shotsFired ?? 0,
    shotsHit: state.shotsHit ?? 0,
    shieldCharges: state.shieldCharges ?? 0,
    wingmanCharges: state.wingmanCharges ?? 0,
    wingmanActiveMs: Math.max(0, (state.wingmanActiveMs ?? 0) - dtMs),
    overdriveMs: Math.max(0, (state.overdriveMs ?? 0) - dtMs),
    enemySpawnCooldownMs: Math.max(0, (state.enemySpawnCooldownMs ?? 0) - dtMs),
    groundSpawnCooldownMs: Math.max(0, (state.groundSpawnCooldownMs ?? 0) - dtMs),
    restartCooldownMs: Math.max(0, (state.restartCooldownMs ?? 0) - dtMs),
    stats: {
      ...stats,
      elapsedMs:
        state.status === "gameover" ? stats.elapsedMs : stats.elapsedMs + dtMs,
    },
    ...(Number.isFinite(random.getRandomState())
      ? { randomState: random.getRandomState() }
      : {}),
  };

  if (nextStateBase.status === "gameover") {
    if (fireRequested && nextStateBase.restartCooldownMs <= 0) {
      return restartSkyPatrolGame(nextStateBase, rng);
    }
    return nextStateBase;
  }

  if (nextStateBase.status === "checkpoint") {
    const checkpointMs = Math.max(0, (nextStateBase.checkpointMs ?? 0) - dtMs);
    if (checkpointMs > 0) {
      return {
        ...nextStateBase,
        checkpointMs,
      };
    }
    const advanced = advanceSkyPatrolMission(
      {
        ...nextStateBase,
        checkpointMs: 0,
      },
      rng,
    );
    return {
      ...advanced,
      ...(Number.isFinite(random.getRandomState())
        ? { randomState: random.getRandomState() }
        : {}),
    };
  }

  if (nextStateBase.status !== "playing") {
    return nextStateBase;
  }

  if (pointerActive) {
    const desiredX = clamp(input.pointerX, layout.playerMinX, layout.playerMaxX);
    const desiredY = clamp(input.pointerY, layout.playerMinY, layout.playerMaxY);
    const lerp = 1 - Math.exp(-layout.playerLerpPerSecond * safeDt);
    const bank = clamp((desiredX - ship.x) / Math.max(1, layout.width * 0.08), -1, 1);
    ship = {
      ...ship,
      x: ship.x + (desiredX - ship.x) * lerp,
      y: ship.y + (desiredY - ship.y) * lerp,
      bank,
    };
  } else if (ship.bank) {
    ship = {
      ...ship,
      bank: Math.abs(ship.bank) < 0.02 ? 0 : ship.bank * Math.exp(-7 * safeDt),
    };
  }

  let scrollOffset = nextStateBase.scrollOffset + layout.scrollSpeed * safeDt;
  let score = nextStateBase.score;
  let targetsDestroyed = nextStateBase.targetsDestroyed ?? 0;
  let missionProgress = nextStateBase.missionProgress;
  let missionShotsFired = nextStateBase.missionShotsFired;
  let missionShotsHit = nextStateBase.missionShotsHit;
  let missionHitsTaken = nextStateBase.missionHitsTaken;
  let comboCount = nextStateBase.comboCount;
  let comboExpiresMs = nextStateBase.comboExpiresMs;
  let bestCombo = nextStateBase.bestCombo;
  let shotsFired = nextStateBase.shotsFired;
  let shotsHit = nextStateBase.shotsHit;
  let shieldCharges = nextStateBase.shieldCharges;
  let wingmanCharges = nextStateBase.wingmanCharges;
  let wingmanActiveMs = nextStateBase.wingmanActiveMs;
  let overdriveMs = nextStateBase.overdriveMs;
  let statsState = { ...nextStateBase.stats };
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
  let nextTelegraphId = nextStateBase.nextTelegraphId ?? 1;
  let nextPowerUpId = nextStateBase.nextPowerUpId ?? 1;
  const explosions = [...nextStateBase.explosions];
  const scoreBursts = [...nextStateBase.scoreBursts];
  let threatTelegraphs = [...nextStateBase.threatTelegraphs];
  let powerUps = [...nextStateBase.powerUps];
  let damageFlashMs = nextStateBase.damageFlashMs;
  let playerShots = (nextStateBase.playerShots ?? []).map((shot) => ({ ...shot }));
  let enemyShots = (nextStateBase.enemyShots ?? []).map((shot) => ({ ...shot }));
  let airEnemies = (nextStateBase.airEnemies ?? []).map((enemy) => ({ ...enemy }));
  let groundTargets = (nextStateBase.groundTargets ?? []).map((target) => ({
    ...target,
  }));

  if (
    (input.wingmanRequested || (fireRequested && gunStatus === "cooldown")) &&
    wingmanCharges > 0 &&
    wingmanActiveMs <= 0
  ) {
    wingmanCharges -= 1;
    wingmanActiveMs = SKY_PATROL_WINGMAN_DURATION_MS;
    enemyShots = [];
    statsState.wingmanUses += 1;
    message = "Wingmen on station";
  }

  if (fireRequested && fireCooldownMs <= 0 && gunStatus === "ready" && gunCharge > 0) {
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
    if (wingmanActiveMs > 0) {
      playerShots.push(
        createProjectile(
          `player-shot-${nextPlayerShotId}`,
          "wingman",
          ship.x,
          ship.y - ship.height * 0.5,
          layout.playerShotWidth,
          layout.playerShotHeight,
          0,
          -layout.playerShotSpeed * 1.08,
        ),
      );
      nextPlayerShotId += 1;
    }
    const volleySize = wingmanActiveMs > 0 ? 3 : 2;
    shotsFired += volleySize;
    missionShotsFired += volleySize;
    statsState.shotsFired += volleySize;
    fireCooldownMs = overdriveMs > 0
      ? SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS * 0.55
      : SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS;
  }

  if (enemySpawnCooldownMs <= 0 && !missionConfig.boss) {
    const spawnCount = rng() > 0.8 ? 2 : 1;
    for (let index = 0; index < spawnCount; index += 1) {
      const enemy = createAirEnemy(
        layout,
        nextFighterId,
        rng,
        missionConfig,
      );
      airEnemies.push(enemy);
      threatTelegraphs.push({
        id: `telegraph-${nextTelegraphId}`,
        entityId: enemy.id,
        kind: enemy.kind,
        x: enemy.x,
        ageMs: 0,
        durationMs: enemy.kind === "bomber" ? 1300 : 900,
        label:
          enemy.kind === "interceptor"
            ? "Fast contact"
            : enemy.kind === "bomber"
              ? "Heavy bomber"
              : "Contact",
      });
      nextTelegraphId += 1;
      nextFighterId += 1;
    }
    enemySpawnCooldownMs = randomBetween(
      SKY_PATROL_ENEMY_SPAWN_COOLDOWN_MS * 0.72,
      SKY_PATROL_ENEMY_SPAWN_COOLDOWN_MS * 1.18,
      rng,
    ) * missionConfig.airSpawnMultiplier;
  }

  if (groundSpawnCooldownMs <= 0 && !missionConfig.boss) {
    const nextTarget = createGroundTarget(layout, scrollOffset, nextGroundTargetId, rng);
    if (nextTarget) {
      groundTargets.push(nextTarget);
      nextGroundTargetId += 1;
      groundSpawnCooldownMs = randomBetween(
        SKY_PATROL_GROUND_SPAWN_COOLDOWN_MS * 0.82,
        SKY_PATROL_GROUND_SPAWN_COOLDOWN_MS * 1.2,
        rng,
      ) * missionConfig.groundSpawnMultiplier;
    } else {
      groundSpawnCooldownMs = 220;
    }
  }

  const shipRect = getCenteredRect(ship);
  const offscreenMargin = layout.tileSize * 2.2;

  const remainingPowerUps = [];
  for (const powerUp of powerUps) {
    const movedPowerUp = {
      ...powerUp,
      y: powerUp.y + powerUp.vy * safeDt,
      ageMs: (powerUp.ageMs ?? 0) + dtMs,
    };
    if (
      movedPowerUp.ageMs >= movedPowerUp.ttlMs ||
      movedPowerUp.y - movedPowerUp.height / 2 > layout.height + offscreenMargin
    ) {
      continue;
    }
    if (!intersectsRect(getCenteredRect(movedPowerUp), shipRect)) {
      remainingPowerUps.push(movedPowerUp);
      continue;
    }
    statsState.powerUpsCollected += 1;
    if (movedPowerUp.type === "shield") {
      shieldCharges = Math.min(2, shieldCharges + 1);
      message = "Shield charge collected";
    } else if (movedPowerUp.type === "repair") {
      lives = Math.min(SKY_PATROL_STARTING_LIVES, lives + 1);
      message = "Squadron repaired";
    } else if (movedPowerUp.type === "overdrive") {
      overdriveMs = SKY_PATROL_POWER_UP_DURATION_MS;
      message = "Cannon overdrive";
    } else {
      wingmanCharges = Math.min(3, wingmanCharges + 1);
      message = "Wingman signal acquired";
    }
  }
  powerUps = remainingPowerUps;

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
      const nextY =
        enemy.y + (enemy.speedY + layout.scrollSpeed * 0.35) * safeDt;
      const y =
        enemy.kind === "ace"
          ? Math.min(layout.height * 0.22, nextY)
          : nextY;
      let shotCooldownMs = enemy.shotCooldownMs - dtMs;

      if (
        shotCooldownMs <= 0 &&
        nextStateBase.startSafetyMs <= 0 &&
        y > layout.height * 0.12 &&
        y < layout.height * 0.74
      ) {
        const dx = ship.x - x;
        const dy = Math.max(48, ship.y - y);
        const length = Math.max(1, Math.hypot(dx, dy));
        const shotSpeed =
          layout.enemyShotSpeed *
          (enemy.kind === "interceptor" ? 1.28 : enemy.kind === "ace" ? 1.12 : 1);
        const bossEnraged =
          enemy.kind === "ace" &&
          (enemy.hp ?? 0) <= Math.max(1, (enemy.maxHp ?? SKY_PATROL_BOSS_HP) / 2);
        const spread =
          enemy.kind === "ace"
            ? bossEnraged
              ? [-0.34, -0.17, 0, 0.17, 0.34]
              : [-0.26, 0, 0.26]
            : enemy.kind === "bomber"
              ? [-0.18, 0.18]
              : [0];
        for (const spreadAmount of spread) {
          queuedEnemyShots.push(
            createProjectile(
              `enemy-shot-${nextEnemyShotId}`,
              enemy.kind ?? "fighter",
              x,
              y + enemy.height * 0.38,
              layout.enemyShotWidth,
              layout.enemyShotHeight,
              (dx / length) * shotSpeed * 0.26 + spreadAmount * shotSpeed,
              (dy / length) * shotSpeed,
            ),
          );
          nextEnemyShotId += 1;
        }
        shotCooldownMs =
          enemy.kind === "ace"
            ? bossEnraged
              ? randomBetween(360, 520, rng)
              : randomBetween(480, 720, rng)
            : enemy.kind === "bomber"
              ? randomBetween(860, 1180, rng)
              : enemy.kind === "interceptor"
                ? randomBetween(620, 920, rng)
                : randomBetween(820, 1320, rng);
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
        nextStateBase.startSafetyMs <= 0 &&
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

  function registerTargetDestroyed(entity, role) {
    const baseScore = Math.max(
      0,
      Number.isFinite(entity.score)
        ? entity.score
        : role === "air"
          ? SKY_PATROL_FIGHTER_SCORE
          : entity.kind === "depot"
            ? SKY_PATROL_DEPOT_SCORE
            : SKY_PATROL_TURRET_SCORE,
    );
    const comboMultiplier = 1 + Math.min(comboCount, 10) * 0.08;
    const scoreValue = Math.round(baseScore * comboMultiplier);

    score += scoreValue;
    targetsDestroyed += 1;
    missionProgress += 1;
    comboCount += 1;
    comboExpiresMs = SKY_PATROL_COMBO_WINDOW_MS;
    bestCombo = Math.max(bestCombo, comboCount);
    statsState.targetsDestroyed += 1;
    statsState.bestCombo = Math.max(statsState.bestCombo, comboCount);
    if (role === "air") {
      statsState.airTargetsDestroyed += 1;
    } else {
      statsState.groundTargetsDestroyed += 1;
    }

    scoreBursts.push(
      createScoreBurst(
        `score-burst-${nextScoreBurstId}`,
        entity.x,
        entity.y,
        scoreValue,
      ),
    );
    nextScoreBurstId += 1;
    explosions.push(
      createExplosion(
        `fx-${nextFxId}`,
        entity.x,
        entity.y,
        role === "air" ? "air" : "ground",
      ),
    );
    nextFxId += 1;

    const guaranteesDrop =
      entity.kind === "bomber" ||
      (targetsDestroyed > 0 && targetsDestroyed % 5 === 0);
    if (guaranteesDrop && !entity.isBoss) {
      const types = ["shield", "wingman", "overdrive", "repair"];
      const type =
        types[Math.min(types.length - 1, Math.floor(rng() * types.length))];
      powerUps.push(
        createPowerUp(layout, nextPowerUpId, type, entity.x, entity.y),
      );
      nextPowerUpId += 1;
    }

    return scoreValue;
  }

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
        shotsHit += 1;
        missionShotsHit += 1;
        statsState.shotsHit += 1;
        if (enemy.hp <= 0) {
          registerTargetDestroyed(enemy, "air");
          message =
            enemy.kind === "ace"
              ? "Storm ace defeated."
              : enemy.kind === "bomber"
                ? "Bomber broken."
                : enemy.kind === "interceptor"
                  ? "Interceptor down."
                  : comboCount >= 3
                    ? `${comboCount}x aerial streak`
                    : "Fighter down.";
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
          shotsHit += 1;
          missionShotsHit += 1;
          statsState.shotsHit += 1;
          if (target.hp <= 0) {
            registerTargetDestroyed(target, "ground");
            message =
              comboCount >= 3
                ? `${comboCount}x strike chain`
                : target.kind === "depot"
                  ? "Depot demolished."
                  : "Turret eliminated.";
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

    if (shieldCharges > 0) {
      shieldCharges -= 1;
      statsState.shieldsUsed += 1;
      damageFlashMs = SKY_PATROL_DAMAGE_FLASH_MS * 0.55;
      explosions.push(
        createExplosion(`fx-${nextFxId}`, hitX, hitY, "shield"),
      );
      nextFxId += 1;
      ship = {
        ...ship,
        invulnerableMs: SKY_PATROL_PLAYER_INVULNERABLE_MS * 0.55,
      };
      message = "Shield held. Keep the streak alive.";
      return;
    }

    lives -= 1;
    comboCount = 0;
    comboExpiresMs = 0;
    missionHitsTaken += 1;
    statsState.hitsTaken += 1;
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

  let finalState = {
    ...nextStateBase,
    ship,
    scrollOffset,
    score,
    targetsDestroyed,
    missionProgress,
    missionShotsFired,
    missionShotsHit,
    missionHitsTaken,
    comboCount,
    comboExpiresMs,
    bestCombo,
    shotsFired,
    shotsHit,
    shieldCharges,
    wingmanCharges,
    wingmanActiveMs,
    overdriveMs,
    stats: statsState,
    lives,
    status,
    message,
    playerShots,
    enemyShots,
    airEnemies,
    groundTargets,
    explosions,
    scoreBursts,
    threatTelegraphs,
    powerUps,
    damageFlashMs,
    fireCooldownMs,
    gunCharge,
    gunCooldownMs,
    gunStatus,
    enemySpawnCooldownMs,
    groundSpawnCooldownMs,
    restartCooldownMs,
    nextFighterId,
    nextGroundTargetId,
    nextPlayerShotId,
    nextEnemyShotId,
    nextFxId,
    nextScoreBurstId,
    nextTelegraphId,
    nextPowerUpId,
    ...(Number.isFinite(random.getRandomState())
      ? { randomState: random.getRandomState() }
      : {}),
  };

  if (status === "gameover") {
    finalState = {
      ...finalState,
      outcome: "defeat",
      result: null,
    };
    return {
      ...finalState,
      result: getSkyPatrolResultStats(finalState),
    };
  }

  if (
    status === "playing" &&
    missionProgress >= (missionConfig.targetGoal ?? Number.POSITIVE_INFINITY)
  ) {
    return completeSkyPatrolMission(finalState);
  }

  return finalState;
}
