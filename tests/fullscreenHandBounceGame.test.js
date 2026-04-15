import test from "node:test";
import assert from "node:assert/strict";
import {
  createFullscreenHandBounceGame,
  createFullscreenHandBounceLayout,
  stepFullscreenHandBounceGame,
} from "../src/fullscreenHandBounceGame.js";
import { createFruitNinjaLayout } from "../src/fruitNinjaGame.js";

test("createFullscreenHandBounceLayout reuses the fruit slice target radius", () => {
  const bounceLayout = createFullscreenHandBounceLayout(960, 720);
  const fruitLayout = createFruitNinjaLayout(960, 720);

  assert.equal(bounceLayout.ballRadius, fruitLayout.targetRadius);
});

test("stepFullscreenHandBounceGame bounces upward off the hand paddle and increments saves", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const next = stepFullscreenHandBounceGame(
    {
      ...game,
      ball: {
        ...game.ball,
        x: 480,
        y: 560,
        vx: 24,
        vy: 520,
      },
    },
    1 / 60,
    {
      x: 480,
      y: 610,
      width: 180,
      height: 70,
    },
  );

  assert.equal(next.score, 1);
  assert.equal(next.saveCount, 1);
  assert.ok(next.ball.vy < 0);
  assert.ok(next.ball.y < 560);
  assert.equal(next.message, "Keep it alive");
});

test("stepFullscreenHandBounceGame carries upward hand motion into the rebound", () => {
  const state = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const restingBounce = stepFullscreenHandBounceGame(
    {
      ...state,
      paddle: {
        x: 480,
        y: 620,
        width: 180,
        height: 70,
        vx: 0,
        vy: 0,
      },
      ball: {
        ...state.ball,
        x: 480,
        y: 564,
        vx: 12,
        vy: 520,
      },
    },
    1 / 60,
    {
      x: 480,
      y: 620,
      width: 180,
      height: 70,
    },
  );

  const liftingBounce = stepFullscreenHandBounceGame(
    {
      ...state,
      paddle: {
        x: 480,
        y: 654,
        width: 180,
        height: 70,
        vx: 0,
        vy: 0,
      },
      ball: {
        ...state.ball,
        x: 480,
        y: 564,
        vx: 12,
        vy: 520,
      },
    },
    1 / 60,
    {
      x: 480,
      y: 620,
      width: 180,
      height: 70,
    },
  );

  assert.ok(Math.abs(liftingBounce.ball.vy) > Math.abs(restingBounce.ball.vy));
});

test("stepFullscreenHandBounceGame ends the round when the ball falls below the screen", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const next = stepFullscreenHandBounceGame(
    {
      ...game,
      ball: {
        ...game.ball,
        x: 480,
        y: 790,
        vx: 0,
        vy: 320,
      },
      score: 4,
      bestScore: 3,
    },
    1 / 60,
    null,
  );

  assert.equal(next.status, "gameover");
  assert.equal(next.score, 4);
  assert.equal(next.bestScore, 4);
  assert.equal(next.message, "Ball dropped. Restart to try again.");
});
