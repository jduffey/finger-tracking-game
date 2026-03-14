import { createScopedLogger } from "./logger.js";

const fingerPongLog = createScopedLogger("fingerPongGame");

export const FINGER_PONG_COUNTDOWN_MS = 2_500;
export const FINGER_PONG_MAX_SCORE = 7;

const FINGER_PONG_MAX_STEP_SECONDS = 1 / 45;
const FINGER_PONG_PADDLE_LERP_PER_SECOND = 15;
const FINGER_PONG_OPPONENT_LERP_PER_SECOND = 3.8;
const FINGER_PONG_PLAYER_SPEED_RATIO = 0.355;
const FINGER_PONG_BASE_BALL_SPEED_RATIO = 0.3;
const FINGER_PONG_SPEED_RAMP_PER_RETURN = 0.035;
const FINGER_PONG_MAX_SPEED_MULTIPLIER = 1.65;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPaddleRect(layout, x, y, width, height) {
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
  };
}

function intersectsRectCircle(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function getBaseBallSpeed(layout) {
  return Math.max(160, layout.height * FINGER_PONG_BASE_BALL_SPEED_RATIO);
}

function getBallSpeedMultiplier(rallyCount) {
  return Math.min(
    FINGER_PONG_MAX_SPEED_MULTIPLIER,
    1 + Math.max(0, rallyCount) * FINGER_PONG_SPEED_RAMP_PER_RETURN,
  );
}

function createBall(layout, direction = -1) {
  const baseSpeed = getBaseBallSpeed(layout);
  const horizontalSpeed = baseSpeed * 0.24;
  return {
    x: layout.width / 2,
    y: layout.height / 2,
    vx: horizontalSpeed * direction,
    vy: -Math.sqrt(Math.max(baseSpeed * baseSpeed - horizontalSpeed * horizontalSpeed, baseSpeed * baseSpeed * 0.68)),
    radius: layout.ballRadius,
  };
}

function createRoundState(layout, direction = -1) {
  return {
    player: {
      x: layout.width / 2,
      y: layout.playerPaddleY,
    },
    opponent: {
      x: layout.width / 2,
      y: layout.opponentPaddleY,
    },
    ball: createBall(layout, direction),
    score: 0,
    opponentScore: 0,
    rallyCount: 0,
    bestRally: 0,
    status: "countdown",
    countdownMs: FINGER_PONG_COUNTDOWN_MS,
    message: "3",
  };
}

function resetRound(state, reason, direction = -1) {
  const nextBall = createBall(state.layout, direction);
  return {
    ...state,
    player: {
      ...state.player,
      x: state.layout.width / 2,
    },
    opponent: {
      ...state.opponent,
      x: state.layout.width / 2,
    },
    ball: nextBall,
    rallyCount: 0,
    status: state.score >= FINGER_PONG_MAX_SCORE ? "won" : "countdown",
    countdownMs: state.score >= FINGER_PONG_MAX_SCORE ? 0 : FINGER_PONG_COUNTDOWN_MS,
    message:
      state.score >= FINGER_PONG_MAX_SCORE
        ? "Perfect rally"
        : reason === "player_miss"
          ? "Reset"
          : "Point",
  };
}

function bounceOffPaddle(ball, paddleCenterX, paddleWidth, travelDirection, speedMultiplier) {
  const hitOffset = clamp((ball.x - paddleCenterX) / Math.max(1, paddleWidth / 2), -1, 1);
  const speed = Math.hypot(ball.vx, ball.vy) * Math.max(1, speedMultiplier);
  const nextVx = speed * hitOffset * 0.88;
  const minVerticalSpeed = speed * 0.62;
  const nextVyMagnitude = Math.sqrt(
    Math.max(minVerticalSpeed * minVerticalSpeed, speed * speed - nextVx * nextVx),
  );
  return {
    ...ball,
    vx: nextVx,
    vy: nextVyMagnitude * travelDirection,
  };
}

export function createFingerPongLayout(width, height) {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 320);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const paddleWidth = clamp(safeWidth * 0.2, 118, 220);
  const opponentPaddleWidth = clamp(paddleWidth * 0.88, 104, 180);
  const paddleHeight = clamp(safeHeight * 0.022, 14, 20);
  const ballRadius = clamp(Math.min(safeWidth, safeHeight) * 0.014, 8, 12);
  const railInset = clamp(safeHeight * 0.11, 48, 88);

  return {
    width: safeWidth,
    height: safeHeight,
    paddleWidth,
    opponentPaddleWidth,
    paddleHeight,
    ballRadius,
    playerPaddleY: safeHeight - railInset,
    opponentPaddleY: railInset,
    baseBallSpeed: getBaseBallSpeed({ height: safeHeight }),
    playerSpeed: Math.max(180, safeWidth * FINGER_PONG_PLAYER_SPEED_RATIO),
  };
}

