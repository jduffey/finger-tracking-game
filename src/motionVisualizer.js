export const MOTION_VISUALIZER_STORAGE_KEY =
  "motion-arcade.motion-visualizer.v1";

export const MOTION_VISUALIZER_EFFECTS = Object.freeze([
  Object.freeze({
    id: "square",
    label: "Squares",
    description: "A tiled field that follows each pointer.",
  }),
  Object.freeze({
    id: "hex",
    label: "Hex",
    description: "A honeycomb of expanding color.",
  }),
  Object.freeze({
    id: "voronoi",
    label: "Voronoi",
    description: "A many-point stained-glass field.",
  }),
  Object.freeze({
    id: "rings",
    label: "Rings",
    description: "Layered color rings with a motion trail.",
  }),
  Object.freeze({
    id: "pulse",
    label: "Pulse",
    description: "Rings that radiate to the edge of the scene.",
  }),
  Object.freeze({
    id: "tip-ripples",
    label: "Tip Ripples",
    description: "Ripples follow each tracked index fingertip.",
  }),
  Object.freeze({
    id: "static",
    label: "Static",
    description: "A crisp topographic ripple study.",
  }),
]);

export const MOTION_VISUALIZER_PALETTES = Object.freeze([
  Object.freeze({
    id: "prism",
    label: "Prism",
    background: "#050914",
    line: "#f4f8ff",
    colors: Object.freeze([
      "#ff335f",
      "#ff9f1c",
      "#ffe66d",
      "#36e69a",
      "#35a7ff",
    ]),
  }),
  Object.freeze({
    id: "aurora",
    label: "Aurora",
    background: "#031317",
    line: "#d9fff7",
    colors: Object.freeze([
      "#38f9d7",
      "#43e97b",
      "#38a3ff",
      "#8c7bff",
      "#ed64ff",
    ]),
  }),
  Object.freeze({
    id: "ember",
    label: "Ember",
    background: "#170805",
    line: "#fff2dc",
    colors: Object.freeze([
      "#ff3d00",
      "#ff7043",
      "#ffab40",
      "#ffd740",
      "#ff5c8a",
    ]),
  }),
  Object.freeze({
    id: "ocean",
    label: "Ocean",
    background: "#020d1b",
    line: "#e1f7ff",
    colors: Object.freeze([
      "#00e5ff",
      "#00b8d4",
      "#2979ff",
      "#536dfe",
      "#7c4dff",
    ]),
  }),
  Object.freeze({
    id: "mono",
    label: "Moonlight",
    background: "#05070b",
    line: "#ffffff",
    colors: Object.freeze([
      "#ffffff",
      "#dce4ee",
      "#aebdca",
      "#7c8d9d",
      "#4f6070",
    ]),
  }),
]);

export const MOTION_VISUALIZER_BUILT_IN_PRESETS = Object.freeze([
  Object.freeze({
    id: "preset-neon-drift",
    label: "Neon Drift",
    settings: Object.freeze({
      effect: "rings",
      palette: "aurora",
      intensity: 82,
      trails: 76,
      cameraOpacity: 56,
    }),
  }),
  Object.freeze({
    id: "preset-heat-wave",
    label: "Heat Wave",
    settings: Object.freeze({
      effect: "pulse",
      palette: "ember",
      intensity: 92,
      trails: 64,
      cameraOpacity: 38,
    }),
  }),
  Object.freeze({
    id: "preset-quiet-geometry",
    label: "Quiet Geometry",
    settings: Object.freeze({
      effect: "square",
      palette: "mono",
      intensity: 48,
      trails: 18,
      cameraOpacity: 20,
    }),
  }),
]);

const EFFECT_IDS = new Set(MOTION_VISUALIZER_EFFECTS.map((effect) => effect.id));
const PALETTE_IDS = new Set(
  MOTION_VISUALIZER_PALETTES.map((palette) => palette.id),
);
const BUILT_IN_PRESET_IDS = new Set(
  MOTION_VISUALIZER_BUILT_IN_PRESETS.map((preset) => preset.id),
);
const MAX_SAVED_PRESETS = 8;

export const DEFAULT_MOTION_VISUALIZER_STATE = Object.freeze({
  effect: "rings",
  palette: "prism",
  intensity: 72,
  trails: 64,
  cameraOpacity: 58,
  favoriteEffects: Object.freeze([]),
  savedPresets: Object.freeze([]),
});

function clampPercent(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round(Math.min(100, Math.max(0, number)))
    : fallback;
}

function normalizePreset(preset, index) {
  if (!preset || typeof preset !== "object") {
    return null;
  }
  const id =
    typeof preset.id === "string" &&
    preset.id.trim() &&
    !BUILT_IN_PRESET_IDS.has(preset.id)
      ? preset.id.trim()
      : `saved-${index + 1}`;
  const settings = normalizeMotionVisualizerState(preset.settings);
  return {
    id,
    label:
      typeof preset.label === "string" && preset.label.trim()
        ? preset.label.trim().slice(0, 48)
        : `Saved look ${index + 1}`,
    settings: {
      effect: settings.effect,
      palette: settings.palette,
      intensity: settings.intensity,
      trails: settings.trails,
      cameraOpacity: settings.cameraOpacity,
    },
  };
}

