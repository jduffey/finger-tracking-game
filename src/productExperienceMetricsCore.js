export const PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION = 1;
export const PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY =
  "motionArcade.productExperienceMetrics.v1";

export const PRODUCT_EXPERIENCE_METRICS_PRIVACY = Object.freeze({
  scope: "device-local",
  granularity: "aggregate-only",
  containsRawEvents: false,
  containsSessionIds: false,
  containsTimestamps: false,
  containsCameraData: false,
});

export const PRODUCT_EXPERIENCE_METRICS_LIMITS = Object.freeze({
  maxModes: 48,
  maxJsonBytes: 64 * 1024,
  maxCounter: 1_000_000,
  maxObservationDurationMs: 4 * 60 * 60 * 1_000,
  maxAggregateDurationMs: 10 * 365 * 24 * 60 * 60 * 1_000,
});

export const PRODUCT_METRIC_INPUT_METHODS = Object.freeze({
  GESTURE: "gesture",
  POINTER: "pointer",
  KEYBOARD: "keyboard",
  OTHER: "other",
});

export const PRODUCT_METRIC_TUTORIAL_OUTCOMES = Object.freeze({
  COMPLETED: "completed",
  SKIPPED: "skipped",
  ABANDONED: "abandoned",
});

export const PRODUCT_METRIC_EVENT_TYPES = Object.freeze({
  EXPERIENCE_STARTED: "experience-started",
  EXPERIENCE_COMPLETED: "experience-completed",
  EXPERIENCE_ABANDONED: "experience-abandoned",
  RETRY: "retry",
  SELECTION_ATTEMPT: "selection-attempt",
  FIRST_SUCCESS: "first-success",
  TRACKING_LOSS: "tracking-loss",
  TUTORIAL_STARTED: "tutorial-started",
  TUTORIAL_OUTCOME: "tutorial-outcome",
});

export const PRODUCT_METRICS_STORAGE_STATUS = Object.freeze({
  EMPTY: "empty",
  LOADED: "loaded",
  SAVED: "saved",
  CLEARED: "cleared",
  UNAVAILABLE: "unavailable",
  INVALID: "invalid",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
  WRITE_BLOCKED: "write-blocked",
});

const INPUT_METHOD_VALUES = Object.freeze(
  Object.values(PRODUCT_METRIC_INPUT_METHODS),
);
const TUTORIAL_OUTCOME_VALUES = Object.freeze(
  Object.values(PRODUCT_METRIC_TUTORIAL_OUTCOMES),
);
const MODE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const RESERVED_MODE_IDS = new Set(["__proto__", "constructor", "prototype"]);
const FIRST_SUCCESS_BUCKETS = Object.freeze([
  "under5s",
  "under15s",
  "under30s",
  "under60s",
  "over60s",
]);
const TRACKING_LOSS_BUCKETS = Object.freeze([
  "under250ms",
  "under1s",
  "under3s",
  "over3s",
]);

function createCounterMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function createInputMethodMetrics() {
  return Object.fromEntries(
    INPUT_METHOD_VALUES.map((method) => [
      method,
      { attempts: 0, failures: 0 },
    ]),
  );
}

function createRollup() {
  return {
    experiences: {
      started: 0,
      completed: 0,
      abandoned: 0,
      retries: 0,
    },
    selections: {
      attempts: 0,
      failures: 0,
      byInput: createInputMethodMetrics(),
    },
    firstSuccess: {
      observations: 0,
      totalDurationMs: 0,
      minimumDurationMs: null,
      maximumDurationMs: null,
      buckets: createCounterMap(FIRST_SUCCESS_BUCKETS),
    },
    trackingLoss: {
      incidents: 0,
      totalDurationMs: 0,
      maximumDurationMs: 0,
      buckets: createCounterMap(TRACKING_LOSS_BUCKETS),
    },
    tutorials: {
      started: 0,
      completed: 0,
      skipped: 0,
      abandoned: 0,
    },
  };
}

