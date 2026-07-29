export const WHACK_A_MOLE_GAME_VERSION = 1;

export const WHACK_A_MOLE_PHASES = Object.freeze({
  IDLE: "idle",
  TEACH: "teach",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  PAUSED: "paused",
  RESULT: "result",
});

export const WHACK_A_MOLE_ACTIONS = Object.freeze({
  START: "start",
  TICK: "tick",
  HIT_HOLE: "hit-hole",
  PAUSE: "pause",
  RESUME: "resume",
  RESET: "reset",
});

export const WHACK_A_MOLE_TARGET_TYPES = Object.freeze({
  NORMAL: "normal",
  GOLD: "gold",
  DECOY: "decoy",
});

export const WHACK_A_MOLE_TARGET_STATES = Object.freeze({
  TELEGRAPH: "telegraph",
  ACTIVE: "active",
});

export const WHACK_A_MOLE_DEFAULTS = Object.freeze({
  roundDurationMs: 30_000,
  teachDurationMs: 2_400,
  countdownDurationMs: 3_000,
  holeCount: 9,
  normalPoints: 100,
  goldPoints: 300,
  decoyPenalty: 125,
  streakBonusStep: 15,
  maxStreakBonus: 120,
});

const UINT32_RANGE = 0x1_0000_0000;

function finiteNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const normalized = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(maximum, Math.max(minimum, normalized));
}

function normalizeTimestamp(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finiteNumber(value, 0)));
}

function normalizeSeed(seed) {
  if (
    typeof seed === "string" ||
    typeof seed === "number" ||
    typeof seed === "bigint"
  ) {
    return String(seed).slice(0, 160);
  }
  return "whack-a-mole";
}

export function hashWhackAMoleSeed(seed) {
  const text = normalizeSeed(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const normalized = hash >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

function nextRandom(rngState) {
  let nextState = rngState >>> 0;
  nextState ^= nextState << 13;
  nextState ^= nextState >>> 17;
  nextState ^= nextState << 5;
  nextState >>>= 0;
  if (nextState === 0) {
    nextState = 0x6d2b79f5;
  }
  return {
    rngState: nextState,
    value: nextState / UINT32_RANGE,
  };
}

function normalizeDailyDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    ) {
      return value;
    }
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return "1970-01-01";
}

export function createDailyWhackAMoleSeed(
  date,
  challengeId = "standard",
) {
  const safeChallengeId =
    typeof challengeId === "string" && challengeId.trim()
      ? challengeId.trim().slice(0, 48)
      : "standard";
  return `whack-a-mole:daily:${normalizeDailyDate(date)}:${safeChallengeId}`;
}

export function normalizeWhackAMoleConfig(config = {}) {
  return {
    roundDurationMs: boundedInteger(
      config.roundDurationMs,
      WHACK_A_MOLE_DEFAULTS.roundDurationMs,
      1_000,
      120_000,
    ),
    teachDurationMs: boundedInteger(
      config.teachDurationMs,
      WHACK_A_MOLE_DEFAULTS.teachDurationMs,
      0,
      10_000,
    ),
    countdownDurationMs: boundedInteger(
      config.countdownDurationMs,
      WHACK_A_MOLE_DEFAULTS.countdownDurationMs,
      0,
      10_000,
    ),
    holeCount: boundedInteger(
      config.holeCount,
      WHACK_A_MOLE_DEFAULTS.holeCount,
      4,
      9,
    ),
    normalPoints: boundedInteger(
      config.normalPoints,
      WHACK_A_MOLE_DEFAULTS.normalPoints,
      1,
      10_000,
    ),
    goldPoints: boundedInteger(
      config.goldPoints,
      WHACK_A_MOLE_DEFAULTS.goldPoints,
      1,
      25_000,
    ),
    decoyPenalty: boundedInteger(
      config.decoyPenalty,
      WHACK_A_MOLE_DEFAULTS.decoyPenalty,
      0,
      10_000,
    ),
    streakBonusStep: boundedInteger(
      config.streakBonusStep,
      WHACK_A_MOLE_DEFAULTS.streakBonusStep,
      0,
      1_000,
    ),
    maxStreakBonus: boundedInteger(
      config.maxStreakBonus,
      WHACK_A_MOLE_DEFAULTS.maxStreakBonus,
      0,
      5_000,
    ),
  };
}

