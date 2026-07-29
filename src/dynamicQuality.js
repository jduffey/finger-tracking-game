export const QUALITY_LEVELS = Object.freeze({
  MINIMAL: "minimal",
  LOW: "low",
  BALANCED: "balanced",
  HIGH: "high",
  ULTRA: "ultra",
});

export const QUALITY_LEVEL_ORDER = Object.freeze([
  QUALITY_LEVELS.MINIMAL,
  QUALITY_LEVELS.LOW,
  QUALITY_LEVELS.BALANCED,
  QUALITY_LEVELS.HIGH,
  QUALITY_LEVELS.ULTRA,
]);

export const MODEL_PREFERENCES = Object.freeze({
  LITE: "lite",
  FULL: "full",
});

function createProfile(
  level,
  {
    inferenceIntervalMs,
    width,
    height,
    effectDensity,
    particleLimit,
    modelPreference,
  },
) {
  return Object.freeze({
    level,
    inferenceIntervalMs,
    inferenceFps: Math.round(1_000 / inferenceIntervalMs),
    captureResolution: Object.freeze({ width, height }),
    effectDensity,
    particleLimit,
    modelPreference,
  });
}

/**
 * Explicit work budgets for every adaptive level. Values describe maxima, not
 * guarantees: a tracking loop can skip work without changing the active level.
 */
export const QUALITY_PROFILES = Object.freeze({
  [QUALITY_LEVELS.MINIMAL]: createProfile(QUALITY_LEVELS.MINIMAL, {
    inferenceIntervalMs: 100,
    width: 480,
    height: 360,
    effectDensity: 0.2,
    particleLimit: 160,
    modelPreference: MODEL_PREFERENCES.LITE,
  }),
  [QUALITY_LEVELS.LOW]: createProfile(QUALITY_LEVELS.LOW, {
    inferenceIntervalMs: 67,
    width: 640,
    height: 480,
    effectDensity: 0.4,
    particleLimit: 420,
    modelPreference: MODEL_PREFERENCES.LITE,
  }),
  [QUALITY_LEVELS.BALANCED]: createProfile(QUALITY_LEVELS.BALANCED, {
    inferenceIntervalMs: 50,
    width: 960,
    height: 540,
    effectDensity: 0.65,
    particleLimit: 900,
    modelPreference: MODEL_PREFERENCES.FULL,
  }),
  [QUALITY_LEVELS.HIGH]: createProfile(QUALITY_LEVELS.HIGH, {
    inferenceIntervalMs: 33,
    width: 1_280,
    height: 720,
    effectDensity: 0.85,
    particleLimit: 1_600,
    modelPreference: MODEL_PREFERENCES.FULL,
  }),
  [QUALITY_LEVELS.ULTRA]: createProfile(QUALITY_LEVELS.ULTRA, {
    inferenceIntervalMs: 25,
    width: 1_600,
    height: 900,
    effectDensity: 1,
    particleLimit: 2_600,
    modelPreference: MODEL_PREFERENCES.FULL,
  }),
});

export const DYNAMIC_QUALITY_DEFAULTS = Object.freeze({
  targetFrameTimeMs: 1_000 / 60,
  fastFrameMultiplier: 0.78,
  slowFrameMultiplier: 1.2,
  severeFrameMultiplier: 2,
  degradeAfterSamples: 12,
  severeDegradeAfterSamples: 3,
  upgradeAfterSamples: 90,
  cooldownMs: 4_000,
  emaAlpha: 0.2,
  ignoreFrameTimeAboveMs: 750,
});

/**
 * @typedef {"minimal"|"low"|"balanced"|"high"|"ultra"} QualityLevel
 */

/**
 * @typedef {object} DynamicQualityConfiguration
 * @property {number} targetFrameTimeMs
 * @property {number} fastFrameTimeMs
 * @property {number} slowFrameTimeMs
 * @property {number} severeFrameTimeMs
 * @property {number} degradeAfterSamples
 * @property {number} severeDegradeAfterSamples
 * @property {number} upgradeAfterSamples
 * @property {number} cooldownMs
 * @property {number} emaAlpha
 * @property {number} ignoreFrameTimeAboveMs
 * @property {QualityLevel} minimumLevel
 * @property {QualityLevel} maximumLevel
 */

