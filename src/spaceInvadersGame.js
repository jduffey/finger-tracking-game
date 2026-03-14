import { createScopedLogger } from "./logger.js";

const invadersLog = createScopedLogger("spaceInvadersGame");

export const SPACE_INVADERS_ENEMY_SCORE = 125;

const INVADERS_COLUMNS = 8;
const INVADERS_ROWS = 4;
const INVADERS_MAX_STEP_SECONDS = 1 / 90;
const INVADERS_SHIP_LERP_PER_SECOND = 18;
const INVADERS_FIRE_COOLDOWN_MS = 240;
const INVADERS_ENEMY_FIRE_INTERVAL_MS = 900;
const INVADERS_RESTART_COOLDOWN_MS = 700;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(prefix, start = 1) {
  let next = start;
  return () => `${prefix}-${next++}`;
}

export function createSpaceInvadersLayout(width, height) {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 320);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const enemyWidth = clamp(safeWidth * 0.06, 28, 58);
  const enemyHeight = clamp(safeHeight * 0.04, 22, 40);
  const enemyGapX = clamp(enemyWidth * 0.35, 10, 22);
  const enemyGapY = clamp(enemyHeight * 0.45, 10, 20);
  const formationWidth = INVADERS_COLUMNS * enemyWidth + (INVADERS_COLUMNS - 1) * enemyGapX;
  const topPadding = clamp(safeHeight * 0.12, 48, 96);
  const baseSidePadding = clamp(safeWidth * 0.08, 18, 76);
  const shipWidth = clamp(safeWidth * 0.12, 68, 122);
  const shipHeight = clamp(safeHeight * 0.05, 24, 42);
  const enemySpeed = Math.max(54, safeWidth * 0.085);
  // Reserve enough room for at least one horizontal step in either direction.
  const minFormationTravelWidth = enemySpeed * INVADERS_MAX_STEP_SECONDS * 2 + 1;
  const sidePadding = Math.max(
    0,
    Math.min(baseSidePadding, (safeWidth - formationWidth - minFormationTravelWidth) / 2),
  );
  const shipY = safeHeight - clamp(safeHeight * 0.13, 58, 92);
  const shipMinX = shipWidth / 2 + sidePadding * 0.35;
  const shipMaxX = safeWidth - shipMinX;
  const shotWidth = clamp(enemyWidth * 0.18, 6, 10);
  const shotHeight = clamp(safeHeight * 0.035, 16, 28);

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
    descendStep: clamp(safeHeight * 0.045, 18, 34),
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
    dangerLineY: shipY - clamp(shipHeight * 1.4, 30, 56),
  };
}

