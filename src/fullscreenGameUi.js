const FULLSCREEN_INDEX_ONLY_TRACKING_MODES = new Set(["tip-ripples", "tip-ripples-v2"]);

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
