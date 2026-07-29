import test from "node:test";
import assert from "node:assert/strict";
import {
  createFullscreenHandBounceGame,
  getFullscreenHandBounceStageConfig,
} from "../src/fullscreenHandBounceGame.js";
import {
  getFullscreenHandBounceAnnouncement,
  getFullscreenHandBounceCheckpointUi,
  getFullscreenHandBounceHudUi,
  getFullscreenHandBounceLegendUi,
  getFullscreenHandBouncePowerUi,
  getFullscreenHandBounceResultUi,
  getFullscreenHandBounceStageUi,
  getFullscreenHandBounceTargetUi,
} from "../src/fullscreenHandBounceUi.js";

test("Hand Bounce HUD and stage models expose readable labels and goals", () => {
  const state = {
    ...createFullscreenHandBounceGame(960, 720, { seed: 9 }),
    stage: 2,
    totalStages: 3,
    stageConfig: getFullscreenHandBounceStageConfig(2),
    stageTimeRemainingMs: 9_500,
    score: 12,
    saveCount: 7,
    comboCount: 3,
    lives: 1,
    stageProgress: {
      saves: 4,
      targetHits: 1,
      trickShots: 1,
    },
  };
  const hud = getFullscreenHandBounceHudUi(state);
  const stage = getFullscreenHandBounceStageUi(state);

  assert.match(hud.ariaLabel, /score 12/i);
  assert.deepEqual(
    hud.items.map((item) => item.id),
    ["score", "saves", "stage", "time", "lives", "combo"],
  );
  assert.equal(stage.name, "Corner Rally");
  assert.equal(stage.goals.length, 3);
  assert.equal(stage.goals[2].complete, true);
  assert.equal(stage.urgent, true);
  assert.ok(stage.completionRatio > 0.5);
});

test("target and power models include assistive descriptions", () => {
  const base = createFullscreenHandBounceGame(960, 720, { seed: 9 });
  const state = {
    ...base,
    stage: 2,
    stageConfig: getFullscreenHandBounceStageConfig(2),
    targetZone: {
      id: "target",
      index: 0,
      normalizedX: 0.72,
      normalizedY: 0.2,
      anchor: "upper-right",
      widthRatio: 0.17,
      heightRatio: 0.1,
      label: "Volley target 1",
    },
    focus: 76,
  };
  const target = getFullscreenHandBounceTargetUi(state);
  const power = getFullscreenHandBouncePowerUi(state);

  assert.equal(target.visible, true);
  assert.equal(target.role, "img");
  assert.match(target.ariaLabel, /upper right/);
  assert.match(target.assistiveText, /Aim/);
  assert.equal(power.progress, 0.76);
  assert.match(power.ariaLabel, /76 percent/);
});

test("checkpoint and result models summarize finite campaign outcomes", () => {
  const base = createFullscreenHandBounceGame(960, 720, {
    seed: 9,
    personalBest: 10,
  });
  const checkpointState = {
    ...base,
    phase: "checkpoint",
    lastStageRecap: {
      name: "Palm School",
      saves: 4,
      targetHits: 0,
      trickShots: 1,
      scoreEarned: 6,
    },
  };
  const checkpoint = getFullscreenHandBounceCheckpointUi(checkpointState);
  const resultState = {
    ...base,
    status: "gameover",
    phase: "result",
    outcome: "victory",
    score: 21,
    saveCount: 12,
    stage: 3,
    stats: {
      stagesCleared: 3,
      targetHits: 5,
      trickShots: 4,
      bestCombo: 8,
      drops: 0,
      powerUpsActivated: 1,
      focusEarned: 140,
    },
  };
  const result = getFullscreenHandBounceResultUi(resultState);

  assert.equal(checkpoint.visible, true);
  assert.equal(checkpoint.liveRole, "status");
  assert.match(checkpoint.nextStageText, /Stage 2/);
  assert.equal(result.visible, true);
  assert.equal(result.title, "Circuit complete");
  assert.equal(result.newPersonalBest, true);
  assert.equal(result.stats.at(-1).value, "3/3");
});

test("legend and announcements are concise and non-visual", () => {
  const base = createFullscreenHandBounceGame(960, 720, { seed: 9 });
  const legend = getFullscreenHandBounceLegendUi();
  const powered = {
    ...base,
    powerModeMs: 5_000,
  };

  assert.equal(legend.items.length, 4);
  assert.ok(legend.items.every((item) => item.label && item.detail));
  assert.match(
    getFullscreenHandBounceAnnouncement(powered, base),
    /Power volley active/,
  );
});

test("Hand Bounce UI models stay safe before a game state exists", () => {
  assert.equal(getFullscreenHandBounceHudUi(null).items[0].value, 0);
  assert.equal(getFullscreenHandBounceStageUi(null).stage, 1);
  assert.equal(getFullscreenHandBounceTargetUi(null).visible, false);
  assert.equal(getFullscreenHandBouncePowerUi(null).progress, 0);
  assert.equal(getFullscreenHandBounceCheckpointUi(null).visible, false);
  assert.equal(getFullscreenHandBounceResultUi(null).visible, false);
  assert.equal(getFullscreenHandBounceAnnouncement(null, null), "");
});