/**
 * Returns the continuously paced spawn budget for one active-round timestamp.
 * The curve shortens telegraphs, target visibility, and gaps while gradually
 * introducing more decoys and slightly more gold targets.
 */
export function getWhackAMoleDifficulty(
  elapsedMs,
  roundDurationMs = WHACK_A_MOLE_DEFAULTS.roundDurationMs,
) {
  const duration = Math.max(1, finiteNumber(roundDurationMs, 1));
  const progress = clamp01(finiteNumber(elapsedMs, 0) / duration);
  const tier =
    progress < 0.25
      ? 1
      : progress < 0.55
        ? 2
        : progress < 0.82
          ? 3
          : 4;
  return {
    progress,
    tier,
    label:
      tier === 1
        ? "Warm-up"
        : tier === 2
          ? "Picking up"
          : tier === 3
            ? "Fast"
            : "Final rush",
    telegraphMs: Math.round(520 - progress * 280),
    visibleMs: Math.round(1_100 - progress * 500),
    spawnDelayMinMs: Math.round(760 - progress * 390),
    spawnDelayMaxMs: Math.round(1_080 - progress * 510),
    goldChance: 0.08 + progress * 0.07,
    decoyChance: 0.04 + progress * 0.18,
  };
}

function createBaseState({ seed = "whack-a-mole", config } = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const normalizedConfig = normalizeWhackAMoleConfig(config);
  return {
    version: WHACK_A_MOLE_GAME_VERSION,
    phase: WHACK_A_MOLE_PHASES.IDLE,
    status: "idle",
    seed: normalizedSeed,
    rngState: hashWhackAMoleSeed(normalizedSeed),
    config: normalizedConfig,
    phaseStartedAt: null,
    phaseEndsAt: null,
    phaseRemainingMs: 0,
    pausedPhase: null,
    pausedPhaseRemainingMs: null,
    elapsedMs: 0,
    remainingMs: normalizedConfig.roundDurationMs,
    lastTickAt: null,
    target: null,
    nextSpawnAt: 0,
    lastHoleIndex: -1,
    targetSequence: 0,
    targetsShown: 0,
    normalTargetsShown: 0,
    goldTargetsShown: 0,
    decoyTargetsShown: 0,
    score: 0,
    hits: 0,
    normalHits: 0,
    goldHits: 0,
    decoyHits: 0,
    decoysAvoided: 0,
    misses: 0,
    expiredTargets: 0,
    attempts: 0,
    streak: 0,
    bestStreak: 0,
    reactionTimeTotalMs: 0,
    reactionSamples: 0,
    fastestHitMs: null,
    lastReactionMs: null,
    lastAction: null,
    announcement:
      "Ready, Set, Whack is ready. Start when you have room to point or tap.",
    result: null,
    transitionCount: 0,
  };
}

export function createWhackAMoleGame(options = {}) {
  const state = createBaseState(options);
  if (options.autoStart) {
    return startWhackAMoleGame(state, {
      now: options.now,
      seed: options.seed,
      config: options.config,
    });
  }
  return state;
}

export function getWhackAMoleStats(state) {
  const hits = Math.max(0, boundedInteger(state?.hits, 0, 0, 1_000_000));
  const misses = Math.max(
    0,
    boundedInteger(state?.misses, 0, 0, 1_000_000),
  );
  const opportunities = hits + misses;
  const reactionSamples = Math.max(
    0,
    boundedInteger(state?.reactionSamples, 0, 0, 1_000_000),
  );
  return {
    hits,
    misses,
    opportunities,
    accuracy: opportunities > 0 ? hits / opportunities : 0,
    accuracyPercent: opportunities > 0 ? (hits / opportunities) * 100 : 0,
    averageHitTimeMs:
      reactionSamples > 0
        ? Math.round(state.reactionTimeTotalMs / reactionSamples)
        : null,
    fastestHitMs:
      Number.isFinite(state?.fastestHitMs)
        ? Math.max(0, Math.round(state.fastestHitMs))
        : null,
  };
}

