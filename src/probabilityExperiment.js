const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const PROBABILITY_BATCH_SIZES = Object.freeze([10, 50, 100]);

export const PROBABILITY_EVENTS = Object.freeze([
  Object.freeze({
    id: "red",
    label: "Red",
    shortLabel: "Red",
    description: "Any of the 18 red numbers",
    favorableOutcomes: 18,
    matches: (number) => number !== 0 && RED_NUMBERS.has(number),
  }),
  Object.freeze({
    id: "even",
    label: "Even",
    shortLabel: "Even",
    description: "Any even number from 2 through 36",
    favorableOutcomes: 18,
    matches: (number) => number !== 0 && number % 2 === 0,
  }),
  Object.freeze({
    id: "low",
    label: "Low half",
    shortLabel: "1–18",
    description: "Any number from 1 through 18",
    favorableOutcomes: 18,
    matches: (number) => number >= 1 && number <= 18,
  }),
  Object.freeze({
    id: "first-dozen",
    label: "First dozen",
    shortLabel: "1–12",
    description: "Any number from 1 through 12",
    favorableOutcomes: 12,
    matches: (number) => number >= 1 && number <= 12,
  }),
  Object.freeze({
    id: "zero",
    label: "Zero",
    shortLabel: "0",
    description: "The single green zero",
    favorableOutcomes: 1,
    matches: (number) => number === 0,
  }),
]);

const eventById = new Map(
  PROBABILITY_EVENTS.map((event) => [event.id, event]),
);

function clampInteger(value, minimum, maximum, fallback = minimum) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(Number(value))));
}

function normalizeRandomValue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(0.999999999, Math.max(0, value));
}

export function getProbabilityEvent(eventId) {
  return eventById.get(eventId) ?? PROBABILITY_EVENTS[0];
}

export function getRouletteNumberColor(number) {
  if (number === 0) {
    return "green";
  }
  return RED_NUMBERS.has(number) ? "red" : "black";
}

export function getExpectedProbability(eventId) {
  return getProbabilityEvent(eventId).favorableOutcomes / 37;
}

export function getExpectedHitCount(eventId, trialCount) {
  const safeTrialCount = clampInteger(trialCount, 1, 1_000, 10);
  return getExpectedProbability(eventId) * safeTrialCount;
}

export function createProbabilityBatch(
  {
    eventId = PROBABILITY_EVENTS[0].id,
    trialCount = PROBABILITY_BATCH_SIZES[0],
    predictedHits,
  } = {},
  random = Math.random,
) {
  const event = getProbabilityEvent(eventId);
  const safeTrialCount = clampInteger(trialCount, 1, 1_000, 10);
  const safePrediction = clampInteger(
    predictedHits,
    0,
    safeTrialCount,
    Math.round(getExpectedHitCount(event.id, safeTrialCount)),
  );
  const outcomes = [];
  let hits = 0;

  for (let index = 0; index < safeTrialCount; index += 1) {
    const randomValue =
      typeof random === "function" ? random() : Math.random();
    const number = Math.floor(normalizeRandomValue(randomValue) * 37);
    const hit = event.matches(number);
    outcomes.push({
      number,
      color: getRouletteNumberColor(number),
      hit,
    });
    if (hit) {
      hits += 1;
    }
  }

  const expectedProbability = getExpectedProbability(event.id);
  const observedProbability = hits / safeTrialCount;
  return {
    eventId: event.id,
    trialCount: safeTrialCount,
    predictedHits: safePrediction,
    expectedHits: expectedProbability * safeTrialCount,
    hits,
    misses: safeTrialCount - hits,
    expectedProbability,
    observedProbability,
    predictionError: Math.abs(safePrediction - hits),
    expectationError: Math.abs(
      expectedProbability - observedProbability,
    ),
    outcomes,
  };
}

export function summarizeProbabilityBatches(
  batches,
  eventId = PROBABILITY_EVENTS[0].id,
) {
  const event = getProbabilityEvent(eventId);
  const compatibleBatches = (Array.isArray(batches) ? batches : []).filter(
    (batch) => batch?.eventId === event.id,
  );
  const trialCount = compatibleBatches.reduce(
    (total, batch) => total + (Number(batch.trialCount) || 0),
    0,
  );
  const hits = compatibleBatches.reduce(
    (total, batch) => total + (Number(batch.hits) || 0),
    0,
  );
  const outcomes = compatibleBatches.flatMap((batch) =>
    Array.isArray(batch.outcomes) ? batch.outcomes : [],
  );
  const expectedProbability = getExpectedProbability(event.id);

  return {
    eventId: event.id,
    batches: compatibleBatches.length,
    trialCount,
    hits,
    misses: Math.max(0, trialCount - hits),
    expectedProbability,
    observedProbability:
      trialCount > 0 ? hits / trialCount : 0,
    outcomes,
  };
}

export function getProbabilityIndependenceInsight(outcomes) {
  const recent = (Array.isArray(outcomes) ? outcomes : []).slice(-5);
  if (recent.length < 4) {
    return null;
  }
  const colors = recent
    .map((outcome) => outcome?.color)
    .filter((color) => color === "red" || color === "black");
  if (colors.length < 4) {
    return null;
  }
  const tailColor = colors.at(-1);
  let streak = 0;
  for (let index = colors.length - 1; index >= 0; index -= 1) {
    if (colors[index] !== tailColor) {
      break;
    }
    streak += 1;
  }
  if (streak < 4) {
    return null;
  }
  const label = `${tailColor[0].toUpperCase()}${tailColor.slice(1)}`;
  return `${label} appeared ${streak} times in a row, but the next trial is still independent. A streak does not make the opposite color “due.”`;
}
