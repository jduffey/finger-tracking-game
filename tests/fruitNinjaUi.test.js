import test from "node:test";
import assert from "node:assert/strict";

import {
  createFruitNinjaDailyGame,
  createFruitNinjaGame,
  createFruitNinjaResult,
} from "../src/fruitNinjaGame.js";
import {
  getFruitNinjaBombWarnings,
  getFruitNinjaComboUi,
  getFruitNinjaHud,
  getFruitNinjaLegendItems,
  getFruitNinjaPowerUi,
  getFruitNinjaPrecisionUi,
  getFruitNinjaRecapUi,
  getFruitNinjaRoundUi,
  getFruitNinjaSceneClassName,
  getFruitNinjaTargetUi,
} from "../src/fruitNinjaUi.js";

test("scene identity reflects active powers and terminal state", () => {
  const game = createFruitNinjaGame(960, 720);
  const className = getFruitNinjaSceneClassName({
    ...game,
    feverMs: 2_000,
    slowTimeMs: 1_000,
    status: "gameover",
  });

  assert.match(className, /slice-air-arcade/);
  assert.match(className, /fever-active/);
  assert.match(className, /slow-time-active/);
  assert.match(className, /round-complete/);
});

test("round UI makes time, wave progress, and urgency explicit", () => {
  const game = createFruitNinjaGame(960, 720);
  const ui = getFruitNinjaRoundUi({
    ...game,
    roundRemainingMs: 15_000,
    wave: 4,
    waveAnnouncementMs: 600,
  });

  assert.equal(ui.clock, "0:15");
  assert.equal(ui.progress, 0.75);
  assert.equal(ui.urgency, "urgent");
  assert.equal(ui.waveLabel, "Bomb Run");
  assert.equal(ui.announcementVisible, true);
  assert.equal(ui.announcement, "Wave 4: Bomb Run");
});

test("target UI differentiates special fruit and telegraphed bombs", () => {
  const golden = getFruitNinjaTargetUi({
    kind: "fruit",
    variant: "golden",
    label: "Golden Starfruit",
  });
  const warning = getFruitNinjaTargetUi({
    kind: "bomb",
    telegraphMs: 360,
    fuseMs: 720,
    armed: false,
  });
  const armed = getFruitNinjaTargetUi({
    kind: "bomb",
    telegraphMs: 0,
    fuseMs: 720,
    armed: true,
  });

  assert.match(golden.className, /special-golden/);
  assert.equal(golden.rewardLabel, "Bonus score");
  assert.equal(warning.dangerState, "telegraphing");
  assert.equal(warning.fuseProgress, 0.5);
  assert.equal(warning.label, "Bomb incoming");
  assert.equal(armed.dangerState, "armed");
  assert.equal(armed.label, "Armed bomb");
});

test("bomb warnings surface offscreen threats in arming order", () => {
  const game = createFruitNinjaGame(960, 720);
  const warnings = getFruitNinjaBombWarnings({
    ...game,
    targets: [
      {
        id: "bomb-late",
        kind: "bomb",
        x: 40,
        y: 800,
        radius: 30,
        telegraphMs: 600,
        fuseMs: 720,
        armed: false,
      },
      {
        id: "bomb-soon",
        kind: "bomb",
        x: 900,
        y: 300,
        radius: 30,
        telegraphMs: 120,
        fuseMs: 720,
        armed: false,
      },
    ],
  });

  assert.deepEqual(
    warnings.map((warning) => warning.id),
    ["bomb-soon", "bomb-late"],
  );
  assert.equal(warnings[0].edge, "right");
  assert.equal(warnings[0].offscreen, false);
  assert.equal(warnings[1].offscreen, true);
  assert.match(warnings[1].className, /offscreen/);
});

