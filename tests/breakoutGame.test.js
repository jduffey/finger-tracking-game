import test from "node:test";
import assert from "node:assert/strict";
import {
  BREAKOUT_BRICK_SCORE,
  BREAKOUT_CAPSULE_SCORE,
  BREAKOUT_STARTING_LIVES,
  assignBreakoutCapsuleDrops,
  createBreakoutGame,
  createFindYourGrindBreakoutGame,
  createBreakoutLayout,
  restartBreakoutGame,
  stepBreakoutGame,
} from "../src/breakoutGame.js";

function constantRng(value) {
  return () => value;
}

function rectanglesOverlap(first, second) {
  const overlapWidth = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const overlapHeight =
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
  return overlapWidth > 1e-9 && overlapHeight > 1e-9;
}

function assertFindYourGrindBricksFitViewport(game) {
  const minX = Math.min(...game.bricks.map((brick) => brick.x));
  const maxX = Math.max(...game.bricks.map((brick) => brick.x + brick.width));

  assert.ok(minX >= 0);
  assert.ok(maxX <= game.layout.width);
  assert.ok(maxX - minX >= game.layout.width * 0.9);
  for (let firstIndex = 0; firstIndex < game.bricks.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < game.bricks.length; secondIndex += 1) {
      assert.equal(
        rectanglesOverlap(game.bricks[firstIndex], game.bricks[secondIndex]),
        false,
        `${game.bricks[firstIndex].id} should not overlap ${game.bricks[secondIndex].id}`,
      );
    }
  }
}

test("assignBreakoutCapsuleDrops marks exactly one fifth of bricks", () => {
  const bricks = Array.from({ length: 50 }, (_, index) => ({ id: `brick-${index}` }));
  const assigned = assignBreakoutCapsuleDrops(bricks, constantRng(0));
  assert.equal(
    assigned.filter((brick) => brick.dropsCapsule).length,
    10,
  );
});

test("createBreakoutGame starts with a stuck ball and countdown", () => {
  const game = createBreakoutGame(960, 720, constantRng(0.2));
  assert.equal(game.status, "countdown");
  assert.equal(game.countdownMs, 3_000);
  assert.equal(game.lives, BREAKOUT_STARTING_LIVES);
  assert.equal(game.level, 1);
  assert.equal(game.balls.length, 1);
  assert.equal(game.balls[0].stuckToPaddle, true);
});

test("createFindYourGrindBreakoutGame builds the logo from many small colored bricks", () => {
  const game = createFindYourGrindBreakoutGame(960, 720, constantRng(0.2));
  const classic = createBreakoutGame(960, 720, constantRng(0.2));
  const colors = new Set(game.bricks.map((brick) => brick.color));
  const capsuleCount = game.bricks.filter((brick) => brick.dropsCapsule).length;

  assert.equal(game.status, "countdown");
  assert.equal(game.message, "3");
  assert.ok(game.bricks.length > classic.bricks.length * 5);
  assert.ok(game.bricks.every((brick) => Math.abs(brick.width / brick.height - 2) < 1e-9));
  assert.ok(game.bricks.every((brick) => brick.height < classic.layout.brickHeight));
  assertFindYourGrindBricksFitViewport(game);
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [320, 440],
  ]) {
    assertFindYourGrindBricksFitViewport(
      createFindYourGrindBreakoutGame(width, height, constantRng(0.2)),
    );
  }
  assert.ok(colors.has("#2a5eff"));
  assert.ok(colors.has("#ff011f"));
  assert.ok(colors.has("#ff931a"));
  assert.ok(capsuleCount > 0);
  assert.ok(capsuleCount < game.bricks.length / 10);
});

test("stepBreakoutGame launches the opening ball after the countdown", () => {
  const initial = createBreakoutGame(960, 720, constantRng(0.3));
  let launched = initial;
  for (let index = 0; index < 61; index += 1) {
    launched = stepBreakoutGame(launched, 0.05, initial.paddle.x, constantRng(0.3));
  }
  assert.equal(launched.status, "playing");
  assert.equal(launched.balls[0].stuckToPaddle, false);
  assert.ok(launched.balls[0].vy < 0);
});

test("stepBreakoutGame bounces the ball based on paddle hit offset", () => {
  const layout = createBreakoutLayout(960, 720);
  const state = {
    layout,
    paddle: { x: layout.width * 0.5 },
    bricks: [],
    capsules: [],
    balls: [
      {
        id: "ball-1",
        x: layout.width * 0.5 + layout.paddleWidth * 0.3,
        y: layout.paddleY - layout.paddleHeight,
        vx: 0,
        vy: 260,
        radius: layout.ballRadius,
        stuckToPaddle: false,
      },
    ],
    score: 0,
    status: "playing",
    countdownMs: 0,
    nextBallId: 2,
    nextCapsuleId: 1,
    message: "",
  };

  const next = stepBreakoutGame(state, 1 / 60, state.paddle.x, constantRng(0.2));
  assert.ok(next.balls[0].vy < 0);
  assert.ok(next.balls[0].vx > 0);
});

