export const CAMERA_FAILURE_SCENARIOS = Object.freeze({
  dismissed: Object.freeze({
    errorName: "NotAllowedError",
    errorMessage: "The camera prompt was dismissed by the test player.",
    permissionState: "prompt",
  }),
  denied: Object.freeze({
    errorName: "NotAllowedError",
    errorMessage: "Camera permission was denied by the test browser.",
  }),
  noDevice: Object.freeze({
    errorName: "NotFoundError",
    errorMessage: "No camera is connected to the test browser.",
  }),
  busy: Object.freeze({
    errorName: "NotReadableError",
    errorMessage: "The camera is already in use by another test application.",
  }),
});

function createFakeVideoDevices(labels = ["Built-in test camera"]) {
  return labels.map((label, index) => ({
    deviceId: `e2e-camera-${index + 1}`,
    groupId: "e2e-camera-group",
    kind: "videoinput",
    label,
  }));
}

/**
 * Installs a deterministic mediaDevices implementation before application code
 * runs. This exercises the real setup reducer and UI without touching camera
 * hardware or relying on browser permission state.
 */
export async function installCameraFailureStub(
  page,
  {
    errorName,
    errorMessage,
    deviceLabels = ["Built-in test camera"],
    permissionState,
  },
) {
  await page.addInitScript(
    ({ devices, failureName, failureMessage, permission }) => {
      const state = {
        mediaRequestCount: 0,
      };
      globalThis.__motionArcadeTrackingE2E = state;

      const mediaDevices = {
        addEventListener() {},
        removeEventListener() {},
        async enumerateDevices() {
          return devices;
        },
        async getUserMedia() {
          state.mediaRequestCount += 1;
          throw new DOMException(failureMessage, failureName);
        },
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });
      if (permission) {
        Object.defineProperty(navigator, "permissions", {
          configurable: true,
          value: {
            async query({ name }) {
              if (name !== "camera") {
                throw new TypeError("Unsupported synthetic permission.");
              }
              return {
                addEventListener() {},
                removeEventListener() {},
                state: permission,
              };
            },
          },
        });
      }
    },
    {
      devices: createFakeVideoDevices(deviceLabels),
      failureName: errorName,
      failureMessage: errorMessage,
      permission: permissionState,
    },
  );
}

/**
 * Supplies a synthetic, animated canvas stream. The stream has a genuine live
 * MediaStreamTrack, so application playback and cleanup paths remain covered.
 */
export async function installSyntheticCameraStub(
  page,
  {
    deviceLabels = ["Synthetic test camera"],
    failAfterRequestCount = null,
    subsequentFailureName = "NotReadableError",
    subsequentFailureMessage = "The selected test camera is busy.",
  } = {},
) {
  await page.addInitScript(
    ({
      devices,
      failureAfter,
      failureMessage,
      failureName,
    }) => {
      const state = {
        cameraPlaybackCount: 0,
        canvases: [],
        mediaRequestCount: 0,
        requestedConstraints: [],
        timers: [],
        trackStopCount: 0,
      };
      globalThis.__motionArcadeTrackingE2E = state;
      const nativeMediaPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function playSyntheticStream(...args) {
        return Promise.resolve(nativeMediaPlay.apply(this, args)).then((result) => {
          if (this.srcObject) {
            state.cameraPlaybackCount += 1;
          }
          return result;
        });
      };

      const createStream = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        const stream = canvas.captureStream(12);
        const track = stream.getVideoTracks()[0];
        let frame = 0;

        const paintFrame = () => {
          frame += 1;
          context.fillStyle = frame % 2 ? "#17223b" : "#1f6f78";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#ffffff";
          context.fillRect(220, 140, 200, 200);
        };
        paintFrame();
        const timer = setInterval(paintFrame, 80);

        const originalStop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(timer);
          state.trackStopCount += 1;
          originalStop();
        };
        const originalSettings = track.getSettings.bind(track);
        track.getSettings = () => ({
          ...originalSettings(),
          deviceId: devices[0].deviceId,
          height: canvas.height,
          width: canvas.width,
        });

        state.canvases.push(canvas);
        state.timers.push(timer);
        return stream;
      };

      const mediaDevices = {
        addEventListener() {},
        removeEventListener() {},
        async enumerateDevices() {
          return devices;
        },
        async getUserMedia(constraints) {
          state.mediaRequestCount += 1;
          state.requestedConstraints.push(constraints);
          if (
            Number.isFinite(failureAfter) &&
            state.mediaRequestCount > failureAfter
          ) {
            throw new DOMException(failureMessage, failureName);
          }
          return createStream();
        },
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });
    },
    {
      devices: createFakeVideoDevices(deviceLabels),
      failureAfter: failAfterRequestCount,
      failureMessage: subsequentFailureMessage,
      failureName: subsequentFailureName,
    },
  );
}