export function createEmptyProductExperienceMetrics() {
  return {
    version: PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION,
    privacy: { ...PRODUCT_EXPERIENCE_METRICS_PRIVACY },
    revision: 0,
    totals: createRollup(),
    modes: {},
  };
}

function isBoundedInteger(
  value,
  maximum = PRODUCT_EXPERIENCE_METRICS_LIMITS.maxCounter,
) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

function readCounter(value) {
  return isBoundedInteger(value) ? value : null;
}

function readDuration(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

function sumClamped(values, maximum = PRODUCT_EXPERIENCE_METRICS_LIMITS.maxCounter) {
  return Math.min(
    maximum,
    values.reduce((sum, value) => Math.min(maximum, sum + value), 0),
  );
}

function normalizeCounterObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const normalized = {};
  for (const key of keys) {
    const counter = readCounter(value[key]);
    if (counter === null) {
      return null;
    }
    normalized[key] = counter;
  }
  return normalized;
}

function normalizeRollup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const experiences = normalizeCounterObject(value.experiences, [
    "started",
    "completed",
    "abandoned",
    "retries",
  ]);
  if (
    !experiences ||
    sumClamped([experiences.completed, experiences.abandoned]) >
      experiences.started
  ) {
    return null;
  }

  const byInput = {};
  for (const method of INPUT_METHOD_VALUES) {
    const methodMetrics = normalizeCounterObject(
      value.selections?.byInput?.[method],
      ["attempts", "failures"],
    );
    if (!methodMetrics || methodMetrics.failures > methodMetrics.attempts) {
      return null;
    }
    byInput[method] = methodMetrics;
  }
  const attempts = readCounter(value.selections?.attempts);
  const failures = readCounter(value.selections?.failures);
  if (
    attempts === null ||
    failures === null ||
    failures > attempts ||
    attempts !==
      sumClamped(INPUT_METHOD_VALUES.map((method) => byInput[method].attempts)) ||
    failures !==
      sumClamped(INPUT_METHOD_VALUES.map((method) => byInput[method].failures))
  ) {
    return null;
  }

  const firstSuccessBuckets = normalizeCounterObject(
    value.firstSuccess?.buckets,
    FIRST_SUCCESS_BUCKETS,
  );
  const firstSuccessObservations = readCounter(
    value.firstSuccess?.observations,
  );
  const firstSuccessTotal = readDuration(
    value.firstSuccess?.totalDurationMs,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxAggregateDurationMs,
  );
  const firstSuccessMinimum =
    value.firstSuccess?.minimumDurationMs === null
      ? null
      : readDuration(
          value.firstSuccess?.minimumDurationMs,
          PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs,
        );
  const firstSuccessMaximum =
    value.firstSuccess?.maximumDurationMs === null
      ? null
      : readDuration(
          value.firstSuccess?.maximumDurationMs,
          PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs,
        );
  if (
    !firstSuccessBuckets ||
    firstSuccessObservations === null ||
    firstSuccessTotal === null ||
    firstSuccessObservations !==
      sumClamped(Object.values(firstSuccessBuckets)) ||
    (firstSuccessObservations === 0 &&
      (firstSuccessTotal !== 0 ||
        firstSuccessMinimum !== null ||
        firstSuccessMaximum !== null)) ||
    (firstSuccessObservations > 0 &&
      (firstSuccessMinimum === null ||
        firstSuccessMaximum === null ||
        firstSuccessMinimum > firstSuccessMaximum ||
        firstSuccessTotal < firstSuccessMinimum ||
        firstSuccessTotal < firstSuccessMaximum))
  ) {
    return null;
  }

  const trackingLossBuckets = normalizeCounterObject(
    value.trackingLoss?.buckets,
    TRACKING_LOSS_BUCKETS,
  );
  const trackingLossIncidents = readCounter(value.trackingLoss?.incidents);
  const trackingLossTotal = readDuration(
    value.trackingLoss?.totalDurationMs,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxAggregateDurationMs,
  );
  const trackingLossMaximum = readDuration(
    value.trackingLoss?.maximumDurationMs,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs,
  );
  if (
    !trackingLossBuckets ||
    trackingLossIncidents === null ||
    trackingLossTotal === null ||
    trackingLossMaximum === null ||
    trackingLossIncidents !==
      sumClamped(Object.values(trackingLossBuckets)) ||
    (trackingLossIncidents === 0 &&
      (trackingLossTotal !== 0 || trackingLossMaximum !== 0)) ||
    (trackingLossIncidents > 0 &&
      (trackingLossTotal < trackingLossMaximum ||
        trackingLossMaximum >
          PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs))
  ) {
    return null;
  }

  const tutorials = normalizeCounterObject(value.tutorials, [
    "started",
    "completed",
    "skipped",
    "abandoned",
  ]);
  if (
    !tutorials ||
    sumClamped([
      tutorials.completed,
      tutorials.skipped,
      tutorials.abandoned,
    ]) > tutorials.started
  ) {
    return null;
  }

  return {
    experiences,
    selections: { attempts, failures, byInput },
    firstSuccess: {
      observations: firstSuccessObservations,
      totalDurationMs: firstSuccessTotal,
      minimumDurationMs: firstSuccessMinimum,
      maximumDurationMs: firstSuccessMaximum,
      buckets: firstSuccessBuckets,
    },
    trackingLoss: {
      incidents: trackingLossIncidents,
      totalDurationMs: trackingLossTotal,
      maximumDurationMs: trackingLossMaximum,
      buckets: trackingLossBuckets,
    },
    tutorials,
  };
}

