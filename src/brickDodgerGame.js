import { createScopedLogger } from "./logger.js";

const brickDodgerLog = createScopedLogger("brickDodgerGame");

export const BRICK_DODGER_BONUS_SCORE = 250;
export const BRICK_DODGER_STARTING_LIVES = 3;

const BRICK_DODGER_MAX_STEP_SECONDS = 0.05;
const BRICK_DODGER_LANE_COUNT = 6;
const BRICK_DODGER_PLAYER_LERP_PER_SECOND = 16;
const BRICK_DODGER_SURVIVAL_POINTS_PER_SECOND = 20;
const BRICK_DODGER_STREAK_BONUS_STEP = 50;
const BRICK_DODGER_INVULNERABILITY_MS = 850;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(prefix, start = 1) {
  let next = start;
  return () => `${prefix}-${next++}`;
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

function createHazard(layout, laneIndex, hazardId, elapsedMs) {
  const x = layout.laneCenters[laneIndex];
  return {
    id: hazardId,
    laneIndex,
    x,
    y: -layout.hazardHeight - 8,
    width: layout.hazardWidth,
    height: layout.hazardHeight,
    vy: getBrickDodgerHazardSpeed(layout, elapsedMs),
  };
}

function createBonus(layout, laneIndex, bonusId, elapsedMs) {
  const x = layout.laneCenters[laneIndex];
  return {
    id: bonusId,
    laneIndex,
    x,
    y: -layout.bonusSize - layout.hazardHeight * 1.1,
    size: layout.bonusSize,
    vy: getBrickDodgerBonusSpeed(layout, elapsedMs),
  };
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
  const hazardLaneIndexes = pickDistinctLaneIndexes(
    getBrickDodgerWaveHazardCount(state.elapsedMs, laneCount),
    laneCount,
    rng,
  );

  const hazards = [...state.hazards];
  const bonuses = [...state.bonuses];
  const nextHazardId = createIdFactory("hazard", state.nextHazardId);
  const nextBonusId = createIdFactory("bonus", state.nextBonusId);

  for (const laneIndex of hazardLaneIndexes) {
    hazards.push(createHazard(state.layout, laneIndex, nextHazardId(), state.elapsedMs));
  }

  let updatedNextBonusId = state.nextBonusId;
  if (hazardLaneIndexes.length < laneCount && rng() < 0.42) {
    const bonusLaneIndex = pickBonusLaneIndex(hazardLaneIndexes, laneCount, rng);
    if (bonusLaneIndex !== null) {
      bonuses.push(createBonus(state.layout, bonusLaneIndex, nextBonusId(), state.elapsedMs));
      updatedNextBonusId += 1;
    }
  }

  return {
    ...state,
    hazards,
    bonuses,
    nextHazardId: state.nextHazardId + hazardLaneIndexes.length,
    nextBonusId: updatedNextBonusId,
  };
}

export function createBrickDodgerGame(width, height) {
  const layout = createBrickDodgerLayout(width, height);
  const state = {
    layout,
    player: {
      x: layout.width / 2,
    },
    hazards: [],
    bonuses: [],
    score: 0,
    lives: BRICK_DODGER_STARTING_LIVES,
    elapsedMs: 0,
    survivalMs: 0,
    survivalScoreRemainder: 0,
    bonusStreak: 0,
    invulnerabilityMs: 0,
    status: "playing",
    message: "Slide left and right to dodge bricks",
    nextHazardId: 1,
    nextBonusId: 1,
    spawnTimerMs: 520,
  };

  brickDodgerLog.info("Created brick dodger state", {
    width: layout.width,
    height: layout.height,
    laneCount: layout.laneCenters.length,
  });
  return state;
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

  let nextState = {
    ...state,
    player: {
      x: playerX,
    },
    invulnerabilityMs: Math.max(0, state.invulnerabilityMs - elapsedMs),
  };

  if (safeDt <= 0 || nextState.status !== "playing") {
    return nextState;
  }

  const nextElapsedMs = state.elapsedMs + elapsedMs;
  const survivalScore = state.survivalScoreRemainder + safeDt * BRICK_DODGER_SURVIVAL_POINTS_PER_SECOND;
  const survivalScoreDelta = Math.floor(survivalScore);
  let score = state.score + survivalScoreDelta;
  let lives = state.lives;
  let bonusStreak = state.bonusStreak;
  let invulnerabilityMs = nextState.invulnerabilityMs;
  let status = state.status;
  let message = state.message;

  let workingState = {
    ...nextState,
    elapsedMs: nextElapsedMs,
    survivalMs: state.survivalMs + elapsedMs,
    survivalScoreRemainder: survivalScore - survivalScoreDelta,
    score,
  };

  let spawnTimerMs = state.spawnTimerMs - elapsedMs;
  let spawnIterations = 0;
  while (spawnTimerMs <= 0 && spawnIterations < 4) {
    workingState = spawnBrickDodgerWave(workingState, rng);
    spawnTimerMs += getBrickDodgerSpawnDelayMs(workingState.elapsedMs);
    spawnIterations += 1;
  }

  const playerRect = getPlayerRect(state.layout, playerX);
  const movedHazards = workingState.hazards
    .map((hazard) => ({
      ...hazard,
      y: hazard.y + hazard.vy * safeDt,
    }))
    .filter((hazard) => hazard.y - hazard.height / 2 <= state.layout.height + 12);
  const movedBonuses = workingState.bonuses
    .map((bonus) => ({
      ...bonus,
      y: bonus.y + bonus.vy * safeDt,
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
      remainingHazards.push(hazard);
      continue;
    }

    if (invulnerabilityMs <= 0) {
      lives -= 1;
      bonusStreak = 0;
      invulnerabilityMs = BRICK_DODGER_INVULNERABILITY_MS;
      message = lives > 0 ? `${lives} shields left` : "Run over";
      if (lives <= 0) {
        status = "gameover";
      }
    }
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

    const streakPoints = bonusStreak * BRICK_DODGER_STREAK_BONUS_STEP;
    score += BRICK_DODGER_BONUS_SCORE + streakPoints;
    bonusStreak += 1;
    message = bonusStreak > 1 ? `Bonus streak x${bonusStreak}` : "Bonus secured";
  }

  return {
    ...workingState,
    hazards: remainingHazards,
    bonuses: remainingBonuses,
    score,
    lives: Math.max(0, lives),
    bonusStreak,
    invulnerabilityMs,
    status,
    message,
    spawnTimerMs,
  };
}