test("stepBreakoutGame awards brick score and resets after the last ball is lost", () => {
  const layout = createBreakoutLayout(960, 720);
  const brick = {
    id: "brick-1",
    row: 0,
    column: 0,
    x: 300,
    y: 120,
    width: layout.brickWidth,
    height: layout.brickHeight,
    color: "#ff0000",
    destroyed: false,
    dropsCapsule: false,
  };
  const hitState = {
    layout,
    paddle: { x: layout.width * 0.5 },
    bricks: [brick],
    capsules: [],
    balls: [
      {
        id: "ball-1",
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height + layout.ballRadius - 1,
        vx: 0,
        vy: -240,
        radius: layout.ballRadius,
        stuckToPaddle: false,
      },
    ],
    score: 0,
    status: "playing",
    countdownMs: 0,
    nextBallId: 2,
    nextCapsuleId: 1,
    message: "",
  };

  const afterBrick = stepBreakoutGame(hitState, 1 / 60, hitState.paddle.x, constantRng(0.2));
  assert.equal(afterBrick.score, BREAKOUT_BRICK_SCORE);
  assert.equal(afterBrick.status, "cleared");

  const lostBallState = {
    ...afterBrick,
    status: "playing",
    bricks: [{ ...brick, destroyed: true }, { ...brick, id: "brick-2", y: 180, destroyed: false }],
    balls: [
      {
        id: "ball-2",
        x: layout.width * 0.5,
        y: layout.height + layout.ballRadius + 2,
        vx: 0,
        vy: 240,
        radius: layout.ballRadius,
        stuckToPaddle: false,
      },
    ],
    message: "",
  };
  const afterLoss = stepBreakoutGame(lostBallState, 1 / 60, lostBallState.paddle.x, constantRng(0.2));
  assert.equal(afterLoss.status, "countdown");
  assert.equal(afterLoss.lives, BREAKOUT_STARTING_LIVES - 1);
  assert.equal(afterLoss.balls.length, 1);
  assert.equal(afterLoss.balls[0].stuckToPaddle, true);
});

test("stepBreakoutGame awards capsule score and spawns an extra ball on catch", () => {
  const layout = createBreakoutLayout(960, 720);
  const state = {
    layout,
    paddle: { x: layout.width * 0.5 },
    bricks: [{ id: "brick-1", destroyed: false }],
    capsules: [
      {
        id: "capsule-1",
        x: layout.width * 0.5,
        y: layout.paddleY - 12,
        vy: 160,
        width: layout.capsuleWidth,
        height: layout.capsuleHeight,
      },
    ],
    balls: [
      {
        id: "ball-1",
        x: layout.width * 0.5,
        y: layout.height * 0.5,
        vx: 60,
        vy: -160,
        radius: layout.ballRadius,
        stuckToPaddle: false,
      },
    ],
    score: 0,
    status: "playing",
    countdownMs: 0,
    nextBallId: 2,
    nextCapsuleId: 2,
    message: "",
  };

  const next = stepBreakoutGame(state, 0.1, state.paddle.x, constantRng(0.8));
  assert.equal(next.score, BREAKOUT_CAPSULE_SCORE);
  assert.equal(next.balls.length, 2);
});

test("losing the final ball on the final life ends the breakout round", () => {
  const game = createBreakoutGame(960, 720, constantRng(0.2));
  const state = {
    ...game,
    status: "playing",
    countdownMs: 0,
    lives: 1,
    balls: [
      {
        ...game.balls[0],
        y: game.layout.height + game.layout.ballRadius + 2,
        vx: 0,
        vy: 240,
        stuckToPaddle: false,
      },
    ],
  };

  const gameOver = stepBreakoutGame(state, 1 / 60, state.paddle.x, constantRng(0.2));
  assert.equal(gameOver.status, "gameover");
  assert.equal(gameOver.lives, 0);
  assert.equal(gameOver.balls.length, 0);
  assert.equal(gameOver.countdownMs, 0);
  assert.equal(gameOver.message, "Round over");

  const frozen = stepBreakoutGame(gameOver, 0.05, gameOver.paddle.x, constantRng(0.2));
  assert.equal(frozen.status, "gameover");
  assert.equal(frozen.lives, 0);
  assert.equal(frozen.balls.length, 0);
});

test("restartBreakoutGame starts a fresh match after game over", () => {
  const game = createBreakoutGame(960, 720, constantRng(0.2));
  const restarted = restartBreakoutGame(
    {
      ...game,
      status: "gameover",
      score: 900,
      lives: 0,
      level: 3,
      balls: [],
    },
    constantRng(0.4),
  );

  assert.equal(restarted.status, "countdown");
  assert.equal(restarted.score, 0);
  assert.equal(restarted.lives, BREAKOUT_STARTING_LIVES);
  assert.equal(restarted.level, 1);
  assert.equal(restarted.variant, "classic");
  assert.equal(restarted.balls.length, 1);
  assert.ok(restarted.bricks.every((brick) => !brick.destroyed));
});

test("restartBreakoutGame advances a cleared board while preserving match progress", () => {
  const game = createFindYourGrindBreakoutGame(960, 720, constantRng(0.2));
  const nextLevel = restartBreakoutGame(
    {
      ...game,
      status: "cleared",
      score: 4_200,
      lives: 2,
      level: 2,
      bricks: game.bricks.map((brick) => ({ ...brick, destroyed: true })),
    },
    constantRng(0.4),
  );

  assert.equal(nextLevel.status, "countdown");
  assert.equal(nextLevel.score, 4_200);
  assert.equal(nextLevel.lives, 2);
  assert.equal(nextLevel.level, 3);
  assert.equal(nextLevel.variant, "find-your-grind-breakout");
  assert.equal(nextLevel.balls.length, 1);
  assert.ok(nextLevel.bricks.length > 250);
  assert.ok(nextLevel.bricks.every((brick) => !brick.destroyed));
});
