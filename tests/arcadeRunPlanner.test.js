import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCADE_RUN_DURATIONS,
  ARCADE_RUN_LEG_STATUSES,
  ARCADE_RUN_MEDAL_TIERS,
  ARCADE_RUN_STATUSES,
  UnsupportedArcadeRunVersionError,
  advanceArcadeRun,
  completeArcadeRunLeg,
  createArcadeRunNextUpUiModel,
  createArcadeRunPlan,
  createArcadeRunSession,
  createArcadeRunSummaryUiModel,
  createDailyArcadeRunPlan,
  deserializeArcadeRunSession,
  getArcadeRunAggregate,
  getArcadeRunDayKey,
  getDailyArcadeRunSeed,
  listEligibleArcadeRunModes,
  pauseArcadeRun,
  resumeArcadeRun,
  retryArcadeRunLeg,
  serializeArcadeRunSession,
  skipArcadeRunLeg,
  startArcadeRun,
} from "../src/arcadeRunPlanner.js";

function mode({
  id,
  minutes,
  difficulty = "Medium",
  maturity = "supported",
  trackingProfile = "one-hand",
  pointer = true,
  players = 1,
  controlHint = "Point to steer",
  featured = false,
  dailyChallenge = false,
  area = "play",
  supportsResults = true,
} = {}) {
  return {
    id,
    label: id
      .split("-")
      .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
      .join(" "),
    path: `/play/${id}`,
    area,
    maturity,
    summary: `Play ${id}.`,
    objective: `Complete the ${id} objective.`,
    controlHint,
    typicalMinutes: minutes,
    difficulty,
    trackingProfile,
    supportsPointerFallback: pointer,
    supportsPause: true,
    supportsResults,
    players,
    featured,
    dailyChallenge,
  };
}

const PLAY_MODES = [
  mode({
    id: "warmup",
    minutes: 1,
    difficulty: "Easy",
    controlHint: "Point to hit",
  }),
  mode({
    id: "slice",
    minutes: 2,
    maturity: "flagship",
    difficulty: "Easy",
    controlHint: "Swipe to slice",
    featured: true,
    dailyChallenge: true,
  }),
  mode({
    id: "bounce",
    minutes: 2,
    difficulty: "Easy",
    controlHint: "Move your palm",
  }),
  mode({
    id: "flap",
    minutes: 2,
    difficulty: "Hard",
    controlHint: "Pinch to flap",
    dailyChallenge: true,
  }),
  mode({
    id: "pong",
    minutes: 3,
    controlHint: "Move left and right",
  }),
  mode({
    id: "invaders",
    minutes: 3,
    maturity: "flagship",
    difficulty: "Hard",
    controlHint: "Point to steer · Pinch to fire",
    featured: true,
  }),
  mode({
    id: "defense",
    minutes: 4,
    maturity: "flagship",
    controlHint: "Point to aim · Pinch to launch",
  }),
];

test("3, 5, and 10 minute plans are budget-aware, varied, and repeat-free", () => {
  const expectedLegCounts = new Map([
    [ARCADE_RUN_DURATIONS.QUICK, 2],
    [ARCADE_RUN_DURATIONS.MIX, 3],
    [ARCADE_RUN_DURATIONS.CIRCUIT, 4],
  ]);

  for (const durationMinutes of Object.values(ARCADE_RUN_DURATIONS)) {
    const plan = createArcadeRunPlan(PLAY_MODES, {
      durationMinutes,
      seed: "shared-seed",
      availableTrackingProfiles: ["one-hand"],
    });
    const ids = plan.legs.map((leg) => leg.mode.id);

    assert.equal(plan.canStart, true);
    assert.equal(plan.legs.length, expectedLegCounts.get(durationMinutes));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(plan.estimatedMinutes <= durationMinutes);
    assert.equal(
      plan.estimatedMinutes + plan.unallocatedMinutes,
      durationMinutes,
    );
    assert.equal(plan.legs.at(-1).role, "finale");
    if (plan.legs.length > 1) {
      assert.equal(plan.legs[0].role, "warm-up");
    }
    assert.ok(
      plan.legs.every(
        (leg, index) =>
          leg.id === `leg-${index + 1}-${leg.mode.id}` &&
          leg.transitionLabel.includes(leg.mode.label),
      ),
    );
  }
});

