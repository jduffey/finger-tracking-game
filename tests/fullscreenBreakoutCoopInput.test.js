import test from "node:test";
import assert from "node:assert/strict";
import { selectBreakoutCoopSupportHand } from "../src/fullscreenBreakoutCoopInput.js";

test("selectBreakoutCoopSupportHand follows the tracked primary hand role", () => {
  const leftHand = { id: "Left", label: "Left", pinchDistance: 0.03 };
  const rightHand = { id: "Right", label: "Right", pinchDistance: 0.04 };

  assert.equal(
    selectBreakoutCoopSupportHand([leftHand, rightHand], rightHand.id),
    leftHand,
  );
});

test("selectBreakoutCoopSupportHand returns null when only the primary hand is visible", () => {
  const rightHand = { id: "Right", label: "Right", pinchDistance: 0.04 };

  assert.equal(selectBreakoutCoopSupportHand([rightHand], rightHand.id), null);
});
