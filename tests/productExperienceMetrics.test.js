import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_EXPERIENCE_METRICS_LIMITS,
  PRODUCT_EXPERIENCE_METRICS_PRIVACY,
  PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION,
  PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY,
  PRODUCT_METRIC_EVENT_TYPES,
  PRODUCT_METRIC_INPUT_METHODS,
  PRODUCT_METRIC_TUTORIAL_OUTCOMES,
  PRODUCT_METRICS_STORAGE_STATUS,
  createEmptyProductExperienceMetrics,
  createProductExperienceMetricsStore,
  parseProductExperienceMetricsJSON,
  readProductExperienceMetrics,
  recordProductExperienceMetric,
  serializeProductExperienceMetrics,
  summarizeProductExperienceMetrics,
} from "../src/productExperienceMetrics.js";

function createStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) {
    values.set(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY, initialValue);
  }
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("the empty schema explicitly documents its local aggregate privacy boundary", () => {
  const metrics = createEmptyProductExperienceMetrics();

  assert.equal(metrics.version, PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION);
  assert.deepEqual(metrics.privacy, PRODUCT_EXPERIENCE_METRICS_PRIVACY);
  assert.deepEqual(metrics.modes, {});
  assert.deepEqual(metrics.totals.experiences, {
    started: 0,
    completed: 0,
    abandoned: 0,
    retries: 0,
  });
  assert.equal(metrics.totals.firstSuccess.minimumDurationMs, null);
  assert.equal(metrics.totals.trackingLoss.incidents, 0);
});

test("one in-memory hook session aggregates every product success and friction signal", () => {
  const target = createStorage();
  let nowMs = 1_000;
  const store = createProductExperienceMetricsStore({
    storage: target,
    now: () => nowMs,
  });
  const session = store.beginExperience({
    modeId: "sky-patrol",
    tutorial: true,
  });

  assert.equal(
    session.recordSelection({
      succeeded: false,
      inputMethod: PRODUCT_METRIC_INPUT_METHODS.GESTURE,
    }),
    true,
  );
  assert.equal(
    session.recordSelection({
      succeeded: true,
      inputMethod: PRODUCT_METRIC_INPUT_METHODS.POINTER,
    }),
    true,
  );

  nowMs = 2_500;
  assert.equal(session.recordFirstSuccess(), true);
  assert.equal(session.recordFirstSuccess(), false);

  nowMs = 3_000;
  assert.equal(session.beginTrackingLoss(), true);
  assert.equal(session.beginTrackingLoss(), false);
  nowMs = 3_700;
  assert.equal(session.endTrackingLoss(), true);

  assert.equal(session.recordRetry(), true);
  assert.equal(
    session.finishTutorial(PRODUCT_METRIC_TUTORIAL_OUTCOMES.COMPLETED),
    true,
  );
  assert.equal(session.complete(), true);
  assert.equal(session.complete(), false);
  assert.equal(session.recordRetry(), false);
  assert.equal(session.isClosed(), true);

  const metrics = store.getSnapshot();
  assert.deepEqual(metrics.totals.experiences, {
    started: 1,
    completed: 1,
    abandoned: 0,
    retries: 1,
  });
  assert.equal(metrics.totals.selections.attempts, 2);
  assert.equal(metrics.totals.selections.failures, 1);
  assert.deepEqual(metrics.totals.selections.byInput.gesture, {
    attempts: 1,
    failures: 1,
  });
  assert.equal(metrics.totals.firstSuccess.observations, 1);
  assert.equal(metrics.totals.firstSuccess.totalDurationMs, 1_500);
  assert.equal(metrics.totals.firstSuccess.buckets.under5s, 1);
  assert.equal(metrics.totals.trackingLoss.incidents, 1);
  assert.equal(metrics.totals.trackingLoss.totalDurationMs, 700);
  assert.equal(metrics.totals.trackingLoss.buckets.under1s, 1);
  assert.deepEqual(metrics.totals.tutorials, {
    started: 1,
    completed: 1,
    skipped: 0,
    abandoned: 0,
  });

  assert.deepEqual(
    summarizeProductExperienceMetrics(metrics, "sky-patrol"),
    {
      experiences: {
        started: 1,
        completed: 1,
        abandoned: 0,
        retries: 1,
        completionRate: 1,
        abandonmentRate: 0,
      },
      selections: {
        attempts: 2,
        failures: 1,
        byInput: metrics.modes["sky-patrol"].metrics.selections.byInput,
        failureRate: 0.5,
      },
      firstSuccess: {
        ...metrics.modes["sky-patrol"].metrics.firstSuccess,
        averageDurationMs: 1_500,
      },
      trackingLoss: {
        ...metrics.modes["sky-patrol"].metrics.trackingLoss,
        averageDurationMs: 700,
      },
      tutorials: {
        started: 1,
        completed: 1,
        skipped: 0,
        abandoned: 0,
        completionRate: 1,
      },
    },
  );
  assert.equal(summarizeProductExperienceMetrics(metrics, "Not A Mode"), null);
  assert.equal(store.getPersistenceStatus(), PRODUCT_METRICS_STORAGE_STATUS.SAVED);
  assert.ok(target.values.has(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY));
});

