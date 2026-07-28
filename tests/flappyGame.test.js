import test from "node:test";
import assert from "node:assert/strict";
import {
  FLAPPY_CENTER_BONUS_SCORE,
  FLAPPY_PIPE_SCORE,
  createFlappyDailyChallengeGame,
  createFlappyGame,
  createFlappyLayout,
  flapFlappyGame,
  getFlappyDailyChallenge,
  getFlappyDifficulty,
  getFlappyMedals,
  getFlappyPinchFeedback,
  getFlappyResultStats,
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
  assert.deepEqual(
    game.pipes.map((pipe) => pipe.id),
    ["pipe-1", "pipe-4", "pipe-7"],
  );
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

test("stepFlappyGame only spawns every third scheduled pipe", () => {
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
        x: layout.width - layout.pipeSpacing * 3,
        width: layout.pipeWidth,
        gapTop: 120,
        gapHeight: layout.gapHeight,
        passed: false,
      },
    ],
    score: 0,
    status: "playing",
    message: "",
    nextPipeId: 4,
  };

  const next = stepFlappyGame(state, 0, constantRng(0.2));
  assert.equal(next.pipes.length, 1);
  const advanced = stepFlappyGame(state, 1 / 60, constantRng(0.2));
  assert.equal(advanced.pipes.length, 2);
  assert.equal(advanced.pipes[1].id, "pipe-4");
  assert.equal(
    advanced.pipes[1].x,
    advanced.pipes[0].x + layout.pipeSpacing * 3,
  );
  assert.equal(advanced.nextPipeId, 7);
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

test("daily challenges derive a stable UTC seed and deterministic pipe sequence", () => {
  const date = new Date("2026-07-28T23:45:00-04:00");
  const sameUtcDay = new Date("2026-07-29T10:15:00Z");
  const nextUtcDay = new Date("2026-07-30T00:00:00Z");
  const challenge = getFlappyDailyChallenge(date);

  assert.equal(challenge.dayKey, "2026-07-29");
  assert.deepEqual(challenge, getFlappyDailyChallenge(sameUtcDay));
  assert.notEqual(challenge.seed, getFlappyDailyChallenge(nextUtcDay).seed);

  const first = createFlappyDailyChallengeGame(960, 720, { date });
  const second = createFlappyDailyChallengeGame(960, 720, { date: sameUtcDay });
  assert.deepEqual(
    first.pipes.map((pipe) => pipe.gapTop),
    second.pipes.map((pipe) => pipe.gapTop),
  );

  const prepareSpawn = (state) => ({
    ...state,
    status: "playing",
    pipes: [
      {
        ...state.pipes[0],
        x: state.layout.width - state.layout.pipeSpacing * 3,
      },
    ],
  });
  const firstSpawn = stepFlappyGame(prepareSpawn(first), 1 / 60);
  const secondSpawn = stepFlappyGame(prepareSpawn(second), 1 / 60);
  assert.equal(firstSpawn.pipes[1].gapTop, secondSpawn.pipes[1].gapTop);
  assert.equal(firstSpawn.randomState, secondSpawn.randomState);
});

test("difficulty ramps speed, gravity, and gap precision in readable tiers", () => {
  const opening = getFlappyDifficulty(0);
  const midRun = getFlappyDifficulty(10);
  const lateRun = getFlappyDifficulty(1000);

  assert.equal(opening.level, 1);
  assert.equal(midRun.level, 3);
  assert.ok(midRun.speedMultiplier > opening.speedMultiplier);
  assert.ok(midRun.gravityMultiplier > opening.gravityMultiplier);
  assert.ok(midRun.gapScale < opening.gapScale);
  assert.equal(lateRun.speedMultiplier, 1.72);
  assert.equal(lateRun.gapScale, 0.68);
});