export function getWhackAMoleSummary(state) {
  const stats = getWhackAMoleStats(state);
  return {
    completed: state?.phase === WHACK_A_MOLE_PHASES.RESULT,
    status:
      state?.phase === WHACK_A_MOLE_PHASES.RESULT
        ? "completed"
        : state?.status ?? "idle",
    gameRunning: state?.phase === WHACK_A_MOLE_PHASES.PLAYING,
    timeLeft: Math.max(0, Math.ceil((state?.remainingMs ?? 0) / 1_000)),
    timeLeftSeconds: Math.max(
      0,
      Math.ceil((state?.remainingMs ?? 0) / 1_000),
    ),
    durationMs: state?.config?.roundDurationMs ?? 0,
    score: Math.max(0, Math.round(state?.score ?? 0)),
    hits: stats.hits,
    attempts: stats.opportunities,
    misses: stats.misses,
    targetsShown: Math.max(0, Math.round(state?.targetsShown ?? 0)),
    accuracyPercent: stats.accuracyPercent,
    averageHitTimeMs: stats.averageHitTimeMs,
    fastestHitMs: stats.fastestHitMs,
    bestStreak: Math.max(0, Math.round(state?.bestStreak ?? 0)),
    normalHits: Math.max(0, Math.round(state?.normalHits ?? 0)),
    goldHits: Math.max(0, Math.round(state?.goldHits ?? 0)),
    decoyHits: Math.max(0, Math.round(state?.decoyHits ?? 0)),
    decoysAvoided: Math.max(0, Math.round(state?.decoysAvoided ?? 0)),
    seed: state?.seed ?? "whack-a-mole",
  };
}

export function startWhackAMoleGame(
  previousState,
  { now = 0, seed = previousState?.seed, config } = {},
) {
  const timestamp = normalizeTimestamp(now);
  const base = createBaseState({
    seed,
    config: config ?? previousState?.config,
  });
  const next = {
    ...base,
    phase: WHACK_A_MOLE_PHASES.TEACH,
    status: "teaching",
    phaseStartedAt: timestamp,
    phaseEndsAt: timestamp + base.config.teachDurationMs,
    phaseRemainingMs: base.config.teachDurationMs,
    lastTickAt: timestamp,
    announcement:
      "Hit garden moles, chase gold targets, and leave red decoys alone.",
    transitionCount: (previousState?.transitionCount ?? 0) + 1,
  };
  return tickWhackAMoleGame(next, { now: timestamp });
}

function beginCountdown(state, startedAt) {
  return {
    ...state,
    phase: WHACK_A_MOLE_PHASES.COUNTDOWN,
    status: "countdown",
    phaseStartedAt: startedAt,
    phaseEndsAt: startedAt + state.config.countdownDurationMs,
    phaseRemainingMs: state.config.countdownDurationMs,
    lastTickAt: startedAt,
    announcement: "Get ready. The round begins after the countdown.",
    transitionCount: state.transitionCount + 1,
  };
}

function beginPlaying(state, startedAt) {
  return {
    ...state,
    phase: WHACK_A_MOLE_PHASES.PLAYING,
    status: "playing",
    phaseStartedAt: startedAt,
    phaseEndsAt: null,
    phaseRemainingMs: 0,
    elapsedMs: 0,
    remainingMs: state.config.roundDurationMs,
    lastTickAt: startedAt,
    nextSpawnAt: 0,
    announcement: "Go! Watch for the ripple, then hit the target.",
    transitionCount: state.transitionCount + 1,
  };
}