test("seeded plans are reproducible and expose integration-safe mode metadata", () => {
  const options = {
    durationMinutes: 5,
    seed: 8675309,
    availableTrackingProfiles: ["one-hand"],
  };
  const first = createArcadeRunPlan(PLAY_MODES, options);
  const second = createArcadeRunPlan(
    [...PLAY_MODES].reverse(),
    options,
  );

  assert.equal(first.planId, second.planId);
  assert.deepEqual(
    first.legs.map((leg) => leg.mode.id),
    second.legs.map((leg) => leg.mode.id),
  );
  assert.ok(
    first.legs.every(
      (leg) =>
        typeof leg.mode.path === "string" &&
        typeof leg.mode.objective === "string" &&
        ["tracking", "pointer", "none"].includes(leg.mode.inputMethod),
    ),
  );
});

test("eligibility honors tracking, pointer fallback, player count, and maturity", () => {
  const candidates = [
    mode({ id: "hand-pointer", minutes: 1 }),
    mode({
      id: "hand-camera-only",
      minutes: 1,
      pointer: false,
    }),
    mode({
      id: "two-hands",
      minutes: 1,
      trackingProfile: "two-hands",
      pointer: false,
      players: 2,
    }),
    mode({
      id: "two-player-pointer",
      minutes: 1,
      trackingProfile: "two-hands",
      players: 2,
    }),
    mode({
      id: "preview-pointer",
      minutes: 1,
      maturity: "preview",
    }),
    mode({
      id: "creative",
      minutes: 1,
      area: "create",
    }),
    mode({
      id: "unfinished",
      minutes: 1,
      supportsResults: false,
    }),
  ];

  assert.deepEqual(
    listEligibleArcadeRunModes(candidates, {
      availableTrackingProfiles: [],
      pointerAvailable: true,
      preferredInput: "pointer",
      playerCount: 1,
    }).map((candidate) => [candidate.id, candidate.inputMethod]),
    [["hand-pointer", "pointer"]],
  );

  assert.deepEqual(
    listEligibleArcadeRunModes(candidates, {
      availableTrackingProfiles: ["one-hand"],
      pointerAvailable: false,
      playerCount: 1,
    }).map((candidate) => candidate.id),
    ["hand-pointer", "hand-camera-only"],
  );

  assert.deepEqual(
    listEligibleArcadeRunModes(candidates, {
      availableTrackingProfiles: ["two-hands"],
      pointerAvailable: false,
      playerCount: 2,
    }).map((candidate) => candidate.id),
    ["two-hands", "two-player-pointer"],
  );

  assert.deepEqual(
    listEligibleArcadeRunModes(candidates, {
      availableTrackingProfiles: [],
      pointerAvailable: true,
      playerCount: 2,
      playerCountPolicy: "take-turns",
      allowedMaturities: ["supported", "preview"],
    }).map((candidate) => candidate.id),
    ["hand-pointer", "two-player-pointer", "preview-pointer"],
  );
});

test("plans explain when no activity matches current capabilities", () => {
  const plan = createArcadeRunPlan(PLAY_MODES, {
    durationMinutes: 3,
    availableTrackingProfiles: [],
    pointerAvailable: false,
  });

  assert.equal(plan.canStart, false);
  assert.equal(plan.legs.length, 0);
  assert.match(plan.unavailableReason, /No games match/);
  assert.equal(plan.filters.eligibleModeCount, 0);
});

