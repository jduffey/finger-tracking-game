import { createScopedLogger } from "./logger.js";

const invadersLog = createScopedLogger("spaceInvadersGame");

export const SPACE_INVADERS_ENEMY_SCORE = 125;
export const SPACE_INVADERS_UFO_SCORE = 500;
export const SPACE_INVADERS_STARTING_LIVES = 3;
export const SPACE_INVADERS_INTER_WAVE_MS = 1500;
export const SPACE_INVADERS_POWER_UP_DURATION_MS = 6000;

const INVADERS_COLUMNS = 8;
const INVADERS_ROWS = 4;
const INVADERS_MAX_STEP_SECONDS = 1 / 90;
const INVADERS_SHIP_LERP_PER_SECOND = 18;
const INVADERS_FIRE_COOLDOWN_MS = 240;
const INVADERS_ENEMY_FIRE_INTERVAL_MS = 900;
const INVADERS_RESTART_COOLDOWN_MS = 700;
const INVADERS_SHIP_INVULNERABLE_MS = 1100;
const INVADERS_MIN_DANGER_DESCENTS = 4;
const INVADERS_ELEMENT_SCALE = 1.15;
const INVADERS_SHIELD_COUNT = 3;
const INVADERS_SHIELD_HP = 4;
const FORMATIONS = [
  { id: "classic", name: "Classic Grid" },
  { id: "staggered", name: "Staggered Patrol" },
  { id: "pinch", name: "Pinch Formation" },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(prefix, start = 1) {
  let next = start;
  return () => `${prefix}-${next++}`;
}

export function getSpaceInvadersWaveConfig(wave = 1) {
  const normalizedWave = Math.max(1, Number.isFinite(wave) ? Math.floor(wave) : 1);
  const formation = FORMATIONS[(normalizedWave - 1) % FORMATIONS.length];
  return {
    wave: normalizedWave,
    formationId: formation.id,
    formationName: formation.name,
    enemySpeedMultiplier: Math.min(2.05, 1 + (normalizedWave - 1) * 0.12),
    enemyShotSpeedMultiplier: Math.min(1.65, 1 + (normalizedWave - 1) * 0.07),
    enemyFireIntervalMs: Math.max(
      330,
      INVADERS_ENEMY_FIRE_INTERVAL_MS - (normalizedWave - 1) * 58,
    ),
    enemyBurstSize: normalizedWave >= 7 ? 3 : normalizedWave >= 4 ? 2 : 1,
    ufoDelayMs: Math.max(4500, 10000 - (normalizedWave - 1) * 450),
  };
}

export function createSpaceInvadersLayout(width, height) {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 320);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const baseEnemyWidth = clamp(safeWidth * 0.06, 24, 58);
  const baseEnemyHeight = clamp(safeHeight * 0.04, 22, 40);
  const enemyWidth = baseEnemyWidth * INVADERS_ELEMENT_SCALE;
  const enemyHeight = baseEnemyHeight * INVADERS_ELEMENT_SCALE;
  const enemyGapX = clamp(baseEnemyWidth * 0.35, 10, 22);
  const enemyGapY = clamp(baseEnemyHeight * 0.45, 10, 20);
  const formationWidth = INVADERS_COLUMNS * enemyWidth + (INVADERS_COLUMNS - 1) * enemyGapX;
  const baseTopPadding = clamp(safeHeight * 0.12, 48, 96);
  const baseSidePadding = clamp(safeWidth * 0.08, 18, 76);
  const shipWidth = clamp(safeWidth * 0.12, 68, 122) * INVADERS_ELEMENT_SCALE;
  const shipHeight = clamp(safeHeight * 0.05, 24, 42) * INVADERS_ELEMENT_SCALE;
  const enemySpeed = Math.max(54, safeWidth * 0.085);
  const descendStep = clamp(safeHeight * 0.045, 18, 34);
  const maxTopPaddingForHeadroom =
    safeHeight -
    3 -
    INVADERS_ROWS * enemyHeight -
    (INVADERS_ROWS - 1) * enemyGapY -
    descendStep * INVADERS_MIN_DANGER_DESCENTS;
  const topPadding = Math.max(24, Math.min(baseTopPadding, maxTopPaddingForHeadroom));
  const minFormationTravelWidth = enemyWidth * 2;
  const sidePadding = Math.max(
    0,
    Math.min(baseSidePadding, (safeWidth - formationWidth - minFormationTravelWidth) / 2),
  );
  const shipY = safeHeight - clamp(safeHeight * 0.13, 58, 92);
  const shipMinX = shipWidth / 2 + sidePadding * 0.35;
  const shipMaxX = safeWidth - shipMinX;
  const shotWidth = clamp(baseEnemyWidth * 0.18, 6, 10) * INVADERS_ELEMENT_SCALE;
  const shotHeight = clamp(safeHeight * 0.035, 16, 28) * INVADERS_ELEMENT_SCALE;
  const initialFormationBottom =
    topPadding + INVADERS_ROWS * enemyHeight + (INVADERS_ROWS - 1) * enemyGapY;
  const desiredDangerLineY = shipY - clamp(shipHeight * 1.4, 30, 56);
  const minimumDangerLineY = Math.min(
    safeHeight - 1,
    initialFormationBottom + descendStep * INVADERS_MIN_DANGER_DESCENTS + 1,
  );
  const shieldWidth = clamp(safeWidth * 0.115, 42, 94);
  const baseShieldHeight = clamp(safeHeight * 0.034, 16, 28);
  const shipTop = shipY - shipHeight / 2;
  const shieldSpace = shipTop - initialFormationBottom;
  const shieldsEnabled = shieldSpace >= 10;
  const shieldHeight = shieldsEnabled
    ? Math.min(baseShieldHeight, shieldSpace - 4)
    : 0;
  const desiredShieldY = shipY - clamp(safeHeight * 0.115, 48, 78);
  const shieldMinY = initialFormationBottom + 2 + shieldHeight / 2;
  const shieldMaxY = shipTop - 2 - shieldHeight / 2;

  return {
    width: safeWidth,
    height: safeHeight,
    enemyWidth,
    enemyHeight,
    enemyGapX,
    enemyGapY,
    topPadding,
    sidePadding,
    formationWidth,
    descendStep,
    enemySpeed,
    shipWidth,
    shipHeight,
    shipY,
    shipMinX,
    shipMaxX,
    shotWidth,
    shotHeight,
    playerShotSpeed: Math.max(280, safeHeight * 0.68),
    enemyShotSpeed: Math.max(160, safeHeight * 0.34),
    dangerLineY: Math.max(desiredDangerLineY, minimumDangerLineY),
    shieldWidth,
    shieldHeight,
    shieldsEnabled,
    shieldY:
      shieldMaxY >= shieldMinY
        ? clamp(desiredShieldY, shieldMinY, shieldMaxY)
        : (initialFormationBottom + shipTop) / 2,
    ufoWidth: clamp(enemyWidth * 1.55, 44, 88),
    ufoHeight: clamp(enemyHeight * 0.9, 20, 38),
    ufoSpeed: Math.max(90, safeWidth * 0.12),
    powerUpSize: clamp(baseEnemyWidth * 0.7, 18, 32),
    powerUpSpeed: Math.max(70, safeHeight * 0.14),
  };
}

