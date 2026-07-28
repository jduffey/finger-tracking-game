import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_AREAS,
  TRACKING_PROFILES,
  getFeaturedModes,
} from "../src/modeRegistry.js";
import {
  filterLibraryModes,
  formatModeMetadata,
  getProductHomeAreaFromPath,
  getProductHomePathForArea,
  getHomeSections,
  getLibraryModes,
  hasReturningHomeActivity,
  selectContinueMode,
  selectDailyChallengeMode,
  selectHomeRecommendations,
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

test("top-level home destinations round-trip through stable routes", () => {
  assert.equal(getProductHomeAreaFromPath("/"), "all");
  assert.equal(getProductHomeAreaFromPath("/play/"), PRODUCT_AREAS.PLAY);
  assert.equal(getProductHomeAreaFromPath("/create"), PRODUCT_AREAS.CREATE);
  assert.equal(getProductHomeAreaFromPath("/labs"), PRODUCT_AREAS.LABS);
  assert.equal(getProductHomeAreaFromPath("/play/sky-patrol"), null);
  assert.equal(getProductHomeAreaFromPath("/unknown"), null);

  assert.equal(getProductHomePathForArea(PRODUCT_AREAS.PLAY), "/play");
  assert.equal(getProductHomePathForArea(PRODUCT_AREAS.CREATE), "/create");
  assert.equal(getProductHomePathForArea(PRODUCT_AREAS.LABS), "/labs");
  assert.equal(getProductHomePathForArea("unknown"), "/");
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

test("quick play never immediately repeats the latest game when alternatives exist", () => {
  const playedFeaturedIds = getFeaturedModes()
    .filter((mode) => mode.area === PRODUCT_AREAS.PLAY)
    .map((mode) => mode.id);

  assert.ok(playedFeaturedIds.length > 1);
  for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999999]) {
    assert.notEqual(
      selectQuickPlayMode({
        recentModeIds: playedFeaturedIds,
        randomValue,
      }).id,
      playedFeaturedIds[0],
    );
  }
});

test("quick play can exclude its previous in-session pick", () => {
  const first = selectQuickPlayMode({ randomValue: 0 });
  const second = selectQuickPlayMode({
    excludedModeIds: [first.id],
    randomValue: 0,
  });

  assert.notEqual(second.id, first.id);
});

test("home recommendations prefer favorites, skip duplicate shortcuts, and stay unique", () => {
  const recommendations = selectHomeRecommendations({
    favoriteModeIds: ["sky-patrol", "missile-command"],
    recentModeIds: ["slice-air", "sky-patrol"],
    excludedModeIds: ["sky-patrol"],
    limit: 2,
  });

  assert.equal(recommendations[0].id, "missile-command");
  assert.equal(recommendations.length, 2);
  assert.equal(new Set(recommendations.map((mode) => mode.id)).size, 2);
  assert.ok(recommendations.every((mode) => mode.id !== "sky-patrol"));
  assert.deepEqual(selectHomeRecommendations({ limit: 0 }), []);
});

test("home treats any durable activity as a returning visit", () => {
  assert.equal(hasReturningHomeActivity(), false);
  assert.equal(
    hasReturningHomeActivity({
      progression: { totals: { sessionsPlayed: 1 } },
    }),
    true,
  );
  assert.equal(
    hasReturningHomeActivity({ recentModeIds: ["sky-patrol"] }),
    true,
  );
  assert.equal(
    hasReturningHomeActivity({ favoriteModeIds: ["slice-air"] }),
    true,
  );
  assert.equal(
    hasReturningHomeActivity({
      latestResult: { modeId: "missile-command" },
    }),
    true,
  );
});

test("daily challenge is stable within a day and rotates across dates", () => {
  const first = selectDailyChallengeMode({ date: "2026-07-28T05:00:00Z" });
  const sameDay = selectDailyChallengeMode({ date: "2026-07-28T23:59:59Z" });
  const nextDay = selectDailyChallengeMode({ date: "2026-07-29T05:00:00Z" });

  assert.equal(first.id, sameDay.id);
  assert.notEqual(first.id, nextDay.id);
  assert.equal(first.area, PRODUCT_AREAS.PLAY);
});

test("continue ignores shell routes and returns the newest playable experience", () => {
  assert.equal(
    selectContinueMode(["home", "tracking-setup", "sky-patrol"])?.id,
    "sky-patrol",
  );
  assert.equal(selectContinueMode(["home", "tracking-setup"]), null);
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
