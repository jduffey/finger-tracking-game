import { createScopedLogger } from "../logger.js";
import {
  ALL_GESTURE_IDS,
  PERSONALIZATION_STORAGE_KEY,
  PERSONALIZATION_VERSION,
} from "./constants.js";

export const PERSONALIZATION_LIMITS = Object.freeze({
  maxJsonBytes: 4 * 1024 * 1024,
  maxSamplesPerGesture: 256,
  maxTotalSamples: 1024,
  maxVectorLength: 256,
  maxAbsoluteVectorValue: 4096,
});

const IMPORT_ERROR_MESSAGES = Object.freeze({
  invalid_json: "This file is not valid JSON.",
  invalid_payload: "This training file is invalid or incompatible.",
  payload_too_large: "This training file is too large to import.",
  too_many_gesture_samples: "This training file has too many samples for one gesture.",
  too_many_samples: "This training file has too many gesture samples.",
  invalid_vector_length: "This training file contains an invalid sample size.",
  invalid_vector_value: "This training file contains an invalid sample value.",
});

function createEmptySamples() {
  return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
    accumulator[gestureId] = [];
    return accumulator;
  }, {});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createImportFailure(reason) {
  return {
    ok: false,
    reason,
    message: IMPORT_ERROR_MESSAGES[reason] ?? IMPORT_ERROR_MESSAGES.invalid_payload,
  };
}

function createImportSuccess(value) {
  return {
    ok: true,
    value,
  };
}

function getUtf8ByteLength(value, stopAfter = Number.POSITIVE_INFINITY) {
  let byteLength = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      byteLength += 1;
    } else if (codeUnit <= 0x7ff) {
      byteLength += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        byteLength += 4;
        index += 1;
      } else {
        byteLength += 3;
      }
    } else {
      byteLength += 3;
    }

    if (byteLength > stopAfter) {
      return byteLength;
    }
  }

  return byteLength;
}

function validateJsonSize(rawJson) {
  if (
    typeof rawJson !== "string" ||
    getUtf8ByteLength(rawJson, PERSONALIZATION_LIMITS.maxJsonBytes) >
      PERSONALIZATION_LIMITS.maxJsonBytes
  ) {
    return createImportFailure(
      typeof rawJson === "string" ? "payload_too_large" : "invalid_json",
    );
  }
  return createImportSuccess(rawJson);
}

function validateVector(vector) {
  if (
    !Array.isArray(vector) ||
    vector.length === 0 ||
    vector.length > PERSONALIZATION_LIMITS.maxVectorLength
  ) {
    return createImportFailure("invalid_vector_length");
  }

  const normalized = new Array(vector.length);
  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index];
    if (
      !Number.isFinite(value) ||
      Math.abs(value) > PERSONALIZATION_LIMITS.maxAbsoluteVectorValue
    ) {
      return createImportFailure("invalid_vector_value");
    }
    normalized[index] = Number(value);
  }

  return createImportSuccess(normalized);
}

function validateSamples(rawSamples) {
  const samples = createEmptySamples();
  if (!rawSamples || typeof rawSamples !== "object" || Array.isArray(rawSamples)) {
    return createImportFailure("invalid_payload");
  }

  let totalSamples = 0;
  for (const gestureId of ALL_GESTURE_IDS) {
    const input = rawSamples[gestureId];
    if (input === undefined) {
      continue;
    }
    if (!Array.isArray(input)) {
      return createImportFailure("invalid_payload");
    }
    if (input.length > PERSONALIZATION_LIMITS.maxSamplesPerGesture) {
      return createImportFailure("too_many_gesture_samples");
    }

    totalSamples += input.length;
    if (totalSamples > PERSONALIZATION_LIMITS.maxTotalSamples) {
      return createImportFailure("too_many_samples");
    }

    for (const vector of input) {
      const validation = validateVector(vector);
      if (!validation.ok) {
        return validation;
      }
      samples[gestureId].push(validation.value);
    }
  }

  return createImportSuccess(samples);
}

function isValidVector(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > PERSONALIZATION_LIMITS.maxVectorLength
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (
      !Number.isFinite(value[index]) ||
      Math.abs(value[index]) > PERSONALIZATION_LIMITS.maxAbsoluteVectorValue
    ) {
      return false;
    }
  }
  return true;
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

function cloneSamples(samples) {
  return ALL_GESTURE_IDS.reduce((copy, gestureId) => {
    copy[gestureId] = (samples[gestureId] ?? []).map((vector) => [...vector]);
    return copy;
  }, {});
}

function parseImportPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return createImportFailure("invalid_payload");
  }

  if (raw.version !== PERSONALIZATION_VERSION) {
    return createImportFailure("invalid_payload");
  }

  const samplesValidation = validateSamples(raw.samples);
  if (!samplesValidation.ok) {
    return samplesValidation;
  }

  return createImportSuccess({
    version: raw.version,
    savedAt: raw.savedAt,
    samples: samplesValidation.value,
  });
}

