import test from "node:test";
import assert from "node:assert/strict";
import {
  BREAKOUT_COOP_BRICK_SCORE,
  BREAKOUT_COOP_COUNTDOWN_MS,
  BREAKOUT_COOP_MAX_BALLS,
  BREAKOUT_COOP_PRISM_BRICK_SCORE,
  BREAKOUT_COOP_SHIELD_DURATION_MS,
  createBreakoutCoopGame,
  createBreakoutCoopLayout,
  stepBreakoutCoopGame,
} from "../src/breakoutCoopGame.js";

function constantRng(value) {
  return () => value;
}

function createActiveBall(layout, overrides = {}) {
  return {
    id: "coop-ball-test",
    x: layout.width / 2,
    y: layout.height / 2,
    vx: 0,
    vy: -250,
    radius: layout.ballRadius,
    stuckToPaddle: false,
    savedByShield: false,
    ...overrides,
  };
}

test("createBreakoutCoopGame starts in countdown with three lives", () => {
  const game = createBreakoutCoopGame(960, 720, constantRng(0.4));
  assert.equal(game.status, "countdown");
  assert.equal(game.countdownMs, BREAKOUT_COOP_COUNTDOWN_MS);
  assert.equal(game.lives, 3);
  assert.equal(game.balls.length, 1);
  assert.equal(game.balls[0].stuckToPaddle, true);
});

test("stepBreakoutCoopGame launches play after the countdown", () => {
  let game = createBreakoutCoopGame(960, 720, constantRng(0.3));
  for (let index = 0; index < 60; index += 1) {
    game = stepBreakoutCoopGame(game, 0.05, game.paddle.x, false, false, constantRng(0.3));
  }
  assert.equal(game.status, "playing");
  assert.equal(game.balls[0].stuckToPaddle, false);
  assert.ok(game.balls[0].vy < 0);
});

test("prism bricks add score and split into an extra ball", () => {
  const layout = createBreakoutCoopLayout(960, 720);
  const prismBrick = {
    id: "coop-brick-test",
    row: 0,
    column: 0,
    x: 280,
    y: 160,
    width: layout.brickWidth,
    height: layout.brickHeight,
    color: "#fff",
    kind: "prism",
    destroyed: false,
  };
  const state = {
    layout,
    paddle: { x: layout.width / 2 },
    balls: [
      {
        id: "coop-ball-1",
        x: prismBrick.x + prismBrick.width / 2,
        y: prismBrick.y + prismBrick.height + layout.ballRadius - 1,
        vx: 80,
        vy: -250,
        radius: layout.ballRadius,
        stuckToPaddle: false,
        savedByShield: false,
      },
    ],
    bricks: [prismBrick, { ...prismBrick, id: "coop-brick-2", x: prismBrick.x + 200, kind: "standard" }],
    score: 0,
    lives: 3,
    shield: { activeMs: 0, cooldownMs: 0, saves: 0, activations: 0, meter: 1 },
    status: "playing",
    countdownMs: 0,
    nextBallId: 2,
    message: "",
  };

  const next = stepBreakoutCoopGame(
    state,
    1 / 60,
    state.paddle.x,
    false,
    false,
    constantRng(0.2),
  );

  assert.equal(next.score, BREAKOUT_COOP_PRISM_BRICK_SCORE);
  assert.equal(next.balls.length, 2);
  assert.equal(next.bricks[0].destroyed, true);
});

test("shield activation saves a falling ball and spawns support multi-ball", () => {
  const layout = createBreakoutCoopLayout(960, 720);
  const state = {
    layout,
    paddle: { x: layout.width / 2 },
    balls: [
      createActiveBall(layout, {
        id: "coop-ball-1",
        x: layout.width / 2,
        y: layout.shieldY - layout.ballRadius - 1,
        vx: 0,
        vy: 320,
      }),
    ],
    bricks: [
      {
        id: "coop-brick-1",
        row: 0,
        column: 0,
        x: 120,
        y: 120,
        width: layout.brickWidth,
        height: layout.brickHeight,
        color: "#fff",
        kind: "standard",
        destroyed: false,
      },
    ],
    score: 0,
    lives: 3,
    shield: { activeMs: 0, cooldownMs: 0, saves: 0, activations: 0, meter: 1 },
    status: "playing",
    countdownMs: 0,
    nextBallId: 2,
    message: "",
  };

  const activated = stepBreakoutCoopGame(
    state,
    1 / 60,
    state.paddle.x,
    true,
    false,
    constantRng(0.7),
  );

  assert.equal(activated.shield.activations, 1);
  assert.ok(activated.shield.activeMs > BREAKOUT_COOP_SHIELD_DURATION_MS - 100);
  assert.equal(activated.shield.saves, 1);
  assert.equal(activated.balls.length, 2);
  assert.ok(activated.balls.every((ball) => ball.y < layout.shieldY));
});

