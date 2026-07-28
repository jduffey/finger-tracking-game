import test from "node:test";
import assert from "node:assert/strict";
import {
  createFullscreenHandBounceDailyGame,
  createFullscreenHandBounceGame,
  createFullscreenHandBounceLayout,
  getFullscreenHandBounceDailyChallenge,
  getFullscreenHandBounceResultStats,
  getFullscreenHandBounceStageConfig,
  getFullscreenHandBounceTargetRect,
  restartFullscreenHandBounceGame,
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

test("stepFullscreenHandBounceGame spends a life and respawns after a recoverable drop", () => {
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

  assert.equal(next.status, "playing");
  assert.equal(next.lives, 1);
  assert.equal(next.stats.drops, 1);
  assert.ok(next.ball.y < next.layout.height / 2);
  assert.equal(next.score, 4);
  assert.equal(next.bestScore, 4);
  assert.match(next.message, /1 life left/);
});

test("stepFullscreenHandBounceGame ends with a finite defeat after the final drop", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const next = stepFullscreenHandBounceGame(
    {
      ...game,
      lives: 1,
      ball: {
        ...game.ball,
        x: 480,
        y: 790,
        vx: 0,
        vy: 320,
      },
      score: 7,
    },
    1 / 60,
    null,
  );

  assert.equal(next.status, "gameover");
  assert.equal(next.phase, "result");
  assert.equal(next.outcome, "defeat");
  assert.equal(next.result.score, 7);
  assert.equal(next.result.drops, 1);
  assert.equal(next.result.livesRemaining, 0);
  assert.match(next.message, /Final ball dropped/);
});

