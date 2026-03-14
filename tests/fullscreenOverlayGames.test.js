import test from "node:test";
import assert from "node:assert/strict";
import { runFullscreenOverlayGameUpdates } from "../src/fullscreenOverlayGames.js";

test("runFullscreenOverlayGameUpdates dispatches fullscreen game loops once", () => {
  const calls = [];
  const timestamp = 1234;

  runFullscreenOverlayGameUpdates(timestamp, {
    updateFullscreenBreakoutSimulation(nextTimestamp) {
      calls.push(["breakout", nextTimestamp]);
    },
    updateFullscreenBreakoutCoopSimulation(nextTimestamp) {
      calls.push(["breakout-coop", nextTimestamp]);
    },
    updateFullscreenInvadersSimulation(nextTimestamp) {
      calls.push(["invaders", nextTimestamp]);
    },
    updateFullscreenFlappySimulation(nextTimestamp) {
      calls.push(["flappy", nextTimestamp]);
    },
    updateFullscreenMissileCommandSimulation(nextTimestamp) {
      calls.push(["missile-command", nextTimestamp]);
    },
  });

  assert.deepEqual(calls, [
    ["breakout", timestamp],
    ["breakout-coop", timestamp],
    ["invaders", timestamp],
    ["flappy", timestamp],
    ["missile-command", timestamp],
  ]);
});

test("runFullscreenOverlayGameUpdates ignores missing game updaters", () => {
  assert.doesNotThrow(() => {
    runFullscreenOverlayGameUpdates(1234, {
      updateFullscreenFlappySimulation() {},
    });
  });
});
