import test from "node:test";
import assert from "node:assert/strict";

import { createMissileCommandGame } from "../src/missileCommandGame.js";
import {
  getMissileCommandCooldownUi,
  getMissileCommandCrosshairUi,
  getMissileCommandExplosionUi,
  getMissileCommandLegendItems,
  getMissileCommandLaunchPreview,
  getMissileCommandStructureUi,
  getMissileCommandTargetWarnings,
  getMissileCommandThreatUi,
  getMissileCommandTacticalMetrics,
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

test("getMissileCommandTargetWarnings marks structures currently under attack", () => {
  const game = createPlayingMissileCommandGame();
  const target = game.structures[0];
  const warnings = getMissileCommandTargetWarnings({
    ...game,
    threats: [
      {
        id: "threat-1",
        startX: 480,
        startY: 0,
        x: target.x,
        y: target.y - target.height * 2,
        targetX: target.x,
        targetY: target.y - target.height * 0.48,
        targetStructureId: target.id,
      },
    ],
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].structureId, target.id);
  assert.equal(warnings[0].threatCount, 1);
  assert.equal(warnings[0].x, target.x);
  assert.equal(warnings[0].className.includes("target-warning"), true);
});

test("getMissileCommandStructureUi exposes rubble affordances for destroyed structures", () => {
  const game = createPlayingMissileCommandGame();
  const destroyed = { ...game.structures[0], alive: false };
  const ui = getMissileCommandStructureUi(destroyed, {
    selectedLaunchBaseId: destroyed.id,
  });

  assert.equal(ui.className.includes("destroyed"), true);
  assert.equal(ui.className.includes("rubble"), true);
  assert.equal(ui.fragments.length >= 3, true);
  assert.equal(ui.showSmoke, true);
});

test("getMissileCommandCrosshairUi names the current fire-control state", () => {
  const ready = createPlayingMissileCommandGame();
  assert.equal(getMissileCommandCrosshairUi(ready, { x: 200, y: 200 }, true).state, "ready");
  assert.equal(
    getMissileCommandCrosshairUi({ ...ready, cooldownMs: 90 }, { x: 200, y: 200 }, true).state,
    "cooling",
  );
  assert.equal(getMissileCommandCrosshairUi(ready, null, false).state, "no-hand");
  assert.equal(
    getMissileCommandCrosshairUi(
      {
        ...ready,
        structures: ready.structures.map((structure) =>
          structure.type === "base" ? { ...structure, alive: false } : structure,
        ),
      },
      { x: 200, y: 200 },
      true,
    ).state,
    "no-bases",
  );
});

test("getMissileCommandThreatUi escalates urgency as threats near impact", () => {
  const baseThreat = {
    startX: 100,
    startY: 0,
    targetX: 100,
    targetY: 600,
    x: 100,
  };

  assert.equal(getMissileCommandThreatUi({ ...baseThreat, y: 180 }).urgency, "distant");
  assert.equal(getMissileCommandThreatUi({ ...baseThreat, y: 420 }).urgency, "urgent");
  assert.equal(getMissileCommandThreatUi({ ...baseThreat, y: 540 }).urgency, "critical");
});

test("getMissileCommandLegendItems keeps the legend compact", () => {
  const items = getMissileCommandLegendItems(125);

  assert.deepEqual(
    items.map((item) => item.id),
    ["threat-score", "pinch-fire"],
  );
  assert.equal(items.every((item) => item.label.length <= 8), true);
});

test("getMissileCommandTacticalMetrics exposes incoming, base, city, and pressure counts", () => {
  const game = createPlayingMissileCommandGame();
  const metrics = getMissileCommandTacticalMetrics({
    ...game,
    threats: [{ id: "threat-1" }, { id: "threat-2" }, { id: "threat-3" }],
  });

  assert.equal(metrics.incoming, 3);
  assert.equal(metrics.bases, 2);
  assert.equal(metrics.cities, 3);
  assert.equal(metrics.pressure, "elevated");
  assert.deepEqual(
    metrics.items.map((item) => item.id),
    ["score", "intercepts", "incoming", "bases", "cities", "pressure"],
  );
});

test("getMissileCommandExplosionUi splits blasts into core and shockwave layers", () => {
  const ui = getMissileCommandExplosionUi({
    kind: "interceptor",
    ageMs: 320,
    durationMs: 960,
    color: "rgba(255, 233, 122, 0.82)",
  });

  assert.equal(ui.className.includes("interceptor"), true);
  assert.equal(ui.coreOpacity > 0, true);
  assert.equal(ui.shockwaveOpacity > 0, true);
});
