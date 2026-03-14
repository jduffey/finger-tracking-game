import { createScopedLogger } from "./logger.js";

const breakoutCoopLog = createScopedLogger("breakoutCoopGame");

export const BREAKOUT_COOP_COUNTDOWN_MS = 2_500;
export const BREAKOUT_COOP_BRICK_SCORE = 120;
export const BREAKOUT_COOP_PRISM_BRICK_SCORE = 200;
export const BREAKOUT_COOP_SHIELD_DURATION_MS = 3_200;
export const BREAKOUT_COOP_SHIELD_COOLDOWN_MS = 6_500;
export const BREAKOUT_COOP_MAX_BALLS = 6;

const BREAKOUT_COOP_ROWS = 6;
const BREAKOUT_COOP_COLUMNS = 9;
const BREAKOUT_COOP_MAX_STEP_SECONDS = 1 / 120;
const BREAKOUT_COOP_PADDLE_LERP_PER_SECOND = 15;
const BREAKOUT_COOP_LIVES = 3;
const BREAKOUT_COOP_SPEEDUP = 1.025;
const BREAKOUT_COOP_PRISM_PATTERN = new Set(["0:1", "0:7", "2:3", "2:5", "4:0", "4:8"]);
const BREAKOUT_COOP_BRICK_COLORS = [
  "#ff5a36",
  "#ff9a3c",
  "#ffd447",
  "#8ee35c",
  "#47c4ff",
  "#7d8cff",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(start = 1) {
  let next = start;
  return () => next++;
}

function createBallId(ballId) {
  return `coop-ball-${ballId}`;
}

function createBrickId(brickId) {
  return `coop-brick-${brickId}`;
}

function createBall(layout, x, y, vx, vy, ballId, stuckToPaddle = false) {
  return {
    id: createBallId(ballId),
    x,
    y,
    vx,
    vy,
    radius: layout.ballRadius,
    stuckToPaddle,
    savedByShield: false,
  };
}

function createStuckBall(layout, paddleX, ballId) {
  return createBall(
    layout,
    paddleX,
    layout.paddleY - layout.paddleHeight / 2 - layout.ballRadius - 5,
    0,
    0,
    ballId,
    true,
  );
}

function createPrismTrailBall(layout, sourceBall, vx, vy, ballId) {
  return createBall(
    layout,
    clamp(sourceBall.x, layout.ballRadius, layout.width - layout.ballRadius),
    sourceBall.y,
    vx,
    vy,
    ballId,
  );
}

function getPaddleRect(layout, paddleX) {
  return {
    x: paddleX - layout.paddleWidth / 2,
    y: layout.paddleY - layout.paddleHeight / 2,
    width: layout.paddleWidth,
    height: layout.paddleHeight,
  };
}

function intersectsRectCircle(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function launchBall(ball, layout, rng = Math.random) {
  const launchSpeed = layout.ballLaunchSpeed;
  const direction = rng() < 0.5 ? -1 : 1;
  const vx = launchSpeed * (0.22 + rng() * 0.18) * direction;
  const vy = -Math.sqrt(Math.max(launchSpeed * launchSpeed - vx * vx, launchSpeed * launchSpeed * 0.64));
  return {
    ...ball,
    vx,
    vy,
    stuckToPaddle: false,
    savedByShield: false,
  };
}

function splitBall(layout, ball, ballId, horizontalDirection) {
  const speed = Math.max(layout.ballLaunchSpeed, Math.hypot(ball.vx, ball.vy) * 1.04);
  const vx = clamp(
    (Math.abs(ball.vx) + speed * 0.24) * horizontalDirection,
    -speed * 0.82,
    speed * 0.82,
  );
  const vy = -Math.sqrt(Math.max(speed * speed - vx * vx, speed * speed * 0.58));
  return createPrismTrailBall(layout, ball, vx, vy, ballId);
}

function canSpawnSplitBall(activeBallCount, remainingOriginalBallCount) {
  return activeBallCount + remainingOriginalBallCount < BREAKOUT_COOP_MAX_BALLS;
}

function createShieldState() {
  return {
    activeMs: 0,
    cooldownMs: 0,
    saves: 0,
    activations: 0,
  };
}

function getShieldMeter(shield) {
  const total = BREAKOUT_COOP_SHIELD_DURATION_MS + BREAKOUT_COOP_SHIELD_COOLDOWN_MS;
  if ((shield?.activeMs ?? 0) > 0) {
    return 1;
  }
  return 1 - clamp((shield?.cooldownMs ?? 0) / total, 0, 1);
}

function createRestartedState(state) {
  const restarted = createBreakoutCoopGame(state.layout.width, state.layout.height);
  return {
    ...restarted,
    score: 0,
  };
}

function createLifeReset(state) {
  const layout = state.layout;
  const nextLives = Math.max(0, state.lives - 1);
  if (nextLives <= 0) {
    return {
      ...state,
      balls: [],
      shield: createShieldState(),
      lives: 0,
      status: "gameover",
      countdownMs: 0,
      message: "Pinch to restart",
    };
  }

  return {
    ...state,
    lives: nextLives,
    balls: [createStuckBall(layout, state.paddle.x, state.nextBallId)],
    nextBallId: state.nextBallId + 1,
    shield: createShieldState(),
    status: "countdown",
    countdownMs: BREAKOUT_COOP_COUNTDOWN_MS,
    message: String(Math.ceil(BREAKOUT_COOP_COUNTDOWN_MS / 1000)),
  };
}

export function createBreakoutCoopLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(320, Number.isFinite(height) ? height : 320);
  const sidePadding = clamp(safeWidth * 0.085, 22, 92);
  const topPadding = clamp(safeHeight * 0.12, 56, 108);
  const brickGap = clamp(Math.min(safeWidth, safeHeight) * 0.008, 4, 9);
  const brickHeight = clamp(safeHeight * 0.042, 22, 34);
  const brickWidth =
    (safeWidth - sidePadding * 2 - brickGap * (BREAKOUT_COOP_COLUMNS - 1)) /
    BREAKOUT_COOP_COLUMNS;
  const paddleWidth = clamp(safeWidth * 0.19, 132, 230);
  const paddleHeight = clamp(safeHeight * 0.024, 14, 24);
  const paddleY = safeHeight - clamp(safeHeight * 0.11, 54, 88);
  const ballRadius = clamp(Math.min(safeWidth, safeHeight) * 0.013, 8, 12);
  const shieldY = paddleY - clamp(safeHeight * 0.12, 50, 82);

  return {
    width: safeWidth,
    height: safeHeight,
    sidePadding,
    topPadding,
    brickGap,
    brickWidth,
    brickHeight,
    paddleWidth,
    paddleHeight,
    paddleY,
    shieldY,
    shieldHeight: clamp(ballRadius * 0.75, 8, 12),
    shieldWidth: clamp(paddleWidth * 1.7, 210, safeWidth * 0.66),
    ballRadius,
    ballLaunchSpeed: Math.max(220, safeHeight * 0.46),
  };
}

export function createBreakoutCoopBricks(layout) {
  const bricks = [];
  const createBrickNumber = createIdFactory(1);
  for (let row = 0; row < BREAKOUT_COOP_ROWS; row += 1) {
    for (let column = 0; column < BREAKOUT_COOP_COLUMNS; column += 1) {
      const kind = BREAKOUT_COOP_PRISM_PATTERN.has(`${row}:${column}`) ? "prism" : "standard";
      bricks.push({
        id: createBrickId(createBrickNumber()),
        row,
        column,
        x: layout.sidePadding + column * (layout.brickWidth + layout.brickGap),
        y: layout.topPadding + row * (layout.brickHeight + layout.brickGap),
        width: layout.brickWidth,
        height: layout.brickHeight,
        color: BREAKOUT_COOP_BRICK_COLORS[row % BREAKOUT_COOP_BRICK_COLORS.length],
        kind,
        destroyed: false,
      });
    }
  }
  return bricks;
}

export function createBreakoutCoopGame(width, height, rng = Math.random) {
  const layout = createBreakoutCoopLayout(width, height);
  const paddleX = layout.width / 2;
  const state = {
    layout,
    paddle: { x: paddleX },
    balls: [createStuckBall(layout, paddleX, 1)],
    bricks: createBreakoutCoopBricks(layout, rng),
    score: 0,
    lives: BREAKOUT_COOP_LIVES,
    shield: createShieldState(),
    status: "countdown",
    countdownMs: BREAKOUT_COOP_COUNTDOWN_MS,
    nextBallId: 2,
    message: String(Math.ceil(BREAKOUT_COOP_COUNTDOWN_MS / 1000)),
  };

  breakoutCoopLog.info("Created breakout coop game state", {
    width: layout.width,
    height: layout.height,
    brickCount: state.bricks.length,
  });
  return state;
}

export function stepBreakoutCoopGame(
  state,
  dtSeconds,
  paddleTargetX,
  abilityRequested,
  restartRequested = false,
  rng = Math.random,
) {
  if (!state?.layout) {
    return state;
  }

  if ((state.status === "gameover" || state.status === "cleared") && restartRequested) {
    return createRestartedState(state);
  }

  const layout = state.layout;
  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, 0.05);
  const paddleBoundsMin = layout.paddleWidth / 2;
  const paddleBoundsMax = layout.width - layout.paddleWidth / 2;
  const desiredPaddleX = clamp(
    Number.isFinite(paddleTargetX) ? paddleTargetX : state.paddle.x,
    paddleBoundsMin,
    paddleBoundsMax,
  );
  const lerp = 1 - Math.exp(-BREAKOUT_COOP_PADDLE_LERP_PER_SECOND * safeDt);
  const paddleX = state.paddle.x + (desiredPaddleX - state.paddle.x) * lerp;

  let nextState = {
    ...state,
    paddle: { x: paddleX },
  };

  if (safeDt <= 0) {
    return {
      ...nextState,
      shield: {
        ...nextState.shield,
        meter: getShieldMeter(nextState.shield),
      },
    };
  }

  if (nextState.status === "cleared") {
    return {
      ...nextState,
      message: "Pinch to restart",
      shield: {
        ...nextState.shield,
        meter: getShieldMeter(nextState.shield),
      },
    };
  }

  if (nextState.status === "gameover") {
    return {
      ...nextState,
      shield: {
        ...nextState.shield,
        meter: getShieldMeter(nextState.shield),
      },
    };
  }

  if (nextState.status === "countdown") {
    const countdownMs = Math.max(0, nextState.countdownMs - safeDt * 1000);
    const launched = countdownMs <= 0;
    const nextBalls = nextState.balls.map((ball) =>
      ball.stuckToPaddle
        ? launched
          ? launchBall(
              {
                ...ball,
                x: paddleX,
                y: layout.paddleY - layout.paddleHeight / 2 - ball.radius - 5,
              },
              layout,
              rng,
            )
          : {
              ...ball,
              x: paddleX,
              y: layout.paddleY - layout.paddleHeight / 2 - ball.radius - 5,
            }
        : ball,
    );
    const nextShield = {
      ...nextState.shield,
      activeMs: Math.max(0, nextState.shield.activeMs - safeDt * 1000),
      cooldownMs: Math.max(0, nextState.shield.cooldownMs - safeDt * 1000),
    };
    return {
      ...nextState,
      balls: nextBalls,
      shield: {
        ...nextShield,
        meter: getShieldMeter(nextShield),
      },
      countdownMs,
      status: launched ? "playing" : "countdown",
      message: launched ? "Support hand pinch: pulse shield" : String(Math.max(1, Math.ceil(countdownMs / 1000))),
    };
  }

  const subSteps = Math.max(1, Math.ceil(safeDt / BREAKOUT_COOP_MAX_STEP_SECONDS));
  const stepSeconds = safeDt / subSteps;
  const nextBricks = nextState.bricks.map((brick) => ({ ...brick }));
  const paddleRect = getPaddleRect(layout, paddleX);
  const nextShield = {
    ...nextState.shield,
    activeMs: Math.max(0, nextState.shield.activeMs - safeDt * 1000),
    cooldownMs: Math.max(0, nextState.shield.cooldownMs - safeDt * 1000),
  };

  if (abilityRequested && nextShield.activeMs <= 0 && nextShield.cooldownMs <= 0) {
    nextShield.activeMs = BREAKOUT_COOP_SHIELD_DURATION_MS;
    nextShield.cooldownMs =
      BREAKOUT_COOP_SHIELD_DURATION_MS + BREAKOUT_COOP_SHIELD_COOLDOWN_MS;
    nextShield.activations += 1;
  }

  const shieldActive = nextShield.activeMs > 0;
  let score = nextState.score;
  let nextBallId = nextState.nextBallId;
  const activeBalls = [];

  for (let originalBallIndex = 0; originalBallIndex < nextState.balls.length; originalBallIndex += 1) {
    const originalBall = nextState.balls[originalBallIndex];
    const remainingOriginalBallCount = nextState.balls.length - originalBallIndex;
    let ball = { ...originalBall };
    let removed = false;

    for (let stepIndex = 0; stepIndex < subSteps; stepIndex += 1) {
      ball.x += ball.vx * stepSeconds;
      ball.y += ball.vy * stepSeconds;

      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius >= layout.width) {
        ball.x = layout.width - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }

      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      if (
        shieldActive &&
        ball.vy > 0 &&
        !ball.savedByShield &&
        ball.y + ball.radius >= layout.shieldY &&
        Math.abs(ball.x - paddleX) <= layout.shieldWidth / 2
      ) {
        const shieldOffset = clamp((ball.x - paddleX) / Math.max(1, layout.shieldWidth / 2), -1, 1);
        const speed = Math.max(layout.ballLaunchSpeed, Math.hypot(ball.vx, ball.vy) * BREAKOUT_COOP_SPEEDUP);
        ball.y = layout.shieldY - ball.radius - 0.5;
        ball.vx = speed * shieldOffset * 0.85;
        ball.vy = -Math.sqrt(Math.max(speed * speed - ball.vx * ball.vx, speed * speed * 0.58));
        ball.savedByShield = true;
        nextShield.saves += 1;
        if (canSpawnSplitBall(activeBalls.length, remainingOriginalBallCount)) {
          activeBalls.push(splitBall(layout, ball, nextBallId, shieldOffset >= 0 ? -1 : 1));
          nextBallId += 1;
        }
      }

      if (
        ball.vy > 0 &&
        ball.x + ball.radius >= paddleRect.x &&
        ball.x - ball.radius <= paddleRect.x + paddleRect.width &&
        ball.y + ball.radius >= paddleRect.y &&
        ball.y - ball.radius <= paddleRect.y + paddleRect.height
      ) {
        const hitOffset = clamp((ball.x - paddleX) / Math.max(1, layout.paddleWidth / 2), -1, 1);
        const speed = Math.max(layout.ballLaunchSpeed, Math.hypot(ball.vx, ball.vy) * BREAKOUT_COOP_SPEEDUP);
        ball.x = clamp(ball.x, paddleRect.x + ball.radius, paddleRect.x + paddleRect.width - ball.radius);
        ball.y = paddleRect.y - ball.radius - 0.5;
        ball.vx = speed * hitOffset * 0.94;
        ball.vy = -Math.sqrt(Math.max(speed * speed - ball.vx * ball.vx, speed * speed * 0.58));
        ball.savedByShield = false;
      }

      const hitBrick = nextBricks.find(
        (brick) =>
          !brick.destroyed &&
          intersectsRectCircle(ball, {
            x: brick.x,
            y: brick.y,
            width: brick.width,
            height: brick.height,
          }),
      );

      if (hitBrick) {
        hitBrick.destroyed = true;
        score +=
          hitBrick.kind === "prism"
            ? BREAKOUT_COOP_PRISM_BRICK_SCORE
            : BREAKOUT_COOP_BRICK_SCORE;

        const brickCenterX = hitBrick.x + hitBrick.width / 2;
        const brickCenterY = hitBrick.y + hitBrick.height / 2;
        const deltaX = ball.x - brickCenterX;
        const deltaY = ball.y - brickCenterY;
        const overlapX = hitBrick.width / 2 + ball.radius - Math.abs(deltaX);
        const overlapY = hitBrick.height / 2 + ball.radius - Math.abs(deltaY);
        if (overlapX < overlapY) {
          ball.vx = deltaX >= 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        } else {
          ball.vy = deltaY >= 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        }

        if (hitBrick.kind === "prism" && canSpawnSplitBall(activeBalls.length, remainingOriginalBallCount)) {
          activeBalls.push(splitBall(layout, ball, nextBallId, ball.vx >= 0 ? -1 : 1));
          nextBallId += 1;
        }
      }

      if (ball.y - ball.radius > layout.height) {
        removed = true;
        break;
      }
    }

    if (!removed) {
      activeBalls.push(ball);
    }
  }

  const remainingBricks = nextBricks.filter((brick) => !brick.destroyed).length;
  if (remainingBricks === 0) {
    return {
      ...nextState,
      bricks: nextBricks,
      balls: activeBalls,
      score,
      nextBallId,
      shield: {
        ...nextShield,
        meter: getShieldMeter(nextShield),
      },
      status: "cleared",
      countdownMs: 0,
      message: "Pinch to restart",
    };
  }

  if (activeBalls.length === 0) {
    const resetState = createLifeReset({
      ...nextState,
      bricks: nextBricks,
      balls: [],
      score,
      nextBallId,
      shield: nextShield,
      status: "playing",
      countdownMs: 0,
      message: "",
    });
    return {
      ...resetState,
      shield: {
        ...resetState.shield,
        meter: getShieldMeter(resetState.shield),
      },
    };
  }

  const message = shieldActive
    ? "Shield live"
    : nextShield.cooldownMs <= 0
      ? "Shield ready"
      : "Shield recharging";

  return {
    ...nextState,
    bricks: nextBricks,
    balls: activeBalls,
    score,
    nextBallId,
    shield: {
      ...nextShield,
      meter: getShieldMeter(nextShield),
    },
    status: "playing",
    countdownMs: 0,
    message,
  };
}