export function createFingerPongGame(width, height) {
  const layout = createFingerPongLayout(width, height);
  const game = {
    layout,
    ...createRoundState(layout),
  };
  fingerPongLog.info("Created finger pong game state", {
    width: layout.width,
    height: layout.height,
  });
  return game;
}

export function stepFingerPongGame(state, dtSeconds, paddleTargetX) {
  if (!state?.layout || !state?.ball) {
    return state;
  }

  const layout = state.layout;
  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, FINGER_PONG_MAX_STEP_SECONDS);
  const paddleHalfWidth = layout.paddleWidth / 2;
  const opponentHalfWidth = layout.opponentPaddleWidth / 2;
  const playerTargetX = clamp(
    Number.isFinite(paddleTargetX) ? paddleTargetX : state.player.x,
    paddleHalfWidth,
    layout.width - paddleHalfWidth,
  );
  const playerLerp = 1 - Math.exp(-FINGER_PONG_PADDLE_LERP_PER_SECOND * safeDt);
  const opponentLerp = 1 - Math.exp(-FINGER_PONG_OPPONENT_LERP_PER_SECOND * safeDt);
  const playerX = state.player.x + (playerTargetX - state.player.x) * playerLerp;
  const opponentTrackX = clamp(state.ball.x, opponentHalfWidth, layout.width - opponentHalfWidth);
  const opponentX = state.opponent.x + (opponentTrackX - state.opponent.x) * opponentLerp;

  let nextState = {
    ...state,
    player: {
      ...state.player,
      x: playerX,
    },
    opponent: {
      ...state.opponent,
      x: opponentX,
    },
  };

  if (nextState.status === "won") {
    return nextState;
  }

  if (nextState.status === "countdown") {
    const countdownMs = Math.max(0, nextState.countdownMs - safeDt * 1000);
    return {
      ...nextState,
      countdownMs,
      status: countdownMs <= 0 ? "playing" : "countdown",
      message: countdownMs <= 0 ? "Return it" : String(Math.max(1, Math.ceil(countdownMs / 1000))),
    };
  }

  const speedMultiplier = getBallSpeedMultiplier(nextState.rallyCount);
  let ball = {
    ...nextState.ball,
    x: nextState.ball.x + nextState.ball.vx * safeDt,
    y: nextState.ball.y + nextState.ball.vy * safeDt,
  };

  if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.radius >= layout.width) {
    ball.x = layout.width - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }

  const playerRect = getPaddleRect(
    layout,
    nextState.player.x,
    layout.playerPaddleY,
    layout.paddleWidth,
    layout.paddleHeight,
  );
  const opponentRect = getPaddleRect(
    layout,
    nextState.opponent.x,
    layout.opponentPaddleY,
    layout.opponentPaddleWidth,
    layout.paddleHeight,
  );

  if (ball.vy > 0 && intersectsRectCircle(ball, playerRect)) {
    ball.y = playerRect.y - ball.radius;
    ball = bounceOffPaddle(ball, nextState.player.x, layout.paddleWidth, -1, 1.035);
    const rallyCount = nextState.rallyCount + 1;
    return {
      ...nextState,
      ball,
      rallyCount,
      bestRally: Math.max(nextState.bestRally, rallyCount),
      message: rallyCount >= 4 ? "Nice rally" : "Return it",
    };
  }

  if (ball.vy < 0 && intersectsRectCircle(ball, opponentRect)) {
    ball.y = opponentRect.y + opponentRect.height + ball.radius;
    ball = bounceOffPaddle(ball, nextState.opponent.x, layout.opponentPaddleWidth, 1, 1.015);
    return {
      ...nextState,
      ball,
      rallyCount: nextState.rallyCount + 1,
      bestRally: Math.max(nextState.bestRally, nextState.rallyCount + 1),
      message: "Keep it going",
    };
  }

  if (ball.y + ball.radius < 0) {
    const score = nextState.score + 1;
    return resetRound(
      {
        ...nextState,
        score,
        bestRally: Math.max(nextState.bestRally, nextState.rallyCount),
        message: score >= FINGER_PONG_MAX_SCORE ? "Perfect rally" : "Point",
      },
      "player_point",
      score % 2 === 0 ? -1 : 1,
    );
  }

  if (ball.y - ball.radius > layout.height) {
    return resetRound(
      {
        ...nextState,
        opponentScore: nextState.opponentScore + 1,
        bestRally: Math.max(nextState.bestRally, nextState.rallyCount),
      },
      "player_miss",
      -1,
    );
  }

  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  const desiredSpeed = layout.baseBallSpeed * speedMultiplier;
  if (currentSpeed > 0 && desiredSpeed > currentSpeed) {
    const speedScale = desiredSpeed / currentSpeed;
    ball.vx *= speedScale;
    ball.vy *= speedScale;
  }

  return {
    ...nextState,
    ball,
  };
}