function stringifyWithinQuota(value) {
  let json;
  try {
    json = JSON.stringify(value);
  } catch {
    return createImportFailure("invalid_payload");
  }

  const sizeValidation = validateJsonSize(json);
  if (!sizeValidation.ok) {
    return sizeValidation.reason === "invalid_json"
      ? createImportFailure("invalid_payload")
      : sizeValidation;
  }

  return createImportSuccess(json);
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createGesturePersonalization(options = {}) {
  const storageKey = options.storageKey ?? PERSONALIZATION_STORAGE_KEY;
  const logger = options.logger ?? createScopedLogger("gesturePersonalization");
  const storage = Object.prototype.hasOwnProperty.call(options, "storage")
    ? options.storage
    : getDefaultStorage();

  const state = {
    samples: createEmptySamples(),
  };

  function persist() {
    try {
      if (!storage?.setItem) {
        return;
      }
      const serialized = stringifyWithinQuota(serializeState(state));
      if (!serialized.ok) {
        logger.warn("Refusing to persist personalization samples beyond safe limits", {
          reason: serialized.reason,
        });
        return;
      }
      storage.setItem(storageKey, serialized.value);
    } catch (error) {
      logger.warn("Failed to persist personalization samples", { error });
    }
  }

  function load() {
    try {
      if (!storage?.getItem) {
        return;
      }
      const raw = storage.getItem(storageKey);
      if (!raw) {
        return;
      }

      const sizeValidation = validateJsonSize(raw);
      if (!sizeValidation.ok) {
        logger.warn("Ignoring personalization payload beyond safe limits", {
          reason: sizeValidation.reason,
        });
        return;
      }

      const parsed = parseImportPayload(JSON.parse(raw));
      if (!parsed.ok) {
        logger.warn("Ignoring personalization payload due to invalid schema/version", {
          reason: parsed.reason,
        });
        return;
      }
      state.samples = parsed.value.samples;
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
    if (!ALL_GESTURE_IDS.includes(gestureId)) {
      return false;
    }

    const vectorValidation = validateVector(vector);
    if (!vectorValidation.ok) {
      return false;
    }

    const currentGestureCount = state.samples[gestureId]?.length ?? 0;
    const currentTotal = ALL_GESTURE_IDS.reduce(
      (total, id) => total + (state.samples[id]?.length ?? 0),
      0,
    );
    if (
      currentGestureCount >= PERSONALIZATION_LIMITS.maxSamplesPerGesture ||
      currentTotal >= PERSONALIZATION_LIMITS.maxTotalSamples
    ) {
      return false;
    }

    const candidateSamples = {
      ...state.samples,
      [gestureId]: [...state.samples[gestureId], vectorValidation.value],
    };
    const candidatePayload = stringifyWithinQuota(
      serializeState({ samples: candidateSamples }),
    );
    if (!candidatePayload.ok) {
      return false;
    }

    state.samples = candidateSamples;
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
      if (!isValidVector(vector) || samples.length === 0) {
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
    return serializeState({
      samples: cloneSamples(state.samples),
    });
  }

  function exportJSON() {
    const payload = exportPayload();
    const formatted = JSON.stringify(payload, null, 2);
    if (validateJsonSize(formatted).ok) {
      return formatted;
    }
    return JSON.stringify(payload);
  }

  function importFromObjectUnchecked(rawPayload, replace) {
    const serialized = stringifyWithinQuota(rawPayload);
    if (!serialized.ok) {
      return serialized;
    }

    const parsed = parseImportPayload(rawPayload);
    if (!parsed.ok) {
      return parsed;
    }

    let candidateSamples;
    if (replace) {
      candidateSamples = parsed.value.samples;
    } else {
      candidateSamples = createEmptySamples();
      for (const gestureId of ALL_GESTURE_IDS) {
        candidateSamples[gestureId] = [
          ...(state.samples[gestureId] ?? []),
          ...(parsed.value.samples[gestureId] ?? []),
        ];
      }
    }

    const candidateValidation = validateSamples(candidateSamples);
    if (!candidateValidation.ok) {
      return candidateValidation;
    }
    const candidatePayload = stringifyWithinQuota(
      serializeState({ samples: candidateValidation.value }),
    );
    if (!candidatePayload.ok) {
      return candidatePayload;
    }

    state.samples = candidateValidation.value;
    persist();
    return {
      ok: true,
      counts: getSampleCounts(),
    };
  }

  function importFromObject(rawPayload, replace = true) {
    try {
      return importFromObjectUnchecked(rawPayload, replace);
    } catch {
      return createImportFailure("invalid_payload");
    }
  }

  function importFromJSON(rawJson, replace = true) {
    const sizeValidation = validateJsonSize(rawJson);
    if (!sizeValidation.ok) {
      return sizeValidation;
    }

    try {
      const parsed = JSON.parse(rawJson);
      return importFromObject(parsed, replace);
    } catch {
      return createImportFailure("invalid_json");
    }
  }

  load();

  return {
    addSample,
    classifyLiveVectors,
    clearAll,
    clearSamples: clearAll,
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
