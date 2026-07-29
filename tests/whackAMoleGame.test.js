import test from "node:test";
import assert from "node:assert/strict";

import {
  WHACK_A_MOLE_ACTIONS,
  WHACK_A_MOLE_PHASES,
  WHACK_A_MOLE_TARGET_STATES,
  WHACK_A_MOLE_TARGET_TYPES,
  createDailyWhackAMoleSeed,
  createWhackAMoleGame,
  getWhackAMoleDifficulty,
  getWhackAMoleStats,
  getWhackAMoleSummary,
  hitWhackAMoleHole,
  normalizeWhackAMoleConfig,
  pauseWhackAMoleGame,
  reduceWhackAMoleGame,
  resumeWhackAMoleGame,
  tickWhackAMoleGame,
} from "../src/whackAMoleGame.js";

const FAST_CONFIG = {
  teachDurationMs: 0,
  countdownDurationMs: 0,
  roundDurationMs: 5_000,
};

function createPlaying(seed = "test-seed", now = 0) {
  return createWhackAMoleGame({
    autoStart: true,
    seed,
    now,
    config: FAST_CONFIG,
  });
}

function activateFirstTarget(state) {
  assert.equal(state.target.state, WHACK_A_MOLE_TARGET_STATES.TELEGRAPH);
  return tickWhackAMoleGame(state, {
    now: state.lastTickAt + state.target.activeAt - state.elapsedMs,
  });
}

function forceTargetType(state, type) {
  return {
    ...state,
    target: {
      ...state.target,
      type,
      state: WHACK_A_MOLE_TARGET_STATES.ACTIVE,
    },
  };
}

test("a round teaches, counts down, then starts with late-tick carryover", () => {
  const initial = createWhackAMoleGame({
    autoStart: true,
    now: 1_000,
    config: {
      teachDurationMs: 1_000,
      countdownDurationMs: 2_000,
      roundDurationMs: 8_000,
    },
  });

  assert.equal(initial.phase, WHACK_A_MOLE_PHASES.TEACH);
  assert.equal(initial.phaseRemainingMs, 1_000);

  const countdown = tickWhackAMoleGame(initial, { now: 2_500 });
  assert.equal(countdown.phase, WHACK_A_MOLE_PHASES.COUNTDOWN);
  assert.equal(countdown.phaseRemainingMs, 1_500);

  const playing = tickWhackAMoleGame(countdown, { now: 4_650 });
  assert.equal(playing.phase, WHACK_A_MOLE_PHASES.PLAYING);
  assert.equal(playing.elapsedMs, 650);
  assert.equal(playing.remainingMs, 7_350);
  assert.equal(playing.target.state, WHACK_A_MOLE_TARGET_STATES.ACTIVE);
});

test("zero-duration setup enters play immediately with a telegraphed target", () => {
  const state = createPlaying();
  assert.equal(state.phase, WHACK_A_MOLE_PHASES.PLAYING);
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.target.state, WHACK_A_MOLE_TARGET_STATES.TELEGRAPH);
  assert.equal(state.targetsShown, 0);

  const active = activateFirstTarget(state);
  assert.equal(active.target.state, WHACK_A_MOLE_TARGET_STATES.ACTIVE);
  assert.equal(active.targetsShown, 1);
});

test("difficulty ramps smoothly and preserves playable timing windows", () => {
  const early = getWhackAMoleDifficulty(0, 30_000);
  const middle = getWhackAMoleDifficulty(15_000, 30_000);
  const late = getWhackAMoleDifficulty(30_000, 30_000);

  assert.equal(early.tier, 1);
  assert.equal(late.tier, 4);
  assert.ok(early.telegraphMs > middle.telegraphMs);
  assert.ok(middle.telegraphMs > late.telegraphMs);
  assert.ok(early.visibleMs > late.visibleMs);
  assert.ok(early.spawnDelayMinMs > late.spawnDelayMinMs);
  assert.ok(early.decoyChance < late.decoyChance);
  assert.ok(late.telegraphMs >= 200);
  assert.ok(late.visibleMs >= 500);
});

test("matching seeds produce matching target sequences", () => {
  function sequenceFor(seed) {
    let state = createWhackAMoleGame({
      autoStart: true,
      seed,
      now: 0,
      config: {
        ...FAST_CONFIG,
        roundDurationMs: 20_000,
      },
    });
    const sequence = [];
    for (let index = 0; index < 4; index += 1) {
      state = tickWhackAMoleGame(state, { now: state.target.activeAt });
      sequence.push([state.target.holeIndex, state.target.type]);
      state = tickWhackAMoleGame(state, {
        now: state.target.expiresAt,
      });
      state = tickWhackAMoleGame(state, { now: state.nextSpawnAt });
    }
    return sequence;
  }

  assert.deepEqual(sequenceFor("repeatable"), sequenceFor("repeatable"));
  assert.notDeepEqual(sequenceFor("repeatable"), sequenceFor("different"));
});

