import test from "node:test";
import assert from "node:assert/strict";

import { createMissileCommandGame } from "../src/missileCommandGame.js";
import {
  getMissileCommandCooldownUi,
  getMissileCommandLaunchPreview,
} from "../src/missileCommandUi.js";

function createPlayingMissileCommandGame() {
  return {
    ...createMissileCommandGame(960, 720),
    status: "playing",
    countdownMs: 0,
  };
}

test("getMissileCommandLaunchPreview selects the nearest surviving base", () => {
  const game = createPlayingMissileCommandGame();
  const preview = getMissileCommandLaunchPreview(game, { x: 760, y: 220 });

  assert.equal(preview.originStructureId, "structure-4");
  assert.equal(preview.originX, game.structures[3].x);
  assert.equal(preview.targetX, 760);
  assert.equal(preview.targetY, 220);
  assert.ok(preview.distance > 0);
  assert.equal(Number.isFinite(preview.angleRad), true);
});

test("getMissileCommandLaunchPreview hides when no base can fire", () => {
  const game = {
    ...createPlayingMissileCommandGame(),
    structures: createPlayingMissileCommandGame().structures.map((structure) =>
      structure.type === "base" ? { ...structure, alive: false } : structure,
    ),
  };

  assert.equal(getMissileCommandLaunchPreview(game, { x: 760, y: 220 }), null);
});

test("getMissileCommandCooldownUi exposes reload progress for the crosshair", () => {
  const cooling = {
    ...createPlayingMissileCommandGame(),
    cooldownMs: 90,
  };

  assert.deepEqual(getMissileCommandCooldownUi(cooling), {
    isCoolingDown: true,
    reloadProgress: 0.5,
  });
  assert.deepEqual(getMissileCommandCooldownUi({ ...cooling, cooldownMs: 0 }), {
    isCoolingDown: false,
    reloadProgress: 1,
  });
});