/**
 * Serializable state for a pure dynamic-quality reducer.
 *
 * @typedef {object} DynamicQualityState
 * @property {QualityLevel} level
 * @property {number|null} emaFrameTimeMs
 * @property {number} sampleCount
 * @property {number} slowStreak
 * @property {number} severeStreak
 * @property {number} fastStreak
 * @property {number|null} lastSampleAtMs
 * @property {number|null} lastChangeAtMs
 * @property {Readonly<DynamicQualityConfiguration>} configuration
 */

function isQualityLevel(value) {
  return QUALITY_LEVEL_ORDER.includes(value);
}

function levelIndex(level) {
  return QUALITY_LEVEL_ORDER.indexOf(level);
}

function clampNumber(value, fallback, minimum, maximum) {
  const resolved = Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, resolved));
}

function clampInteger(value, fallback, minimum, maximum) {
  return Math.round(clampNumber(value, fallback, minimum, maximum));
}

function normalizeTier(capabilitiesOrTier) {
  if (typeof capabilitiesOrTier === "string") {
    return capabilitiesOrTier;
  }
  if (
    capabilitiesOrTier &&
    typeof capabilitiesOrTier === "object" &&
    typeof capabilitiesOrTier.performanceTier === "string"
  ) {
    return capabilitiesOrTier.performanceTier;
  }
  return "standard";
}

/**
 * Picks a conservative starting point from the capability assessment. Runtime
 * samples remain authoritative and can move within the tier's ceiling.
 *
 * @param {string|{performanceTier?: string}|null|undefined} capabilitiesOrTier
 * @returns {QualityLevel}
 */
export function selectInitialQualityLevel(capabilitiesOrTier) {
  switch (normalizeTier(capabilitiesOrTier)) {
    case "high":
      return QUALITY_LEVELS.HIGH;
    case "constrained":
      return QUALITY_LEVELS.LOW;
    case "fallback":
      return QUALITY_LEVELS.MINIMAL;
    default:
      return QUALITY_LEVELS.BALANCED;
  }
}

/**
 * @param {string|{performanceTier?: string}|null|undefined} capabilitiesOrTier
 * @returns {QualityLevel}
 */
export function selectMaximumQualityLevel(capabilitiesOrTier) {
  switch (normalizeTier(capabilitiesOrTier)) {
    case "high":
      return QUALITY_LEVELS.ULTRA;
    case "constrained":
      return QUALITY_LEVELS.BALANCED;
    case "fallback":
      return QUALITY_LEVELS.LOW;
    default:
      return QUALITY_LEVELS.HIGH;
  }
}

function clampLevel(level, minimumLevel, maximumLevel) {
  const minimumIndex = levelIndex(minimumLevel);
  const maximumIndex = levelIndex(maximumLevel);
  const resolvedIndex = isQualityLevel(level)
    ? levelIndex(level)
    : minimumIndex;
  return QUALITY_LEVEL_ORDER[
    Math.min(maximumIndex, Math.max(minimumIndex, resolvedIndex))
  ];
}

function createConfiguration(options, capabilityTier) {
  const defaults = DYNAMIC_QUALITY_DEFAULTS;
  const requestedTargetFrameTime =
    Number.isFinite(options.targetFps) && options.targetFps > 0
      ? 1_000 / options.targetFps
      : options.targetFrameTimeMs;
  const targetFrameTimeMs = clampNumber(
    requestedTargetFrameTime,
    defaults.targetFrameTimeMs,
    5,
    100,
  );
  const fastFrameTimeMs = clampNumber(
    options.fastFrameTimeMs,
    targetFrameTimeMs * defaults.fastFrameMultiplier,
    1,
    targetFrameTimeMs,
  );
  const slowFrameTimeMs = clampNumber(
    options.slowFrameTimeMs,
    targetFrameTimeMs * defaults.slowFrameMultiplier,
    targetFrameTimeMs,
    250,
  );
  const severeFrameTimeMs = clampNumber(
    options.severeFrameTimeMs,
    targetFrameTimeMs * defaults.severeFrameMultiplier,
    slowFrameTimeMs,
    500,
  );

  let minimumLevel = isQualityLevel(options.minimumLevel)
    ? options.minimumLevel
    : QUALITY_LEVELS.MINIMAL;
  let maximumLevel = isQualityLevel(options.maximumLevel)
    ? options.maximumLevel
    : selectMaximumQualityLevel(capabilityTier);
  if (levelIndex(minimumLevel) > levelIndex(maximumLevel)) {
    [minimumLevel, maximumLevel] = [maximumLevel, minimumLevel];
  }

  return Object.freeze({
    targetFrameTimeMs,
    fastFrameTimeMs,
    slowFrameTimeMs,
    severeFrameTimeMs,
    degradeAfterSamples: clampInteger(
      options.degradeAfterSamples,
      defaults.degradeAfterSamples,
      1,
      10_000,
    ),
    severeDegradeAfterSamples: clampInteger(
      options.severeDegradeAfterSamples,
      defaults.severeDegradeAfterSamples,
      1,
      10_000,
    ),
    upgradeAfterSamples: clampInteger(
      options.upgradeAfterSamples,
      defaults.upgradeAfterSamples,
      1,
      100_000,
    ),
    cooldownMs: clampNumber(
      options.cooldownMs,
      defaults.cooldownMs,
      0,
      300_000,
    ),
    emaAlpha: clampNumber(
      options.emaAlpha,
      defaults.emaAlpha,
      0.01,
      1,
    ),
    ignoreFrameTimeAboveMs: clampNumber(
      options.ignoreFrameTimeAboveMs,
      defaults.ignoreFrameTimeAboveMs,
      severeFrameTimeMs,
      60_000,
    ),
    minimumLevel,
    maximumLevel,
  });
}