function normalizeModeId(value) {
  if (
    typeof value !== "string" ||
    !MODE_ID_PATTERN.test(value) ||
    RESERVED_MODE_IDS.has(value)
  ) {
    return null;
  }
  return value;
}

function detectStoredVersion(value) {
  return Number.isInteger(value?.version) ? value.version : null;
}

export function normalizeProductExperienceMetrics(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION ||
    !isBoundedInteger(value.revision) ||
    !value.modes ||
    typeof value.modes !== "object" ||
    Array.isArray(value.modes)
  ) {
    return null;
  }

  const totals = normalizeRollup(value.totals);
  const entries = Object.entries(value.modes);
  if (
    !totals ||
    entries.length > PRODUCT_EXPERIENCE_METRICS_LIMITS.maxModes
  ) {
    return null;
  }

  const modes = {};
  for (const [rawModeId, rawMode] of entries) {
    const modeId = normalizeModeId(rawModeId);
    const metrics = normalizeRollup(rawMode?.metrics);
    const lastEventRevision = readCounter(rawMode?.lastEventRevision);
    if (
      !modeId ||
      !metrics ||
      lastEventRevision === null ||
      lastEventRevision > value.revision
    ) {
      return null;
    }
    modes[modeId] = { lastEventRevision, metrics };
  }

  return {
    version: PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION,
    privacy: { ...PRODUCT_EXPERIENCE_METRICS_PRIVACY },
    revision: value.revision,
    totals,
    modes,
  };
}

function clampCounter(value) {
  return Math.min(
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxCounter,
    Math.max(0, Math.round(value)),
  );
}

function incrementCounter(value) {
  return clampCounter(value + 1);
}

function addDuration(total, durationMs) {
  return Math.min(
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxAggregateDurationMs,
    total + durationMs,
  );
}

