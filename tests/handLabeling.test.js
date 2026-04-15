import test from "node:test";
import assert from "node:assert/strict";
import { assignStableHandLabels } from "../src/handLabeling.js";

function createHand({ x, y = 0.5, handedness = null, score = 0.95 }) {
  const landmarks = Array.from({ length: 21 }, () => null);
  landmarks[0] = { u: x, v: y };
  return {
    score,
    handedness,
    indexTip: { u: x + 0.01, v: y - 0.01 },
    thumbTip: { u: x - 0.02, v: y + 0.01 },
    landmarks,
  };
}

test("single visible hand keeps its recent label through a noisy opposite hint", () => {
  const memory = { byLabel: {} };

  const firstFrame = assignStableHandLabels(
    [createHand({ x: 0.76, y: 0.52, handedness: "Right" })],
    { memory, timestamp: 1000 },
  );
  assert.equal(firstFrame[0].label, "Right");

  memory.byLabel.Left = {
    x: 0.76,
    y: 0.52,
    timestamp: 1000,
  };

  const noisyFrame = assignStableHandLabels(
    [createHand({ x: 0.75, y: 0.51, handedness: "Left" })],
    { memory, timestamp: 1100 },
  );
  assert.equal(noisyFrame[0].label, "Right");
});

test("single visible hand can switch labels when the evidence moves strongly to the other side", () => {
  const memory = { byLabel: {} };

  assignStableHandLabels(
    [createHand({ x: 0.74, y: 0.5, handedness: "Right" })],
    { memory, timestamp: 1000 },
  );

  const switchedFrame = assignStableHandLabels(
    [createHand({ x: 0.22, y: 0.5, handedness: "Left" })],
    { memory, timestamp: 1250 },
  );
  assert.equal(switchedFrame[0].label, "Left");
});

test("single visible hand can complete a gradual crossover without getting stuck", () => {
  const memory = { byLabel: {} };

  assignStableHandLabels(
    [createHand({ x: 0.74, y: 0.5, handedness: "Right" })],
    { memory, timestamp: 1000 },
  );

  const positions = [0.68, 0.62, 0.56, 0.5, 0.44, 0.38, 0.32, 0.26, 0.26, 0.26, 0.26, 0.26];
  let labeled = null;

  for (const [index, x] of positions.entries()) {
    labeled = assignStableHandLabels(
      [createHand({ x, y: 0.5, handedness: x < 0.5 ? "Left" : "Right" })],
      { memory, timestamp: 1120 + index * 120 },
    );
  }

  assert.equal(labeled?.[0]?.label, "Left");
});

test("two visible hands still resolve into distinct left and right labels", () => {
  const memory = { byLabel: {} };
  const labeled = assignStableHandLabels(
    [
      createHand({ x: 0.72, y: 0.5, handedness: "Right" }),
      createHand({ x: 0.28, y: 0.5, handedness: "Left" }),
    ],
    { memory, timestamp: 1000 },
  );

  assert.deepEqual(
    labeled.map((hand) => hand.label),
    ["Left", "Right"],
  );
});