export async function getCameraRequestCount(page) {
  return page.evaluate(
    () => globalThis.__motionArcadeTrackingE2E?.mediaRequestCount ?? 0,
  );
}

export async function getModelInitializationCount(page) {
  return page.evaluate(
    () => globalThis.__motionArcadeTrackingE2E?.modelInitializationCount ?? 0,
  );
}

export async function getCameraTrackStopCount(page) {
  return page.evaluate(
    () => globalThis.__motionArcadeTrackingE2E?.trackStopCount ?? 0,
  );
}

/**
 * Keeps the independently loaded tracking runtime pending while camera-error
 * behavior is under test. Otherwise a fast model load can overwrite the camera
 * error state before the player has time to use its recovery actions.
 */
export async function holdTrackingModelInitialization(page) {
  await page.route("**/src/handTracking.js*", (route) =>
    route.fulfill({
      body: [
        "export function initHandTracking() { return new Promise(() => {}); }",
        "export async function detectHands() { return []; }",
        "export function getCurrentBackend() { return 'e2e'; }",
        "export function getCurrentRuntime() { return 'e2e'; }",
        "export function getLastDetectionMeta() {",
        "  return { handsDetected: 0, invalid: false, reason: 'e2e_pending' };",
        "}",
      ].join("\n"),
      contentType: "text/javascript",
      status: 200,
    }),
  );
}

export async function installSuccessfulTrackingModelStub(page) {
  await page.route("**/src/handTracking.js*", (route) =>
    route.fulfill({
      body: [
        "export async function initHandTracking() {",
        "  return { dispose() {}, estimateHands: async () => [] };",
        "}",
        "export async function detectHands() { return []; }",
        "export function getCurrentBackend() { return 'e2e'; }",
        "export function getCurrentRuntime() { return 'e2e'; }",
        "export function getLastDetectionMeta() {",
        "  return { handsDetected: 0, invalid: false, reason: 'no_hands' };",
        "}",
      ].join("\n"),
      contentType: "text/javascript",
      status: 200,
    }),
  );
}

export async function installFailingTrackingModelStub(page) {
  await page.route("**/src/handTracking.js*", (route) =>
    route.fulfill({
      body: [
        "function getState() {",
        "  globalThis.__motionArcadeTrackingE2E ??= {};",
        "  return globalThis.__motionArcadeTrackingE2E;",
        "}",
        "async function waitForCameraPlayback() {",
        "  const state = getState();",
        "  for (let attempt = 0; attempt < 500; attempt += 1) {",
        "    if ((state.cameraPlaybackCount ?? 0) > 0) {",
        "      await new Promise((resolve) => setTimeout(resolve, 20));",
        "      return;",
        "    }",
        "    await new Promise((resolve) => setTimeout(resolve, 20));",
        "  }",
        "}",
        "export async function initHandTracking(options = {}) {",
        "  await waitForCameraPlayback();",
        "  const state = getState();",
        "  state.modelRuntimeAttempts ??= [];",
        "  state.modelRuntimeAttempts.push(options.runtime ?? 'unknown');",
        "  if (options.runtime === 'mediapipe') {",
        "    state.modelInitializationCount =",
        "      (state.modelInitializationCount ?? 0) + 1;",
        "  }",
        "  throw new Error(`Synthetic ${options.runtime ?? 'unknown'} model failure.`);",
        "}",
        "export async function detectHands() { return []; }",
        "export function getCurrentBackend() { return 'e2e'; }",
        "export function getCurrentRuntime() { return 'e2e'; }",
        "export function getLastDetectionMeta() {",
        "  return { handsDetected: 0, invalid: false, reason: 'e2e_model_failure' };",
        "}",
      ].join("\n"),
      contentType: "text/javascript",
      status: 200,
    }),
  );
}
