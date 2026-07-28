import assert from "node:assert/strict";
import test from "node:test";

import { CIRCLE_OF_FIFTHS_SEGMENTS } from "../src/circleOfFifths.js";
import {
  createJamSoundSignature,
  getJamAllowedSegmentIds,
  getJamArpeggioNoteIndex,
  getJamArpeggioStepDurationMs,
  getJamChordTimbre,
  getJamDrumMixScale,
  getJamProgression,
  getJamScaleSegments,
  resolveJamKeyLockedSegment,
} from "../src/circleOfFifthsStudio.js";

test("key constraints return the playable triads represented by the wheel", () => {
  assert.deepEqual(
    getJamScaleSegments("C", "major").map((segment) => segment.label),
    ["C", "Dm", "Em", "F", "G", "Am"],
  );
  assert.deepEqual(
    getJamScaleSegments("A", "minor").map((segment) => segment.label),
    ["Am", "C", "Dm", "Em", "F", "G"],
  );
  assert.equal(getJamAllowedSegmentIds("C", "major").length, 6);
});

test("key lock admits in-scale segments and rejects other wheel segments", () => {
  const cMajor = CIRCLE_OF_FIFTHS_SEGMENTS.find((segment) => segment.id === "outer-C-major");
  const aMajor = CIRCLE_OF_FIFTHS_SEGMENTS.find((segment) => segment.id === "outer-A-major");

  assert.equal(
    resolveJamKeyLockedSegment(cMajor, {
      enabled: true,
      keyId: "C",
      scaleId: "major",
    }),
    cMajor,
  );
  assert.equal(
    resolveJamKeyLockedSegment(aMajor, {
      enabled: true,
      keyId: "C",
      scaleId: "major",
    }),
    null,
  );
  assert.equal(resolveJamKeyLockedSegment(aMajor, { enabled: false }), aMajor);
});

test("progression presets transpose into practical wheel chords", () => {
  assert.deepEqual(
    getJamProgression("pop-lift", "D").map(({ roman, segment }) => [
      roman,
      segment.label,
    ]),
    [
      ["I", "D"],
      ["V", "A"],
      ["vi", "Bm"],
      ["IV", "G"],
    ],
  );
  assert.deepEqual(
    getJamProgression("afterglow", "A").map(({ segment }) => segment.label),
    ["Am", "F", "C", "G"],
  );
});

test("arpeggio timing and note order are deterministic", () => {
  assert.equal(getJamArpeggioStepDurationMs(120, "off"), 0);
  assert.equal(getJamArpeggioStepDurationMs(120, "up"), 250);
  assert.equal(getJamArpeggioStepDurationMs(0, "up"), 750);
  assert.deepEqual(
    Array.from({ length: 8 }, (_, step) => getJamArpeggioNoteIndex(step, 4, "up")),
    [0, 1, 2, 3, 0, 1, 2, 3],
  );
  assert.deepEqual(
    Array.from({ length: 8 }, (_, step) => getJamArpeggioNoteIndex(step, 4, "bounce")),
    [0, 1, 2, 3, 2, 1, 0, 1],
  );
});

test("drum mix respects volume bounds and per-instrument mutes", () => {
  assert.equal(getJamDrumMixScale("kick", 75), 0.75);
  assert.equal(getJamDrumMixScale("hat", 140), 1);
  assert.equal(getJamDrumMixScale("snare", -10), 0);
  assert.equal(getJamDrumMixScale("kick", 75, { kick: true }), 0);
  assert.equal(getJamDrumMixScale("cowbell", 75), 0);
});

test("sound selection falls back safely and produces stable restart signatures", () => {
  assert.equal(getJamChordTimbre("missing").id, "warm-pad");
  assert.equal(
    createJamSoundSignature({
      timbreId: "glass-keys",
      arpeggioMode: "bounce",
      bpm: 111.6,
    }),
    "glass-keys:bounce:112",
  );
});
