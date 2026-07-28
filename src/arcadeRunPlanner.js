export const ARCADE_RUN_SCHEMA_VERSION = 1;

export const ARCADE_RUN_DURATIONS = Object.freeze({
  QUICK: 3,
  MIX: 5,
  CIRCUIT: 10,
});

export const ARCADE_RUN_STATUSES = Object.freeze({
  READY: "ready",
  ACTIVE: "active",
  PAUSED: "paused",
  BETWEEN_LEGS: "between-legs",
  COMPLETE: "complete",
});

export const ARCADE_RUN_LEG_STATUSES = Object.freeze({
  QUEUED: "queued",
  ACTIVE: "active",
  COMPLETED: "completed",
  SKIPPED: "skipped",
});

export const ARCADE_RUN_MEDAL_TIERS = Object.freeze({
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
});

const ALLOWED_DURATIONS = new Set(Object.values(ARCADE_RUN_DURATIONS));
const ALLOWED_MATURITIES = Object.freeze(["flagship", "supported"]);
const ALLOWED_STATUSES = new Set(Object.values(ARCADE_RUN_STATUSES));
const ALLOWED_LEG_STATUSES = new Set(Object.values(ARCADE_RUN_LEG_STATUSES));
const ALLOWED_OUTCOMES = new Set([
  "completed",
  "won",
  "lost",
  "draw",
  "abandoned",
]);
const ALLOWED_MEDAL_TIERS = new Set(Object.values(ARCADE_RUN_MEDAL_TIERS));
const MAX_SCORE = 1_000_000_000;
const MAX_RESULT_DURATION_MS = 60 * 60 * 1000;
const MAX_HISTORY_LENGTH = 10;

const DURATION_TEMPLATES = Object.freeze({
  [ARCADE_RUN_DURATIONS.QUICK]: Object.freeze([1, 2]),
  [ARCADE_RUN_DURATIONS.MIX]: Object.freeze([1, 2, 2]),
  [ARCADE_RUN_DURATIONS.CIRCUIT]: Object.freeze([2, 2, 3, 3]),
});

const RUN_COPY = Object.freeze({
  [ARCADE_RUN_DURATIONS.QUICK]: Object.freeze({
    title: "Quick Spark",
    summary: "A warm-up and a fast finish.",
  }),
  [ARCADE_RUN_DURATIONS.MIX]: Object.freeze({
    title: "Arcade Mix",
    summary: "Three complementary games in one compact set.",
  }),
  [ARCADE_RUN_DURATIONS.CIRCUIT]: Object.freeze({
    title: "Full Circuit",
    summary: "A varied four-game tour with a strong finale.",
  }),
});

const ROLE_COPY = Object.freeze({
  "warm-up": "Warm up",
  momentum: "Build momentum",
  challenge: "Raise the challenge",
  finale: "Finish strong",
});

const MATURITY_WEIGHT = Object.freeze({
  flagship: 34,
  supported: 24,
  preview: 8,
  experimental: -20,
  internal: -60,
});

const DIFFICULTY_WEIGHT_BY_ROLE = Object.freeze({
  "warm-up": Object.freeze({
    easy: 42,
    adaptive: 18,
    medium: 8,
    adjustable: 8,
    hard: -18,
  }),
  momentum: Object.freeze({
    easy: 12,
    adaptive: 22,
    medium: 28,
    adjustable: 18,
    hard: 4,
  }),
  challenge: Object.freeze({
    easy: 0,
    adaptive: 20,
    medium: 26,
    adjustable: 18,
    hard: 24,
  }),
  finale: Object.freeze({
    easy: -6,
    adaptive: 20,
    medium: 28,
    adjustable: 14,
    hard: 34,
  }),
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value))));
}

function cleanText(value, fallback = "", maximumLength = 240) {
  if (typeof value !== "string") {
    return fallback;
  }
  const text = value.trim();
  return text ? text.slice(0, maximumLength) : fallback;
}

function normalizeTimestamp(value) {
  const resolved = typeof value === "function" ? value() : value;
  const date =
    resolved instanceof Date
      ? resolved
      : resolved === undefined
        ? new Date()
        : new Date(resolved);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }
  return date.toISOString();
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(value) {
  if (Number.isInteger(value)) {
    return value >>> 0;
  }
  return hashSeed(value ?? "motion-arcade-run");
}

function seededTieBreak(seed, modeId, legIndex) {
  return hashSeed(`${seed}:${legIndex}:${modeId}`) / 0xffffffff;
}

function normalizeTrackingProfiles(value) {
  if (value === undefined) {
    return null;
  }
  const profiles = Array.isArray(value) ? value : [value];
  return new Set(
    profiles
      .map((profile) => cleanText(profile).toLowerCase())
      .filter(Boolean),
  );
}

function normalizeMaturities(value) {
  const maturities =
    value === undefined ? ALLOWED_MATURITIES : Array.isArray(value) ? value : [value];
  return new Set(
    maturities
      .map((maturity) => cleanText(maturity).toLowerCase())
      .filter(Boolean),
  );
}

