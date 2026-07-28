import test from "node:test";
import assert from "node:assert/strict";

import {
  TRACKING_INTERACTION_TARGET,
  TRACKING_READINESS_STATES,
  classifyCameraError,
  createTrackingInteractionCheck,
  createTrackingReadinessState,
  getCameraErrorPresentation,
  getReadinessProgress,
  getTrackingInteractionPresentation,
  reduceTrackingReadiness,
  updateTrackingInteractionCheck,
} from "../src/trackingReadiness.js";

test("classifies common camera failures into actionable states", () => {
  assert.equal(
    classifyCameraError({ name: "NotAllowedError" }),
    TRACKING_READINESS_STATES.DENIED,
  );
  assert.equal(
    classifyCameraError({ name: "NotFoundError" }),
    TRACKING_READINESS_STATES.NO_DEVICE,
  );
  assert.equal(
    classifyCameraError({ name: "NotReadableError" }),
    TRACKING_READINESS_STATES.DEVICE_BUSY,
  );
  assert.equal(
    classifyCameraError({ name: "SecurityError" }),
    TRACKING_READINESS_STATES.INSECURE,
  );
  assert.equal(
    classifyCameraError({ name: "UnknownError" }),
    TRACKING_READINESS_STATES.ERROR,
  );
});

test("readiness reducer requires a verified pointer and pinch", () => {
  let state = createTrackingReadinessState();

  state = reduceTrackingReadiness(state, { type: "START_REQUEST" });
  assert.equal(state.status, TRACKING_READINESS_STATES.REQUESTING_CAMERA);
  state = reduceTrackingReadiness(state, { type: "CAMERA_READY", deviceId: "camera-1" });
  assert.equal(state.cameraReady, true);
  assert.equal(state.activeStep, 1);
  state = reduceTrackingReadiness(state, { type: "MODEL_READY" });
  assert.equal(state.modelReady, true);
  assert.equal(state.activeStep, 2);
  state = reduceTrackingReadiness(state, { type: "HAND_DETECTED", detected: true });
  assert.equal(state.activeStep, 3);
  state = reduceTrackingReadiness(state, { type: "POINTER_READY", ready: true });
  assert.equal(state.status, TRACKING_READINESS_STATES.POSITIONING);
  assert.equal(getReadinessProgress(state), 0.875);
  state = reduceTrackingReadiness(state, { type: "PINCH_READY", ready: true });
  assert.equal(state.status, TRACKING_READINESS_STATES.READY);
  assert.equal(getReadinessProgress(state), 1);
});

test("a completed interaction remains ready if the player lowers their hand", () => {
  const ready = createTrackingReadinessState({
    status: TRACKING_READINESS_STATES.READY,
    cameraReady: true,
    modelReady: true,
    handDetected: true,
    pointerReady: true,
    pinchReady: true,
    activeStep: 3,
  });
  const loweredHand = reduceTrackingReadiness(ready, {
    type: "HAND_DETECTED",
    detected: false,
  });
  const synchronizedPointer = reduceTrackingReadiness(loweredHand, {
    type: "POINTER_READY",
    ready: true,
  });
  const synchronizedPinch = reduceTrackingReadiness(synchronizedPointer, {
    type: "PINCH_READY",
    ready: true,
  });
  const reset = reduceTrackingReadiness(synchronizedPinch, {
    type: "RESET_INTERACTION",
  });

  assert.equal(loweredHand.status, TRACKING_READINESS_STATES.READY);
  assert.equal(loweredHand.handDetected, false);
  assert.equal(loweredHand.pinchReady, true);
  assert.equal(synchronizedPinch.status, TRACKING_READINESS_STATES.READY);
  assert.equal(synchronizedPinch.handDetected, false);
  assert.equal(reset.status, TRACKING_READINESS_STATES.POSITIONING);
  assert.equal(reset.pointerReady, false);
  assert.equal(reset.pinchReady, false);
});

