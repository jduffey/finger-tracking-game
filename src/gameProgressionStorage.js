import {
  GAME_PROGRESS_SCHEMA_VERSION,
  UnsupportedGameProgressVersionError,
  abandonGameSession,
  beginGameSession,
  createInitialGameProgression,
  migrateGameProgression,
  recordGameResult,
} from "./gameProgression.js";

export const GAME_PROGRESS_STORAGE_KEY = "motionArcade.gameProgression";

export const GAME_PROGRESS_STORAGE_STATUS = Object.freeze({
  LOADED: "loaded",
  EMPTY: "empty",
  SAVED: "saved",
  CLEARED: "cleared",
  UNAVAILABLE: "unavailable",
  INVALID: "invalid",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
  WRITE_BLOCKED: "write-blocked",
});

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveNow(now) {
  return typeof now === "function" ? now() : now;
}

/**
 * Reads progress without throwing. The status lets UI integrations distinguish a
 * first run from malformed, restricted, or future-version storage.
 */
export function readGameProgression(storage, { now } = {}) {
  const resolvedStorage = resolveStorage(storage);
  const timestamp = resolveNow(now);
  if (!resolvedStorage?.getItem) {
    return {
      progress: createInitialGameProgression({ now: timestamp }),
      status: GAME_PROGRESS_STORAGE_STATUS.UNAVAILABLE,
      storedVersion: null,
    };
  }

  let raw;
  try {
    raw = resolvedStorage.getItem(GAME_PROGRESS_STORAGE_KEY);
  } catch {
    return {
      progress: createInitialGameProgression({ now: timestamp }),
      status: GAME_PROGRESS_STORAGE_STATUS.UNAVAILABLE,
      storedVersion: null,
    };
  }

  if (!raw) {
    return {
      progress: createInitialGameProgression({ now: timestamp }),
      status: GAME_PROGRESS_STORAGE_STATUS.EMPTY,
      storedVersion: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      progress: createInitialGameProgression({ now: timestamp }),
      status: GAME_PROGRESS_STORAGE_STATUS.INVALID,
      storedVersion: null,
    };
  }

  const storedVersion = Number.isInteger(parsed?.version) ? parsed.version : 0;
  try {
    return {
      progress: migrateGameProgression(parsed, { now: timestamp }),
      status: GAME_PROGRESS_STORAGE_STATUS.LOADED,
      storedVersion,
    };
  } catch (error) {
    if (error instanceof UnsupportedGameProgressVersionError) {
      return {
        progress: createInitialGameProgression({ now: timestamp }),
        status: GAME_PROGRESS_STORAGE_STATUS.UNSUPPORTED,
        storedVersion,
      };
    }
    return {
      progress: createInitialGameProgression({ now: timestamp }),
      status: GAME_PROGRESS_STORAGE_STATUS.INVALID,
      storedVersion,
    };
  }
}

export function loadGameProgression(storage, options) {
  return readGameProgression(storage, options).progress;
}

/**
 * Saves a normalized snapshot. In-memory progress is always returned even when
 * localStorage is unavailable or full.
 */
