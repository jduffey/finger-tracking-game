import test from "node:test";
import assert from "node:assert/strict";
import { pickDistinctRandomChoice } from "../src/gameLogic.js";

test("pickDistinctRandomChoice excludes the requested value when alternatives exist", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    assert.equal(
      pickDistinctRandomChoice(["swipe-left", "swipe-right", "expand"], "swipe-left"),
      "swipe-right",
    );
  } finally {
    Math.random = originalRandom;
  }
});

test("pickDistinctRandomChoice falls back to the full pool when no distinct option exists", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    assert.equal(pickDistinctRandomChoice(["swipe-left"], "swipe-left"), "swipe-left");
  } finally {
    Math.random = originalRandom;
  }
});
