import test from "node:test";
import assert from "node:assert/strict";

import {
  createBrickDodgerGame,
  getBrickDodgerStageConfig,
} from "../src/brickDodgerGame.js";
import {
  getBrickDodgerLaneTelegraphUi,
  getBrickDodgerMultiplierUi,
  getBrickDodgerPickupUi,
  getBrickDodgerResultUi,
  getBrickDodgerSlowTimeUi,
  getBrickDodgerStageRecapUi,
  getBrickDodgerStageUi,
} from "../src/brickDodgerUi.js";

test("stage UI exposes the named stage, visible threat, and progress", () => {
  const game = createBrickDodgerGame(960, 720);
  const ui = getBrickDodgerStageUi({
    ...game,
    stageElapsedMs: game.stageConfig.durationMs / 2,
  });

  assert.equal(ui.stage, 1);
  assert.equal(ui.name, "Warm-Up");
  assert.equal(ui.threatLabel, "Low");
  assert.equal(ui.progress, 0.5);
  assert.equal(ui.phase, "running");
  assert.equal(ui.className.includes("threat-1"), true);
});

test("lane telegraph UI distinguishes critical danger, warnings, pickups, and clear lanes", () => {
  const game = createBrickDodgerGame(960, 720);
  const state = {
    ...game,
    hazards: [
      {
        id: "hazard-critical",
        laneIndex: 0,
        x: game.layout.laneCenters[0],
        y: game.layout.playerY - 100,
        vy: 300,
      },
      {
        id: "hazard-warning",
        laneIndex: 1,
        x: game.layout.laneCenters[1],
        y: game.layout.playerY - 300,
        vy: 300,
      },
    ],
    laneTelegraphs: [
      {
        id: "telegraph-pickup",
        laneIndex: 2,
        kind: "pickup",
        pickupType: "shield",
        arrivalMs: 900,
        threatLevel: 1,
      },
    ],
  };
  const lanes = getBrickDodgerLaneTelegraphUi(state);

  assert.equal(lanes.length, 6);
  assert.equal(lanes[0].urgency, "critical");
  assert.equal(lanes[0].label, "Move");
  assert.equal(lanes[1].urgency, "warning");
  assert.equal(lanes[2].urgency, "pickup");
  assert.equal(lanes[2].label, "Shield");
  assert.equal(lanes[3].urgency, "clear");
});

test("pickup UI gives score, shield, and slow-time drops distinct language", () => {
  assert.deepEqual(
    ["score", "shield", "slow-time"].map(
      (type) => getBrickDodgerPickupUi({ type }).label,
    ),
    ["Bonus", "Shield", "Slow time"],
  );
  assert.equal(
    getBrickDodgerPickupUi({ type: "slow-time" }).className.includes("slow-time"),
    true,
  );
});

test("near-miss and slow-time UI report active mastery states", () => {
  assert.deepEqual(
    getBrickDodgerMultiplierUi({
      nearMissStreak: 4,
      nearMissMultiplier: 2,
    }),
    {
      visible: true,
      streak: 4,
      multiplier: 2,
      label: "Near miss x2",
      className: "brick-dodger-multiplier building",
    },
  );

  const slow = getBrickDodgerSlowTimeUi({ slowTimeMs: 2_500 });
  assert.equal(slow.active, true);
  assert.equal(slow.progress, 0.5);
  assert.equal(slow.label, "Slow time");
});

test("stage recap UI summarizes performance during the calm pause", () => {
  const game = createBrickDodgerGame(960, 720);
  const ui = getBrickDodgerStageRecapUi({
    ...game,
    status: "stage_recap",
    stageRecapMs: 1_000,
    lastStageRecap: {
      stage: 1,
      name: "Warm-Up",
      scoreEarned: 900,
      nearMisses: 4,
      pickups: 2,
      hits: 0,
      clean: true,
    },
  });
  assert.equal(ui.visible, true);
  assert.equal(ui.title, "Clean stage");
  assert.equal(ui.subtitle, "Warm-Up");
  assert.deepEqual(ui.stats[1], { label: "Near misses", value: 4 });
});

test("result UI presents stage, near misses, and best multiplier", () => {
  const game = createBrickDodgerGame(960, 720);
  const state = {
    ...game,
    stage: 4,
    stageConfig: getBrickDodgerStageConfig(4),
    status: "gameover",
    score: 4_200,
    result: {
      score: 4_200,
      stageReached: 4,
      nearMisses: 15,
      bestMultiplier: 3,
    },
  };
  const ui = getBrickDodgerResultUi(state);
  assert.equal(ui.visible, true);
  assert.equal(ui.title, "Run complete");
  assert.deepEqual(ui.stats, [
    { label: "Score", value: 4_200 },
    { label: "Stage", value: 4 },
    { label: "Near misses", value: 15 },
    { label: "Best multiplier", value: "x3" },
  ]);
});
