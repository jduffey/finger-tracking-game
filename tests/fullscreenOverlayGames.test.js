import test from "node:test";
import assert from "node:assert/strict";
import { runFullscreenOverlayGameUpdates } from "../src/fullscreenOverlayGames.js";

test("runFullscreenOverlayGameUpdates dispatches both fullscreen game loops once", () => {
  const calls = [];
  const timestamp = 1234;

  runFullscreenOverlayGameUpdates(timestamp, {
    updateFullscreenBreakoutSimulation(nextTimestamp) {
      calls.push(["breakout", nextTimestamp]);
    },
    updateFullscreenFlappySimulation(nextTimestamp) {
      calls.push(["flappy", nextTimestamp]);
    },
  });

  assert.deepEqual(calls, [
    ["breakout", timestamp],
    ["flappy", timestamp],
  ]);
});

test("runFullscreenOverlayGameUpdates ignores missing game updaters", () => {
  assert.doesNotThrow(() => {
    runFullscreenOverlayGameUpdates(1234, {
      updateFullscreenFlappySimulation() {},
    });
  });
});
