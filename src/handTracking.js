import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { createScopedLogger } from "./logger";

const HAND_MODEL = handPoseDetection.SupportedModels.MediaPipeHands;
const trackingLog = createScopedLogger("handTracking");
const INVALID_VALUE_LOG_INTERVAL = 30;

const DETECTOR_CONFIG = {
  runtime: "tfjs",
  modelType: "lite",
  maxHands: 2,
};

let lastDetectionMeta = {
  handsDetected: 0,
  invalid: false,
  reason: "none",
};
let invalidValueStreak = 0;

export async function initHandTracking(options = {}) {
  const backend = options.backend ?? "webgl";
  trackingLog.info("Initializing TFJS hand tracking", {
    detectorConfig: DETECTOR_CONFIG,
    requestedBackend: backend,
  });
  const activeBefore = tf.getBackend();
  if (activeBefore !== backend) {
    trackingLog.debug("Setting TFJS backend", { backend, activeBefore });
    await tf.setBackend(backend);
  } else {
    trackingLog.debug("TFJS backend already active", { backend });
  }
  trackingLog.debug("Waiting for TFJS ready");
  await tf.ready();
  const detector = await handPoseDetection.createDetector(HAND_MODEL, DETECTOR_CONFIG);
  trackingLog.info("Hand tracking detector initialized", {
    activeBackend: tf.getBackend(),
  });
  return detector;
}

export function getCurrentBackend() {
  return tf.getBackend();
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
      staticImageMode: true,
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

  const bestHand = hands.reduce((best, current) => {
    const bestScore = best?.score ?? 0;
    const currentScore = current?.score ?? 0;
    return currentScore > bestScore ? current : best;
  }, hands[0]);

  const keypoints = bestHand.keypoints ?? [];
  const indexTip = keypoints[8];
  const thumbTip = keypoints[4];

  if (!indexTip || !thumbTip) {
    lastDetectionMeta = {
      handsDetected: hands.length,
      invalid: true,
      reason: "missing_required_keypoints",
    };
    trackingLog.warn("Hand detected but required landmarks missing", {
      indexTipPresent: Boolean(indexTip),
      thumbTipPresent: Boolean(thumbTip),
      keypointCount: keypoints.length,
    });
    return null;
  }

  const width = Math.max(1, videoElement.videoWidth || videoElement.clientWidth);
  const height = Math.max(1, videoElement.videoHeight || videoElement.clientHeight);

  const mirroredIndex = toMirroredNormalized(indexTip, width, height);
  const mirroredThumb = toMirroredNormalized(thumbTip, width, height);

  if (!mirroredIndex || !mirroredThumb) {
    invalidValueStreak += 1;
    lastDetectionMeta = {
      handsDetected: hands.length,
      invalid: true,
      reason: "non_finite_keypoint_values",
    };
    if (invalidValueStreak <= 5 || invalidValueStreak % INVALID_VALUE_LOG_INTERVAL === 0) {
      trackingLog.warn("Ignoring hand with invalid fingertip coordinates", {
        invalidValueStreak,
        indexTipSummary: summarizePoint(indexTip),
        thumbTipSummary: summarizePoint(thumbTip),
      });
    }
    return null;
  }

  const dx = mirroredThumb.u - mirroredIndex.u;
  const dy = mirroredThumb.v - mirroredIndex.v;
  const pinchDistance = Math.hypot(dx, dy);

  if (!Number.isFinite(pinchDistance)) {
    invalidValueStreak += 1;
    lastDetectionMeta = {
      handsDetected: hands.length,
      invalid: true,
      reason: "non_finite_pinch_distance",
    };
    if (invalidValueStreak <= 5 || invalidValueStreak % INVALID_VALUE_LOG_INTERVAL === 0) {
      trackingLog.warn("Ignoring hand due to non-finite pinch distance", {
        invalidValueStreak,
        dx,
        dy,
      });
    }
    return null;
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
  const score = Number.isFinite(bestHand.score) ? bestHand.score : 0;

  trackingLog.debug("Primary hand extracted", {
    score,
    pinchDistance,
    indexTip: mirroredIndex,
    thumbTip: mirroredThumb,
    videoWidth: width,
    videoHeight: height,
    landmarksCount: landmarks.length,
  });

  return {
    score,
    indexTip: mirroredIndex,
    thumbTip: mirroredThumb,
    pinchDistance,
    landmarks,
  };
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
