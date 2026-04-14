import test from "node:test";
import assert from "node:assert/strict";
import { runFullscreenOverlayGameUpdates } from "../src/fullscreenOverlayGames.js";

test("runFullscreenOverlayGameUpdates dispatches fullscreen game loops once", () => {
  const calls = [];
  const timestamp = 1234;

  runFullscreenOverlayGameUpdates(timestamp, {
    updateFullscreenHandBounceSimulation(nextTimestamp) {
      calls.push(["hand-bounce", nextTimestamp]);
    },
    updateFullscreenBrickDodgerSimulation(nextTimestamp) {
      calls.push(["brick-dodger", nextTimestamp]);
    },
    updateFullscreenBreakoutSimulation(nextTimestamp) {
      calls.push(["breakout", nextTimestamp]);
    },
    updateFullscreenBreakoutCoopSimulation(nextTimestamp) {
      calls.push(["breakout-coop", nextTimestamp]);
    },
    updateFullscreenFingerPongSimulation(nextTimestamp) {
      calls.push(["finger-pong", nextTimestamp]);
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
    ["hand-bounce", timestamp],
    ["brick-dodger", timestamp],
    ["breakout", timestamp],
    ["breakout-coop", timestamp],
    ["finger-pong", timestamp],
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
