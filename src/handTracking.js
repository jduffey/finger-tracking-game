import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { createScopedLogger } from "./logger";

const HAND_MODEL = handPoseDetection.SupportedModels.MediaPipeHands;
const trackingLog = createScopedLogger("handTracking");
const INVALID_VALUE_LOG_INTERVAL = 30;
const MEDIAPIPE_SOLUTION_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";
const DEFAULT_RUNTIME = "tfjs";
const DEFAULT_MODEL_TYPE = "full";
const DEFAULT_MAX_HANDS = 1;
const FINGER_TIP_INDEX_BY_NAME = {
  thumb: 4,
  index: 8,
  middle: 12,
  ring: 16,
  pinky: 20,
};

let lastDetectionMeta = {
  handsDetected: 0,
  invalid: false,
  reason: "none",
};
let invalidValueStreak = 0;
let activeRuntime = DEFAULT_RUNTIME;

export async function initHandTracking(options = {}) {
  const runtime = options.runtime ?? DEFAULT_RUNTIME;
  const backend = options.backend ?? "webgl";
  const modelType = options.modelType ?? DEFAULT_MODEL_TYPE;
  const maxHands = Number.isFinite(options.maxHands) ? options.maxHands : DEFAULT_MAX_HANDS;
  const detectorConfig = {
    runtime,
    modelType,
    maxHands,
    ...(runtime === "mediapipe" ? { solutionPath: MEDIAPIPE_SOLUTION_PATH } : {}),
  };

  trackingLog.info("Initializing hand tracking detector", {
    runtime,
    requestedBackend: backend,
    detectorConfig,
  });

  if (runtime === "tfjs") {
    const activeBefore = tf.getBackend();
    if (activeBefore !== backend) {
      trackingLog.debug("Setting TFJS backend", { backend, activeBefore });
      await tf.setBackend(backend);
    } else {
      trackingLog.debug("TFJS backend already active", { backend });
    }
    trackingLog.debug("Waiting for TFJS ready");
    await tf.ready();
  } else {
    trackingLog.debug("Skipping TFJS backend setup for non-TFJS runtime", {
      runtime,
      activeBackend: tf.getBackend(),
    });
  }

  const detector = await handPoseDetection.createDetector(HAND_MODEL, detectorConfig);
  activeRuntime = runtime;
  trackingLog.info("Hand tracking detector initialized", {
    runtime: activeRuntime,
    activeBackend: tf.getBackend(),
  });
  return detector;
}

export function getCurrentBackend() {
  return tf.getBackend();
}

export function getCurrentRuntime() {
  return activeRuntime;
}

export function getLastDetectionMeta() {
  return { ...lastDetectionMeta };
}

