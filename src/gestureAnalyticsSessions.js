export const GESTURE_ANALYTICS_STORAGE_KEY =
  "motion_arcade_gesture_analytics_v1";
export const GESTURE_ANALYTICS_LIBRARY_VERSION = 1;

export const GESTURE_ANALYTICS_LIMITS = Object.freeze({
  maxJsonBytes: 2 * 1024 * 1024,
  maxSessions: 6,
  maxFramesPerSession: 1_200,
  maxHandsPerFrame: 4,
  maxLandmarksPerHand: 21,
  maxDurationMs: 120_000,
});

const POINT_MIN = -0.25;
const POINT_MAX = 1.25;
const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const TIP_NAMES = Object.freeze([
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
]);

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function safeStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback;
  }
  const text = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return text || fallback;
}

function normalizeIsoDate(value, fallback) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function sanitizePoint(value) {
  if (value === null) {
    return null;
  }
  if (
    !Number.isFinite(value?.u) ||
    !Number.isFinite(value?.v) ||
    value.u < POINT_MIN ||
    value.u > POINT_MAX ||
    value.v < POINT_MIN ||
    value.v > POINT_MAX
  ) {
    return null;
  }
  return {
    u: Number(value.u.toFixed(5)),
    v: Number(value.v.toFixed(5)),
  };
}

function sanitizeFingerTips(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(
    TIP_NAMES.map((name) => [name, sanitizePoint(value[name])]),
  );
}

function sanitizeHand(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const rawLandmarks = Array.isArray(value.landmarks)
    ? value.landmarks
    : [];
  if (
    rawLandmarks.length === 0 ||
    rawLandmarks.length >
      GESTURE_ANALYTICS_LIMITS.maxLandmarksPerHand
  ) {
    return null;
  }
  const pinchDistance =
    value.pinchDistance === null || value.pinchDistance === undefined
      ? null
      : Number.isFinite(value.pinchDistance) &&
          value.pinchDistance >= 0 &&
          value.pinchDistance <= 2
        ? Number(value.pinchDistance.toFixed(5))
        : null;
  const landmarks = rawLandmarks.map(sanitizePoint);
  if (
    rawLandmarks.some(
      (point, pointIndex) =>
        point !== null && landmarks[pointIndex] === null,
    )
  ) {
    return null;
  }
  const fingerTips = sanitizeFingerTips(value.fingerTips);
  if (
    value.fingerTips &&
    TIP_NAMES.some(
      (name) =>
        value.fingerTips[name] !== null &&
        value.fingerTips[name] !== undefined &&
        fingerTips?.[name] === null,
    )
  ) {
    return null;
  }
  return {
    label: cleanText(value.label, `Hand ${index + 1}`, 32),
    pinchDistance,
    fingerTips,
    landmarks,
  };
}

function sanitizeFrames(value) {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > GESTURE_ANALYTICS_LIMITS.maxFramesPerSession
  ) {
    return null;
  }
  const frames = [];
  let previousTimestamp = -Infinity;
  for (const rawFrame of value) {
    if (
      !Number.isFinite(rawFrame?.t) ||
      rawFrame.t < previousTimestamp ||
      !Array.isArray(rawFrame.hands) ||
      rawFrame.hands.length >
        GESTURE_ANALYTICS_LIMITS.maxHandsPerFrame
    ) {
      return null;
    }
    const hands = rawFrame.hands.map(sanitizeHand);
    if (hands.some((hand) => !hand)) {
      return null;
    }
    const timestamp = Number(rawFrame.t.toFixed(3));
    frames.push({ t: timestamp, hands });
    previousTimestamp = timestamp;
  }
  if (
    frames.at(-1).t - frames[0].t >
    GESTURE_ANALYTICS_LIMITS.maxDurationMs
  ) {
    return null;
  }
  return frames;
}

function sanitizeSession(value, index, now) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const frames = sanitizeFrames(value.frames);
  if (!frames) {
    return null;
  }
  const fallbackId = `session-${now}-${index + 1}`;
  const id =
    typeof value.id === "string" && SAFE_ID.test(value.id)
      ? value.id
      : fallbackId;
  return {
    id,
    name: cleanText(value.name, `Session ${index + 1}`, 64),
    createdAt: normalizeIsoDate(
      value.createdAt,
      new Date(now).toISOString(),
    ),
    frames,
  };
}

function normalizeLibrary(value, { now = Date.now() } = {}) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== GESTURE_ANALYTICS_LIBRARY_VERSION ||
    !Array.isArray(value.sessions) ||
    value.sessions.length > GESTURE_ANALYTICS_LIMITS.maxSessions
  ) {
    return null;
  }
  const sessions = value.sessions.map((session, index) =>
    sanitizeSession(session, index, now),
  );
  if (
    sessions.some((session) => !session) ||
    new Set(sessions.map(({ id }) => id)).size !== sessions.length
  ) {
    return null;
  }
  return {
    version: GESTURE_ANALYTICS_LIBRARY_VERSION,
    updatedAt: normalizeIsoDate(
      value.updatedAt,
      new Date(now).toISOString(),
    ),
    sessions,
  };
}

export function createEmptyGestureAnalyticsLibrary({
  now = Date.now(),
} = {}) {
  return {
    version: GESTURE_ANALYTICS_LIBRARY_VERSION,
    updatedAt: new Date(now).toISOString(),
    sessions: [],
  };
}

