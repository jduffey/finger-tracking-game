import { createScopedLogger } from "./logger";

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
