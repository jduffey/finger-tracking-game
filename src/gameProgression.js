export const GAME_PROGRESS_SCHEMA_VERSION = 2;
export const GAME_PROGRESS_MAX_RECENT_RESULTS = 20;
export const GAME_PROGRESS_MAX_PROCESSED_SESSIONS = 256;

export const GAME_RESULT_OUTCOMES = Object.freeze([
  "completed",
  "won",
  "lost",
  "draw",
  "abandoned",
]);

export const BEST_METRIC_COMPARISONS = Object.freeze({
  HIGHER: "higher",
  LOWER: "lower",
});

const MAX_IDENTIFIER_LENGTH = 80;
const MAX_METRICS_PER_RESULT = 16;
const MAX_CONTEXT_ENTRIES = 16;
const MAX_CONTEXT_STRING_LENGTH = 160;
const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const RESERVED_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;

export class UnsupportedGameProgressVersionError extends Error {
  constructor(version) {
    super(
      `Game progress schema version ${version} is newer than supported version ${GAME_PROGRESS_SCHEMA_VERSION}.`,
    );
    this.name = "UnsupportedGameProgressVersionError";
    this.version = version;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeIdentifier(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    RESERVED_IDENTIFIERS.has(value) ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    return null;
  }
  return value;
}

function requireIdentifier(value, label) {
  const identifier = normalizeIdentifier(value);
  if (!identifier) {
    throw new TypeError(`${label} must be a non-empty, storage-safe identifier.`);
  }
  return identifier;
}

function finiteNumber(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function boundedDuration(value, fallback = 0) {
  return Math.min(
    MAX_SESSION_DURATION_MS,
    Math.max(0, nonNegativeNumber(value, fallback)),
  );
}

function timestampToMilliseconds(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    return Date.parse(value);
  }
  return Number.NaN;
}

function normalizeTimestamp(value, fallback = null) {
  const milliseconds = timestampToMilliseconds(value);
  if (Number.isFinite(milliseconds)) {
    return new Date(milliseconds).toISOString();
  }
  if (fallback !== null) {
    const fallbackMilliseconds = timestampToMilliseconds(fallback);
    if (Number.isFinite(fallbackMilliseconds)) {
      return new Date(fallbackMilliseconds).toISOString();
    }
  }
  return null;
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  return normalizeTimestamp(value, Date.now());
}

function isValidDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
}

function normalizeDayKey(value, timestamp) {
  if (isValidDayKey(value)) {
    return value;
  }
  return normalizeTimestamp(timestamp, Date.now()).slice(0, 10);
}