function normalizePlayerRange(mode) {
  if (Number.isFinite(mode.minPlayers) || Number.isFinite(mode.maxPlayers)) {
    const minimum = clampInteger(mode.minPlayers, 1, 16, 1);
    const maximum = clampInteger(mode.maxPlayers, minimum, 16, minimum);
    return { minimum, maximum };
  }
  const players = clampInteger(mode.players, 1, 16, 1);
  return { minimum: players, maximum: players };
}

function supportsPlayerCount(mode, playerCount, policy) {
  const range = normalizePlayerRange(mode);
  if (policy === "take-turns") {
    return range.minimum <= playerCount;
  }
  return range.minimum <= playerCount && playerCount <= range.maximum;
}

function resolveInputMethod(mode, settings) {
  const trackingProfile = cleanText(mode.trackingProfile, "none").toLowerCase();
  if (trackingProfile === "none") {
    return "none";
  }

  const trackingAvailable =
    settings.availableTrackingProfiles === null ||
    settings.availableTrackingProfiles.has(trackingProfile);
  const pointerAvailable =
    settings.pointerAvailable && mode.supportsPointerFallback === true;

  if (
    settings.preferredInput === "pointer" &&
    pointerAvailable
  ) {
    return "pointer";
  }
  if (trackingAvailable) {
    return "tracking";
  }
  if (pointerAvailable) {
    return "pointer";
  }
  return null;
}

function inferControlFamily(mode) {
  const explicit = cleanText(mode.arcadeControlFamily).toLowerCase();
  if (explicit) {
    return explicit;
  }
  const hint = cleanText(mode.controlHint).toLowerCase();
  if (hint.includes("swipe") || hint.includes("slice")) {
    return "swipe";
  }
  if (hint.includes("drag") || hint.includes("grab")) {
    return "drag";
  }
  if (hint.includes("flap")) {
    return "timing";
  }
  if (hint.includes("fire") || hint.includes("launch")) {
    return "aim";
  }
  if (hint.includes("remember") || hint.includes("repeat")) {
    return "memory";
  }
  if (
    hint.includes("steer") ||
    hint.includes("move left") ||
    hint.includes("move your palm")
  ) {
    return "steer";
  }
  if (hint.includes("pinch")) {
    return "pinch";
  }
  return cleanText(mode.trackingProfile, "pointer").toLowerCase();
}

function normalizeMode(mode, inputMethod) {
  const playerRange = normalizePlayerRange(mode);
  return {
    id: cleanText(mode.id, "", 80),
    label: cleanText(mode.label, cleanText(mode.id, "Activity"), 120),
    path: cleanText(mode.path, "", 240),
    summary: cleanText(mode.summary),
    objective: cleanText(mode.objective, cleanText(mode.summary)),
    controlHint: cleanText(mode.controlHint, "Follow the on-screen controls", 160),
    maturity: cleanText(mode.maturity, "supported").toLowerCase(),
    trackingProfile: cleanText(mode.trackingProfile, "none").toLowerCase(),
    inputMethod,
    players: playerRange.maximum,
    minPlayers: playerRange.minimum,
    maxPlayers: playerRange.maximum,
    typicalMinutes: clampInteger(mode.typicalMinutes, 1, 10, 2),
    difficulty: cleanText(mode.difficulty, "Adaptive", 40),
    controlFamily: inferControlFamily(mode),
    dailyChallenge: mode.dailyChallenge === true,
    featured: mode.featured === true,
    fullscreenMode: cleanText(mode.fullscreenMode, "", 80) || null,
  };
}

function createEligibilitySettings(options = {}) {
  const settings = isRecord(options) ? options : {};
  return {
    maturities: normalizeMaturities(settings.allowedMaturities),
    playerCount: clampInteger(settings.playerCount, 1, 16, 1),
    playerCountPolicy:
      settings.playerCountPolicy === "take-turns" ? "take-turns" : "exact",
    pointerAvailable: settings.pointerAvailable !== false,
    availableTrackingProfiles: normalizeTrackingProfiles(
      settings.availableTrackingProfiles,
    ),
    preferredInput:
      settings.preferredInput === "pointer" ? "pointer" : "tracking",
    includeHidden: settings.includeHidden === true,
    includeNonPlay: settings.includeNonPlay === true,
    requireResults: settings.requireResults !== false,
    excludedModeIds: new Set(
      (Array.isArray(settings.excludeModeIds)
        ? settings.excludeModeIds
        : []
      ).map(String),
    ),
  };
}

/**
 * Filters mode-registry-like records by the people and input capabilities that
 * are actually present. The returned records are serializable planner inputs.
 */
