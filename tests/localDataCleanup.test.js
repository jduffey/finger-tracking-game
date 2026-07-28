import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCAL_PRODUCT_STORAGE_KEYS,
  clearLocalProductStorage,
} from "../src/localDataCleanup.js";

test("local-data cleanup owns every durable product save family", () => {
  assert.deepEqual(
    new Set(LOCAL_PRODUCT_STORAGE_KEYS),
    new Set([
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
    ]),
  );
});

test("local-data cleanup continues after an individual storage failure", () => {
  const removed = [];
  const result = clearLocalProductStorage({
    removeItem(key) {
      if (key === "motionArcade.arcadeRun") {
        throw new Error("blocked");
      }
      removed.push(key);
    },
  });

  assert.deepEqual(result.failed, ["motionArcade.arcadeRun"]);
  assert.equal(result.cleared.length, LOCAL_PRODUCT_STORAGE_KEYS.length - 1);
  assert.equal(removed.includes("motionArcade.jamStudio.loop.v1"), true);
  assert.equal(
    removed.includes("motion_arcade_gesture_analytics_v1"),
    true,
  );
});

test("local-data cleanup reports unavailable storage without throwing", () => {
  assert.deepEqual(clearLocalProductStorage(null), {
    cleared: [],
    failed: [...LOCAL_PRODUCT_STORAGE_KEYS],
  });
});