function getFormationOffset(formationId, row, column, layout) {
  if (formationId === "staggered") {
    return {
      x: (row % 2 === 0 ? -1 : 1) * layout.enemyGapX * 0.45,
      y: (column % 2) * layout.enemyGapY * 0.12,
    };
  }
  if (formationId === "pinch") {
    const distanceFromCenter = Math.abs(column - (INVADERS_COLUMNS - 1) / 2);
    return {
      x: (column < INVADERS_COLUMNS / 2 ? 1 : -1) * row * layout.enemyGapX * 0.32,
      y: Math.max(0, 3.5 - distanceFromCenter) * layout.enemyGapY * 0.25,
    };
  }
  return { x: 0, y: 0 };
}

export function createSpaceInvadersWave(layout, wave = 1) {
  const config = getSpaceInvadersWaveConfig(wave);
  const startX = (layout.width - layout.formationWidth) / 2;
  const idPrefix = config.wave === 1 ? "enemy" : `wave-${config.wave}-enemy`;
  const nextEnemyId = createIdFactory(idPrefix);
  const enemies = [];
  for (let row = 0; row < INVADERS_ROWS; row += 1) {
    for (let column = 0; column < INVADERS_COLUMNS; column += 1) {
      const offset = getFormationOffset(config.formationId, row, column, layout);
      enemies.push({
        id: nextEnemyId(),
        row,
        column,
        x: startX + column * (layout.enemyWidth + layout.enemyGapX) + offset.x,
        y: layout.topPadding + row * (layout.enemyHeight + layout.enemyGapY) + offset.y,
        width: layout.enemyWidth,
        height: layout.enemyHeight,
        alive: true,
        formationId: config.formationId,
      });
    }
  }
  return {
    enemies,
    formation: {
      id: config.formationId,
      name: config.formationName,
      wave: config.wave,
    },
    config,
  };
}