test("interaction check requires a stable hold before accepting a pinch", () => {
  let check = createTrackingInteractionCheck();
  const sample = (timestamp, pinchActive = false) => {
    check = updateTrackingInteractionCheck(check, {
      handDetected: true,
      pinchActive,
      pointerU: TRACKING_INTERACTION_TARGET.u,
      pointerV: TRACKING_INTERACTION_TARGET.v,
      timestamp,
    });
  };

  for (let timestamp = 0; timestamp <= 600; timestamp += 100) {
    sample(timestamp);
  }

  assert.equal(check.pointerReady, true);
  assert.equal(check.pinchReady, false);
  assert.equal(getTrackingInteractionPresentation(check).phase, "pinch");

  sample(633, true);
  assert.equal(check.complete, true);
  assert.equal(check.pinchReady, true);
  assert.equal(getTrackingInteractionPresentation(check).phase, "complete");
});

test("leaving the target or pausing samples resets an unfinished steady hold", () => {
  let check = createTrackingInteractionCheck();
  const centeredSample = (timestamp) => ({
    handDetected: true,
    pinchActive: false,
    pointerU: TRACKING_INTERACTION_TARGET.u,
    pointerV: TRACKING_INTERACTION_TARGET.v,
    timestamp,
  });

  check = updateTrackingInteractionCheck(check, centeredSample(0));
  check = updateTrackingInteractionCheck(check, centeredSample(100));
  check = updateTrackingInteractionCheck(check, centeredSample(200));
  assert.equal(check.holdMs, 200);

  check = updateTrackingInteractionCheck(check, {
    ...centeredSample(250),
    pointerU: 0.1,
  });
  assert.equal(check.holdMs, 0);
  check = updateTrackingInteractionCheck(check, centeredSample(300));
  check = updateTrackingInteractionCheck(check, centeredSample(600));
  assert.equal(check.holdMs, 0);
  assert.equal(check.pointerReady, false);
});

test("a pre-held pinch must be released and pinched again deliberately", () => {
  let check = createTrackingInteractionCheck();
  for (let timestamp = 0; timestamp <= 600; timestamp += 100) {
    check = updateTrackingInteractionCheck(check, {
      handDetected: true,
      pinchActive: true,
      pointerU: TRACKING_INTERACTION_TARGET.u,
      pointerV: TRACKING_INTERACTION_TARGET.v,
      timestamp,
    });
  }

  assert.equal(check.pointerReady, true);
  assert.equal(check.pinchArmed, false);
  assert.equal(check.complete, false);

  check = updateTrackingInteractionCheck(check, {
    handDetected: true,
    pinchActive: false,
    pointerU: TRACKING_INTERACTION_TARGET.u,
    pointerV: TRACKING_INTERACTION_TARGET.v,
    timestamp: 633,
  });
  check = updateTrackingInteractionCheck(check, {
    handDetected: true,
    pinchActive: true,
    pointerU: TRACKING_INTERACTION_TARGET.u,
    pointerV: TRACKING_INTERACTION_TARGET.v,
    timestamp: 666,
  });
  assert.equal(check.complete, true);
});

test("camera failure clears stale readiness and keeps a useful error", () => {
  const state = reduceTrackingReadiness(
    createTrackingReadinessState({
      status: TRACKING_READINESS_STATES.READY,
      cameraReady: true,
      modelReady: true,
      handDetected: true,
      pointerReady: true,
      pinchReady: true,
    }),
    {
      type: "CAMERA_ERROR",
      error: { name: "NotAllowedError", message: "Permission denied" },
    },
  );

  assert.equal(state.status, TRACKING_READINESS_STATES.DENIED);
  assert.equal(state.cameraReady, false);
  assert.equal(state.modelReady, false);
  assert.equal(state.handDetected, false);
  assert.equal(state.pointerReady, false);
  assert.equal(state.pinchReady, false);
  assert.equal(getCameraErrorPresentation(state.status)?.primaryAction, "Try again");
});

test("interruption pauses readiness and stop returns to an explicit idle state", () => {
  const interrupted = reduceTrackingReadiness(
    createTrackingReadinessState({
      status: TRACKING_READINESS_STATES.READY,
      cameraReady: true,
      modelReady: true,
      handDetected: true,
      pointerReady: true,
      pinchReady: true,
    }),
    { type: "TRACK_INTERRUPTED" },
  );
  const stopped = reduceTrackingReadiness(interrupted, { type: "STOP" });

  assert.equal(interrupted.status, TRACKING_READINESS_STATES.INTERRUPTED);
  assert.equal(interrupted.pointerReady, false);
  assert.equal(interrupted.pinchReady, false);
  assert.deepEqual(stopped, createTrackingReadinessState());
});
