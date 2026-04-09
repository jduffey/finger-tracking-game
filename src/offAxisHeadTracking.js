function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function getPointByName(pose, name, minScore = 0.2) {
  const keypoints = Array.isArray(pose?.keypoints) ? pose.keypoints : [];
  for (const point of keypoints) {
    if (
      point?.name === name &&
      Number.isFinite(point.u) &&
      Number.isFinite(point.v) &&
      Number.isFinite(point.score) &&
      point.score >= minScore
    ) {
      return point;
    }
  }
  return null;
}

function averagePoints(points) {
  const valid = points.filter(Boolean);
  if (valid.length === 0) {
    return null;
  }
  const total = valid.reduce(
    (accumulator, point) => ({
      u: accumulator.u + point.u,
      v: accumulator.v + point.v,
      score: accumulator.score + (point.score ?? 0),
    }),
    { u: 0, v: 0, score: 0 },
  );
  return {
    u: total.u / valid.length,
    v: total.v / valid.length,
    score: total.score / valid.length,
  };
}

export function createEmptyOffAxisState() {
  return {
    detected: false,
    confidence: 0,
    centerU: 0.5,
    centerV: 0.5,
    offsetX: 0,
    offsetY: 0,
    yaw: 0,
    pitch: 0,
    depth: 0,
    eyeSpan: 0,
    skewXDeg: 0,
    skewYDeg: 0,
    cameraShiftXPx: 0,
    cameraShiftYPx: 0,
    chamberRotationDeg: 0,
    chamberPitchDeg: 0,
    viewportInset: 0,
    status: "Head not detected",
  };
}

export function createHeldOffAxisState(previousState = createEmptyOffAxisState()) {
  const state =
    previousState && typeof previousState === "object"
      ? previousState
      : createEmptyOffAxisState();
  const hasRecentTransform =
    state.detected ||
    Math.abs(state.offsetX ?? 0) > 0.001 ||
    Math.abs(state.offsetY ?? 0) > 0.001 ||
    Math.abs(state.yaw ?? 0) > 0.001 ||
    Math.abs(state.pitch ?? 0) > 0.001 ||
    Math.abs(state.depth ?? 0) > 0.001;

  if (!hasRecentTransform) {
    return createEmptyOffAxisState();
  }

  return {
    ...state,
    detected: false,
    confidence: 0,
    status: "Reacquiring head...",
  };
}

export function deriveOffAxisHeadState(pose, previousState = createEmptyOffAxisState()) {
  if (!pose || !Array.isArray(pose.keypoints) || pose.keypoints.length === 0) {
    return createEmptyOffAxisState();
  }

  const leftEye = getPointByName(pose, "left_eye");
  const rightEye = getPointByName(pose, "right_eye");
  const nose = getPointByName(pose, "nose");
  const leftEar = getPointByName(pose, "left_ear", 0.12);
  const rightEar = getPointByName(pose, "right_ear", 0.12);

  if (!nose || !leftEye || !rightEye) {
    return {
      ...createEmptyOffAxisState(),
      status: "Need nose + both eyes",
    };
  }

  const eyeMid = averagePoints([leftEye, rightEye]);
  const headCenter = averagePoints([nose, eyeMid, leftEar, rightEar]);

  if (!eyeMid || !headCenter) {
    return {
      ...createEmptyOffAxisState(),
      status: "Need nose + both eyes",
    };
  }

  const eyeDx = (rightEye?.u ?? eyeMid.u) - (leftEye?.u ?? eyeMid.u);
  const eyeDy = (rightEye?.v ?? eyeMid.v) - (leftEye?.v ?? eyeMid.v);
  const eyeSpan = Math.hypot(eyeDx, eyeDy);
  const confidenceSource = [nose, leftEye, rightEye, leftEar, rightEar].filter(Boolean);
  const confidence = confidenceSource.reduce((total, point) => total + (point.score ?? 0), 0) /
    Math.max(1, confidenceSource.length);

  const lateralOffset = clamp((headCenter.u - 0.5) / 0.18, -1, 1);
  const verticalOffset = clamp((0.5 - headCenter.v) / 0.2, -1, 1);
  const yawFromNose = clamp((nose ? nose.u - eyeMid.u : 0) / Math.max(eyeSpan * 0.9, 0.03), -1, 1);
  const pitchFromNose = clamp((eyeMid.v - (nose?.v ?? eyeMid.v)) / Math.max(eyeSpan * 1.4, 0.035), -1, 1);
  const depth = clamp((eyeSpan - 0.085) / 0.05, -1, 1);

  const alpha = previousState?.detected ? 0.18 : 0.42;
  const smoothedOffsetX = lerp(previousState?.offsetX ?? 0, lateralOffset, alpha);
  const smoothedOffsetY = lerp(previousState?.offsetY ?? 0, verticalOffset, alpha);
  const smoothedYaw = lerp(previousState?.yaw ?? 0, yawFromNose, alpha);
  const smoothedPitch = lerp(previousState?.pitch ?? 0, pitchFromNose, alpha);
  const smoothedDepth = lerp(previousState?.depth ?? 0, depth, alpha);

  return {
    detected: true,
    confidence,
    centerU: headCenter.u,
    centerV: headCenter.v,
    offsetX: smoothedOffsetX,
    offsetY: smoothedOffsetY,
    yaw: smoothedYaw,
    pitch: smoothedPitch,
    depth: smoothedDepth,
    eyeSpan,
    skewXDeg: Number((smoothedOffsetX * -8 + smoothedYaw * -5).toFixed(3)),
    skewYDeg: Number((smoothedOffsetY * 5 + smoothedPitch * 4).toFixed(3)),
    cameraShiftXPx: Number((smoothedOffsetX * 72 + smoothedYaw * 26).toFixed(3)),
    cameraShiftYPx: Number((smoothedOffsetY * -54 + smoothedPitch * -16).toFixed(3)),
    chamberRotationDeg: Number((smoothedOffsetX * 10 + smoothedYaw * 7).toFixed(3)),
    chamberPitchDeg: Number((smoothedOffsetY * -7 + smoothedPitch * -6).toFixed(3)),
    viewportInset: Number((22 + smoothedDepth * 16).toFixed(3)),
    status:
      confidence >= 0.45
        ? "Head tracked"
        : "Low-confidence head lock",
  };
}
