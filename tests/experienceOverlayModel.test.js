import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPERIENCE_LIFECYCLE_EVENTS,
  EXPERIENCE_PAUSE_REASONS,
  createExperienceLifecycle,
  reduceExperienceLifecycle,
} from "../src/experienceLifecycle.js";
import {
  DEFAULT_EXPERIENCE_COMFORT_GUIDANCE,
  EXPERIENCE_OVERLAY_ACTIONS,
  EXPERIENCE_OVERLAY_KINDS,
  createExperienceOverlayViewModel,
  normalizeExperienceCompactHud,
} from "../src/components/experienceOverlayModel.js";

test("invalid lifecycle input produces a safely hidden overlay", () => {
  assert.deepEqual(createExperienceOverlayViewModel(), {
    visible: false,
    kind: EXPERIENCE_OVERLAY_KINDS.HIDDEN,
    modal: false,
    blocking: false,
    livePriority: "polite",
    announcement: "",
    actions: [],
  });
});

test("ready presentation blocks play and exposes semantic start and exit actions", () => {
  const lifecycle = createExperienceLifecycle({ countdownMs: 3_000 });
  const view = createExperienceOverlayViewModel({
    lifecycle,
    modeLabel: "Sky Patrol",
    instructions: "Point to steer and pinch to fire.",
  });

  assert.equal(view.kind, EXPERIENCE_OVERLAY_KINDS.READY);
  assert.equal(view.modal, true);
  assert.equal(view.blocking, true);
  assert.equal(view.title, "Ready for Sky Patrol?");
  assert.equal(view.message, "Point to steer and pinch to fire.");
  assert.equal(
    view.comfortGuidance,
    DEFAULT_EXPERIENCE_COMFORT_GUIDANCE,
  );
  assert.match(view.announcement, /Comfort reminder: Clear a little space/);
  assert.deepEqual(
    view.actions.map(({ id, emphasis }) => ({ id, emphasis })),
    [
      { id: EXPERIENCE_OVERLAY_ACTIONS.START, emphasis: "primary" },
      { id: EXPERIENCE_OVERLAY_ACTIONS.EXIT, emphasis: "quiet" },
    ],
  );
});

test("initial and resume countdowns provide concise assertive announcements", () => {
  let lifecycle = createExperienceLifecycle({
    countdownMs: 2_250,
    resumeCountdownMs: 900,
    autoStart: true,
  });
  let view = createExperienceOverlayViewModel({ lifecycle });

  assert.equal(view.kind, EXPERIENCE_OVERLAY_KINDS.COUNTDOWN);
  assert.equal(view.seconds, 3);
  assert.equal(view.eyebrow, "Get ready");
  assert.equal(view.announcement, "Starting in 3");
  assert.equal(view.livePriority, "assertive");

  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    deltaMs: 2_250,
  });
  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
  });
  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
    reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
  });
  view = createExperienceOverlayViewModel({ lifecycle });

  assert.equal(view.eyebrow, "Resuming");
  assert.equal(view.seconds, 1);
  assert.equal(view.announcement, "Resuming in 1");
});

test("running view normalizes a bounded compact HUD and common controls", () => {
  const lifecycle = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  const hud = normalizeExperienceCompactHud(
    {
      status: "Wave active",
      items: [
        { id: "score", label: "Score", value: 120, emphasis: "strong" },
        { id: "score", label: "Combo", value: "x4" },
        null,
        { id: "bad", label: "", value: 2 },
        { id: "lives", label: "Lives", value: 3 },
        { id: "wave", label: "Wave", value: 2 },
        { id: "time", label: "Time", value: "0:45" },
        { id: "ammo", label: "Ammo", value: 6 },
        { id: "ignored", label: "Ignored", value: 9 },
      ],
    },
    "Invaders",
  );

  assert.equal(hud.label, "Invaders");
  assert.equal(hud.status, "Wave active");
  assert.deepEqual(
    hud.items.map(({ id }) => id),
    ["score", "score-2", "lives", "wave", "time", "ammo"],
  );

  const view = createExperienceOverlayViewModel({
    lifecycle,
    modeLabel: "Invaders",
    hud,
  });
  assert.equal(view.kind, EXPERIENCE_OVERLAY_KINDS.HUD);
  assert.equal(view.blocking, false);
  assert.deepEqual(
    view.actions.map(({ id }) => id),
    [EXPERIENCE_OVERLAY_ACTIONS.PAUSE, EXPERIENCE_OVERLAY_ACTIONS.EXIT],
  );
});

test("manual pause has a resumable dialog and preserves restart and exit", () => {
  let lifecycle = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
  });
  const view = createExperienceOverlayViewModel({
    lifecycle,
    modeLabel: "Brick Dodger",
    instructions: "Move between lanes and avoid the warning zones.",
  });

  assert.equal(view.kind, EXPERIENCE_OVERLAY_KINDS.PAUSED);
  assert.equal(view.isTrackingLost, false);
  assert.equal(view.title, "Paused");
  assert.equal(
    view.help,
    "Move between lanes and avoid the warning zones.",
  );
  assert.equal(
    view.comfortGuidance,
    DEFAULT_EXPERIENCE_COMFORT_GUIDANCE,
  );
  assert.match(view.announcement, /Comfort reminder: Clear a little space/);
  assert.equal(view.actions[0].id, EXPERIENCE_OVERLAY_ACTIONS.RESUME);
  assert.equal(view.actions[0].reason, EXPERIENCE_PAUSE_REASONS.MANUAL);
  assert.deepEqual(
    view.actions.map(({ id }) => id),
    [
      EXPERIENCE_OVERLAY_ACTIONS.RESUME,
      EXPERIENCE_OVERLAY_ACTIONS.RESTART,
      EXPERIENCE_OVERLAY_ACTIONS.EXIT,
    ],
  );
});