test("exports cannot retain raw events, timestamps, camera data, or caller metadata", () => {
  let metrics = createEmptyProductExperienceMetrics();
  metrics = recordProductExperienceMetric(metrics, {
    type: PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_STARTED,
    modeId: "slice-air",
    sessionId: "private-session-id",
    timestamp: "2026-07-28T12:00:00.000Z",
    landmarks: [{ x: 0.123, y: 0.456 }],
    cameraLabel: "User-facing camera",
  }).metrics;
  metrics = recordProductExperienceMetric(metrics, {
    type: PRODUCT_METRIC_EVENT_TYPES.SELECTION_ATTEMPT,
    modeId: "slice-air",
    succeeded: false,
    inputMethod: "unbounded-custom-input-name",
    freeformNote: "a secret note",
  }).metrics;

  const exported = serializeProductExperienceMetrics(metrics);
  assert.equal(exported.ok, true);
  assert.ok(
    new TextEncoder().encode(exported.json).byteLength <=
      PRODUCT_EXPERIENCE_METRICS_LIMITS.maxJsonBytes,
  );
  for (const forbiddenText of [
    "private-session-id",
    "2026-07-28",
    "landmarks",
    "cameraLabel",
    "User-facing camera",
    "a secret note",
    "unbounded-custom-input-name",
  ]) {
    assert.equal(exported.json.includes(forbiddenText), false);
  }
  assert.deepEqual(exported.metrics.totals.selections.byInput.other, {
    attempts: 1,
    failures: 1,
  });
  assert.equal(exported.metrics.privacy.containsRawEvents, false);
  assert.equal(exported.metrics.privacy.containsTimestamps, false);
});

test("unfinished tracking and tutorials close as bounded abandon aggregates", () => {
  let nowMs = 100;
  const store = createProductExperienceMetricsStore({
    storage: null,
    now: () => nowMs,
  });
  const session = store.beginExperience({
    modeId: "hand-bounce",
    tutorial: true,
  });

  nowMs = 250;
  session.beginTrackingLoss();
  nowMs = 500;
  assert.equal(session.abandon(), true);
  assert.equal(session.abandon(), false);
  assert.equal(session.endTrackingLoss(), false);

  const mode = store.getSnapshot().modes["hand-bounce"].metrics;
  assert.deepEqual(mode.experiences, {
    started: 1,
    completed: 0,
    abandoned: 1,
    retries: 0,
  });
  assert.equal(mode.trackingLoss.incidents, 1);
  assert.equal(mode.trackingLoss.totalDurationMs, 250);
  assert.equal(mode.tutorials.abandoned, 1);
  assert.equal(
    store.getPersistenceStatus(),
    PRODUCT_METRICS_STORAGE_STATUS.UNAVAILABLE,
  );
});

