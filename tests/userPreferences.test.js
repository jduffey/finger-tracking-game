import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_USER_PREFERENCES,
  USER_PREFERENCES_STORAGE_KEY,
  applyPreferenceDocumentState,
  clearUserPreferences,
  loadUserPreferences,
  normalizeUserPreferences,
  recordRecentMode,
  saveUserPreferences,
  toggleFavoriteMode,
} from "../src/userPreferences.js";

function createStorage(initialValue = null) {
  const entries = new Map();
  if (initialValue !== null) {
    entries.set(USER_PREFERENCES_STORAGE_KEY, initialValue);
  }
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
    entries,
  };
}

test("normalizes invalid preference values and clamps numeric comfort settings", () => {
  const normalized = normalizeUserPreferences({
    dominantHand: "up",
    dwellDurationMs: 9000,
    pinchThreshold: -1,
    cursorSmoothing: Number.NaN,
    cursorScale: 0.1,
    uiScale: 8,
    masterVolume: -4,
    musicVolume: 4,
    effectsVolume: 0.3,
    performanceMode: "turbo",
  });

  assert.equal(normalized.dominantHand, "auto");
  assert.equal(normalized.dwellDurationMs, 2000);
  assert.equal(normalized.pinchThreshold, 0.02);
  assert.equal(normalized.cursorSmoothing, DEFAULT_USER_PREFERENCES.cursorSmoothing);
  assert.equal(normalized.cursorScale, 0.75);
  assert.equal(normalized.uiScale, 1.35);
  assert.equal(normalized.masterVolume, 0);
  assert.equal(normalized.musicVolume, 1);
  assert.equal(normalized.effectsVolume, 0.3);
  assert.equal(normalized.performanceMode, "auto");
});

test("loads safely from malformed storage and saves a normalized schema", () => {
  const malformedStorage = createStorage("{");
  assert.deepEqual(loadUserPreferences(malformedStorage), normalizeUserPreferences());

  const storage = createStorage();
  const saved = saveUserPreferences({ dominantHand: "left", dwellDurationMs: 500 }, storage);
  assert.equal(saved.dominantHand, "left");
  assert.equal(loadUserPreferences(storage).dwellDurationMs, 500);
});

test("favorites toggle and recent modes remain unique and bounded", () => {
  let preferences = normalizeUserPreferences();
  preferences = toggleFavoriteMode(preferences, "sky-patrol");
  assert.deepEqual(preferences.favoriteModeIds, ["sky-patrol"]);
  preferences = toggleFavoriteMode(preferences, "sky-patrol");
  assert.deepEqual(preferences.favoriteModeIds, []);

  for (let index = 0; index < 12; index += 1) {
    preferences = recordRecentMode(preferences, `mode-${index}`);
  }
  preferences = recordRecentMode(preferences, "mode-6");
  assert.equal(preferences.recentModeIds.length, 8);
  assert.equal(preferences.recentModeIds[0], "mode-6");
  assert.equal(new Set(preferences.recentModeIds).size, 8);
});

test("clear removes persisted preferences", () => {
  const storage = createStorage();
  saveUserPreferences({ muted: true }, storage);
  const cleared = clearUserPreferences(storage);

  assert.equal(storage.entries.has(USER_PREFERENCES_STORAGE_KEY), false);
  assert.equal(cleared.muted, false);
});

test("applies accessibility preferences to the document root", () => {
  const attributes = {};
  const properties = {};
  const root = {
    dataset: attributes,
    style: {
      setProperty: (name, value) => {
        properties[name] = value;
      },
    },
  };

  applyPreferenceDocumentState(
    {
      reducedMotion: true,
      highContrast: true,
      lowSensory: true,
      mirrorCamera: false,
      seatedMode: true,
      uiScale: 1.2,
      cursorScale: 1.5,
    },
    root,
  );

  assert.deepEqual(attributes, {
    reducedMotion: "true",
    highContrast: "true",
    lowSensory: "true",
    mirrorCamera: "false",
    seatedMode: "true",
  });
  assert.equal(properties["--user-ui-scale"], 1.2);
  assert.equal(properties["--user-cursor-scale"], 1.5);
  assert.equal(properties["--user-font-size"], "19.2px");
  assert.equal(properties["--user-cursor-size"], "33px");
  assert.equal(properties["--user-cursor-trail-size"], "27px");
  assert.equal(properties["--user-circle-cursor-size"], "36px");
  assert.equal(properties["--user-circle-cursor-glow-size"], "210px");
});
