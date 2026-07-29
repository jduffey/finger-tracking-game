export const USER_PREFERENCES_STORAGE_KEY = "motionArcade.preferences.v1";
export const USER_PREFERENCES_VERSION = 3;

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  version: USER_PREFERENCES_VERSION,
  dominantHand: "auto",
  mirrorCamera: true,
  seatedMode: false,
  dwellDurationMs: 1000,
  pinchThreshold: 0.045,
  cursorSmoothing: 0.35,
  cursorScale: 1,
  uiScale: 1,
  reducedMotion: false,
  highContrast: false,
  lowSensory: false,
  performanceMode: "auto",
  masterVolume: 0.8,
  musicVolume: 0.65,
  effectsVolume: 0.8,
  muted: false,
  cameraPreview: "compact",
  favoriteModeIds: Object.freeze([]),
  recentModeIds: Object.freeze([]),
});

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function uniqueStrings(values, maxLength) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string" || !value || result.includes(value)) {
      continue;
    }
    result.push(value);
    if (result.length >= maxLength) {
      break;
    }
  }
  return result;
}

export function normalizeUserPreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: USER_PREFERENCES_VERSION,
    dominantHand: ["auto", "left", "right"].includes(source.dominantHand)
      ? source.dominantHand
      : DEFAULT_USER_PREFERENCES.dominantHand,
    mirrorCamera:
      typeof source.mirrorCamera === "boolean"
        ? source.mirrorCamera
        : DEFAULT_USER_PREFERENCES.mirrorCamera,
    seatedMode: Boolean(source.seatedMode),
    dwellDurationMs: clamp(source.dwellDurationMs, 0, 2000, 1000),
    pinchThreshold: clamp(source.pinchThreshold, 0.02, 0.09, 0.045),
    cursorSmoothing: clamp(source.cursorSmoothing, 0.05, 0.9, 0.35),
    cursorScale: clamp(source.cursorScale, 0.75, 2, 1),
    uiScale: clamp(source.uiScale, 0.9, 1.35, 1),
    reducedMotion: Boolean(source.reducedMotion),
    highContrast: Boolean(source.highContrast),
    lowSensory: Boolean(source.lowSensory),
    performanceMode: ["auto", "battery", "quality"].includes(source.performanceMode)
      ? source.performanceMode
      : DEFAULT_USER_PREFERENCES.performanceMode,
    masterVolume: clamp(source.masterVolume, 0, 1, 0.8),
    musicVolume: clamp(source.musicVolume, 0, 1, 0.65),
    effectsVolume: clamp(source.effectsVolume, 0, 1, 0.8),
    muted: Boolean(source.muted),
    cameraPreview: ["hidden", "compact", "expanded"].includes(source.cameraPreview)
      ? source.cameraPreview
      : DEFAULT_USER_PREFERENCES.cameraPreview,
    favoriteModeIds: uniqueStrings(source.favoriteModeIds, 64),
    recentModeIds: uniqueStrings(source.recentModeIds, 8),
  };
}

export function loadUserPreferences(storage = globalThis.localStorage) {
  if (!storage?.getItem) {
    return normalizeUserPreferences();
  }

  try {
    const raw = storage.getItem(USER_PREFERENCES_STORAGE_KEY);
    return normalizeUserPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeUserPreferences();
  }
}

export function saveUserPreferences(preferences, storage = globalThis.localStorage) {
  const normalized = normalizeUserPreferences(preferences);
  if (!storage?.setItem) {
    return normalized;
  }

  try {
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // A storage quota or privacy mode should not prevent the app from running.
  }
  return normalized;
}

export function toggleFavoriteMode(preferences, modeId) {
  const current = normalizeUserPreferences(preferences);
  if (typeof modeId !== "string" || !modeId) {
    return current;
  }

  const favoriteModeIds = current.favoriteModeIds.includes(modeId)
    ? current.favoriteModeIds.filter((id) => id !== modeId)
    : [...current.favoriteModeIds, modeId];
  return normalizeUserPreferences({ ...current, favoriteModeIds });
}

export function recordRecentMode(preferences, modeId) {
  const current = normalizeUserPreferences(preferences);
  if (typeof modeId !== "string" || !modeId) {
    return current;
  }

  return normalizeUserPreferences({
    ...current,
    recentModeIds: [modeId, ...current.recentModeIds.filter((id) => id !== modeId)],
  });
}

export function clearUserPreferences(storage = globalThis.localStorage) {
  try {
    storage?.removeItem?.(USER_PREFERENCES_STORAGE_KEY);
  } catch {
    // Treat storage cleanup as best-effort in restricted browsing contexts.
  }
  return normalizeUserPreferences();
}

export function applyPreferenceDocumentState(
  preferences,
  root = globalThis.document?.documentElement,
) {
  if (!root) {
    return;
  }

  const normalized = normalizeUserPreferences(preferences);
  root.dataset.reducedMotion = normalized.reducedMotion ? "true" : "false";
  root.dataset.highContrast = normalized.highContrast ? "true" : "false";
  root.dataset.lowSensory = normalized.lowSensory ? "true" : "false";
  root.dataset.mirrorCamera = normalized.mirrorCamera ? "true" : "false";
  root.dataset.seatedMode = normalized.seatedMode ? "true" : "false";
  root.style.setProperty("--user-ui-scale", normalized.uiScale);
  root.style.setProperty("--user-cursor-scale", normalized.cursorScale);
  root.style.setProperty(
    "--user-font-size",
    `${16 * normalized.uiScale}px`,
  );
  root.style.setProperty(
    "--user-cursor-size",
    `${22 * normalized.cursorScale}px`,
  );
  root.style.setProperty(
    "--user-cursor-trail-size",
    `${18 * normalized.cursorScale}px`,
  );
  root.style.setProperty(
    "--user-circle-cursor-size",
    `${24 * normalized.cursorScale}px`,
  );
  root.style.setProperty(
    "--user-circle-cursor-glow-size",
    `${140 * normalized.cursorScale}px`,
  );
}