export function writeGameProgression(progress, storage, { now } = {}) {
  const resolvedStorage = resolveStorage(storage);
  const timestamp = resolveNow(now);
  let normalized;
  try {
    normalized = migrateGameProgression(progress, { now: timestamp });
  } catch (error) {
    if (error instanceof UnsupportedGameProgressVersionError) {
      return {
        progress: createInitialGameProgression({ now: timestamp }),
        status: GAME_PROGRESS_STORAGE_STATUS.WRITE_BLOCKED,
      };
    }
    normalized = createInitialGameProgression({ now: timestamp });
  }

  if (!resolvedStorage?.setItem) {
    return {
      progress: normalized,
      status: GAME_PROGRESS_STORAGE_STATUS.UNAVAILABLE,
    };
  }

  try {
    resolvedStorage.setItem(GAME_PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
    return {
      progress: normalized,
      status: GAME_PROGRESS_STORAGE_STATUS.SAVED,
    };
  } catch {
    return {
      progress: normalized,
      status: GAME_PROGRESS_STORAGE_STATUS.FAILED,
    };
  }
}

export function saveGameProgression(progress, storage, options) {
  return writeGameProgression(progress, storage, options).progress;
}

export function removeGameProgression(storage, { now } = {}) {
  const resolvedStorage = resolveStorage(storage);
  const progress = createInitialGameProgression({ now: resolveNow(now) });
  if (!resolvedStorage?.removeItem) {
    return {
      progress,
      status: GAME_PROGRESS_STORAGE_STATUS.UNAVAILABLE,
    };
  }
  try {
    resolvedStorage.removeItem(GAME_PROGRESS_STORAGE_KEY);
    return {
      progress,
      status: GAME_PROGRESS_STORAGE_STATUS.CLEARED,
    };
  } catch {
    return {
      progress,
      status: GAME_PROGRESS_STORAGE_STATUS.FAILED,
    };
  }
}

/**
 * A small framework-agnostic store for React or imperative integrations. It
 * keeps playing in memory when persistence fails and never lets callbacks break
 * gameplay.
 */
export function createGameProgressionStore({
  storage,
  now = () => new Date().toISOString(),
  achievementDefinitions = [],
  onAchievementUnlocked,
} = {}) {
  const initialRead = readGameProgression(storage, { now: resolveNow(now) });
  let progress = initialRead.progress;
  let persistenceStatus = initialRead.status;
  let writesBlocked =
    initialRead.status === GAME_PROGRESS_STORAGE_STATUS.UNSUPPORTED;
  const listeners = new Set();

  function getState() {
    return progress;
  }

  function getPersistenceStatus() {
    return persistenceStatus;
  }

  function notify(event) {
    for (const listener of listeners) {
      try {
        listener(progress, event);
      } catch {
        // UI listeners must not break game result recording.
      }
    }
  }

  function persist() {
    if (writesBlocked) {
      persistenceStatus = GAME_PROGRESS_STORAGE_STATUS.WRITE_BLOCKED;
      return;
    }
    const write = writeGameProgression(progress, storage, { now: resolveNow(now) });
    progress = write.progress;
    persistenceStatus = write.status;
  }

  function beginSession(session) {
    const previousRevision = progress.revision;
    progress = beginGameSession(progress, session, { now: resolveNow(now) });
    if (progress.revision !== previousRevision) {
      persist();
      notify({ type: "session-started", sessionId: session.sessionId, modeId: session.modeId });
    }
    return progress;
  }

  function recordResult(result) {
    const recorded = recordGameResult(progress, result, {
      now: resolveNow(now),
      achievementDefinitions,
    });
    progress = recorded.progress;
    if (!recorded.duplicate) {
      persist();
      notify({
        type: "result-recorded",
        result: recorded.result,
        personalBests: recorded.personalBests,
        achievementUnlocks: recorded.achievementUnlocks,
      });
      if (typeof onAchievementUnlocked === "function") {
        for (const unlock of recorded.achievementUnlocks) {
          try {
            onAchievementUnlocked(unlock, progress);
          } catch {
            // Celebration hooks are optional and cannot invalidate progress.
          }
        }
      }
    }
    return recorded;
  }

  function abandonSession(input) {
    const recorded = abandonGameSession(progress, input, {
      now: resolveNow(now),
      achievementDefinitions,
    });
    progress = recorded.progress;
    persist();
    notify({
      type: "session-abandoned",
      result: recorded.result,
      achievementUnlocks: recorded.achievementUnlocks,
    });
    return recorded;
  }

  function clear() {
    const removed = removeGameProgression(storage, { now: resolveNow(now) });
    progress = removed.progress;
    persistenceStatus = removed.status;
    writesBlocked = false;
    notify({ type: "progress-cleared" });
    return progress;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("progression listener must be a function.");
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState,
    getPersistenceStatus,
    beginSession,
    recordResult,
    abandonSession,
    clear,
    subscribe,
    schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
  };
}
