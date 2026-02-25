import { createScopedLogger } from "../logger";
import {
  ALL_GESTURE_IDS,
  PERSONALIZATION_STORAGE_KEY,
  PERSONALIZATION_VERSION,
} from "./constants";

function createEmptySamples() {
  return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
    accumulator[gestureId] = [];
    return accumulator;
  }, {});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isNumericArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => Number.isFinite(item));
}

function sanitizeSamples(rawSamples) {
  const samples = createEmptySamples();
  if (!rawSamples || typeof rawSamples !== "object") {
    return samples;
  }

  for (const gestureId of ALL_GESTURE_IDS) {
    const input = rawSamples[gestureId];
    if (!Array.isArray(input)) {
      continue;
    }
    samples[gestureId] = input.filter(isNumericArray).map((vector) => vector.map((value) => Number(value)));
  }

  return samples;
}

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

function serializeState(state) {
  return {
    version: PERSONALIZATION_VERSION,
    savedAt: new Date().toISOString(),
    samples: state.samples,
  };
}

function parseImportPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  if (raw.version !== PERSONALIZATION_VERSION) {
    return null;
  }

  return {
    version: raw.version,
    savedAt: raw.savedAt,
    samples: sanitizeSamples(raw.samples),
  };
}

export function createGesturePersonalization(options = {}) {
  const storageKey = options.storageKey ?? PERSONALIZATION_STORAGE_KEY;
  const logger = options.logger ?? createScopedLogger("gesturePersonalization");

  const state = {
    samples: createEmptySamples(),
  };

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(serializeState(state)));
    } catch (error) {
      logger.warn("Failed to persist personalization samples", { error });
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = parseImportPayload(JSON.parse(raw));
      if (!parsed) {
        logger.warn("Ignoring personalization payload due to invalid schema/version");
        return;
      }
      state.samples = parsed.samples;
      logger.info("Loaded personalization samples", {
        counts: getSampleCounts(),
      });
    } catch (error) {
      logger.warn("Failed to load personalization samples", { error });
    }
  }

  function getSampleCount(gestureId) {
    return state.samples[gestureId]?.length ?? 0;
  }

  function getSampleCounts() {
    return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
      accumulator[gestureId] = getSampleCount(gestureId);
      return accumulator;
    }, {});
  }

  function addSample(gestureId, vector) {
    if (!ALL_GESTURE_IDS.includes(gestureId) || !isNumericArray(vector)) {
      return false;
    }
    state.samples[gestureId].push(vector.map((value) => Number(value)));
    persist();
    return true;
  }

  function deleteLastSample(gestureId) {
    if (!ALL_GESTURE_IDS.includes(gestureId)) {
      return false;
    }
    const samples = state.samples[gestureId];
    if (!samples || samples.length === 0) {
      return false;
    }
    samples.pop();
    persist();
    return true;
  }

  function clearGesture(gestureId) {
    if (!ALL_GESTURE_IDS.includes(gestureId)) {
      return false;
    }
    state.samples[gestureId] = [];
    persist();
    return true;
  }

  function clearAll() {
    state.samples = createEmptySamples();
    persist();
  }

  function classifyLiveVectors(liveVectors) {
    const rawScores = {};
    let scoreTotal = 0;

    for (const gestureId of ALL_GESTURE_IDS) {
      const vector = liveVectors?.[gestureId];
      const samples = state.samples[gestureId] ?? [];
      if (!isNumericArray(vector) || samples.length === 0) {
        rawScores[gestureId] = 0;
        continue;
      }

      const ranked = [];
      for (const sample of samples) {
        const distance = euclideanDistance(vector, sample);
        if (Number.isFinite(distance)) {
          ranked.push(distance);
        }
      }

      if (ranked.length === 0) {
        rawScores[gestureId] = 0;
        continue;
      }

      ranked.sort((a, b) => a - b);
      const k = Math.min(3, ranked.length);
      const topDistances = ranked.slice(0, k);
      const weightedScore = topDistances.reduce((accumulator, distance) => {
        const normalizedDistance = distance / Math.max(1, vector.length);
        return accumulator + 1 / (1 + normalizedDistance * 18);
      }, 0) / k;

      const score = clamp(weightedScore, 0, 1);
      rawScores[gestureId] = score;
      scoreTotal += score;
    }

    if (scoreTotal <= 1e-9) {
      return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
        accumulator[gestureId] = 0;
        return accumulator;
      }, {});
    }

    return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
      accumulator[gestureId] = clamp(rawScores[gestureId] / scoreTotal, 0, 1);
      return accumulator;
    }, {});
  }

  function exportPayload() {
    return serializeState(state);
  }

  function exportJSON() {
    return JSON.stringify(exportPayload(), null, 2);
  }

  function importFromObject(rawPayload, replace = true) {
    const parsed = parseImportPayload(rawPayload);
    if (!parsed) {
      return {
        ok: false,
        reason: "invalid_payload",
      };
    }

    if (replace) {
      state.samples = parsed.samples;
    } else {
      for (const gestureId of ALL_GESTURE_IDS) {
        state.samples[gestureId] = [...(state.samples[gestureId] ?? []), ...(parsed.samples[gestureId] ?? [])];
      }
    }

    persist();
    return {
      ok: true,
      counts: getSampleCounts(),
    };
  }

  function importFromJSON(rawJson, replace = true) {
    try {
      const parsed = JSON.parse(rawJson);
      return importFromObject(parsed, replace);
    } catch {
      return {
        ok: false,
        reason: "invalid_json",
      };
    }
  }

  load();

  return {
    addSample,
    classifyLiveVectors,
    clearAll,
    clearGesture,
    deleteLastSample,
    exportJSON,
    exportPayload,
    getSampleCount,
    getSampleCounts,
    importFromJSON,
    importFromObject,
    load,
  };
}
