import test from "node:test";
import assert from "node:assert/strict";

import {
  BEST_METRIC_COMPARISONS,
  GAME_PROGRESS_MAX_PROCESSED_SESSIONS,
  GAME_PROGRESS_MAX_RECENT_RESULTS,
  GAME_PROGRESS_SCHEMA_VERSION,
  UnsupportedGameProgressVersionError,
  abandonGameSession,
  beginGameSession,
  createInitialGameProgression,
  createMetricAchievement,
  createSessionMilestoneAchievement,
  createWinStreakAchievement,
  getBestMetric,
  getModeProgress,
  migrateGameProgression,
  recordGameResult,
} from "../src/gameProgression.js";

const DAY_ONE = "2026-07-01T12:00:00.000Z";

test("session starts are idempotent and count play days once", () => {
  let progress = createInitialGameProgression({ now: DAY_ONE });
  progress = beginGameSession(progress, {
    sessionId: "session-one",
    modeId: "finger-pong",
    startedAt: DAY_ONE,
  });

  assert.equal(progress.revision, 1);
  assert.equal(progress.totals.sessionsPlayed, 1);
  assert.equal(progress.totals.activeDays, 1);
  assert.equal(progress.totals.currentDayStreak, 1);
  assert.equal(progress.modes["finger-pong"].sessionsPlayed, 1);

  const duplicate = beginGameSession(progress, {
    sessionId: "session-one",
    modeId: "finger-pong",
    startedAt: "2026-07-01T13:00:00.000Z",
  });
  assert.equal(duplicate.revision, progress.revision);
  assert.equal(duplicate.totals.sessionsPlayed, 1);

  progress = beginGameSession(duplicate, {
    sessionId: "session-two",
    modeId: "breakout",
    startedAt: "2026-07-01T14:00:00.000Z",
  });
  assert.equal(progress.totals.sessionsPlayed, 2);
  assert.equal(progress.totals.activeDays, 1);
});

