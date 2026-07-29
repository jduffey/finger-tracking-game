import { createScopedLogger } from "./logger.js";

const brickDodgerLog = createScopedLogger("brickDodgerGame");

export const BRICK_DODGER_BONUS_SCORE = 250;
export const BRICK_DODGER_STARTING_LIVES = 3;
export const BRICK_DODGER_MAX_LIVES = 5;
export const BRICK_DODGER_STAGE_DURATION_MS = 20_000;
export const BRICK_DODGER_STAGE_RECAP_MS = 2_200;
export const BRICK_DODGER_SLOW_TIME_MS = 5_000;
export const BRICK_DODGER_NEAR_MISS_SCORE = 80;
export const BRICK_DODGER_TELEGRAPH_MS = 720;

const BRICK_DODGER_MAX_STEP_SECONDS = 0.05;
const BRICK_DODGER_LANE_COUNT = 6;
const BRICK_DODGER_PLAYER_LERP_PER_SECOND = 16;
const BRICK_DODGER_SURVIVAL_POINTS_PER_SECOND = 20;
const BRICK_DODGER_STREAK_BONUS_STEP = 50;
const BRICK_DODGER_INVULNERABILITY_MS = 850;
const BRICK_DODGER_STAGE_NAMES = [
  "Warm-Up",
  "Crosswind",
  "Brick Rain",
  "Six-Lane Scramble",
  "Overdrive",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(prefix, start = 1) {
  let next = start;
  return () => `${prefix}-${next++}`;
}

export function getBrickDodgerStageConfig(stage = 1) {
  const normalizedStage = Math.max(1, Number.isFinite(stage) ? Math.floor(stage) : 1);
  const threatLevel = Math.min(5, normalizedStage);
  const labels = ["Low", "Guarded", "High", "Severe", "Extreme"];
  return {
    stage: normalizedStage,
    name:
      BRICK_DODGER_STAGE_NAMES[(normalizedStage - 1) % BRICK_DODGER_STAGE_NAMES.length],
    threatLevel,
    threatLabel: labels[threatLevel - 1],
    durationMs: BRICK_DODGER_STAGE_DURATION_MS,
    speedMultiplier: Math.min(1.65, 1 + (normalizedStage - 1) * 0.09),
    spawnMultiplier: Math.max(0.62, 1 - (normalizedStage - 1) * 0.065),
    hazardBonus: Math.min(3, Math.floor((normalizedStage - 1) / 2)),
  };
}

export function getBrickDodgerNearMissMultiplier(streak = 0) {
  const normalizedStreak = Math.max(0, Number.isFinite(streak) ? Math.floor(streak) : 0);
  return Math.min(4, 1 + Math.floor(normalizedStreak / 2) * 0.5);
}

function createStats(overrides = {}) {
  return {
    stagesCleared: 0,
    nearMisses: 0,
    bestNearMissStreak: 0,
    pickupsCollected: 0,
    scorePickups: 0,
    shieldPickups: 0,
    slowTimePickups: 0,
    hitsTaken: 0,
    survivalMs: 0,
    ...overrides,
  };
}

function normalizeStats(state) {
  return createStats(state?.stats);
}

export function getBrickDodgerResultStats(state) {
  if (!state?.layout) {
    return null;
  }
  if (state.result) {
    return state.result;
  }
  const stats = normalizeStats(state);
  return {
    score: Math.max(0, state.score ?? 0),
    stageReached: Math.max(1, state.stage ?? 1),
    stageName: state.stageConfig?.name ?? getBrickDodgerStageConfig(state.stage).name,
    stagesCleared: stats.stagesCleared,
    survivalMs: Math.round(state.survivalMs ?? stats.survivalMs),
    nearMisses: stats.nearMisses,
    bestNearMissStreak: stats.bestNearMissStreak,
    bestMultiplier: getBrickDodgerNearMissMultiplier(stats.bestNearMissStreak),
    pickupsCollected: stats.pickupsCollected,
    shieldPickups: stats.shieldPickups,
    slowTimePickups: stats.slowTimePickups,
    hitsTaken: stats.hitsTaken,
    lastStageRecap: state.lastStageRecap ?? null,
  };
}

function pickDistinctLaneIndexes(count, laneCount, rng = Math.random) {
  const pool = Array.from({ length: laneCount }, (_, index) => index);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

function pickBonusLaneIndex(hazardLaneIndexes, laneCount, rng = Math.random) {
  const openLaneIndexes = Array.from({ length: laneCount }, (_, index) => index).filter(
    (index) => !hazardLaneIndexes.includes(index),
  );
  if (openLaneIndexes.length === 0) {
    return null;
  }

  const adjacentOpenLaneIndexes = openLaneIndexes.filter((index) =>
    hazardLaneIndexes.some((hazardLane) => Math.abs(hazardLane - index) === 1),
  );
  const preferred = adjacentOpenLaneIndexes.length > 0 ? adjacentOpenLaneIndexes : openLaneIndexes;
  return preferred[Math.floor(rng() * preferred.length)] ?? null;
}

function intersectsRect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getPlayerRect(layout, playerX) {
  return {
    x: playerX - layout.playerWidth / 2,
    y: layout.playerY - layout.playerHeight / 2,
    width: layout.playerWidth,
    height: layout.playerHeight,
  };
}

function createHazard(layout, laneIndex, hazardId, elapsedMs, stageConfig) {
  const x = layout.laneCenters[laneIndex];
  return {
    id: hazardId,
    laneIndex,
    x,
    y: -layout.hazardHeight - 8,
    width: layout.hazardWidth,
    height: layout.hazardHeight,
    vy:
      getBrickDodgerHazardSpeed(layout, elapsedMs) *
      (stageConfig?.speedMultiplier ?? 1),
    stage: stageConfig?.stage ?? 1,
    nearMissAwarded: false,
  };
}

function createBonus(layout, laneIndex, bonusId, elapsedMs, type = "score") {
  const x = layout.laneCenters[laneIndex];
  return {
    id: bonusId,
    laneIndex,
    x,
    y: -layout.bonusSize - layout.hazardHeight * 1.1,
    size: layout.bonusSize,
    vy: getBrickDodgerBonusSpeed(layout, elapsedMs),
    type,
  };
}

function choosePickupType(rng = Math.random) {
  const roll = rng();
  if (roll < 0.64) {
    return "score";
  }
  if (roll < 0.84) {
    return "shield";
  }
  return "slow-time";
}

export function createBrickDodgerLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(480, Number.isFinite(height) ? height : 480);
  const sidePadding = clamp(safeWidth * 0.08, 20, 72);
  const laneWidth = (safeWidth - sidePadding * 2) / BRICK_DODGER_LANE_COUNT;
  const laneCenters = Array.from(
    { length: BRICK_DODGER_LANE_COUNT },
    (_, index) => sidePadding + laneWidth * index + laneWidth / 2,
  );
  const playerWidth = clamp(laneWidth * 0.82, 46, 88);
  const playerHeight = clamp(safeHeight * 0.05, 24, 38);
  const playerY = safeHeight - clamp(safeHeight * 0.12, 58, 94);
  const hazardWidth = clamp(laneWidth * 0.68, 34, 62);
  const hazardHeight = clamp(safeHeight * 0.082, 38, 74);
  const bonusSize = clamp(Math.min(laneWidth, safeHeight * 0.07), 26, 48);

  return {
    width: safeWidth,
    height: safeHeight,
    sidePadding,
    laneWidth,
    laneCenters,
    playerWidth,
    playerHeight,
    playerY,
    playerMinX: laneCenters[0],
    playerMaxX: laneCenters[laneCenters.length - 1],
    hazardWidth,
    hazardHeight,
    bonusSize,
  };
}

export function getBrickDodgerSpawnDelayMs(elapsedMs) {
  const intensity = clamp((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 90_000, 0, 1);
  return Math.round(1_180 - intensity * 470);
}

export function getBrickDodgerWaveHazardCount(elapsedMs, laneCount = BRICK_DODGER_LANE_COUNT) {
  const rawCount = 1 + Math.floor(Math.max(0, elapsedMs) / 28_000);
  return clamp(rawCount, 1, Math.max(1, laneCount - 1));
}

export function getBrickDodgerHazardSpeed(layout, elapsedMs) {
  const intensity = clamp((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 105_000, 0, 1);
  return clamp(layout.height * (0.28 + intensity * 0.2), 210, 460);
}

export function getBrickDodgerBonusSpeed(layout, elapsedMs) {
  return getBrickDodgerHazardSpeed(layout, elapsedMs) * 0.82;
}

export function spawnBrickDodgerWave(state, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }

  const laneCount = state.layout.laneCenters.length;
  const stageConfig =
    state.stageConfig ?? getBrickDodgerStageConfig(state.stage);
  const hazardLaneIndexes = pickDistinctLaneIndexes(
    Math.min(
      laneCount - 1,
      getBrickDodgerWaveHazardCount(state.elapsedMs, laneCount) +
        stageConfig.hazardBonus,
    ),
    laneCount,
    rng,
  );

  const hazards = [...state.hazards];
  const bonuses = [...state.bonuses];
  const laneTelegraphs = [...(state.laneTelegraphs ?? [])];
  const nextHazardId = createIdFactory("hazard", state.nextHazardId);
  const nextBonusId = createIdFactory("bonus", state.nextBonusId);
  let nextTelegraphId = state.nextTelegraphId ?? 1;

  for (const laneIndex of hazardLaneIndexes) {
    const hazard = createHazard(
      state.layout,
      laneIndex,
      nextHazardId(),
      state.elapsedMs,
      stageConfig,
    );
    hazards.push(hazard);
    laneTelegraphs.push({
      id: `telegraph-${nextTelegraphId}`,
      laneIndex,
      kind: "hazard",
      threatLevel: stageConfig.threatLevel,
      ageMs: 0,
      durationMs: BRICK_DODGER_TELEGRAPH_MS,
      arrivalMs: Math.max(
        0,
        ((state.layout.playerY - hazard.y) / Math.max(1, hazard.vy)) * 1000,
      ),
    });
    nextTelegraphId += 1;
  }

  let updatedNextBonusId = state.nextBonusId;
  if (hazardLaneIndexes.length < laneCount && rng() < 0.42) {
    const bonusLaneIndex = pickBonusLaneIndex(hazardLaneIndexes, laneCount, rng);
    if (bonusLaneIndex !== null) {
      const bonus = createBonus(
        state.layout,
        bonusLaneIndex,
        nextBonusId(),
        state.elapsedMs,
        choosePickupType(rng),
      );
      bonuses.push(bonus);
      laneTelegraphs.push({
        id: `telegraph-${nextTelegraphId}`,
        laneIndex: bonusLaneIndex,
        kind: "pickup",
        pickupType: bonus.type,
        threatLevel: stageConfig.threatLevel,
        ageMs: 0,
        durationMs: BRICK_DODGER_TELEGRAPH_MS,
        arrivalMs: Math.max(
          0,
          ((state.layout.playerY - bonus.y) / Math.max(1, bonus.vy)) * 1000,
        ),
      });
      nextTelegraphId += 1;
      updatedNextBonusId += 1;
    }
  }

  return {
    ...state,
    hazards,
    bonuses,
    laneTelegraphs,
    nextHazardId: state.nextHazardId + hazardLaneIndexes.length,
    nextBonusId: updatedNextBonusId,
    nextTelegraphId,
  };
}

export function spawnBrickDodgerPickup(state, type = "score", laneIndex = 0) {
  if (!state?.layout) {
    return state;
  }
  const normalizedLaneIndex = clamp(
    Number.isFinite(laneIndex) ? Math.floor(laneIndex) : 0,
    0,
    state.layout.laneCenters.length - 1,
  );
  const normalizedType =
    type === "shield" || type === "slow-time" ? type : "score";
  const bonus = createBonus(
    state.layout,
    normalizedLaneIndex,
    `bonus-${state.nextBonusId ?? 1}`,
    state.elapsedMs ?? 0,
    normalizedType,
  );
  return {
    ...state,
    bonuses: [...(state.bonuses ?? []), bonus],
    nextBonusId: (state.nextBonusId ?? 1) + 1,
  };
}

export function createBrickDodgerGame(width, height) {
  const layout = createBrickDodgerLayout(width, height);
  const stage = 1;
  const stageConfig = getBrickDodgerStageConfig(stage);
  const state = {
    layout,
    player: {
      x: layout.width / 2,
    },
    hazards: [],
    bonuses: [],
    laneTelegraphs: [],
    score: 0,
    lives: BRICK_DODGER_STARTING_LIVES,
    elapsedMs: 0,
    survivalMs: 0,
    survivalScoreRemainder: 0,
    bonusStreak: 0,
    nearMissStreak: 0,
    nearMissMultiplier: 1,
    invulnerabilityMs: 0,
    slowTimeMs: 0,
    stage,
    stageConfig,
    stageElapsedMs: 0,
    stageStartScore: 0,
    stageNearMisses: 0,
    stagePickups: 0,
    stageHits: 0,
    stageRecapMs: 0,
    lastStageRecap: null,
    threatLevel: {
      level: stageConfig.threatLevel,
      label: stageConfig.threatLabel,
    },
    status: "playing",
    message: `${stageConfig.name}: slide left and right`,
    nextHazardId: 1,
    nextBonusId: 1,
    nextTelegraphId: 1,
    spawnTimerMs: 520,
    stats: createStats(),
    result: null,
  };

  brickDodgerLog.info("Created brick dodger state", {
    width: layout.width,
    height: layout.height,
    laneCount: layout.laneCenters.length,
  });
  return state;
}

export function advanceBrickDodgerStage(state) {
  if (!state?.layout) {
    return state;
  }
  const stage = Math.max(1, (state.stage ?? 1) + 1);
  const stageConfig = getBrickDodgerStageConfig(stage);
  return {
    ...state,
    stage,
    stageConfig,
    stageElapsedMs: 0,
    stageStartScore: state.score ?? 0,
    stageNearMisses: 0,
    stagePickups: 0,
    stageHits: 0,
    stageRecapMs: 0,
    hazards: [],
    bonuses: [],
    laneTelegraphs: [],
    spawnTimerMs: 620,
    status: "playing",
    threatLevel: {
      level: stageConfig.threatLevel,
      label: stageConfig.threatLabel,
    },
    message: `${stageConfig.name} — threat ${stageConfig.threatLabel}`,
    result: null,
  };
}

function completeBrickDodgerStage(state) {
  const stats = normalizeStats(state);
  const recap = {
    stage: state.stage,
    name: state.stageConfig?.name ?? getBrickDodgerStageConfig(state.stage).name,
    threatLabel:
      state.stageConfig?.threatLabel ?? getBrickDodgerStageConfig(state.stage).threatLabel,
    scoreEarned: (state.score ?? 0) - (state.stageStartScore ?? 0),
    nearMisses: state.stageNearMisses ?? 0,
    pickups: state.stagePickups ?? 0,
    hits: state.stageHits ?? 0,
    livesRemaining: state.lives,
    clean: (state.stageHits ?? 0) === 0,
  };
  return {
    ...state,
    hazards: [],
    bonuses: [],
    laneTelegraphs: [],
    status: "stage_recap",
    stageRecapMs: BRICK_DODGER_STAGE_RECAP_MS,
    lastStageRecap: recap,
    message: recap.clean ? `${recap.name} cleared clean` : `${recap.name} cleared`,
    stats: {
      ...stats,
      stagesCleared: stats.stagesCleared + 1,
    },
  };
}

export function stepBrickDodgerGame(state, dtSeconds, playerTargetX, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }

  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, BRICK_DODGER_MAX_STEP_SECONDS);
  const desiredPlayerX = clamp(
    Number.isFinite(playerTargetX) ? playerTargetX : state.player.x,
    state.layout.playerMinX,
    state.layout.playerMaxX,
  );
  const lerp = 1 - Math.exp(-BRICK_DODGER_PLAYER_LERP_PER_SECOND * safeDt);
  const playerX = state.player.x + (desiredPlayerX - state.player.x) * lerp;
  const elapsedMs = safeDt * 1000;
  const stageConfig =
    state.stageConfig ?? getBrickDodgerStageConfig(state.stage);
  const stats = normalizeStats(state);

  let nextState = {
    ...state,
    player: {
      x: playerX,
    },
    hazards: state.hazards ?? [],
    bonuses: state.bonuses ?? [],
    laneTelegraphs: (state.laneTelegraphs ?? [])
      .map((telegraph) => ({
        ...telegraph,
        ageMs: (telegraph.ageMs ?? 0) + elapsedMs,
        arrivalMs: Math.max(0, (telegraph.arrivalMs ?? 0) - elapsedMs),
      }))
      .filter((telegraph) => telegraph.ageMs < telegraph.durationMs),
    stage: state.stage ?? 1,
    stageConfig,
    stageElapsedMs: state.stageElapsedMs ?? 0,
    stageStartScore: state.stageStartScore ?? 0,
    stageNearMisses: state.stageNearMisses ?? 0,
    stagePickups: state.stagePickups ?? 0,
    stageHits: state.stageHits ?? 0,
    threatLevel: state.threatLevel ?? {
      level: stageConfig.threatLevel,
      label: stageConfig.threatLabel,
    },
    nearMissStreak: state.nearMissStreak ?? 0,
    nearMissMultiplier:
      state.nearMissMultiplier ?? getBrickDodgerNearMissMultiplier(state.nearMissStreak),
    invulnerabilityMs: Math.max(0, (state.invulnerabilityMs ?? 0) - elapsedMs),
    slowTimeMs: Math.max(0, (state.slowTimeMs ?? 0) - elapsedMs),
    stats,
  };

  if (nextState.status === "stage_recap") {
    const stageRecapMs = Math.max(0, (nextState.stageRecapMs ?? 0) - elapsedMs);
    if (stageRecapMs > 0 || safeDt <= 0) {
      return {
        ...nextState,
        stageRecapMs,
      };
    }
    return advanceBrickDodgerStage({
      ...nextState,
      stageRecapMs: 0,
    });
  }

  if (safeDt <= 0 || nextState.status !== "playing") {
    return nextState;
  }

  const nextElapsedMs = state.elapsedMs + elapsedMs;
  const survivalScore = state.survivalScoreRemainder + safeDt * BRICK_DODGER_SURVIVAL_POINTS_PER_SECOND;
  const survivalScoreDelta = Math.floor(survivalScore);
  let score = state.score + survivalScoreDelta;
  let lives = state.lives;
  let bonusStreak = state.bonusStreak;
  let nearMissStreak = state.nearMissStreak ?? 0;
  let nearMissMultiplier =
    state.nearMissMultiplier ?? getBrickDodgerNearMissMultiplier(nearMissStreak);
  let invulnerabilityMs = nextState.invulnerabilityMs;
  let slowTimeMs = nextState.slowTimeMs;
  let status = state.status;
  let message = state.message;
  let statsState = {
    ...stats,
    survivalMs: stats.survivalMs + elapsedMs,
  };
  let stageNearMisses = state.stageNearMisses ?? 0;
  let stagePickups = state.stagePickups ?? 0;
  let stageHits = state.stageHits ?? 0;

  let workingState = {
    ...nextState,
    elapsedMs: nextElapsedMs,
    survivalMs: state.survivalMs + elapsedMs,
    stageElapsedMs: (state.stageElapsedMs ?? 0) + elapsedMs,
    survivalScoreRemainder: survivalScore - survivalScoreDelta,
    score,
    stats: statsState,
  };

  let spawnTimerMs = state.spawnTimerMs - elapsedMs;
  let spawnIterations = 0;
  while (spawnTimerMs <= 0 && spawnIterations < 4) {
    workingState = spawnBrickDodgerWave(workingState, rng);
    spawnTimerMs +=
      getBrickDodgerSpawnDelayMs(workingState.elapsedMs) *
      stageConfig.spawnMultiplier;
    spawnIterations += 1;
  }

  const playerRect = getPlayerRect(state.layout, playerX);
  const timeScale = state.slowTimeMs > 0 ? 0.55 : 1;
  const movementDt = safeDt * timeScale;
  const movedHazards = workingState.hazards
    .map((hazard) => ({
      ...hazard,
      previousY: hazard.y,
      y: hazard.y + hazard.vy * movementDt,
    }))
    .filter((hazard) => hazard.y - hazard.height / 2 <= state.layout.height + 12);
  const movedBonuses = workingState.bonuses
    .map((bonus) => ({
      ...bonus,
      y: bonus.y + bonus.vy * movementDt,
    }))
    .filter((bonus) => bonus.y - bonus.size / 2 <= state.layout.height + 12);

  const remainingHazards = [];
  for (const hazard of movedHazards) {
    const hazardRect = {
      x: hazard.x - hazard.width / 2,
      y: hazard.y - hazard.height / 2,
      width: hazard.width,
      height: hazard.height,
    };
    if (!intersectsRect(playerRect, hazardRect)) {
      const crossedPlayer =
        !hazard.nearMissAwarded &&
        (hazard.previousY ?? hazard.y) <= state.layout.playerY &&
        hazard.y > state.layout.playerY;
      const collisionHalfWidth =
        (hazard.width + state.layout.playerWidth) / 2;
      const horizontalDistance = Math.abs(hazard.x - playerX);
      const nearMiss =
        crossedPlayer &&
        horizontalDistance > collisionHalfWidth &&
        horizontalDistance <=
          collisionHalfWidth + state.layout.laneWidth * 0.55;
      if (nearMiss) {
        nearMissStreak += 1;
        nearMissMultiplier = getBrickDodgerNearMissMultiplier(nearMissStreak);
        const nearMissScore = Math.round(
          BRICK_DODGER_NEAR_MISS_SCORE * nearMissMultiplier,
        );
        score += nearMissScore;
        stageNearMisses += 1;
        statsState = {
          ...statsState,
          nearMisses: statsState.nearMisses + 1,
          bestNearMissStreak: Math.max(
            statsState.bestNearMissStreak,
            nearMissStreak,
          ),
        };
        message = `Near miss x${nearMissMultiplier}`;
        remainingHazards.push({
          ...hazard,
          nearMissAwarded: true,
        });
      } else {
        remainingHazards.push(hazard);
      }
      continue;
    }

    if (invulnerabilityMs <= 0) {
      lives -= 1;
      bonusStreak = 0;
      nearMissStreak = 0;
      nearMissMultiplier = 1;
      invulnerabilityMs = BRICK_DODGER_INVULNERABILITY_MS;
      stageHits += 1;
      statsState = {
        ...statsState,
        hitsTaken: statsState.hitsTaken + 1,
      };
      message = lives > 0 ? `${lives} shields left` : "Run over";
      if (lives <= 0) {
        status = "gameover";
      }
    }
  }

  if (status === "gameover") {
    const gameOverState = {
      ...workingState,
      hazards: remainingHazards,
      bonuses: movedBonuses,
      score,
      lives: Math.max(0, lives),
      bonusStreak,
      nearMissStreak,
      nearMissMultiplier,
      invulnerabilityMs,
      slowTimeMs,
      stageNearMisses,
      stagePickups,
      stageHits,
      stats: statsState,
      status,
      message,
      spawnTimerMs,
      result: null,
    };
    return {
      ...gameOverState,
      result: getBrickDodgerResultStats(gameOverState),
    };
  }

  const remainingBonuses = [];
  for (const bonus of movedBonuses) {
    const bonusRect = {
      x: bonus.x - bonus.size / 2,
      y: bonus.y - bonus.size / 2,
      width: bonus.size,
      height: bonus.size,
    };
    if (!intersectsRect(playerRect, bonusRect)) {
      remainingBonuses.push(bonus);
      continue;
    }

    const pickupType = bonus.type ?? "score";
    stagePickups += 1;
    statsState = {
      ...statsState,
      pickupsCollected: statsState.pickupsCollected + 1,
    };
    if (pickupType === "shield") {
      lives = Math.min(BRICK_DODGER_MAX_LIVES, lives + 1);
      statsState.shieldPickups += 1;
      message =
        lives >= BRICK_DODGER_MAX_LIVES ? "Shields fully charged" : `Shield restored — ${lives}`;
    } else if (pickupType === "slow-time") {
      slowTimeMs = Math.max(slowTimeMs, BRICK_DODGER_SLOW_TIME_MS);
      statsState.slowTimePickups += 1;
      message = "Slow time online";
    } else {
      const streakPoints = bonusStreak * BRICK_DODGER_STREAK_BONUS_STEP;
      score += BRICK_DODGER_BONUS_SCORE + streakPoints;
      bonusStreak += 1;
      statsState.scorePickups += 1;
      message = bonusStreak > 1 ? `Bonus streak x${bonusStreak}` : "Bonus secured";
    }
  }

  const finalState = {
    ...workingState,
    hazards: remainingHazards,
    bonuses: remainingBonuses,
    score,
    lives: Math.max(0, lives),
    bonusStreak,
    nearMissStreak,
    nearMissMultiplier,
    invulnerabilityMs,
    slowTimeMs,
    stageNearMisses,
    stagePickups,
    stageHits,
    stats: statsState,
    status,
    message,
    spawnTimerMs,
  };
  if (finalState.stageElapsedMs >= stageConfig.durationMs) {
    return completeBrickDodgerStage(finalState);
  }
  return finalState;
}
