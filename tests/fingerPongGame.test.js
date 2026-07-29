import test from "node:test";
import assert from "node:assert/strict";
import {
  FINGER_PONG_COUNTDOWN_MS,
  FINGER_PONG_MAX_SCORE,
  FINGER_PONG_WIN_MARGIN,
  createFingerPongGame,
  createFingerPongLayout,
  hasWonFingerPongMatch,
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
  for (let index = 0; index < 51; index += 1) {
    game = stepFingerPongGame(game, 0.05, game.player.x);
  }
  assert.equal(game.status, "playing");
  assert.ok(game.ball.vy < 0);
});

test("stepFingerPongGame preserves full elapsed time across larger frame deltas", () => {
  const targetX = 760;
  const singleStepState = stepFingerPongGame(createFingerPongGame(960, 720), 0.05, targetX);

  let repeatedStepState = createFingerPongGame(960, 720);
  for (let index = 0; index < 3; index += 1) {
    repeatedStepState = stepFingerPongGame(repeatedStepState, 1 / 60, targetX);
  }

  assert.ok(Math.abs(singleStepState.countdownMs - repeatedStepState.countdownMs) < 1e-6);
  assert.ok(Math.abs(singleStepState.player.x - repeatedStepState.player.x) < 1e-6);
  assert.ok(Math.abs(singleStepState.opponent.x - repeatedStepState.opponent.x) < 1e-6);
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

test("stepFingerPongGame clamps ball speed to the configured rally cap", () => {
  const layout = createFingerPongLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5,
      y: layout.height * 0.5,
      vx: 520,
      vy: -300,
      radius: layout.ballRadius,
    },
    score: 0,
    opponentScore: 0,
    rallyCount: 40,
    bestRally: 40,
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const next = stepFingerPongGame(state, 1 / 60, state.player.x);
  const expectedSpeed = layout.baseBallSpeed * 1.65;
  assert.ok(Math.abs(Math.hypot(next.ball.vx, next.ball.vy) - expectedSpeed) < 1e-6);
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

test("stepFingerPongGame ends the match when the player reaches the target score", () => {
  const layout = createFingerPongLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5,
      y: -layout.ballRadius - 2,
      vx: 0,
      vy: -180,
      radius: layout.ballRadius,
    },
    score: FINGER_PONG_MAX_SCORE - 1,
    opponentScore: 2,
    rallyCount: 4,
    bestRally: 4,
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const won = stepFingerPongGame(state, 1 / 60, state.player.x);
  assert.equal(won.score, FINGER_PONG_MAX_SCORE);
  assert.equal(won.status, "won");
  assert.equal(won.countdownMs, 0);
  assert.equal(won.message, "Match won");
});

test("stepFingerPongGame ends the match when the opponent reaches the target score", () => {
  const layout = createFingerPongLayout(960, 720);
  const state = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5,
      y: layout.height + layout.ballRadius + 2,
      vx: 0,
      vy: 180,
      radius: layout.ballRadius,
    },
    score: 2,
    opponentScore: FINGER_PONG_MAX_SCORE - 1,
    rallyCount: 3,
    bestRally: 3,
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const lost = stepFingerPongGame(state, 1 / 60, state.player.x);
  assert.equal(lost.opponentScore, FINGER_PONG_MAX_SCORE);
  assert.equal(lost.status, "lost");
  assert.equal(lost.countdownMs, 0);
  assert.equal(lost.message, "Opponent wins");

  const frozen = stepFingerPongGame(lost, 0.05, layout.width);
  assert.equal(frozen.status, "lost");
  assert.equal(frozen.opponentScore, lost.opponentScore);
  assert.deepEqual(frozen.ball, lost.ball);
});

test("Finger Pong requires a two-point margin once the match reaches deuce", () => {
  assert.equal(FINGER_PONG_WIN_MARGIN, 2);
  assert.equal(hasWonFingerPongMatch(7, 6), false);
  assert.equal(hasWonFingerPongMatch(8, 6), true);
  assert.equal(hasWonFingerPongMatch(11, 10), false);
  assert.equal(hasWonFingerPongMatch(12, 10), true);

  const layout = createFingerPongLayout(960, 720);
  const deucePoint = {
    layout,
    player: { x: layout.width * 0.5, y: layout.playerPaddleY },
    opponent: { x: layout.width * 0.5, y: layout.opponentPaddleY },
    ball: {
      x: layout.width * 0.5,
      y: -layout.ballRadius - 2,
      vx: 0,
      vy: -180,
      radius: layout.ballRadius,
    },
    score: 6,
    opponentScore: 6,
    rallyCount: 5,
    bestRally: 5,
    server: "player",
    status: "playing",
    countdownMs: 0,
    message: "",
  };

  const advantage = stepFingerPongGame(
    deucePoint,
    1 / 60,
    deucePoint.player.x,
  );
  assert.equal(advantage.score, 7);
  assert.equal(advantage.status, "countdown");

  const matchPoint = {
    ...advantage,
    status: "playing",
    countdownMs: 0,
    ball: {
      ...advantage.ball,
      y: -layout.ballRadius - 2,
      vy: -180,
    },
  };
  const won = stepFingerPongGame(matchPoint, 1 / 60, matchPoint.player.x);
  assert.equal(won.score, 8);
  assert.equal(won.status, "won");
});

test("Finger Pong alternates automatic serves and switches every point at deuce", () => {
  const layout = createFingerPongLayout(960, 720);
  const base = {
    ...createFingerPongGame(layout.width, layout.height),
    status: "playing",
    countdownMs: 0,
  };
  const scorePoint = (state) =>
    stepFingerPongGame(
      {
        ...state,
        status: "playing",
        countdownMs: 0,
        ball: {
          ...state.ball,
          y: -layout.ballRadius - 2,
          vy: -180,
        },
      },
      1 / 60,
      state.player.x,
    );

  const onePoint = scorePoint(base);
  assert.equal(onePoint.server, "player");
  assert.ok(onePoint.ball.vy < 0);

  const twoPoints = scorePoint(onePoint);
  assert.equal(twoPoints.server, "opponent");
  assert.ok(twoPoints.ball.vy > 0);

  const deuce = scorePoint({
    ...base,
    score: 6,
    opponentScore: 6,
  });
  assert.equal(deuce.server, "opponent");
  assert.ok(deuce.ball.vy > 0);
});