function createEnemies(layout) {
  const startX = (layout.width - layout.formationWidth) / 2;
  const nextEnemyId = createIdFactory("enemy");
  const enemies = [];
  for (let row = 0; row < INVADERS_ROWS; row += 1) {
    for (let column = 0; column < INVADERS_COLUMNS; column += 1) {
      enemies.push({
        id: nextEnemyId(),
        row,
        column,
        x: startX + column * (layout.enemyWidth + layout.enemyGapX),
        y: layout.topPadding + row * (layout.enemyHeight + layout.enemyGapY),
        width: layout.enemyWidth,
        height: layout.enemyHeight,
        alive: true,
      });
    }
  }
  return enemies;
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

function createEnemyFireCooldownMs(rng = Math.random) {
  return INVADERS_ENEMY_FIRE_INTERVAL_MS + Math.floor(rng() * 260);
}

export function createSpaceInvadersGame(width, height, rng = Math.random) {
  const layout = createSpaceInvadersLayout(width, height);
  const state = {
    layout,
    ship: createShip(layout),
    enemies: createEnemies(layout),
    playerShots: [],
    enemyShots: [],
    score: 0,
    status: "playing",
    message: "Pinch to fire",
    enemyDirection: 1,
    fireCooldownMs: 0,
    enemyFireCooldownMs: createEnemyFireCooldownMs(rng),
    restartCooldownMs: 0,
    nextPlayerShotId: 1,
    nextEnemyShotId: 1,
  };

  invadersLog.info("Created space invaders state", {
    width: layout.width,
    height: layout.height,
    enemyCount: state.enemies.length,
  });
  return state;
}

function restartSpaceInvadersGame(state, rng = Math.random) {
  const restarted = createSpaceInvadersGame(state.layout.width, state.layout.height, rng);
  return {
    ...restarted,
    score: state.score,
    message: "Wave restarted",
  };
}

function stepEnemyFormation(enemies, layout, direction, dtSeconds) {
  const aliveEnemies = enemies.filter((enemy) => enemy.alive);
  if (aliveEnemies.length === 0) {
    return { enemies, direction };
  }

  const moveX = direction * layout.enemySpeed * dtSeconds;
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

  let nextState = {
    ...state,
    ship: {
      ...state.ship,
      x: shipX,
    },
    fireCooldownMs: Math.max(0, state.fireCooldownMs - elapsedMs),
    enemyFireCooldownMs: Math.max(0, state.enemyFireCooldownMs - elapsedMs),
    restartCooldownMs: Math.max(0, state.restartCooldownMs - elapsedMs),
  };

  if (safeDt <= 0) {
    return nextState;
  }

  if (nextState.status === "gameover" || nextState.status === "cleared") {
    if (fireRequested && nextState.restartCooldownMs <= 0) {
      return restartSpaceInvadersGame(nextState, rng);
    }
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
      fireCooldownMs: INVADERS_FIRE_COOLDOWN_MS,
      nextPlayerShotId: nextState.nextPlayerShotId + 1,
      message: "Pinch to fire",
    };
  }

  const subSteps = Math.max(1, Math.ceil(safeDt / INVADERS_MAX_STEP_SECONDS));
  const stepSeconds = safeDt / subSteps;
  let enemies = nextState.enemies.map((enemy) => ({ ...enemy }));
  let playerShots = nextState.playerShots.map((shot) => ({ ...shot }));
  let enemyShots = nextState.enemyShots.map((shot) => ({ ...shot }));
  let enemyDirection = nextState.enemyDirection;
  let score = nextState.score;
  let status = nextState.status;
  let message = nextState.message;
  let nextEnemyShotId = nextState.nextEnemyShotId;
  let enemyFireCooldownMs = nextState.enemyFireCooldownMs;
  const shipRect = getShipRect(nextState.ship);

  for (let stepIndex = 0; stepIndex < subSteps; stepIndex += 1) {
    const formationStep = stepEnemyFormation(enemies, layout, enemyDirection, stepSeconds);
    enemies = formationStep.enemies;
    enemyDirection = formationStep.direction;

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

    const remainingPlayerShots = [];
    for (const shot of playerShots) {
      let didHitEnemy = false;
      for (const enemy of enemies) {
        if (!enemy.alive) {
          continue;
        }
        if (intersectsRect(shot, enemy)) {
          enemy.alive = false;
          didHitEnemy = true;
          score += SPACE_INVADERS_ENEMY_SCORE;
          break;
        }
      }
      if (!didHitEnemy) {
        remainingPlayerShots.push(shot);
      }
    }
    playerShots = remainingPlayerShots;

    let shipHit = false;
    enemyShots = enemyShots.filter((shot) => {
      const hit = intersectsRect(shot, shipRect);
      shipHit ||= hit;
      return !hit;
    });
    if (shipHit && status === "playing") {
      status = "gameover";
      message = "Ship hit. Pinch to restart";
      break;
    }

    const aliveEnemies = enemies.filter((enemy) => enemy.alive);
    if (aliveEnemies.some((enemy) => enemy.y + enemy.height >= layout.dangerLineY)) {
      status = "gameover";
      message = "Formation landed. Pinch to restart";
      break;
    }

    if (aliveEnemies.length === 0) {
      status = "cleared";
      message = "Wave cleared. Pinch to restart";
      break;
    }

    if (enemyFireCooldownMs <= 0) {
      const firingCandidates = getBottomEnemyByColumn(aliveEnemies);
      if (firingCandidates.length > 0) {
        const shooter = firingCandidates[Math.floor(rng() * firingCandidates.length)];
        enemyShots.push(
          createProjectile(
            `enemy-shot-${nextEnemyShotId}`,
            shooter.x + shooter.width / 2 - layout.shotWidth / 2,
            shooter.y + shooter.height + 4,
            layout.shotWidth,
            layout.shotHeight,
            layout.enemyShotSpeed,
          ),
        );
        nextEnemyShotId += 1;
      }
      enemyFireCooldownMs = createEnemyFireCooldownMs(rng);
    }
  }

  return {
    ...nextState,
    enemies,
    playerShots,
    enemyShots,
    score,
    status,
    message,
    enemyDirection,
    enemyFireCooldownMs,
    nextEnemyShotId,
    restartCooldownMs:
      status === "playing" ? 0 : Math.max(nextState.restartCooldownMs, INVADERS_RESTART_COOLDOWN_MS),
  };
}
