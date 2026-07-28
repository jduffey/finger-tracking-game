import test from "node:test";
import assert from "node:assert/strict";

import {
  BEST_METRIC_COMPARISONS,
  createInitialGameProgression,
  recordGameResult,
} from "../src/gameProgression.js";
import {
  FULLSCREEN_RESULT_MODE_IDS,
  createFullscreenGameResult,
  createSpatialMemoryResult,
  createWhackAMoleResult,
} from "../src/gameResultAdapters.js";
import { MODE_REGISTRY } from "../src/modeRegistry.js";

const STARTED_AT = "2026-07-01T12:00:00.000Z";
const ENDED_AT = "2026-07-01T12:02:00.000Z";

const TERMINAL_STATES = Object.freeze({
  "sky-patrol": {
    status: "gameover",
    outcome: "victory",
    score: 840,
    targetsDestroyed: 9,
    mission: 4,
    totalMissions: 4,
    lives: 2,
    layout: { width: 800, height: 600 },
    result: {
      outcome: "victory",
      score: 840,
      missionReached: 4,
      missionsCleared: 4,
      targetsDestroyed: 9,
      accuracy: 72,
      bestCombo: 6,
      powerUpsCollected: 3,
      livesRemaining: 2,
    },
    elapsedMs: 82_000,
  },
  "fruit-ninja": {
    status: "gameover",
    endReason: "round-complete",
    score: 350,
    comboCount: 4,
    bestCombo: 8,
    lives: 2,
    stats: {
      fruitSliced: 18,
      perfectSlices: 3,
      greatSlices: 6,
      goodSlices: 3,
      bombsHit: 1,
      wavesReached: 5,
      bestCombo: 8,
    },
    elapsedMs: 61_000,
  },
  "missile-command": {
    status: "game_over",
    score: 1_200,
    threatsStopped: 12,
    outcome: "victory",
    wavesCleared: 5,
    citiesSurviving: 4,
    accuracy: 75,
    perfectWaves: 2,
    elapsedMs: 95_000,
  },
  "brick-dodger": {
    status: "gameover",
    score: 975,
    survivalMs: 48_000,
    elapsedMs: 50_000,
    stage: 4,
    stagesCleared: 3,
    nearMisses: 18,
    bestMultiplier: 3,
    pickupsCollected: 7,
  },
  "hand-bounce": {
    status: "gameover",
    score: 14,
    saveCount: 14,
    elapsedMs: 31_000,
  },
  breakout: {
    status: "cleared",
    score: 5_400,
    level: 2,
    lives: 2,
    bricks: [{ destroyed: true }, { destroyed: true }, { destroyed: false }],
  },
  "breakout-coop": {
    status: "cleared",
    score: 7_250,
    lives: 1,
    bricks: [{ destroyed: true }, { destroyed: true }],
    shield: { saves: 4, activations: 3 },
  },
  "finger-pong": {
    status: "won",
    score: 7,
    opponentScore: 4,
    bestRally: 13,
  },
  "tic-tac-toe": {
    status: "player-win",
    board: ["X", "O", "X", "O", "X", null, "X", "O", null],
  },
  invaders: {
    status: "gameover",
    score: 4_000,
    wave: 3,
    lives: 0,
    enemies: [
      { alive: false },
      { alive: false },
      { alive: false },
    ],
    layout: { width: 800 },
    stats: {
      enemiesDestroyed: 18,
      wavesCleared: 2,
      shotsFired: 24,
      enemyShotsFired: 10,
      ufoHits: 2,
      powerUpsCollected: 1,
      livesLost: 3,
      elapsedMs: 120_000,
      bestWave: 3,
    },
  },
  flappy: {
    status: "gameover",
    score: 8,
    layout: { width: 800 },
    stats: {
      pipesCleared: 8,
      centerBonuses: 3,
      centerStreak: 0,
      bestCenterStreak: 2,
      flaps: 14,
      elapsedMs: 30_000,
      maxDifficultyLevel: 2,
    },
  },
});

const ACTIVE_STATES = Object.freeze({
  "sky-patrol": { status: "playing" },
  "fruit-ninja": { status: "running" },
  "missile-command": { status: "countdown" },
  "brick-dodger": { status: "playing" },
  "hand-bounce": { status: "playing" },
  breakout: { status: "countdown" },
  classic: { status: "playing" },
  "find-your-grind-breakout": { status: "playing" },
  "breakout-coop": { status: "playing" },
  "finger-pong": { status: "countdown" },
  "tic-tac-toe": { status: "player-turn" },
  invaders: { status: "playing" },
  flappy: { status: "ready" },
});

