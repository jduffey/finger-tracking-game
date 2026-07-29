import test from "node:test";
import assert from "node:assert/strict";

import {
  getSkyPatrolFireCooldownUi,
  getSkyPatrolGameOverUi,
  getSkyPatrolGunCooldownUi,
  getSkyPatrolGroundSiteUi,
  getSkyPatrolHudItems,
  getSkyPatrolIncomingIndicators,
  getSkyPatrolLegendUi,
  getSkyPatrolLifeIcons,
  getSkyPatrolCheckpointUi,
  getSkyPatrolComboUi,
  getSkyPatrolMissionUi,
  getSkyPatrolOnboardingUi,
  getSkyPatrolPowerUpUi,
  getSkyPatrolRadarBlips,
  getSkyPatrolDepthCue,
  getSkyPatrolProjectileUi,
  getSkyPatrolStartPromptUi,
  getSkyPatrolTargetHealthPips,
  getSkyPatrolTelegraphUi,
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

test("Sky Patrol UI helpers tolerate a missing HUD before the mode starts", () => {
  assert.deepEqual(
    getSkyPatrolHudItems(null).map((item) => item.value),
    [0, 0, 0, 0, "Reload"],
  );
  assert.deepEqual(getSkyPatrolFireCooldownUi(null), {
    ready: true,
    progress: 1,
  });
  assert.equal(getSkyPatrolGameOverUi(null).visible, false);
  assert.equal(getSkyPatrolLegendUi(null).visible, true);
  assert.equal(getSkyPatrolStartPromptUi(null).visible, false);
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

test("getSkyPatrolGunCooldownUi describes the vertical gun charge bar", () => {
  assert.deepEqual(getSkyPatrolGunCooldownUi({ gunStatus: "ready", gunCharge: 0.62 }), {
    fill: 0.62,
    state: "ready",
    stateLabel: "Guns ready",
    cooldownLabel: "",
    cooling: false,
  });
  assert.deepEqual(getSkyPatrolGunCooldownUi({ gunStatus: "cooldown", gunCharge: 0, gunCooldownMs: 1450 }), {
    fill: 0,
    state: "cooldown",
    stateLabel: "Cooling",
    cooldownLabel: "1.5s",
    cooling: true,
  });
  assert.deepEqual(getSkyPatrolGunCooldownUi({ gunStatus: "recharging", gunCharge: 0.5 }), {
    fill: 0.5,
    state: "recharging",
    stateLabel: "Recharging",
    cooldownLabel: "",
    cooling: false,
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

  const missionLegend = getSkyPatrolLegendUi({
    status: "playing",
    elapsedMs: 1200,
    mission: 1,
  });
  assert.equal(missionLegend.items.at(-1).id, "wingman");
});

test("getSkyPatrolRadarBlips maps active threats into a mini radar strip", () => {
  const blips = getSkyPatrolRadarBlips({
    layout: { width: 960, height: 720 },
    ship: { x: 480, y: 648, width: 64, height: 48 },
    airEnemies: [{ id: "fighter-1", kind: "fighter", x: 240, y: 144, width: 48, height: 52 }],
    groundTargets: [{ id: "turret-1", kind: "turret", x: 720, y: 360, width: 32, height: 32 }],
  });

  assert.deepEqual(blips, [
    { id: "ship", role: "player", xPct: 50, yPct: 90 },
    { id: "fighter-1", role: "air", xPct: 25, yPct: 20 },
    { id: "turret-1", role: "ground", xPct: 75, yPct: 50 },
  ]);
});

test("getSkyPatrolGroundSiteUi marks the terrain supporting each ground target", () => {
  assert.deepEqual(getSkyPatrolGroundSiteUi({ siteTerrain: "runway" }), {
    marker: "runway-pad",
    accent: "built",
  });
  assert.deepEqual(getSkyPatrolGroundSiteUi({ siteTerrain: "road" }), {
    marker: "road-pad",
    accent: "built",
  });
  assert.deepEqual(getSkyPatrolGroundSiteUi({ siteTerrain: "forest" }), {
    marker: "field-pad",
    accent: "camo",
  });
});

test("getSkyPatrolDepthCue scales shadows by screen depth", () => {
  const highCue = getSkyPatrolDepthCue({ kind: "fighter", y: 96, height: 52 }, { height: 720 });
  const lowCue = getSkyPatrolDepthCue({ kind: "fighter", y: 612, height: 52 }, { height: 720 });

  assert.ok(lowCue.shadowScale > highCue.shadowScale);
  assert.ok(lowCue.shadowOpacity > highCue.shadowOpacity);
  assert.ok(lowCue.offsetY > highCue.offsetY);
});

test("getSkyPatrolProjectileUi gives each projectile source a readable silhouette", () => {
  assert.equal(getSkyPatrolProjectileUi({ kind: "player" }).shape, "player-bolt");
  assert.equal(getSkyPatrolProjectileUi({ kind: "fighter" }).shape, "fighter-round");
  assert.equal(getSkyPatrolProjectileUi({ kind: "turret" }).shape, "turret-shell");
});

test("getSkyPatrolProjectileUi gives every projectile a neon glow color", () => {
  for (const kind of ["player", "fighter", "turret"]) {
    const projectileUi = getSkyPatrolProjectileUi({ kind });

    assert.match(projectileUi.glow, /^rgba\(/);
    assert.equal(typeof projectileUi.sprite, "string");
  }
});

test("getSkyPatrolStartPromptUi shows a short launch prompt only while play begins", () => {
  const openingPrompt = getSkyPatrolStartPromptUi({ status: "playing", elapsedMs: 900 });
  const latePrompt = getSkyPatrolStartPromptUi({ status: "playing", elapsedMs: 5200 });

  assert.equal(openingPrompt.visible, true);
  assert.match(openingPrompt.detail, /Pinch/);
  assert.equal(latePrompt.visible, false);
  assert.equal(getSkyPatrolStartPromptUi({ status: "gameover", elapsedMs: 900 }).visible, false);
});

test("getSkyPatrolHudItems replaces target cruft with mission and combo context", () => {
  const items = getSkyPatrolHudItems({
    mission: 2,
    totalMissions: 4,
    missionName: "Island Shield",
    missionProgress: 5,
    missionGoal: 8,
    comboCount: 3,
    score: 1260,
    lives: 2,
    fireReady: true,
  });

  assert.deepEqual(
    items.map((item) => item.id),
    ["score", "lives", "mission", "goal", "combo", "fire"],
  );
  assert.deepEqual(
    items.map((item) => item.value),
    [1260, 2, "2/4", "5/8", "3x", "Ready"],
  );
});

test("Sky Patrol mission and checkpoint helpers present goals and recap", () => {
  const mission = getSkyPatrolMissionUi({
    mission: 3,
    totalMissions: 4,
    status: "playing",
    missionProgress: 7,
    missionConfig: {
      name: "Runway Breaker",
      goalText: "Destroy 10 threats",
      targetGoal: 10,
    },
  });

  assert.deepEqual(mission, {
    mission: 3,
    totalMissions: 4,
    name: "Runway Breaker",
    goalText: "Destroy 10 threats",
    progress: 7,
    goal: 10,
    progressRatio: 0.7,
    boss: false,
    phase: "active",
  });

  const checkpoint = getSkyPatrolCheckpointUi({
    status: "checkpoint",
    mission: 2,
    totalMissions: 4,
    lastMissionRecap: {
      name: "Island Shield",
      scoreEarned: 1900,
      accuracy: 76,
      checkpointBonus: 1180,
      clean: true,
    },
  });

  assert.equal(checkpoint.visible, true);
  assert.equal(checkpoint.title, "Clean checkpoint");
  assert.equal(checkpoint.nextMissionText, "Mission 3 incoming");
  assert.deepEqual(checkpoint.stats[2], {
    label: "Accuracy",
    value: "76%",
  });
});

test("Sky Patrol helpers explain telegraphs, power-ups, combos, and launch safety", () => {
  assert.deepEqual(
    getSkyPatrolTelegraphUi({
      id: "warning-1",
      kind: "ace",
      label: "Boss incoming",
      x: 400,
      ageMs: 450,
      durationMs: 900,
    }),
    {
      id: "warning-1",
      label: "Boss incoming",
      kind: "ace",
      x: 400,
      urgency: 0.5,
      boss: true,
    },
  );
  assert.equal(getSkyPatrolPowerUpUi({ type: "shield" }).detail, "Blocks one hit");
  assert.equal(
    getSkyPatrolPowerUpUi({ type: "overdrive" }).detail,
    "Faster fire and slower heat",
  );
  assert.deepEqual(getSkyPatrolComboUi({ comboCount: 4, comboExpiresMs: 1200 }), {
    visible: true,
    count: 4,
    label: "4x strike chain",
    multiplier: 1.24,
    remainingMs: 1200,
  });

  const onboarding = getSkyPatrolOnboardingUi({
    status: "playing",
    startSafetyMs: 1450,
    missionConfig: {
      name: "Coastal Sweep",
      goalText: "Destroy 6 threats",
      targetGoal: 6,
    },
  });
  assert.equal(onboarding.visible, true);
  assert.equal(onboarding.objective, "Destroy 6 threats");
  assert.match(onboarding.safetyLabel, /1.5s/);
});

test("getSkyPatrolGameOverUi presents a structured campaign result", () => {
  const ui = getSkyPatrolGameOverUi({
    status: "gameover",
    result: {
      outcome: "victory",
      score: 8200,
      missionsCleared: 4,
      totalMissions: 4,
      targetsDestroyed: 25,
      accuracy: 68,
      bestCombo: 7,
      powerUpsCollected: 3,
    },
  });

  assert.equal(ui.title, "Patrol complete");
  assert.equal(ui.outcome, "victory");
  assert.equal(ui.restartText, "Hold Fly Again");
  assert.deepEqual(ui.stats[1], { label: "Missions", value: "4/4" });
  assert.deepEqual(ui.stats[3], { label: "Accuracy", value: "68%" });
});

test("getSkyPatrolThreatUi distinguishes the expanded air archetypes", () => {
  assert.deepEqual(getSkyPatrolThreatUi({ kind: "interceptor" }), {
    role: "air",
    shape: "air-dart",
    archetype: "Interceptor",
  });
  assert.equal(getSkyPatrolThreatUi({ kind: "bomber" }).shape, "air-heavy");
  assert.equal(getSkyPatrolThreatUi({ kind: "ace" }).role, "boss");
});
