import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { createScopedLogger } from "./logger.js";

const poseLog = createScopedLogger("poseTracking");
const DEFAULT_RUNTIME = "tfjs";
const DEFAULT_MODEL = poseDetection.SupportedModels.MoveNet;
const DEFAULT_MODEL_TYPE = poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;
const DEFAULT_MAX_POSES = 1;
const MULTIPOSE_MODEL_TYPE = poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING;

let activeRuntime = DEFAULT_RUNTIME;
let lastPoseMeta = {
  posesDetected: 0,
  invalid: false,
  reason: "none",
};

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export async function initPoseTracking(options = {}) {
  const runtime = options.runtime ?? DEFAULT_RUNTIME;
  const backend = options.backend ?? "webgl";
  const model = options.model ?? DEFAULT_MODEL;
  const maxPoses =
    Number.isFinite(options.maxPoses) && options.maxPoses > 0
      ? Math.floor(options.maxPoses)
      : DEFAULT_MAX_POSES;
  const modelType =
    options.modelType ??
    (model === poseDetection.SupportedModels.MoveNet && maxPoses > 1
      ? MULTIPOSE_MODEL_TYPE
      : DEFAULT_MODEL_TYPE);

  poseLog.info("Initializing pose detector", {
    runtime,
    backend,
    model,
    modelType,
    maxPoses,
  });

  if (runtime === "tfjs") {
    const activeBefore = tf.getBackend();
    if (activeBefore !== backend) {
      await tf.setBackend(backend);
    }
    await tf.ready();
  }

  const detectorConfig =
    model === poseDetection.SupportedModels.MoveNet
      ? {
          runtime,
          modelType,
          enableSmoothing: maxPoses <= 1,
          ...(maxPoses > 1 ? { enableTracking: true } : {}),
        }
      : {
          runtime,
          maxPoses,
        };

  const detector = await poseDetection.createDetector(model, detectorConfig);
  activeRuntime = runtime;
  poseLog.info("Pose detector initialized", {
    runtime,
    backend: tf.getBackend(),
  });

  return detector;
}

export function getPoseRuntime() {
  return activeRuntime;
}

export function getLastPoseMeta() {
  return { ...lastPoseMeta };
}

function normalizePose(pose, width, height) {
  const keypoints = Array.isArray(pose?.keypoints) ? pose.keypoints : [];
  const normalizedKeypoints = keypoints
    .map((point) => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
      }
      const uRaw = 1 - point.x / width;
      const vRaw = point.y / height;
      const u = clamp01(uRaw);
      const v = clamp01(vRaw);
      return {
        name: point.name || point.part || null,
        score: Number.isFinite(point.score) ? point.score : 0,
        u,
        v,
        uRaw,
        vRaw,
        wasClamped: u !== uRaw || v !== vRaw,
      };
    })
    .filter(Boolean);

  if (normalizedKeypoints.length === 0) {
    return null;
  }

  const score = Number.isFinite(pose.score)
    ? pose.score
    : normalizedKeypoints.reduce((total, point) => total + point.score, 0) /
      Math.max(1, normalizedKeypoints.length);

  return {
    id: pose.id ?? null,
    score,
    keypoints: normalizedKeypoints,
  };
}

export async function detectPoses(detector, videoElement, options = {}) {
  const maxPoses =
    Number.isFinite(options.maxPoses) && options.maxPoses > 0
      ? Math.floor(options.maxPoses)
      : DEFAULT_MAX_POSES;

  if (!detector || !videoElement || videoElement.readyState < 2) {
    lastPoseMeta = {
      posesDetected: 0,
      invalid: false,
      reason: "detector_or_video_not_ready",
    };
    return [];
  }

  let poses = null;
  try {
    poses = await detector.estimatePoses(videoElement, {
      maxPoses,
      flipHorizontal: false,
    });
  } catch (error) {
    poseLog.error("Pose estimation failed", { error });
    lastPoseMeta = {
      posesDetected: 0,
      invalid: true,
      reason: "estimate_poses_failed",
    };
    return [];
  }

  if (!Array.isArray(poses) || poses.length === 0) {
    lastPoseMeta = {
      posesDetected: 0,
      invalid: false,
      reason: "no_pose",
    };
    return [];
  }

  const width = Math.max(1, videoElement.videoWidth || videoElement.clientWidth);
  const height = Math.max(1, videoElement.videoHeight || videoElement.clientHeight);
  const normalizedPoses = poses
    .slice(0, maxPoses)
    .map((pose) => normalizePose(pose, width, height))
    .filter(Boolean);

  if (normalizedPoses.length === 0) {
    lastPoseMeta = {
      posesDetected: poses.length,
      invalid: true,
      reason: "invalid_keypoints",
    };
    return [];
  }

  lastPoseMeta = {
    posesDetected: normalizedPoses.length,
    invalid: false,
    reason: "ok",
  };

  return normalizedPoses;
}

export async function detectPose(detector, videoElement) {
  const poses = await detectPoses(detector, videoElement, { maxPoses: 1 });
  return poses[0] ?? null;
}
