import test from "node:test";
import assert from "node:assert/strict";
import {
  FLAPPY_PIPE_SCORE,
  createFlappyGame,
  createFlappyLayout,
  flapFlappyGame,
  stepFlappyGame,
} from "../src/flappyGame.js";

function constantRng(value) {
  return () => value;
}

test("createFlappyGame seeds a ready state with visible pipes", () => {
  const game = createFlappyGame(960, 720, constantRng(0.3));
  assert.equal(game.status, "ready");
  assert.equal(game.message, "Pinch to flap");
  assert.equal(game.pipes.length, 3);
  assert.ok(game.pipes.every((pipe) => pipe.x >= game.layout.width));
});

test("flapFlappyGame starts the round and applies upward velocity", () => {
  const game = createFlappyGame(960, 720, constantRng(0.1));
  const started = flapFlappyGame(game, constantRng(0.1));
  assert.equal(started.status, "playing");
  assert.equal(started.message, "");
  assert.equal(started.bird.vy, started.layout.flapVelocity);
});

test("stepFlappyGame advances pipes and awards score once per passed obstacle", () => {
  const layout = createFlappyLayout(960, 720);
  const state = {
    layout,
    bird: {
      x: layout.birdX,
      y: layout.playfieldHeight * 0.45,
      vy: 0,
      radius: layout.birdRadius,
      rotation: 0,
    },
    pipes: [
      {
        id: "pipe-1",
        x: layout.birdX - layout.birdRadius - layout.pipeWidth - 2,
        width: layout.pipeWidth,
        gapTop: 120,
        gapHeight: layout.gapHeight,
        passed: false,
      },
    ],
    score: 0,
    status: "playing",
    message: "",
    nextPipeId: 2,
  };

  const next = stepFlappyGame(state, 1 / 60, constantRng(0.2));
  assert.equal(next.score, FLAPPY_PIPE_SCORE);
  assert.equal(next.pipes[0].passed, true);
});

test("stepFlappyGame ends the round on pipe collision", () => {
  const layout = createFlappyLayout(960, 720);
  const state = {
    layout,
    bird: {
      x: layout.birdX,
      y: 80,
      vy: 0,
      radius: layout.birdRadius,
      rotation: 0,
    },
    pipes: [
      {
        id: "pipe-1",
        x: layout.birdX - layout.birdRadius,
        width: layout.pipeWidth,
        gapTop: 220,
        gapHeight: layout.gapHeight,
        passed: false,
      },
    ],
    score: 0,
    status: "playing",
    message: "",
    nextPipeId: 2,
  };

  const next = stepFlappyGame(state, 1 / 60, constantRng(0.2));
  assert.equal(next.status, "gameover");
  assert.equal(next.message, "Pinch to restart");
});

test("flapFlappyGame restarts from game over and relaunches the bird", () => {
  const game = createFlappyGame(960, 720, constantRng(0.4));
  const restarted = flapFlappyGame(
    {
      ...game,
      status: "gameover",
      score: 5,
      message: "Pinch to restart",
    },
    constantRng(0.4),
  );
  assert.equal(restarted.status, "playing");
  assert.equal(restarted.score, 0);
  assert.equal(restarted.bird.vy, restarted.layout.flapVelocity);
});