test("a centered pipe awards a bonus and builds a center streak", () => {
  const game = createFlappyGame(960, 720, constantRng(0.2));
  const birdY = game.bird.y;
  const state = {
    ...game,
    status: "playing",
    pipes: [
      {
        ...game.pipes[0],
        x: game.bird.x - game.bird.radius - game.layout.pipeWidth - 2,
        gapTop: birdY - game.layout.gapHeight / 2,
      },
    ],
  };

  const next = stepFlappyGame(state, 1 / 120, constantRng(0.2));
  assert.equal(next.score, FLAPPY_PIPE_SCORE + FLAPPY_CENTER_BONUS_SCORE);
  assert.equal(next.pipes[0].centered, true);
  assert.equal(next.stats.pipesCleared, 1);
  assert.equal(next.stats.centerBonuses, 1);
  assert.equal(next.stats.centerStreak, 1);
  assert.equal(next.stats.bestCenterStreak, 1);
});

test("an off-center pass awards the base point and resets the current streak", () => {
  const game = createFlappyGame(960, 720, constantRng(0.2));
  const state = {
    ...game,
    status: "playing",
    stats: {
      ...game.stats,
      centerBonuses: 2,
      centerStreak: 2,
      bestCenterStreak: 2,
    },
    pipes: [
      {
        ...game.pipes[0],
        x: game.bird.x - game.bird.radius - game.layout.pipeWidth - 2,
        gapTop: 80,
      },
    ],
  };

  const next = stepFlappyGame(state, 1 / 120, constantRng(0.2));
  assert.equal(next.score, FLAPPY_PIPE_SCORE);
  assert.equal(next.pipes[0].centered, false);
  assert.equal(next.stats.centerStreak, 0);
  assert.equal(next.stats.bestCenterStreak, 2);
});

test("pinch feedback exposes a short, monotonic edge pulse", () => {
  const game = createFlappyGame(960, 720, constantRng(0.2));
  const firstFlap = flapFlappyGame(game);
  const feedback = getFlappyPinchFeedback(firstFlap);
  assert.equal(feedback.active, true);
  assert.equal(feedback.type, "flap");
  assert.equal(feedback.pulse, 1);

  const aged = stepFlappyGame(firstFlap, 0.2, constantRng(0.2));
  assert.equal(getFlappyPinchFeedback(aged).active, false);

  const secondFlap = flapFlappyGame(aged);
  assert.equal(getFlappyPinchFeedback(secondFlap).pulse, 2);
  assert.equal(secondFlap.stats.flaps, 2);
});

test("game-over results include medals and restart preserves the best and daily seed", () => {
  const original = createFlappyDailyChallengeGame(960, 720, {
    date: "2026-07-28T12:00:00Z",
  });
  const terminalSetup = {
    ...original,
    status: "playing",
    score: 24,
    personalBest: 12,
    bird: {
      ...original.bird,
      y: original.bird.radius + 0.1,
      vy: -100,
    },
    pipes: [],
    stats: {
      ...original.stats,
      pipesCleared: 20,
      centerBonuses: 8,
      centerStreak: 8,
      bestCenterStreak: 8,
      flaps: 11,
    },
  };
  const gameOver = stepFlappyGame(terminalSetup, 1 / 60);
  const result = getFlappyResultStats(gameOver);

  assert.equal(gameOver.status, "gameover");
  assert.equal(result.score, 24);
  assert.equal(result.personalBest, 24);
  assert.equal(result.newPersonalBest, true);
  assert.deepEqual(
    getFlappyMedals(gameOver).map((medal) => medal.tier),
    ["bronze", "silver", "gold"],
  );

  const restarted = flapFlappyGame(gameOver);
  assert.equal(restarted.personalBest, 24);
  assert.equal(restarted.lastResult.score, 24);
  assert.deepEqual(restarted.challenge, original.challenge);
  assert.deepEqual(
    restarted.pipes.map((pipe) => pipe.gapTop),
    original.pipes.map((pipe) => pipe.gapTop),
  );
  assert.equal(getFlappyPinchFeedback(restarted).type, "restart");
});