test("duration observations and per-mode history remain deterministically bounded", () => {
  let nowMs = 0;
  const store = createProductExperienceMetricsStore({
    storage: null,
    now: () => nowMs,
  });

  const longSession = store.beginExperience({ modeId: "mode-long" });
  longSession.beginTrackingLoss();
  nowMs = PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs * 3;
  longSession.endTrackingLoss();
  longSession.recordFirstSuccess();
  longSession.complete();

  for (
    let index = 0;
    index < PRODUCT_EXPERIENCE_METRICS_LIMITS.maxModes;
    index += 1
  ) {
    const session = store.beginExperience({
      modeId: `mode-${String(index).padStart(2, "0")}`,
    });
    session.abandon();
  }

  const metrics = store.getSnapshot();
  assert.equal(
    Object.keys(metrics.modes).length,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxModes,
  );
  assert.equal(Object.hasOwn(metrics.modes, "mode-long"), false);
  assert.equal(Object.hasOwn(metrics.modes, "mode-00"), true);
  assert.equal(
    metrics.totals.firstSuccess.maximumDurationMs,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs,
  );
  assert.equal(
    metrics.totals.trackingLoss.maximumDurationMs,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxObservationDurationMs,
  );
  assert.equal(
    metrics.totals.experiences.started,
    PRODUCT_EXPERIENCE_METRICS_LIMITS.maxModes + 1,
  );
  assert.equal(serializeProductExperienceMetrics(metrics).ok, true);
});

test("future-version storage is preserved until an explicit local reset", () => {
  const futureJson = JSON.stringify({
    version: PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION + 1,
    futureField: true,
  });
  const target = createStorage(futureJson);
  const initial = readProductExperienceMetrics(target);
  assert.equal(initial.status, PRODUCT_METRICS_STORAGE_STATUS.UNSUPPORTED);

  const store = createProductExperienceMetricsStore({
    storage: target,
    now: () => 100,
  });
  const session = store.beginExperience({ modeId: "breakout" });
  session.complete();
  assert.equal(
    store.getPersistenceStatus(),
    PRODUCT_METRICS_STORAGE_STATUS.WRITE_BLOCKED,
  );
  assert.equal(
    target.values.get(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY),
    futureJson,
  );

  const reset = store.reset();
  assert.equal(reset.status, PRODUCT_METRICS_STORAGE_STATUS.CLEARED);
  assert.equal(target.values.has(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY), false);

  store.beginExperience({ modeId: "breakout" }).abandon();
  assert.equal(
    store.getPersistenceStatus(),
    PRODUCT_METRICS_STORAGE_STATUS.SAVED,
  );
});

test("a failed reset cannot silently overwrite a future-version payload", () => {
  const futureJson = JSON.stringify({
    version: PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION + 1,
    futureField: true,
  });
  const values = new Map([
    [PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY, futureJson],
  ]);
  const target = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const store = createProductExperienceMetricsStore({
    storage: target,
    now: () => 100,
  });

  assert.equal(store.reset().status, PRODUCT_METRICS_STORAGE_STATUS.FAILED);
  store.beginExperience({ modeId: "breakout" }).abandon();
  assert.equal(
    store.getPersistenceStatus(),
    PRODUCT_METRICS_STORAGE_STATUS.WRITE_BLOCKED,
  );
  assert.equal(
    values.get(PRODUCT_EXPERIENCE_METRICS_STORAGE_KEY),
    futureJson,
  );
});

test("parsing rejects malformed and oversized archives without throwing", () => {
  assert.equal(parseProductExperienceMetricsJSON("{").reason, "invalid-json");
  assert.equal(
    parseProductExperienceMetricsJSON(
      `"${"x".repeat(PRODUCT_EXPERIENCE_METRICS_LIMITS.maxJsonBytes)}"`,
    ).reason,
    "payload-too-large",
  );

  const malformed = createEmptyProductExperienceMetrics();
  malformed.totals.selections.failures = 1;
  assert.equal(
    parseProductExperienceMetricsJSON(JSON.stringify(malformed)).reason,
    "invalid-metrics",
  );

  const invalidTransition = recordProductExperienceMetric(
    createEmptyProductExperienceMetrics(),
    {
      type: PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_COMPLETED,
      modeId: "breakout",
    },
  );
  assert.equal(invalidTransition.accepted, false);
  assert.equal(invalidTransition.reason, "invalid-transition");
});

test("storage failures never discard the safe in-memory aggregate", () => {
  const target = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const store = createProductExperienceMetricsStore({
    storage: target,
    now: () => 100,
  });
  store.beginExperience({ modeId: "finger-pong" }).complete();

  assert.equal(store.getSnapshot().totals.experiences.completed, 1);
  assert.equal(
    store.getPersistenceStatus(),
    PRODUCT_METRICS_STORAGE_STATUS.FAILED,
  );
  assert.equal(store.reset().status, PRODUCT_METRICS_STORAGE_STATUS.FAILED);
  assert.equal(store.getSnapshot().totals.experiences.started, 0);
});