export function listEligibleArcadeRunModes(modes, options = {}) {
  const settings = createEligibilitySettings(options);
  const seenIds = new Set();

  return (Array.isArray(modes) ? modes : [])
    .filter((mode) => {
      if (!isRecord(mode)) {
        return false;
      }
      const id = cleanText(mode.id, "", 80);
      if (!id || seenIds.has(id) || settings.excludedModeIds.has(id)) {
        return false;
      }
      if (!settings.includeNonPlay && mode.area && mode.area !== "play") {
        return false;
      }
      if (!settings.includeHidden && mode.hiddenFromLibrary) {
        return false;
      }
      if (
        settings.requireResults &&
        (mode.supportsResults === false || mode.supportsResults === undefined)
      ) {
        return false;
      }
      const maturity = cleanText(mode.maturity, "supported").toLowerCase();
      if (!settings.maturities.has(maturity)) {
        return false;
      }
      if (
        !supportsPlayerCount(
          mode,
          settings.playerCount,
          settings.playerCountPolicy,
        )
      ) {
        return false;
      }
      const inputMethod = resolveInputMethod(mode, settings);
      if (!inputMethod) {
        return false;
      }
      seenIds.add(id);
      return true;
    })
    .map((mode) =>
      normalizeMode(mode, resolveInputMethod(mode, settings)),
    );
}

export function getArcadeRunDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Arcade Run daily dates must be valid dates.");
  }
  return date.toISOString().slice(0, 10);
}

export function getDailyArcadeRunSeed({
  date = new Date(),
  durationMinutes = ARCADE_RUN_DURATIONS.MIX,
  playerCount = 1,
  preferredInput = "tracking",
} = {}) {
  const dayKey = getArcadeRunDayKey(date);
  return hashSeed(
    `arcade-run:${dayKey}:${durationMinutes}:${playerCount}:${preferredInput}`,
  );
}

function rolesForLength(length) {
  if (length <= 1) {
    return ["finale"];
  }
  if (length === 2) {
    return ["warm-up", "finale"];
  }
  if (length === 3) {
    return ["warm-up", "momentum", "finale"];
  }
  return ["warm-up", "momentum", "challenge", "finale"];
}

function scoreCandidate(candidate, {
  role,
  slotMinutes,
  previousCandidate,
  selectedControlFamilies,
  selectedTrackingProfiles,
  seed,
  legIndex,
}) {
  const durationDifference = Math.abs(candidate.typicalMinutes - slotMinutes);
  const durationScore =
    70 -
    durationDifference * 22 -
    Math.max(0, candidate.typicalMinutes - slotMinutes) * 20;
  const difficulty = candidate.difficulty.toLowerCase();
  const difficultyScore =
    DIFFICULTY_WEIGHT_BY_ROLE[role]?.[difficulty] ?? 10;
  const maturityScore = MATURITY_WEIGHT[candidate.maturity] ?? 0;
  const varietyScore =
    (selectedControlFamilies.has(candidate.controlFamily) ? -26 : 22) +
    (selectedTrackingProfiles.has(candidate.trackingProfile) ? -4 : 8);
  const transitionScore =
    previousCandidate?.controlFamily === candidate.controlFamily ? -28 : 12;
  const curationScore =
    (candidate.featured ? 8 : 0) +
    (role === "finale" && candidate.dailyChallenge ? 12 : 0) +
    (role === "finale" && candidate.maturity === "flagship" ? 18 : 0);

  return (
    durationScore +
    difficultyScore +
    maturityScore +
    varietyScore +
    transitionScore +
    curationScore +
    seededTieBreak(seed, candidate.id, legIndex) * 18
  );
}

function selectPlaylist(candidates, durationMinutes, seed) {
  const slots = DURATION_TEMPLATES[durationMinutes];
  const initialRoles = rolesForLength(slots.length);
  const selected = [];
  const selectedIds = new Set();
  const selectedControlFamilies = new Set();
  const selectedTrackingProfiles = new Set();
  let allocatedMinutes = 0;

  for (let legIndex = 0; legIndex < slots.length; legIndex += 1) {
    const slotMinutes = slots[legIndex];
    const remainingBudget = durationMinutes - allocatedMinutes;
    const role = initialRoles[legIndex];
    const previousCandidate = selected.at(-1) ?? null;
    const ranked = candidates
      .filter(
        (candidate) =>
          !selectedIds.has(candidate.id) &&
          candidate.typicalMinutes <= remainingBudget,
      )
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, {
          role,
          slotMinutes,
          previousCandidate,
          selectedControlFamilies,
          selectedTrackingProfiles,
          seed,
          legIndex,
        }),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.candidate.id.localeCompare(right.candidate.id),
      );

    const winner = ranked[0]?.candidate;
    if (!winner) {
      continue;
    }
    selected.push(winner);
    selectedIds.add(winner.id);
    selectedControlFamilies.add(winner.controlFamily);
    selectedTrackingProfiles.add(winner.trackingProfile);
    allocatedMinutes += winner.typicalMinutes;
  }

  return selected;
}

