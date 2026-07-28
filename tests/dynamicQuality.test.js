import test from "node:test";
import assert from "node:assert/strict";

import {
  DYNAMIC_QUALITY_DEFAULTS,
  MODEL_PREFERENCES,
  QUALITY_LEVELS,
  QUALITY_PROFILES,
  createDynamicQualityController,
  getDynamicQualityBudget,
  isDynamicQualityState,
  selectInitialQualityLevel,
  selectMaximumQualityLevel,
  updateDynamicQuality,
} from "../src/dynamicQuality.js";

function createTestController(overrides = {}) {
  return createDynamicQualityController({
    initialLevel: QUALITY_LEVELS.BALANCED,
    minimumLevel: QUALITY_LEVELS.MINIMAL,
    maximumLevel: QUALITY_LEVELS.HIGH,
    targetFrameTimeMs: 16,
    fastFrameTimeMs: 10,
    slowFrameTimeMs: 20,
    severeFrameTimeMs: 40,
    degradeAfterSamples: 3,
    severeDegradeAfterSamples: 2,
    upgradeAfterSamples: 4,
    cooldownMs: 0,
    emaAlpha: 1,
    ignoreFrameTimeAboveMs: 100,
    ...overrides,
  });
}

function recordFrames(state, frameTimes, startAtMs = 0) {
  let current = state;
  let result = null;
  frameTimes.forEach((frameTimeMs, index) => {
    result = updateDynamicQuality(current, {
      frameTimeMs,
      timestampMs: startAtMs + index,
    });
    current = result.state;
  });
  return { state: current, result };
}

test("quality profiles expose frozen, explicit budgets for every workload", () => {
  assert.deepEqual(QUALITY_PROFILES[QUALITY_LEVELS.MINIMAL], {
    level: "minimal",
    inferenceIntervalMs: 100,
    inferenceFps: 10,
    captureResolution: { width: 480, height: 360 },
    effectDensity: 0.2,
    particleLimit: 160,
    modelPreference: MODEL_PREFERENCES.LITE,
  });
  assert.deepEqual(QUALITY_PROFILES[QUALITY_LEVELS.ULTRA], {
    level: "ultra",
    inferenceIntervalMs: 25,
    inferenceFps: 40,
    captureResolution: { width: 1_600, height: 900 },
    effectDensity: 1,
    particleLimit: 2_600,
    modelPreference: MODEL_PREFERENCES.FULL,
  });
  assert.equal(Object.isFrozen(QUALITY_PROFILES), true);
  assert.equal(
    Object.isFrozen(
      QUALITY_PROFILES[QUALITY_LEVELS.HIGH].captureResolution,
    ),
    true,
  );
  assert.ok(
    DYNAMIC_QUALITY_DEFAULTS.upgradeAfterSamples >
      DYNAMIC_QUALITY_DEFAULTS.degradeAfterSamples,
  );
});

test("capability tiers choose conservative starting levels and ceilings", () => {
  assert.equal(selectInitialQualityLevel("high"), QUALITY_LEVELS.HIGH);
  assert.equal(
    selectInitialQualityLevel({ performanceTier: "standard" }),
    QUALITY_LEVELS.BALANCED,
  );
  assert.equal(
    selectInitialQualityLevel("constrained"),
    QUALITY_LEVELS.LOW,
  );
  assert.equal(
    selectInitialQualityLevel("fallback"),
    QUALITY_LEVELS.MINIMAL,
  );
  assert.equal(selectMaximumQualityLevel("high"), QUALITY_LEVELS.ULTRA);
  assert.equal(
    selectMaximumQualityLevel("constrained"),
    QUALITY_LEVELS.BALANCED,
  );

  const capped = createDynamicQualityController({
    capabilities: { performanceTier: "fallback" },
    initialLevel: QUALITY_LEVELS.ULTRA,
  });
  assert.equal(capped.level, QUALITY_LEVELS.LOW);
  assert.equal(capped.configuration.maximumLevel, QUALITY_LEVELS.LOW);
  assert.equal(isDynamicQualityState(capped), true);
  assert.equal(Object.isFrozen(capped.configuration), true);
});

test("sustained slow frames degrade exactly one level after hysteresis", () => {
  const initial = createTestController();
  const first = updateDynamicQuality(initial, {
    frameTimeMs: 21,
    timestampMs: 1,
  });
  const second = updateDynamicQuality(first.state, {
    frameTimeMs: 21,
    timestampMs: 2,
  });
  const third = updateDynamicQuality(second.state, {
    frameTimeMs: 21,
    timestampMs: 3,
  });

  assert.equal(initial.level, QUALITY_LEVELS.BALANCED);
  assert.equal(first.changed, false);
  assert.equal(second.changed, false);
  assert.equal(third.changed, true);
  assert.equal(third.previousLevel, QUALITY_LEVELS.BALANCED);
  assert.equal(third.level, QUALITY_LEVELS.LOW);
  assert.equal(third.reason, "sustained-slow-frames");
  assert.strictEqual(third.budget, QUALITY_PROFILES[QUALITY_LEVELS.LOW]);
  assert.equal(third.state.slowStreak, 0);
});

test("severe pressure takes the shorter downgrade path", () => {
  const { result } = recordFrames(
    createTestController(),
    [45, 45],
  );

  assert.equal(result.changed, true);
  assert.equal(result.level, QUALITY_LEVELS.LOW);
  assert.equal(result.reason, "severe-frame-pressure");
});

