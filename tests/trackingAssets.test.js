import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  MEDIAPIPE_HANDS_ASSET_NAMES,
  MEDIAPIPE_HANDS_SOLUTION_PATH,
} from "../src/trackingAssetConfig.js";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);

test("MediaPipe hands uses a same-origin solution path with a complete local asset set", () => {
  assert.equal(MEDIAPIPE_HANDS_SOLUTION_PATH, "/vendor/mediapipe/hands");
  assert.ok(MEDIAPIPE_HANDS_ASSET_NAMES.includes("hands.js"));
  assert.ok(MEDIAPIPE_HANDS_ASSET_NAMES.some((name) => name.endsWith(".wasm")));
  assert.ok(MEDIAPIPE_HANDS_ASSET_NAMES.some((name) => name.endsWith(".tflite")));

  for (const fileName of MEDIAPIPE_HANDS_ASSET_NAMES) {
    assert.equal(
      existsSync(path.join(projectRoot, "node_modules/@mediapipe/hands", fileName)),
      true,
      `${fileName} should be available from the pinned dependency`,
    );
  }
});

test("the application no longer configures a third-party MediaPipe CDN", () => {
  const handTrackingSource = readFileSync(
    path.join(projectRoot, "src/handTracking.js"),
    "utf8",
  );
  assert.equal(handTrackingSource.includes("cdn.jsdelivr.net"), false);
  assert.match(handTrackingSource, /MEDIAPIPE_HANDS_SOLUTION_PATH/);
});