export function isMotionVisualizerEffect(effectId) {
  return EFFECT_IDS.has(effectId);
}

export function normalizeMotionVisualizerState(value = {}) {
  const favoriteEffects = Array.isArray(value?.favoriteEffects)
    ? [...new Set(value.favoriteEffects.filter(isMotionVisualizerEffect))]
    : [];
  const savedPresets = Array.isArray(value?.savedPresets)
    ? value.savedPresets
        .map(normalizePreset)
        .filter(Boolean)
        .slice(-MAX_SAVED_PRESETS)
    : [];

  return {
    effect: isMotionVisualizerEffect(value?.effect)
      ? value.effect
      : DEFAULT_MOTION_VISUALIZER_STATE.effect,
    palette: PALETTE_IDS.has(value?.palette)
      ? value.palette
      : DEFAULT_MOTION_VISUALIZER_STATE.palette,
    intensity: clampPercent(
      value?.intensity,
      DEFAULT_MOTION_VISUALIZER_STATE.intensity,
    ),
    trails: clampPercent(
      value?.trails,
      DEFAULT_MOTION_VISUALIZER_STATE.trails,
    ),
    cameraOpacity: clampPercent(
      value?.cameraOpacity,
      DEFAULT_MOTION_VISUALIZER_STATE.cameraOpacity,
    ),
    favoriteEffects,
    savedPresets,
  };
}

export function loadMotionVisualizerState(storage) {
  try {
    const activeStorage =
      storage === undefined ? globalThis.localStorage : storage;
    const stored = activeStorage?.getItem?.(MOTION_VISUALIZER_STORAGE_KEY);
    return stored
      ? normalizeMotionVisualizerState(JSON.parse(stored))
      : normalizeMotionVisualizerState();
  } catch {
    return normalizeMotionVisualizerState();
  }
}

export function saveMotionVisualizerState(
  value,
  storage,
) {
  const normalized = normalizeMotionVisualizerState(value);
  try {
    const activeStorage =
      storage === undefined ? globalThis.localStorage : storage;
    activeStorage?.setItem?.(
      MOTION_VISUALIZER_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // The live experience still works when storage is blocked or full.
  }
  return normalized;
}

export function getMotionVisualizerPalette(paletteId) {
  return (
    MOTION_VISUALIZER_PALETTES.find(
      (palette) => palette.id === paletteId,
    ) ?? MOTION_VISUALIZER_PALETTES[0]
  );
}

export function toggleMotionVisualizerFavorite(state, effectId) {
  const normalized = normalizeMotionVisualizerState(state);
  if (!isMotionVisualizerEffect(effectId)) {
    return normalized;
  }
  const favorites = new Set(normalized.favoriteEffects);
  if (favorites.has(effectId)) {
    favorites.delete(effectId);
  } else {
    favorites.add(effectId);
  }
  return normalizeMotionVisualizerState({
    ...normalized,
    favoriteEffects: [...favorites],
  });
}

export function createMotionVisualizerPreset(
  state,
  now = Date.now(),
) {
  const normalized = normalizeMotionVisualizerState(state);
  const effect =
    MOTION_VISUALIZER_EFFECTS.find(
      (candidate) => candidate.id === normalized.effect,
    ) ?? MOTION_VISUALIZER_EFFECTS[0];
  const palette = getMotionVisualizerPalette(normalized.palette);
  const sequence = normalized.savedPresets.length + 1;
  const preset = {
    id: `saved-${Math.max(0, Number(now) || 0)}-${sequence}`,
    label: `${effect.label} · ${palette.label} ${sequence}`,
    settings: {
      effect: normalized.effect,
      palette: normalized.palette,
      intensity: normalized.intensity,
      trails: normalized.trails,
      cameraOpacity: normalized.cameraOpacity,
    },
  };
  return normalizeMotionVisualizerState({
    ...normalized,
    savedPresets: [...normalized.savedPresets, preset].slice(
      -MAX_SAVED_PRESETS,
    ),
  });
}

export function deleteMotionVisualizerPreset(state, presetId) {
  const normalized = normalizeMotionVisualizerState(state);
  return normalizeMotionVisualizerState({
    ...normalized,
    savedPresets: normalized.savedPresets.filter(
      (preset) => preset.id !== presetId,
    ),
  });
}

export function applyMotionVisualizerPreset(state, presetId) {
  const normalized = normalizeMotionVisualizerState(state);
  const preset = [
    ...MOTION_VISUALIZER_BUILT_IN_PRESETS,
    ...normalized.savedPresets,
  ].find((candidate) => candidate.id === presetId);
  return preset
    ? normalizeMotionVisualizerState({
        ...normalized,
        ...preset.settings,
      })
    : normalized;
}

export function getMotionVisualizerTrailDurationMs(state) {
  return Math.round(
    240 + normalizeMotionVisualizerState(state).trails * 34,
  );
}

export function getMotionVisualizerPulseDurationMs(state) {
  return Math.round(
    520 + normalizeMotionVisualizerState(state).trails * 24,
  );
}