test("upgrades require a longer headroom streak and respect the ceiling", () => {
  let current = createTestController({
    initialLevel: QUALITY_LEVELS.LOW,
    maximumLevel: QUALITY_LEVELS.BALANCED,
  });
  let batch = recordFrames(current, [9, 9, 9]);
  assert.equal(batch.result.changed, false);
  assert.equal(batch.state.level, QUALITY_LEVELS.LOW);

  const upgrade = updateDynamicQuality(batch.state, {
    frameTimeMs: 9,
    timestampMs: 4,
  });
  assert.equal(upgrade.changed, true);
  assert.equal(upgrade.level, QUALITY_LEVELS.BALANCED);
  assert.equal(upgrade.reason, "sustained-headroom");

  batch = recordFrames(upgrade.state, [9, 9, 9, 9], 5);
  assert.equal(batch.result.changed, false);
  assert.equal(batch.result.reason, "at-maximum");
  assert.equal(batch.state.level, QUALITY_LEVELS.BALANCED);
  assert.equal(batch.state.fastStreak, 0);
});

test("middle-band samples reset streaks instead of allowing oscillation", () => {
  let batch = recordFrames(
    createTestController({ degradeAfterSamples: 2 }),
    [21, 15, 21],
  );
  assert.equal(batch.state.level, QUALITY_LEVELS.BALANCED);
  assert.equal(batch.state.slowStreak, 1);

  batch = recordFrames(batch.state, [9, 15, 9, 9, 9], 10);
  assert.equal(batch.state.level, QUALITY_LEVELS.BALANCED);
  assert.equal(batch.state.fastStreak, 3);
  assert.equal(batch.result.changed, false);
});

test("cooldown prevents back-to-back level changes under continued pressure", () => {
  let batch = recordFrames(
    createTestController({
      degradeAfterSamples: 2,
      cooldownMs: 100,
    }),
    [21, 21],
  );
  assert.equal(batch.state.level, QUALITY_LEVELS.LOW);
  assert.equal(batch.state.lastChangeAtMs, 1);

  batch = recordFrames(batch.state, [21, 21], 2);
  assert.equal(batch.result.reason, "cooldown");
  assert.equal(batch.state.level, QUALITY_LEVELS.LOW);

  const afterCooldown = updateDynamicQuality(batch.state, {
    frameTimeMs: 21,
    timestampMs: 101,
  });
  assert.equal(afterCooldown.changed, true);
  assert.equal(afterCooldown.level, QUALITY_LEVELS.MINIMAL);
});

test("invalid measurements and likely background stalls do not change quality", () => {
  const initial = createTestController({
    ignoreFrameTimeAboveMs: 80,
  });
  const invalid = updateDynamicQuality(initial, {
    frameTimeMs: Number.NaN,
  });
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.reason, "invalid-sample");
  assert.strictEqual(invalid.state, initial);

  const stall = updateDynamicQuality(initial, {
    frameTimeMs: 500,
    timestampMs: 500,
  });
  assert.equal(stall.accepted, false);
  assert.equal(stall.changed, false);
  assert.equal(stall.reason, "ignored-stall");
  assert.equal(stall.state.level, QUALITY_LEVELS.BALANCED);
  assert.equal(stall.state.sampleCount, 0);
  assert.equal(stall.state.emaFrameTimeMs, null);
});

test("reduced motion constrains decorative effects without weakening tracking", () => {
  const base = getDynamicQualityBudget(QUALITY_LEVELS.ULTRA);
  const reduced = getDynamicQualityBudget(QUALITY_LEVELS.ULTRA, {
    reducedMotion: true,
  });
  const limited = getDynamicQualityBudget(QUALITY_LEVELS.HIGH, {
    limitEffects: true,
  });

  assert.strictEqual(base, QUALITY_PROFILES[QUALITY_LEVELS.ULTRA]);
  assert.equal(reduced.effectDensity, 0.2);
  assert.equal(reduced.particleLimit, 120);
  assert.equal(
    reduced.inferenceIntervalMs,
    base.inferenceIntervalMs,
  );
  assert.strictEqual(reduced.captureResolution, base.captureResolution);
  assert.equal(limited.effectDensity, 0.45);
  assert.equal(limited.particleLimit, 480);
  assert.equal(Object.isFrozen(reduced), true);
});

test("the reducer is deterministic and leaves prior states untouched", () => {
  const first = createTestController();
  const second = createTestController();
  const sequence = [18, 22, 22, 15, 9, 9, 9, 9];
  const firstRun = recordFrames(first, sequence);
  const secondRun = recordFrames(second, sequence);

  assert.deepEqual(firstRun.state, secondRun.state);
  assert.equal(first.sampleCount, 0);
  assert.equal(first.emaFrameTimeMs, null);
  assert.equal(first.level, QUALITY_LEVELS.BALANCED);
});

test("configuration normalizes unsafe values into valid explicit budgets", () => {
  const state = createDynamicQualityController({
    targetFps: 0,
    degradeAfterSamples: -5,
    upgradeAfterSamples: Number.POSITIVE_INFINITY,
    cooldownMs: -1,
    emaAlpha: 4,
    minimumLevel: QUALITY_LEVELS.HIGH,
    maximumLevel: QUALITY_LEVELS.LOW,
  });

  assert.equal(state.configuration.degradeAfterSamples, 1);
  assert.equal(
    state.configuration.upgradeAfterSamples,
    DYNAMIC_QUALITY_DEFAULTS.upgradeAfterSamples,
  );
  assert.equal(state.configuration.cooldownMs, 0);
  assert.equal(state.configuration.emaAlpha, 1);
  assert.equal(state.configuration.minimumLevel, QUALITY_LEVELS.LOW);
  assert.equal(state.configuration.maximumLevel, QUALITY_LEVELS.HIGH);
  assert.equal(isDynamicQualityState(state), true);
});
