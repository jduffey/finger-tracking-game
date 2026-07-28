export const EXPERIENCE_OUTCOMES = Object.freeze({
  COMPLETED: "completed",
  WON: "won",
  LOST: "lost",
  DRAW: "draw",
  ABANDONED: "abandoned",
});

export const EXPERIENCE_RESULT_TONES = Object.freeze({
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative",
});

export const EXPERIENCE_RESULT_ACTIONS = Object.freeze({
  RESTART: "restart",
  EXIT: "exit",
});

const VALID_OUTCOMES = new Set(Object.values(EXPERIENCE_OUTCOMES));
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const RESERVED_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_METRICS = 16;
const MAX_COPY_LENGTH = 240;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

const DEFAULT_RESULT_COPY = Object.freeze({
  [EXPERIENCE_OUTCOMES.COMPLETED]: Object.freeze({
    title: "Experience complete",
    message: "Nice work. Ready for another round?",
    tone: EXPERIENCE_RESULT_TONES.POSITIVE,
  }),
  [EXPERIENCE_OUTCOMES.WON]: Object.freeze({
    title: "You won!",
    message: "Great run. See if you can do it again.",
    tone: EXPERIENCE_RESULT_TONES.POSITIVE,
  }),
  [EXPERIENCE_OUTCOMES.LOST]: Object.freeze({
    title: "Round over",
    message: "Try again when you are ready.",
    tone: EXPERIENCE_RESULT_TONES.NEGATIVE,
  }),
  [EXPERIENCE_OUTCOMES.DRAW]: Object.freeze({
    title: "Draw",
    message: "Evenly matched. One more round?",
    tone: EXPERIENCE_RESULT_TONES.NEUTRAL,
  }),
  [EXPERIENCE_OUTCOMES.ABANDONED]: Object.freeze({
    title: "Session ended",
    message: "You can return whenever you are ready.",
    tone: EXPERIENCE_RESULT_TONES.NEUTRAL,
  }),
});

const DEFAULT_METRIC_LABELS = Object.freeze({
  score: "Score",
  accuracy: "Accuracy",
  combo: "Best combo",
  level: "Level",
  lives: "Lives",
  rally: "Best rally",
  streak: "Best streak",
  wave: "Wave",
  survivalMs: "Survival",
  targetsDestroyed: "Targets destroyed",
  threatsStopped: "Threats stopped",
  accuracyPercent: "Accuracy",
  smoothnessPercent: "Smoothness",
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIdentifier(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 80 ||
    RESERVED_IDENTIFIERS.has(value) ||
    !SAFE_IDENTIFIER_PATTERN.test(value)
  ) {
    return null;
  }
  return value;
}

function normalizeCopy(value) {
  if (typeof value !== "string") {
    return null;
  }
  const copy = value.trim();
  return copy ? copy.slice(0, MAX_COPY_LENGTH) : null;
}

function normalizeMetrics(value) {
  const metrics = {};
  if (!isRecord(value)) {
    return metrics;
  }

  for (const [rawId, rawValue] of Object.entries(value)) {
    const id = normalizeIdentifier(rawId);
    if (!id || !Number.isFinite(rawValue)) {
      continue;
    }
    metrics[id] = rawValue;
    if (Object.keys(metrics).length >= MAX_METRICS) {
      break;
    }
  }
  return metrics;
}

function uniqueMetricIds(values, metrics) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeIdentifier(value);
    if (!id || !Object.hasOwn(metrics, id) || ids.includes(id)) {
      continue;
    }
    ids.push(id);
  }
  return ids;
}

function normalizeDuration(value, fallback) {
  const duration = Number.isFinite(value) ? value : fallback;
  return Math.min(
    MAX_DURATION_MS,
    Math.max(0, Number.isFinite(duration) ? duration : 0),
  );
}

/**
 * Converts game-specific result data into a small serializable contract shared
 * by results screens and persistence adapters.
 */
export function normalizeExperienceResult(value, options = {}) {
  const settings = isRecord(options) ? options : {};
  const source = isRecord(value) ? value : {};
  const metrics = normalizeMetrics(source.metrics);
  const score = Number.isFinite(source.score)
    ? source.score
    : Number.isFinite(metrics.score)
      ? metrics.score
      : null;

  if (score !== null) {
    if (
      !Object.hasOwn(metrics, "score") &&
      Object.keys(metrics).length >= MAX_METRICS
    ) {
      delete metrics[Object.keys(metrics).at(-1)];
    }
    metrics.score = score;
  }

  const personalBestMetricIds = uniqueMetricIds(
    source.personalBestMetricIds,
    metrics,
  );

  return {
    outcome: VALID_OUTCOMES.has(source.outcome)
      ? source.outcome
      : EXPERIENCE_OUTCOMES.COMPLETED,
    score,
    metrics,
    durationMs: normalizeDuration(
      source.durationMs,
      settings.fallbackDurationMs ?? 0,
    ),
    title: normalizeCopy(source.title),
    message: normalizeCopy(source.message),
    isPersonalBest:
      Boolean(source.isPersonalBest) || personalBestMetricIds.length > 0,
    personalBestMetricIds,
  };
}