function chooseHole(state) {
  const draw = nextRandom(state.rngState);
  const count = state.config.holeCount;
  if (count <= 1) {
    return { holeIndex: 0, rngState: draw.rngState };
  }
  const eligibleCount = count - (state.lastHoleIndex >= 0 ? 1 : 0);
  let holeIndex = Math.floor(draw.value * eligibleCount);
  if (state.lastHoleIndex >= 0 && holeIndex >= state.lastHoleIndex) {
    holeIndex += 1;
  }
  return {
    holeIndex: Math.min(count - 1, Math.max(0, holeIndex)),
    rngState: draw.rngState,
  };
}

function chooseTargetType(rngState, difficulty) {
  const draw = nextRandom(rngState);
  let type = WHACK_A_MOLE_TARGET_TYPES.NORMAL;
  if (draw.value < difficulty.goldChance) {
    type = WHACK_A_MOLE_TARGET_TYPES.GOLD;
  } else if (
    draw.value <
    difficulty.goldChance + difficulty.decoyChance
  ) {
    type = WHACK_A_MOLE_TARGET_TYPES.DECOY;
  }
  return { type, rngState: draw.rngState };
}

function spawnTarget(state, spawnAt) {
  const difficulty = getWhackAMoleDifficulty(
    spawnAt,
    state.config.roundDurationMs,
  );
  if (
    state.config.roundDurationMs - spawnAt <
    difficulty.telegraphMs + Math.min(300, difficulty.visibleMs)
  ) {
    return {
      ...state,
      nextSpawnAt: Number.POSITIVE_INFINITY,
    };
  }
  const hole = chooseHole(state);
  const targetType = chooseTargetType(hole.rngState, difficulty);
  const targetSequence = state.targetSequence + 1;
  return {
    ...state,
    rngState: targetType.rngState,
    lastHoleIndex: hole.holeIndex,
    targetSequence,
    target: {
      id: `target-${targetSequence}`,
      holeIndex: hole.holeIndex,
      type: targetType.type,
      state: WHACK_A_MOLE_TARGET_STATES.TELEGRAPH,
      telegraphStartedAt: spawnAt,
      activeAt: spawnAt + difficulty.telegraphMs,
      expiresAt:
        spawnAt + difficulty.telegraphMs + difficulty.visibleMs,
      difficultyTier: difficulty.tier,
    },
    nextSpawnAt: Number.POSITIVE_INFINITY,
    announcement: `Target incoming at hole ${hole.holeIndex + 1}.`,
  };
}

function scheduleNextSpawn(state, resolvedAt) {
  const difficulty = getWhackAMoleDifficulty(
    resolvedAt,
    state.config.roundDurationMs,
  );
  const draw = nextRandom(state.rngState);
  const delay =
    difficulty.spawnDelayMinMs +
    draw.value *
      (difficulty.spawnDelayMaxMs - difficulty.spawnDelayMinMs);
  return {
    ...state,
    rngState: draw.rngState,
    nextSpawnAt: resolvedAt + Math.round(delay),
  };
}

function activateTarget(state) {
  const target = {
    ...state.target,
    state: WHACK_A_MOLE_TARGET_STATES.ACTIVE,
  };
  const type = target.type;
  return {
    ...state,
    target,
    targetsShown: state.targetsShown + 1,
    normalTargetsShown:
      state.normalTargetsShown +
      (type === WHACK_A_MOLE_TARGET_TYPES.NORMAL ? 1 : 0),
    goldTargetsShown:
      state.goldTargetsShown +
      (type === WHACK_A_MOLE_TARGET_TYPES.GOLD ? 1 : 0),
    decoyTargetsShown:
      state.decoyTargetsShown +
      (type === WHACK_A_MOLE_TARGET_TYPES.DECOY ? 1 : 0),
    announcement:
      type === WHACK_A_MOLE_TARGET_TYPES.DECOY
        ? `Decoy at hole ${target.holeIndex + 1}. Do not hit it.`
        : type === WHACK_A_MOLE_TARGET_TYPES.GOLD
          ? `Gold target at hole ${target.holeIndex + 1}.`
          : `Target active at hole ${target.holeIndex + 1}.`,
  };
}