test("daily seeds are stable per UTC date and challenge", () => {
  assert.equal(
    createDailyWhackAMoleSeed("2026-07-28", "rush"),
    createDailyWhackAMoleSeed(
      new Date("2026-07-28T23:59:00.000Z"),
      "rush",
    ),
  );
  assert.notEqual(
    createDailyWhackAMoleSeed("2026-07-28", "rush"),
    createDailyWhackAMoleSeed("2026-07-29", "rush"),
  );
  assert.notEqual(
    createDailyWhackAMoleSeed("2026-07-28", "rush"),
    createDailyWhackAMoleSeed("2026-07-28", "classic"),
  );
});

test("normal hits score reaction time and build streak bonuses", () => {
  let state = forceTargetType(
    activateFirstTarget(createPlaying("normal-hit")),
    WHACK_A_MOLE_TARGET_TYPES.NORMAL,
  );
  const firstHole = state.target.holeIndex;
  state = hitWhackAMoleHole(state, {
    holeIndex: firstHole,
    now: state.lastTickAt + 120,
    source: "keyboard",
  });

  assert.equal(state.hits, 1);
  assert.equal(state.score, state.config.normalPoints);
  assert.equal(state.streak, 1);
  assert.equal(state.bestStreak, 1);
  assert.equal(state.lastReactionMs, 120);
  assert.equal(state.lastAction.source, "keyboard");

  state = {
    ...state,
    target: {
      id: "forced-second",
      holeIndex: (firstHole + 1) % state.config.holeCount,
      type: WHACK_A_MOLE_TARGET_TYPES.NORMAL,
      state: WHACK_A_MOLE_TARGET_STATES.ACTIVE,
      activeAt: state.elapsedMs,
      expiresAt: state.elapsedMs + 800,
    },
  };
  state = hitWhackAMoleHole(state, {
    holeIndex: state.target.holeIndex,
    now: state.lastTickAt + 80,
  });

  assert.equal(state.hits, 2);
  assert.equal(state.streak, 2);
  assert.equal(
    state.score,
    state.config.normalPoints * 2 + state.config.streakBonusStep,
  );
  assert.equal(getWhackAMoleStats(state).averageHitTimeMs, 100);
  assert.equal(getWhackAMoleStats(state).fastestHitMs, 80);
});

test("gold targets award their premium plus the current streak bonus", () => {
  const active = forceTargetType(
    activateFirstTarget(createPlaying("gold-hit")),
    WHACK_A_MOLE_TARGET_TYPES.GOLD,
  );
  const state = hitWhackAMoleHole(
    { ...active, streak: 2 },
    {
      holeIndex: active.target.holeIndex,
      now: active.lastTickAt + 50,
    },
  );

  assert.equal(state.goldHits, 1);
  assert.equal(state.hits, 1);
  assert.equal(
    state.score,
    state.config.goldPoints + state.config.streakBonusStep * 2,
  );
});

test("hitting a decoy applies a penalty while safely ignoring it is rewarded", () => {
  const active = forceTargetType(
    activateFirstTarget(createPlaying("decoy-hit")),
    WHACK_A_MOLE_TARGET_TYPES.DECOY,
  );
  const hit = hitWhackAMoleHole(
    { ...active, score: 500, streak: 4 },
    {
      holeIndex: active.target.holeIndex,
      now: active.lastTickAt + 50,
    },
  );

  assert.equal(hit.score, 500 - hit.config.decoyPenalty);
  assert.equal(hit.decoyHits, 1);
  assert.equal(hit.misses, 1);
  assert.equal(hit.streak, 0);

  const ignoredStart = forceTargetType(
    activateFirstTarget(createPlaying("decoy-ignore")),
    WHACK_A_MOLE_TARGET_TYPES.DECOY,
  );
  const ignored = tickWhackAMoleGame(ignoredStart, {
    now:
      ignoredStart.lastTickAt +
      ignoredStart.target.expiresAt -
      ignoredStart.elapsedMs,
  });
  assert.equal(ignored.decoysAvoided, 1);
  assert.equal(ignored.misses, 0);
  assert.match(ignored.announcement, /restraint/i);
});

test("early, empty, and wrong-hole inputs count as misses without removing a target", () => {
  let state = createPlaying("misses");
  const targetId = state.target.id;
  state = hitWhackAMoleHole(state, {
    holeIndex: state.target.holeIndex,
    now: 1,
  });
  assert.equal(state.misses, 1);
  assert.equal(state.target.id, targetId);
  assert.match(state.announcement, /too soon/i);

  state = activateFirstTarget(state);
  const wrongHole =
    (state.target.holeIndex + 1) % state.config.holeCount;
  state = hitWhackAMoleHole(state, {
    holeIndex: wrongHole,
    now: state.lastTickAt + 1,
  });
  assert.equal(state.misses, 2);
  assert.equal(state.target.id, targetId);
  assert.match(state.announcement, /wrong hole/i);

  state = { ...state, target: null, nextSpawnAt: Number.POSITIVE_INFINITY };
  state = hitWhackAMoleHole(state, {
    holeIndex: 0,
    now: state.lastTickAt + 1,
  });
  assert.equal(state.misses, 3);
  assert.match(state.announcement, /empty hole/i);
});