test("combo UI shows the remaining link window and best chain", () => {
  const game = createFruitNinjaGame(960, 720);
  const active = getFruitNinjaComboUi(
    {
      ...game,
      comboCount: 8,
      comboExpiresAt: 1_520,
      bestCombo: 10,
    },
    1_260,
  );
  const expired = getFruitNinjaComboUi(
    {
      ...game,
      comboCount: 8,
      comboExpiresAt: 1_520,
    },
    1_600,
  );

  assert.equal(active.active, true);
  assert.equal(active.label, "Combo x8");
  assert.equal(active.tier, "blazing");
  assert.equal(active.windowProgress, 0.5);
  assert.equal(active.bestCombo, 10);
  assert.equal(expired.active, false);
});

test("power UI represents fever, slow time, and discrete shield charges", () => {
  const game = createFruitNinjaGame(960, 720);
  const ui = getFruitNinjaPowerUi({
    ...game,
    feverMeter: 50,
    feverMs: 3_000,
    slowTimeMs: 2_100,
    shields: 1,
  });

  assert.deepEqual(ui.fever, {
    active: true,
    charge: 0.5,
    remaining: 0.5,
    label: "Fever x2",
  });
  assert.equal(ui.slowTime.active, true);
  assert.equal(ui.slowTime.remaining, 0.5);
  assert.deepEqual(ui.shields.charges, [true, false]);
  assert.equal(ui.shields.label, "1 shield");
});

test("precision UI turns the latest slice grade into immediate feedback", () => {
  const hidden = getFruitNinjaPrecisionUi(null);
  const perfect = getFruitNinjaPrecisionUi({
    grade: {
      id: "perfect",
      label: "Perfect",
      bonus: 75,
      speed: 1_840,
      centerRatio: 0.08,
    },
  });

  assert.equal(hidden.visible, false);
  assert.equal(perfect.visible, true);
  assert.equal(perfect.grade, "perfect");
  assert.equal(perfect.bonus, 75);
  assert.match(perfect.className, /perfect/);
});

test("HUD and legend prioritize score, time, lives, wave, and learnable rules", () => {
  const game = createFruitNinjaGame(960, 720);
  const hud = getFruitNinjaHud(
    {
      ...game,
      score: 1_425,
      roundRemainingMs: 42_000,
      wave: 2,
    },
    0,
  );
  const legend = getFruitNinjaLegendItems();

  assert.deepEqual(
    hud.items.map((item) => item.id),
    ["score", "time", "lives", "wave"],
  );
  assert.equal(hud.items[0].value, 1_425);
  assert.equal(hud.items[1].value, "0:42");
  assert.deepEqual(
    legend.map((item) => item.id),
    ["fruit", "combo", "bomb", "golden", "frost", "shield"],
  );
});

test("recap UI presents grade, performance stats, medals, and daily context", () => {
  const game = createFruitNinjaDailyGame(960, 720, "2026-07-28T12:00:00Z");
  const terminal = {
    ...game,
    status: "gameover",
    endReason: "round-complete",
    score: 6_100,
    personalBest: 7_000,
    bestCombo: 13,
    stats: {
      ...game.stats,
      fruitSliced: 32,
      bestCombo: 13,
      perfectSlices: 7,
      greatSlices: 5,
      goodSlices: 2,
    },
  };
  terminal.result = createFruitNinjaResult(terminal);

  const ui = getFruitNinjaRecapUi(terminal, "Fly Again");

  assert.equal(ui.visible, true);
  assert.equal(ui.title, "Round complete");
  assert.equal(ui.grade, "S");
  assert.equal(ui.personalBest, 7_000);
  assert.deepEqual(
    ui.stats.map((stat) => stat.id),
    ["fruit", "best-combo", "precision", "bombs"],
  );
  assert.match(ui.challengeLabel, /2026-07-28/);
  assert.equal(ui.medals.length >= 4, true);
  assert.equal(ui.restartText, "Hold Fly Again");
  assert.equal(getFruitNinjaRecapUi(game).visible, false);
});