test("stage goals create a checkpoint and advance into a distinct timed stage", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const checkpoint = stepFullscreenHandBounceGame(
    {
      ...game,
      saveCount: 3,
      stageProgress: {
        saves: 3,
        targetHits: 0,
        trickShots: 0,
      },
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

  assert.equal(checkpoint.phase, "checkpoint");
  assert.equal(checkpoint.status, "playing");
  assert.equal(checkpoint.stats.stagesCleared, 1);
  assert.equal(checkpoint.lastStageRecap.saves, 4);

  const nextStage = stepFullscreenHandBounceGame(
    {
      ...checkpoint,
      checkpointMsRemaining: 10,
    },
    0.05,
    null,
  );

  assert.equal(nextStage.phase, "playing");
  assert.equal(nextStage.stage, 2);
  assert.equal(nextStage.stageConfig.name, "Corner Rally");
  assert.deepEqual(nextStage.stageProgress, {
    saves: 0,
    targetHits: 0,
    trickShots: 0,
  });
  assert.ok(nextStage.targetZone);
  assert.equal(
    nextStage.stageTimeRemainingMs,
    getFullscreenHandBounceStageConfig(2).durationMs,
  );
});

test("target zones award aim and bank-shot progress deterministically", () => {
  const game = createFullscreenHandBounceGame(960, 720, {
    seed: 42,
  });
  const stageTwo = stepFullscreenHandBounceGame(
    {
      ...game,
      phase: "checkpoint",
      checkpointMsRemaining: 1,
    },
    0.01,
    null,
  );
  const target = getFullscreenHandBounceTargetRect(stageTwo);
  const next = stepFullscreenHandBounceGame(
    {
      ...stageTwo,
      wallBouncesSinceSave: 1,
      ball: {
        ...stageTwo.ball,
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        vx: 0,
        vy: -300,
      },
    },
    1 / 120,
    null,
  );

  assert.equal(next.stageProgress.targetHits, 1);
  assert.equal(next.stageProgress.trickShots, 1);
  assert.equal(next.stats.targetHits, 1);
  assert.equal(next.stats.bankShots, 1);
  assert.equal(next.targetIndex, 1);
  assert.equal(next.score, 5);
  assert.match(next.message, /Bank target/);
});

test("edge and lift contacts create trick-shot and combo scoring", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const next = stepFullscreenHandBounceGame(
    {
      ...game,
      paddle: {
        x: 480,
        y: 650,
        width: 180,
        height: 70,
        vx: 0,
        vy: 0,
      },
      ball: {
        ...game.ball,
        x: 558,
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

  assert.equal(next.saveCount, 1);
  assert.equal(next.comboCount, 1);
  assert.deepEqual(
    {
      edge: next.stats.edgeShots,
      lift: next.stats.liftShots,
      tricks: next.stats.trickShots,
    },
    {
      edge: 1,
      lift: 1,
      tricks: 2,
    },
  );
  assert.equal(next.score, 5);
  assert.equal(next.stageProgress.trickShots, 2);
});

test("focus automatically activates a finite double-score power volley", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const powered = stepFullscreenHandBounceGame(
    {
      ...game,
      focus: 94,
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

  assert.ok(powered.powerModeMs > 0);
  assert.equal(powered.stats.powerUpsActivated, 1);
  assert.equal(powered.focus, 6);

  const secondSave = stepFullscreenHandBounceGame(
    {
      ...powered,
      lastCollisionAtMs: Number.NEGATIVE_INFINITY,
      ball: {
        ...powered.ball,
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
  assert.equal(secondSave.score - powered.score, 2);
});

test("a stage timer produces a finite goal-based failure", () => {
  const game = createFullscreenHandBounceGame(960, 720, () => 0.25);
  const next = stepFullscreenHandBounceGame(
    {
      ...game,
      stageTimeRemainingMs: 2,
      ball: {
        ...game.ball,
        x: 480,
        y: 200,
        vx: 0,
        vy: 0,
      },
    },
    0.01,
    null,
  );

  assert.equal(next.status, "gameover");
  assert.equal(next.outcome, "defeat");
  assert.match(next.message, /timed out/);
});

test("clearing the final stage records a finite victory result", () => {
  const game = createFullscreenHandBounceGame(960, 720, {
    seed: 42,
    personalBest: 10,
  });
  const stageConfig = getFullscreenHandBounceStageConfig(3);
  const victory = stepFullscreenHandBounceGame(
    {
      ...game,
      stage: 3,
      stageConfig,
      stageProgress: {
        saves: stageConfig.requiredSaves - 1,
        targetHits: stageConfig.requiredTargetHits,
        trickShots: stageConfig.requiredTrickShots,
      },
      targetZone: null,
      saveCount: 14,
      score: 18,
      stats: {
        ...game.stats,
        stagesCleared: 2,
        targetHits: stageConfig.requiredTargetHits,
        trickShots: stageConfig.requiredTrickShots,
        bestCombo: 5,
      },
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

  assert.equal(victory.status, "gameover");
  assert.equal(victory.outcome, "victory");
  assert.equal(victory.result.outcome, "victory");
  assert.equal(victory.result.stagesCleared, 3);
  assert.equal(victory.result.stageReached, 3);
  assert.equal(victory.result.newPersonalBest, true);
});

test("daily challenges are date-stable and reproduce the same route", () => {
  const firstChallenge = getFullscreenHandBounceDailyChallenge(
    "2026-07-28T10:00:00Z",
  );
  const secondChallenge = getFullscreenHandBounceDailyChallenge(
    "2026-07-28T23:59:00Z",
  );
  const first = createFullscreenHandBounceDailyGame(960, 720, {
    date: "2026-07-28",
  });
  const second = createFullscreenHandBounceDailyGame(960, 720, {
    date: "2026-07-28",
  });

  assert.deepEqual(firstChallenge, secondChallenge);
  assert.deepEqual(first.challenge, second.challenge);
  assert.deepEqual(first.ball, second.ball);
  assert.equal(first.initialRandomState, second.initialRandomState);
});

test("restart preserves daily seed and personal-best context", () => {
  const game = createFullscreenHandBounceDailyGame(960, 720, {
    date: "2026-07-28",
    personalBest: 12,
  });
  const restarted = restartFullscreenHandBounceGame({
    ...game,
    score: 18,
    bestScore: 18,
  });

  assert.equal(restarted.challenge.id, game.challenge.id);
  assert.equal(restarted.challenge.seed, game.challenge.seed);
  assert.deepEqual(restarted.ball, game.ball);
  assert.equal(restarted.personalBest, 18);
  assert.equal(restarted.bestScore, 18);
});

test("result summaries expose campaign depth and personal-best status", () => {
  const game = createFullscreenHandBounceGame(960, 720, {
    seed: 7,
    personalBest: 9,
  });
  const result = getFullscreenHandBounceResultStats({
    ...game,
    status: "gameover",
    outcome: "victory",
    score: 14,
    saveCount: 8,
    stage: 3,
    lives: 1,
    stats: {
      stagesCleared: 3,
      targetHits: 5,
      trickShots: 4,
      bestCombo: 6,
      drops: 1,
      powerUpsActivated: 2,
      focusEarned: 220,
    },
  });

  assert.deepEqual(
    {
      outcome: result.outcome,
      score: result.score,
      personalBest: result.personalBest,
      newPersonalBest: result.newPersonalBest,
      stagesCleared: result.stagesCleared,
      targetHits: result.targetHits,
      trickShots: result.trickShots,
      bestCombo: result.bestCombo,
    },
    {
      outcome: "victory",
      score: 14,
      personalBest: 14,
      newPersonalBest: true,
      stagesCleared: 3,
      targetHits: 5,
      trickShots: 4,
      bestCombo: 6,
    },
  );
});