function dayDistance(fromDay, toDay) {
  if (!isValidDayKey(fromDay) || !isValidDayKey(toDay)) {
    return null;
  }
  const from = Date.parse(`${fromDay}T00:00:00.000Z`);
  const to = Date.parse(`${toDay}T00:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

function uniqueIdentifiers(values, maxLength) {
  const identifiers = [];
  for (const value of Array.isArray(values) ? values : []) {
    const identifier = normalizeIdentifier(value);
    if (!identifier || identifiers.includes(identifier)) {
      continue;
    }
    identifiers.push(identifier);
    if (identifiers.length >= maxLength) {
      break;
    }
  }
  return identifiers;
}

function normalizeComparison(value) {
  return value === BEST_METRIC_COMPARISONS.LOWER
    ? BEST_METRIC_COMPARISONS.LOWER
    : BEST_METRIC_COMPARISONS.HIGHER;
}

function normalizeMetrics(value) {
  const metrics = {};
  if (!isRecord(value)) {
    return metrics;
  }

  for (const [rawMetricId, rawValue] of Object.entries(value)) {
    const metricId = normalizeIdentifier(rawMetricId);
    const metricValue = finiteNumber(rawValue);
    if (!metricId || metricValue === null) {
      continue;
    }
    metrics[metricId] = metricValue;
    if (Object.keys(metrics).length >= MAX_METRICS_PER_RESULT) {
      break;
    }
  }
  return metrics;
}

function normalizeContext(value) {
  const context = {};
  if (!isRecord(value)) {
    return context;
  }

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeIdentifier(rawKey);
    if (!key) {
      continue;
    }
    if (typeof rawValue === "string") {
      context[key] = rawValue.slice(0, MAX_CONTEXT_STRING_LENGTH);
    } else if (typeof rawValue === "boolean" || Number.isFinite(rawValue)) {
      context[key] = rawValue;
    } else {
      continue;
    }
    if (Object.keys(context).length >= MAX_CONTEXT_ENTRIES) {
      break;
    }
  }
  return context;
}

function normalizeBestByMetric(value) {
  const bestByMetric = {};
  if (!isRecord(value)) {
    return bestByMetric;
  }

  for (const [rawMetricId, rawBest] of Object.entries(value)) {
    const metricId = normalizeIdentifier(rawMetricId);
    if (!metricId || !isRecord(rawBest) || !Number.isFinite(rawBest.value)) {
      continue;
    }
    bestByMetric[metricId] = {
      value: rawBest.value,
      comparison: normalizeComparison(rawBest.comparison),
      achievedAt: normalizeTimestamp(rawBest.achievedAt),
      sessionId: normalizeIdentifier(rawBest.sessionId),
    };
  }
  return bestByMetric;
}

function normalizeStoredResult(value, fallbackModeId = null) {
  if (!isRecord(value)) {
    return null;
  }

  const sessionId = normalizeIdentifier(value.sessionId);
  const modeId = normalizeIdentifier(value.modeId) ?? normalizeIdentifier(fallbackModeId);
  if (!sessionId || !modeId) {
    return null;
  }

  const metrics = normalizeMetrics(value.metrics);
  const score = finiteNumber(value.score, finiteNumber(metrics.score));
  if (score !== null) {
    metrics.score = score;
  }

  return {
    sessionId,
    modeId,
    outcome: GAME_RESULT_OUTCOMES.includes(value.outcome) ? value.outcome : "completed",
    score,
    metrics,
    durationMs: boundedDuration(value.durationMs),
    startedAt: normalizeTimestamp(value.startedAt),
    endedAt: normalizeTimestamp(value.endedAt),
    playedOn: isValidDayKey(value.playedOn) ? value.playedOn : null,
    context: normalizeContext(value.context),
    personalBestMetrics: uniqueIdentifiers(
      value.personalBestMetrics,
      MAX_METRICS_PER_RESULT,
    ),
  };
}

export function createEmptyModeProgress() {
  return {
    sessionsPlayed: 0,
    completedSessions: 0,
    abandonedSessions: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    playTimeMs: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
    lastPlayedAt: null,
    lastResult: null,
    bestByMetric: {},
  };
}

function normalizeModeProgress(value, modeId) {
  const source = isRecord(value) ? value : {};
  const wins = nonNegativeInteger(source.wins);
  const losses = nonNegativeInteger(source.losses);
  const draws = nonNegativeInteger(source.draws);
  const abandonedSessions = nonNegativeInteger(source.abandonedSessions);
  const completedSessions = Math.max(
    nonNegativeInteger(source.completedSessions),
    wins + losses + draws,
  );
  return {
    sessionsPlayed: Math.max(
      nonNegativeInteger(source.sessionsPlayed),
      completedSessions + abandonedSessions,
    ),
    completedSessions,
    abandonedSessions,
    wins,
    losses,
    draws,
    playTimeMs: nonNegativeNumber(source.playTimeMs),
    currentWinStreak: nonNegativeInteger(source.currentWinStreak),
    longestWinStreak: Math.max(
      nonNegativeInteger(source.longestWinStreak),
      nonNegativeInteger(source.currentWinStreak),
    ),
    lastPlayedAt: normalizeTimestamp(source.lastPlayedAt),
    lastResult: normalizeStoredResult(source.lastResult, modeId),
    bestByMetric: normalizeBestByMetric(source.bestByMetric),
  };
}

function normalizeModes(value) {
  const modes = {};
  if (!isRecord(value)) {
    return modes;
  }

  for (const [rawModeId, rawProgress] of Object.entries(value)) {
    const modeId = normalizeIdentifier(rawModeId);
    if (modeId) {
      modes[modeId] = normalizeModeProgress(rawProgress, modeId);
    }
  }
  return modes;
}

function normalizeActiveSessions(value) {
  const activeSessions = {};
  if (!isRecord(value)) {
    return activeSessions;
  }

  for (const [rawSessionId, rawSession] of Object.entries(value)) {
    const sessionId = normalizeIdentifier(rawSessionId);
    const modeId = normalizeIdentifier(rawSession?.modeId);
    const startedAt = normalizeTimestamp(rawSession?.startedAt);
    if (!sessionId || !modeId || !startedAt) {
      continue;
    }
    activeSessions[sessionId] = {
      sessionId,
      modeId,
      startedAt,
      playedOn: normalizeDayKey(rawSession?.playedOn, startedAt),
      context: normalizeContext(rawSession?.context),
    };
  }
  return activeSessions;
}

function normalizeAchievements(value) {
  const source = isRecord(value?.unlocked) ? value.unlocked : {};
  const unlocked = {};

  for (const [rawAchievementId, rawUnlock] of Object.entries(source)) {
    const achievementId = normalizeIdentifier(rawAchievementId);
    if (!achievementId || !isRecord(rawUnlock)) {
      continue;
    }
    unlocked[achievementId] = {
      id: achievementId,
      unlockedAt: normalizeTimestamp(rawUnlock.unlockedAt),
      modeId: normalizeIdentifier(rawUnlock.modeId),
      sessionId: normalizeIdentifier(rawUnlock.sessionId),
      metadata: normalizeContext(rawUnlock.metadata),
    };
  }

  return { unlocked };
}

function normalizeVersionTwoProgress(value, now) {
  const source = isRecord(value) ? value : {};
  const timestamp = resolveNow(now);
  const modes = normalizeModes(source.modes);
  const modeTotals = Object.values(modes).reduce(
    (totals, mode) => ({
      sessionsPlayed: totals.sessionsPlayed + mode.sessionsPlayed,
      completedSessions: totals.completedSessions + mode.completedSessions,
      abandonedSessions: totals.abandonedSessions + mode.abandonedSessions,
      wins: totals.wins + mode.wins,
      losses: totals.losses + mode.losses,
      draws: totals.draws + mode.draws,
      playTimeMs: totals.playTimeMs + mode.playTimeMs,
    }),
    {
      sessionsPlayed: 0,
      completedSessions: 0,
      abandonedSessions: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      playTimeMs: 0,
    },
  );
  const recentResults = [];
  for (const rawResult of Array.isArray(source.recentResults) ? source.recentResults : []) {
    const result = normalizeStoredResult(rawResult);
    if (!result || recentResults.some((entry) => entry.sessionId === result.sessionId)) {
      continue;
    }
    recentResults.push(result);
    if (recentResults.length >= GAME_PROGRESS_MAX_RECENT_RESULTS) {
      break;
    }
  }

  const currentDayStreak = nonNegativeInteger(source.totals?.currentDayStreak);
  const processedSessionIds = uniqueIdentifiers(
    [
      ...(Array.isArray(source.processedSessionIds) ? source.processedSessionIds : []),
      ...recentResults.map((result) => result.sessionId),
    ],
    GAME_PROGRESS_MAX_PROCESSED_SESSIONS,
  );

  return {
    version: GAME_PROGRESS_SCHEMA_VERSION,
    revision: nonNegativeInteger(source.revision),
    createdAt: normalizeTimestamp(source.createdAt, timestamp),
    updatedAt: normalizeTimestamp(source.updatedAt, source.createdAt ?? timestamp),
    totals: {
      sessionsPlayed: Math.max(
        nonNegativeInteger(source.totals?.sessionsPlayed),
        modeTotals.sessionsPlayed,
      ),
      completedSessions: Math.max(
        nonNegativeInteger(source.totals?.completedSessions),
        modeTotals.completedSessions,
      ),
      abandonedSessions: Math.max(
        nonNegativeInteger(source.totals?.abandonedSessions),
        modeTotals.abandonedSessions,
      ),
      wins: Math.max(nonNegativeInteger(source.totals?.wins), modeTotals.wins),
      losses: Math.max(nonNegativeInteger(source.totals?.losses), modeTotals.losses),
      draws: Math.max(nonNegativeInteger(source.totals?.draws), modeTotals.draws),
      playTimeMs: Math.max(
        nonNegativeNumber(source.totals?.playTimeMs),
        modeTotals.playTimeMs,
      ),
      activeDays: nonNegativeInteger(source.totals?.activeDays),
      currentDayStreak,
      longestDayStreak: Math.max(
        nonNegativeInteger(source.totals?.longestDayStreak),
        currentDayStreak,
      ),
      lastPlayedDay: isValidDayKey(source.totals?.lastPlayedDay)
        ? source.totals.lastPlayedDay
        : null,
    },
    modes,
    activeSessions: normalizeActiveSessions(source.activeSessions),
    recentResults,
    processedSessionIds,
    achievements: normalizeAchievements(source.achievements),
  };
}

function migrateLegacyProgressToVersionOne(value, now) {
  const source = isRecord(value) ? value : {};
  const legacyModes = isRecord(source.games)
    ? source.games
    : isRecord(source.modes)
      ? source.modes
      : {};
  const modes = {};

  for (const [rawModeId, rawMode] of Object.entries(legacyModes)) {
    const modeId = normalizeIdentifier(rawModeId);
    if (!modeId || !isRecord(rawMode)) {
      continue;
    }
    const lastPlayedAt = normalizeTimestamp(rawMode.lastPlayedAt, rawMode.lastResult?.endedAt);
    const lastScore = finiteNumber(rawMode.lastScore, finiteNumber(rawMode.lastResult?.score));
    modes[modeId] = {
      ...rawMode,
      bestScore: finiteNumber(rawMode.bestScore, finiteNumber(rawMode.highScore)),
      lastResult:
        rawMode.lastResult ??
        (lastScore === null
          ? null
          : {
              sessionId: `legacy-${modeId}`,
              modeId,
              outcome: "completed",
              score: lastScore,
              endedAt: lastPlayedAt,
            }),
    };
  }

  return {
    version: 1,
    revision: nonNegativeInteger(source.revision),
    createdAt: normalizeTimestamp(source.createdAt, now),
    updatedAt: normalizeTimestamp(source.updatedAt, source.createdAt ?? now),
    totals: {
      sessionsPlayed: nonNegativeInteger(
        source.totalSessions,
        nonNegativeInteger(source.totals?.sessionsPlayed),
      ),
      completedSessions: nonNegativeInteger(source.totals?.completedSessions),
      abandonedSessions: nonNegativeInteger(source.totals?.abandonedSessions),
      wins: nonNegativeInteger(source.totals?.wins),
      losses: nonNegativeInteger(source.totals?.losses),
      draws: nonNegativeInteger(source.totals?.draws),
      playTimeMs: nonNegativeNumber(source.totals?.playTimeMs),
      activeDays: nonNegativeInteger(source.totals?.activeDays),
      currentDayStreak: nonNegativeInteger(
        source.currentStreak,
        nonNegativeInteger(source.totals?.currentDayStreak),
      ),
      longestDayStreak: nonNegativeInteger(
        source.longestStreak,
        nonNegativeInteger(source.totals?.longestDayStreak),
      ),
      lastPlayedDay: source.lastPlayedDay ?? source.totals?.lastPlayedDay ?? null,
    },
    modes,
    achievements: source.achievements,
  };
}

function migrateVersionOneToVersionTwo(value, now) {
  const source = isRecord(value) ? value : {};
  const modes = {};

  for (const [rawModeId, rawMode] of Object.entries(
    isRecord(source.modes) ? source.modes : {},
  )) {
    const modeId = normalizeIdentifier(rawModeId);
    if (!modeId || !isRecord(rawMode)) {
      continue;
    }
    const bestByMetric = isRecord(rawMode.bestByMetric)
      ? { ...rawMode.bestByMetric }
      : {};
    const bestScore = finiteNumber(rawMode.bestScore, finiteNumber(rawMode.highScore));
    if (bestScore !== null && !hasOwn(bestByMetric, "score")) {
      bestByMetric.score = {
        value: bestScore,
        comparison: BEST_METRIC_COMPARISONS.HIGHER,
        achievedAt: normalizeTimestamp(rawMode.bestScoreAt, rawMode.lastPlayedAt),
        sessionId: normalizeIdentifier(rawMode.bestScoreSessionId),
      };
    }
    modes[modeId] = {
      ...rawMode,
      bestByMetric,
    };
  }

  let unlocked = {};
  if (Array.isArray(source.achievements)) {
    unlocked = Object.fromEntries(
      uniqueIdentifiers(source.achievements, 256).map((id) => [
        id,
        {
          id,
          unlockedAt: normalizeTimestamp(now),
          modeId: null,
          sessionId: null,
          metadata: {},
        },
      ]),
    );
  } else if (isRecord(source.achievements?.unlocked)) {
    unlocked = source.achievements.unlocked;
  } else if (isRecord(source.achievements)) {
    unlocked = source.achievements;
  }

  const recentResults = Object.entries(modes)
    .map(([, mode]) => mode.lastResult)
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = timestampToMilliseconds(left.endedAt) || 0;
      const rightTime = timestampToMilliseconds(right.endedAt) || 0;
      return rightTime - leftTime;
    });

  return {
    ...source,
    version: 2,
    modes,
    activeSessions: isRecord(source.activeSessions) ? source.activeSessions : {},
    recentResults: Array.isArray(source.recentResults)
      ? source.recentResults
      : recentResults,
    processedSessionIds: Array.isArray(source.processedSessionIds)
      ? source.processedSessionIds
      : recentResults.map((result) => result?.sessionId).filter(Boolean),
    achievements: { unlocked },
  };
}

const MIGRATIONS = Object.freeze({
  0: migrateLegacyProgressToVersionOne,
  1: migrateVersionOneToVersionTwo,
});

export function createInitialGameProgression({ now } = {}) {
  const timestamp = resolveNow(now);
  return normalizeVersionTwoProgress(
    {
      version: GAME_PROGRESS_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    timestamp,
  );
}

export function migrateGameProgression(value, { now } = {}) {
  const timestamp = resolveNow(now);
  let candidate = isRecord(value) ? value : {};
  let version = Number.isInteger(candidate.version) && candidate.version >= 0
    ? candidate.version
    : 0;

  if (version > GAME_PROGRESS_SCHEMA_VERSION) {
    throw new UnsupportedGameProgressVersionError(version);
  }

  while (version < GAME_PROGRESS_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      throw new Error(`No game progress migration is registered for schema version ${version}.`);
    }
    candidate = migrate(candidate, timestamp);
    version = candidate.version;
  }

  return normalizeVersionTwoProgress(candidate, timestamp);
}

export function normalizeGameProgression(value, options) {
  return migrateGameProgression(value, options);
}

function updateDailyStreak(totals, playedOn) {
  if (!totals.lastPlayedDay) {
    return {
      ...totals,
      activeDays: totals.activeDays + 1,
      currentDayStreak: 1,
      longestDayStreak: Math.max(totals.longestDayStreak, 1),
      lastPlayedDay: playedOn,
    };
  }

  const distance = dayDistance(totals.lastPlayedDay, playedOn);
  if (distance === null || distance <= 0) {
    return totals;
  }

  const currentDayStreak = distance === 1 ? totals.currentDayStreak + 1 : 1;
  return {
    ...totals,
    activeDays: totals.activeDays + 1,
    currentDayStreak,
    longestDayStreak: Math.max(totals.longestDayStreak, currentDayStreak),
    lastPlayedDay: playedOn,
  };
}

export function beginGameSession(progress, session, { now } = {}) {
  const current = migrateGameProgression(progress, { now });
  const sessionId = requireIdentifier(session?.sessionId, "sessionId");
  const modeId = requireIdentifier(session?.modeId, "modeId");

  if (current.processedSessionIds.includes(sessionId)) {
    return current;
  }

  const existingSession = current.activeSessions[sessionId];
  if (existingSession) {
    if (existingSession.modeId !== modeId) {
      throw new RangeError(`Session ${sessionId} is already assigned to ${existingSession.modeId}.`);
    }
    return current;
  }

  const startedAt = normalizeTimestamp(session?.startedAt, resolveNow(now));
  const playedOn = normalizeDayKey(session?.playedOn, startedAt);
  const mode = current.modes[modeId] ?? createEmptyModeProgress();
  const totals = updateDailyStreak(
    {
      ...current.totals,
      sessionsPlayed: current.totals.sessionsPlayed + 1,
    },
    playedOn,
  );

  return {
    ...current,
    revision: current.revision + 1,
    updatedAt: startedAt,
    totals,
    modes: {
      ...current.modes,
      [modeId]: {
        ...mode,
        sessionsPlayed: mode.sessionsPlayed + 1,
        lastPlayedAt: startedAt,
      },
    },
    activeSessions: {
      ...current.activeSessions,
      [sessionId]: {
        sessionId,
        modeId,
        startedAt,
        playedOn,
        context: normalizeContext(session?.context),
      },
    },
  };
}

function isBetterMetric(value, previous, comparison) {
  if (!previous) {
    return true;
  }
  return comparison === BEST_METRIC_COMPARISONS.LOWER
    ? value < previous.value
    : value > previous.value;
}

function outcomeCounterChanges(outcome) {
  return {
    completedSessions: outcome === "abandoned" ? 0 : 1,
    abandonedSessions: outcome === "abandoned" ? 1 : 0,
    wins: outcome === "won" ? 1 : 0,
    losses: outcome === "lost" ? 1 : 0,
    draws: outcome === "draw" ? 1 : 0,
  };
}

function addOutcomeCounters(target, changes, durationMs) {
  return {
    ...target,
    completedSessions: target.completedSessions + changes.completedSessions,
    abandonedSessions: target.abandonedSessions + changes.abandonedSessions,
    wins: target.wins + changes.wins,
    losses: target.losses + changes.losses,
    draws: target.draws + changes.draws,
    playTimeMs: target.playTimeMs + durationMs,
  };
}

function calculateWinStreak(mode, outcome) {
  if (outcome === "won") {
    const currentWinStreak = mode.currentWinStreak + 1;
    return {
      currentWinStreak,
      longestWinStreak: Math.max(mode.longestWinStreak, currentWinStreak),
    };
  }
  if (outcome === "abandoned") {
    return {
      currentWinStreak: mode.currentWinStreak,
      longestWinStreak: mode.longestWinStreak,
    };
  }
  return {
    currentWinStreak: 0,
    longestWinStreak: mode.longestWinStreak,
  };
}

function evaluateAchievementDefinitions(definitions, context) {
  const unlocks = [];
  const seen = new Set();

  for (const definition of Array.isArray(definitions) ? definitions : []) {
    const id = normalizeIdentifier(definition?.id);
    if (
      !id ||
      seen.has(id) ||
      context.progress.achievements.unlocked[id] ||
      typeof definition.evaluate !== "function"
    ) {
      continue;
    }
    seen.add(id);

    let evaluation;
    try {
      evaluation = definition.evaluate(context);
    } catch {
      continue;
    }

    const unlocked = evaluation === true || evaluation?.unlocked === true;
    if (!unlocked) {
      continue;
    }

    unlocks.push({
      id,
      unlockedAt: context.result.endedAt,
      modeId: context.result.modeId,
      sessionId: context.result.sessionId,
      metadata: normalizeContext(evaluation?.metadata ?? definition.metadata),
    });
  }

  return unlocks;
}

export function recordGameResult(
  progress,
  result,
  { now, achievementDefinitions = [] } = {},
) {
  const previousProgress = migrateGameProgression(progress, { now });
  const sessionId = requireIdentifier(result?.sessionId, "sessionId");
  const modeId = requireIdentifier(result?.modeId, "modeId");

  if (previousProgress.processedSessionIds.includes(sessionId)) {
    return {
      progress: previousProgress,
      result:
        previousProgress.recentResults.find((entry) => entry.sessionId === sessionId) ?? null,
      duplicate: true,
      implicitSession: false,
      personalBests: [],
      achievementUnlocks: [],
    };
  }

  const activeSession = previousProgress.activeSessions[sessionId];
  if (activeSession && activeSession.modeId !== modeId) {
    throw new RangeError(`Session ${sessionId} belongs to ${activeSession.modeId}, not ${modeId}.`);
  }

  const implicitSession = !activeSession;
  const withSession = activeSession
    ? previousProgress
    : beginGameSession(
        previousProgress,
        {
          sessionId,
          modeId,
          startedAt: result?.startedAt ?? result?.endedAt,
          playedOn: result?.playedOn,
          context: result?.context,
        },
        { now },
      );
  const sessionState = withSession.activeSessions[sessionId];
  const endedAt = normalizeTimestamp(result?.endedAt, resolveNow(now));
  const startedAt = normalizeTimestamp(
    sessionState?.startedAt ?? result?.startedAt,
    endedAt,
  );
  const calculatedDuration = Math.max(
    0,
    timestampToMilliseconds(endedAt) - timestampToMilliseconds(startedAt),
  );
  const durationMs = boundedDuration(result?.durationMs, calculatedDuration);
  const outcome = GAME_RESULT_OUTCOMES.includes(result?.outcome)
    ? result.outcome
    : "completed";
  const metrics = normalizeMetrics(result?.metrics);
  const score = finiteNumber(result?.score, finiteNumber(metrics.score));
  if (score !== null) {
    metrics.score = score;
  }

  const mode = withSession.modes[modeId] ?? createEmptyModeProgress();
  const bestByMetric = { ...mode.bestByMetric };
  const personalBests = [];
  const eligibleForBest = outcome !== "abandoned" && result?.eligibleForBest !== false;
  const comparisons = isRecord(result?.metricComparisons)
    ? result.metricComparisons
    : {};

  if (eligibleForBest) {
    for (const [metricId, value] of Object.entries(metrics)) {
      const previousBest = bestByMetric[metricId] ?? null;
      const comparison = previousBest?.comparison ?? normalizeComparison(comparisons[metricId]);
      if (!isBetterMetric(value, previousBest, comparison)) {
        continue;
      }
      bestByMetric[metricId] = {
        value,
        comparison,
        achievedAt: endedAt,
        sessionId,
      };
      personalBests.push({
        metricId,
        value,
        previousValue: previousBest?.value ?? null,
        comparison,
      });
    }
  }

  const storedResult = {
    sessionId,
    modeId,
    outcome,
    score,
    metrics,
    durationMs,
    startedAt,
    endedAt,
    playedOn: sessionState?.playedOn ?? normalizeDayKey(result?.playedOn, startedAt),
    context: {
      ...(sessionState?.context ?? {}),
      ...normalizeContext(result?.context),
    },
    personalBestMetrics: personalBests.map((best) => best.metricId),
  };
  const changes = outcomeCounterChanges(outcome);
  const streaks = calculateWinStreak(mode, outcome);
  const nextMode = {
    ...addOutcomeCounters(mode, changes, durationMs),
    ...streaks,
    lastPlayedAt: endedAt,
    lastResult: storedResult,
    bestByMetric,
  };
  const activeSessions = { ...withSession.activeSessions };
  delete activeSessions[sessionId];

  let nextProgress = {
    ...withSession,
    revision: withSession.revision + 1,
    updatedAt: endedAt,
    totals: addOutcomeCounters(withSession.totals, changes, durationMs),
    modes: {
      ...withSession.modes,
      [modeId]: nextMode,
    },
    activeSessions,
    recentResults: [
      storedResult,
      ...withSession.recentResults.filter((entry) => entry.sessionId !== sessionId),
    ].slice(0, GAME_PROGRESS_MAX_RECENT_RESULTS),
    processedSessionIds: [
      sessionId,
      ...withSession.processedSessionIds.filter((id) => id !== sessionId),
    ].slice(0, GAME_PROGRESS_MAX_PROCESSED_SESSIONS),
  };

  const achievementUnlocks = evaluateAchievementDefinitions(achievementDefinitions, {
    previousProgress,
    progress: nextProgress,
    result: storedResult,
    modeProgress: nextMode,
    personalBests,
  });
  if (achievementUnlocks.length > 0) {
    nextProgress = {
      ...nextProgress,
      achievements: {
        unlocked: {
          ...nextProgress.achievements.unlocked,
          ...Object.fromEntries(
            achievementUnlocks.map((unlock) => [unlock.id, unlock]),
          ),
        },
      },
    };
  }

  return {
    progress: nextProgress,
    result: storedResult,
    duplicate: false,
    implicitSession,
    personalBests,
    achievementUnlocks,
  };
}

export function abandonGameSession(
  progress,
  { sessionId, endedAt, context } = {},
  options,
) {
  const current = migrateGameProgression(progress, options);
  const normalizedSessionId = requireIdentifier(sessionId, "sessionId");
  const activeSession = current.activeSessions[normalizedSessionId];
  if (!activeSession) {
    throw new RangeError(`Cannot abandon unknown session ${normalizedSessionId}.`);
  }
  return recordGameResult(
    current,
    {
      sessionId: normalizedSessionId,
      modeId: activeSession.modeId,
      outcome: "abandoned",
      endedAt,
      context,
      eligibleForBest: false,
    },
    options,
  );
}

export function getModeProgress(progress, modeId, options) {
  const current = migrateGameProgression(progress, options);
  const normalizedModeId = requireIdentifier(modeId, "modeId");
  return current.modes[normalizedModeId] ?? createEmptyModeProgress();
}

export function getBestMetric(progress, modeId, metricId = "score", options) {
  const normalizedMetricId = requireIdentifier(metricId, "metricId");
  return getModeProgress(progress, modeId, options).bestByMetric[normalizedMetricId] ?? null;
}

export function createSessionMilestoneAchievement({ id, count, modeId = null }) {
  const achievementId = requireIdentifier(id, "achievement id");
  const requiredSessions = Math.max(1, nonNegativeInteger(count, 1));
  const normalizedModeId = modeId === null ? null : requireIdentifier(modeId, "modeId");
  return {
    id: achievementId,
    evaluate({ progress }) {
      const sessionsPlayed = normalizedModeId
        ? progress.modes[normalizedModeId]?.sessionsPlayed ?? 0
        : progress.totals.sessionsPlayed;
      return sessionsPlayed >= requiredSessions;
    },
  };
}

export function createWinStreakAchievement({ id, count, modeId }) {
  const achievementId = requireIdentifier(id, "achievement id");
  const normalizedModeId = requireIdentifier(modeId, "modeId");
  const requiredWins = Math.max(1, nonNegativeInteger(count, 1));
  return {
    id: achievementId,
    evaluate({ progress }) {
      return (progress.modes[normalizedModeId]?.currentWinStreak ?? 0) >= requiredWins;
    },
  };
}

export function createMetricAchievement({
  id,
  metricId = "score",
  threshold,
  modeId = null,
  comparison = BEST_METRIC_COMPARISONS.HIGHER,
}) {
  const achievementId = requireIdentifier(id, "achievement id");
  const normalizedMetricId = requireIdentifier(metricId, "metricId");
  const normalizedModeId = modeId === null ? null : requireIdentifier(modeId, "modeId");
  if (!Number.isFinite(threshold)) {
    throw new TypeError("achievement threshold must be a finite number.");
  }
  const normalizedComparison = normalizeComparison(comparison);
  return {
    id: achievementId,
    evaluate({ result }) {
      if (normalizedModeId && result.modeId !== normalizedModeId) {
        return false;
      }
      const value = result.metrics[normalizedMetricId];
      if (!Number.isFinite(value)) {
        return false;
      }
      return normalizedComparison === BEST_METRIC_COMPARISONS.LOWER
        ? value <= threshold
        : value >= threshold;
    },
  };
}
