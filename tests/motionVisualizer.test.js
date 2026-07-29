import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MOTION_VISUALIZER_STATE,
  MOTION_VISUALIZER_BUILT_IN_PRESETS,
  MOTION_VISUALIZER_EFFECTS,
  MOTION_VISUALIZER_STORAGE_KEY,
  applyMotionVisualizerPreset,
  createMotionVisualizerPreset,
  deleteMotionVisualizerPreset,
  getMotionVisualizerPalette,
  getMotionVisualizerPulseDurationMs,
  getMotionVisualizerTrailDurationMs,
  isMotionVisualizerEffect,
  loadMotionVisualizerState,
  normalizeMotionVisualizerState,
  saveMotionVisualizerState,
  toggleMotionVisualizerFavorite,
} from "../src/motionVisualizer.js";
import {
  createMotionVisualizerSnapshotFilename,
  createMotionVisualizerSnapshotSvg,
} from "../src/motionVisualizerSnapshot.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    read(key) {
      return values.get(key) ?? null;
    },
  };
}

test("Motion Visualizer exposes the seven compatible effect ids", () => {
  assert.deepEqual(
    MOTION_VISUALIZER_EFFECTS.map((effect) => effect.id),
    [
      "square",
      "hex",
      "voronoi",
      "rings",
      "pulse",
      "tip-ripples",
      "static",
    ],
  );
  assert.equal(isMotionVisualizerEffect("rings"), true);
  assert.equal(isMotionVisualizerEffect("music-reactive"), false);
});

test("visualizer state normalization bounds controls and rejects stale ids", () => {
  const normalized = normalizeMotionVisualizerState({
    effect: "unknown",
    palette: "missing",
    intensity: 500,
    trails: -9,
    cameraOpacity: "42",
    favoriteEffects: ["rings", "missing", "rings", "hex"],
    savedPresets: [{ id: "old", label: " Old ", settings: { effect: "hex" } }],
  });

  assert.equal(normalized.effect, DEFAULT_MOTION_VISUALIZER_STATE.effect);
  assert.equal(normalized.palette, DEFAULT_MOTION_VISUALIZER_STATE.palette);
  assert.equal(normalized.intensity, 100);
  assert.equal(normalized.trails, 0);
  assert.equal(normalized.cameraOpacity, 42);
  assert.deepEqual(normalized.favoriteEffects, ["rings", "hex"]);
  assert.equal(normalized.savedPresets[0].label, "Old");
  assert.equal(normalized.savedPresets[0].settings.effect, "hex");
});

test("visualizer settings and saved looks persist without requiring storage", () => {
  const storage = createMemoryStorage();
  const withPreset = createMotionVisualizerPreset(
    {
      ...DEFAULT_MOTION_VISUALIZER_STATE,
      effect: "pulse",
      palette: "ember",
    },
    123,
  );
  const saved = saveMotionVisualizerState(withPreset, storage);
  const loaded = loadMotionVisualizerState(storage);

  assert.deepEqual(loaded, saved);
  assert.match(storage.read(MOTION_VISUALIZER_STORAGE_KEY), /saved-123-1/);
  assert.deepEqual(
    loadMotionVisualizerState({
      getItem() {
        throw new Error("blocked");
      },
    }),
    normalizeMotionVisualizerState(),
  );
});

test("favorites and saved presets remain bounded and reversible", () => {
  const favorite = toggleMotionVisualizerFavorite(
    DEFAULT_MOTION_VISUALIZER_STATE,
    "voronoi",
  );
  assert.deepEqual(favorite.favoriteEffects, ["voronoi"]);
  assert.deepEqual(
    toggleMotionVisualizerFavorite(favorite, "voronoi").favoriteEffects,
    [],
  );

  let state = normalizeMotionVisualizerState();
  for (let index = 0; index < 10; index += 1) {
    state = createMotionVisualizerPreset(
      { ...state, effect: index % 2 ? "hex" : "rings" },
      index,
    );
  }
  assert.equal(state.savedPresets.length, 8);
  const firstRetainedId = state.savedPresets[0].id;
  assert.equal(
    deleteMotionVisualizerPreset(state, firstRetainedId).savedPresets.length,
    7,
  );
});

test("built-in and saved looks apply visual settings while retaining the library", () => {
  const favorite = toggleMotionVisualizerFavorite(
    DEFAULT_MOTION_VISUALIZER_STATE,
    "static",
  );
  const builtIn = applyMotionVisualizerPreset(
    favorite,
    MOTION_VISUALIZER_BUILT_IN_PRESETS[1].id,
  );
  assert.equal(builtIn.effect, "pulse");
  assert.equal(builtIn.palette, "ember");
  assert.deepEqual(builtIn.favoriteEffects, ["static"]);

  const withSaved = createMotionVisualizerPreset(
    { ...builtIn, effect: "voronoi", palette: "ocean" },
    99,
  );
  const savedId = withSaved.savedPresets.at(-1).id;
  const applied = applyMotionVisualizerPreset(
    { ...withSaved, effect: "square" },
    savedId,
  );
  assert.equal(applied.effect, "voronoi");
  assert.equal(applied.palette, "ocean");
  assert.equal(applied.savedPresets.length, 1);
});

test("trail controls change the actual animation durations", () => {
  assert.ok(
    getMotionVisualizerTrailDurationMs({ trails: 100 }) >
      getMotionVisualizerTrailDurationMs({ trails: 0 }),
  );
  assert.ok(
    getMotionVisualizerPulseDurationMs({ trails: 100 }) >
      getMotionVisualizerPulseDurationMs({ trails: 0 }),
  );
  assert.equal(getMotionVisualizerPalette("missing").id, "prism");
});

test("snapshot export creates private SVG artwork for every effect", () => {
  for (const effect of MOTION_VISUALIZER_EFFECTS) {
    const svg = createMotionVisualizerSnapshotSvg({
      settings: {
        ...DEFAULT_MOTION_VISUALIZER_STATE,
        effect: effect.id,
        palette: "aurora",
      },
      width: 800,
      height: 500,
      indexPoints: [
        { id: "left", x: 180, y: 240 },
        { id: "right", x: 620, y: 260 },
      ],
      tipPoints: [
        { id: "index", x: 180, y: 240 },
        { id: "thumb", x: 620, y: 260 },
      ],
    });

    assert.match(svg, /^<svg /);
    assert.match(svg, /width="800" height="500"/);
    assert.match(svg, new RegExp(`${effect.id} effect`));
    assert.match(svg, /Camera imagery is intentionally omitted/);
    assert.doesNotMatch(svg, /<image|video|data:image/);
  }
});

test("snapshot filenames are stable and filesystem-safe", () => {
  assert.equal(
    createMotionVisualizerSnapshotFilename(
      "Tip Ripples!",
      new Date("2026-07-28T12:00:00Z"),
    ),
    "motion-visualizer-tip-ripples-2026-07-28.svg",
  );
});
