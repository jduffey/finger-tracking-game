import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_PHASES,
  MODE_MATURITY,
  MODE_REGISTRY,
  PRODUCT_AREAS,
  getFeaturedModes,
  getModeByFullscreenId,
  getModeById,
  getModeByPhase,
  getModeByPath,
  getModesByPhase,
  listModes,
  validateModeRegistry,
} from "../src/modeRegistry.js";

test("mode registry is internally valid and immutable", () => {
  assert.deepEqual(validateModeRegistry(), []);
  assert.equal(Object.isFrozen(MODE_REGISTRY), true);
  assert.ok(MODE_REGISTRY.length >= 25);
  assert.ok(MODE_REGISTRY.every((mode) => Object.isFrozen(mode)));
});

test("mode registry defines one coherent Play, Create, Labs, and Setup taxonomy", () => {
  const areas = new Set(MODE_REGISTRY.map((mode) => mode.area));

  assert.deepEqual(
    [...areas].sort(),
    [
      PRODUCT_AREAS.CREATE,
      PRODUCT_AREAS.LABS,
      PRODUCT_AREAS.PLAY,
      PRODUCT_AREAS.SETUP,
    ].sort(),
  );
  assert.ok(listModes({ area: PRODUCT_AREAS.PLAY }).length >= 10);
  assert.ok(listModes({ area: PRODUCT_AREAS.CREATE }).length >= 4);
  assert.ok(listModes({ area: PRODUCT_AREAS.LABS }).length >= 8);
});

test("featured library is curated and excludes internal experiments", () => {
  const featured = getFeaturedModes();

  assert.ok(featured.length >= 6);
  assert.ok(featured.length <= 9);
  assert.ok(featured.every((mode) => mode.maturity !== MODE_MATURITY.INTERNAL));
  assert.ok(featured.some((mode) => mode.id === "sky-patrol"));
  assert.ok(featured.some((mode) => mode.id === "gesture-art"));
  assert.ok(featured.some((mode) => mode.id === "jam-studio"));
});

test("fullscreen variants resolve to their consolidated library experience", () => {
  assert.equal(getModeByFullscreenId("sky-patrol")?.id, "sky-patrol");
  assert.equal(getModeByFullscreenId("fruit-ninja")?.id, "slice-air");
  assert.equal(getModeByFullscreenId("square")?.id, "visualizer");
  assert.equal(getModeByFullscreenId("tip-ripples")?.id, "visualizer");
  assert.equal(getModeByFullscreenId("find-your-grind-breakout")?.id, "breakout");
  assert.equal(getModeByFullscreenId("missing"), null);
});

test("player-facing capability claims match the experiences that exist", () => {
  const twoHandBreakout = getModeById("breakout-coop");
  assert.equal(twoHandBreakout.label, "Two-Hand Breakout");
  assert.equal(twoHandBreakout.trackingProfile, "two-hands");
  assert.equal(twoHandBreakout.players, 1);

  const ticTacToe = getModeById("tic-tac-toe");
  assert.equal(ticTacToe.players, 1);
  assert.equal(ticTacToe.difficulty, "Medium");
  assert.doesNotMatch(ticTacToe.objective, /another player|best-of/i);

  const visualizer = getModeById("visualizer");
  assert.equal(visualizer.maturity, MODE_MATURITY.SUPPORTED);
  assert.equal(visualizer.featured, true);
  assert.match(visualizer.objective, /export|artwork/i);
  assert.deepEqual(visualizer.variants, [
    "square",
    "hex",
    "voronoi",
    "rings",
    "pulse",
    "tip-ripples",
    "static",
  ]);

  for (const trackingOnlyLabId of [
    "track-runner",
    "star-flight",
    "conveyor-toss",
    "pinch-sandbox",
  ]) {
    assert.equal(
      getModeById(trackingOnlyLabId).supportsPointerFallback,
      false,
    );
  }
  const probabilityTable = getModeById("probability-table");
  assert.equal(probabilityTable.trackingProfile, "none");
  assert.equal(probabilityTable.supportsPointerFallback, true);
});

test("mode registry supports stable ids and paths", () => {
  assert.equal(getModeById("tracking-setup")?.phase, APP_PHASES.TRACKING_SETUP);
  assert.equal(getModeByPath("/create/jam-studio")?.href, "/circle-of-fifths.html");
  assert.equal(getModeByPhase(APP_PHASES.RUNNER)?.id, "track-runner");
  assert.ok(getModesByPhase(APP_PHASES.FULLSCREEN_CAMERA).length > 10);
  assert.equal(getModeById("missing"), null);
  assert.equal(getModeByPath("/missing"), null);
});

test("registry validation reports duplicate and incomplete definitions", () => {
  const invalid = [
    {
      id: "duplicate",
      label: "First",
      path: "/first",
      area: PRODUCT_AREAS.PLAY,
      maturity: MODE_MATURITY.SUPPORTED,
      fullscreenMode: "same",
    },
    {
      id: "duplicate",
      label: "Second",
      path: "/first",
      area: PRODUCT_AREAS.PLAY,
      maturity: MODE_MATURITY.SUPPORTED,
      fullscreenMode: "same",
    },
    {
      id: "",
      path: "/incomplete",
    },
  ];

  assert.deepEqual(validateModeRegistry(invalid), [
    "Duplicate mode id: duplicate",
    "Duplicate mode path: /first",
    "Duplicate fullscreen mode: same",
    "Mode <unknown> is missing required metadata.",
  ]);
});
