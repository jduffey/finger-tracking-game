import { createScopedLogger } from "./logger.js";
import { createFruitNinjaLayout } from "./fruitNinjaGame.js";

const handBounceLog = createScopedLogger("fullscreenHandBounceGame");

const FULLSCREEN_HAND_BOUNCE_MAX_FRAME_SECONDS = 0.05;
const FULLSCREEN_HAND_BOUNCE_MAX_STEP_SECONDS = 1 / 120;
const FULLSCREEN_HAND_BOUNCE_WALL_RESTITUTION = 0.94;
const FULLSCREEN_HAND_BOUNCE_CEILING_RESTITUTION = 0.88;
const FULLSCREEN_HAND_BOUNCE_HORIZONTAL_PADDLE_INFLUENCE = 0.2;
const FULLSCREEN_HAND_BOUNCE_UPWARD_PADDLE_INFLUENCE = 0.24;
const FULLSCREEN_HAND_BOUNCE_DOWNWARD_PADDLE_PENALTY = 0.12;
const FULLSCREEN_HAND_BOUNCE_CONTACT_COOLDOWN_MS = 90;
const FULLSCREEN_HAND_BOUNCE_BALL_DRAG_PER_SECOND = 0.04;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max, rng = Math.random) {
  return min + rng() * Math.max(0, max - min);
}

function intersectsCircleRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function getPaddleRect(paddle) {
  return {
    x: paddle.x - paddle.width / 2,
    y: paddle.y - paddle.height / 2,
    width: paddle.width,
    height: paddle.height,
  };
}

function getSaveMessage(saveCount) {
  if (saveCount >= 18) {
    return "Unstoppable volley";
  }
  if (saveCount >= 12) {
    return "Locked in";
  }
  if (saveCount >= 7) {
    return "Great save";
  }
  if (saveCount >= 3) {
    return "Nice bounce";
  }
  return "Keep it alive";
}

function createBall(layout, rng = Math.random) {
  const direction = rng() < 0.5 ? -1 : 1;
  return {
    x: layout.width / 2,
    y: layout.spawnY,
    vx: direction * randomBetween(layout.width * 0.08, layout.width * 0.13, rng),
    vy: randomBetween(layout.height * 0.08, layout.height * 0.12, rng),
    radius: layout.ballRadius,
  };
}

function normalizePaddleInput(layout, paddleInput) {
  if (
    !layout ||
    !Number.isFinite(paddleInput?.x) ||
    !Number.isFinite(paddleInput?.y) ||
    !Number.isFinite(paddleInput?.width) ||
    !Number.isFinite(paddleInput?.height)
  ) {
    return null;
  }

  const width = clamp(
    paddleInput.width,
    layout.ballRadius * 1.9,
    layout.width * 0.38,
  );
  const height = clamp(
    paddleInput.height,
    layout.ballRadius * 0.72,
    layout.ballRadius * 1.65,
  );

  return {
    x: clamp(paddleInput.x, width / 2, layout.width - width / 2),
    y: clamp(
      paddleInput.y,
      height / 2 + layout.ballRadius * 0.4,
      layout.height - height / 2 - layout.ballRadius * 0.3,
    ),
    width,
    height,
  };
}

function resolvePaddle(state, paddleInput, dtSeconds) {
  const normalized = normalizePaddleInput(state?.layout, paddleInput);
  if (!normalized) {
    return null;
  }

  const previous = state?.paddle;
  const safeDt = Math.max(1 / 240, Number.isFinite(dtSeconds) ? dtSeconds : 0);
  return {
    ...normalized,
    vx: previous ? (normalized.x - previous.x) / safeDt : 0,
    vy: previous ? (normalized.y - previous.y) / safeDt : 0,
  };
}

function resolvePaddleBounce(state, ball, paddle) {
  const hitOffset = clamp((ball.x - paddle.x) / Math.max(1, paddle.width / 2), -1, 1);
  const incomingSpeed = Math.hypot(ball.vx, ball.vy);
  const targetSpeed = clamp(
    Math.max(
      state.layout.minBounceSpeed + state.saveCount * state.layout.saveRampSpeed,
      incomingSpeed * 0.96 + Math.max(0, ball.vy) * 0.08,
    ),
    state.layout.minBounceSpeed,
    state.layout.maxBallSpeed,
  );

  const nextVx = clamp(
    ball.vx * 0.64 +
      hitOffset * state.layout.maxHorizontalSpeed * 0.72 +
      paddle.vx * FULLSCREEN_HAND_BOUNCE_HORIZONTAL_PADDLE_INFLUENCE,
    -state.layout.maxHorizontalSpeed,
    state.layout.maxHorizontalSpeed,
  );

  const minVerticalSpeed = targetSpeed * 0.7;
  const lift =
    Math.max(0, -paddle.vy) * FULLSCREEN_HAND_BOUNCE_UPWARD_PADDLE_INFLUENCE -
    Math.max(0, paddle.vy) * FULLSCREEN_HAND_BOUNCE_DOWNWARD_PADDLE_PENALTY;
  const nextVyMagnitude = clamp(
    Math.sqrt(
      Math.max(
        minVerticalSpeed * minVerticalSpeed,
        targetSpeed * targetSpeed - nextVx * nextVx,
      ),
    ) + lift,
    minVerticalSpeed,
    state.layout.maxBallSpeed,
  );

  return {
    ...ball,
    x: clamp(ball.x, ball.radius, state.layout.width - ball.radius),
    y: paddle.y - paddle.height / 2 - ball.radius - 0.5,
    vx: nextVx,
    vy: -nextVyMagnitude,
  };
}

