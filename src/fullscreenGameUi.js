const FULLSCREEN_INDEX_ONLY_TRACKING_MODES = new Set(["tip-ripples"]);
const FULLSCREEN_ONE_HAND_ONLY_MODES = new Set(["tic-tac-toe"]);
const FULLSCREEN_FOUR_HAND_TRACKING_MODES = new Set([
  "square",
  "hex",
  "voronoi",
  "rings",
  "pulse",
  "tip-ripples",
  "static",
]);
const FULLSCREEN_HAND_SKELETON_MODES = new Set(["tic-tac-toe"]);
const FULLSCREEN_NEON_HAND_OUTLINE_MODES = new Set(["sky-patrol"]);

export function getFullscreenTrackedFingerNames(mode, fingerNames) {
  const safeFingerNames = Array.isArray(fingerNames)
    ? fingerNames.filter((fingerName) => typeof fingerName === "string")
    : [];

  if (!FULLSCREEN_INDEX_ONLY_TRACKING_MODES.has(mode)) {
    return safeFingerNames;
  }

  return safeFingerNames.includes("index") ? ["index"] : [];
}

export function shouldShowFullscreenInvadersBanner(state) {
  if (!state?.message) {
    return false;
  }

  return state.status === "gameover" || state.status === "cleared";
}

export function getFullscreenTrackedHandLimit(mode, fallback = 2) {
  if (FULLSCREEN_ONE_HAND_ONLY_MODES.has(mode)) {
    return 1;
  }

  if (FULLSCREEN_FOUR_HAND_TRACKING_MODES.has(mode)) {
    return 4;
  }

  return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
}

export function shouldShowFullscreenHandSkeleton(mode) {
  return FULLSCREEN_HAND_SKELETON_MODES.has(mode);
}

export function shouldShowFullscreenNeonHandOutline(mode) {
  return FULLSCREEN_NEON_HAND_OUTLINE_MODES.has(mode);
}