test("fullscreen adapter coverage stays in sync with every result-capable registry mode", () => {
  const expectedModeIds = MODE_REGISTRY.filter(
    (mode) =>
      mode.entryKind === "fullscreen-mode" &&
      mode.supportsResults &&
      mode.fullscreenMode,
  )
    .flatMap((mode) => [mode.fullscreenMode, ...(mode.variants ?? [])])
    .sort();

  assert.deepEqual(FULLSCREEN_RESULT_MODE_IDS, expectedModeIds);
  assert.deepEqual(Object.keys(TERMINAL_STATES).sort(), [
    ...new Set(
      MODE_REGISTRY.filter(
        (mode) =>
          mode.entryKind === "fullscreen-mode" &&
          mode.supportsResults &&
          mode.fullscreenMode,
      ).map((mode) => mode.fullscreenMode),
    ),
  ].sort());
});

test("every supported fullscreen adapter returns null until its state is terminal", () => {
  for (const fullscreenMode of FULLSCREEN_RESULT_MODE_IDS) {
    assert.equal(
      createFullscreenGameResult({
        fullscreenMode,
        state: ACTIVE_STATES[fullscreenMode],
      }),
      null,
      `${fullscreenMode} should not emit a result while active`,
    );
  }
});

test("terminal fullscreen modes map to stable mode ids and semantic outcomes", () => {
  const expected = {
    "sky-patrol": { modeId: "sky-patrol", outcome: "won", score: 840 },
    "fruit-ninja": { modeId: "slice-air", outcome: "completed", score: 350 },
    "missile-command": { modeId: "missile-command", outcome: "won", score: 1_200 },
    "brick-dodger": { modeId: "brick-dodger", outcome: "completed", score: 975 },
    "hand-bounce": { modeId: "hand-bounce", outcome: "completed", score: 14 },
    breakout: { modeId: "breakout", outcome: "won", score: 5_400 },
    "breakout-coop": { modeId: "breakout-coop", outcome: "won", score: 7_250 },
    "finger-pong": { modeId: "finger-pong", outcome: "won", score: 7 },
    "tic-tac-toe": { modeId: "tic-tac-toe", outcome: "won", score: 1 },
    invaders: { modeId: "invaders", outcome: "lost", score: 4_000 },
    flappy: { modeId: "flappy", outcome: "completed", score: 8 },
  };

  for (const [fullscreenMode, state] of Object.entries(TERMINAL_STATES)) {
    const result = createFullscreenGameResult({
      fullscreenMode,
      state,
      sessionId: `terminal-${fullscreenMode}`,
      startedAt: STARTED_AT,
      endedAt: ENDED_AT,
      durationMs: 120_000,
    });
    assert.equal(result.modeId, expected[fullscreenMode].modeId, fullscreenMode);
    assert.equal(result.outcome, expected[fullscreenMode].outcome, fullscreenMode);
    assert.equal(result.score, expected[fullscreenMode].score, fullscreenMode);
    assert.equal(result.startedAt, STARTED_AT);
    assert.equal(result.endedAt, ENDED_AT);
    assert.equal(result.durationMs, 120_000);
    assert.equal(
      result.metricComparisons.score,
      BEST_METRIC_COMPARISONS.HIGHER,
      fullscreenMode,
    );
  }
});