/**
 * Creates deterministic reducer state. Time is supplied with samples, so this
 * function works unchanged in requestAnimationFrame, workers, tests, and SSR.
 *
 * @param {{initialLevel?: QualityLevel, capabilityTier?: string, capabilities?: {performanceTier?: string}, minimumLevel?: QualityLevel, maximumLevel?: QualityLevel, targetFps?: number, targetFrameTimeMs?: number, fastFrameTimeMs?: number, slowFrameTimeMs?: number, severeFrameTimeMs?: number, degradeAfterSamples?: number, severeDegradeAfterSamples?: number, upgradeAfterSamples?: number, cooldownMs?: number, emaAlpha?: number, ignoreFrameTimeAboveMs?: number}|null} [options]
 * @returns {DynamicQualityState}
 */
export function createDynamicQualityController(options = {}) {
  const settings = options && typeof options === "object" ? options : {};
  const capabilityTier =
    settings.capabilityTier ??
    (settings.capabilities &&
    typeof settings.capabilities === "object"
      ? settings.capabilities.performanceTier
      : undefined);
  const configuration = createConfiguration(settings, capabilityTier);
  const requestedLevel = isQualityLevel(settings.initialLevel)
    ? settings.initialLevel
    : selectInitialQualityLevel(capabilityTier);

  return {
    level: clampLevel(
      requestedLevel,
      configuration.minimumLevel,
      configuration.maximumLevel,
    ),
    emaFrameTimeMs: null,
    sampleCount: 0,
    slowStreak: 0,
    severeStreak: 0,
    fastStreak: 0,
    lastSampleAtMs: null,
    lastChangeAtMs: null,
    configuration,
  };
}

/**
 * @param {unknown} value
 * @returns {value is DynamicQualityState}
 */
