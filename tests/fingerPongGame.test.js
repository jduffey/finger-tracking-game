import test from "node:test";
import assert from "node:assert/strict";
import {
  FINGER_PONG_COUNTDOWN_MS,
  FINGER_PONG_MAX_SCORE,
  createFingerPongGame,
  createFingerPongLayout,
  stepFingerPongGame,
} from "../src/fingerPongGame.js";

test("createFingerPongGame starts in countdown with centered paddles", () => {
  const game = createFingerPongGame(960, 720);
  assert.equal(game.status, "countdown");
  assert.equal(game.countdownMs, FINGER_PONG_COUNTDOWN_MS);
  assert.equal(game.player.x, game.layout.width / 2);
  assert.equal(game.opponent.x, game.layout.width / 2);
});

test("stepFingerPongGame transitions from countdown into play", () => {
  let game = createFingerPongGame(960, 720);
  for (let index = 0; index < 120; index += 1) {
    game = stepFingerPongGame(game, 0.05, game.player.x);
  }
  assert.equal(game.status, "playing");
  assert.ok(game.ball.vy < 0);
});

test("stepFingerPongGame angles the return based on player paddle contact", () => {
  const layout = createFingerPongLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5 + layout.paddleWidth * 0.28,
      y: layout.playerPaddleY - layout.paddleHeight,
      vx: 0,
      vy: 210,
      radius: layout.ballRadius,
    },
    score: 0,
    opponentScore: 0,
    rallyCount: 0,
    bestRally: 0,
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const next = stepFingerPongGame(state, 1 / 60, state.player.x);
  assert.ok(next.ball.vy < 0);
  assert.ok(next.ball.vx > 0);
  assert.equal(next.rallyCount, 1);
});

test("stepFingerPongGame returns the ball from the opponent paddle and ramps speed by rally", () => {
  const layout = createFingerPongLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5,
      y: layout.opponentPaddleY + layout.paddleHeight,
      vx: 0,
      vy: -190,
      radius: layout.ballRadius,
    },
    score: 0,
    opponentScore: 0,
    rallyCount: 5,
    bestRally: 5,
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const next = stepFingerPongGame(state, 1 / 60, state.player.x);
  assert.ok(next.ball.vy > 0);
  assert.ok(Math.hypot(next.ball.vx, next.ball.vy) > Math.hypot(state.ball.vx, state.ball.vy));
  assert.equal(next.rallyCount, 6);
});

test("stepFingerPongGame awards points on top exit and resets on player miss", () => {
  const layout = createFingerPongLayout(960, 720);
  const pointState = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5,
      y: -layout.ballRadius - 2,
      vx: 20,
      vy: -180,
      radius: layout.ballRadius,
    },
    score: FINGER_PONG_MAX_SCORE - 2,
    opponentScore: 0,
    rallyCount: 4,
    bestRally: 4,
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const afterPoint = stepFingerPongGame(pointState, 1 / 60, pointState.player.x);
  assert.equal(afterPoint.score, FINGER_PONG_MAX_SCORE - 1);
  assert.equal(afterPoint.status, "countdown");
  assert.equal(afterPoint.rallyCount, 0);

  const missState = {
    ...afterPoint,
    status: "playing",
    countdownMs: 0,
    ball: {
      x: layout.width * 0.5,
      y: layout.height + layout.ballRadius + 3,
      vx: 0,
      vy: 180,
      radius: layout.ballRadius,
    },
    rallyCount: 3,
  };

  const afterMiss = stepFingerPongGame(missState, 1 / 60, missState.player.x);
  assert.equal(afterMiss.opponentScore, 1);
  assert.equal(afterMiss.status, "countdown");
  assert.equal(afterMiss.rallyCount, 0);
});
