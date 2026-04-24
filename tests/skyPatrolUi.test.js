import test from "node:test";
import assert from "node:assert/strict";

import {
  getSkyPatrolFireCooldownUi,
  getSkyPatrolGameOverUi,
  getSkyPatrolHudItems,
  getSkyPatrolIncomingIndicators,
  getSkyPatrolLegendUi,
  getSkyPatrolLifeIcons,
  getSkyPatrolTargetHealthPips,
  getSkyPatrolThreatUi,
} from "../src/skyPatrolUi.js";

test("getSkyPatrolHudItems builds tactical HUD chips", () => {
  const items = getSkyPatrolHudItems({
    score: 480,
    lives: 2,
    airTargetCount: 1,
    groundTargetCount: 2,
    fireReady: true,
  });

  assert.deepEqual(
    items.map((item) => item.id),
    ["score", "lives", "air", "ground", "fire"],
  );
  assert.deepEqual(
    items.map((item) => item.value),
    [480, 2, 1, 2, "Ready"],
  );
});

test("getSkyPatrolFireCooldownUi exposes fire reload progress", () => {
  assert.deepEqual(getSkyPatrolFireCooldownUi({ fireCooldownMs: 65 }), {
    ready: false,
    progress: 0.5,
  });
  assert.deepEqual(getSkyPatrolFireCooldownUi({ fireCooldownMs: 0 }), {
    ready: true,
    progress: 1,
  });
});

test("getSkyPatrolIncomingIndicators points to threats entering from offscreen", () => {
  const indicators = getSkyPatrolIncomingIndicators({
    layout: { width: 960, height: 720 },
    airEnemies: [
      { id: "fighter-1", kind: "fighter", x: 320, y: -20, width: 48, height: 52 },
      { id: "fighter-2", kind: "fighter", x: 520, y: 160, width: 48, height: 52 },
    ],
    groundTargets: [{ id: "turret-1", kind: "turret", x: 680, y: -18, width: 32, height: 32 }],
  });

  assert.deepEqual(
    indicators.map((indicator) => indicator.id),
    ["fighter-1", "turret-1"],
  );
  assert.equal(indicators[0].edge, "top");
  assert.equal(indicators[0].x, 320);
});

test("getSkyPatrolThreatUi distinguishes air and ground threat language", () => {
  assert.equal(getSkyPatrolThreatUi({ kind: "fighter" }).shape, "air-chevron");
  assert.equal(getSkyPatrolThreatUi({ kind: "turret" }).shape, "ground-emplacement");
  assert.equal(getSkyPatrolThreatUi({ kind: "depot" }).shape, "ground-depot");
});

test("getSkyPatrolTargetHealthPips exposes remaining hit points", () => {
  assert.deepEqual(getSkyPatrolTargetHealthPips({ hp: 2, maxHp: 4 }), [
    "filled",
    "filled",
    "empty",
    "empty",
  ]);
  assert.deepEqual(getSkyPatrolTargetHealthPips({ kind: "fighter", hp: 1 }), [
    "filled",
    "empty",
  ]);
});

test("getSkyPatrolLifeIcons turns lives into squadron icons", () => {
  assert.deepEqual(getSkyPatrolLifeIcons(2, 3), ["active", "active", "lost"]);
});

test("getSkyPatrolGameOverUi summarizes the sortie and restart cue", () => {
  const ui = getSkyPatrolGameOverUi({
    status: "gameover",
    score: 720,
    targetsDestroyed: 4,
  });

  assert.equal(ui.visible, true);
  assert.equal(ui.title, "Squadron down");
  assert.deepEqual(ui.stats, [
    { label: "Score", value: 720 },
    { label: "Targets", value: 4 },
  ]);
  assert.equal(ui.restartText, "Hold Restart Sortie");
});

test("getSkyPatrolLegendUi compresses and fades the training legend after launch", () => {
  const openingLegend = getSkyPatrolLegendUi({ status: "playing", elapsedMs: 1200 });

  assert.equal(openingLegend.visible, true);
  assert.equal(openingLegend.compact, true);
  assert.equal(openingLegend.faded, false);
  assert.deepEqual(
    openingLegend.items.map((item) => item.id),
    ["fighter", "turret", "depot", "fire"],
  );

  const lateLegend = getSkyPatrolLegendUi({ status: "playing", elapsedMs: 7600 });

  assert.equal(lateLegend.visible, true);
  assert.equal(lateLegend.faded, true);
});
