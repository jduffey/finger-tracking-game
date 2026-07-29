import test from "node:test";
import assert from "node:assert/strict";

import {
  PROBABILITY_EVENTS,
  createProbabilityBatch,
  getExpectedHitCount,
  getExpectedProbability,
  getProbabilityIndependenceInsight,
  getRouletteNumberColor,
  summarizeProbabilityBatches,
} from "../src/probabilityExperiment.js";

function sequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

test("event probabilities use all 37 equally likely outcomes", () => {
  assert.equal(PROBABILITY_EVENTS.length, 5);
  assert.equal(getExpectedProbability("red"), 18 / 37);
  assert.equal(getExpectedProbability("first-dozen"), 12 / 37);
  assert.equal(getExpectedProbability("zero"), 1 / 37);
  assert.equal(getExpectedHitCount("zero", 37), 1);
});

test("finite batches preserve a prediction and expose observed comparison", () => {
  const random = sequenceRandom([
    0 / 37,
    1 / 37,
    2 / 37,
    3 / 37,
    4 / 37,
  ]);
  const batch = createProbabilityBatch(
    {
      eventId: "even",
      trialCount: 5,
      predictedHits: 3,
    },
    random,
  );

  assert.deepEqual(
    batch.outcomes.map(({ number }) => number),
    [0, 1, 2, 3, 4],
  );
  assert.equal(batch.hits, 2);
  assert.equal(batch.misses, 3);
  assert.equal(batch.predictedHits, 3);
  assert.equal(batch.predictionError, 1);
  assert.equal(batch.observedProbability, 2 / 5);
});

test("invalid random values and predictions stay inside experiment bounds", () => {
  const batch = createProbabilityBatch(
    {
      eventId: "zero",
      trialCount: 3,
      predictedHits: 99,
    },
    sequenceRandom([-10, Number.NaN, 40]),
  );

  assert.deepEqual(
    batch.outcomes.map(({ number }) => number),
    [0, 0, 36],
  );
  assert.equal(batch.predictedHits, 3);
  assert.equal(batch.hits, 2);
});

test("summaries combine compatible batches and ignore other events", () => {
  const redBatch = createProbabilityBatch(
    { eventId: "red", trialCount: 4, predictedHits: 2 },
    sequenceRandom([1 / 37, 2 / 37, 3 / 37, 4 / 37]),
  );
  const secondRedBatch = createProbabilityBatch(
    { eventId: "red", trialCount: 2, predictedHits: 1 },
    sequenceRandom([5 / 37, 6 / 37]),
  );
  const zeroBatch = createProbabilityBatch(
    { eventId: "zero", trialCount: 2, predictedHits: 0 },
    sequenceRandom([0, 1 / 37]),
  );

  const summary = summarizeProbabilityBatches(
    [redBatch, zeroBatch, secondRedBatch],
    "red",
  );
  assert.equal(summary.batches, 2);
  assert.equal(summary.trialCount, 6);
  assert.equal(summary.hits, 3);
  assert.equal(summary.observedProbability, 0.5);
  assert.equal(summary.outcomes.length, 6);
});

test("streak feedback explicitly rejects the gambler's fallacy", () => {
  const outcomes = [1, 3, 5, 7].map((number) => ({
    number,
    color: getRouletteNumberColor(number),
  }));
  const insight = getProbabilityIndependenceInsight(outcomes);

  assert.match(insight, /Red appeared 4 times/);
  assert.match(insight, /still independent/);
  assert.match(insight, /does not make the opposite color “due/);
  assert.equal(
    getProbabilityIndependenceInsight(outcomes.slice(0, 3)),
    null,
  );
});