function expireTarget(state, expiredAt) {
  const isDecoy =
    state.target.type === WHACK_A_MOLE_TARGET_TYPES.DECOY;
  const next = {
    ...state,
    target: null,
    decoysAvoided: state.decoysAvoided + (isDecoy ? 1 : 0),
    misses: state.misses + (isDecoy ? 0 : 1),
    expiredTargets: state.expiredTargets + (isDecoy ? 0 : 1),
    streak: isDecoy ? state.streak : 0,
    announcement: isDecoy
      ? "Good restraint. The decoy passed safely."
      : "Target missed. Watch the next ripple.",
  };
  return scheduleNextSpawn(next, expiredAt);
}

function processPlayingTimeline(state, elapsedMs) {
  let next = state;
  for (let guard = 0; guard < 128; guard += 1) {
    if (next.target) {
      if (
        next.target.state === WHACK_A_MOLE_TARGET_STATES.TELEGRAPH &&
        elapsedMs >= next.target.activeAt
      ) {
        next = activateTarget(next);
        continue;
      }
      if (
        next.target.state === WHACK_A_MOLE_TARGET_STATES.ACTIVE &&
        elapsedMs >= next.target.expiresAt
      ) {
        next = expireTarget(next, next.target.expiresAt);
        continue;
      }
      break;
    }
    if (
      elapsedMs >= next.nextSpawnAt &&
      next.nextSpawnAt < next.config.roundDurationMs
    ) {
      next = spawnTarget(next, next.nextSpawnAt);
      continue;
    }
    break;
  }
  return next;
}

function finishRound(state, timestamp) {
  const stats = getWhackAMoleStats(state);
  const result = {
    ...getWhackAMoleSummary({
      ...state,
      phase: WHACK_A_MOLE_PHASES.RESULT,
      remainingMs: 0,
    }),
    outcome: "completed",
  };
  return {
    ...state,
    phase: WHACK_A_MOLE_PHASES.RESULT,
    status: "completed",
    phaseStartedAt: timestamp,
    phaseEndsAt: null,
    phaseRemainingMs: 0,
    elapsedMs: state.config.roundDurationMs,
    remainingMs: 0,
    lastTickAt: timestamp,
    target: null,
    nextSpawnAt: Number.POSITIVE_INFINITY,
    result,
    announcement: `Round complete. ${state.hits} hits, ${Math.round(stats.accuracyPercent)} percent accuracy, best streak ${state.bestStreak}.`,
    transitionCount: state.transitionCount + 1,
  };
}

export function tickWhackAMoleGame(state, { now = 0 } = {}) {
  if (
    !state ||
    state.phase === WHACK_A_MOLE_PHASES.IDLE ||
    state.phase === WHACK_A_MOLE_PHASES.PAUSED ||
    state.phase === WHACK_A_MOLE_PHASES.RESULT
  ) {
    return state;
  }
  const timestamp = Math.max(
    normalizeTimestamp(now),
    normalizeTimestamp(state.lastTickAt),
  );
  let next = state;

  if (next.phase === WHACK_A_MOLE_PHASES.TEACH) {
    if (timestamp < next.phaseEndsAt) {
      return {
        ...next,
        phaseRemainingMs: next.phaseEndsAt - timestamp,
        lastTickAt: timestamp,
      };
    }
    next = beginCountdown(next, next.phaseEndsAt);
  }
  if (next.phase === WHACK_A_MOLE_PHASES.COUNTDOWN) {
    if (timestamp < next.phaseEndsAt) {
      return {
        ...next,
        phaseRemainingMs: next.phaseEndsAt - timestamp,
        lastTickAt: timestamp,
      };
    }
    next = beginPlaying(next, next.phaseEndsAt);
  }
  if (next.phase !== WHACK_A_MOLE_PHASES.PLAYING) {
    return next;
  }

  const deltaMs = Math.max(0, timestamp - next.lastTickAt);
  const elapsedMs = Math.min(
    next.config.roundDurationMs,
    next.elapsedMs + deltaMs,
  );
  next = processPlayingTimeline(next, elapsedMs);
  next = {
    ...next,
    elapsedMs,
    remainingMs: Math.max(0, next.config.roundDurationMs - elapsedMs),
    lastTickAt: timestamp,
  };
  if (elapsedMs >= next.config.roundDurationMs) {
    return finishRound(next, timestamp);
  }
  return next;
}

