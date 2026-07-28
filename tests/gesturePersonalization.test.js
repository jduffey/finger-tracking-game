import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_GESTURE_IDS,
  GESTURE_IDS,
  PERSONALIZATION_STORAGE_KEY,
  PERSONALIZATION_VERSION,
} from "../src/gestures/constants.js";
import {
  PERSONALIZATION_LIMITS,
  createGesturePersonalization,
} from "../src/gestures/personalization.js";

function createStorage(initialValue = null) {
  const entries = new Map();
  if (initialValue !== null) {
    entries.set(PERSONALIZATION_STORAGE_KEY, initialValue);
  }
  return {
    entries,
    writes: 0,
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      this.writes += 1;
      entries.set(key, value);
    },
  };
}

function createPayload(samples = {}) {
  return {
    version: PERSONALIZATION_VERSION,
    savedAt: "2026-07-28T12:00:00.000Z",
    samples,
  };
}

function createVector(length = 168, value = 0.25) {
  return Array.from({ length }, () => value);
}

function assertSafeFailure(result, expectedReason) {
  assert.equal(result.ok, false);
  assert.equal(result.reason, expectedReason);
  assert.equal(typeof result.message, "string");
  assert.ok(result.message.length > 0);
}

test("valid personalization samples still persist, export, and reload", () => {
  const storage = createStorage();
  const personalization = createGesturePersonalization({ storage });
  const vector = createVector();

  assert.equal(personalization.addSample(GESTURE_IDS.OPEN_PALM, vector), true);
  vector[0] = 999;

  const storedPayload = JSON.parse(
    storage.entries.get(PERSONALIZATION_STORAGE_KEY),
  );
  assert.equal(storedPayload.version, PERSONALIZATION_VERSION);
  assert.equal(storedPayload.samples[GESTURE_IDS.OPEN_PALM].length, 1);
  assert.equal(storedPayload.samples[GESTURE_IDS.OPEN_PALM][0][0], 0.25);

  const restored = createGesturePersonalization({ storage });
  assert.equal(restored.getSampleCount(GESTURE_IDS.OPEN_PALM), 1);
  const exportedJson = restored.exportJSON();
  assert.ok(
    Buffer.byteLength(exportedJson, "utf8") <=
      PERSONALIZATION_LIMITS.maxJsonBytes,
  );
  assert.deepEqual(JSON.parse(exportedJson).samples, storedPayload.samples);
  assert.equal(
    createGesturePersonalization({ storage: null }).importFromJSON(exportedJson)
      .ok,
    true,
  );

  const exported = restored.exportPayload();
  exported.samples[GESTURE_IDS.OPEN_PALM][0][0] = 123;
  assert.equal(
    restored.exportPayload().samples[GESTURE_IDS.OPEN_PALM][0][0],
    0.25,
  );
});

test("the product data deletion alias clears in-memory and persisted samples", () => {
  const storage = createStorage();
  const personalization = createGesturePersonalization({ storage });
  assert.equal(personalization.addSample(GESTURE_IDS.CIRCLE, [0.2]), true);

  personalization.clearSamples();

  assert.equal(personalization.getSampleCount(GESTURE_IDS.CIRCLE), 0);
  assert.equal(
    JSON.parse(storage.entries.get(PERSONALIZATION_STORAGE_KEY)).samples[
      GESTURE_IDS.CIRCLE
    ].length,
    0,
  );
});

test("imports reject JSON payloads over the UTF-8 byte quota before parsing", () => {
  const personalization = createGesturePersonalization({ storage: null });
  const emojiCount = Math.floor(PERSONALIZATION_LIMITS.maxJsonBytes / 4) + 1;
  const oversizedUtf8Json = `"${"😀".repeat(emojiCount)}"`;

  assert.ok(oversizedUtf8Json.length < PERSONALIZATION_LIMITS.maxJsonBytes);
  assertSafeFailure(
    personalization.importFromJSON(oversizedUtf8Json),
    "payload_too_large",
  );
});

test("imports enforce the per-gesture sample quota atomically", () => {
  const storage = createStorage();
  const personalization = createGesturePersonalization({ storage });
  assert.equal(personalization.addSample(GESTURE_IDS.OPEN_PALM, [0.5]), true);
  const writesBeforeImport = storage.writes;

  const result = personalization.importFromObject(
    createPayload({
      [GESTURE_IDS.OPEN_PALM]: Array.from(
        { length: PERSONALIZATION_LIMITS.maxSamplesPerGesture + 1 },
        () => [0.1],
      ),
    }),
  );

  assertSafeFailure(result, "too_many_gesture_samples");
  assert.equal(personalization.getSampleCount(GESTURE_IDS.OPEN_PALM), 1);
  assert.equal(storage.writes, writesBeforeImport);
});

test("imports enforce the total sample quota even when each gesture is within bounds", () => {
  const samples = {};
  let remaining = PERSONALIZATION_LIMITS.maxTotalSamples + 1;
  for (const gestureId of ALL_GESTURE_IDS) {
    const count = Math.min(
      remaining,
      PERSONALIZATION_LIMITS.maxSamplesPerGesture,
    );
    samples[gestureId] = Array.from({ length: count }, () => [0.1]);
    remaining -= count;
    if (remaining === 0) {
      break;
    }
  }
  assert.equal(remaining, 0);

  const personalization = createGesturePersonalization({ storage: null });
  assertSafeFailure(
    personalization.importFromObject(createPayload(samples)),
    "too_many_samples",
  );
  assert.equal(
    Object.values(personalization.getSampleCounts()).reduce(
      (total, count) => total + count,
      0,
    ),
    0,
  );
});

