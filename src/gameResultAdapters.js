import { BEST_METRIC_COMPARISONS } from "./gameProgression.js";
import { getModeByFullscreenId } from "./modeRegistry.js";
import { getFlappyResultStats } from "./flappyGame.js";
import { getSpaceInvadersResultStats } from "./spaceInvadersGame.js";
import { getBrickDodgerResultStats } from "./brickDodgerGame.js";
import { getMissileCommandResultStats } from "./missileCommandGame.js";
import { getSkyPatrolResultStats } from "./skyPatrolGame.js";
import { createFruitNinjaResult } from "./fruitNinjaGame.js";

const RESULT_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const RESERVED_RESULT_IDENTIFIERS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function finite(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegative(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function countWhere(values, predicate) {
  return (Array.isArray(values) ? values : []).reduce(
    (count, value) => count + (predicate(value) ? 1 : 0),
    0,
  );
}

function resolveDurationMs(state, explicitDurationMs) {
  const explicit = finite(explicitDurationMs);
  if (explicit !== null) {
    return nonNegative(explicit);
  }
  const elapsed = finite(state?.elapsedMs);
  return elapsed === null ? null : nonNegative(elapsed);
}

function higherComparisons(metrics) {
  return Object.fromEntries(
    Object.keys(metrics).map((metricId) => [
      metricId,
      BEST_METRIC_COMPARISONS.HIGHER,
    ]),
  );
}

function addClearTimeMetric(descriptor, durationMs) {
  if (descriptor.outcome !== "won" || durationMs === null) {
    return descriptor;
  }
  return {
    ...descriptor,
    metrics: {
      ...descriptor.metrics,
      clearTimeMs: durationMs,
    },
    metricComparisons: {
      ...descriptor.metricComparisons,
      clearTimeMs: BEST_METRIC_COMPARISONS.LOWER,
    },
  };
}

function scoreDescriptor({
  outcome,
  score,
  metrics = {},
  metricComparisons = {},
  durationMs = null,
}) {
  const normalizedScore = finite(score, 0);
  const normalizedMetrics = {
    score: normalizedScore,
    ...Object.fromEntries(
      Object.entries(metrics).filter(([, value]) => Number.isFinite(value)),
    ),
  };
  return {
    outcome,
    score: normalizedScore,
    metrics: normalizedMetrics,
    metricComparisons: {
      ...higherComparisons(normalizedMetrics),
      ...metricComparisons,
    },
    durationMs,
  };
}

function adaptSkyPatrol(state, input) {
  if (state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  const result =
    state.result ??
    getSkyPatrolResultStats(state) ?? {
      outcome: state.outcome ?? "defeat",
      score: state.score,
      missionReached: state.mission,
      missionsCleared: state.missionsCleared,
      targetsDestroyed: state.targetsDestroyed,
      accuracy: state.accuracy,
      bestCombo: state.bestCombo,
      powerUpsCollected: state.powerUpsCollected,
      livesRemaining: state.lives,
    };
  return scoreDescriptor({
    outcome: result.outcome === "victory" ? "won" : "lost",
    score: result.score,
    metrics: {
      missionReached: nonNegativeInteger(result.missionReached, 1),
      missionsCleared: nonNegativeInteger(result.missionsCleared),
      targetsDestroyed: nonNegativeInteger(result.targetsDestroyed),
      accuracyPercent: nonNegative(result.accuracy),
      bestCombo: nonNegativeInteger(result.bestCombo),
      powerUpsCollected: nonNegativeInteger(result.powerUpsCollected),
      livesRemaining: nonNegativeInteger(result.livesRemaining),
      ...(durationMs === null ? {} : { survivalMs: durationMs }),
    },
    durationMs,
  });
}

function adaptFruitNinja(state, input) {
  if (state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  const result =
    state.result ??
    createFruitNinjaResult(state, state.endReason);
  return scoreDescriptor({
    outcome: result.outcome === "completed" ? "completed" : "lost",
    score: result.score,
    metrics: {
      fruitSliced: nonNegativeInteger(result.stats?.fruitSliced),
      bestCombo: nonNegativeInteger(result.bestCombo),
      precisionPercent: nonNegative(result.precisionRate) * 100,
      bombsHit: nonNegativeInteger(result.stats?.bombsHit),
      wavesReached: nonNegativeInteger(result.stats?.wavesReached, 1),
      livesRemaining: nonNegativeInteger(result.livesRemaining),
      ...(durationMs === null ? {} : { survivalMs: durationMs }),
    },
    durationMs,
  });
}

function adaptMissileCommand(state, input) {
  if (state?.status !== "game_over") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  const result =
    state.result ??
    getMissileCommandResultStats(state) ?? {
      outcome: state.outcome ?? "defeat",
      score: state.score,
      threatsStopped: state.threatsStopped,
      wavesCleared: state.wavesCleared,
      citiesSurviving: state.citiesSurviving,
      accuracy: state.accuracy,
      perfectWaves: state.perfectWaves,
    };
  return scoreDescriptor({
    outcome: result.outcome === "victory" ? "won" : "lost",
    score: result.score,
    metrics: {
      threatsStopped: nonNegativeInteger(result.threatsStopped),
      wavesCleared: nonNegativeInteger(result.wavesCleared),
      citiesSurviving: nonNegativeInteger(result.citiesSurviving),
      accuracyPercent: nonNegative(result.accuracy),
      perfectWaves: nonNegativeInteger(result.perfectWaves),
      ...(durationMs === null ? {} : { survivalMs: durationMs }),
    },
    durationMs,
  });
}

function adaptBrickDodger(state, input) {
  if (state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(
    { elapsedMs: finite(state.survivalMs, state.elapsedMs) },
    input.durationMs,
  );
  const result =
    state.result ??
    getBrickDodgerResultStats(state) ?? {
      score: state.score,
      stageReached: state.stage,
      stagesCleared: state.stagesCleared,
      nearMisses: state.nearMisses,
      bestMultiplier: state.bestMultiplier,
      pickupsCollected: state.pickupsCollected,
    };
  return scoreDescriptor({
    outcome: "completed",
    score: result.score,
    metrics: {
      stage: nonNegativeInteger(result.stageReached, 1),
      stagesCleared: nonNegativeInteger(result.stagesCleared),
      nearMisses: nonNegativeInteger(result.nearMisses),
      bestMultiplier: nonNegative(result.bestMultiplier, 1),
      pickups: nonNegativeInteger(result.pickupsCollected),
      ...(durationMs === null ? {} : { survivalMs: durationMs }),
    },
    durationMs,
  });
}

function adaptHandBounce(state, input) {
  if (state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  return scoreDescriptor({
    outcome: "completed",
    score: finite(state.score, state.saveCount),
    metrics: {
      saves: nonNegativeInteger(state.saveCount, nonNegativeInteger(state.score)),
      ...(durationMs === null ? {} : { survivalMs: durationMs }),
    },
    durationMs,
  });
}

function adaptBreakout(state, input) {
  if (state?.status !== "cleared" && state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  const descriptor = scoreDescriptor({
    outcome: state.status === "cleared" ? "won" : "lost",
    score: state.score,
    metrics: {
      bricksCleared: countWhere(state.bricks, (brick) => brick?.destroyed),
      level: Math.max(1, nonNegativeInteger(state.level, 1)),
      livesRemaining: nonNegativeInteger(state.lives),
    },
    durationMs,
  });
  return addClearTimeMetric(descriptor, durationMs);
}

function adaptBreakoutCoop(state, input) {
  if (state?.status !== "cleared" && state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  const descriptor = scoreDescriptor({
    outcome: state.status === "cleared" ? "won" : "lost",
    score: state.score,
    metrics: {
      bricksCleared: countWhere(state.bricks, (brick) => brick?.destroyed),
      livesRemaining: nonNegativeInteger(state.lives),
      shieldSaves: nonNegativeInteger(state.shield?.saves),
      shieldActivations: nonNegativeInteger(state.shield?.activations),
    },
    durationMs,
  });
  return addClearTimeMetric(descriptor, durationMs);
}

function adaptFingerPong(state, input) {
  if (state?.status !== "won" && state?.status !== "lost") {
    return null;
  }
  const score = nonNegativeInteger(state.score);
  const opponentScore = nonNegativeInteger(state.opponentScore);
  return scoreDescriptor({
    outcome: state.status,
    score,
    metrics: {
      opponentScore,
      bestRally: nonNegativeInteger(state.bestRally),
      pointDifferential: score - opponentScore,
    },
    metricComparisons: {
      opponentScore: BEST_METRIC_COMPARISONS.LOWER,
    },
    durationMs: resolveDurationMs(state, input.durationMs),
  });
}

function adaptTicTacToe(state, input) {
  const outcomeByStatus = {
    "player-win": "won",
    "ai-win": "lost",
    draw: "draw",
  };
  const outcome = outcomeByStatus[state?.status];
  if (!outcome) {
    return null;
  }

  const board = Array.isArray(state.board) ? state.board : [];
  const playerMoves = countWhere(board, (mark) => mark === "X");
  const opponentMoves = countWhere(board, (mark) => mark === "O");
  const roundPoints = outcome === "won" ? 1 : outcome === "draw" ? 0.5 : 0;
  const metrics = {
    roundPoints,
    movesPlayed: playerMoves + opponentMoves,
    playerMoves,
    opponentMoves,
  };
  const metricComparisons = {};
  if (outcome === "won") {
    metrics.movesToWin = playerMoves;
    metricComparisons.movesToWin = BEST_METRIC_COMPARISONS.LOWER;
  }

  return scoreDescriptor({
    outcome,
    score: roundPoints,
    metrics,
    metricComparisons,
    durationMs: resolveDurationMs(state, input.durationMs),
  });
}

function adaptInvaders(state, input) {
  if (state?.status !== "gameover") {
    return null;
  }
  const durationMs = resolveDurationMs(state, input.durationMs);
  const stats = getSpaceInvadersResultStats(state) ?? {};
  return scoreDescriptor({
    outcome: "lost",
    score: stats.score ?? state.score,
    metrics: {
      wave: nonNegativeInteger(stats.wave, 1),
      wavesCleared: nonNegativeInteger(stats.wavesCleared),
      enemiesDestroyed: nonNegativeInteger(stats.enemiesDestroyed),
      accuracyPercent: nonNegative(stats.accuracy),
      ufoHits: nonNegativeInteger(stats.ufoHits),
      powerUpsCollected: nonNegativeInteger(stats.powerUpsCollected),
      livesRemaining: nonNegativeInteger(stats.livesRemaining),
    },
    durationMs,
  });
}

function adaptFlappy(state, input) {
  if (state?.status !== "gameover") {
    return null;
  }
  const stats = getFlappyResultStats(state) ?? {};
  return scoreDescriptor({
    outcome: "completed",
    score: stats.score ?? state.score,
    metrics: {
      pipesCleared: nonNegativeInteger(stats.pipesCleared, state.score),
      centerBonuses: nonNegativeInteger(stats.centerBonuses),
      bestCenterStreak: nonNegativeInteger(stats.bestCenterStreak),
      flaps: nonNegativeInteger(stats.flaps),
      difficultyLevel: nonNegativeInteger(stats.difficultyLevel, 1),
    },
    durationMs: resolveDurationMs(state, input.durationMs),
  });
}

const RESULT_ADAPTERS = Object.freeze({
  "sky-patrol": adaptSkyPatrol,
  "fruit-ninja": adaptFruitNinja,
  "missile-command": adaptMissileCommand,
  "brick-dodger": adaptBrickDodger,
  "hand-bounce": adaptHandBounce,
  breakout: adaptBreakout,
  classic: adaptBreakout,
  "find-your-grind-breakout": adaptBreakout,
  "breakout-coop": adaptBreakoutCoop,
  "finger-pong": adaptFingerPong,
  "tic-tac-toe": adaptTicTacToe,
  invaders: adaptInvaders,
  flappy: adaptFlappy,
});

export const FULLSCREEN_RESULT_MODE_IDS = Object.freeze(
  Object.keys(RESULT_ADAPTERS).sort(),
);

function requireSessionId(sessionId) {
  if (
    typeof sessionId !== "string" ||
    RESERVED_RESULT_IDENTIFIERS.has(sessionId) ||
    !RESULT_IDENTIFIER_PATTERN.test(sessionId)
  ) {
    throw new TypeError("A terminal result requires a storage-safe sessionId.");
  }
  return sessionId;
}

function optionalPayloadField(payload, key, value) {
  if (value !== undefined && value !== null) {
    payload[key] = value;
  }
}

function createPayload({
  sessionId,
  modeId,
  descriptor,
  startedAt,
  endedAt,
  context,
}) {
  const payload = {
    sessionId: requireSessionId(sessionId),
    modeId,
    outcome: descriptor.outcome,
    score: descriptor.score,
    metrics: descriptor.metrics,
    metricComparisons: descriptor.metricComparisons,
    context,
  };
  optionalPayloadField(payload, "startedAt", startedAt);
  optionalPayloadField(payload, "endedAt", endedAt);
  optionalPayloadField(payload, "durationMs", descriptor.durationMs);
  return payload;
}

/**
 * Converts a terminal fullscreen state into the payload accepted by
 * recordGameResult. Active, unsupported, and non-game states return null.
 */
export function createFullscreenGameResult({
  fullscreenMode,
  state,
  sessionId,
  startedAt,
  endedAt,
  durationMs,
  context = {},
} = {}) {
  const adapter = RESULT_ADAPTERS[fullscreenMode];
  const registeredMode = getModeByFullscreenId(fullscreenMode);
  if (!adapter || !registeredMode?.supportsResults) {
    return null;
  }

  const descriptor = adapter(state, { durationMs });
  if (!descriptor) {
    return null;
  }

  const variant =
    fullscreenMode === registeredMode.fullscreenMode
      ? state?.variant && state.variant !== "classic"
        ? state.variant
        : null
      : fullscreenMode === "classic"
        ? null
        : fullscreenMode;
  return createPayload({
    sessionId,
    modeId: registeredMode.id,
    descriptor,
    startedAt,
    endedAt,
    context: {
      ...(context && typeof context === "object" ? context : {}),
      fullscreenMode: registeredMode.fullscreenMode,
      ...(variant ? { variant } : {}),
    },
  });
}

function isWhackAMoleComplete(summary) {
  if (summary?.completed === true) {
    return true;
  }
  if (summary?.status === "completed" || summary?.status === "complete") {
    return true;
  }
  const timeLeft = finite(summary?.timeLeft, finite(summary?.timeLeftSeconds));
  return summary?.gameRunning === false && timeLeft !== null && timeLeft <= 0;
}

/**
 * Adapts the timed Whack-a-Mole summary maintained by App into the same result
 * contract. Idle and running summaries return null.
 */
export function createWhackAMoleResult({
  summary,
  sessionId,
  startedAt,
  endedAt,
  durationMs,
  context = {},
} = {}) {
  if (!isWhackAMoleComplete(summary)) {
    return null;
  }

  const score = nonNegativeInteger(summary?.score);
  const hits = nonNegativeInteger(summary?.hits, score);
  const attempts = finite(summary?.attempts, finite(summary?.targetsShown));
  const misses = finite(summary?.misses);
  const accuracyPercent = finite(
    summary?.accuracyPercent,
    attempts !== null && attempts > 0 ? (hits / attempts) * 100 : null,
  );
  const averageHitTimeMs = finite(summary?.averageHitTimeMs);
  const fastestHitMs = finite(summary?.fastestHitMs);
  const bestStreak = finite(summary?.bestStreak);
  const goldHits = finite(summary?.goldHits);
  const decoyHits = finite(summary?.decoyHits);
  const decoysAvoided = finite(summary?.decoysAvoided);
  const resolvedDurationMs =
    finite(durationMs) !== null
      ? nonNegative(durationMs)
      : finite(summary?.durationMs) !== null
        ? nonNegative(summary.durationMs)
        : null;
  const metrics = {
    score,
    hits,
    ...(attempts === null ? {} : { targetsShown: nonNegativeInteger(attempts) }),
    ...(misses === null ? {} : { misses: nonNegativeInteger(misses) }),
    ...(accuracyPercent === null
      ? {}
      : { accuracyPercent: Math.min(100, Math.max(0, accuracyPercent)) }),
    ...(averageHitTimeMs === null
      ? {}
      : { averageHitTimeMs: nonNegative(averageHitTimeMs) }),
    ...(fastestHitMs === null
      ? {}
      : { fastestHitMs: nonNegative(fastestHitMs) }),
    ...(bestStreak === null
      ? {}
      : { bestStreak: nonNegativeInteger(bestStreak) }),
    ...(goldHits === null ? {} : { goldHits: nonNegativeInteger(goldHits) }),
    ...(decoyHits === null
      ? {}
      : { decoyHits: nonNegativeInteger(decoyHits) }),
    ...(decoysAvoided === null
      ? {}
      : { decoysAvoided: nonNegativeInteger(decoysAvoided) }),
  };
  const descriptor = scoreDescriptor({
    outcome: "completed",
    score,
    metrics,
    metricComparisons: {
      ...(misses === null ? {} : { misses: BEST_METRIC_COMPARISONS.LOWER }),
      ...(averageHitTimeMs === null
        ? {}
        : { averageHitTimeMs: BEST_METRIC_COMPARISONS.LOWER }),
      ...(fastestHitMs === null
        ? {}
        : { fastestHitMs: BEST_METRIC_COMPARISONS.LOWER }),
      ...(decoyHits === null
        ? {}
        : { decoyHits: BEST_METRIC_COMPARISONS.LOWER }),
    },
    durationMs: resolvedDurationMs,
  });

  return createPayload({
    sessionId,
    modeId: "whack-a-mole",
    descriptor,
    startedAt,
    endedAt,
    context: {
      ...(context && typeof context === "object" ? context : {}),
      roundType: "timed",
    },
  });
}

/**
 * Adapts one completed Gesture Memory round. The accumulated profile statistics
 * stay in local progression, while each attempt records recognition quality and
 * the sequence reached.
 */
export function createSpatialMemoryResult({
  state,
  sessionId,
  startedAt,
  endedAt,
  durationMs,
  context = {},
} = {}) {
  if (state?.status !== "completed" && state?.status !== "failed") {
    return null;
  }

  const accuracy = Math.min(1, Math.max(0, finite(state.accuracy, 0)));
  const smoothness = Math.min(1, Math.max(0, finite(state.smoothness, 0)));
  const descriptor = scoreDescriptor({
    outcome: state.status === "completed" ? "won" : "lost",
    score: nonNegative(state.score),
    metrics: {
      round: Math.max(1, nonNegativeInteger(state.round, 1)),
      sequenceLength: nonNegativeInteger(
        state.sequenceLength,
        Array.isArray(state.sequence) ? state.sequence.length : 0,
      ),
      correctSteps: nonNegativeInteger(state.correctSteps),
      attempts: nonNegativeInteger(state.attempts),
      accuracyPercent: accuracy * 100,
      smoothnessPercent: smoothness * 100,
    },
    durationMs:
      finite(durationMs) !== null
        ? nonNegative(durationMs)
        : nonNegative(state.elapsedSeconds) * 1000,
  });

  return createPayload({
    sessionId,
    modeId: "spatial-memory",
    descriptor,
    startedAt,
    endedAt,
    context: {
      ...(context && typeof context === "object" ? context : {}),
      difficultyLevel: Math.max(
        1,
        nonNegativeInteger(state.difficultyLevel, 1),
      ),
    },
  });
}