function resolveHitTarget(state, timestamp, source) {
  const target = state.target;
  const reactionMs = Math.max(0, state.elapsedMs - target.activeAt);
  const isGold = target.type === WHACK_A_MOLE_TARGET_TYPES.GOLD;
  const nextStreak = state.streak + 1;
  const streakBonus = Math.min(
    state.config.maxStreakBonus,
    Math.max(0, nextStreak - 1) * state.config.streakBonusStep,
  );
  const points =
    (isGold ? state.config.goldPoints : state.config.normalPoints) +
    streakBonus;
  const next = {
    ...state,
    target: null,
    score: state.score + points,
    hits: state.hits + 1,
    normalHits:
      state.normalHits +
      (target.type === WHACK_A_MOLE_TARGET_TYPES.NORMAL ? 1 : 0),
    goldHits: state.goldHits + (isGold ? 1 : 0),
    attempts: state.attempts + 1,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    reactionTimeTotalMs: state.reactionTimeTotalMs + reactionMs,
    reactionSamples: state.reactionSamples + 1,
    fastestHitMs:
      state.fastestHitMs === null
        ? reactionMs
        : Math.min(state.fastestHitMs, reactionMs),
    lastReactionMs: reactionMs,
    lastAction: {
      kind: "hit",
      holeIndex: target.holeIndex,
      targetType: target.type,
      points,
      reactionMs,
      source,
      at: timestamp,
    },
    announcement: `${isGold ? "Gold target" : "Hit"}! ${points} points. Streak ${nextStreak}.`,
  };
  return scheduleNextSpawn(next, state.elapsedMs);
}

function resolveDecoyHit(state, timestamp, source) {
  const target = state.target;
  const next = {
    ...state,
    target: null,
    score: Math.max(0, state.score - state.config.decoyPenalty),
    decoyHits: state.decoyHits + 1,
    misses: state.misses + 1,
    attempts: state.attempts + 1,
    streak: 0,
    lastReactionMs: null,
    lastAction: {
      kind: "decoy-hit",
      holeIndex: target.holeIndex,
      targetType: target.type,
      points: -state.config.decoyPenalty,
      source,
      at: timestamp,
    },
    announcement: `Decoy hit. Lose ${state.config.decoyPenalty} points; streak reset.`,
  };
  return scheduleNextSpawn(next, state.elapsedMs);
}

export function hitWhackAMoleHole(
  state,
  { holeIndex, now = 0, source = "pointer" } = {},
) {
  if (state?.phase !== WHACK_A_MOLE_PHASES.PLAYING) {
    return state;
  }
  const timestamp = Math.max(
    normalizeTimestamp(now),
    normalizeTimestamp(state.lastTickAt),
  );
  const current = tickWhackAMoleGame(state, { now: timestamp });
  if (current.phase !== WHACK_A_MOLE_PHASES.PLAYING) {
    return current;
  }
  const normalizedHoleIndex = boundedInteger(
    holeIndex,
    -1,
    -1,
    current.config.holeCount - 1,
  );
  const activeTarget =
    current.target?.state === WHACK_A_MOLE_TARGET_STATES.ACTIVE
      ? current.target
      : null;
  if (activeTarget && activeTarget.holeIndex === normalizedHoleIndex) {
    return activeTarget.type === WHACK_A_MOLE_TARGET_TYPES.DECOY
      ? resolveDecoyHit(current, timestamp, source)
      : resolveHitTarget(current, timestamp, source);
  }

  return {
    ...current,
    attempts: current.attempts + 1,
    misses: current.misses + 1,
    streak: 0,
    lastReactionMs: null,
    lastAction: {
      kind: activeTarget ? "wrong-hole" : "empty-hit",
      holeIndex: normalizedHoleIndex,
      source,
      at: timestamp,
    },
    announcement: activeTarget
      ? "Wrong hole. The target is still active."
      : current.target?.state === WHACK_A_MOLE_TARGET_STATES.TELEGRAPH
        ? "Too soon. Wait for the target to appear."
        : "Empty hole. Watch for the next ripple.",
  };
}