function buildFilterSnapshot(options, eligibleModes) {
  const settings = createEligibilitySettings(options);
  return {
    playerCount: settings.playerCount,
    playerCountPolicy: settings.playerCountPolicy,
    pointerAvailable: settings.pointerAvailable,
    preferredInput: settings.preferredInput,
    availableTrackingProfiles:
      settings.availableTrackingProfiles === null
        ? null
        : [...settings.availableTrackingProfiles].sort(),
    allowedMaturities: [...settings.maturities].sort(),
    eligibleModeCount: eligibleModes.length,
  };
}

function normalizeDuration(value) {
  const duration = clampInteger(value, 1, 60, ARCADE_RUN_DURATIONS.MIX);
  if (!ALLOWED_DURATIONS.has(duration)) {
    throw new RangeError("Arcade Runs support 3, 5, or 10 minute playlists.");
  }
  return duration;
}

/**
 * Creates a deterministic, no-repeat, budget-aware playlist. Pass a seed for a
 * repeatable custom run, or dailyDate to get the shared run for that UTC day.
 */
export function createArcadeRunPlan(modes, options = {}) {
  const settings = isRecord(options) ? options : {};
  const durationMinutes = normalizeDuration(settings.durationMinutes);
  const eligibleModes = listEligibleArcadeRunModes(modes, settings);
  const dailyDayKey =
    settings.dailyDate === undefined
      ? null
      : getArcadeRunDayKey(settings.dailyDate);
  const seed =
    dailyDayKey === null
      ? normalizeSeed(settings.seed)
      : getDailyArcadeRunSeed({
          date: settings.dailyDate,
          durationMinutes,
          playerCount: settings.playerCount,
          preferredInput: settings.preferredInput,
        });
  const playlist = selectPlaylist(eligibleModes, durationMinutes, seed);
  const roles = rolesForLength(playlist.length);
  const legs = playlist.map((mode, index) => {
    const role = roles[index];
    return {
      id: `leg-${index + 1}-${mode.id}`,
      index,
      role,
      transitionLabel: `${ROLE_COPY[role]} with ${mode.label}.`,
      estimatedMinutes: mode.typicalMinutes,
      mode,
    };
  });
  const estimatedMinutes = legs.reduce(
    (total, leg) => total + leg.estimatedMinutes,
    0,
  );
  const copy = RUN_COPY[durationMinutes];
  const planFingerprint = legs.map((leg) => leg.mode.id).join(",");

  return {
    version: ARCADE_RUN_SCHEMA_VERSION,
    planId: `arcade-run-${hashSeed(
      `${seed}:${durationMinutes}:${planFingerprint}`,
    ).toString(36)}`,
    title: copy.title,
    summary: copy.summary,
    durationMinutes,
    estimatedMinutes,
    unallocatedMinutes: Math.max(0, durationMinutes - estimatedMinutes),
    seed,
    dailyChallenge:
      dailyDayKey === null
        ? null
        : {
            id: `arcade-run-daily-${dailyDayKey}-${durationMinutes}`,
            dayKey: dailyDayKey,
            seed,
          },
    filters: buildFilterSnapshot(settings, eligibleModes),
    canStart: legs.length > 0,
    unavailableReason:
      legs.length === 0
        ? "No games match this run’s player and input settings."
        : null,
    legs,
  };
}

export function createDailyArcadeRunPlan(modes, options = {}) {
  const settings = isRecord(options) ? options : {};
  return createArcadeRunPlan(modes, {
    ...settings,
    dailyDate: settings.date ?? new Date(),
  });
}

function createRunId(plan, timestamp) {
  return `${plan.planId}-${hashSeed(timestamp).toString(36)}`;
}

function createLegState(leg) {
  return {
    id: leg.id,
    modeId: leg.mode.id,
    status: ARCADE_RUN_LEG_STATUSES.QUEUED,
    attempts: 0,
    startedAt: null,
    endedAt: null,
    result: null,
    skipReason: null,
    history: [],
  };
}

function normalizeMedal(medal, index) {
  if (typeof medal === "string") {
    const tier = cleanText(medal).toLowerCase();
    if (!ALLOWED_MEDAL_TIERS.has(tier)) {
      return null;
    }
    return {
      id: `${tier}-${index + 1}`,
      label: `${tier[0].toUpperCase()}${tier.slice(1)} medal`,
      tier,
    };
  }
  if (!isRecord(medal) || medal.earned === false) {
    return null;
  }
  const tier = cleanText(medal.tier).toLowerCase();
  if (!ALLOWED_MEDAL_TIERS.has(tier)) {
    return null;
  }
  return {
    id: cleanText(medal.id, `${tier}-${index + 1}`, 80),
    label: cleanText(
      medal.label,
      `${tier[0].toUpperCase()}${tier.slice(1)} medal`,
      120,
    ),
    tier,
  };
}

