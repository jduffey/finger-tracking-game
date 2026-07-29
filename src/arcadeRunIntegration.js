import {
  ARCADE_RUN_SCHEMA_VERSION,
  ARCADE_RUN_STATUSES,
  deserializeArcadeRunSession,
} from "./arcadeRunPlanner.js";

export const ARCADE_RUN_STORAGE_KEY = "motionArcade.arcadeRun";

function cleanId(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 120);
}

/**
 * Creates the navigation payload consumed by App. It deliberately contains only
 * serializable IDs and route metadata, so it can also be placed in navigation
 * state when the Arcade Run component unmounts during a game.
 */
export function createArcadeRunLaunchRequest(session) {
  if (
    session?.version !== ARCADE_RUN_SCHEMA_VERSION ||
    session.status !== ARCADE_RUN_STATUSES.ACTIVE ||
    !Number.isInteger(session.currentLegIndex)
  ) {
    return null;
  }
  const legState = session.legs?.[session.currentLegIndex];
  const planLeg = session.plan?.legs?.[session.currentLegIndex];
  if (!legState || !planLeg || legState.id !== planLeg.id) {
    return null;
  }

  return {
    kind: "arcade-run-leg",
    version: ARCADE_RUN_SCHEMA_VERSION,
    runId: session.runId,
    planId: session.plan.planId,
    legId: legState.id,
    legIndex: session.currentLegIndex,
    totalLegs: session.legs.length,
    attempt: legState.attempts,
    modeId: planLeg.mode.id,
    path: planLeg.mode.path,
    fullscreenMode: planLeg.mode.fullscreenMode,
    inputMethod: planLeg.mode.inputMethod,
    dailyChallenge: session.plan.dailyChallenge,
    returnContext: {
      kind: "arcade-run",
      runId: session.runId,
      legId: legState.id,
    },
  };
}

/**
 * Wraps a game-specific result in the correlation IDs needed to safely return
 * it to the correct run, even after route changes.
 */
export function createArcadeRunResultEnvelope(launchRequest, result) {
  if (
    launchRequest?.kind !== "arcade-run-leg" ||
    !cleanId(launchRequest.runId) ||
    !cleanId(launchRequest.legId)
  ) {
    throw new TypeError("A valid Arcade Run launch request is required.");
  }
  return {
    version: ARCADE_RUN_SCHEMA_VERSION,
    runId: cleanId(launchRequest.runId),
    legId: cleanId(launchRequest.legId),
    attempt: Number.isInteger(launchRequest.attempt)
      ? launchRequest.attempt
      : 1,
    result: result && typeof result === "object" ? result : {},
  };
}

export function matchesArcadeRunResultEnvelope(session, envelope) {
  if (
    session?.status !== ARCADE_RUN_STATUSES.ACTIVE ||
    envelope?.version !== ARCADE_RUN_SCHEMA_VERSION ||
    !Number.isInteger(session.currentLegIndex)
  ) {
    return false;
  }
  const currentLeg = session.legs?.[session.currentLegIndex];
  return Boolean(
    currentLeg &&
      envelope.runId === session.runId &&
      envelope.legId === currentLeg.id &&
      (!Number.isInteger(envelope.attempt) ||
        envelope.attempt === currentLeg.attempts),
  );
}

/**
 * Storage adapters can be sync or async; this helper keeps snapshot validation
 * consistent for both the component and an App-level restoration flow.
 */
export function restoreArcadeRunSnapshot(snapshot) {
  if (snapshot === null || snapshot === undefined || snapshot === "") {
    return null;
  }
  const session = deserializeArcadeRunSession(snapshot);
  return session.status === ARCADE_RUN_STATUSES.COMPLETE ? null : session;
}

function safeResultIdentifier(value, fallback) {
  const identifier = cleanId(value)
    .replace(/[^a-z0-9._:-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return identifier || fallback;
}

/**
 * Converts a completed multi-game route into the same local progression
 * contract used by individual games.
 */
export function createArcadeRunProgressionResult(session) {
  if (
    session?.version !== ARCADE_RUN_SCHEMA_VERSION ||
    session.status !== ARCADE_RUN_STATUSES.COMPLETE ||
    !session.aggregate
  ) {
    return null;
  }
  const startedAt = session.startedAt ?? session.createdAt ?? session.completedAt;
  const endedAt = session.completedAt ?? session.updatedAt ?? startedAt;
  const startedTime = Date.parse(startedAt);
  const endedTime = Date.parse(endedAt);
  const durationMs =
    Number.isFinite(startedTime) && Number.isFinite(endedTime)
      ? Math.max(0, endedTime - startedTime)
      : 0;
  const aggregate = session.aggregate;
  const score = Math.max(0, Number(aggregate.totalScore) || 0);
  const metrics = {
    score,
    gamesCompleted: Math.max(0, Number(aggregate.completedLegCount) || 0),
    gamesSkipped: Math.max(0, Number(aggregate.skippedLegCount) || 0),
    goldMedals: Math.max(0, Number(aggregate.medalCounts?.gold) || 0),
    silverMedals: Math.max(0, Number(aggregate.medalCounts?.silver) || 0),
    bronzeMedals: Math.max(0, Number(aggregate.medalCounts?.bronze) || 0),
    medalPoints: Math.max(0, Number(aggregate.medalScore) || 0),
  };
  return {
    sessionId: safeResultIdentifier(
      `arcade-run-${session.runId}`,
      `arcade-run-${Date.now()}`,
    ),
    modeId: "arcade-run",
    outcome: "completed",
    score,
    metrics,
    metricComparisons: Object.fromEntries(
      Object.keys(metrics).map((metricId) => [metricId, "higher"]),
    ),
    startedAt,
    endedAt,
    durationMs,
    context: {
      planId: safeResultIdentifier(session.plan?.planId, "arcade-run-plan"),
      durationMinutes: session.plan?.durationMinutes ?? 0,
      daily: Boolean(session.plan?.dailyChallenge),
      ...(session.plan?.dailyChallenge?.dayKey
        ? { dayKey: session.plan.dailyChallenge.dayKey }
        : {}),
    },
  };
}
