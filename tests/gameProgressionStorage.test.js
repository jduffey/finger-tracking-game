import test from "node:test";
import assert from "node:assert/strict";

import {
  createSessionMilestoneAchievement,
  recordGameResult,
} from "../src/gameProgression.js";
import {
  GAME_PROGRESS_STORAGE_KEY,
  GAME_PROGRESS_STORAGE_STATUS,
  createGameProgressionStore,
  readGameProgression,
  removeGameProgression,
  writeGameProgression,
} from "../src/gameProgressionStorage.js";

const NOW = "2026-07-01T12:00:00.000Z";

function createStorage(initialValue = null) {
  const entries = new Map();
  if (initialValue !== null) {
    entries.set(GAME_PROGRESS_STORAGE_KEY, initialValue);
  }
  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    },
    entries,
  };
}

test("read distinguishes empty, invalid, unavailable, and loaded progress", () => {
  const empty = readGameProgression(createStorage(), { now: NOW });
  assert.equal(empty.status, GAME_PROGRESS_STORAGE_STATUS.EMPTY);

  const invalid = readGameProgression(createStorage("{"), { now: NOW });
  assert.equal(invalid.status, GAME_PROGRESS_STORAGE_STATUS.INVALID);
  assert.equal(invalid.progress.totals.sessionsPlayed, 0);

  const unavailable = readGameProgression(null, { now: NOW });
  assert.equal(unavailable.status, GAME_PROGRESS_STORAGE_STATUS.UNAVAILABLE);

  const storage = createStorage();
  const recorded = recordGameResult(empty.progress, {
    sessionId: "saved-session",
    modeId: "breakout",
    outcome: "completed",
    score: 4,
    endedAt: NOW,
  });
  const write = writeGameProgression(recorded.progress, storage, { now: NOW });
  assert.equal(write.status, GAME_PROGRESS_STORAGE_STATUS.SAVED);

  const loaded = readGameProgression(storage, { now: NOW });
  assert.equal(loaded.status, GAME_PROGRESS_STORAGE_STATUS.LOADED);
  assert.equal(loaded.progress.modes.breakout.lastResult.score, 4);
});

test("storage access failures never discard the in-memory normalized snapshot", () => {
  const progress = recordGameResult(
    readGameProgression(null, { now: NOW }).progress,
    {
      sessionId: "memory-only",
      modeId: "invaders",
      outcome: "won",
      score: 15,
      endedAt: NOW,
    },
  ).progress;
  const failingStorage = {
    getItem() {
      throw new Error("privacy mode");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(
    readGameProgression(failingStorage, { now: NOW }).status,
    GAME_PROGRESS_STORAGE_STATUS.UNAVAILABLE,
  );
  const write = writeGameProgression(progress, failingStorage, { now: NOW });
  assert.equal(write.status, GAME_PROGRESS_STORAGE_STATUS.FAILED);
  assert.equal(write.progress.modes.invaders.lastResult.score, 15);
  assert.equal(
    removeGameProgression(failingStorage, { now: NOW }).status,
    GAME_PROGRESS_STORAGE_STATUS.FAILED,
  );
});

test("the store persists sessions, publishes results, and calls achievement hooks once", () => {
  const storage = createStorage();
  const events = [];
  const unlocks = [];
  const store = createGameProgressionStore({
    storage,
    now: () => NOW,
    achievementDefinitions: [
      createSessionMilestoneAchievement({ id: "first-session", count: 1 }),
    ],
    onAchievementUnlocked(unlock) {
      unlocks.push(unlock.id);
      throw new Error("celebration UI failed");
    },
  });
  store.subscribe((_progress, event) => events.push(event.type));
  store.subscribe(() => {
    throw new Error("subscriber failed");
  });

  store.beginSession({
    sessionId: "store-session",
    modeId: "hand-bounce",
    startedAt: NOW,
  });
  const recorded = store.recordResult({
    sessionId: "store-session",
    modeId: "hand-bounce",
    outcome: "completed",
    score: 6,
    endedAt: "2026-07-01T12:01:00.000Z",
  });
  const duplicate = store.recordResult({
    sessionId: "store-session",
    modeId: "hand-bounce",
    outcome: "completed",
    score: 100,
    endedAt: "2026-07-01T12:02:00.000Z",
  });

  assert.equal(recorded.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(events, ["session-started", "result-recorded"]);
  assert.deepEqual(unlocks, ["first-session"]);
  assert.equal(store.getPersistenceStatus(), GAME_PROGRESS_STORAGE_STATUS.SAVED);
  assert.equal(
    JSON.parse(storage.entries.get(GAME_PROGRESS_STORAGE_KEY)).modes["hand-bounce"]
      .lastResult.score,
    6,
  );

  const restored = createGameProgressionStore({ storage, now: () => NOW });
  assert.equal(restored.getState().modes["hand-bounce"].lastResult.score, 6);
});

test("the store continues in memory when writes fail", () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("quota exceeded");
    },
    removeItem() {},
  };
  const store = createGameProgressionStore({ storage, now: () => NOW });
  const recorded = store.recordResult({
    sessionId: "quota-session",
    modeId: "slice-air",
    outcome: "lost",
    score: 3,
    endedAt: NOW,
  });

  assert.equal(recorded.progress.totals.sessionsPlayed, 1);
  assert.equal(store.getState().modes["slice-air"].lastResult.score, 3);
  assert.equal(store.getPersistenceStatus(), GAME_PROGRESS_STORAGE_STATUS.FAILED);
});

test("future-version data is preserved until the user explicitly clears it", () => {
  const futurePayload = JSON.stringify({ version: 99, futureField: true });
  const storage = createStorage(futurePayload);
  const store = createGameProgressionStore({ storage, now: () => NOW });

  assert.equal(store.getPersistenceStatus(), GAME_PROGRESS_STORAGE_STATUS.UNSUPPORTED);
  store.recordResult({
    sessionId: "memory-future",
    modeId: "runner",
    outcome: "completed",
    score: 1,
    endedAt: NOW,
  });
  assert.equal(store.getPersistenceStatus(), GAME_PROGRESS_STORAGE_STATUS.WRITE_BLOCKED);
  assert.equal(storage.entries.get(GAME_PROGRESS_STORAGE_KEY), futurePayload);

  store.clear();
  assert.equal(storage.entries.has(GAME_PROGRESS_STORAGE_KEY), false);
  store.beginSession({
    sessionId: "after-clear",
    modeId: "runner",
    startedAt: NOW,
  });
  assert.equal(store.getPersistenceStatus(), GAME_PROGRESS_STORAGE_STATUS.SAVED);
});

test("legacy payloads load through deterministic migration without a backend", () => {
  const storage = createStorage(
    JSON.stringify({
      games: {
        breakout: {
          sessionsPlayed: 2,
          highScore: 21,
          lastScore: 17,
          lastPlayedAt: NOW,
        },
      },
    }),
  );
  const read = readGameProgression(storage, { now: NOW });

  assert.equal(read.status, GAME_PROGRESS_STORAGE_STATUS.LOADED);
  assert.equal(read.storedVersion, 0);
  assert.equal(read.progress.modes.breakout.bestByMetric.score.value, 21);
  assert.equal(read.progress.modes.breakout.lastResult.score, 17);
});