function stepFullscreenHandBounceSubstep(state, dtSeconds, paddle, nextElapsedMs) {
  const drag = Math.exp(-FULLSCREEN_HAND_BOUNCE_BALL_DRAG_PER_SECOND * dtSeconds);
  const layout = state.layout;
  let ball = {
    ...state.ball,
    x: state.ball.x + state.ball.vx * dtSeconds,
    y: state.ball.y + state.ball.vy * dtSeconds,
    vx: state.ball.vx * drag,
    vy: state.ball.vy + layout.gravity * dtSeconds,
  };

  if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx) * FULLSCREEN_HAND_BOUNCE_WALL_RESTITUTION;
  } else if (ball.x + ball.radius >= layout.width) {
    ball.x = layout.width - ball.radius;
    ball.vx = -Math.abs(ball.vx) * FULLSCREEN_HAND_BOUNCE_WALL_RESTITUTION;
  }

  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy) * FULLSCREEN_HAND_BOUNCE_CEILING_RESTITUTION;
  }

  let score = state.score;
  let saveCount = state.saveCount;
  let message = state.message;
  let lastCollisionAtMs = state.lastCollisionAtMs;
  let status = state.status;

  if (
    paddle &&
    nextElapsedMs - lastCollisionAtMs >= FULLSCREEN_HAND_BOUNCE_CONTACT_COOLDOWN_MS &&
    ball.vy > paddle.vy - 18 &&
    ball.y < paddle.y + paddle.height * 0.55 &&
    intersectsCircleRect(ball, getPaddleRect(paddle))
  ) {
    ball = resolvePaddleBounce(state, ball, paddle);
    saveCount += 1;
    score = saveCount;
    message = getSaveMessage(saveCount);
    lastCollisionAtMs = nextElapsedMs;
  }

  if (ball.y - ball.radius > layout.height) {
    status = "gameover";
    message = "Ball dropped. Restart to try again.";
  }

  return {
    ...state,
    ball,
    score,
    saveCount,
    bestScore: Math.max(state.bestScore, score),
    message,
    status,
    lastCollisionAtMs,
  };
}

export function createFullscreenHandBounceLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(480, Number.isFinite(height) ? height : 480);
  const fruitLayout = createFruitNinjaLayout(safeWidth, safeHeight);
  const ballRadius = fruitLayout.targetRadius;

  return {
    width: safeWidth,
    height: safeHeight,
    ballRadius,
    spawnY: ballRadius * 1.08,
    gravity: clamp(safeHeight * 2.7, 1_200, 2_240),
    minBounceSpeed: clamp(safeHeight * 0.95, 380, 860),
    maxBallSpeed: clamp(safeHeight * 2.05, 820, 1_780),
    maxHorizontalSpeed: clamp(safeWidth * 0.64, 320, 900),
    saveRampSpeed: clamp(safeHeight * 0.018, 10, 22),
  };
}

export function createFullscreenHandBounceGame(width, height, rng = Math.random) {
  const layout = createFullscreenHandBounceLayout(width, height);
  const state = {
    layout,
    ball: createBall(layout, rng),
    paddle: null,
    score: 0,
    saveCount: 0,
    bestScore: 0,
    elapsedMs: 0,
    lastCollisionAtMs: Number.NEGATIVE_INFINITY,
    status: "playing",
    message: "Show your hand under the ball",
  };

  handBounceLog.info("Created fullscreen hand bounce game state", {
    width: layout.width,
    height: layout.height,
    ballRadius: layout.ballRadius,
  });
  return state;
}

export function stepFullscreenHandBounceGame(state, dtSeconds, paddleInput) {
  if (!state?.layout || !state.ball) {
    return state;
  }

  const safeDt = clamp(
    Number.isFinite(dtSeconds) ? dtSeconds : 0,
    0,
    FULLSCREEN_HAND_BOUNCE_MAX_FRAME_SECONDS,
  );
  const paddle = resolvePaddle(state, paddleInput, safeDt);
  const nextState = {
    ...state,
    paddle,
    bestScore: Math.max(state.bestScore, state.score),
  };

  if (safeDt <= 0 || nextState.status !== "playing") {
    return nextState;
  }

  let remaining = safeDt;
  let workingState = nextState;
  while (remaining > 1e-9 && workingState.status === "playing") {
    const stepSeconds = Math.min(FULLSCREEN_HAND_BOUNCE_MAX_STEP_SECONDS, remaining);
    const nextElapsedMs = workingState.elapsedMs + stepSeconds * 1000;
    workingState = stepFullscreenHandBounceSubstep(
      workingState,
      stepSeconds,
      paddle,
      nextElapsedMs,
    );
    workingState = {
      ...workingState,
      elapsedMs: nextElapsedMs,
    };
    remaining -= stepSeconds;
  }

  if (workingState.status === "gameover") {
    workingState = {
      ...workingState,
      bestScore: Math.max(workingState.bestScore, workingState.score),
    };
  }

  return workingState;
}
