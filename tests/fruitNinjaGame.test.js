import test from "node:test";
import assert from "node:assert/strict";
import {
  FRUIT_NINJA_BASE_SCORE,
  FRUIT_NINJA_BOMB_TELEGRAPH_MS,
  FRUIT_NINJA_BOMB_PENALTY,
  FRUIT_NINJA_COMBO_BONUS,
  FRUIT_NINJA_FEVER_DURATION_MS,
  FRUIT_NINJA_GOLDEN_BONUS,
  FRUIT_NINJA_SLOW_TIME_DURATION_MS,
  createFruitNinjaDailyGame,
  createFruitNinjaGame,
  createFruitNinjaLayout,
  createFruitNinjaResult,
  createFruitNinjaTarget,
  computeSwipeSegments,
  getFruitNinjaDailyChallenge,
  getFruitNinjaMedals,
  getFruitNinjaWaveProfile,
  gradeFruitNinjaSlice,
  restartFruitNinjaGame,
  scoreSliceBatch,
  segmentIntersectsCircle,
  stepFruitNinjaGame,
} from "../src/fruitNinjaGame.js";

function constantRng(value) {
  return () => value;
}

function createTestTarget(overrides = {}) {
  return {
    id: "fruit-test",
    kind: "fruit",
    variant: "standard",
    label: "Sky Plum",
    x: 320,
    y: 240,
    vx: 0,
    vy: 0,
    radius: 32,
    rotation: 0,
    spin: 0,
    fill: "#59b7ff",
    accent: "#e3f4ff",
    missed: false,
    ...overrides,
  };
}

function sliceTarget(state, target, now = 90, rng = constantRng(0.5)) {
  return stepFruitNinjaGame(
    {
      ...state,
      spawnCooldownMs: 10_000,
      targets: [target],
      bladeTrail: [
        { x: target.x - target.radius * 2, y: target.y, timestamp: now - 90 },
        { x: target.x + target.radius * 2, y: target.y, timestamp: now },
      ],
    },
    0,
    { active: true, x: target.x + target.radius * 2, y: target.y },
    now,
    rng,
  );
}

test("createFruitNinjaLayout scales targets up by fifty percent", () => {
  const layout = createFruitNinjaLayout(960, 720);
  assert.equal(layout.targetRadius, 56.16);
});

test("computeSwipeSegments keeps only fast enough motion segments", () => {
  const segments = computeSwipeSegments(
    [
      { x: 10, y: 20, timestamp: 0 },
      { x: 130, y: 20, timestamp: 100 },
      { x: 150, y: 24, timestamp: 210 },
    ],
    { minSpeed: 700, minLength: 16 },
  );

  assert.equal(segments.length, 1);
  assert.equal(Math.round(segments[0].distance), 120);
  assert.ok(segments[0].speed >= 700);
});

test("segmentIntersectsCircle detects slices through a target body", () => {
  assert.equal(
    segmentIntersectsCircle(
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 50, y: 20, radius: 12 },
      0,
    ),
    true,
  );

  assert.equal(
    segmentIntersectsCircle(
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 50, y: 40, radius: 10 },
      0,
    ),
    false,
  );
});

test("scoreSliceBatch compounds combo scoring across fruit slices", () => {
  const scored = scoreSliceBatch(["fruit", "fruit", "fruit"], 0);

  assert.equal(
    scored.points,
    FRUIT_NINJA_BASE_SCORE * 3 + FRUIT_NINJA_COMBO_BONUS * 3,
  );
  assert.equal(scored.nextComboCount, 3);
  assert.equal(scored.bombHit, false);
});

test("scoreSliceBatch resets combo and applies bomb penalty", () => {
  const scored = scoreSliceBatch(["bomb"], 2);

  assert.equal(scored.points, -FRUIT_NINJA_BOMB_PENALTY);
  assert.equal(scored.nextComboCount, 0);
  assert.equal(scored.bombHit, true);
});

test("scoreSliceBatch is order-independent when fruit and bombs land together", () => {
  const fruitThenBomb = scoreSliceBatch(["fruit", "bomb"], 2);
  const bombThenFruit = scoreSliceBatch(["bomb", "fruit"], 2);

  assert.deepEqual(fruitThenBomb, bombThenFruit);
});

