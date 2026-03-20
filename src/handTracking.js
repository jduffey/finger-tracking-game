import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { createScopedLogger } from "./logger.js";

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

export async function detectHands(detector, videoElement) {
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
    return [];
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
    return [];
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
    return [];
  }

  // Prefer confident hands first while still iterating all candidates so a bad
  // first hand does not suppress valid coordinates from another detection.
  const sortedHands = [...hands].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
  const width = Math.max(1, videoElement.videoWidth || videoElement.clientWidth);
  const height = Math.max(1, videoElement.videoHeight || videoElement.clientHeight);
  const extractedHands = [];

  for (const candidate of sortedHands) {
    const extracted = extractHandCandidate(candidate, width, height);
    if (extracted) {
      extractedHands.push(extracted);
    }
  }

  if (extractedHands.length > 0) {
    invalidValueStreak = 0;
    lastDetectionMeta = {
      handsDetected: extractedHands.length,
      invalid: false,
      reason: "ok",
    };
    trackingLog.debug("Hands extracted", {
      runtime: activeRuntime,
      handCount: extractedHands.length,
      videoWidth: width,
      videoHeight: height,
      hands: extractedHands.map((hand, index) => ({
        index,
        score: hand.score,
        handedness: hand.handedness,
        pinchDistance: hand.pinchDistance,
        landmarksCount: hand.landmarks.length,
      })),
    });
    return extractedHands;
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
  return [];
}

export async function detectPrimaryHand(detector, videoElement) {
  const hands = await detectHands(detector, videoElement);
  return hands[0] ?? null;
}

function toMirroredNormalized(point, width, height) {
  const numeric = extractPoint(point);
  if (!numeric) {
    return null;
  }

  const { x, y, normalized } = numeric;
  const uRaw = normalized ? 1 - x : 1 - x / width;
  const vRaw = normalized ? y : y / height;
  const u = clamp01(uRaw);
  const v = clamp01(vRaw);

  return {
    u,
    v,
    uRaw,
    vRaw,
    wasClamped: u !== uRaw || v !== vRaw,
  };
}

function toMirroredMetricPoint(point) {
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(point.z)
  ) {
    return null;
  }

  return {
    x: -point.x,
    y: point.y,
    z: point.z,
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

function extractLandmarks3D(keypoints3D) {
  if (!Array.isArray(keypoints3D)) {
    return [];
  }
  return keypoints3D.map((point) => toMirroredMetricPoint(point));
}

function extractHandCandidate(candidate, width, height) {
  const keypoints = candidate?.keypoints ?? [];
  const keypoints3D = candidate?.keypoints3D ?? [];
  const fingerTips = extractFingerTips(keypoints, width, height);
  const indexTip = fingerTips.index;
  const thumbTip = fingerTips.thumb;

  if (!indexTip || !thumbTip) {
    return null;
  }

  const dx = thumbTip.u - indexTip.u;
  const dy = thumbTip.v - indexTip.v;
  const pinchDistance = Math.hypot(dx, dy);
  if (!Number.isFinite(pinchDistance)) {
    return null;
  }

  // Preserve original keypoint indices so downstream index-based feature extraction
  // keeps landmark semantics even when some points are invalid this frame.
  const landmarks = keypoints.map((point) => toMirroredNormalized(point, width, height));
  const landmarks3D = extractLandmarks3D(keypoints3D);

  const score = Number.isFinite(candidate?.score) ? candidate.score : 0;
  return {
    score,
    indexTip,
    thumbTip,
    fingerTips,
    pinchDistance,
    landmarks,
    landmarks3D,
    handedness: normalizeHandedness(candidate),
  };
}

function normalizeHandedness(candidate) {
  const labels = [];

  if (typeof candidate?.handedness === "string") {
    labels.push(candidate.handedness);
  }

  if (Array.isArray(candidate?.handednesses)) {
    for (const handednessEntry of candidate.handednesses) {
      if (typeof handednessEntry === "string") {
        labels.push(handednessEntry);
      } else if (typeof handednessEntry?.label === "string") {
        labels.push(handednessEntry.label);
      } else if (typeof handednessEntry?.categoryName === "string") {
        labels.push(handednessEntry.categoryName);
      }
    }
  }

  for (const label of labels) {
    const lowered = String(label).toLowerCase();
    if (lowered.includes("left")) {
      return "Left";
    }
    if (lowered.includes("right")) {
      return "Right";
    }
  }
  return null;
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
    uRaw: point.uRaw,
    vRaw: point.vRaw,
    wasClamped: point.wasClamped,
    asArray0: point[0],
    asArray1: point[1],
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