function createProjectile(id, x, y, width, height, vy) {
  return { id, x, y, width, height, vy };
}

function intersectsRect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function createShip(layout) {
  return {
    x: layout.width / 2,
    y: layout.shipY,
    width: layout.shipWidth,
    height: layout.shipHeight,
  };
}

function getShipRect(ship) {
  return {
    x: ship.x - ship.width / 2,
    y: ship.y - ship.height / 2,
    width: ship.width,
    height: ship.height,
  };
}

function createShields(layout) {
  if (!layout.shieldsEnabled) {
    return [];
  }
  const usableWidth = layout.width - layout.sidePadding * 2;
  return Array.from({ length: INVADERS_SHIELD_COUNT }, (_, index) => {
    const centerX =
      layout.sidePadding + (usableWidth * (index + 1)) / (INVADERS_SHIELD_COUNT + 1);
    return {
      id: `shield-${index + 1}`,
      x: centerX - layout.shieldWidth / 2,
      y: layout.shieldY - layout.shieldHeight / 2,
      width: layout.shieldWidth,
      height: layout.shieldHeight,
      hp: INVADERS_SHIELD_HP,
      maxHp: INVADERS_SHIELD_HP,
    };
  });
}

function repairShields(shields, amount = 1) {
  return shields.map((shield) => ({
    ...shield,
    hp: Math.min(shield.maxHp ?? INVADERS_SHIELD_HP, (shield.hp ?? 0) + amount),
  }));
}

function getBottomEnemyByColumn(enemies) {
  const byColumn = new Map();
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }
    const existing = byColumn.get(enemy.column);
    if (!existing || enemy.y > existing.y) {
      byColumn.set(enemy.column, enemy);
    }
  }
  return [...byColumn.values()];
}

function createEnemyFireCooldownMs(rng = Math.random, config = getSpaceInvadersWaveConfig()) {
  return config.enemyFireIntervalMs + Math.floor(rng() * 260);
}

function createUfoSpawnCooldownMs(rng = Math.random, config = getSpaceInvadersWaveConfig()) {
  return config.ufoDelayMs + Math.floor(rng() * 1800);
}

function createStats(overrides = {}) {
  return {
    enemiesDestroyed: 0,
    wavesCleared: 0,
    shotsFired: 0,
    enemyShotsFired: 0,
    ufoHits: 0,
    powerUpsCollected: 0,
    livesLost: 0,
    elapsedMs: 0,
    bestWave: 1,
    ...overrides,
  };
}

function normalizeStats(state) {
  return createStats(state?.stats);
}

