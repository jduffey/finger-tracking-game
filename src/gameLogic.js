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

export function pickDistinctRandomChoice(values, excludedValue) {
  gameLogicLog.debug("Picking distinct random choice", { values, excludedValue });
  if (!Array.isArray(values) || values.length === 0) {
    gameLogicLog.warn("No values available for distinct random choice", { values, excludedValue });
    return null;
  }

  const distinctValues = values.filter((value) => value !== excludedValue);
  const candidateValues = distinctValues.length > 0 ? distinctValues : values;
  const nextValue = candidateValues[Math.floor(Math.random() * candidateValues.length)];
  gameLogicLog.debug("Picked distinct random choice", {
    excludedValue,
    nextValue,
    candidateCount: candidateValues.length,
  });
  return nextValue;
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

export function getRunnerTrackIndexFromNormalized(normalizedValue, gridSize = 4) {
  gameLogicLog.debug("Resolving runner track index from normalized value", {
    normalizedValue,
    gridSize,
  });
  const safeGridSize = Number.isFinite(gridSize) ? Math.max(1, Math.floor(gridSize)) : 4;
  const defaultIndex = Math.floor((safeGridSize - 1) / 2);
  if (!Number.isFinite(normalizedValue)) {
    gameLogicLog.warn("Runner track index fallback to default due to invalid normalized value", {
      normalizedValue,
      defaultIndex,
    });
    return defaultIndex;
  }

  const clamped = Math.min(1, Math.max(0, normalizedValue));
  const index = Math.min(safeGridSize - 1, Math.floor(clamped * safeGridSize));
  gameLogicLog.debug("Resolved runner track index", {
    clamped,
    index,
    safeGridSize,
  });
  return index;
}

export function getRunnerTrackOffsetFromIndex(trackIndex, gridSize = 4) {
  gameLogicLog.debug("Resolving runner track offset from index", {
    trackIndex,
    gridSize,
  });
  const safeGridSize = Number.isFinite(gridSize) ? Math.max(1, Math.floor(gridSize)) : 4;
  const clampedIndex = Math.min(
    safeGridSize - 1,
    Math.max(0, Number.isFinite(trackIndex) ? Math.floor(trackIndex) : 0),
  );
  const centerOffset = (safeGridSize - 1) * 0.5;
  const offset = clampedIndex - centerOffset;
  gameLogicLog.debug("Resolved runner track offset", { clampedIndex, centerOffset, offset });
  return offset;
}

export function computeRunnerTrackGridLayout(stageWidth, stageHeight, gridSize = 4) {
  gameLogicLog.debug("Computing runner track grid layout", {
    stageWidth,
    stageHeight,
    gridSize,
  });
  const width = Number.isFinite(stageWidth) ? Math.max(1, stageWidth) : 1;
  const height = Number.isFinite(stageHeight) ? Math.max(1, stageHeight) : 1;
  const safeGridSize = Number.isFinite(gridSize) ? Math.max(2, Math.floor(gridSize)) : 4;
  const trackHalfSpan = (safeGridSize - 1) * 0.5;

  const focalPoint = {
    x: width * 0.5,
    y: height * 0.5,
  };
  const nearMarginX = Math.max(14, width * 0.02);
  const nearMarginY = Math.max(16, height * 0.03);

  const maxSpacingX = (width * 0.5 - nearMarginX) / trackHalfSpan;
  const maxSpacingYTop = (focalPoint.y - nearMarginY) / trackHalfSpan;
  const maxSpacingYBottom = (height - nearMarginY - focalPoint.y) / trackHalfSpan;
  const trackSpacing = Math.max(
    24,
    Math.min(maxSpacingX, maxSpacingYTop, maxSpacingYBottom),
  );

  const trackOffsets = Array.from({ length: safeGridSize }, (_, index) =>
    getRunnerTrackOffsetFromIndex(index, safeGridSize),
  );
  const columnXs = trackOffsets.map((offset) => focalPoint.x + offset * trackSpacing);
  const rowYs = trackOffsets.map((offset) => focalPoint.y + offset * trackSpacing);

  const layout = {
    width,
    height,
    gridSize: safeGridSize,
    trackHalfSpan,
    focalPoint,
    horizonY: focalPoint.y,
    groundY: height * 0.96,
    trackSpacing,
    trackOffsets,
    columnXs,
    rowYs,
    fieldEdgeOffset: trackHalfSpan + 0.65,
  };
  gameLogicLog.debug("Computed runner track grid layout", layout);
  return layout;
}

export function shouldCollectRunnerCoin(
  coin,
  trackXFloat,
  trackYFloat,
  runnerY,
  options = {},
) {
  const trackXTolerance = options.trackXTolerance ?? 0.52;
  const trackYTolerance = options.trackYTolerance ?? 0.52;
  const heightTolerance = options.heightTolerance ?? 56;
  const nearZMin = options.nearZMin ?? -40;
  const nearZMax = options.nearZMax ?? 90;

  gameLogicLog.debug("Evaluating runner coin collection eligibility", {
    coin,
    trackXFloat,
    trackYFloat,
    runnerY,
    trackXTolerance,
    trackYTolerance,
    heightTolerance,
    nearZMin,
    nearZMax,
  });

  if (
    !coin ||
    !Number.isFinite(coin.z) ||
    !Number.isFinite(coin.trackX) ||
    !Number.isFinite(coin.trackY) ||
    !Number.isFinite(coin.height)
  ) {
    gameLogicLog.warn("Coin collection eligibility failed due to invalid coin payload", { coin });
    return false;
  }
  if (!Number.isFinite(trackXFloat) || !Number.isFinite(trackYFloat) || !Number.isFinite(runnerY)) {
    gameLogicLog.warn("Coin collection eligibility failed due to invalid runner state", {
      trackXFloat,
      trackYFloat,
      runnerY,
    });
    return false;
  }

  const inCollectionZone = coin.z < nearZMax && coin.z > nearZMin;
  const trackXMatch = Math.abs(coin.trackX - trackXFloat) < trackXTolerance;
  const trackYMatch = Math.abs(coin.trackY - trackYFloat) < trackYTolerance;
  const heightMatch = Math.abs(coin.height - runnerY) < heightTolerance;
  const shouldCollect = inCollectionZone && trackXMatch && trackYMatch && heightMatch;
  gameLogicLog.debug("Runner coin eligibility resolved", {
    inCollectionZone,
    trackXMatch,
    trackYMatch,
    heightMatch,
    shouldCollect,
  });
  return shouldCollect;
}
