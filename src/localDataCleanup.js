export const LOCAL_PRODUCT_STORAGE_KEYS = Object.freeze([
  "fingerTrackingGame.calibration.v2",
  "fingerWhack.calibration.v2",
  "motionArcade.preferences.v1",
  "minority_report_personalization_v1",
  "spatial_gesture_memory_stats_v1",
  "motionArcade.creativeGallery",
  "motionArcade.gameProgression",
  "motionArcade.arcadeRun",
  "motion-arcade.motion-visualizer.v1",
  "motion_arcade_gesture_analytics_v1",
  "motionArcade.jamStudio.loop.v1",
  "motion-arcade.fingerprint-worlds.v1",
]);

function resolveLocalStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function clearLocalProductStorage(storage) {
  const target = resolveLocalStorage(storage);
  if (!target?.removeItem) {
    return {
      cleared: [],
      failed: [...LOCAL_PRODUCT_STORAGE_KEYS],
    };
  }

  const cleared = [];
  const failed = [];
  for (const key of LOCAL_PRODUCT_STORAGE_KEYS) {
    try {
      target.removeItem(key);
      cleared.push(key);
    } catch {
      failed.push(key);
    }
  }

  return { cleared, failed };
}