test("accuracy includes misses and successful targets but not avoided decoys", () => {
  let state = createPlaying("accuracy");
  state = hitWhackAMoleHole(state, {
    holeIndex: state.target.holeIndex,
    now: 1,
  });
  state = forceTargetType(
    activateFirstTarget(state),
    WHACK_A_MOLE_TARGET_TYPES.NORMAL,
  );
  state = hitWhackAMoleHole(state, {
    holeIndex: state.target.holeIndex,
    now: state.lastTickAt + 10,
  });

  const stats = getWhackAMoleStats(state);
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.opportunities, 2);
  assert.equal(stats.accuracyPercent, 50);
});

test("pausing freezes active-round time and target timing", () => {
  let state = tickWhackAMoleGame(createPlaying("pause", 100), {
    now: 500,
  });
  assert.equal(state.elapsedMs, 400);
  const targetActiveAt = state.target.activeAt;

  state = pauseWhackAMoleGame(state, { now: 550 });
  assert.equal(state.phase, WHACK_A_MOLE_PHASES.PAUSED);
  assert.equal(state.elapsedMs, 450);
  assert.equal(tickWhackAMoleGame(state, { now: 9_000 }), state);

  state = resumeWhackAMoleGame(state, { now: 10_000 });
  assert.equal(state.phase, WHACK_A_MOLE_PHASES.PLAYING);
  state = tickWhackAMoleGame(state, { now: 10_069 });
  assert.equal(state.elapsedMs, 519);
  assert.equal(state.target.state, WHACK_A_MOLE_TARGET_STATES.TELEGRAPH);
  state = tickWhackAMoleGame(state, { now: 10_070 });
  assert.equal(state.elapsedMs, targetActiveAt);
  assert.equal(state.target.state, WHACK_A_MOLE_TARGET_STATES.ACTIVE);
});

test("pausing and resuming setup preserves its remaining duration", () => {
  let state = createWhackAMoleGame({
    autoStart: true,
    now: 100,
    config: {
      teachDurationMs: 2_000,
      countdownDurationMs: 1_000,
      roundDurationMs: 5_000,
    },
  });
  state = pauseWhackAMoleGame(state, { now: 600 });
  assert.equal(state.pausedPhase, WHACK_A_MOLE_PHASES.TEACH);
  assert.equal(state.pausedPhaseRemainingMs, 1_500);

  state = resumeWhackAMoleGame(state, { now: 10_000 });
  assert.equal(state.phase, WHACK_A_MOLE_PHASES.TEACH);
  assert.equal(tickWhackAMoleGame(state, { now: 11_499 }).phase, "teach");
  assert.equal(
    tickWhackAMoleGame(state, { now: 11_500 }).phase,
    WHACK_A_MOLE_PHASES.COUNTDOWN,
  );
});

test("the finite clock produces a result and adapter-ready summary", () => {
  const result = tickWhackAMoleGame(
    createWhackAMoleGame({
      autoStart: true,
      now: 0,
      seed: "finite",
      config: {
        teachDurationMs: 0,
        countdownDurationMs: 0,
        roundDurationMs: 1_000,
      },
    }),
    { now: 1_500 },
  );
  const summary = getWhackAMoleSummary(result);

  assert.equal(result.phase, WHACK_A_MOLE_PHASES.RESULT);
  assert.equal(result.remainingMs, 0);
  assert.equal(summary.completed, true);
  assert.equal(summary.status, "completed");
  assert.equal(summary.gameRunning, false);
  assert.equal(summary.timeLeft, 0);
  assert.equal(summary.durationMs, 1_000);
  assert.equal(summary.attempts, summary.hits + summary.misses);
  assert.deepEqual(result.result, {
    ...summary,
    outcome: "completed",
  });
});

test("configuration normalization clamps hostile values", () => {
  assert.deepEqual(
    normalizeWhackAMoleConfig({
      roundDurationMs: Number.POSITIVE_INFINITY,
      teachDurationMs: -50,
      countdownDurationMs: 99_999,
      holeCount: 100,
      normalPoints: 0,
      decoyPenalty: -1,
    }),
    {
      roundDurationMs: 30_000,
      teachDurationMs: 0,
      countdownDurationMs: 10_000,
      holeCount: 9,
      normalPoints: 1,
      goldPoints: 300,
      decoyPenalty: 0,
      streakBonusStep: 15,
      maxStreakBonus: 120,
    },
  );
});

test("the reducer API supports reset and leaves unknown actions unchanged", () => {
  const playing = createPlaying("reducer");
  assert.equal(
    reduceWhackAMoleGame(playing, { type: "not-a-real-action" }),
    playing,
  );
  const reset = reduceWhackAMoleGame(playing, {
    type: WHACK_A_MOLE_ACTIONS.RESET,
  });
  assert.equal(reset.phase, WHACK_A_MOLE_PHASES.IDLE);
  assert.equal(reset.score, 0);
  assert.equal(reset.seed, "reducer");
});