function cloneRollup(rollup) {
  return {
    experiences: { ...rollup.experiences },
    selections: {
      attempts: rollup.selections.attempts,
      failures: rollup.selections.failures,
      byInput: Object.fromEntries(
        INPUT_METHOD_VALUES.map((method) => [
          method,
          { ...rollup.selections.byInput[method] },
        ]),
      ),
    },
    firstSuccess: {
      ...rollup.firstSuccess,
      buckets: { ...rollup.firstSuccess.buckets },
    },
    trackingLoss: {
      ...rollup.trackingLoss,
      buckets: { ...rollup.trackingLoss.buckets },
    },
    tutorials: { ...rollup.tutorials },
  };
}

function firstSuccessBucket(durationMs) {
  if (durationMs < 5_000) {
    return "under5s";
  }
  if (durationMs < 15_000) {
    return "under15s";
  }
  if (durationMs < 30_000) {
    return "under30s";
  }
  if (durationMs < 60_000) {
    return "under60s";
  }
  return "over60s";
}

function trackingLossBucket(durationMs) {
  if (durationMs < 250) {
    return "under250ms";
  }
  if (durationMs < 1_000) {
    return "under1s";
  }
  if (durationMs < 3_000) {
    return "under3s";
  }
  return "over3s";
}

function applyNormalizedEvent(rollup, event) {
  switch (event.type) {
    case PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_STARTED:
      rollup.experiences.started = incrementCounter(
        rollup.experiences.started,
      );
      break;
    case PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_COMPLETED:
      rollup.experiences.completed = incrementCounter(
        rollup.experiences.completed,
      );
      break;
    case PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_ABANDONED:
      rollup.experiences.abandoned = incrementCounter(
        rollup.experiences.abandoned,
      );
      break;
    case PRODUCT_METRIC_EVENT_TYPES.RETRY:
      rollup.experiences.retries = incrementCounter(
        rollup.experiences.retries,
      );
      break;
    case PRODUCT_METRIC_EVENT_TYPES.SELECTION_ATTEMPT: {
      const input = rollup.selections.byInput[event.inputMethod];
      input.attempts = incrementCounter(input.attempts);
      if (!event.succeeded) {
        input.failures = incrementCounter(input.failures);
      }
      rollup.selections.attempts = sumClamped(
        INPUT_METHOD_VALUES.map(
          (method) => rollup.selections.byInput[method].attempts,
        ),
      );
      rollup.selections.failures = sumClamped(
        INPUT_METHOD_VALUES.map(
          (method) => rollup.selections.byInput[method].failures,
        ),
      );
      break;
    }
    case PRODUCT_METRIC_EVENT_TYPES.FIRST_SUCCESS: {
      const metric = rollup.firstSuccess;
      metric.observations = incrementCounter(metric.observations);
      metric.totalDurationMs = addDuration(
        metric.totalDurationMs,
        event.durationMs,
      );
      metric.minimumDurationMs =
        metric.minimumDurationMs === null
          ? event.durationMs
          : Math.min(metric.minimumDurationMs, event.durationMs);
      metric.maximumDurationMs =
        metric.maximumDurationMs === null
          ? event.durationMs
          : Math.max(metric.maximumDurationMs, event.durationMs);
      const bucket = firstSuccessBucket(event.durationMs);
      metric.buckets[bucket] = incrementCounter(metric.buckets[bucket]);
      break;
    }
    case PRODUCT_METRIC_EVENT_TYPES.TRACKING_LOSS: {
      const metric = rollup.trackingLoss;
      metric.incidents = incrementCounter(metric.incidents);
      metric.totalDurationMs = addDuration(
        metric.totalDurationMs,
        event.durationMs,
      );
      metric.maximumDurationMs = Math.max(
        metric.maximumDurationMs,
        event.durationMs,
      );
      const bucket = trackingLossBucket(event.durationMs);
      metric.buckets[bucket] = incrementCounter(metric.buckets[bucket]);
      break;
    }
    case PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_STARTED:
      rollup.tutorials.started = incrementCounter(rollup.tutorials.started);
      break;
    case PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_OUTCOME:
      rollup.tutorials[event.outcome] = incrementCounter(
        rollup.tutorials[event.outcome],
      );
      break;
    default:
      break;
  }
  return rollup;
}