export function isDynamicQualityState(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const configuration = value.configuration;
  const levelPosition = levelIndex(value.level);
  const minimumPosition = levelIndex(configuration?.minimumLevel);
  const maximumPosition = levelIndex(configuration?.maximumLevel);
  return (
    isQualityLevel(value.level) &&
    (value.emaFrameTimeMs === null ||
      (Number.isFinite(value.emaFrameTimeMs) &&
        value.emaFrameTimeMs > 0)) &&
    Number.isInteger(value.sampleCount) &&
    value.sampleCount >= 0 &&
    Number.isInteger(value.slowStreak) &&
    value.slowStreak >= 0 &&
    Number.isInteger(value.severeStreak) &&
    value.severeStreak >= 0 &&
    Number.isInteger(value.fastStreak) &&
    value.fastStreak >= 0 &&
    (value.lastSampleAtMs === null ||
      Number.isFinite(value.lastSampleAtMs)) &&
    (value.lastChangeAtMs === null ||
      Number.isFinite(value.lastChangeAtMs)) &&
    configuration &&
    typeof configuration === "object" &&
    isQualityLevel(configuration.minimumLevel) &&
    isQualityLevel(configuration.maximumLevel) &&
    minimumPosition <= maximumPosition &&
    levelPosition >= minimumPosition &&
    levelPosition <= maximumPosition &&
    Number.isFinite(configuration.targetFrameTimeMs) &&
    configuration.targetFrameTimeMs > 0 &&
    Number.isFinite(configuration.fastFrameTimeMs) &&
    configuration.fastFrameTimeMs > 0 &&
    configuration.fastFrameTimeMs <= configuration.targetFrameTimeMs &&
    Number.isFinite(configuration.slowFrameTimeMs) &&
    configuration.slowFrameTimeMs >= configuration.targetFrameTimeMs &&
    Number.isFinite(configuration.severeFrameTimeMs) &&
    configuration.severeFrameTimeMs >= configuration.slowFrameTimeMs &&
    Number.isInteger(configuration.degradeAfterSamples) &&
    configuration.degradeAfterSamples >= 1 &&
    Number.isInteger(configuration.severeDegradeAfterSamples) &&
    configuration.severeDegradeAfterSamples >= 1 &&
    Number.isInteger(configuration.upgradeAfterSamples) &&
    configuration.upgradeAfterSamples >= 1 &&
    Number.isFinite(configuration.cooldownMs) &&
    configuration.cooldownMs >= 0 &&
    Number.isFinite(configuration.emaAlpha) &&
    configuration.emaAlpha > 0 &&
    configuration.emaAlpha <= 1 &&
    Number.isFinite(configuration.ignoreFrameTimeAboveMs) &&
    configuration.ignoreFrameTimeAboveMs >=
      configuration.severeFrameTimeMs
  );
}

function createUpdateResult(
  state,
  {
    accepted = true,
    changed = false,
    previousLevel = state.level,
    reason = "stable",
  } = {},
) {
  return Object.freeze({
    state,
    accepted,
    changed,
    previousLevel,
    level: state.level,
    reason,
    budget: QUALITY_PROFILES[state.level],
  });
}

function resolveTimestamp(state, sample, frameTimeMs) {
  if (Number.isFinite(sample.timestampMs)) {
    return state.lastSampleAtMs === null
      ? sample.timestampMs
      : Math.max(state.lastSampleAtMs, sample.timestampMs);
  }

  return state.lastSampleAtMs === null
    ? 0
    : state.lastSampleAtMs + frameTimeMs;
}

function cooldownComplete(state, timestampMs) {
  return (
    state.lastChangeAtMs === null ||
    timestampMs - state.lastChangeAtMs >=
      state.configuration.cooldownMs
  );
}

function moveOneLevel(level, direction, configuration) {
  const currentIndex = levelIndex(level);
  const limit =
    direction < 0
      ? levelIndex(configuration.minimumLevel)
      : levelIndex(configuration.maximumLevel);
  const candidateIndex =
    direction < 0
      ? Math.max(limit, currentIndex - 1)
      : Math.min(limit, currentIndex + 1);
  return QUALITY_LEVEL_ORDER[candidateIndex];
}

/**
 * Records one measured render frame and returns the next immutable-by-convention
 * state. The function changes one level at a time, requires sustained evidence,
 * and uses a longer upgrade streak than downgrade streak to avoid oscillation.
 *
 * @param {DynamicQualityState} state
 * @param {{frameTimeMs: number, timestampMs?: number}|null|undefined} sample
 * @returns {Readonly<{state: DynamicQualityState, accepted: boolean, changed: boolean, previousLevel: QualityLevel, level: QualityLevel, reason: string, budget: Readonly<object>}>}
 */