export function getSpaceInvadersResultStats(state) {
  if (!state?.layout) {
    return null;
  }
  const stats = normalizeStats(state);
  return {
    score: Math.max(0, state.score ?? 0),
    wave: Math.max(1, state.wave ?? 1),
    livesRemaining: Math.max(0, state.lives ?? 0),
    enemiesDestroyed: stats.enemiesDestroyed,
    wavesCleared: stats.wavesCleared,
    shotsFired: stats.shotsFired,
    accuracy:
      stats.shotsFired > 0
        ? Math.round(((stats.enemiesDestroyed + stats.ufoHits) / stats.shotsFired) * 100)
        : 0,
    ufoHits: stats.ufoHits,
    powerUpsCollected: stats.powerUpsCollected,
    livesLost: stats.livesLost,
    elapsedMs: Math.round(stats.elapsedMs),
    bestWave: Math.max(stats.bestWave, state.wave ?? 1),
    reason: state.message ?? "",
  };
}

function normalizeCreateArguments(rng, options) {
  if (typeof rng === "function") {
    return { rng, options: options ?? {} };
  }
  return {
    rng: Math.random,
    options: rng && typeof rng === "object" ? rng : options ?? {},
  };
}

export function createSpaceInvadersGame(width, height, rng = Math.random, options = {}) {
  const normalized = normalizeCreateArguments(rng, options);
  const layout = createSpaceInvadersLayout(width, height);
  const wave = Math.max(
    1,
    Number.isFinite(normalized.options.wave) ? Math.floor(normalized.options.wave) : 1,
  );
  const waveState = createSpaceInvadersWave(layout, wave);
  const state = {
    layout,
    ship: createShip(layout),
    enemies: waveState.enemies,
    playerShots: [],
    enemyShots: [],
    shields: createShields(layout),
    ufo: null,
    powerUps: [],
    activePowerUp: null,
    score: 0,
    wave,
    formation: waveState.formation,
    waveConfig: waveState.config,
    lives: SPACE_INVADERS_STARTING_LIVES,
    status: "playing",
    message: wave === 1 ? "Pinch to fire" : `Wave ${wave}: ${waveState.formation.name}`,
    enemyDirection: 1,
    fireCooldownMs: 0,
    enemyFireCooldownMs: createEnemyFireCooldownMs(normalized.rng, waveState.config),
    restartCooldownMs: 0,
    shipInvulnerableMs: 0,
    ufoSpawnCooldownMs: createUfoSpawnCooldownMs(normalized.rng, waveState.config),
    interWave: null,
    nextPlayerShotId: 1,
    nextEnemyShotId: 1,
    nextUfoId: 1,
    nextPowerUpId: 1,
    stats: createStats({ bestWave: wave }),
    result: null,
    lastResult: null,
  };

  invadersLog.info("Created space invaders state", {
    width: layout.width,
    height: layout.height,
    enemyCount: state.enemies.length,
    wave,
    formation: state.formation.id,
  });
  return state;
}

function restartSpaceInvadersGame(state, rng = Math.random) {
  const restarted = createSpaceInvadersGame(state.layout.width, state.layout.height, rng);
  return {
    ...restarted,
    score: state.score,
    message: "Wave restarted",
    lastResult: state.result ?? state.lastResult ?? null,
  };
}

export function advanceSpaceInvadersWave(state, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }
  const nextWave = Math.max(1, state.interWave?.nextWave ?? (state.wave ?? 1) + 1);
  const waveState = createSpaceInvadersWave(state.layout, nextWave);
  const stats = normalizeStats(state);
  return {
    ...state,
    ship: createShip(state.layout),
    enemies: waveState.enemies,
    playerShots: [],
    enemyShots: [],
    shields: repairShields(state.shields ?? createShields(state.layout)),
    ufo: null,
    powerUps: [],
    activePowerUp: null,
    wave: nextWave,
    formation: waveState.formation,
    waveConfig: waveState.config,
    status: "playing",
    message: `Wave ${nextWave}: ${waveState.formation.name}`,
    enemyDirection: nextWave % 2 === 0 ? -1 : 1,
    fireCooldownMs: 0,
    enemyFireCooldownMs: createEnemyFireCooldownMs(rng, waveState.config),
    restartCooldownMs: 0,
    shipInvulnerableMs: 0,
    ufoSpawnCooldownMs: createUfoSpawnCooldownMs(rng, waveState.config),
    interWave: null,
    stats: {
      ...stats,
      bestWave: Math.max(stats.bestWave, nextWave),
    },
    result: null,
  };
}

