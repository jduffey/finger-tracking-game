import test from "node:test";
import assert from "node:assert/strict";

import {
  completeArcadeRunLeg,
  createArcadeRunPlan,
  createArcadeRunSession,
  serializeArcadeRunSession,
  startArcadeRun,
} from "../src/arcadeRunPlanner.js";
import {
  ARCADE_RUN_STORAGE_KEY,
  createArcadeRunLaunchRequest,
  createArcadeRunProgressionResult,
  createArcadeRunResultEnvelope,
  matchesArcadeRunResultEnvelope,
  restoreArcadeRunSnapshot,
} from "../src/arcadeRunIntegration.js";

const MODES = [
  {
    id: "warmup",
    label: "Warmup",
    path: "/play/warmup",
    area: "play",
    maturity: "supported",
    objective: "Warm up.",
    controlHint: "Point to hit",
    typicalMinutes: 1,
    difficulty: "Easy",
    players: 1,
    trackingProfile: "one-hand",
    supportsPointerFallback: true,
    supportsResults: true,
  },
  {
    id: "finale",
    label: "Finale",
    path: "/play/finale",
    area: "play",
    maturity: "flagship",
    objective: "Finish strong.",
    controlHint: "Swipe to score",
    typicalMinutes: 2,
    difficulty: "Hard",
    players: 1,
    trackingProfile: "one-hand",
    supportsPointerFallback: true,
    supportsResults: true,
    fullscreenMode: "finale-mode",
  },
];

function activeSession() {
  const plan = createArcadeRunPlan(MODES, {
    durationMinutes: 3,
    seed: "integration",
    availableTrackingProfiles: ["one-hand"],
  });
  return startArcadeRun(
    createArcadeRunSession(plan, {
      runId: "run-123",
      now: "2026-07-28T10:00:00.000Z",
    }),
    { now: "2026-07-28T10:00:01.000Z" },
  );
}

test("launch requests carry stable navigation and return correlation IDs", () => {
  const session = activeSession();
  const request = createArcadeRunLaunchRequest(session);
  const current = session.plan.legs[session.currentLegIndex];

  assert.deepEqual(request, {
    kind: "arcade-run-leg",
    version: 1,
    runId: "run-123",
    planId: session.plan.planId,
    legId: current.id,
    legIndex: 0,
    totalLegs: 2,
    attempt: 1,
    modeId: current.mode.id,
    path: current.mode.path,
    fullscreenMode: current.mode.fullscreenMode,
    inputMethod: current.mode.inputMethod,
    dailyChallenge: null,
    returnContext: {
      kind: "arcade-run",
      runId: "run-123",
      legId: current.id,
    },
  });
  assert.equal(ARCADE_RUN_STORAGE_KEY, "motionArcade.arcadeRun");
});

test("result envelopes match only the active run, leg, and attempt", () => {
  const session = activeSession();
  const request = createArcadeRunLaunchRequest(session);
  const envelope = createArcadeRunResultEnvelope(request, {
    outcome: "won",
    score: 44,
  });

  assert.equal(matchesArcadeRunResultEnvelope(session, envelope), true);
  assert.equal(
    matchesArcadeRunResultEnvelope(session, {
      ...envelope,
      runId: "another-run",
    }),
    false,
  );
  assert.equal(
    matchesArcadeRunResultEnvelope(session, {
      ...envelope,
      attempt: 2,
    }),
    false,
  );

  const completed = completeArcadeRunLeg(session, envelope.result);
  assert.equal(matchesArcadeRunResultEnvelope(completed, envelope), false);
});

test("resume restoration validates snapshots and ignores finished runs", () => {
  const session = activeSession();
  const restored = restoreArcadeRunSnapshot(
    serializeArcadeRunSession(session),
  );

  assert.deepEqual(restored, session);
  assert.equal(restoreArcadeRunSnapshot(null), null);
  assert.throws(
    () => restoreArcadeRunSnapshot('{"version":99}'),
    /Unsupported Arcade Run schema version/,
  );
});

test("invalid launch requests cannot create uncorrelated result envelopes", () => {
  assert.equal(createArcadeRunLaunchRequest(null), null);
  assert.throws(
    () => createArcadeRunResultEnvelope({ kind: "arcade-run-leg" }, {}),
    /valid Arcade Run launch request/,
  );
});

test("completed routes produce one aggregate local progression result", () => {
  let session = activeSession();
  session = completeArcadeRunLeg(session, {
    outcome: "won",
    score: 44,
    medals: [{ id: "first-gold", label: "Gold", tier: "gold" }],
  }, { now: "2026-07-28T10:01:00.000Z" });
  session = {
    ...session,
    status: "complete",
    completedAt: "2026-07-28T10:03:00.000Z",
    aggregate: {
      ...session.aggregate,
      completedLegCount: 1,
      skippedLegCount: 1,
      finishedLegCount: 2,
      totalLegCount: 2,
      totalScore: 44,
      medalCounts: { gold: 1, silver: 0, bronze: 0 },
      medalScore: 3,
      runMedal: "bronze",
    },
  };

  const result = createArcadeRunProgressionResult(session);
  assert.equal(result.modeId, "arcade-run");
  assert.equal(result.outcome, "completed");
  assert.equal(result.score, 44);
  assert.equal(result.durationMs, 179_000);
  assert.deepEqual(result.metrics, {
    score: 44,
    gamesCompleted: 1,
    gamesSkipped: 1,
    goldMedals: 1,
    silverMedals: 0,
    bronzeMedals: 0,
    medalPoints: 3,
  });
  assert.equal(createArcadeRunProgressionResult(activeSession()), null);
});