test("stepFruitNinjaGame scores simultaneous fruit and bomb slices consistently", () => {
  const game = createFruitNinjaGame(960, 720);
  const fruit = {
    id: "fruit-1",
    kind: "fruit",
    label: "Sky Plum",
    x: 320,
    y: 240,
    vx: 0,
    vy: 0,
    radius: 32,
    rotation: 0,
    spin: 0,
    fill: "#59b7ff",
    accent: "#e3f4ff",
    missed: false,
  };
  const bomb = {
    id: "bomb-1",
    kind: "bomb",
    label: "Bomb",
    x: 380,
    y: 240,
    vx: 0,
    vy: 0,
    radius: 32,
    rotation: 0,
    spin: 0,
    fill: "#111827",
    accent: "#ff7b6b",
    missed: false,
  };
  const bladeTrail = [
    { x: 260, y: 240, timestamp: 0 },
    { x: 430, y: 240, timestamp: 90 },
  ];

  const fruitFirst = stepFruitNinjaGame(
    { ...game, comboCount: 2, targets: [fruit, bomb], bladeTrail },
    0.016,
    { active: true, x: 430, y: 240 },
    90,
    () => 0.5,
  );
  const bombFirst = stepFruitNinjaGame(
    { ...game, comboCount: 2, targets: [bomb, fruit], bladeTrail },
    0.016,
    { active: true, x: 430, y: 240 },
    90,
    () => 0.5,
  );

  assert.equal(fruitFirst.score, bombFirst.score);
  assert.equal(fruitFirst.comboCount, bombFirst.comboCount);
  assert.equal(fruitFirst.lives, bombFirst.lives);
});

test("stepFruitNinjaGame spawns targets that can rise to roughly the top quarter of the screen", () => {
  const game = createFruitNinjaGame(960, 720);
  const nextState = stepFruitNinjaGame(
    {
      ...game,
      spawnCooldownMs: 0,
    },
    0,
    null,
    0,
    constantRng(0.5),
  );

  assert.equal(nextState.targets.length, 1);
  const target = nextState.targets[0];
  assert.ok(Math.abs(Math.abs(target.vx) - nextState.layout.width * 0.155 * 0.7) < 0.001);

  let simulatedState = nextState;
  let highestY = target.y;
  for (let index = 0; index < 240; index += 1) {
    const nextStep = stepFruitNinjaGame(simulatedState, 1 / 60, null, (index + 1) * 16, () => 1);
    const activeTarget = nextStep.targets.find((candidate) => candidate.id === target.id);
    if (!activeTarget) {
      break;
    }
    highestY = Math.min(highestY, activeTarget.y);
    simulatedState = nextStep;
    if (activeTarget.vy >= 0) {
      break;
    }
  }

  assert.ok(highestY >= nextState.layout.height * 0.19);
  assert.ok(highestY <= nextState.layout.height * 0.29);
});

test("stepFruitNinjaGame leaves targets and score unchanged after gameover", () => {
  const state = createFruitNinjaGame(800, 600);
  state.status = "gameover";
  state.score = 250;
  state.lives = 0;
  state.targets = [
    {
      id: "fruit-1",
      kind: "fruit",
      label: "Sun Peach",
      x: 80,
      y: 80,
      vx: 120,
      vy: 0,
      radius: 28,
      rotation: 0,
      spin: 1.2,
      fill: "#ff6b57",
      accent: "#ffd4bf",
      missed: false,
    },
  ];
  state.bladeTrail = [
    { x: 20, y: 80, timestamp: 0 },
    { x: 140, y: 80, timestamp: 40 },
  ];

  const nextState = stepFruitNinjaGame(
    state,
    0.016,
    { active: true, x: 200, y: 80 },
    60,
    () => 0.5,
  );

  assert.equal(nextState.status, "gameover");
  assert.equal(nextState.score, 250);
  assert.equal(nextState.lives, 0);
  assert.equal(nextState.targets.length, 1);
  assert.deepEqual(nextState.targets[0], state.targets[0]);
  assert.equal(nextState.popups.length, 0);
  assert.equal(nextState.particles.length, 0);
  assert.equal(nextState.message, "Round over. Restart to launch another wave.");
});

