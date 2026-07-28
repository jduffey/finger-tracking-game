import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPERIENCE_COUNTDOWN_KINDS,
  EXPERIENCE_LIFECYCLE_EFFECTS,
  EXPERIENCE_LIFECYCLE_EVENTS,
  EXPERIENCE_PAUSE_REASONS,
  EXPERIENCE_PHASES,
  createExperienceLifecycle,
  getExperienceLifecycleCapabilities,
  getPrimaryExperiencePauseReason,
  isExperienceActive,
  isExperienceLifecycleState,
  reduceExperienceLifecycle,
  transitionExperienceLifecycle,
} from "../src/experienceLifecycle.js";

function transition(state, type, details = {}) {
  return transitionExperienceLifecycle(state, { type, ...details });
}

test("a lifecycle starts ready with bounded shared timing configuration", () => {
  const state = createExperienceLifecycle({
    countdownMs: 90_000,
    resumeCountdownMs: -20,
  });

  assert.equal(state.phase, EXPERIENCE_PHASES.READY);
  assert.equal(state.attempt, 1);
  assert.equal(state.elapsedMs, 0);
  assert.deepEqual(state.pauseReasons, []);
  assert.deepEqual(state.configuration, {
    initialCountdownMs: 60_000,
    resumeCountdownMs: 0,
  });
  assert.equal(Object.isFrozen(state.configuration), true);
  assert.equal(isExperienceLifecycleState(state), true);
  assert.deepEqual(getExperienceLifecycleCapabilities(state), {
    canStart: true,
    canPause: false,
    canResume: false,
    canRestart: false,
    canExit: true,
  });
  assert.equal(createExperienceLifecycle(null).phase, EXPERIENCE_PHASES.READY);
});

test("start enters countdown, and countdown overflow becomes running time", () => {
  const ready = createExperienceLifecycle({
    countdownMs: 1_000,
    resumeCountdownMs: 0,
  });
  const started = transition(ready, EXPERIENCE_LIFECYCLE_EVENTS.START);

  assert.equal(started.accepted, true);
  assert.equal(started.state.phase, EXPERIENCE_PHASES.COUNTDOWN);
  assert.equal(started.state.countdownKind, EXPERIENCE_COUNTDOWN_KINDS.INITIAL);
  assert.equal(started.state.countdownRemainingMs, 1_000);
  assert.deepEqual(started.effects, [
    {
      type: EXPERIENCE_LIFECYCLE_EFFECTS.STARTED,
      attempt: 1,
      phase: EXPERIENCE_PHASES.COUNTDOWN,
    },
  ]);

  const running = transition(
    started.state,
    EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    { deltaMs: 1_250 },
  );
  assert.equal(running.state.phase, EXPERIENCE_PHASES.RUNNING);
  assert.equal(running.state.countdownRemainingMs, 0);
  assert.equal(running.state.elapsedMs, 250);
  assert.deepEqual(running.effects, [
    { type: EXPERIENCE_LIFECYCLE_EFFECTS.COUNTDOWN_COMPLETED },
  ]);
});

test("zero-length countdowns start immediately and running ticks accumulate", () => {
  let state = createExperienceLifecycle({
    countdownMs: 0,
    resumeCountdownMs: 0,
  });
  state = reduceExperienceLifecycle(state, EXPERIENCE_LIFECYCLE_EVENTS.START);
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    deltaMs: 16.5,
  });

  assert.equal(state.phase, EXPERIENCE_PHASES.RUNNING);
  assert.equal(state.elapsedMs, 16.5);
  assert.equal(isExperienceActive(state), true);

  const bounded = reduceExperienceLifecycle(
    { ...state, elapsedMs: Number.MAX_SAFE_INTEGER - 5 },
    {
      type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
      deltaMs: 10,
    },
  );
  assert.equal(bounded.elapsedMs, Number.MAX_SAFE_INTEGER);
});

test("pausing a countdown freezes and resumes the remaining countdown", () => {
  let state = createExperienceLifecycle({
    countdownMs: 3_000,
    resumeCountdownMs: 800,
    autoStart: true,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    deltaMs: 400,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
  });
  const frozen = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    deltaMs: 5_000,
  });

  assert.strictEqual(frozen, state);
  assert.equal(frozen.phase, EXPERIENCE_PHASES.PAUSED);
  assert.equal(frozen.resumePhase, EXPERIENCE_PHASES.COUNTDOWN);
  assert.equal(frozen.countdownRemainingMs, 2_600);

  const resumed = transition(
    frozen,
    EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
    { reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY },
  );
  assert.equal(resumed.state.phase, EXPERIENCE_PHASES.COUNTDOWN);
  assert.equal(resumed.state.countdownKind, EXPERIENCE_COUNTDOWN_KINDS.INITIAL);
  assert.equal(resumed.state.countdownRemainingMs, 2_600);
});

