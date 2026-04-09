import test from "node:test";
import assert from "node:assert/strict";
import {
  DRUM_BPM_MAX,
  DRUM_BPM_MIN,
  clampDrumBpm,
  getDrumBeatPreset,
  getDrumBpmFromSliderPosition,
  getSliderRatioFromDrumBpm,
} from "../src/circleOfFifthsDrums.js";

test("clampDrumBpm keeps values inside the supported tempo range", () => {
  assert.equal(clampDrumBpm(DRUM_BPM_MIN - 40), DRUM_BPM_MIN);
  assert.equal(clampDrumBpm(DRUM_BPM_MAX + 40), DRUM_BPM_MAX);
  assert.equal(clampDrumBpm(112.4), 112);
});

test("getDrumBpmFromSliderPosition maps the slider span into bpm values", () => {
  const rect = { left: 100, width: 300 };

  assert.equal(getDrumBpmFromSliderPosition(100, rect), DRUM_BPM_MIN);
  assert.equal(getDrumBpmFromSliderPosition(400, rect), DRUM_BPM_MAX);
  assert.equal(getDrumBpmFromSliderPosition(250, rect), 115);
});

test("getSliderRatioFromDrumBpm normalizes tempo into slider progress", () => {
  assert.equal(getSliderRatioFromDrumBpm(DRUM_BPM_MIN), 0);
  assert.equal(getSliderRatioFromDrumBpm(DRUM_BPM_MAX), 1);
  assert.equal(Number(getSliderRatioFromDrumBpm(115).toFixed(2)), 0.5);
});

test("getDrumBeatPreset falls back to the first preset for unknown ids", () => {
  assert.equal(getDrumBeatPreset("night-drive").label, "Night Drive");
  assert.equal(getDrumBeatPreset("missing").label, "Motorik");
});
