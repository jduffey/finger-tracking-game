import test from "node:test";
import assert from "node:assert/strict";

import { getVerifiedFullscreenHandPointerInput } from "../src/fullscreenHandPointer.js";

test("fullscreen hold controls use the first hand with a usable index tip", () => {
  const firstUsableHand = {
    id: "first-usable",
    fingerTips: {
      thumb: { u: 0.1, v: 0.1 },
      index: { u: 0.2, v: 0.2 },
    },
  };
  const secondUsableHand = {
    id: "second-usable",
    fingerTips: {
      index: { u: 0.7, v: 0.4 },
    },
  };

  const input = getVerifiedFullscreenHandPointerInput(
    [firstUsableHand, secondUsableHand],
    { left: 100, top: 40, width: 800, height: 600 },
    (point) => ({
      x: point.u * 800 + 100,
      y: point.v * 600 + 40,
    }),
  );

  assert.deepEqual(input, {
    handVerified: true,
    pointerActive: true,
    pointerX: 160,
    pointerY: 120,
  });
});

test("fullscreen hold controls stay inactive without a usable index tip", () => {
  const input = getVerifiedFullscreenHandPointerInput(
    [{ id: "partial", fingerTips: { thumb: { u: 0.1, v: 0.1 } } }],
    { left: 0, top: 0, width: 800, height: 600 },
    () => ({ x: 200, y: 200 }),
  );

  assert.deepEqual(input, {
    handVerified: false,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
  });
});
