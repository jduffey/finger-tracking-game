import { CIRCLE_OF_FIFTHS_SEGMENTS } from "./circleOfFifths.js";
import {
  DRUM_BEAT_PRESETS,
  clampDrumBpm,
} from "./circleOfFifthsDrums.js";

export const JAM_LOOP_STORAGE_KEY = "motionArcade.jamStudio.loop.v1";
export const JAM_LOOP_FORMAT = "motion-arcade-jam-loop";
export const JAM_LOOP_SCHEMA_VERSION = 1;
export const JAM_LOOP_MAX_DURATION_MS = 32000;
export const JAM_LOOP_MAX_EVENTS = 256;
export const JAM_LOOP_DRUM_INSTRUMENTS = ["kick", "snare", "hat"];

const JAM_LOOP_MIN_DURATION_MS = 250;
const JAM_LOOP_DEFAULT_NAME = "Untitled loop";
const JAM_LOOP_NAME_MAX_LENGTH = 48;
const JAM_LOOP_ID_MAX_LENGTH = 96;
const JAM_LOOP_DOCUMENT_MAX_LENGTH = 512000;
const SEGMENT_IDS = new Set(CIRCLE_OF_FIFTHS_SEGMENTS.map((segment) => segment.id));
const DRUM_INSTRUMENTS = new Set(JAM_LOOP_DRUM_INSTRUMENTS);
const BEAT_IDS = new Set(DRUM_BEAT_PRESETS.map((beat) => beat.id));

export function normalizeJamLoopEvent(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const atMs = clampInteger(value.atMs, 0, JAM_LOOP_MAX_DURATION_MS, 0);
  if (value.type === "chord-on" && SEGMENT_IDS.has(value.segmentId)) {
    return {
      type: "chord-on",
      atMs,
      segmentId: value.segmentId,
    };
  }

  if (value.type === "chord-off") {
    return {
      type: "chord-off",
      atMs,
    };
  }

  if (value.type === "drum-hit" && DRUM_INSTRUMENTS.has(value.instrument)) {
    return {
      type: "drum-hit",
      atMs,
      instrument: value.instrument,
    };
  }

  return null;
}

export function normalizeJamLoop(value, options = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const sourceEvents = Array.isArray(value.events) ? value.events : [];
  const events = sourceEvents
    .slice(0, JAM_LOOP_MAX_EVENTS)
    .map(normalizeJamLoopEvent)
    .filter(Boolean)
    .sort((left, right) => left.atMs - right.atMs);
  const finalEventAt = events.at(-1)?.atMs ?? 0;
  const inferredDuration = Math.max(JAM_LOOP_MIN_DURATION_MS, finalEventAt + 250);
  const durationMs = clampInteger(
    value.durationMs,
    JAM_LOOP_MIN_DURATION_MS,
    JAM_LOOP_MAX_DURATION_MS,
    inferredDuration,
  );
  const boundedEvents = events.filter((event) => event.atMs <= durationMs);
  const now = clampInteger(options.now, 0, Number.MAX_SAFE_INTEGER, Date.now());
  const createdAt = clampInteger(value.createdAt, 0, Number.MAX_SAFE_INTEGER, now);
  const updatedAt = clampInteger(value.updatedAt, createdAt, Number.MAX_SAFE_INTEGER, now);

  return {
    id: normalizeText(value.id, JAM_LOOP_ID_MAX_LENGTH) || createJamLoopId(now),
    name: normalizeText(value.name, JAM_LOOP_NAME_MAX_LENGTH) || JAM_LOOP_DEFAULT_NAME,
    durationMs,
    bpm: normalizeLoopBpm(value.bpm),
    beatId: BEAT_IDS.has(value.beatId) ? value.beatId : DRUM_BEAT_PRESETS[0]?.id ?? "motorik",
    events: boundedEvents,
    createdAt,
    updatedAt,
  };
}

export function createJamLoop(value = {}, options = {}) {
  return normalizeJamLoop(
    {
      ...value,
      id: value.id ?? createJamLoopId(options.now),
      createdAt: value.createdAt ?? options.now,
      updatedAt: value.updatedAt ?? options.now,
    },
    options,
  );
}

