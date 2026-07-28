let handTrackingModule = null;
let handTrackingPromise = null;
let poseTrackingModule = null;
let poseTrackingPromise = null;

export function loadHandTrackingRuntime() {
  if (handTrackingModule) {
    return Promise.resolve(handTrackingModule);
  }
  if (!handTrackingPromise) {
    handTrackingPromise = import("./handTracking.js").then((module) => {
      handTrackingModule = module;
      return module;
    });
  }
  return handTrackingPromise;
}

export function loadPoseTrackingRuntime() {
  if (poseTrackingModule) {
    return Promise.resolve(poseTrackingModule);
  }
  if (!poseTrackingPromise) {
    poseTrackingPromise = import("./poseTracking.js").then((module) => {
      poseTrackingModule = module;
      return module;
    });
  }
  return poseTrackingPromise;
}

export async function initHandTracking(options) {
  return (await loadHandTrackingRuntime()).initHandTracking(options);
}

export async function detectHands(detector, videoElement) {
  return (await loadHandTrackingRuntime()).detectHands(detector, videoElement);
}

export function getCurrentBackend() {
  return handTrackingModule?.getCurrentBackend?.() ?? "n/a";
}

export function getCurrentRuntime() {
  return handTrackingModule?.getCurrentRuntime?.() ?? null;
}

export function getLastDetectionMeta() {
  return (
    handTrackingModule?.getLastDetectionMeta?.() ?? {
      handsDetected: 0,
      invalid: false,
      reason: "runtime_not_loaded",
    }
  );
}

export async function initPoseTracking(options) {
  return (await loadPoseTrackingRuntime()).initPoseTracking(options);
}

export async function detectPose(detector, videoElement) {
  return (await loadPoseTrackingRuntime()).detectPose(detector, videoElement);
}

export async function detectPoses(detector, videoElement, options) {
  return (await loadPoseTrackingRuntime()).detectPoses(detector, videoElement, options);
}

export function getLastPoseMeta() {
  return (
    poseTrackingModule?.getLastPoseMeta?.() ?? {
      posesDetected: 0,
      invalid: false,
      reason: "runtime_not_loaded",
    }
  );
}

export function getPoseRuntime() {
  return poseTrackingModule?.getPoseRuntime?.() ?? null;
}

export function getTrackingRuntimeLoadState() {
  return {
    hand: handTrackingModule ? "loaded" : handTrackingPromise ? "loading" : "idle",
    pose: poseTrackingModule ? "loaded" : poseTrackingPromise ? "loading" : "idle",
  };
}