function normalizeDuration(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.min(
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs,
    Math.round(value),
  );
}

function normalizeMetricEvent(event) {
  const modeId = normalizeModeId(event?.modeId);
  if (!modeId || !Object.values(PRODUCT_METRIC_EVENT_TYPES).includes(event?.type)) {
    return null;
  }
  const normalized = { type: event.type, modeId };
  if (event.type === PRODUCT_METRIC_EVENT_TYPES.SELECTION_ATTEMPT) {
    if (typeof event.succeeded !== "boolean") {
      return null;
    }
    normalized.succeeded = event.succeeded;
    normalized.inputMethod = INPUT_METHOD_VALUES.includes(event.inputMethod)
      ? event.inputMethod
      : PRODUCT_METRIC_INPUT_METHODS.OTHER;
  }
  if (
    event.type === PRODUCT_METRIC_EVENT_TYPES.FIRST_SUCCESS ||
    event.type === PRODUCT_METRIC_EVENT_TYPES.TRACKING_LOSS
  ) {
    normalized.durationMs = normalizeDuration(event.durationMs);
    if (normalized.durationMs === null) {
      return null;
    }
  }
  if (event.type === PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_OUTCOME) {
    if (!TUTORIAL_OUTCOME_VALUES.includes(event.outcome)) {
      return null;
    }
    normalized.outcome = event.outcome;
  }
  return normalized;
}

function findEvictionCandidate(modes) {
  return Object.entries(modes)
    .sort(
      ([leftId, left], [rightId, right]) =>
        left.lastEventRevision - right.lastEventRevision ||
        leftId.localeCompare(rightId),
    )
    .at(0)?.[0];
}

function canApplyNormalizedEvent(rollup, event) {
  if (
    event.type === PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_COMPLETED ||
    event.type === PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_ABANDONED
  ) {
    const finished = sumClamped([
      rollup.experiences.completed,
      rollup.experiences.abandoned,
    ]);
    return (
      finished < rollup.experiences.started ||
      finished === PRODUCT_EXPERIENCE_METRICS_LIMITS.maxCounter
    );
  }
  if (event.type === PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_OUTCOME) {
    const outcomes = sumClamped([
      rollup.tutorials.completed,
      rollup.tutorials.skipped,
      rollup.tutorials.abandoned,
    ]);
    return (
      outcomes < rollup.tutorials.started ||
      outcomes === PRODUCT_EXPERIENCE_METRICS_LIMITS.maxCounter
    );
  }
  return true;
}

/**
 * Reduces one aggregate event without retaining the event itself. Callers can
 * attach arbitrary transient metadata to the input; only the fixed schema above
 * can reach the returned snapshot.
 */