test("documented sample, vector, and numeric boundaries remain valid", () => {
  const samples = {};
  let remaining = PERSONALIZATION_LIMITS.maxTotalSamples;
  for (const gestureId of ALL_GESTURE_IDS) {
    const count = Math.min(
      remaining,
      PERSONALIZATION_LIMITS.maxSamplesPerGesture,
    );
    samples[gestureId] = Array.from({ length: count }, (_, sampleIndex) =>
      sampleIndex === 0
        ? createVector(
            PERSONALIZATION_LIMITS.maxVectorLength,
            PERSONALIZATION_LIMITS.maxAbsoluteVectorValue,
          )
        : [0],
    );
    remaining -= count;
    if (remaining === 0) {
      break;
    }
  }

  const personalization = createGesturePersonalization({ storage: null });
  const result = personalization.importFromObject(createPayload(samples));

  assert.equal(result.ok, true);
  assert.equal(
    Object.values(result.counts).reduce((total, count) => total + count, 0),
    PERSONALIZATION_LIMITS.maxTotalSamples,
  );
  assert.equal(
    personalization.addSample(ALL_GESTURE_IDS.at(-1), [0]),
    false,
  );
});

test("imports reject empty and overlong feature vectors", () => {
  const personalization = createGesturePersonalization({ storage: null });
  const invalidVectors = [
    [],
    createVector(PERSONALIZATION_LIMITS.maxVectorLength + 1),
  ];

  for (const vector of invalidVectors) {
    assertSafeFailure(
      personalization.importFromObject(
        createPayload({ [GESTURE_IDS.CIRCLE]: [vector] }),
      ),
      "invalid_vector_length",
    );
  }
});

test("imports reject non-finite and out-of-range numeric values", () => {
  const personalization = createGesturePersonalization({ storage: null });
  const invalidVectors = [
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [PERSONALIZATION_LIMITS.maxAbsoluteVectorValue + Number.EPSILON * 4096],
    [-PERSONALIZATION_LIMITS.maxAbsoluteVectorValue - 1],
  ];

  for (const vector of invalidVectors) {
    assertSafeFailure(
      personalization.importFromObject(
        createPayload({ [GESTURE_IDS.SWIPE_LEFT]: [vector] }),
      ),
      "invalid_vector_value",
    );
  }
});

test("adding samples respects vector and per-gesture quotas without partial writes", () => {
  const storage = createStorage();
  const personalization = createGesturePersonalization({ storage });
  const fullGesturePayload = createPayload({
    [GESTURE_IDS.PUSH_FORWARD]: Array.from(
      { length: PERSONALIZATION_LIMITS.maxSamplesPerGesture },
      () => [0.2],
    ),
  });
  assert.equal(personalization.importFromObject(fullGesturePayload).ok, true);
  const writesBeforeRejectedAdds = storage.writes;

  assert.equal(
    personalization.addSample(GESTURE_IDS.PUSH_FORWARD, [0.3]),
    false,
  );
  assert.equal(
    personalization.addSample(GESTURE_IDS.CIRCLE, [
      PERSONALIZATION_LIMITS.maxAbsoluteVectorValue + 1,
    ]),
    false,
  );
  assert.equal(
    personalization.getSampleCount(GESTURE_IDS.PUSH_FORWARD),
    PERSONALIZATION_LIMITS.maxSamplesPerGesture,
  );
  assert.equal(storage.writes, writesBeforeRejectedAdds);
});

test("merge imports enforce quotas and leave existing samples unchanged on failure", () => {
  const personalization = createGesturePersonalization({ storage: null });
  assert.equal(
    personalization.importFromObject(
      createPayload({
        [GESTURE_IDS.ROTATE_TWIST]: Array.from(
          { length: PERSONALIZATION_LIMITS.maxSamplesPerGesture },
          () => [0.2],
        ),
      }),
    ).ok,
    true,
  );

  const result = personalization.importFromObject(
    createPayload({ [GESTURE_IDS.ROTATE_TWIST]: [[0.4]] }),
    false,
  );

  assertSafeFailure(result, "too_many_gesture_samples");
  assert.equal(
    personalization.getSampleCount(GESTURE_IDS.ROTATE_TWIST),
    PERSONALIZATION_LIMITS.maxSamplesPerGesture,
  );
});

test("invalid persisted payloads are ignored without throwing or rewriting storage", () => {
  const invalidPayload = JSON.stringify(
    createPayload({
      [GESTURE_IDS.EXPAND]: [
        [PERSONALIZATION_LIMITS.maxAbsoluteVectorValue + 1],
      ],
    }),
  );
  const storage = createStorage(invalidPayload);

  const personalization = createGesturePersonalization({ storage });

  assert.equal(personalization.getSampleCount(GESTURE_IDS.EXPAND), 0);
  assert.equal(storage.writes, 0);
  assert.equal(
    storage.entries.get(PERSONALIZATION_STORAGE_KEY),
    invalidPayload,
  );
});

test("object imports reject cyclic payloads with a safe result instead of throwing", () => {
  const personalization = createGesturePersonalization({ storage: null });
  const payload = createPayload();
  payload.loop = payload;

  assert.doesNotThrow(() => personalization.importFromObject(payload));
  assertSafeFailure(
    personalization.importFromObject(payload),
    "invalid_payload",
  );
});
