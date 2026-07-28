const DEFAULT_CURSOR_SMOOTHING = 0.35;
const DEFAULT_PINCH_THRESHOLD = 0.045;
const PINCH_RELEASE_GAP = 0.015;

function clamp(value, min, max, fallback) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function selectPreferredHand(hands, dominantHand = "auto") {
  const availableHands = Array.isArray(hands) ? hands.filter(Boolean) : [];
  if (availableHands.length === 0) {
    return null;
  }

  const preferredLabel =
    dominantHand === "left"
      ? "Left"
      : dominantHand === "right"
        ? "Right"
        : null;

  return (
    (preferredLabel
      ? availableHands.find(
          (hand) =>
            hand?.label === preferredLabel ||
            hand?.handedness === preferredLabel,
        )
      : null) ??
    availableHands[0]
  );
}

export function getCursorSmoothingAlpha(cursorSmoothing) {
  const smoothing = clamp(
    cursorSmoothing,
    0.05,
    0.9,
    DEFAULT_CURSOR_SMOOTHING,
  );

  // Alpha weights the newest sample, so it moves in the opposite direction
  // from the user-facing "smoothing" value. The default remains the historic
  // 0.35 alpha used by the app.
  return clamp(0.7 - smoothing, 0.05, 0.65, 0.35);
}

export function getPinchThresholds(pinchThreshold) {
  const start = clamp(
    pinchThreshold,
    0.02,
    0.09,
    DEFAULT_PINCH_THRESHOLD,
  );
  return {
    start,
    end: Math.min(0.12, start + PINCH_RELEASE_GAP),
  };
}

export function expandPointerRangeForSeatedPlay(point, seatedMode) {
  if (
    !seatedMode ||
    !point ||
    !Number.isFinite(point.u) ||
    !Number.isFinite(point.v)
  ) {
    return point;
  }

  return {
    ...point,
    u: clamp(0.5 + (point.u - 0.5) * 1.12, 0, 1, point.u),
    v: clamp(0.5 + (point.v - 0.5) * 1.28, 0, 1, point.v),
  };
}

export function adaptNormalizedPointForCamera(point, mirrorCamera = true) {
  if (mirrorCamera || !point || !Number.isFinite(point.u)) {
    return point;
  }

  return {
    ...point,
    u: 1 - point.u,
    uRaw: Number.isFinite(point.uRaw) ? 1 - point.uRaw : point.uRaw,
  };
}

export function adaptHandForCamera(hand, mirrorCamera = true) {
  if (mirrorCamera || !hand) {
    return hand;
  }

  const fingerTips = Object.fromEntries(
    Object.entries(hand.fingerTips ?? {}).map(([name, point]) => [
      name,
      adaptNormalizedPointForCamera(point, false),
    ]),
  );

  return {
    ...hand,
    fingerTips,
    indexTip:
      fingerTips.index ??
      adaptNormalizedPointForCamera(hand.indexTip, false),
    thumbTip:
      fingerTips.thumb ??
      adaptNormalizedPointForCamera(hand.thumbTip, false),
    landmarks: Array.isArray(hand.landmarks)
      ? hand.landmarks.map((point) =>
          adaptNormalizedPointForCamera(point, false),
        )
      : hand.landmarks,
  };
}

export function adaptHandsForCamera(hands, mirrorCamera = true) {
  if (!Array.isArray(hands)) {
    return [];
  }
  return mirrorCamera
    ? hands
    : hands.map((hand) => adaptHandForCamera(hand, false));
}

export function adaptPoseForCamera(pose, mirrorCamera = true) {
  if (mirrorCamera || !pose) {
    return pose;
  }
  return {
    ...pose,
    keypoints: Array.isArray(pose.keypoints)
      ? pose.keypoints.map((point) =>
          adaptNormalizedPointForCamera(point, false),
        )
      : pose.keypoints,
  };
}

export function adaptPosesForCamera(poses, mirrorCamera = true) {
  if (!Array.isArray(poses)) {
    return [];
  }
  return mirrorCamera
    ? poses
    : poses.map((pose) => adaptPoseForCamera(pose, false));
}
