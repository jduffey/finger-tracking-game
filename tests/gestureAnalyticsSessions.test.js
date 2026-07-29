import assert from "node:assert/strict";
import test from "node:test";

import {
  GESTURE_ANALYTICS_LIBRARY_VERSION,
  GESTURE_ANALYTICS_LIMITS,
  GESTURE_ANALYTICS_STORAGE_KEY,
  createEmptyGestureAnalyticsLibrary,
  createGestureAnalyticsSession,
  mergeGestureAnalyticsLibraries,
  parseGestureAnalyticsLibraryJSON,
  readGestureAnalyticsLibrary,
  serializeGestureAnalyticsLibrary,
  writeGestureAnalyticsLibrary,
} from "../src/gestureAnalyticsSessions.js";

function frame(t, u = 0.5) {
  return {
    t,
    hands: [
      {
        label: "Left",
        pinchDistance: 0.04,
        fingerTips: {
          thumb: { u, v: 0.5 },
          index: { u: u + 0.01, v: 0.5 },
        },
        landmarks: Array.from({ length: 21 }, () => ({
          u,
          v: 0.5,
        })),
      },
    ],
  };
}

function storage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("captured sessions are bounded, rounded, and safe to persist", () => {
  const frames = Array.from(
    { length: GESTURE_ANALYTICS_LIMITS.maxFramesPerSession + 300 },
    (_value, index) => frame(index * 50, 0.1234567),
  );
  const created = createGestureAnalyticsSession({
    frames,
    id: "session-a",
    name: "  Smooth   sweep  ",
    now: Date.parse("2026-07-28T12:00:00.000Z"),
  });

  assert.equal(created.ok, true);
  assert.ok(
    created.session.frames.length <=
      GESTURE_ANALYTICS_LIMITS.maxFramesPerSession,
  );
  assert.equal(created.session.name, "Smooth sweep");
  assert.equal(
    created.session.frames[0].hands[0].landmarks[0].u,
    0.12346,
  );
});

test("versioned archives round-trip and reject malformed camera-derived data", () => {
  const session = createGestureAnalyticsSession({
    frames: [frame(0), frame(100)],
    id: "session-a",
  }).session;
  const library = {
    version: GESTURE_ANALYTICS_LIBRARY_VERSION,
    updatedAt: "2026-07-28T12:00:00.000Z",
    sessions: [session],
  };
  const serialized = serializeGestureAnalyticsLibrary(library);
  assert.equal(serialized.ok, true);
  assert.deepEqual(
    parseGestureAnalyticsLibraryJSON(serialized.json).library,
    serialized.library,
  );

  const unsafe = JSON.parse(serialized.json);
  unsafe.sessions[0].frames[0].hands[0].landmarks[0].u = 900;
  assert.equal(
    parseGestureAnalyticsLibraryJSON(JSON.stringify(unsafe)).ok,
    false,
  );
});

test("imports enforce byte, duration, session, and frame quotas", () => {
  assert.equal(
    parseGestureAnalyticsLibraryJSON(
      `"${"x".repeat(GESTURE_ANALYTICS_LIMITS.maxJsonBytes)}"`,
    ).reason,
    "payload_too_large",
  );

  const base = {
    version: GESTURE_ANALYTICS_LIBRARY_VERSION,
    updatedAt: "2026-07-28T12:00:00.000Z",
    sessions: [],
  };
  assert.equal(
    parseGestureAnalyticsLibraryJSON(
      JSON.stringify({
        ...base,
        sessions: Array.from(
          { length: GESTURE_ANALYTICS_LIMITS.maxSessions + 1 },
          () => ({}),
        ),
      }),
    ).ok,
    false,
  );

  const tooLong = createGestureAnalyticsSession({
    frames: [frame(0), frame(100)],
    id: "too-long",
  }).session;
  tooLong.frames[1].t =
    GESTURE_ANALYTICS_LIMITS.maxDurationMs + 1;
  assert.equal(
    parseGestureAnalyticsLibraryJSON(
      JSON.stringify({ ...base, sessions: [tooLong] }),
    ).ok,
    false,
  );
});

test("local reads and writes fail safely without rewriting invalid storage", () => {
  const target = storage();
  const empty = createEmptyGestureAnalyticsLibrary({
    now: Date.parse("2026-07-28T12:00:00.000Z"),
  });
  assert.equal(
    writeGestureAnalyticsLibrary(empty, target).status,
    "saved",
  );
  assert.equal(
    readGestureAnalyticsLibrary(target).status,
    "loaded",
  );

  target.values.set(GESTURE_ANALYTICS_STORAGE_KEY, "{broken");
  const invalid = readGestureAnalyticsLibrary(target);
  assert.equal(invalid.status, "invalid");
  assert.equal(
    target.values.get(GESTURE_ANALYTICS_STORAGE_KEY),
    "{broken",
  );
  assert.equal(
    writeGestureAnalyticsLibrary(empty, null).reason,
    "storage_unavailable",
  );
});

test("merging preserves sessions and safely resolves colliding IDs", () => {
  const session = createGestureAnalyticsSession({
    frames: [frame(0), frame(100)],
    id: "same-id",
  }).session;
  const current = {
    version: GESTURE_ANALYTICS_LIBRARY_VERSION,
    updatedAt: session.createdAt,
    sessions: [session],
  };
  const merged = mergeGestureAnalyticsLibraries(current, current);
  assert.equal(merged.ok, true);
  assert.equal(merged.library.sessions.length, 2);
  assert.notEqual(
    merged.library.sessions[0].id,
    merged.library.sessions[1].id,
  );
});
