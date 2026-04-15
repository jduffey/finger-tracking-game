import test from "node:test";
import assert from "node:assert/strict";

import { areSkyPatrolHudStatesEqual, getSkyPatrolHudState } from "../src/skyPatrolCanvas.js";
import { createSkyPatrolGame } from "../src/skyPatrolGame.js";

test("getSkyPatrolHudState summarizes the visible Sky Patrol HUD values", () => {
  const game = {
    ...createSkyPatrolGame(960, 720),
    score: 480,
    lives: 2,
    status: "gameover",
    message: "Squadron down. Pinch to relaunch.",
    airEnemies: [{ id: "fighter-1" }],
    groundTargets: [{ id: "turret-1" }, { id: "depot-1" }],
  };

  assert.deepEqual(getSkyPatrolHudState(game), {
    score: 480,
    lives: 2,
    activeTargetCount: 3,
    status: "gameover",
    message: "Squadron down. Pinch to relaunch.",
  });
});

test("areSkyPatrolHudStatesEqual only changes when the rendered HUD changes", () => {
  const hud = {
    score: 100,
    lives: 3,
    activeTargetCount: 4,
    status: "playing",
    message: "Pinch to fire twin cannons.",
  };

  assert.equal(areSkyPatrolHudStatesEqual(hud, { ...hud }), true);
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      activeTargetCount: 5,
    }),
    false,
  );
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      message: "Direct hit. Regroup and re-engage.",
    }),
    false,
  );
});