test("daily challenges use stable UTC seeds and replay identical target streams", () => {
  const date = new Date("2026-07-28T23:15:00-04:00");
  const firstChallenge = getFruitNinjaDailyChallenge(date);
  const sameUtcDay = getFruitNinjaDailyChallenge("2026-07-29T12:00:00Z");
  const nextDay = getFruitNinjaDailyChallenge("2026-07-30T00:00:00Z");

  assert.deepEqual(firstChallenge, sameUtcDay);
  assert.notEqual(firstChallenge.seed, nextDay.seed);

  const first = stepFruitNinjaGame(
    { ...createFruitNinjaDailyGame(960, 720, date), spawnCooldownMs: 0 },
    0,
    null,
    0,
  );
  const replay = stepFruitNinjaGame(
    { ...createFruitNinjaDailyGame(960, 720, sameUtcDay.dayKey), spawnCooldownMs: 0 },
    0,
    null,
    0,
  );

  assert.deepEqual(first.targets, replay.targets);
  assert.equal(first.randomState, replay.randomState);
  assert.equal(first.challenge.id, "slice-air-daily-2026-07-29");
});

test("wave profiles create a finite, progressively faster round arc", () => {
  const opening = getFruitNinjaWaveProfile(1);
  const finale = getFruitNinjaWaveProfile(5);

  assert.equal(opening.label, "Warm-up");
  assert.equal(finale.label, "Finale");
  assert.ok(finale.speedMultiplier > opening.speedMultiplier);
  assert.ok(finale.spawnCooldownMaxMs < opening.spawnCooldownMaxMs);
  assert.ok(finale.bombChance > opening.bombChance);

  const game = createFruitNinjaGame(960, 720);
  const advanced = stepFruitNinjaGame(
    {
      ...game,
      elapsedMs: game.roundDurationMs / 5 - 10,
      roundRemainingMs: game.roundDurationMs * 0.8 + 10,
      wave: 1,
      waveAnnouncementMs: 0,
      spawnCooldownMs: 10_000,
    },
    0.02,
    null,
    20,
    constantRng(0.5),
  );

  assert.equal(advanced.wave, 2);
  assert.equal(advanced.stats.wavesReached, 2);
  assert.equal(advanced.waveAnnouncementMs > 0, true);
  assert.match(advanced.message, /Wave 2: Rush/);
});

test("the timer completes a round with a structured recap and personal best", () => {
  const game = createFruitNinjaGame(960, 720);
  const completed = stepFruitNinjaGame(
    {
      ...game,
      score: 1_250,
      elapsedMs: game.roundDurationMs - 10,
      roundRemainingMs: 10,
      wave: 5,
      spawnCooldownMs: 10_000,
    },
    0.02,
    null,
    20,
    constantRng(0.5),
  );

  assert.equal(completed.status, "gameover");
  assert.equal(completed.endReason, "round-complete");
  assert.equal(completed.personalBest, 1_250);
  assert.equal(completed.result.modeId, "slice-air");
  assert.equal(completed.result.outcome, "completed");
  assert.equal(completed.result.score, 1_250);
  assert.equal(completed.result.wave, 5);
});

test("precision grading rewards centered, fast slices", () => {
  const perfect = gradeFruitNinjaSlice(
    {
      start: { x: 200, y: 240 },
      end: { x: 440, y: 240 },
      speed: 1_800,
    },
    createTestTarget(),
  );
  const great = gradeFruitNinjaSlice(
    {
      start: { x: 200, y: 255 },
      end: { x: 440, y: 255 },
      speed: 1_800,
    },
    createTestTarget(),
  );
  const good = gradeFruitNinjaSlice(
    {
      start: { x: 200, y: 270 },
      end: { x: 440, y: 270 },
      speed: 1_800,
    },
    createTestTarget(),
  );

  assert.equal(perfect.id, "perfect");
  assert.equal(perfect.bonus, 75);
  assert.equal(great.id, "great");
  assert.equal(good.id, "good");

  const sliced = sliceTarget(createFruitNinjaGame(960, 720), createTestTarget());
  assert.equal(sliced.score, FRUIT_NINJA_BASE_SCORE + perfect.bonus);
  assert.equal(sliced.stats.perfectSlices, 1);
  assert.equal(sliced.lastSlice.grade.id, "perfect");
});

