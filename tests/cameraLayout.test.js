import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldShowInlineCameraPreview,
  shouldUseContainedCameraFit,
  shouldUseImmersiveAppLayout,
} from "../src/cameraLayout.js";

test("shouldUseImmersiveAppLayout gives Minority Report the same chrome-free shell as fullscreen camera", () => {
  assert.equal(shouldUseImmersiveAppLayout("FULLSCREEN_CAMERA"), true);
  assert.equal(shouldUseImmersiveAppLayout("MINORITY_REPORT_LAB"), true);
  assert.equal(shouldUseImmersiveAppLayout("CALIBRATION"), false);
});

test("shouldUseContainedCameraFit keeps the full webcam visible for fullscreen and Minority Report", () => {
  assert.equal(shouldUseContainedCameraFit("FULLSCREEN_CAMERA"), true);
  assert.equal(shouldUseContainedCameraFit("MINORITY_REPORT_LAB"), true);
  assert.equal(shouldUseContainedCameraFit("CALIBRATION"), false);
});

test("shouldShowInlineCameraPreview hides the left-pane preview during Minority Report", () => {
  assert.equal(shouldShowInlineCameraPreview("MINORITY_REPORT_LAB"), false);
  assert.equal(shouldShowInlineCameraPreview("FULLSCREEN_CAMERA"), true);
  assert.equal(shouldShowInlineCameraPreview("CALIBRATION"), true);
});
