import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPERIENCE_OUTCOMES,
  EXPERIENCE_RESULT_ACTIONS,
  EXPERIENCE_RESULT_TONES,
  createExperienceResultViewModel,
  formatExperienceDuration,
  normalizeExperienceResult,
} from "../src/experienceResult.js";

test("result normalization keeps finite safe metrics and a bounded duration", () => {
  const unsafeMetrics = JSON.parse(
    '{"score":8,"rally":12,"bad":null,"__proto__":99}',
  );
  const result = normalizeExperienceResult({
    outcome: "not-real",
    score: 10,
    metrics: unsafeMetrics,
    durationMs: Number.POSITIVE_INFINITY,
    title: "  Custom title  ",
    personalBestMetricIds: ["rally", "rally", "missing", "__proto__"],
  }, {
    fallbackDurationMs: 1_500,
  });

  assert.deepEqual(result, {
    outcome: EXPERIENCE_OUTCOMES.COMPLETED,
    score: 10,
    metrics: { score: 10, rally: 12 },
    durationMs: 1_500,
    title: "Custom title",
    message: null,
    isPersonalBest: true,
    personalBestMetricIds: ["rally"],
  });
  assert.equal(
    normalizeExperienceResult(null, null).outcome,
    EXPERIENCE_OUTCOMES.COMPLETED,
  );
});

test("a standard win view selects score, time, consistent copy, and actions", () => {
  const view = createExperienceResultViewModel(
    {
      outcome: EXPERIENCE_OUTCOMES.WON,
      score: 12_345,
      metrics: { rally: 18 },
      durationMs: 65_000,
    },
    { modeLabel: "Finger Pong" },
  );

  assert.equal(view.tone, EXPERIENCE_RESULT_TONES.POSITIVE);
  assert.equal(view.eyebrow, "Finger Pong");
  assert.equal(view.title, "You won!");
  assert.equal(view.primaryMetric.id, "score");
  assert.equal(view.primaryMetric.formattedValue, "12,345");
  assert.deepEqual(
    view.secondaryMetrics.map(({ id, formattedValue }) => ({
      id,
      formattedValue,
    })),
    [
      { id: "rally", formattedValue: "18" },
      { id: "duration", formattedValue: "1:05" },
    ],
  );
  assert.deepEqual(
    view.actions.map(({ id, emphasis }) => ({ id, emphasis })),
    [
      { id: EXPERIENCE_RESULT_ACTIONS.RESTART, emphasis: "primary" },
      { id: EXPERIENCE_RESULT_ACTIONS.EXIT, emphasis: "secondary" },
    ],
  );
  assert.match(view.announcement, /Score: 12,345/);
});

test("personal-best and metric definitions produce a game-specific view safely", () => {
  const view = createExperienceResultViewModel(
    {
      outcome: EXPERIENCE_OUTCOMES.COMPLETED,
      metrics: {
        accuracy: 0.923,
        combo: 17,
      },
      personalBestMetricIds: ["accuracy"],
    },
    {
      modeLabel: "Slice Air",
      primaryMetricId: "accuracy",
      personalBestLabel: "New accuracy record",
      metricDefinitions: {
        accuracy: {
          label: "Accuracy",
          format: (value) => `${Math.round(value * 100)}%`,
        },
      },
      restartLabel: "Slice again",
      exitLabel: "Choose another game",
    },
  );

  assert.equal(view.eyebrow, "New accuracy record");
  assert.equal(view.isPersonalBest, true);
  assert.deepEqual(view.primaryMetric, {
    id: "accuracy",
    label: "Accuracy",
    value: 0.923,
    formattedValue: "92%",
    isPersonalBest: true,
  });
  assert.equal(view.actions[0].label, "Slice again");
  assert.equal(view.actions[1].label, "Choose another game");
});

test("broken custom formatters fall back and restart can be intentionally hidden", () => {
  const view = createExperienceResultViewModel(
    {
      outcome: EXPERIENCE_OUTCOMES.LOST,
      metrics: { wave: 3 },
    },
    {
      allowRestart: false,
      metricDefinitions: {
        wave: {
          format() {
            throw new Error("formatter failed");
          },
        },
      },
    },
  );

  assert.equal(view.tone, EXPERIENCE_RESULT_TONES.NEGATIVE);
  assert.equal(view.primaryMetric.formattedValue, "3");
  assert.deepEqual(view.actions, [
    {
      id: EXPERIENCE_RESULT_ACTIONS.EXIT,
      label: "Back to home",
      emphasis: "primary",
    },
  ]);
});

test("default result tones and titles cover every supported outcome", () => {
  const expectations = [
    [EXPERIENCE_OUTCOMES.COMPLETED, EXPERIENCE_RESULT_TONES.POSITIVE, "Experience complete"],
    [EXPERIENCE_OUTCOMES.WON, EXPERIENCE_RESULT_TONES.POSITIVE, "You won!"],
    [EXPERIENCE_OUTCOMES.LOST, EXPERIENCE_RESULT_TONES.NEGATIVE, "Round over"],
    [EXPERIENCE_OUTCOMES.DRAW, EXPERIENCE_RESULT_TONES.NEUTRAL, "Draw"],
    [EXPERIENCE_OUTCOMES.ABANDONED, EXPERIENCE_RESULT_TONES.NEUTRAL, "Session ended"],
  ];

  for (const [outcome, tone, title] of expectations) {
    const view = createExperienceResultViewModel({ outcome });
    assert.equal(view.tone, tone);
    assert.equal(view.title, title);
  }
});

test("duration formatting stays compact from seconds through hours", () => {
  assert.equal(formatExperienceDuration(0), "0:00");
  assert.equal(formatExperienceDuration(Number.NaN), "0:00");
  assert.equal(formatExperienceDuration(Number.POSITIVE_INFINITY), "0:00");
  assert.equal(formatExperienceDuration(59_600), "1:00");
  assert.equal(formatExperienceDuration(65_000), "1:05");
  assert.equal(formatExperienceDuration(3_661_000), "1:01:01");
});

test("canonical elapsed time replaces an ambiguous duration metric", () => {
  const view = createExperienceResultViewModel(
    {
      metrics: { duration: 99 },
      durationMs: 5_000,
    },
    null,
  );

  assert.equal(view.primaryMetric.id, "duration");
  assert.equal(view.primaryMetric.value, 5_000);
  assert.equal(view.primaryMetric.formattedValue, "0:05");
});

test("common arcade metrics use player-facing labels by default", () => {
  const view = createExperienceResultViewModel({
    metrics: {
      targetsDestroyed: 4,
      survivalMs: 12_500,
    },
  });

  assert.equal(view.metrics[0].label, "Targets destroyed");
  assert.equal(view.metrics[1].label, "Survival");
});