export function spawnSpaceInvadersUfo(state, direction = 1) {
  if (!state?.layout || state.ufo) {
    return state;
  }
  const normalizedDirection = direction < 0 ? -1 : 1;
  const { layout } = state;
  return {
    ...state,
    ufo: {
      id: `ufo-${state.nextUfoId ?? 1}`,
      x: normalizedDirection > 0 ? -layout.ufoWidth : layout.width,
      y: Math.max(8, layout.topPadding * 0.35),
      width: layout.ufoWidth,
      height: layout.ufoHeight,
      direction: normalizedDirection,
      speed: layout.ufoSpeed,
    },
    nextUfoId: (state.nextUfoId ?? 1) + 1,
    ufoSpawnCooldownMs: 0,
  };
}

export function spawnSpaceInvadersPowerUp(state, type = "rapid-fire", x, y) {
  if (!state?.layout) {
    return state;
  }
  const size = state.layout.powerUpSize;
  const normalizedType = type === "shield-repair" ? "shield-repair" : "rapid-fire";
  return {
    ...state,
    powerUps: [
      ...(state.powerUps ?? []),
      {
        id: `power-up-${state.nextPowerUpId ?? 1}`,
        type: normalizedType,
        x: (Number.isFinite(x) ? x : state.ship.x) - size / 2,
        y: Number.isFinite(y) ? y : 0,
        width: size,
        height: size,
        vy: state.layout.powerUpSpeed,
      },
    ],
    nextPowerUpId: (state.nextPowerUpId ?? 1) + 1,
  };
}

function stepEnemyFormation(enemies, layout, direction, dtSeconds, speedMultiplier = 1) {
  const aliveEnemies = enemies.filter((enemy) => enemy.alive);
  if (aliveEnemies.length === 0) {
    return { enemies, direction };
  }

  const moveX = direction * layout.enemySpeed * speedMultiplier * dtSeconds;
  const leftEdge = Math.min(...aliveEnemies.map((enemy) => enemy.x));
  const rightEdge = Math.max(...aliveEnemies.map((enemy) => enemy.x + enemy.width));
  const nextLeft = leftEdge + moveX;
  const nextRight = rightEdge + moveX;

  if (nextLeft <= layout.sidePadding || nextRight >= layout.width - layout.sidePadding) {
    return {
      direction: direction * -1,
      enemies: enemies.map((enemy) =>
        enemy.alive
          ? {
              ...enemy,
              y: enemy.y + layout.descendStep,
            }
          : enemy,
      ),
    };
  }

  return {
    direction,
    enemies: enemies.map((enemy) =>
      enemy.alive
        ? {
            ...enemy,
            x: enemy.x + moveX,
          }
        : enemy,
    ),
  };
}

function choosePowerUpType(rng) {
  return rng() < 0.5 ? "rapid-fire" : "shield-repair";
}

function getPlayerFireCooldown(activePowerUp) {
  return activePowerUp?.type === "rapid-fire"
    ? INVADERS_FIRE_COOLDOWN_MS * 0.45
    : INVADERS_FIRE_COOLDOWN_MS;
}