test("daily runs use stable UTC day seeds and rotate on a new day", () => {
  const lateUtc = new Date("2026-07-28T23:59:59.000Z");
  const sameUtcDay = new Date("2026-07-28T00:00:01.000Z");
  const nextUtcDay = new Date("2026-07-29T00:00:00.000Z");
  const options = {
    durationMinutes: 10,
    playerCount: 1,
    availableTrackingProfiles: ["one-hand"],
  };
  const first = createDailyArcadeRunPlan(PLAY_MODES, {
    ...options,
    date: lateUtc,
  });
  const second = createDailyArcadeRunPlan(PLAY_MODES, {
    ...options,
    date: sameUtcDay,
  });
  const next = createDailyArcadeRunPlan(PLAY_MODES, {
    ...options,
    date: nextUtcDay,
  });

  assert.equal(getArcadeRunDayKey(lateUtc), "2026-07-28");
  assert.equal(first.dailyChallenge.dayKey, "2026-07-28");
  assert.equal(first.seed, second.seed);
  assert.equal(first.planId, second.planId);
  assert.deepEqual(first.legs, second.legs);
  assert.notEqual(first.seed, next.seed);
  assert.notEqual(first.dailyChallenge.id, next.dailyChallenge.id);
  assert.equal(
    first.seed,
    getDailyArcadeRunSeed({
      date: lateUtc,
      durationMinutes: 10,
      playerCount: 1,
    }),
  );
});

function createThreeLegSession() {
  const plan = createArcadeRunPlan(PLAY_MODES, {
    durationMinutes: 5,
    seed: 42,
    availableTrackingProfiles: ["one-hand"],
  });
  return createArcadeRunSession(plan, {
    runId: "test-run",
    now: "2026-07-28T10:00:00.000Z",
  });
}

test("run state tracks leg completion and aggregates score and medals", () => {
  let session = startArcadeRun(createThreeLegSession(), {
    now: "2026-07-28T10:00:01.000Z",
  });
  assert.equal(session.status, ARCADE_RUN_STATUSES.ACTIVE);
  assert.equal(
    session.legs[0].status,
    ARCADE_RUN_LEG_STATUSES.ACTIVE,
  );

  const results = [
    { score: 120, medals: [{ id: "fast", label: "Fast", tier: "gold" }] },
    { score: 80, medal: "silver", outcome: "won" },
    { score: 50, medals: [{ id: "steady", tier: "gold", earned: true }] },
  ];

  for (const [index, result] of results.entries()) {
    session = completeArcadeRunLeg(session, result, {
      now: `2026-07-28T10:00:0${index + 2}.000Z`,
    });
    assert.equal(session.status, ARCADE_RUN_STATUSES.BETWEEN_LEGS);
    assert.equal(
      session.legs[index].status,
      ARCADE_RUN_LEG_STATUSES.COMPLETED,
    );
    session = advanceArcadeRun(session, {
      now: `2026-07-28T10:00:1${index}.000Z`,
    });
  }

  assert.equal(session.status, ARCADE_RUN_STATUSES.COMPLETE);
  assert.equal(session.currentLegIndex, null);
  assert.deepEqual(getArcadeRunAggregate(session), {
    totalScore: 250,
    completedLegCount: 3,
    skippedLegCount: 0,
    finishedLegCount: 3,
    totalLegCount: 3,
    progress: 1,
    medalCounts: {
      bronze: 0,
      silver: 1,
      gold: 2,
    },
    medalScore: 8,
    runMedal: ARCADE_RUN_MEDAL_TIERS.GOLD,
  });
});

test("skip, retry, and continue keep attempts explicit without double-counting", () => {
  let session = startArcadeRun(createThreeLegSession(), {
    now: "2026-07-28T11:00:00.000Z",
  });
  session = skipArcadeRunLeg(session, {
    reason: "Need more room",
    now: "2026-07-28T11:00:03.000Z",
  });

  assert.equal(session.aggregate.skippedLegCount, 1);
  assert.equal(session.legs[0].skipReason, "Need more room");

  session = retryArcadeRunLeg(session, {
    now: "2026-07-28T11:00:04.000Z",
  });
  assert.equal(session.status, ARCADE_RUN_STATUSES.ACTIVE);
  assert.equal(session.legs[0].attempts, 2);
  assert.equal(session.legs[0].history.length, 1);
  assert.equal(
    session.legs[0].history[0].status,
    ARCADE_RUN_LEG_STATUSES.SKIPPED,
  );
  assert.equal(session.aggregate.skippedLegCount, 0);

  session = completeArcadeRunLeg(session, {
    score: 10,
    medals: ["bronze", { tier: "gold", earned: false }],
  });
  assert.equal(session.aggregate.totalScore, 10);
  assert.equal(session.aggregate.medalCounts.bronze, 1);

  session = advanceArcadeRun(session);
  assert.equal(session.currentLegIndex, 1);
  assert.equal(session.legs[1].attempts, 1);
});

