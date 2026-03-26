import test from "node:test";
import assert from "node:assert/strict";
import {
  createCircleOfFifthsLayout,
  getChordFrequencies,
  getSegmentAtPoint,
} from "../src/circleOfFifths.js";

test("getSegmentAtPoint resolves the top outer slice to C major", () => {
  const layout = createCircleOfFifthsLayout(1200, 900);
  const segment = getSegmentAtPoint(
    {
      x: layout.centerX,
      y: layout.centerY - (layout.outerRadius + layout.outerRingInnerRadius) / 2,
    },
    layout,
  );

  assert.equal(segment?.note, "C");
  assert.equal(segment?.quality, "major");
});

test("getSegmentAtPoint resolves the top inner slice to A minor", () => {
  const layout = createCircleOfFifthsLayout(1200, 900);
  const segment = getSegmentAtPoint(
    {
      x: layout.centerX,
      y: layout.centerY - (layout.innerRingOuterRadius + layout.innerRingInnerRadius) / 2,
    },
    layout,
  );

  assert.equal(segment?.note, "A");
  assert.equal(segment?.quality, "minor");
});

test("getSegmentAtPoint returns null for the silent center", () => {
  const layout = createCircleOfFifthsLayout(1200, 900);

  assert.equal(
    getSegmentAtPoint(
      {
        x: layout.centerX,
        y: layout.centerY,
      },
      layout,
    ),
    null,
  );
});

test("getChordFrequencies returns a major stack for C major", () => {
  const frequencies = getChordFrequencies({
    note: "C",
    quality: "major",
  });

  assert.equal(frequencies.length, 4);
  assert.deepEqual(
    frequencies.map((frequency) => Number(frequency.toFixed(2))),
    [261.63, 329.63, 392, 523.25],
  );
});

test("getChordFrequencies returns a minor stack for A minor", () => {
  const frequencies = getChordFrequencies({
    note: "A",
    quality: "minor",
  });

  assert.equal(frequencies.length, 4);
  assert.deepEqual(
    frequencies.map((frequency) => Number(frequency.toFixed(2))),
    [220, 261.63, 329.63, 440],
  );
});