test("a custom exit label follows a routed experience through every phase", () => {
  const exitLabel = "Return to Arcade Run";
  let lifecycle = createExperienceLifecycle({
    countdownMs: 1_000,
  });
  let view = createExperienceOverlayViewModel({
    lifecycle,
    exitLabel,
  });
  assert.equal(view.actions.at(-1).label, exitLabel);

  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.START,
  });
  view = createExperienceOverlayViewModel({ lifecycle, exitLabel });
  assert.equal(view.actions.at(-1).label, exitLabel);

  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    deltaMs: 1_000,
  });
  view = createExperienceOverlayViewModel({ lifecycle, exitLabel });
  assert.equal(view.actions.at(-1).label, exitLabel);

  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
  });
  view = createExperienceOverlayViewModel({ lifecycle, exitLabel });
  assert.equal(view.actions.at(-1).label, exitLabel);
});

test("tracking loss takes presentation priority over other pause reasons", () => {
  let lifecycle = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  for (const reason of [
    EXPERIENCE_PAUSE_REASONS.MANUAL,
    EXPERIENCE_PAUSE_REASONS.VISIBILITY,
    EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
  ]) {
    lifecycle = reduceExperienceLifecycle(lifecycle, {
      type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
      reason,
    });
  }

  const view = createExperienceOverlayViewModel({
    lifecycle,
    modeLabel: "Slice Air",
  });

  assert.equal(view.kind, EXPERIENCE_OVERLAY_KINDS.TRACKING_LOST);
  assert.equal(view.livePriority, "assertive");
  assert.equal(view.title, "Tracking lost");
  assert.equal(view.comfortGuidance, null);
  assert.deepEqual(
    view.actions.map(({ id }) => id),
    [
      EXPERIENCE_OVERLAY_ACTIONS.RESTART,
      EXPERIENCE_OVERLAY_ACTIONS.EXIT,
    ],
  );
  assert.equal(view.pauseReasons.length, 3);
});

test("comfort guidance can be customized or omitted without changing actions", () => {
  const lifecycle = createExperienceLifecycle({ countdownMs: 3_000 });
  const customGuidance =
    "Keep your shoulders loose and choose the smallest comfortable motion.";
  const customView = createExperienceOverlayViewModel({
    lifecycle,
    comfortGuidance: `  ${customGuidance}  `,
  });
  const omittedView = createExperienceOverlayViewModel({
    lifecycle,
    comfortGuidance: false,
  });

  assert.equal(customView.comfortGuidance, customGuidance);
  assert.match(customView.announcement, /Keep your shoulders loose/);
  assert.equal(omittedView.comfortGuidance, null);
  assert.doesNotMatch(omittedView.announcement, /Comfort reminder/);
  assert.deepEqual(omittedView.actions, customView.actions);
});

test("stable reacquisition is explained and resumes automatically", () => {
  let lifecycle = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
  });
  const view = createExperienceOverlayViewModel({
    lifecycle,
    modeLabel: "Sky Patrol",
    trackingRecovery: {
      phase: "reacquiring",
      progress: 0.5,
      remainingMs: 1_500,
    },
  });

  assert.equal(view.title, "Hold steady");
  assert.equal(view.isReacquiring, true);
  assert.equal(view.recoveryProgress, 0.5);
  assert.equal(view.recoverySeconds, 2);
  assert.match(view.message, /resume automatically/);
  assert.equal(
    view.actions.some(({ id }) => id === EXPERIENCE_OVERLAY_ACTIONS.RESUME),
    false,
  );
});

test("results presentation reuses normalized outcome, metrics, and actions", () => {
  let lifecycle = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.FINISH,
    result: {
      outcome: "won",
      score: 42,
      metrics: { rally: 11 },
      personalBestMetricIds: ["score"],
    },
  });
  const view = createExperienceOverlayViewModel({
    lifecycle,
    modeLabel: "Finger Pong",
    resultOptions: {
      restartLabel: "Play rematch",
    },
  });

  assert.equal(view.kind, EXPERIENCE_OVERLAY_KINDS.RESULTS);
  assert.equal(view.title, "You won!");
  assert.equal(view.result.primaryMetric.formattedValue, "42");
  assert.equal(view.result.isPersonalBest, true);
  assert.equal(
    view.result.improvementTip,
    "Return to center after each shot and aim for a rally of 12.",
  );
  assert.match(view.announcement, /Try next: Return to center/);
  assert.deepEqual(
    view.actions.map(({ id, label }) => ({ id, label })),
    [
      { id: EXPERIENCE_OVERLAY_ACTIONS.RESTART, label: "Play rematch" },
      { id: EXPERIENCE_OVERLAY_ACTIONS.EXIT, label: "Back to home" },
    ],
  );
});

test("result options configure the long-session comfort note without new actions", () => {
  let lifecycle = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  lifecycle = reduceExperienceLifecycle(lifecycle, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.FINISH,
    result: {
      outcome: "completed",
      score: 8,
      durationMs: 90_000,
    },
  });
  const view = createExperienceOverlayViewModel({
    lifecycle,
    resultOptions: {
      breakSuggestionThresholdMs: 60_000,
      breakSuggestion: "Take one easy breath before choosing another round.",
    },
  });

  assert.equal(
    view.result.breakSuggestion,
    "Take one easy breath before choosing another round.",
  );
  assert.match(view.announcement, /Comfort check: Take one easy breath/);
  assert.deepEqual(
    view.actions.map(({ id }) => id),
    [
      EXPERIENCE_OVERLAY_ACTIONS.RESTART,
      EXPERIENCE_OVERLAY_ACTIONS.EXIT,
    ],
  );
});