export function recordProductExperienceMetric(metrics, event) {
  const current = normalizeProductExperienceMetrics(metrics);
  const normalizedEvent = normalizeMetricEvent(event);
  if (!current || !normalizedEvent) {
    return {
      accepted: false,
      reason: current ? "invalid-event" : "invalid-metrics",
      metrics: current ?? createEmptyProductExperienceMetrics(),
    };
  }

  const eventNeedsExistingMode =
    normalizedEvent.type ===
      PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_COMPLETED ||
    normalizedEvent.type ===
      PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_ABANDONED ||
    normalizedEvent.type === PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_OUTCOME;
  const existingMode = current.modes[normalizedEvent.modeId]?.metrics ?? null;
  if (
    eventNeedsExistingMode &&
    (!existingMode ||
      !canApplyNormalizedEvent(existingMode, normalizedEvent) ||
      !canApplyNormalizedEvent(current.totals, normalizedEvent))
  ) {
    return {
      accepted: false,
      reason: "invalid-transition",
      metrics: current,
    };
  }

  const revision = incrementCounter(current.revision);
  const modes = { ...current.modes };
  if (!Object.hasOwn(modes, normalizedEvent.modeId)) {
    if (
      Object.keys(modes).length >=
      PRODUCT_EXPERIENCE_METRICS_LIMITS.maxModes
    ) {
      delete modes[findEvictionCandidate(modes)];
    }
    modes[normalizedEvent.modeId] = {
      lastEventRevision: revision,
      metrics: createRollup(),
    };
  }

  const mode = modes[normalizedEvent.modeId];
  const nextMode = {
    lastEventRevision: revision,
    metrics: applyNormalizedEvent(
      cloneRollup(mode.metrics),
      normalizedEvent,
    ),
  };
  modes[normalizedEvent.modeId] = nextMode;

  return {
    accepted: true,
    event: normalizedEvent,
    metrics: {
      ...current,
      revision,
      totals: applyNormalizedEvent(
        cloneRollup(current.totals),
        normalizedEvent,
      ),
      modes,
    },
  };
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function serializeProductExperienceMetrics(
  metrics,
  { pretty = true } = {},
) {
  const normalized = normalizeProductExperienceMetrics(metrics);
  if (!normalized) {
    return {
      ok: false,
      reason: "invalid-metrics",
      message: "The local experience metrics are not valid.",
    };
  }
  let json = JSON.stringify(normalized, null, pretty ? 2 : 0);
  if (
    pretty &&
    byteLength(json) > PRODUCT_EXPERIENCE_METRICS_LIMITS.maxJsonBytes
  ) {
    json = JSON.stringify(normalized);
  }
  if (byteLength(json) > PRODUCT_EXPERIENCE_METRICS_LIMITS.maxJsonBytes) {
    return {
      ok: false,
      reason: "payload-too-large",
      message: "The local experience metrics exceed the export limit.",
    };
  }
  return { ok: true, metrics: normalized, json };
}

export function parseProductExperienceMetricsJSON(json) {
  if (
    typeof json !== "string" ||
    byteLength(json) > PRODUCT_EXPERIENCE_METRICS_LIMITS.maxJsonBytes
  ) {
    return {
      ok: false,
      reason: "payload-too-large",
      message: "The selected metrics file exceeds the local import limit.",
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      reason: "invalid-json",
      message: "The selected metrics file is not valid JSON.",
    };
  }
  const storedVersion = detectStoredVersion(parsed);
  if (
    storedVersion !== null &&
    storedVersion > PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      reason: "unsupported-version",
      message: "These metrics were created by a newer app version.",
      storedVersion,
    };
  }
  const metrics = normalizeProductExperienceMetrics(parsed);
  return metrics
    ? { ok: true, metrics, storedVersion }
    : {
        ok: false,
        reason: "invalid-metrics",
        message: "The selected metrics file does not match the aggregate schema.",
        storedVersion,
      };
}

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readProductExperienceMetrics(storage) {
  const target = resolveStorage(storage);
  if (!target?.getItem) {
    return {
      metrics: createEmptyProductExperienceMetrics(),
      status: PRODUCT_METRICS_STORAGE_STATUS.UNAVAILABLE,
      storedVersion: null,
    };
  }
  let json;
  try {
    json = target.getItem(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY);
  } catch {
    return {
      metrics: createEmptyProductExperienceMetrics(),
      status: PRODUCT_METRICS_STORAGE_STATUS.UNAVAILABLE,
      storedVersion: null,
    };
  }
  if (!json) {
    return {
      metrics: createEmptyProductExperienceMetrics(),
      status: PRODUCT_METRICS_STORAGE_STATUS.EMPTY,
      storedVersion: null,
    };
  }
  const parsed = parseProductExperienceMetricsJSON(json);
  if (parsed.ok) {
    return {
      metrics: parsed.metrics,
      status: PRODUCT_METRICS_STORAGE_STATUS.LOADED,
      storedVersion: parsed.storedVersion,
    };
  }
  return {
    metrics: createEmptyProductExperienceMetrics(),
    status:
      parsed.reason === "unsupported-version"
        ? PRODUCT_METRICS_STORAGE_STATUS.UNSUPPORTED
        : PRODUCT_METRICS_STORAGE_STATUS.INVALID,
    storedVersion: parsed.storedVersion,
  };
}