test("shield saves do not exceed the configured max ball cap", () => {
  const layout = createBreakoutCoopLayout(960, 720);
  const balls = Array.from({ length: BREAKOUT_COOP_MAX_BALLS }, (_, index) =>
    createActiveBall(layout, {
      id: `coop-ball-${index + 1}`,
      x: layout.width / 2 + index,
      y: index === 0 ? layout.shieldY - layout.ballRadius - 1 : layout.height / 2,
      vx: index === 0 ? 0 : 80,
      vy: index === 0 ? 320 : -220,
    }),
  );
  const state = {
    layout,
    paddle: { x: layout.width / 2 },
    balls,
    bricks: [
      {
        id: "coop-brick-1",
        row: 0,
        column: 0,
        x: 120,
        y: 120,
        width: layout.brickWidth,
        height: layout.brickHeight,
        color: "#fff",
        kind: "standard",
        destroyed: false,
      },
    ],
    score: 0,
    lives: 3,
    shield: { activeMs: 0, cooldownMs: 0, saves: 0, activations: 0, meter: 1 },
    status: "playing",
    countdownMs: 0,
    nextBallId: BREAKOUT_COOP_MAX_BALLS + 1,
    message: "",
  };

  const activated = stepBreakoutCoopGame(
    state,
    1 / 60,
    state.paddle.x,
    true,
    false,
    constantRng(0.7),
  );

  assert.equal(activated.shield.saves, 1);
  assert.equal(activated.balls.length, BREAKOUT_COOP_MAX_BALLS);
});

test("prism splits do not exceed the configured max ball cap", () => {
  const layout = createBreakoutCoopLayout(960, 720);
  const prismBrick = {
    id: "coop-brick-test",
    row: 0,
    column: 0,
    x: 280,
    y: 160,
    width: layout.brickWidth,
    height: layout.brickHeight,
    color: "#fff",
    kind: "prism",
    destroyed: false,
  };
  const balls = [
    createActiveBall(layout, {
      id: "coop-ball-1",
      x: prismBrick.x + prismBrick.width / 2,
      y: prismBrick.y + prismBrick.height + layout.ballRadius - 1,
      vx: 80,
      vy: -250,
    }),
    ...Array.from({ length: BREAKOUT_COOP_MAX_BALLS - 1 }, (_, index) =>
      createActiveBall(layout, {
        id: `coop-ball-${index + 2}`,
        x: 160 + index * 24,
        y: layout.height / 2,
        vx: 80,
        vy: -220,
      }),
    ),
  ];
  const state = {
    layout,
    paddle: { x: layout.width / 2 },
    balls,
    bricks: [prismBrick, { ...prismBrick, id: "coop-brick-2", x: prismBrick.x + 200, kind: "standard" }],
    score: 0,
    lives: 3,
    shield: { activeMs: 0, cooldownMs: 0, saves: 0, activations: 0, meter: 1 },
    status: "playing",
    countdownMs: 0,
    nextBallId: BREAKOUT_COOP_MAX_BALLS + 1,
    message: "",
  };

  const next = stepBreakoutCoopGame(
    state,
    1 / 60,
    state.paddle.x,
    false,
    false,
    constantRng(0.2),
  );

  assert.equal(next.score, BREAKOUT_COOP_PRISM_BRICK_SCORE);
  assert.equal(next.balls.length, BREAKOUT_COOP_MAX_BALLS);
  assert.equal(next.bricks[0].destroyed, true);
});

test("losing the final life enters game over and restart recreates the round", () => {
  const layout = createBreakoutCoopLayout(960, 720);
  const state = {
    layout,
    paddle: { x: layout.width / 2 },
    balls: [
      {
        id: "coop-ball-9",
        x: layout.width / 2,
        y: layout.height + layout.ballRadius + 2,
        vx: 0,
        vy: 260,
        radius: layout.ballRadius,
        stuckToPaddle: false,
        savedByShield: false,
      },
    ],
    bricks: [
      {
        id: "coop-brick-1",
        row: 0,
        column: 0,
        x: 120,
        y: 120,
        width: layout.brickWidth,
        height: layout.brickHeight,
        color: "#fff",
        kind: "standard",
        destroyed: false,
      },
    ],
    score: BREAKOUT_COOP_BRICK_SCORE,
    lives: 1,
    shield: { activeMs: 0, cooldownMs: 0, saves: 0, activations: 0, meter: 1 },
    status: "playing",
    countdownMs: 0,
    nextBallId: 10,
    message: "",
  };

  const gameOver = stepBreakoutCoopGame(
    state,
    1 / 60,
    state.paddle.x,
    false,
    false,
    constantRng(0.2),
  );
  assert.equal(gameOver.status, "gameover");
  assert.equal(gameOver.lives, 0);
  assert.equal(gameOver.message, "Pinch to restart");

  const restarted = stepBreakoutCoopGame(
    gameOver,
    0,
    gameOver.paddle.x,
    false,
    true,
    constantRng(0.2),
  );
  assert.equal(restarted.status, "countdown");
  assert.equal(restarted.lives, 3);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.balls.length, 1);
});
