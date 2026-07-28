import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_AREAS,
  TRACKING_PROFILES,
} from "../src/modeRegistry.js";
import {
  filterLibraryModes,
  formatModeMetadata,
  getHomeSections,
  getLibraryModes,
  selectDailyChallengeMode,
  selectQuickPlayMode,
} from "../src/productHomeModel.js";
import { MODE_MATURITY } from "../src/modeRegistry.js";

test("home model exposes Play, Create, and Labs in a stable order", () => {
  const sections = getHomeSections();

  assert.deepEqual(
    sections.map((section) => section.area),
    [PRODUCT_AREAS.PLAY, PRODUCT_AREAS.CREATE, PRODUCT_AREAS.LABS],
  );
  assert.ok(sections.every((section) => section.label && section.summary));
  assert.ok(sections.every((section) => section.modes.length > 0));
});

test("the public library omits developer-only diagnostics by default", () => {
  assert.ok(getLibraryModes().every((mode) => mode.maturity !== MODE_MATURITY.INTERNAL));
  assert.ok(
    getLibraryModes({ includeInternal: true }).some(
      (mode) => mode.maturity === MODE_MATURITY.INTERNAL,
    ),
  );
});

test("library filtering searches useful player-facing metadata", () => {
  const modes = getLibraryModes();

  assert.deepEqual(
    filterLibraryModes(modes, { query: "pinch to fire" }).map((mode) => mode.id),
    ["sky-patrol", "invaders"],
  );
  assert.deepEqual(
    filterLibraryModes(modes, { query: "point to aim" }).map((mode) => mode.id),
    ["missile-command"],
  );
  assert.ok(
    filterLibraryModes(modes, { area: PRODUCT_AREAS.CREATE }).every(
      (mode) => mode.area === PRODUCT_AREAS.CREATE,
    ),
  );
  assert.deepEqual(filterLibraryModes(modes, { query: "does-not-exist" }), []);
});

test("library filtering supports practical duration, movement, and player facets", () => {
  const modes = getLibraryModes();
  const shortSoloOneHand = filterLibraryModes(modes, {
    maxMinutes: 2,
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    players: 1,
  });

  assert.ok(shortSoloOneHand.length > 0);
  assert.ok(
    shortSoloOneHand.every(
      (mode) =>
        mode.typicalMinutes <= 2 &&
        mode.trackingProfile === TRACKING_PROFILES.ONE_HAND &&
        mode.players === 1,
    ),
  );
});

test("quick play favors unplayed featured games and is deterministic when seeded", () => {
  const first = selectQuickPlayMode({ randomValue: 0 });
  const afterFirst = selectQuickPlayMode({
    recentModeIds: [first.id],
    randomValue: 0,
  });

  assert.equal(first.area, PRODUCT_AREAS.PLAY);
  assert.notEqual(afterFirst.id, first.id);
});

test("daily challenge is stable within a day and rotates across dates", () => {
  const first = selectDailyChallengeMode({ date: "2026-07-28T05:00:00Z" });
  const sameDay = selectDailyChallengeMode({ date: "2026-07-28T23:59:59Z" });
  const nextDay = selectDailyChallengeMode({ date: "2026-07-29T05:00:00Z" });

  assert.equal(first.id, sameDay.id);
  assert.notEqual(first.id, nextDay.id);
  assert.equal(first.area, PRODUCT_AREAS.PLAY);
});

test("mode metadata is concise and omits unavailable fields", () => {
  assert.deepEqual(
    formatModeMetadata({
      controlHint: "Point to steer",
      typicalMinutes: 3,
      players: 1,
      difficulty: "Easy",
    }),
    ["Point to steer", "3 min", "1 player", "Easy"],
  );
  assert.deepEqual(formatModeMetadata({ players: 2 }), ["2 players"]);
});