export async function detectPrimaryHand(detector, videoElement) {
  trackingLog.debug("Running hand detection frame", {
    hasDetector: Boolean(detector),
    hasVideoElement: Boolean(videoElement),
    readyState: videoElement?.readyState ?? null,
  });
  if (!detector || !videoElement || videoElement.readyState < 2) {
    lastDetectionMeta = {
      handsDetected: 0,
      invalid: false,
      reason: "detector_or_video_not_ready",
    };
    trackingLog.debug("Skipping hand detection due to missing detector/video readiness");
    return null;
  }

  let hands = null;
  try {
    hands = await detector.estimateHands(videoElement, {
      flipHorizontal: false,
    });
  } catch (error) {
    invalidValueStreak += 1;
    lastDetectionMeta = {
      handsDetected: 0,
      invalid: true,
      reason: "estimate_hands_failed",
    };
    trackingLog.error("estimateHands failed", {
      invalidValueStreak,
      error,
      activeBackend: tf.getBackend(),
    });
    return null;
  }
  trackingLog.debug("Received hand detection results", {
    handCount: hands?.length ?? 0,
  });

  if (!hands || hands.length === 0) {
    invalidValueStreak = 0;
    lastDetectionMeta = {
      handsDetected: 0,
      invalid: false,
      reason: "no_hands",
    };
    trackingLog.debug("No hands detected on frame");
    return null;
  }

  // Prefer the most confident hand, but still iterate candidates so a bad first
  // hand does not suppress valid coordinates from another detection.
  const sortedHands = [...hands].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
  const width = Math.max(1, videoElement.videoWidth || videoElement.clientWidth);
  const height = Math.max(1, videoElement.videoHeight || videoElement.clientHeight);

  for (const candidate of sortedHands) {
    const keypoints = candidate?.keypoints ?? [];
    const fingerTips = extractFingerTips(keypoints, width, height);
    const indexTip = fingerTips.index;
    const thumbTip = fingerTips.thumb;

    if (!indexTip || !thumbTip) {
      continue;
    }

    const dx = thumbTip.u - indexTip.u;
    const dy = thumbTip.v - indexTip.v;
    const pinchDistance = Math.hypot(dx, dy);

    if (!Number.isFinite(pinchDistance)) {
      continue;
    }

    const landmarks = [];
    for (const point of keypoints) {
      const normalized = toMirroredNormalized(point, width, height);
      if (normalized) {
        landmarks.push(normalized);
      }
    }

    invalidValueStreak = 0;
    lastDetectionMeta = {
      handsDetected: hands.length,
      invalid: false,
      reason: "ok",
    };
    const score = Number.isFinite(candidate.score) ? candidate.score : 0;

    trackingLog.debug("Primary hand extracted", {
      runtime: activeRuntime,
      score,
      pinchDistance,
      indexTip,
      thumbTip,
      fingerTipsDetected: summarizeFingerTips(fingerTips),
      videoWidth: width,
      videoHeight: height,
      landmarksCount: landmarks.length,
    });

    return {
      score,
      indexTip,
      thumbTip,
      fingerTips,
      pinchDistance,
      landmarks,
    };
  }

  invalidValueStreak += 1;
  lastDetectionMeta = {
    handsDetected: hands.length,
    invalid: true,
    reason: "non_finite_keypoint_values",
  };
  if (invalidValueStreak <= 5 || invalidValueStreak % INVALID_VALUE_LOG_INTERVAL === 0) {
    const firstHand = sortedHands[0];
    const firstKeypoints = firstHand?.keypoints ?? [];
    trackingLog.warn("Ignoring hand with invalid fingertip coordinates", {
      runtime: activeRuntime,
      invalidValueStreak,
      firstHandScore: firstHand?.score ?? null,
      firstHandKeypointCount: firstKeypoints.length,
      indexTipSummary: summarizePoint(firstKeypoints[8]),
      thumbTipSummary: summarizePoint(firstKeypoints[4]),
    });
  }
  return null;
}

function toMirroredNormalized(point, width, height) {
  const numeric = extractPoint(point);
  if (!numeric) {
    return null;
  }

  const { x, y, normalized } = numeric;
  if (normalized) {
    return {
      u: clamp01(1 - x),
      v: clamp01(y),
    };
  }

  return {
    u: clamp01(1 - x / width),
    v: clamp01(y / height),
  };
}

function extractFingerTips(keypoints, width, height) {
  const tips = {
    thumb: null,
    index: null,
    middle: null,
    ring: null,
    pinky: null,
  };

  for (const [fingerName, keypointIndex] of Object.entries(FINGER_TIP_INDEX_BY_NAME)) {
    const keypoint = keypoints[keypointIndex];
    const normalized = toMirroredNormalized(keypoint, width, height);
    tips[fingerName] = normalized || null;
  }

  return tips;
}

function summarizeFingerTips(fingerTips) {
  return {
    thumb: Boolean(fingerTips?.thumb),
    index: Boolean(fingerTips?.index),
    middle: Boolean(fingerTips?.middle),
    ring: Boolean(fingerTips?.ring),
    pinky: Boolean(fingerTips?.pinky),
  };
}

function extractPoint(point) {
  if (!point) {
    return null;
  }

  if (Number.isFinite(point.u) && Number.isFinite(point.v)) {
    return { x: point.u, y: point.v, normalized: true };
  }

  if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const normalized = point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
    return { x: point.x, y: point.y, normalized };
  }

  if (Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
    const x = point[0];
    const y = point[1];
    const normalized = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    return { x, y, normalized };
  }

  return null;
}

function summarizePoint(point) {
  if (!point || typeof point !== "object") {
    return point;
  }
  return {
    hasX: "x" in point,
    hasY: "y" in point,
    hasU: "u" in point,
    hasV: "v" in point,
    x: point.x,
    y: point.y,
    u: point.u,
    v: point.v,
    asArray0: point[0],
    asArray1: point[1],
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