export function stepSpaceInvadersGame(
  state,
  dtSeconds,
  shipTargetX,
  fireRequested,
  rng = Math.random,
) {
  if (!state?.layout) {
    return state;
  }

  const layout = state.layout;
  const elapsedSeconds = Math.max(0, Number.isFinite(dtSeconds) ? dtSeconds : 0);
  const elapsedMs = elapsedSeconds * 1000;
  const safeDt = clamp(elapsedSeconds, 0, 0.05);
  const desiredShipX = clamp(
    Number.isFinite(shipTargetX) ? shipTargetX : state.ship.x,
    layout.shipMinX,
    layout.shipMaxX,
  );
  const lerp = 1 - Math.exp(-INVADERS_SHIP_LERP_PER_SECOND * safeDt);
  const shipX = state.ship.x + (desiredShipX - state.ship.x) * lerp;
  const activePowerUpRemainingMs = Math.max(
    0,
    (state.activePowerUp?.remainingMs ?? 0) - elapsedMs,
  );
  const activePowerUp =
    state.activePowerUp && activePowerUpRemainingMs > 0
      ? {
          ...state.activePowerUp,
          remainingMs: activePowerUpRemainingMs,
        }
      : null;
  const waveConfig = state.waveConfig ?? getSpaceInvadersWaveConfig(state.wave);
  const stats = normalizeStats(state);

  let nextState = {
    ...state,
    ship: {
      ...state.ship,
      x: shipX,
    },
    shields: state.shields ?? createShields(layout),
    powerUps: state.powerUps ?? [],
    activePowerUp,
    wave: state.wave ?? 1,
    waveConfig,
    formation:
      state.formation ?? {
        id: waveConfig.formationId,
        name: waveConfig.formationName,
        wave: waveConfig.wave,
      },
    lives: Number.isFinite(state.lives) ? state.lives : SPACE_INVADERS_STARTING_LIVES,
    fireCooldownMs: Math.max(0, (state.fireCooldownMs ?? 0) - elapsedMs),
    enemyFireCooldownMs: Math.max(0, (state.enemyFireCooldownMs ?? 0) - elapsedMs),
    restartCooldownMs: Math.max(0, (state.restartCooldownMs ?? 0) - elapsedMs),
    shipInvulnerableMs: Math.max(0, (state.shipInvulnerableMs ?? 0) - elapsedMs),
    ufoSpawnCooldownMs: state.ufo
      ? state.ufoSpawnCooldownMs ?? 0
      : Math.max(0, (state.ufoSpawnCooldownMs ?? waveConfig.ufoDelayMs) - elapsedMs),
    stats: {
      ...stats,
      elapsedMs: stats.elapsedMs + elapsedMs,
      bestWave: Math.max(stats.bestWave, state.wave ?? 1),
    },
  };

  if (nextState.status === "gameover") {
    if (fireRequested && nextState.restartCooldownMs <= 0) {
      return restartSpaceInvadersGame(nextState, rng);
    }
    return nextState;
  }

  if (nextState.status === "cleared") {
    const remainingMs = Math.max(
      0,
      (nextState.interWave?.remainingMs ?? SPACE_INVADERS_INTER_WAVE_MS) - elapsedMs,
    );
    nextState = {
      ...nextState,
      interWave: {
        nextWave: nextState.interWave?.nextWave ?? nextState.wave + 1,
        remainingMs,
      },
    };
    if (
      remainingMs <= 0 ||
      (fireRequested && nextState.restartCooldownMs <= 0)
    ) {
      return advanceSpaceInvadersWave(nextState, rng);
    }
    return nextState;
  }

  if (safeDt <= 0) {
    return nextState;
  }

  if (fireRequested && nextState.fireCooldownMs <= 0) {
    nextState = {
      ...nextState,
      playerShots: [
        ...nextState.playerShots,
        createProjectile(
          `player-shot-${nextState.nextPlayerShotId}`,
          nextState.ship.x - layout.shotWidth / 2,
          nextState.ship.y - nextState.ship.height / 2 - layout.shotHeight,
          layout.shotWidth,
          layout.shotHeight,
          -layout.playerShotSpeed,
        ),
      ],
      fireCooldownMs: getPlayerFireCooldown(nextState.activePowerUp),
      nextPlayerShotId: nextState.nextPlayerShotId + 1,
      message: "Pinch to fire",
      stats: {
        ...nextState.stats,
        shotsFired: nextState.stats.shotsFired + 1,
      },
    };
  }

  if (!nextState.ufo && nextState.ufoSpawnCooldownMs <= 0) {
    nextState = spawnSpaceInvadersUfo(nextState, rng() < 0.5 ? 1 : -1);
  }

  const subSteps = Math.max(1, Math.ceil(safeDt / INVADERS_MAX_STEP_SECONDS));
  const stepSeconds = safeDt / subSteps;
  let enemies = nextState.enemies.map((enemy) => ({ ...enemy }));
  let playerShots = nextState.playerShots.map((shot) => ({ ...shot }));
  let enemyShots = nextState.enemyShots.map((shot) => ({ ...shot }));
  let shields = nextState.shields.map((shield) => ({ ...shield }));
  let powerUps = nextState.powerUps.map((powerUp) => ({ ...powerUp }));
  let ufo = nextState.ufo ? { ...nextState.ufo } : null;
  let enemyDirection = nextState.enemyDirection;
  let score = nextState.score;
  let lives = nextState.lives;
  let status = nextState.status;
  let message = nextState.message;
  let nextEnemyShotId = nextState.nextEnemyShotId;
  let nextPowerUpId = nextState.nextPowerUpId ?? 1;
  let enemyFireCooldownMs = nextState.enemyFireCooldownMs;
  let ufoSpawnCooldownMs = nextState.ufoSpawnCooldownMs;
  let shipInvulnerableMs = nextState.shipInvulnerableMs;
  let activePowerUpState = nextState.activePowerUp;
  let statsState = { ...nextState.stats };
  const shipRect = getShipRect(nextState.ship);

  for (let stepIndex = 0; stepIndex < subSteps; stepIndex += 1) {
    const aliveCount = enemies.filter((enemy) => enemy.alive).length;
    const pressureMultiplier =
      waveConfig.enemySpeedMultiplier * (1 + Math.max(0, 1 - aliveCount / 32) * 0.65);
    const formationStep = stepEnemyFormation(
      enemies,
      layout,
      enemyDirection,
      stepSeconds,
      pressureMultiplier,
    );
    enemies = formationStep.enemies;
    enemyDirection = formationStep.direction;

    if (ufo) {
      ufo.x += ufo.direction * ufo.speed * stepSeconds;
      if (ufo.x > layout.width + ufo.width || ufo.x + ufo.width < -ufo.width) {
        ufo = null;
        ufoSpawnCooldownMs = createUfoSpawnCooldownMs(rng, waveConfig);
      }
    }

    playerShots = playerShots
      .map((shot) => ({
        ...shot,
        y: shot.y + shot.vy * stepSeconds,
      }))
      .filter((shot) => shot.y + shot.height >= 0);

    enemyShots = enemyShots
      .map((shot) => ({
        ...shot,
        y: shot.y + shot.vy * stepSeconds,
      }))
      .filter((shot) => shot.y <= layout.height + shot.height);

    powerUps = powerUps
      .map((powerUp) => ({
        ...powerUp,
        y: powerUp.y + powerUp.vy * stepSeconds,
      }))
      .filter((powerUp) => powerUp.y <= layout.height + powerUp.height);

    const remainingPlayerShots = [];
    for (const shot of playerShots) {
      if (ufo && intersectsRect(shot, ufo)) {
        score += SPACE_INVADERS_UFO_SCORE;
        statsState.ufoHits += 1;
        const size = layout.powerUpSize;
        powerUps.push({
          id: `power-up-${nextPowerUpId}`,
          type: choosePowerUpType(rng),
          x: ufo.x + ufo.width / 2 - size / 2,
          y: ufo.y + ufo.height,
          width: size,
          height: size,
          vy: layout.powerUpSpeed,
        });
        nextPowerUpId += 1;
        ufo = null;
        ufoSpawnCooldownMs = createUfoSpawnCooldownMs(rng, waveConfig);
        continue;
      }

      let didHitEnemy = false;
      for (const enemy of enemies) {
        if (!enemy.alive) {
          continue;
        }
        if (intersectsRect(shot, enemy)) {
          enemy.alive = false;
          didHitEnemy = true;
          score += SPACE_INVADERS_ENEMY_SCORE;
          statsState.enemiesDestroyed += 1;
          break;
        }
      }
      if (!didHitEnemy) {
        remainingPlayerShots.push(shot);
      }
    }
    playerShots = remainingPlayerShots;

    const shotsAfterShields = [];
    for (const shot of enemyShots) {
      const hitShield = shields.find(
        (shield) => shield.hp > 0 && intersectsRect(shot, shield),
      );
      if (hitShield) {
        hitShield.hp = Math.max(0, hitShield.hp - 1);
      } else {
        shotsAfterShields.push(shot);
      }
    }
    enemyShots = shotsAfterShields;

    let shipHit = false;
    enemyShots = enemyShots.filter((shot) => {
      const hit =
        shipInvulnerableMs <= 0 &&
        intersectsRect(shot, shipRect);
      shipHit ||= hit;
      return !hit;
    });
    if (shipHit && status === "playing") {
      lives -= 1;
      statsState.livesLost += 1;
      if (lives <= 0) {
        status = "gameover";
        message = "Fleet defeated. Pinch to restart";
        break;
      }
      shipInvulnerableMs = INVADERS_SHIP_INVULNERABLE_MS;
      enemyShots = [];
      message = `Ship hit — ${lives} ${lives === 1 ? "life" : "lives"} left`;
    }

    const remainingPowerUps = [];
    for (const powerUp of powerUps) {
      if (!intersectsRect(powerUp, shipRect)) {
        remainingPowerUps.push(powerUp);
        continue;
      }
      statsState.powerUpsCollected += 1;
      if (powerUp.type === "shield-repair") {
        shields = repairShields(shields, 2);
        message = "Shields repaired";
      } else {
        activePowerUpState = {
          type: "rapid-fire",
          remainingMs: SPACE_INVADERS_POWER_UP_DURATION_MS,
        };
        message = "Rapid fire online";
      }
    }
    powerUps = remainingPowerUps;

    const aliveEnemies = enemies.filter((enemy) => enemy.alive);
    if (aliveEnemies.some((enemy) => enemy.y + enemy.height >= layout.dangerLineY)) {
      status = "gameover";
      lives = 0;
      message = "Formation landed. Pinch to restart";
      break;
    }

    if (aliveEnemies.length === 0) {
      status = "cleared";
      statsState.wavesCleared += 1;
      message = `Wave ${nextState.wave} cleared — next wave ready`;
      break;
    }

    if (enemyFireCooldownMs <= 0) {
      const firingCandidates = getBottomEnemyByColumn(aliveEnemies);
      const burstSize = Math.min(waveConfig.enemyBurstSize, firingCandidates.length);
      const usedColumns = new Set();
      for (let shotIndex = 0; shotIndex < burstSize; shotIndex += 1) {
        const available = firingCandidates.filter(
          (candidate) => !usedColumns.has(candidate.column),
        );
        if (available.length === 0) {
          break;
        }
        const shooter = available[Math.floor(rng() * available.length)];
        usedColumns.add(shooter.column);
        enemyShots.push(
          createProjectile(
            `enemy-shot-${nextEnemyShotId}`,
            shooter.x + shooter.width / 2 - layout.shotWidth / 2,
            shooter.y + shooter.height + 4,
            layout.shotWidth,
            layout.shotHeight,
            layout.enemyShotSpeed * waveConfig.enemyShotSpeedMultiplier,
          ),
        );
        nextEnemyShotId += 1;
        statsState.enemyShotsFired += 1;
      }
      enemyFireCooldownMs = createEnemyFireCooldownMs(rng, waveConfig);
    }
  }

  let finalState = {
    ...nextState,
    enemies,
    playerShots,
    enemyShots,
    shields,
    powerUps,
    ufo,
    activePowerUp: activePowerUpState,
    score,
    lives,
    status,
    message,
    enemyDirection,
    enemyFireCooldownMs,
    ufoSpawnCooldownMs,
    shipInvulnerableMs,
    nextEnemyShotId,
    nextPowerUpId,
    stats: statsState,
    interWave:
      status === "cleared"
        ? {
            nextWave: nextState.wave + 1,
            remainingMs: SPACE_INVADERS_INTER_WAVE_MS,
          }
        : null,
    restartCooldownMs:
      status === "playing"
        ? 0
        : Math.max(nextState.restartCooldownMs, INVADERS_RESTART_COOLDOWN_MS),
  };

  if (status === "gameover" && state.status !== "gameover") {
    finalState = {
      ...finalState,
      result: getSpaceInvadersResultStats(finalState),
    };
  }
  return finalState;
}