function normalizeLegResult(value) {
  const result = isRecord(value) ? value : {};
  const rawMedals = [
    ...(Array.isArray(result.medals) ? result.medals : []),
    ...(result.medal ? [result.medal] : []),
  ];
  const medals = rawMedals
    .map(normalizeMedal)
    .filter(Boolean)
    .filter(
      (medal, index, values) =>
        values.findIndex((candidate) => candidate.id === medal.id) === index,
    );
  return {
    outcome: ALLOWED_OUTCOMES.has(result.outcome)
      ? result.outcome
      : "completed",
    score: Math.min(
      MAX_SCORE,
      Math.max(0, Number.isFinite(result.score) ? result.score : 0),
    ),
    durationMs: Math.min(
      MAX_RESULT_DURATION_MS,
      Math.max(0, Number.isFinite(result.durationMs) ? result.durationMs : 0),
    ),
    title: cleanText(result.title, "", 160) || null,
    medals,
  };
}

function medalPoints(tier) {
  if (tier === ARCADE_RUN_MEDAL_TIERS.GOLD) {
    return 3;
  }
  if (tier === ARCADE_RUN_MEDAL_TIERS.SILVER) {
    return 2;
  }
  return 1;
}

export function getArcadeRunAggregate(session) {
  const legs = Array.isArray(session?.legs) ? session.legs : [];
  const completedLegs = legs.filter(
    (leg) => leg.status === ARCADE_RUN_LEG_STATUSES.COMPLETED,
  );
  const skippedLegs = legs.filter(
    (leg) => leg.status === ARCADE_RUN_LEG_STATUSES.SKIPPED,
  );
  const medals = completedLegs.flatMap((leg) => leg.result?.medals ?? []);
  const medalCounts = {
    bronze: 0,
    silver: 0,
    gold: 0,
  };
  let medalScore = 0;
  for (const medal of medals) {
    if (!ALLOWED_MEDAL_TIERS.has(medal.tier)) {
      continue;
    }
    medalCounts[medal.tier] += 1;
    medalScore += medalPoints(medal.tier);
  }
  const finishedLegCount = completedLegs.length + skippedLegs.length;
  const totalLegCount = legs.length;
  const isComplete = session?.status === ARCADE_RUN_STATUSES.COMPLETE;
  const averageMedalScore =
    completedLegs.length > 0 ? medalScore / completedLegs.length : 0;
  let runMedal = null;
  if (isComplete && completedLegs.length > 0) {
    if (skippedLegs.length === 0 && averageMedalScore >= 2.5) {
      runMedal = ARCADE_RUN_MEDAL_TIERS.GOLD;
    } else if (skippedLegs.length === 0 && averageMedalScore >= 1.25) {
      runMedal = ARCADE_RUN_MEDAL_TIERS.SILVER;
    } else {
      runMedal = ARCADE_RUN_MEDAL_TIERS.BRONZE;
    }
  }

  return {
    totalScore: completedLegs.reduce(
      (total, leg) => total + (leg.result?.score ?? 0),
      0,
    ),
    completedLegCount: completedLegs.length,
    skippedLegCount: skippedLegs.length,
    finishedLegCount,
    totalLegCount,
    progress:
      totalLegCount > 0 ? finishedLegCount / totalLegCount : 0,
    medalCounts,
    medalScore,
    runMedal,
  };
}

function withAggregate(session) {
  return {
    ...session,
    aggregate: getArcadeRunAggregate(session),
  };
}

function updateLeg(session, index, updater, sessionUpdates = {}) {
  const legs = session.legs.map((leg, legIndex) =>
    legIndex === index ? updater(leg) : leg,
  );
  return withAggregate({
    ...session,
    ...sessionUpdates,
    legs,
  });
}

export function createArcadeRunSession(plan, options = {}) {
  if (
    !isRecord(plan) ||
    plan.version !== ARCADE_RUN_SCHEMA_VERSION ||
    !Array.isArray(plan.legs)
  ) {
    throw new TypeError("A valid Arcade Run plan is required.");
  }
  const timestamp = normalizeTimestamp(options.now);
  const session = {
    version: ARCADE_RUN_SCHEMA_VERSION,
    runId: cleanText(options.runId, createRunId(plan, timestamp), 120),
    plan: JSON.parse(JSON.stringify(plan)),
    status: ARCADE_RUN_STATUSES.READY,
    currentLegIndex: plan.legs.length > 0 ? 0 : null,
    legs: plan.legs.map(createLegState),
    createdAt: timestamp,
    startedAt: null,
    updatedAt: timestamp,
    completedAt: null,
    aggregate: null,
  };
  return withAggregate(session);
}

