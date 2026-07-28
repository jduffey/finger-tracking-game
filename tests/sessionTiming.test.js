import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TIMING_STATES,
  createFixedStepSessionTiming,
} from "../src/sessionTiming.js";

test("accumulates partial frames and emits deterministic fixed steps", () => {
  const timing = createFixedStepSessionTiming({
    stepSeconds: 0.01,
    maxCatchUpSteps: 5,
  });
  const calls = [];

  timing.start(0);
  const partial = timing.advance(6, (...args) => calls.push(args));
  const stepped = timing.advance(26, (...args) => calls.push(args));

  assert.equal(partial.steps, 0);
  assert.equal(partial.accumulatorMs, 6);
  assert.equal(stepped.steps, 2);
  assert.equal(stepped.totalSteps, 2);
  assert.equal(stepped.simulatedElapsedMs, 20);
  assert.equal(stepped.activeElapsedMs, 26);
  assert.equal(stepped.accumulatorMs, 6);
  assert.equal(Number(stepped.interpolationAlpha.toFixed(2)), 0.6);
  assert.deepEqual(
    calls.map(([deltaSeconds, context]) => [
      deltaSeconds,
      context.stepIndex,
      context.simulatedElapsedMs,
    ]),
    [
      [0.01, 1, 10],
      [0.01, 2, 20],
    ],
  );
});

test("bounds catch-up work and reports discarded whole-step backlog", () => {
  const timing = createFixedStepSessionTiming({
    stepSeconds: 0.01,
    maxCatchUpSteps: 3,
  });
  let callbackCount = 0;

  timing.start(0);
  const delayedFrame = timing.advance(105, () => {
    callbackCount += 1;
  });

  assert.equal(delayedFrame.steps, 3);
  assert.equal(callbackCount, 3);
  assert.equal(delayedFrame.activeElapsedMs, 105);
  assert.equal(delayedFrame.simulatedElapsedMs, 30);
  assert.equal(delayedFrame.droppedFrameMs, 70);
  assert.equal(delayedFrame.droppedElapsedMs, 70);
  assert.equal(delayedFrame.accumulatorMs, 5);
  assert.equal(delayedFrame.interpolationAlpha, 0.5);

  const nextFrame = timing.advance(110);
  assert.equal(nextFrame.steps, 1);
  assert.equal(nextFrame.simulatedElapsedMs, 40);
  assert.equal(nextFrame.droppedElapsedMs, 70);
  assert.equal(nextFrame.accumulatorMs, 0);
});

test("pause and resume exclude paused time without a catch-up jump", () => {
  const timing = createFixedStepSessionTiming({
    stepSeconds: 0.01,
    maxCatchUpSteps: 4,
  });

  timing.start(0);
  timing.advance(20);
  const paused = timing.pause(25);
  const whilePaused = timing.advance(1000);
  const resumed = timing.resume(1000);
  const firstResumedFrame = timing.advance(1010);

  assert.equal(paused.state, SESSION_TIMING_STATES.PAUSED);
  assert.equal(paused.activeElapsedMs, 25);
  assert.equal(paused.discardedFrameMs, 5);
  assert.equal(whilePaused.steps, 0);
  assert.equal(whilePaused.sessionElapsedMs, 1000);
  assert.equal(whilePaused.activeElapsedMs, 25);
  assert.equal(whilePaused.pausedElapsedMs, 975);
  assert.equal(resumed.state, SESSION_TIMING_STATES.RUNNING);
  assert.equal(resumed.steps, 0);
  assert.equal(firstResumedFrame.frameDeltaMs, 10);
  assert.equal(firstResumedFrame.steps, 1);
  assert.equal(firstResumedFrame.activeElapsedMs, 35);
  assert.equal(firstResumedFrame.sessionElapsedMs, 1010);
  assert.equal(firstResumedFrame.simulatedElapsedMs, 30);
});

