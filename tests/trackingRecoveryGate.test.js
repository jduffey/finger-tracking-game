import assert from "node:assert/strict";
import test from "node:test";

import {
  TRACKING_LOSS_GRACE_MS,
  TRACKING_REACQUIRE_STABLE_MS,
  TRACKING_RECOVERY_PHASES,
  advanceTrackingRecoveryGate,
  createTrackingRecoveryGate,
  getTrackingRecoveryStatus,
} from "../src/trackingRecoveryGate.js";

test("brief detection gaps stay inside the confidence grace window", () => {
  let state = createTrackingRecoveryGate();
  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: false,
    now: 1_000,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.LOSS_GRACE);

  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: true,
    now: 1_000 + TRACKING_LOSS_GRACE_MS - 1,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.CLEAR);
  assert.equal(getTrackingRecoveryStatus(state).shouldPause, false);
});

test("sustained loss pauses and requires three stable seconds to clear", () => {
  let state = createTrackingRecoveryGate();
  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: false,
    now: 2_000,
  });
  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: false,
    now: 2_000 + TRACKING_LOSS_GRACE_MS,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.LOST);
  assert.equal(getTrackingRecoveryStatus(state).shouldPause, true);

  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: true,
    now: 3_000,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.REACQUIRING);

  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: true,
    now: 3_000 + TRACKING_REACQUIRE_STABLE_MS - 1,
  });
  const almostReady = getTrackingRecoveryStatus(state);
  assert.equal(almostReady.shouldPause, true);
  assert.equal(almostReady.remainingMs, 1);

  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: true,
    now: 3_000 + TRACKING_REACQUIRE_STABLE_MS,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.CLEAR);
  assert.equal(getTrackingRecoveryStatus(state).shouldPause, false);
});

test("a reacquisition blip resets stable progress without charging gameplay", () => {
  let state = {
    phase: TRACKING_RECOVERY_PHASES.LOST,
    missingSince: 100,
    stableSince: null,
    updatedAt: 1_000,
  };
  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: true,
    now: 1_100,
  });
  state = advanceTrackingRecoveryGate(state, {
    required: true,
    detected: false,
    now: 2_000,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.LOST);
  assert.equal(state.stableSince, null);

  state = advanceTrackingRecoveryGate(state, {
    required: false,
    detected: false,
    now: 2_100,
  });
  assert.equal(state.phase, TRACKING_RECOVERY_PHASES.CLEAR);
});