export function updateDynamicQuality(state, sample) {
  if (!isDynamicQualityState(state)) {
    throw new TypeError("A valid dynamic quality state is required.");
  }

  const frameTimeMs =
    sample && typeof sample === "object" ? sample.frameTimeMs : null;
  if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) {
    return createUpdateResult(state, {
      accepted: false,
      reason: "invalid-sample",
    });
  }

  const timestampMs = resolveTimestamp(state, sample, frameTimeMs);
  if (frameTimeMs > state.configuration.ignoreFrameTimeAboveMs) {
    const nextState = {
      ...state,
      slowStreak: 0,
      severeStreak: 0,
      fastStreak: 0,
      lastSampleAtMs: timestampMs,
    };
    return createUpdateResult(nextState, {
      accepted: false,
      reason: "ignored-stall",
    });
  }

  const emaFrameTimeMs =
    state.emaFrameTimeMs === null
      ? frameTimeMs
      : state.emaFrameTimeMs +
        state.configuration.emaAlpha *
          (frameTimeMs - state.emaFrameTimeMs);
  const severe =
    frameTimeMs >= state.configuration.severeFrameTimeMs;
  const slow =
    !severe &&
    emaFrameTimeMs >= state.configuration.slowFrameTimeMs;
  const fast =
    !severe &&
    emaFrameTimeMs <= state.configuration.fastFrameTimeMs;
  const slowStreak = slow ? state.slowStreak + 1 : 0;
  const severeStreak = severe ? state.severeStreak + 1 : 0;
  const fastStreak = fast ? state.fastStreak + 1 : 0;
  const sampledState = {
    ...state,
    emaFrameTimeMs,
    sampleCount: Math.min(
      Number.MAX_SAFE_INTEGER,
      state.sampleCount + 1,
    ),
    slowStreak,
    severeStreak,
    fastStreak,
    lastSampleAtMs: timestampMs,
  };
  const wantsSevereDegrade =
    severeStreak >= state.configuration.severeDegradeAfterSamples;
  const wantsDegrade =
    slowStreak >= state.configuration.degradeAfterSamples;
  const wantsUpgrade =
    fastStreak >= state.configuration.upgradeAfterSamples;

  if (wantsSevereDegrade || wantsDegrade) {
    if (!cooldownComplete(state, timestampMs)) {
      return createUpdateResult(sampledState, { reason: "cooldown" });
    }

    const nextLevel = moveOneLevel(
      state.level,
      -1,
      state.configuration,
    );
    if (nextLevel === state.level) {
      return createUpdateResult(
        {
          ...sampledState,
          slowStreak: 0,
          severeStreak: 0,
        },
        { reason: "at-minimum" },
      );
    }

    const nextState = {
      ...sampledState,
      level: nextLevel,
      slowStreak: 0,
      severeStreak: 0,
      fastStreak: 0,
      lastChangeAtMs: timestampMs,
    };
    return createUpdateResult(nextState, {
      changed: true,
      previousLevel: state.level,
      reason: wantsSevereDegrade
        ? "severe-frame-pressure"
        : "sustained-slow-frames",
    });
  }

  if (wantsUpgrade) {
    if (!cooldownComplete(state, timestampMs)) {
      return createUpdateResult(sampledState, { reason: "cooldown" });
    }

    const nextLevel = moveOneLevel(
      state.level,
      1,
      state.configuration,
    );
    if (nextLevel === state.level) {
      return createUpdateResult(
        { ...sampledState, fastStreak: 0 },
        { reason: "at-maximum" },
      );
    }

    const nextState = {
      ...sampledState,
      level: nextLevel,
      slowStreak: 0,
      severeStreak: 0,
      fastStreak: 0,
      lastChangeAtMs: timestampMs,
    };
    return createUpdateResult(nextState, {
      changed: true,
      previousLevel: state.level,
      reason: "sustained-headroom",
    });
  }

  return createUpdateResult(sampledState);
}

/**
 * Returns the active operational budget. Reduced-motion preferences constrain
 * only decorative work; tracking cadence and capture quality remain useful.
 *
 * @param {DynamicQualityState|QualityLevel} stateOrLevel
 * @param {{reducedMotion?: boolean, limitEffects?: boolean}|null} [preferences]
 * @returns {Readonly<{level: QualityLevel, inferenceIntervalMs: number, inferenceFps: number, captureResolution: Readonly<{width: number, height: number}>, effectDensity: number, particleLimit: number, modelPreference: string}>}
 */
export function getDynamicQualityBudget(
  stateOrLevel,
  preferences = {},
) {
  const level =
    typeof stateOrLevel === "string"
      ? stateOrLevel
      : stateOrLevel?.level;
  if (!isQualityLevel(level)) {
    throw new TypeError("A valid quality level or state is required.");
  }

  const base = QUALITY_PROFILES[level];
  const settings =
    preferences && typeof preferences === "object" ? preferences : {};
  if (!settings.reducedMotion && !settings.limitEffects) {
    return base;
  }

  const reducedMotion = settings.reducedMotion === true;
  return Object.freeze({
    ...base,
    effectDensity: Math.min(
      base.effectDensity,
      reducedMotion ? 0.2 : 0.45,
    ),
    particleLimit: Math.min(
      base.particleLimit,
      reducedMotion ? 120 : 480,
    ),
  });
}
