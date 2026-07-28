import test from "node:test";
import assert from "node:assert/strict";

import {
  TRACKING_READINESS_STATES,
  classifyCameraError,
  createTrackingReadinessState,
  getCameraErrorPresentation,
  getReadinessProgress,
  reduceTrackingReadiness,
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

test("readiness reducer progresses from consent through a verified pointer", () => {
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
  assert.equal(state.status, TRACKING_READINESS_STATES.READY);
  assert.equal(getReadinessProgress(state), 1);
});

test("camera failure clears stale readiness and keeps a useful error", () => {
  const state = reduceTrackingReadiness(
    createTrackingReadinessState({
      status: TRACKING_READINESS_STATES.READY,
      cameraReady: true,
      modelReady: true,
      handDetected: true,
      pointerReady: true,
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
    }),
    { type: "TRACK_INTERRUPTED" },
  );
  const stopped = reduceTrackingReadiness(interrupted, { type: "STOP" });

  assert.equal(interrupted.status, TRACKING_READINESS_STATES.INTERRUPTED);
  assert.equal(interrupted.pointerReady, false);
  assert.deepEqual(stopped, createTrackingReadinessState());
});