test("recording a result updates last result, personal bests, counters, and deduplicates", () => {
  let progress = beginGameSession(
    createInitialGameProgression({ now: DAY_ONE }),
    {
      sessionId: "pong-1",
      modeId: "finger-pong",
      startedAt: DAY_ONE,
      context: { difficulty: "normal" },
    },
  );

  const recorded = recordGameResult(progress, {
    sessionId: "pong-1",
    modeId: "finger-pong",
    outcome: "won",
    score: 12,
    metrics: { rally: 18 },
    endedAt: "2026-07-01T12:02:00.000Z",
    context: { level: 3 },
  });
  progress = recorded.progress;

  assert.equal(recorded.implicitSession, false);
  assert.deepEqual(
    recorded.personalBests.map(({ metricId, previousValue }) => ({
      metricId,
      previousValue,
    })),
    [
      { metricId: "rally", previousValue: null },
      { metricId: "score", previousValue: null },
    ],
  );
  assert.equal(progress.totals.completedSessions, 1);
  assert.equal(progress.totals.wins, 1);
  assert.equal(progress.totals.playTimeMs, 120_000);
  assert.equal(progress.modes["finger-pong"].lastResult.score, 12);
  assert.deepEqual(progress.modes["finger-pong"].lastResult.context, {
    difficulty: "normal",
    level: 3,
  });
  assert.equal(getBestMetric(progress, "finger-pong").value, 12);
  assert.equal(getBestMetric(progress, "finger-pong", "rally").value, 18);
  assert.equal(progress.activeSessions["pong-1"], undefined);

  const duplicate = recordGameResult(progress, {
    sessionId: "pong-1",
    modeId: "finger-pong",
    outcome: "lost",
    score: 999,
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.progress.revision, progress.revision);
  assert.equal(duplicate.progress.totals.completedSessions, 1);
  assert.equal(getBestMetric(duplicate.progress, "finger-pong").value, 12);
});

test("implicit sessions work and lower-is-better metrics retain their comparison", () => {
  const initial = createInitialGameProgression({ now: DAY_ONE });
  const first = recordGameResult(initial, {
    sessionId: "race-1",
    modeId: "runner",
    outcome: "completed",
    metrics: { finishTimeMs: 5_000 },
    metricComparisons: { finishTimeMs: BEST_METRIC_COMPARISONS.LOWER },
    startedAt: DAY_ONE,
    endedAt: "2026-07-01T12:00:05.000Z",
  });
  const slower = recordGameResult(first.progress, {
    sessionId: "race-2",
    modeId: "runner",
    outcome: "completed",
    metrics: { finishTimeMs: 5_500 },
    metricComparisons: { finishTimeMs: BEST_METRIC_COMPARISONS.HIGHER },
    startedAt: "2026-07-01T13:00:00.000Z",
    endedAt: "2026-07-01T13:00:06.000Z",
  });
  const faster = recordGameResult(slower.progress, {
    sessionId: "race-3",
    modeId: "runner",
    outcome: "completed",
    metrics: { finishTimeMs: 4_500 },
    startedAt: "2026-07-01T14:00:00.000Z",
    endedAt: "2026-07-01T14:00:05.000Z",
  });

  assert.equal(first.implicitSession, true);
  assert.equal(slower.personalBests.length, 0);
  assert.equal(faster.personalBests[0].previousValue, 5_000);
  assert.deepEqual(getBestMetric(faster.progress, "runner", "finishTimeMs"), {
    value: 4_500,
    comparison: BEST_METRIC_COMPARISONS.LOWER,
    achievedAt: "2026-07-01T14:00:05.000Z",
    sessionId: "race-3",
  });
  assert.equal(faster.progress.totals.sessionsPlayed, 3);
});

test("win and daily streaks advance, reset, and ignore backdated play", () => {
  let progress = createInitialGameProgression({ now: DAY_ONE });
  for (const [sessionId, day, outcome] of [
    ["win-1", "2026-07-01T08:00:00.000Z", "won"],
    ["win-2", "2026-07-02T08:00:00.000Z", "won"],
    ["loss-1", "2026-07-04T08:00:00.000Z", "lost"],
    ["old-win", "2026-07-03T08:00:00.000Z", "won"],
  ]) {
    progress = recordGameResult(progress, {
      sessionId,
      modeId: "breakout",
      outcome,
      startedAt: day,
      endedAt: day,
    }).progress;
  }

  const mode = getModeProgress(progress, "breakout");
  assert.equal(mode.currentWinStreak, 1);
  assert.equal(mode.longestWinStreak, 2);
  assert.equal(progress.totals.activeDays, 3);
  assert.equal(progress.totals.currentDayStreak, 1);
  assert.equal(progress.totals.longestDayStreak, 2);
  assert.equal(progress.totals.lastPlayedDay, "2026-07-04");
});

test("abandoning an active session records time but not a score or win-streak reset", () => {
  let progress = recordGameResult(
    createInitialGameProgression({ now: DAY_ONE }),
    {
      sessionId: "win-first",
      modeId: "invaders",
      outcome: "won",
      score: 30,
      startedAt: DAY_ONE,
      endedAt: DAY_ONE,
    },
  ).progress;
  progress = beginGameSession(progress, {
    sessionId: "quit-later",
    modeId: "invaders",
    startedAt: "2026-07-01T13:00:00.000Z",
  });

  const abandoned = abandonGameSession(progress, {
    sessionId: "quit-later",
    endedAt: "2026-07-01T13:00:30.000Z",
    context: { reason: "home" },
  });
  const mode = getModeProgress(abandoned.progress, "invaders");

  assert.equal(mode.abandonedSessions, 1);
  assert.equal(mode.completedSessions, 1);
  assert.equal(mode.currentWinStreak, 1);
  assert.equal(mode.lastResult.outcome, "abandoned");
  assert.equal(mode.lastResult.durationMs, 30_000);
  assert.equal(getBestMetric(abandoned.progress, "invaders").value, 30);
});

test("achievement definitions unlock once and failed custom rules are isolated", () => {
  const definitions = [
    createSessionMilestoneAchievement({ id: "played-two", count: 2 }),
    createWinStreakAchievement({
      id: "pong-two-wins",
      count: 2,
      modeId: "finger-pong",
    }),
    createMetricAchievement({
      id: "score-ten",
      threshold: 10,
      modeId: "finger-pong",
    }),
    {
      id: "broken-rule",
      evaluate() {
        throw new Error("optional rule failed");
      },
    },
  ];
  const first = recordGameResult(
    createInitialGameProgression({ now: DAY_ONE }),
    {
      sessionId: "achievement-1",
      modeId: "finger-pong",
      outcome: "won",
      score: 12,
      endedAt: DAY_ONE,
    },
    { achievementDefinitions: definitions },
  );
  const second = recordGameResult(
    first.progress,
    {
      sessionId: "achievement-2",
      modeId: "finger-pong",
      outcome: "won",
      score: 8,
      endedAt: "2026-07-01T13:00:00.000Z",
    },
    { achievementDefinitions: definitions },
  );
  const third = recordGameResult(
    second.progress,
    {
      sessionId: "achievement-3",
      modeId: "finger-pong",
      outcome: "lost",
      score: 4,
      endedAt: "2026-07-01T14:00:00.000Z",
    },
    { achievementDefinitions: definitions },
  );

  assert.deepEqual(first.achievementUnlocks.map(({ id }) => id), ["score-ten"]);
  assert.deepEqual(second.achievementUnlocks.map(({ id }) => id), [
    "played-two",
    "pong-two-wins",
  ]);
  assert.deepEqual(third.achievementUnlocks, []);
  assert.deepEqual(Object.keys(third.progress.achievements.unlocked).sort(), [
    "played-two",
    "pong-two-wins",
    "score-ten",
  ]);
});

test("legacy migrations are deterministic and preserve useful history", () => {
  const legacy = {
    totalSessions: 4,
    currentStreak: 2,
    longestStreak: 3,
    lastPlayedDay: "2026-06-30",
    games: {
      "finger-pong": {
        sessionsPlayed: 4,
        highScore: 17,
        lastScore: 9,
        lastPlayedAt: "2026-06-30T20:00:00.000Z",
      },
    },
    achievements: ["first-game"],
  };
  const options = { now: "2026-07-01T00:00:00.000Z" };
  const migrated = migrateGameProgression(legacy, options);

  assert.deepEqual(migrateGameProgression(legacy, options), migrated);
  assert.equal(migrated.version, GAME_PROGRESS_SCHEMA_VERSION);
  assert.equal(migrated.totals.sessionsPlayed, 4);
  assert.equal(migrated.totals.currentDayStreak, 2);
  assert.equal(getBestMetric(migrated, "finger-pong").value, 17);
  assert.equal(migrated.modes["finger-pong"].lastResult.score, 9);
  assert.equal(migrated.recentResults[0].sessionId, "legacy-finger-pong");
  assert.ok(migrated.achievements.unlocked["first-game"]);
});

test("normalization rejects unsafe keys and future schema versions", () => {
  const unsafe = JSON.parse(`{
    "version": 2,
    "totals": {"sessionsPlayed": -4, "playTimeMs": 999999999},
    "modes": {
      "__proto__": {"sessionsPlayed": 9},
      "safe-mode": {"sessionsPlayed": 2, "playTimeMs": 90000000}
    }
  }`);
  const normalized = migrateGameProgression(unsafe, { now: DAY_ONE });

  assert.equal(Object.hasOwn(normalized.modes, "__proto__"), false);
  assert.equal(normalized.totals.sessionsPlayed, 2);
  assert.equal(normalized.totals.playTimeMs, 999_999_999);
  assert.equal(normalized.modes["safe-mode"].playTimeMs, 90_000_000);
  assert.throws(
    () => migrateGameProgression({ version: 99 }, { now: DAY_ONE }),
    UnsupportedGameProgressVersionError,
  );
});

test("recent result details and processed session ids stay bounded", () => {
  let progress = createInitialGameProgression({ now: DAY_ONE });
  const resultCount = GAME_PROGRESS_MAX_PROCESSED_SESSIONS + 8;
  for (let index = 0; index < resultCount; index += 1) {
    progress = recordGameResult(progress, {
      sessionId: `bounded-${index}`,
      modeId: "hand-bounce",
      outcome: "completed",
      score: index,
      endedAt: DAY_ONE,
    }).progress;
  }

  assert.equal(progress.recentResults.length, GAME_PROGRESS_MAX_RECENT_RESULTS);
  assert.equal(
    progress.processedSessionIds.length,
    GAME_PROGRESS_MAX_PROCESSED_SESSIONS,
  );
  assert.equal(progress.recentResults[0].sessionId, `bounded-${resultCount - 1}`);
  assert.equal(progress.recentResults.at(-1).sessionId, `bounded-${resultCount - 20}`);
  assert.equal(progress.processedSessionIds.includes("bounded-0"), false);
});