test("pause, resume, and serialization preserve a resumable pure snapshot", () => {
  let session = startArcadeRun(createThreeLegSession(), {
    now: "2026-07-28T12:00:00.000Z",
  });
  session = pauseArcadeRun(session, {
    now: "2026-07-28T12:00:02.000Z",
  });
  assert.equal(session.status, ARCADE_RUN_STATUSES.PAUSED);

  const serialized = serializeArcadeRunSession(session);
  const restored = deserializeArcadeRunSession(serialized);
  assert.deepEqual(restored, session);

  session = resumeArcadeRun(restored, {
    now: "2026-07-28T12:01:00.000Z",
  });
  assert.equal(session.status, ARCADE_RUN_STATUSES.ACTIVE);
  assert.equal(session.currentLegIndex, 0);
  assert.equal(session.legs[0].attempts, 1);

  assert.throws(
    () => deserializeArcadeRunSession("{broken"),
    /not valid JSON/,
  );
  assert.throws(
    () =>
      deserializeArcadeRunSession({
        ...session,
        version: 99,
      }),
    UnsupportedArcadeRunVersionError,
  );
});

test("next-up and summary models include readable actions and live-region semantics", () => {
  let session = createThreeLegSession();
  let nextUp = createArcadeRunNextUpUiModel(session);

  assert.match(nextUp.title, /^First up:/);
  assert.equal(nextUp.actions[0].id, "start");
  assert.match(nextUp.actions[0].ariaLabel, /Start Arcade Run/);
  assert.equal(nextUp.accessibility.role, "region");
  assert.equal(nextUp.accessibility.ariaAtomic, true);

  session = startArcadeRun(session);
  session = completeArcadeRunLeg(session, {
    score: 1234,
    medals: [{ tier: "silver" }],
  });
  nextUp = createArcadeRunNextUpUiModel(session);

  assert.match(nextUp.title, /^Next up:/);
  assert.deepEqual(
    nextUp.actions.map((action) => action.id),
    ["retry", "continue"],
  );
  assert.equal(nextUp.accessibility.ariaLive, "polite");
  assert.match(nextUp.accessibility.announcement, /Controls:/);

  const summary = createArcadeRunSummaryUiModel(session, {
    locale: "en-US",
  });
  assert.equal(summary.primaryMetric.formattedValue, "1,234");
  assert.equal(summary.progress.maximum, 3);
  assert.equal(summary.medalCounts[1].count, 1);
  assert.equal(summary.accessibility.ariaLive, "polite");
  assert.ok(
    summary.legs.every(
      (leg) =>
        typeof leg.statusLabel === "string" && leg.statusLabel.length > 0,
    ),
  );
});

test("the final between-leg model offers retry or an explicit results action", () => {
  const plan = createArcadeRunPlan(
    [mode({ id: "solo-finale", minutes: 2 })],
    {
      durationMinutes: 3,
      seed: 3,
      availableTrackingProfiles: ["one-hand"],
    },
  );
  let session = startArcadeRun(
    createArcadeRunSession(plan, {
      now: "2026-07-28T13:00:00.000Z",
    }),
  );
  session = completeArcadeRunLeg(session, { score: 9 });
  const finalPrompt = createArcadeRunNextUpUiModel(session);

  assert.equal(finalPrompt.activity, null);
  assert.deepEqual(
    finalPrompt.actions.map((action) => action.id),
    ["retry", "finish"],
  );

  session = advanceArcadeRun(session);
  const summary = createArcadeRunSummaryUiModel(session);
  assert.equal(session.status, ARCADE_RUN_STATUSES.COMPLETE);
  assert.equal(summary.title, "Circuit complete");
  assert.equal(summary.runMedal.tier, "bronze");
  assert.equal(summary.accessibility.ariaLive, "assertive");
  assert.deepEqual(
    summary.actions.map((action) => action.id),
    ["play-another", "home"],
  );
});