export function createGestureAnalyticsSession({
  frames,
  id = `session-${Date.now()}`,
  name = "Captured session",
  now = Date.now(),
} = {}) {
  const source = Array.isArray(frames) ? frames : [];
  const stride = Math.max(
    1,
    Math.ceil(
      source.length / GESTURE_ANALYTICS_LIMITS.maxFramesPerSession,
    ),
  );
  const sampled = source.filter(
    (_frame, index) =>
      index % stride === 0 || index === source.length - 1,
  );
  if (
    sampled.length >
    GESTURE_ANALYTICS_LIMITS.maxFramesPerSession
  ) {
    sampled.splice(
      GESTURE_ANALYTICS_LIMITS.maxFramesPerSession - 1,
      sampled.length -
        GESTURE_ANALYTICS_LIMITS.maxFramesPerSession,
    );
  }
  const session = sanitizeSession(
    {
      id,
      name,
      createdAt: new Date(now).toISOString(),
      frames: sampled,
    },
    0,
    now,
  );
  return session
    ? { ok: true, session }
    : {
        ok: false,
        reason: "invalid_session",
        message: "Capture at least two valid tracking frames.",
      };
}

export function serializeGestureAnalyticsLibrary(library, options) {
  const normalized = normalizeLibrary(library, options);
  if (!normalized) {
    return {
      ok: false,
      reason: "invalid_library",
      message: "The session library is not valid.",
    };
  }
  const json = JSON.stringify(normalized, null, 2);
  if (byteLength(json) > GESTURE_ANALYTICS_LIMITS.maxJsonBytes) {
    return {
      ok: false,
      reason: "payload_too_large",
      message:
        "The session archive is too large. Delete an older capture and try again.",
    };
  }
  return { ok: true, library: normalized, json };
}

export function parseGestureAnalyticsLibraryJSON(
  json,
  { now = Date.now() } = {},
) {
  if (
    typeof json !== "string" ||
    byteLength(json) > GESTURE_ANALYTICS_LIMITS.maxJsonBytes
  ) {
    return {
      ok: false,
      reason: "payload_too_large",
      message: "The selected archive exceeds the local import limit.",
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      reason: "invalid_json",
      message: "The selected file is not a valid session archive.",
    };
  }
  const library = normalizeLibrary(parsed, { now });
  return library
    ? { ok: true, library }
    : {
        ok: false,
        reason: "invalid_library",
        message:
          "The archive version, frames, or coordinate data is not valid.",
      };
}

export function mergeGestureAnalyticsLibraries(
  current,
  incoming,
  { now = Date.now() } = {},
) {
  const left = normalizeLibrary(current, { now });
  const right = normalizeLibrary(incoming, { now });
  if (!left || !right) {
    return {
      ok: false,
      reason: "invalid_library",
      message: "The session libraries could not be merged.",
    };
  }
  const usedIds = new Set(left.sessions.map(({ id }) => id));
  const imported = [];
  for (const session of right.sessions) {
    let id = session.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${session.id.slice(0, 56)}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    imported.push({ ...session, id });
  }
  const sessions = [...imported, ...left.sessions].slice(
    0,
    GESTURE_ANALYTICS_LIMITS.maxSessions,
  );
  return {
    ok: true,
    importedCount: Math.min(
      imported.length,
      GESTURE_ANALYTICS_LIMITS.maxSessions,
    ),
    library: {
      version: GESTURE_ANALYTICS_LIBRARY_VERSION,
      updatedAt: new Date(now).toISOString(),
      sessions,
    },
  };
}

export function readGestureAnalyticsLibrary(storage, options) {
  const target = safeStorage(storage);
  if (!target?.getItem) {
    return {
      ok: false,
      status: "unavailable",
      library: createEmptyGestureAnalyticsLibrary(options),
    };
  }
  let json;
  try {
    json = target.getItem(GESTURE_ANALYTICS_STORAGE_KEY);
  } catch {
    return {
      ok: false,
      status: "unavailable",
      library: createEmptyGestureAnalyticsLibrary(options),
    };
  }
  if (!json) {
    return {
      ok: true,
      status: "empty",
      library: createEmptyGestureAnalyticsLibrary(options),
    };
  }
  const parsed = parseGestureAnalyticsLibraryJSON(json, options);
  return parsed.ok
    ? { ...parsed, status: "loaded" }
    : {
        ...parsed,
        status: "invalid",
        library: createEmptyGestureAnalyticsLibrary(options),
      };
}

export function writeGestureAnalyticsLibrary(
  library,
  storage,
  options,
) {
  const target = safeStorage(storage);
  const serialized = serializeGestureAnalyticsLibrary(library, options);
  if (!serialized.ok) {
    return serialized;
  }
  if (!target?.setItem) {
    return {
      ...serialized,
      ok: false,
      reason: "storage_unavailable",
      message: "Browser storage is unavailable.",
    };
  }
  try {
    target.setItem(GESTURE_ANALYTICS_STORAGE_KEY, serialized.json);
    return { ...serialized, status: "saved" };
  } catch {
    return {
      ...serialized,
      ok: false,
      reason: "storage_unavailable",
      message: "The session library could not be saved in this browser.",
    };
  }
}