export function writeProductExperienceMetrics(metrics, storage) {
  const serialized = serializeProductExperienceMetrics(metrics, {
    pretty: false,
  });
  if (!serialized.ok) {
    return {
      ...serialized,
      status: PRODUCT_METRICS_STORAGE_STATUS.INVALID,
    };
  }
  const target = resolveStorage(storage);
  if (!target?.setItem) {
    return {
      ...serialized,
      ok: false,
      status: PRODUCT_METRICS_STORAGE_STATUS.UNAVAILABLE,
      reason: "storage-unavailable",
    };
  }
  try {
    target.setItem(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY, serialized.json);
    return {
      ...serialized,
      status: PRODUCT_METRICS_STORAGE_STATUS.SAVED,
    };
  } catch {
    return {
      ...serialized,
      ok: false,
      status: PRODUCT_METRICS_STORAGE_STATUS.FAILED,
      reason: "storage-failed",
    };
  }
}

export function clearProductExperienceMetrics(storage) {
  const metrics = createEmptyProductExperienceMetrics();
  const target = resolveStorage(storage);
  if (!target?.removeItem) {
    return {
      metrics,
      status: PRODUCT_METRICS_STORAGE_STATUS.UNAVAILABLE,
    };
  }
  try {
    target.removeItem(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY);
    return {
      metrics,
      status: PRODUCT_METRICS_STORAGE_STATUS.CLEARED,
    };
  } catch {
    return {
      metrics,
      status: PRODUCT_METRICS_STORAGE_STATUS.FAILED,
    };
  }
}

function average(total, observations) {
  return observations > 0 ? Math.round(total / observations) : null;
}

function ratio(numerator, denominator) {
  return denominator > 0
    ? Number((numerator / denominator).toFixed(4))
    : null;
}

/**
 * Returns display-ready rates without persisting new data or exposing transient
 * session state.
 */
export function summarizeProductExperienceMetrics(metrics, modeId) {
  const normalized = normalizeProductExperienceMetrics(metrics);
  if (!normalized) {
    return null;
  }
  const wantsTotals = modeId === undefined;
  const normalizedModeId = wantsTotals ? null : normalizeModeId(modeId);
  if (!wantsTotals && normalizedModeId === null) {
    return null;
  }
  const source = wantsTotals
    ? normalized.totals
    : normalized.modes[normalizedModeId]?.metrics;
  if (!source) {
    return null;
  }
  const finished =
    source.experiences.completed + source.experiences.abandoned;
  const tutorialOutcomes =
    source.tutorials.completed +
    source.tutorials.skipped +
    source.tutorials.abandoned;
  return {
    experiences: {
      ...source.experiences,
      completionRate: ratio(source.experiences.completed, finished),
      abandonmentRate: ratio(source.experiences.abandoned, finished),
    },
    selections: {
      ...source.selections,
      failureRate: ratio(
        source.selections.failures,
        source.selections.attempts,
      ),
    },
    firstSuccess: {
      ...source.firstSuccess,
      averageDurationMs: average(
        source.firstSuccess.totalDurationMs,
        source.firstSuccess.observations,
      ),
    },
    trackingLoss: {
      ...source.trackingLoss,
      averageDurationMs: average(
        source.trackingLoss.totalDurationMs,
        source.trackingLoss.incidents,
      ),
    },
    tutorials: {
      ...source.tutorials,
      completionRate: ratio(
        source.tutorials.completed,
        tutorialOutcomes,
      ),
    },
  };
}