function activateLeg(session, index, timestamp) {
  if (!Number.isInteger(index) || !session.legs[index]) {
    return withAggregate({
      ...session,
      status: ARCADE_RUN_STATUSES.COMPLETE,
      currentLegIndex: null,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }
  return updateLeg(
    session,
    index,
    (leg) => ({
      ...leg,
      status: ARCADE_RUN_LEG_STATUSES.ACTIVE,
      attempts: leg.attempts + 1,
      startedAt: timestamp,
      endedAt: null,
      result: null,
      skipReason: null,
    }),
    {
      status: ARCADE_RUN_STATUSES.ACTIVE,
      currentLegIndex: index,
      startedAt: session.startedAt ?? timestamp,
      updatedAt: timestamp,
      completedAt: null,
    },
  );
}

export function startArcadeRun(session, options = {}) {
  if (session?.status === ARCADE_RUN_STATUSES.PAUSED) {
    return resumeArcadeRun(session, options);
  }
  if (session?.status !== ARCADE_RUN_STATUSES.READY) {
    return session;
  }
  return activateLeg(
    session,
    session.currentLegIndex ?? 0,
    normalizeTimestamp(options.now),
  );
}

export function pauseArcadeRun(session, options = {}) {
  if (session?.status !== ARCADE_RUN_STATUSES.ACTIVE) {
    return session;
  }
  return withAggregate({
    ...session,
    status: ARCADE_RUN_STATUSES.PAUSED,
    updatedAt: normalizeTimestamp(options.now),
  });
}

export function resumeArcadeRun(session, options = {}) {
  if (session?.status !== ARCADE_RUN_STATUSES.PAUSED) {
    return session;
  }
  return withAggregate({
    ...session,
    status: ARCADE_RUN_STATUSES.ACTIVE,
    updatedAt: normalizeTimestamp(options.now),
  });
}

export function completeArcadeRunLeg(session, result, options = {}) {
  if (
    session?.status !== ARCADE_RUN_STATUSES.ACTIVE ||
    !Number.isInteger(session.currentLegIndex)
  ) {
    return session;
  }
  const timestamp = normalizeTimestamp(options.now);
  return updateLeg(
    session,
    session.currentLegIndex,
    (leg) => ({
      ...leg,
      status: ARCADE_RUN_LEG_STATUSES.COMPLETED,
      endedAt: timestamp,
      result: normalizeLegResult(result),
      skipReason: null,
    }),
    {
      status: ARCADE_RUN_STATUSES.BETWEEN_LEGS,
      updatedAt: timestamp,
    },
  );
}

export function skipArcadeRunLeg(session, options = {}) {
  if (
    session?.status !== ARCADE_RUN_STATUSES.ACTIVE ||
    !Number.isInteger(session.currentLegIndex)
  ) {
    return session;
  }
  const timestamp = normalizeTimestamp(options.now);
  return updateLeg(
    session,
    session.currentLegIndex,
    (leg) => ({
      ...leg,
      status: ARCADE_RUN_LEG_STATUSES.SKIPPED,
      endedAt: timestamp,
      result: null,
      skipReason: cleanText(options.reason, "Skipped by player", 120),
    }),
    {
      status: ARCADE_RUN_STATUSES.BETWEEN_LEGS,
      updatedAt: timestamp,
    },
  );
}

function nextQueuedLegIndex(session) {
  const startIndex = Number.isInteger(session.currentLegIndex)
    ? session.currentLegIndex + 1
    : 0;
  for (let index = startIndex; index < session.legs.length; index += 1) {
    if (session.legs[index].status === ARCADE_RUN_LEG_STATUSES.QUEUED) {
      return index;
    }
  }
  return null;
}

export function advanceArcadeRun(session, options = {}) {
  if (session?.status !== ARCADE_RUN_STATUSES.BETWEEN_LEGS) {
    return session;
  }
  const timestamp = normalizeTimestamp(options.now);
  const nextIndex = nextQueuedLegIndex(session);
  if (nextIndex === null) {
    return withAggregate({
      ...session,
      status: ARCADE_RUN_STATUSES.COMPLETE,
      currentLegIndex: null,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }
  return activateLeg(session, nextIndex, timestamp);
}

function historyEntryForLeg(leg) {
  if (
    leg.status !== ARCADE_RUN_LEG_STATUSES.COMPLETED &&
    leg.status !== ARCADE_RUN_LEG_STATUSES.SKIPPED
  ) {
    return null;
  }
  return {
    status: leg.status,
    endedAt: leg.endedAt,
    result: leg.result,
    skipReason: leg.skipReason,
  };
}

export function retryArcadeRunLeg(session, options = {}) {
  if (
    session?.status !== ARCADE_RUN_STATUSES.BETWEEN_LEGS ||
    !Number.isInteger(session.currentLegIndex)
  ) {
    return session;
  }
  const timestamp = normalizeTimestamp(options.now);
  const currentLeg = session.legs[session.currentLegIndex];
  const historyEntry = historyEntryForLeg(currentLeg);
  const prepared = updateLeg(
    session,
    session.currentLegIndex,
    (leg) => ({
      ...leg,
      status: ARCADE_RUN_LEG_STATUSES.QUEUED,
      endedAt: null,
      result: null,
      skipReason: null,
      history: historyEntry
        ? [...leg.history, historyEntry].slice(-MAX_HISTORY_LENGTH)
        : leg.history,
    }),
    {
      updatedAt: timestamp,
    },
  );
  return activateLeg(prepared, session.currentLegIndex, timestamp);
}

export class UnsupportedArcadeRunVersionError extends Error {
  constructor(version) {
    super(`Unsupported Arcade Run schema version: ${version}`);
    this.name = "UnsupportedArcadeRunVersionError";
    this.version = version;
  }
}

function validateDeserializedSession(value) {
  if (!isRecord(value)) {
    throw new TypeError("Arcade Run resume data must be an object.");
  }
  if (value.version !== ARCADE_RUN_SCHEMA_VERSION) {
    throw new UnsupportedArcadeRunVersionError(value.version);
  }
  if (
    !isRecord(value.plan) ||
    value.plan.version !== ARCADE_RUN_SCHEMA_VERSION ||
    !Array.isArray(value.plan.legs) ||
    !Array.isArray(value.legs) ||
    value.plan.legs.length !== value.legs.length
  ) {
    throw new TypeError("Arcade Run resume data does not match its plan.");
  }
  if (!ALLOWED_STATUSES.has(value.status)) {
    throw new TypeError("Arcade Run resume data has an invalid status.");
  }
  for (let index = 0; index < value.legs.length; index += 1) {
    const leg = value.legs[index];
    if (
      !isRecord(leg) ||
      leg.id !== value.plan.legs[index]?.id ||
      !ALLOWED_LEG_STATUSES.has(leg.status)
    ) {
      throw new TypeError("Arcade Run resume data has an invalid leg.");
    }
  }
}

export function serializeArcadeRunSession(session) {
  validateDeserializedSession(session);
  return JSON.stringify(withAggregate(session));
}

export function deserializeArcadeRunSession(serialized) {
  let value;
  try {
    value =
      typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    throw new TypeError("Arcade Run resume data is not valid JSON.");
  }
  validateDeserializedSession(value);
  return withAggregate(JSON.parse(JSON.stringify(value)));
}

function formatInteger(value, locale) {
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

function statusLabel(status) {
  if (status === ARCADE_RUN_LEG_STATUSES.COMPLETED) {
    return "Complete";
  }
  if (status === ARCADE_RUN_LEG_STATUSES.SKIPPED) {
    return "Skipped";
  }
  if (status === ARCADE_RUN_LEG_STATUSES.ACTIVE) {
    return "Now playing";
  }
  return "Up next";
}

function runMedalLabel(tier) {
  if (!tier) {
    return null;
  }
  return `${tier[0].toUpperCase()}${tier.slice(1)} circuit medal`;
}

/**
 * Produces presentation copy and semantics without binding the planner to React.
 */
export function createArcadeRunSummaryUiModel(session, options = {}) {
  const aggregate = getArcadeRunAggregate(session);
  const locale = options.locale;
  const complete = session?.status === ARCADE_RUN_STATUSES.COMPLETE;
  const finishedCopy = `${aggregate.finishedLegCount} of ${aggregate.totalLegCount} activities finished`;
  const skippedCopy =
    aggregate.skippedLegCount > 0
      ? `, ${aggregate.skippedLegCount} skipped`
      : "";
  const announcement = complete
    ? `Arcade Run complete. ${finishedCopy}${skippedCopy}. Total score ${formatInteger(
        aggregate.totalScore,
        locale,
      )}.`
    : `${finishedCopy}${skippedCopy}.`;

  return {
    kind: "arcade-run-summary",
    title: complete ? "Circuit complete" : session?.plan?.title ?? "Arcade Run",
    eyebrow: complete ? "Run results" : "Run progress",
    description: announcement,
    progress: {
      value: aggregate.finishedLegCount,
      maximum: aggregate.totalLegCount,
      label: finishedCopy,
    },
    primaryMetric: {
      id: "total-score",
      label: "Total score",
      value: aggregate.totalScore,
      formattedValue: formatInteger(aggregate.totalScore, locale),
    },
    medalCounts: [
      {
        tier: "gold",
        label: "Gold medals",
        count: aggregate.medalCounts.gold,
      },
      {
        tier: "silver",
        label: "Silver medals",
        count: aggregate.medalCounts.silver,
      },
      {
        tier: "bronze",
        label: "Bronze medals",
        count: aggregate.medalCounts.bronze,
      },
    ],
    runMedal: aggregate.runMedal
      ? {
          tier: aggregate.runMedal,
          label: runMedalLabel(aggregate.runMedal),
        }
      : null,
    legs: session.legs.map((leg, index) => {
      const planLeg = session.plan.legs[index];
      return {
        id: leg.id,
        label: planLeg.mode.label,
        role: planLeg.role,
        status: leg.status,
        statusLabel: statusLabel(leg.status),
        attempts: leg.attempts,
        score: leg.result?.score ?? null,
        scoreLabel:
          leg.result === null
            ? null
            : `${formatInteger(leg.result.score, locale)} points`,
      };
    }),
    actions: complete
      ? [
          {
            id: "play-another",
            label: "Play another run",
            ariaLabel: "Choose another Arcade Run",
            emphasis: "primary",
          },
          {
            id: "home",
            label: "Back to Home",
            ariaLabel: "Return to Motion Arcade Home",
            emphasis: "secondary",
          },
        ]
      : [],
    accessibility: {
      role: complete ? "status" : "region",
      ariaLabel: complete ? "Arcade Run results" : "Arcade Run progress",
      ariaLive: complete ? "assertive" : "polite",
      ariaAtomic: true,
      announcement,
    },
  };
}

function getNextUpLeg(session) {
  if (!Array.isArray(session?.legs)) {
    return null;
  }
  if (
    session.status === ARCADE_RUN_STATUSES.BETWEEN_LEGS
  ) {
    const index = nextQueuedLegIndex(session);
    return index === null
      ? null
      : { index, state: session.legs[index], plan: session.plan.legs[index] };
  }
  if (Number.isInteger(session.currentLegIndex)) {
    const index = session.currentLegIndex;
    return {
      index,
      state: session.legs[index],
      plan: session.plan.legs[index],
    };
  }
  return null;
}

export function createArcadeRunNextUpUiModel(session) {
  const next = getNextUpLeg(session);
  const current =
    Number.isInteger(session?.currentLegIndex)
      ? session.plan.legs[session.currentLegIndex]
      : null;
  const isBetween = session?.status === ARCADE_RUN_STATUSES.BETWEEN_LEGS;
  const isPaused = session?.status === ARCADE_RUN_STATUSES.PAUSED;

  if (!next) {
    const announcement = "Every Arcade Run activity is finished.";
    return {
      kind: "arcade-run-next-up",
      title: "Run ready to finish",
      eyebrow: "All activities finished",
      description: announcement,
      activity: null,
      progressLabel: `${session?.legs?.length ?? 0} of ${session?.legs?.length ?? 0}`,
      actions:
        isBetween
          ? [
              {
                id: "retry",
                label: "Retry last game",
                ariaLabel: `Retry ${current?.mode?.label ?? "the last game"}`,
                emphasis: "secondary",
              },
              {
                id: "finish",
                label: "See run results",
                ariaLabel: "Finish Arcade Run and see results",
                emphasis: "primary",
              },
            ]
          : [],
      accessibility: {
        role: "status",
        ariaLabel: "Arcade Run next activity",
        ariaLive: "polite",
        ariaAtomic: true,
        announcement,
      },
    };
  }

  const { index, plan: planLeg } = next;
  const activity = planLeg.mode;
  const title = isPaused
    ? `${activity.label} paused`
    : isBetween
      ? `Next up: ${activity.label}`
      : session.status === ARCADE_RUN_STATUSES.ACTIVE
        ? `Now playing: ${activity.label}`
        : `First up: ${activity.label}`;
  const announcement = `${title}. ${activity.objective || activity.summary} Controls: ${activity.controlHint}.`;
  const actions = [];
  if (session.status === ARCADE_RUN_STATUSES.READY) {
    actions.push({
      id: "start",
      label: "Start run",
      ariaLabel: `Start Arcade Run with ${activity.label}`,
      emphasis: "primary",
    });
  } else if (isPaused) {
    actions.push({
      id: "resume",
      label: "Resume",
      ariaLabel: `Resume ${activity.label}`,
      emphasis: "primary",
    });
  } else if (isBetween) {
    actions.push(
      {
        id: "retry",
        label: "Retry last game",
        ariaLabel: `Retry ${current?.mode?.label ?? "the last game"}`,
        emphasis: "secondary",
      },
      {
        id: "continue",
        label: `Play ${activity.label}`,
        ariaLabel: `Continue Arcade Run with ${activity.label}`,
        emphasis: "primary",
      },
    );
  }

  return {
    kind: "arcade-run-next-up",
    title,
    eyebrow: planLeg.transitionLabel,
    description: activity.objective || activity.summary,
    activity: {
      modeId: activity.id,
      label: activity.label,
      path: activity.path,
      role: planLeg.role,
      estimatedMinutes: planLeg.estimatedMinutes,
      controlHint: activity.controlHint,
      inputMethod: activity.inputMethod,
      inputLabel:
        activity.inputMethod === "pointer"
          ? "Pointer controls"
          : activity.inputMethod === "tracking"
            ? `${activity.trackingProfile} tracking`
            : "No tracking needed",
    },
    progressLabel: `${index + 1} of ${session.legs.length}`,
    actions,
    accessibility: {
      role: "region",
      ariaLabel: "Arcade Run next activity",
      ariaLive: isBetween ? "polite" : "off",
      ariaAtomic: true,
      announcement,
    },
  };
}
