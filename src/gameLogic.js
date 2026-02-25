import { createScopedLogger } from "./logger.js";

export const GAME_DURATION_MS = 30_000;
export const MOLE_VISIBLE_MS = 700;
const gameLogicLog = createScopedLogger("gameLogic");

export function buildGridHoles(width, height, rows = 3, cols = 3) {
  gameLogicLog.debug("Building grid holes", { width, height, rows, cols });
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const cellWidth = safeWidth / cols;
  const cellHeight = safeHeight / rows;
  const radius = Math.min(cellWidth, cellHeight) * 0.26;

  const holes = [];
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      holes.push({
        index,
        x: cellWidth * (col + 0.5),
        y: cellHeight * (row + 0.55),
        r: radius,
      });
      index += 1;
    }
  }

  gameLogicLog.debug("Built grid holes", {
    holeCount: holes.length,
    radius,
    cellWidth,
    cellHeight,
  });
  return holes;
}

export function pickRandomHole(count, previousIndex = -1) {
  gameLogicLog.debug("Picking random hole", { count, previousIndex });
  if (count <= 0) {
    gameLogicLog.warn("No holes available to pick", { count });
    return -1;
  }
  if (count === 1) {
    gameLogicLog.debug("Only one hole exists, selected index 0");
    return 0;
  }

  let next = Math.floor(Math.random() * count);
  while (next === previousIndex) {
    next = Math.floor(Math.random() * count);
  }
  gameLogicLog.debug("Picked random hole", { next, previousIndex });
  return next;
}

export function randomSpawnDelay() {
  const delay = 600 + Math.random() * 400;
  gameLogicLog.debug("Generated random spawn delay", { delay });
  return delay;
}

export function isPointInCircle(point, circle) {
  gameLogicLog.debug("Checking point-circle collision", { point, circle });
  if (!point || !circle) {
    gameLogicLog.warn("Point-circle collision check skipped due to missing input", {
      hasPoint: Boolean(point),
      hasCircle: Boolean(circle),
    });
    return false;
  }
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  const hit = dx * dx + dy * dy <= circle.r * circle.r;
  gameLogicLog.debug("Point-circle collision result", { dx, dy, hit });
  return hit;
}

export function getRunnerLaneFromNormalizedX(normalizedX, laneDebounce = 0.06) {
  gameLogicLog.debug("Resolving runner lane from normalized x", {
    normalizedX,
    laneDebounce,
  });
  if (!Number.isFinite(normalizedX)) {
    gameLogicLog.warn("Runner lane resolution fallback to center due to invalid normalized x", {
      normalizedX,
    });
    return 0;
  }

  const clampedX = Math.min(1, Math.max(0, normalizedX));
  let lane = 0;
  if (clampedX < 1 / 3 - laneDebounce) {
    lane = -1;
  } else if (clampedX > 2 / 3 + laneDebounce) {
    lane = 1;
  }
  gameLogicLog.debug("Resolved runner lane", { clampedX, lane });
  return lane;
}

export function canRunnerStartJump(runnerY, runnerVy, airborneHeightThreshold = 2) {
  gameLogicLog.debug("Checking runner jump eligibility", {
    runnerY,
    runnerVy,
    airborneHeightThreshold,
  });
  const eligible =
    Number.isFinite(runnerY) &&
    Number.isFinite(runnerVy) &&
    runnerY <= airborneHeightThreshold &&
    runnerVy <= 0;
  gameLogicLog.debug("Runner jump eligibility resolved", { eligible });
  return eligible;
}

export function shouldCollectRunnerCoin(
  coin,
  laneFloat,
  runnerY,
  options = {},
) {
  const laneTolerance = options.laneTolerance ?? 0.44;
  const heightTolerance = options.heightTolerance ?? 56;
  const nearZMin = options.nearZMin ?? -40;
  const nearZMax = options.nearZMax ?? 90;

  gameLogicLog.debug("Evaluating runner coin collection eligibility", {
    coin,
    laneFloat,
    runnerY,
    laneTolerance,
    heightTolerance,
    nearZMin,
    nearZMax,
  });

  if (!coin || !Number.isFinite(coin.z) || !Number.isFinite(coin.lane) || !Number.isFinite(coin.height)) {
    gameLogicLog.warn("Coin collection eligibility failed due to invalid coin payload", { coin });
    return false;
  }
  if (!Number.isFinite(laneFloat) || !Number.isFinite(runnerY)) {
    gameLogicLog.warn("Coin collection eligibility failed due to invalid runner state", {
      laneFloat,
      runnerY,
    });
    return false;
  }

  const inCollectionZone = coin.z < nearZMax && coin.z > nearZMin;
  const laneMatch = Math.abs(coin.lane - laneFloat) < laneTolerance;
  const heightMatch = Math.abs(coin.height - runnerY) < heightTolerance;
  const shouldCollect = inCollectionZone && laneMatch && heightMatch;
  gameLogicLog.debug("Runner coin eligibility resolved", {
    inCollectionZone,
    laneMatch,
    heightMatch,
    shouldCollect,
  });
  return shouldCollect;
}
