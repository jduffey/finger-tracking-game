import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getCurrentBackend,
  getCurrentRuntime,
  getLastDetectionMeta,
  getLastPoseMeta,
  getPoseRuntime,
  getTrackingRuntimeLoadState,
} from "../src/trackingRuntimeLoader.js";

test("tracking runtimes stay idle until a tracking action requests them", () => {
  assert.deepEqual(getTrackingRuntimeLoadState(), { hand: "idle", pose: "idle" });
  assert.equal(getCurrentBackend(), "n/a");
  assert.equal(getCurrentRuntime(), null);
  assert.equal(getPoseRuntime(), null);
  assert.equal(getLastDetectionMeta().reason, "runtime_not_loaded");
  assert.equal(getLastPoseMeta().reason, "runtime_not_loaded");
});

test("app entry points import the lightweight tracking loader instead of detector bundles", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const circleSource = readFileSync(
    new URL("../src/CircleOfFifthsPage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(appSource, /from "\.\/trackingRuntimeLoader\.js"/);
  assert.match(circleSource, /from "\.\/trackingRuntimeLoader\.js"/);
  assert.equal(appSource.includes('from "./handTracking.js"'), false);
  assert.equal(appSource.includes('from "./poseTracking.js"'), false);
  assert.equal(circleSource.includes('from "./handTracking.js"'), false);
});
