import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("App routes comfort preferences into tracking and menu behavior", () => {
  const app = readSource("src/App.jsx");

  assert.match(
    app,
    /selectPreferredHand\([\s\S]*?preferencesRef\.current\.dominantHand/,
  );
  assert.match(
    app,
    /adaptHandsForCamera\([\s\S]*?preferencesRef\.current\.mirrorCamera/,
  );
  assert.match(
    app,
    /expandPointerRangeForSeatedPlay\([\s\S]*?preferencesRef\.current\.seatedMode/,
  );
  assert.match(
    app,
    /getCursorSmoothingAlpha\([\s\S]*?preferencesRef\.current\.cursorSmoothing/,
  );
  assert.match(
    app,
    /getPinchThresholds\([\s\S]*?preferencesRef\.current\.pinchThreshold/,
  );
  assert.match(
    app,
    /holdDurationMs: preferencesRef\.current\.dwellDurationMs/,
  );
  assert.match(
    app,
    /preview-\$\{preferences\.cameraPreview\}/,
  );
});

test("gesture and standalone music tracking share the global pinch and camera preferences", () => {
  const gestureEngine = readSource("src/gestures/gestureEngine.js");
  const circlePage = readSource("src/CircleOfFifthsPage.jsx");
  const circleEntry = readSource("src/circleOfFifthsMain.jsx");

  assert.match(
    gestureEngine,
    /getPinchThresholds\(updateInput\?\.pinchThreshold\)/,
  );
  assert.match(circlePage, /loadUserPreferences\(\)/);
  assert.match(circlePage, /adaptHandsForCamera\(/);
  assert.match(circlePage, /selectPreferredHand\(/);
  assert.match(circlePage, /expandPointerRangeForSeatedPlay\(/);
  assert.match(circlePage, /getCursorSmoothingAlpha\(/);
  assert.match(circlePage, /getPinchThresholds\(pinchThreshold\)/);
  assert.match(
    circleEntry,
    /applyPreferenceDocumentState\(loadUserPreferences\(\)\)/,
  );
});

test("document preference state drives real interface, cursor, and camera styles", () => {
  const preferences = readSource("src/userPreferences.js");
  const styles = readSource("src/styles.css");

  assert.match(preferences, /root\.dataset\.mirrorCamera/);
  assert.match(preferences, /--user-font-size/);
  assert.match(preferences, /--user-cursor-size/);
  assert.match(styles, /font-size: var\(--user-font-size, 16px\)/);
  assert.match(styles, /var\(--user-cursor-size, 22px\)/);
  assert.match(
    styles,
    /html\[data-mirror-camera="false"\] \.camera-video/,
  );
  assert.match(styles, /\.camera-preview-panel\.preview-hidden/);
  assert.match(styles, /\.content-grid\.camera-preview-expanded/);
});