test("fullscreen results expose useful mode-specific secondary metrics", () => {
  const resultFor = (fullscreenMode) =>
    createFullscreenGameResult({
      fullscreenMode,
      state: TERMINAL_STATES[fullscreenMode],
      sessionId: `metrics-${fullscreenMode}`,
      durationMs: 120_000,
    });

  assert.deepEqual(resultFor("sky-patrol").metrics, {
    score: 840,
    missionReached: 4,
    missionsCleared: 4,
    targetsDestroyed: 9,
    accuracyPercent: 72,
    bestCombo: 6,
    powerUpsCollected: 3,
    livesRemaining: 2,
    survivalMs: 120_000,
  });
  assert.deepEqual(resultFor("fruit-ninja").metrics, {
    score: 350,
    fruitSliced: 18,
    bestCombo: 8,
    precisionPercent: 75,
    bombsHit: 1,
    wavesReached: 5,
    livesRemaining: 2,
    survivalMs: 120_000,
  });
  assert.deepEqual(resultFor("missile-command").metrics, {
    score: 1_200,
    threatsStopped: 12,
    wavesCleared: 5,
    citiesSurviving: 4,
    accuracyPercent: 75,
    perfectWaves: 2,
    survivalMs: 120_000,
  });
  assert.deepEqual(resultFor("brick-dodger").metrics, {
    score: 975,
    stage: 4,
    stagesCleared: 3,
    nearMisses: 18,
    bestMultiplier: 3,
    pickups: 7,
    survivalMs: 120_000,
  });
  assert.deepEqual(resultFor("hand-bounce").metrics, {
    score: 14,
    saves: 14,
    survivalMs: 120_000,
  });

  const breakout = resultFor("breakout");
  assert.deepEqual(breakout.metrics, {
    score: 5_400,
    bricksCleared: 2,
    level: 2,
    livesRemaining: 2,
    clearTimeMs: 120_000,
  });
  assert.equal(
    breakout.metricComparisons.clearTimeMs,
    BEST_METRIC_COMPARISONS.LOWER,
  );

  const coop = resultFor("breakout-coop");
  assert.deepEqual(coop.metrics, {
    score: 7_250,
    bricksCleared: 2,
    livesRemaining: 1,
    shieldSaves: 4,
    shieldActivations: 3,
    clearTimeMs: 120_000,
  });

  const pong = resultFor("finger-pong");
  assert.deepEqual(pong.metrics, {
    score: 7,
    opponentScore: 4,
    bestRally: 13,
    pointDifferential: 3,
  });
  assert.equal(
    pong.metricComparisons.opponentScore,
    BEST_METRIC_COMPARISONS.LOWER,
  );

  const ticTacToe = resultFor("tic-tac-toe");
  assert.deepEqual(ticTacToe.metrics, {
    score: 1,
    roundPoints: 1,
    movesPlayed: 7,
    playerMoves: 4,
    opponentMoves: 3,
    movesToWin: 4,
  });
  assert.equal(
    ticTacToe.metricComparisons.movesToWin,
    BEST_METRIC_COMPARISONS.LOWER,
  );

  const invaders = resultFor("invaders");
  assert.deepEqual(invaders.metrics, {
    score: 4_000,
    wave: 3,
    wavesCleared: 2,
    enemiesDestroyed: 18,
    accuracyPercent: 83,
    ufoHits: 2,
    powerUpsCollected: 1,
    livesRemaining: 0,
  });
  assert.deepEqual(resultFor("flappy").metrics, {
    score: 8,
    pipesCleared: 8,
    centerBonuses: 3,
    bestCenterStreak: 2,
    flaps: 14,
    difficultyLevel: 2,
  });
});

test("an Invaders wave clear is an intermission, not a terminal result", () => {
  assert.equal(
    createFullscreenGameResult({
      fullscreenMode: "invaders",
      state: { status: "cleared", score: 400, layout: { width: 800 } },
      sessionId: "invaders-wave-clear",
    }),
    null,
  );
});

test("loss and draw terminal variants remain distinct", () => {
  const cases = [
    [
      "sky-patrol",
      {
        status: "gameover",
        outcome: "defeat",
        score: 300,
        layout: { width: 800 },
      },
      "lost",
    ],
    ["breakout", { status: "gameover", score: 400, lives: 0 }, "lost"],
    ["breakout-coop", { status: "gameover", score: 700, lives: 0 }, "lost"],
    ["finger-pong", { status: "lost", score: 3, opponentScore: 7 }, "lost"],
    ["tic-tac-toe", { status: "ai-win", board: ["O", "X", null] }, "lost"],
    ["tic-tac-toe", { status: "draw", board: Array(9).fill("X") }, "draw"],
    ["invaders", { status: "gameover", score: 250, enemies: [] }, "lost"],
  ];

  cases.forEach(([fullscreenMode, state, outcome], index) => {
    const result = createFullscreenGameResult({
      fullscreenMode,
      state,
      sessionId: `outcome-${index}`,
    });
    assert.equal(result.outcome, outcome);
    if (outcome === "lost") {
      assert.equal(result.metrics.clearTimeMs, undefined);
    }
  });
});