test("golden fruit, frost fruit, and guard grapes provide distinct rewards", () => {
  const game = createFruitNinjaGame(960, 720);
  const golden = sliceTarget(
    game,
    createTestTarget({
      id: "fruit-golden",
      variant: "golden",
      label: "Golden Starfruit",
      scoreBonus: FRUIT_NINJA_GOLDEN_BONUS,
    }),
  );
  assert.equal(
    golden.score,
    FRUIT_NINJA_BASE_SCORE + 75 + FRUIT_NINJA_GOLDEN_BONUS,
  );
  assert.equal(golden.stats.goldenFruit, 1);

  const frost = sliceTarget(
    createFruitNinjaGame(960, 720),
    createTestTarget({
      id: "fruit-frost",
      variant: "frost",
      label: "Frost Berry",
      effect: "slow-time",
    }),
  );
  assert.equal(frost.slowTimeMs, FRUIT_NINJA_SLOW_TIME_DURATION_MS);
  assert.equal(frost.stats.frostFruit, 1);

  const shield = sliceTarget(
    createFruitNinjaGame(960, 720),
    createTestTarget({
      id: "fruit-shield",
      variant: "shield",
      label: "Guard Grape",
      effect: "shield",
    }),
  );
  assert.equal(shield.shields, 1);
  assert.equal(shield.stats.shieldFruit, 1);
});

test("shields absorb bomb damage while bombs retain deterministic telegraphs", () => {
  const game = createFruitNinjaGame(960, 720);
  const spawnedBomb = createFruitNinjaTarget(
    game.layout,
    7,
    { kind: "bomb", wave: 3 },
    constantRng(0.5),
  );

  assert.equal(spawnedBomb.telegraphMs, FRUIT_NINJA_BOMB_TELEGRAPH_MS);
  assert.equal(spawnedBomb.armed, false);

  const telegraphed = stepFruitNinjaGame(
    {
      ...game,
      spawnCooldownMs: 10_000,
      targets: [{ ...spawnedBomb, telegraphMs: 10 }],
    },
    0.02,
    null,
    20,
    constantRng(0.5),
  );
  assert.equal(telegraphed.targets[0].telegraphMs, 0);
  assert.equal(telegraphed.targets[0].armed, true);

  const shielded = sliceTarget(
    { ...createFruitNinjaGame(960, 720), shields: 1 },
    createTestTarget({
      id: "bomb-shielded",
      kind: "bomb",
      variant: undefined,
      label: "Bomb",
      fill: "#111827",
      accent: "#ff7b6b",
      telegraphMs: 0,
      armed: true,
    }),
  );
  assert.equal(shielded.lives, 3);
  assert.equal(shielded.shields, 0);
  assert.equal(shielded.score, 0);
  assert.equal(shielded.stats.bombsShielded, 1);
  assert.match(shielded.message, /Shield save/);
});

test("fever charges from fruit and doubles positive scoring once active", () => {
  const charged = sliceTarget(
    {
      ...createFruitNinjaGame(960, 720),
      feverMeter: 90,
    },
    createTestTarget({ id: "fruit-fever-charge" }),
  );

  assert.equal(charged.feverMeter, 0);
  assert.equal(charged.feverMs, FRUIT_NINJA_FEVER_DURATION_MS);
  assert.equal(charged.stats.feverActivations, 1);

  const beforeScore = charged.score;
  const feverSlice = sliceTarget(
    {
      ...charged,
      bladeTrail: [],
      targets: [],
    },
    createTestTarget({ id: "fruit-fever-score" }),
    300,
  );
  assert.ok(feverSlice.score - beforeScore >= (FRUIT_NINJA_BASE_SCORE + 75) * 2);
});

test("results expose precision, medals, challenge context, and deterministic restarts", () => {
  const daily = createFruitNinjaDailyGame(960, 720, "2026-07-28T12:00:00Z");
  const terminal = {
    ...daily,
    status: "gameover",
    endReason: "round-complete",
    score: 6_200,
    bestCombo: 14,
    stats: {
      ...daily.stats,
      fruitSliced: 34,
      bestCombo: 14,
      perfectSlices: 8,
      greatSlices: 5,
      goodSlices: 2,
    },
  };
  const result = createFruitNinjaResult(terminal);
  const medals = getFruitNinjaMedals(terminal);

  assert.equal(result.grade, "S");
  assert.equal(result.precisionRate, 0.867);
  assert.equal(result.challenge.dayKey, "2026-07-28");
  assert.equal(medals.every((medal) => medal.earned), true);

  const restarted = restartFruitNinjaGame(terminal);
  assert.equal(restarted.status, "running");
  assert.equal(restarted.score, 0);
  assert.equal(restarted.personalBest, 6_200);
  assert.deepEqual(restarted.challenge, daily.challenge);
  assert.equal(restarted.randomState, daily.randomSeed);
});