function humanizeIdentifier(identifier) {
  const spaced = identifier
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[._:-]+/g, " ")
    .trim();
  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : "Metric";
}

function formatNumber(value, locale) {
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(Math.round(value * 100) / 100);
  }
}

export function formatExperienceDuration(durationMs) {
  const safeDurationMs =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const totalSeconds = Math.round(safeDurationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createMetricView(metricId, value, result, definitions, locale) {
  const definition = isRecord(definitions?.[metricId])
    ? definitions[metricId]
    : {};
  const label =
    normalizeCopy(definition.label) ??
    DEFAULT_METRIC_LABELS[metricId] ??
    humanizeIdentifier(metricId);

  let formattedValue;
  if (typeof definition.format === "function") {
    try {
      formattedValue = definition.format(value);
    } catch {
      formattedValue = null;
    }
  }
  if (typeof formattedValue !== "string" || !formattedValue.trim()) {
    formattedValue = formatNumber(value, locale);
  }

  return {
    id: metricId,
    label,
    value,
    formattedValue: formattedValue.slice(0, MAX_COPY_LENGTH),
    isPersonalBest: result.personalBestMetricIds.includes(metricId),
  };
}

/**
 * Produces presentation-ready, mode-agnostic copy, metrics, and actions. A UI
 * can render this model without understanding the originating game's state.
 */
export function createExperienceResultViewModel(value, options = {}) {
  const settings = isRecord(options) ? options : {};
  const result = normalizeExperienceResult(value, {
    fallbackDurationMs: settings.fallbackDurationMs,
  });
  const defaults = DEFAULT_RESULT_COPY[result.outcome];
  const locale = normalizeCopy(settings.locale) ?? "en-US";
  const metricDefinitions = isRecord(settings.metricDefinitions)
    ? settings.metricDefinitions
    : {};

  const metricViews = Object.entries(result.metrics).map(([id, metricValue]) =>
    createMetricView(id, metricValue, result, metricDefinitions, locale),
  );

  if (result.durationMs > 0) {
    const durationMetric = {
      id: "duration",
      label: normalizeCopy(settings.durationLabel) ?? "Time",
      value: result.durationMs,
      formattedValue: formatExperienceDuration(result.durationMs),
      isPersonalBest: false,
    };
    const existingDurationIndex = metricViews.findIndex(
      ({ id }) => id === "duration",
    );
    if (existingDurationIndex >= 0) {
      metricViews[existingDurationIndex] = durationMetric;
    } else {
      metricViews.push(durationMetric);
    }
  }

  const requestedPrimaryMetricId = normalizeIdentifier(
    settings.primaryMetricId,
  );
  const primaryMetric =
    metricViews.find(({ id }) => id === requestedPrimaryMetricId) ??
    metricViews.find(({ id }) => id === "score") ??
    metricViews[0] ??
    null;
  const secondaryMetrics = primaryMetric
    ? metricViews.filter(({ id }) => id !== primaryMetric.id)
    : [];

  const title =
    normalizeCopy(settings.title) ?? result.title ?? defaults.title;
  const message =
    normalizeCopy(settings.message) ?? result.message ?? defaults.message;
  const eyebrow = result.isPersonalBest
    ? normalizeCopy(settings.personalBestLabel) ?? "New personal best"
    : normalizeCopy(settings.modeLabel) ?? "Results";

  const actions = [];
  if (settings.allowRestart !== false) {
    actions.push({
      id: EXPERIENCE_RESULT_ACTIONS.RESTART,
      label: normalizeCopy(settings.restartLabel) ?? "Play again",
      emphasis: "primary",
    });
  }
  actions.push({
    id: EXPERIENCE_RESULT_ACTIONS.EXIT,
    label: normalizeCopy(settings.exitLabel) ?? "Back to home",
    emphasis: actions.length === 0 ? "primary" : "secondary",
  });

  const announcementParts = [eyebrow, title];
  if (primaryMetric) {
    announcementParts.push(
      `${primaryMetric.label}: ${primaryMetric.formattedValue}`,
    );
  }

  return {
    outcome: result.outcome,
    tone: defaults.tone,
    eyebrow,
    title,
    message,
    isPersonalBest: result.isPersonalBest,
    primaryMetric,
    secondaryMetrics,
    metrics: metricViews,
    actions,
    announcement: announcementParts.join(". "),
  };
}