export function pauseWhackAMoleGame(state, { now = 0 } = {}) {
  if (
    !state ||
    state.phase === WHACK_A_MOLE_PHASES.IDLE ||
    state.phase === WHACK_A_MOLE_PHASES.PAUSED ||
    state.phase === WHACK_A_MOLE_PHASES.RESULT
  ) {
    return state;
  }
  const timestamp = Math.max(
    normalizeTimestamp(now),
    normalizeTimestamp(state.lastTickAt),
  );
  const current = tickWhackAMoleGame(state, { now: timestamp });
  if (current.phase === WHACK_A_MOLE_PHASES.RESULT) {
    return current;
  }
  const isPreRound =
    current.phase === WHACK_A_MOLE_PHASES.TEACH ||
    current.phase === WHACK_A_MOLE_PHASES.COUNTDOWN;
  return {
    ...current,
    phase: WHACK_A_MOLE_PHASES.PAUSED,
    status: "paused",
    pausedPhase: current.phase,
    pausedPhaseRemainingMs: isPreRound
      ? Math.max(0, current.phaseEndsAt - timestamp)
      : null,
    phaseStartedAt: timestamp,
    phaseEndsAt: null,
    lastTickAt: null,
    announcement: "Round paused. Resume when you are ready.",
    transitionCount: current.transitionCount + 1,
  };
}

export function resumeWhackAMoleGame(state, { now = 0 } = {}) {
  if (
    state?.phase !== WHACK_A_MOLE_PHASES.PAUSED ||
    !state.pausedPhase
  ) {
    return state;
  }
  const timestamp = normalizeTimestamp(now);
  const resumesPreRound =
    state.pausedPhase === WHACK_A_MOLE_PHASES.TEACH ||
    state.pausedPhase === WHACK_A_MOLE_PHASES.COUNTDOWN;
  return {
    ...state,
    phase: state.pausedPhase,
    status:
      state.pausedPhase === WHACK_A_MOLE_PHASES.PLAYING
        ? "playing"
        : state.pausedPhase === WHACK_A_MOLE_PHASES.TEACH
          ? "teaching"
          : "countdown",
    phaseStartedAt: timestamp,
    phaseEndsAt: resumesPreRound
      ? timestamp + (state.pausedPhaseRemainingMs ?? 0)
      : null,
    phaseRemainingMs: resumesPreRound
      ? state.pausedPhaseRemainingMs ?? 0
      : 0,
    pausedPhase: null,
    pausedPhaseRemainingMs: null,
    lastTickAt: timestamp,
    announcement:
      state.pausedPhase === WHACK_A_MOLE_PHASES.PLAYING
        ? "Round resumed."
        : "Countdown resumed.",
    transitionCount: state.transitionCount + 1,
  };
}

export function resetWhackAMoleGame(state, options = {}) {
  return {
    ...createBaseState({
      seed: options.seed ?? state?.seed,
      config: options.config ?? state?.config,
    }),
    transitionCount: (state?.transitionCount ?? 0) + 1,
  };
}

export function reduceWhackAMoleGame(state, action = {}) {
  const current = state ?? createWhackAMoleGame();
  switch (action.type) {
    case WHACK_A_MOLE_ACTIONS.START:
      return startWhackAMoleGame(current, action);
    case WHACK_A_MOLE_ACTIONS.TICK:
      return tickWhackAMoleGame(current, action);
    case WHACK_A_MOLE_ACTIONS.HIT_HOLE:
      return hitWhackAMoleHole(current, action);
    case WHACK_A_MOLE_ACTIONS.PAUSE:
      return pauseWhackAMoleGame(current, action);
    case WHACK_A_MOLE_ACTIONS.RESUME:
      return resumeWhackAMoleGame(current, action);
    case WHACK_A_MOLE_ACTIONS.RESET:
      return resetWhackAMoleGame(current, action);
    default:
      return current;
  }
}