test("tracks active, paused, simulated, and total session clocks separately", () => {
  const timing = createFixedStepSessionTiming({
    stepSeconds: 0.1,
    maxCatchUpSteps: 3,
  });

  timing.start(100);
  timing.advance(350);
  timing.pause(400);
  const pausedSnapshot = timing.snapshot(900);
  timing.resume(900);
  timing.advance(1000);
  const stopped = timing.stop(1100);
  const laterSnapshot = timing.snapshot(5000);

  assert.equal(pausedSnapshot.sessionElapsedMs, 800);
  assert.equal(pausedSnapshot.activeElapsedMs, 300);
  assert.equal(pausedSnapshot.pausedElapsedMs, 500);
  assert.equal(stopped.state, SESSION_TIMING_STATES.STOPPED);
  assert.equal(stopped.sessionElapsedMs, 1000);
  assert.equal(stopped.activeElapsedMs, 500);
  assert.equal(stopped.pausedElapsedMs, 500);
  assert.equal(stopped.simulatedElapsedMs, 300);
  assert.equal(stopped.elapsedMs, stopped.activeElapsedMs);
  assert.equal(laterSnapshot.sessionElapsedMs, stopped.sessionElapsedMs);
  assert.equal(laterSnapshot.activeElapsedMs, stopped.activeElapsedMs);
});

test("the first advance can establish the time origin and reset clears every clock", () => {
  const timing = createFixedStepSessionTiming({
    stepSeconds: 0.02,
    maxCatchUpSteps: 2,
  });

  const started = timing.advance(500);
  const advanced = timing.advance(540);
  const reset = timing.reset();

  assert.equal(started.state, SESSION_TIMING_STATES.RUNNING);
  assert.equal(started.startedAtMs, 500);
  assert.equal(started.steps, 0);
  assert.equal(advanced.steps, 2);
  assert.equal(reset.state, SESSION_TIMING_STATES.IDLE);
  assert.equal(reset.startedAtMs, null);
  assert.equal(reset.elapsedMs, 0);
  assert.equal(reset.sessionElapsedMs, 0);
  assert.equal(reset.totalSteps, 0);
});

test("supports an injected clock and a configured step callback", () => {
  let now = 250;
  const calls = [];
  const timing = createFixedStepSessionTiming({
    maxCatchUpSteps: 3,
    now: () => now,
    onStep: (deltaSeconds, context) => {
      calls.push([deltaSeconds, context.stepIndex]);
    },
    stepSeconds: 0.01,
  });

  timing.start();
  now = 275;
  const frame = timing.advance();

  assert.equal(frame.startedAtMs, 250);
  assert.equal(frame.steps, 2);
  assert.deepEqual(calls, [
    [0.01, 1],
    [0.01, 2],
  ]);
});

test("non-monotonic timestamps are clamped instead of producing negative time", () => {
  const timing = createFixedStepSessionTiming({
    stepSeconds: 0.01,
    maxCatchUpSteps: 3,
  });

  timing.start(100);
  timing.advance(120);
  const backwards = timing.advance(110);

  assert.equal(backwards.frameDeltaMs, 0);
  assert.equal(backwards.lastTimestampMs, 120);
  assert.equal(backwards.activeElapsedMs, 20);
  assert.equal(backwards.steps, 0);
});

test("validates fixed-step configuration and timestamps", () => {
  assert.throws(
    () => createFixedStepSessionTiming({ stepSeconds: 0 }),
    /stepSeconds must be a positive finite number/,
  );
  assert.throws(
    () => createFixedStepSessionTiming({ maxCatchUpSteps: 1.5 }),
    /maxCatchUpSteps must be a positive integer/,
  );

  const timing = createFixedStepSessionTiming();
  assert.throws(() => timing.start(Number.NaN), /timestamp must be a non-negative finite number/);
  assert.throws(() => timing.start(-1), /timestamp must be a non-negative finite number/);
});