export function getJamLoopSummary(value) {
  const loop = normalizeJamLoop(value);
  const summary = {
    eventCount: 0,
    chordCount: 0,
    drumHitCount: 0,
    durationMs: 0,
    durationLabel: "0.0 sec",
  };

  if (!loop) {
    return summary;
  }

  summary.eventCount = loop.events.length;
  summary.chordCount = loop.events.filter((event) => event.type === "chord-on").length;
  summary.drumHitCount = loop.events.filter((event) => event.type === "drum-hit").length;
  summary.durationMs = loop.durationMs;
  summary.durationLabel = `${(loop.durationMs / 1000).toFixed(1)} sec`;
  return summary;
}

export function createJamLoopDocument(value) {
  const loop = normalizeJamLoop(value);
  if (!loop) {
    return null;
  }

  return {
    format: JAM_LOOP_FORMAT,
    schemaVersion: JAM_LOOP_SCHEMA_VERSION,
    loop,
  };
}

export function exportJamLoopJson(value) {
  const document = createJamLoopDocument(value);
  if (!document) {
    return null;
  }

  return {
    filename: `${toSafeFilename(document.loop.name)}.jam-loop.json`,
    json: `${JSON.stringify(document, null, 2)}\n`,
  };
}

export function loadSavedJamLoop(storage = resolveLocalStorage()) {
  if (!storage?.getItem) {
    return {
      ok: false,
      status: "unavailable",
      loop: null,
    };
  }

  try {
    const raw = storage.getItem(JAM_LOOP_STORAGE_KEY);
    if (!raw) {
      return {
        ok: true,
        status: "empty",
        loop: null,
      };
    }

    if (raw.length > JAM_LOOP_DOCUMENT_MAX_LENGTH) {
      return {
        ok: false,
        status: "invalid",
        loop: null,
      };
    }

    const parsed = JSON.parse(raw);
    if (
      parsed?.format !== JAM_LOOP_FORMAT ||
      parsed?.schemaVersion !== JAM_LOOP_SCHEMA_VERSION
    ) {
      return {
        ok: false,
        status: "invalid",
        loop: null,
      };
    }

    const loop = normalizeJamLoop(parsed.loop);
    if (!loop) {
      return {
        ok: false,
        status: "invalid",
        loop: null,
      };
    }

    return {
      ok: true,
      status: "loaded",
      loop,
    };
  } catch {
    return {
      ok: false,
      status: "error",
      loop: null,
    };
  }
}

export function saveJamLoop(value, storage = resolveLocalStorage(), options = {}) {
  if (!storage?.setItem) {
    return {
      ok: false,
      status: "unavailable",
      loop: null,
    };
  }

  const now = clampInteger(options.now, 0, Number.MAX_SAFE_INTEGER, Date.now());
  const loop = normalizeJamLoop(
    {
      ...value,
      updatedAt: now,
    },
    { now },
  );
  const document = createJamLoopDocument(loop);
  if (!loop || !document) {
    return {
      ok: false,
      status: "invalid",
      loop: null,
    };
  }

  try {
    storage.setItem(JAM_LOOP_STORAGE_KEY, JSON.stringify(document));
    return {
      ok: true,
      status: "saved",
      loop,
    };
  } catch {
    return {
      ok: false,
      status: "error",
      loop,
    };
  }
}

export function clearSavedJamLoop(storage = resolveLocalStorage()) {
  if (!storage?.removeItem) {
    return {
      ok: false,
      status: "unavailable",
    };
  }

  try {
    storage.removeItem(JAM_LOOP_STORAGE_KEY);
    return {
      ok: true,
      status: "cleared",
    };
  } catch {
    return {
      ok: false,
      status: "error",
    };
  }
}

function resolveLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function createJamLoopId(now = Date.now()) {
  try {
    const randomId = globalThis.crypto?.randomUUID?.();
    if (randomId) {
      return `jam-${randomId}`;
    }
  } catch {
    // A timestamp fallback keeps creation available in restricted browser contexts.
  }

  return `jam-${clampInteger(now, 0, Number.MAX_SAFE_INTEGER, Date.now())}`;
}

function normalizeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeLoopBpm(value) {
  const bpm = Number(value);
  return value !== null && value !== "" && Number.isFinite(bpm)
    ? clampDrumBpm(bpm)
    : 112;
}

function toSafeFilename(value) {
  const normalized = normalizeText(value, JAM_LOOP_NAME_MAX_LENGTH)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "untitled-loop";
}

function clampInteger(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.min(maximum, Math.max(minimum, Math.round(fallback)));
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}