test("pause reasons stack and clearing one reason cannot override another", () => {
  let state = createExperienceLifecycle({
    countdownMs: 0,
    resumeCountdownMs: 500,
    autoStart: true,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
  });

  assert.deepEqual(state.pauseReasons, [
    EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
    EXPERIENCE_PAUSE_REASONS.MANUAL,
    EXPERIENCE_PAUSE_REASONS.VISIBILITY,
  ]);
  assert.equal(
    getPrimaryExperiencePauseReason(state),
    EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
  );

  const visibleAgain = transition(
    state,
    EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
    { reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY },
  );
  assert.equal(visibleAgain.state.phase, EXPERIENCE_PHASES.PAUSED);
  assert.deepEqual(visibleAgain.state.pauseReasons, [
    EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
    EXPERIENCE_PAUSE_REASONS.MANUAL,
  ]);
  assert.equal(
    visibleAgain.effects[0].type,
    EXPERIENCE_LIFECYCLE_EFFECTS.PAUSE_REASON_CLEARED,
  );

  const trackingRestored = reduceExperienceLifecycle(
    visibleAgain.state,
    {
      type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
      reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
    },
  );
  assert.equal(trackingRestored.phase, EXPERIENCE_PHASES.PAUSED);

  const manuallyResumed = transition(
    trackingRestored,
    EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
    { reason: EXPERIENCE_PAUSE_REASONS.MANUAL },
  );
  assert.equal(manuallyResumed.state.phase, EXPERIENCE_PHASES.COUNTDOWN);
  assert.equal(
    manuallyResumed.state.countdownKind,
    EXPERIENCE_COUNTDOWN_KINDS.RESUME,
  );
  assert.equal(manuallyResumed.state.countdownRemainingMs, 500);
  assert.deepEqual(manuallyResumed.state.pauseReasons, []);
});

test("a resumed running experience can skip the safety countdown by configuration", () => {
  let state = createExperienceLifecycle({
    countdownMs: 0,
    resumeCountdownMs: 0,
    autoStart: true,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
  });
  const resumed = transition(
    state,
    EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
    { reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS },
  );

  assert.equal(resumed.state.phase, EXPERIENCE_PHASES.RUNNING);
  assert.equal(resumed.effects[0].viaCountdown, false);
});

test("finish normalizes a result and freezes active time in the results phase", () => {
  let state = createExperienceLifecycle({
    countdownMs: 0,
    autoStart: true,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    deltaMs: 12_345,
  });
  const finished = transition(
    state,
    EXPERIENCE_LIFECYCLE_EVENTS.FINISH,
    {
      result: {
        outcome: "won",
        score: 42,
        metrics: { rally: 8 },
        personalBestMetricIds: ["score"],
      },
    },
  );

  assert.equal(finished.state.phase, EXPERIENCE_PHASES.RESULTS);
  assert.equal(finished.state.result.outcome, "won");
  assert.equal(finished.state.result.durationMs, 12_345);
  assert.deepEqual(finished.state.result.metrics, { rally: 8, score: 42 });
  assert.equal(finished.effects[0].type, EXPERIENCE_LIFECYCLE_EFFECTS.FINISHED);

  const ignoredTick = transition(
    finished.state,
    EXPERIENCE_LIFECYCLE_EVENTS.TICK,
    { deltaMs: 1_000 },
  );
  assert.equal(ignoredTick.accepted, false);
  assert.strictEqual(ignoredTick.state, finished.state);
  assert.equal(ignoredTick.state.elapsedMs, 12_345);
});

test("restart clears transient state, increments attempts, and starts predictably", () => {
  let state = createExperienceLifecycle({
    countdownMs: 700,
    autoStart: true,
  });
  state = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.FINISH,
    result: { outcome: "lost", score: 3 },
  });
  const restarted = transition(
    state,
    EXPERIENCE_LIFECYCLE_EVENTS.RESTART,
  );

  assert.equal(restarted.state.phase, EXPERIENCE_PHASES.COUNTDOWN);
  assert.equal(restarted.state.attempt, 2);
  assert.equal(restarted.state.elapsedMs, 0);
  assert.equal(restarted.state.result, null);
  assert.equal(restarted.state.countdownRemainingMs, 700);
  assert.equal(restarted.effects[0].type, EXPERIENCE_LIFECYCLE_EFFECTS.RESTARTED);

  const resetOnly = transition(
    restarted.state,
    EXPERIENCE_LIFECYCLE_EVENTS.RESTART,
    { start: false },
  );
  assert.equal(resetOnly.state.phase, EXPERIENCE_PHASES.READY);
  assert.equal(resetOnly.state.attempt, 3);
});

test("exit is an effectful request that does not invent a sixth lifecycle phase", () => {
  const state = createExperienceLifecycle({ autoStart: true });
  const exit = transition(state, EXPERIENCE_LIFECYCLE_EVENTS.EXIT);

  assert.equal(exit.accepted, true);
  assert.strictEqual(exit.state, state);
  assert.deepEqual(exit.effects, [
    {
      type: EXPERIENCE_LIFECYCLE_EFFECTS.EXIT_REQUESTED,
      phase: state.phase,
      attempt: 1,
      result: null,
    },
  ]);
  assert.equal(Object.values(EXPERIENCE_PHASES).length, 5);
});

test("invalid and duplicate transitions are inert while malformed state fails fast", () => {
  const state = createExperienceLifecycle({ autoStart: true });
  const unknown = transitionExperienceLifecycle(state, { type: "unknown" });
  assert.equal(unknown.accepted, false);
  assert.strictEqual(unknown.state, state);

  const paused = reduceExperienceLifecycle(state, {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
  });
  const duplicate = transition(
    paused,
    EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    { reason: EXPERIENCE_PAUSE_REASONS.MANUAL },
  );
  assert.equal(duplicate.accepted, false);
  assert.strictEqual(duplicate.state, paused);

  const invalidReason = transition(
    state,
    EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    { reason: "camera-maybe" },
  );
  assert.equal(invalidReason.accepted, false);
  assert.strictEqual(invalidReason.state, state);

  assert.throws(
    () =>
      transitionExperienceLifecycle(
        { ...state, phase: "broken" },
        EXPERIENCE_LIFECYCLE_EVENTS.START,
      ),
    /valid experience lifecycle state/,
  );
  assert.equal(
    isExperienceLifecycleState({
      ...state,
      phase: EXPERIENCE_PHASES.PAUSED,
      pauseReasons: [],
      resumePhase: EXPERIENCE_PHASES.RUNNING,
    }),
    false,
  );
});