test("Breakout variants aggregate under one mode while preserving branded context", () => {
  const result = createFullscreenGameResult({
    fullscreenMode: "find-your-grind-breakout",
    state: {
      ...TERMINAL_STATES.breakout,
      variant: "find-your-grind-breakout",
    },
    sessionId: "grind-clear",
    durationMs: 80_000,
    context: { difficulty: "normal" },
  });

  assert.equal(result.modeId, "breakout");
  assert.deepEqual(result.context, {
    difficulty: "normal",
    fullscreenMode: "breakout",
    variant: "find-your-grind-breakout",
  });

  const recorded = recordGameResult(
    createInitialGameProgression({ now: STARTED_AT }),
    result,
    { now: ENDED_AT },
  );
  assert.equal(recorded.result.modeId, "breakout");
  assert.equal(recorded.progress.modes.breakout.bestByMetric.clearTimeMs.value, 80_000);
  assert.equal(
    recorded.progress.modes.breakout.bestByMetric.clearTimeMs.comparison,
    BEST_METRIC_COMPARISONS.LOWER,
  );
});

test("Whack-a-Mole emits only a completed timed-round summary", () => {
  assert.equal(
    createWhackAMoleResult({
      summary: { gameRunning: true, timeLeft: 0, score: 4 },
    }),
    null,
  );
  assert.equal(
    createWhackAMoleResult({
      summary: { gameRunning: false, timeLeft: 30, score: 0 },
    }),
    null,
  );

  const result = createWhackAMoleResult({
    sessionId: "whack-round-1",
    summary: {
      gameRunning: false,
      timeLeft: 0,
      score: 5,
      hits: 5,
      attempts: 8,
      misses: 3,
      averageHitTimeMs: 410,
      fastestHitMs: 245,
      bestStreak: 4,
      goldHits: 1,
      decoyHits: 1,
      decoysAvoided: 2,
    },
    startedAt: STARTED_AT,
    endedAt: ENDED_AT,
    durationMs: 30_000,
  });

  assert.deepEqual(result, {
    sessionId: "whack-round-1",
    modeId: "whack-a-mole",
    outcome: "completed",
    score: 5,
    metrics: {
      score: 5,
      hits: 5,
      targetsShown: 8,
      misses: 3,
      accuracyPercent: 62.5,
      averageHitTimeMs: 410,
      fastestHitMs: 245,
      bestStreak: 4,
      goldHits: 1,
      decoyHits: 1,
      decoysAvoided: 2,
    },
    metricComparisons: {
      score: "higher",
      hits: "higher",
      targetsShown: "higher",
      misses: "lower",
      accuracyPercent: "higher",
      averageHitTimeMs: "lower",
      fastestHitMs: "lower",
      bestStreak: "higher",
      goldHits: "higher",
      decoyHits: "lower",
      decoysAvoided: "higher",
    },
    context: {
      roundType: "timed",
    },
    startedAt: STARTED_AT,
    endedAt: ENDED_AT,
    durationMs: 30_000,
  });
});

test("Gesture Memory records round outcome, recognition quality, and difficulty", () => {
  assert.equal(
    createSpatialMemoryResult({
      state: { status: "playing" },
      sessionId: "memory-active",
    }),
    null,
  );

  const result = createSpatialMemoryResult({
    sessionId: "memory-round-4",
    state: {
      status: "completed",
      score: 1_480,
      round: 4,
      sequenceLength: 5,
      correctSteps: 5,
      attempts: 6,
      accuracy: 5 / 6,
      smoothness: 0.72,
      elapsedSeconds: 8.4,
      difficultyLevel: 5,
    },
  });

  assert.equal(result.modeId, "spatial-memory");
  assert.equal(result.outcome, "won");
  assert.equal(result.durationMs, 8_400);
  assert.deepEqual(result.metrics, {
    score: 1_480,
    round: 4,
    sequenceLength: 5,
    correctSteps: 5,
    attempts: 6,
    accuracyPercent: (5 / 6) * 100,
    smoothnessPercent: 72,
  });
  assert.deepEqual(result.context, { difficultyLevel: 5 });
});

test("unsupported modes stay null and terminal results require a safe session id", () => {
  assert.equal(
    createFullscreenGameResult({
      fullscreenMode: "rings",
      state: { status: "gameover" },
    }),
    null,
  );
  assert.throws(
    () =>
      createFullscreenGameResult({
        fullscreenMode: "flappy",
        state: TERMINAL_STATES.flappy,
      }),
    /sessionId/,
  );
  assert.throws(
    () =>
      createWhackAMoleResult({
        sessionId: "not safe",
        summary: { completed: true, score: 1 },
      }),
    /sessionId/,
  );
});
