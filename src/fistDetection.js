export const HAND_LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

const PALM_CENTER_INDEXES = [
  HAND_LANDMARK_INDEX.WRIST,
  HAND_LANDMARK_INDEX.INDEX_MCP,
  HAND_LANDMARK_INDEX.MIDDLE_MCP,
  HAND_LANDMARK_INDEX.RING_MCP,
  HAND_LANDMARK_INDEX.PINKY_MCP,
];

const FIST_FINGER_SPECS = [
  {
    name: "thumb",
    mcp: HAND_LANDMARK_INDEX.THUMB_MCP,
    pip: HAND_LANDMARK_INDEX.THUMB_IP,
    dip: HAND_LANDMARK_INDEX.THUMB_IP,
    tip: HAND_LANDMARK_INDEX.THUMB_TIP,
    extendedAngleThreshold: 150,
    curledAngleThreshold: 128,
    reachExtendedThreshold: 0.88,
    reachCurledThreshold: 0.72,
    palmDeltaThreshold: 0.02,
  },
  {
    name: "index",
    mcp: HAND_LANDMARK_INDEX.INDEX_MCP,
    pip: HAND_LANDMARK_INDEX.INDEX_PIP,
    dip: HAND_LANDMARK_INDEX.INDEX_DIP,
    tip: HAND_LANDMARK_INDEX.INDEX_TIP,
    extendedAngleThreshold: 160,
    curledAngleThreshold: 138,
    reachExtendedThreshold: 0.98,
    reachCurledThreshold: 0.78,
    palmDeltaThreshold: 0.08,
  },
  {
    name: "middle",
    mcp: HAND_LANDMARK_INDEX.MIDDLE_MCP,
    pip: HAND_LANDMARK_INDEX.MIDDLE_PIP,
    dip: HAND_LANDMARK_INDEX.MIDDLE_DIP,
    tip: HAND_LANDMARK_INDEX.MIDDLE_TIP,
    extendedAngleThreshold: 160,
    curledAngleThreshold: 138,
    reachExtendedThreshold: 1.02,
    reachCurledThreshold: 0.82,
    palmDeltaThreshold: 0.08,
  },
  {
    name: "ring",
    mcp: HAND_LANDMARK_INDEX.RING_MCP,
    pip: HAND_LANDMARK_INDEX.RING_PIP,
    dip: HAND_LANDMARK_INDEX.RING_DIP,
    tip: HAND_LANDMARK_INDEX.RING_TIP,
    extendedAngleThreshold: 158,
    curledAngleThreshold: 136,
    reachExtendedThreshold: 0.96,
    reachCurledThreshold: 0.8,
    palmDeltaThreshold: 0.08,
  },
  {
    name: "pinky",
    mcp: HAND_LANDMARK_INDEX.PINKY_MCP,
    pip: HAND_LANDMARK_INDEX.PINKY_PIP,
    dip: HAND_LANDMARK_INDEX.PINKY_DIP,
    tip: HAND_LANDMARK_INDEX.PINKY_TIP,
    extendedAngleThreshold: 154,
    curledAngleThreshold: 134,
    reachExtendedThreshold: 0.92,
    reachCurledThreshold: 0.78,
    palmDeltaThreshold: 0.07,
  },
];

function isValidMetricPoint(point) {
  return (
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  );
}

function toMetricPoint(point) {
  if (isValidMetricPoint(point)) {
    return point;
  }
  if (point && Number.isFinite(point.u) && Number.isFinite(point.v)) {
    return {
      x: point.u,
      y: point.v,
      z: 0,
    };
  }
  return null;
}

function getMetricLandmarks(hand) {
  if (Array.isArray(hand?.landmarks3D) && hand.landmarks3D.some(isValidMetricPoint)) {
    return hand.landmarks3D.map((point) => (isValidMetricPoint(point) ? point : null));
  }
  if (Array.isArray(hand?.landmarks)) {
    return hand.landmarks.map((point) => toMetricPoint(point));
  }
  return [];
}

function getMetricLandmark(landmarks, index) {
  if (!Array.isArray(landmarks)) {
    return null;
  }
  return landmarks[index] ?? null;
}

function distance(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function angleDegrees(a, b, c) {
  if (!a || !b || !c) {
    return null;
  }

  const abX = a.x - b.x;
  const abY = a.y - b.y;
  const abZ = a.z - b.z;
  const cbX = c.x - b.x;
  const cbY = c.y - b.y;
  const cbZ = c.z - b.z;
  const abMagnitude = Math.hypot(abX, abY, abZ);
  const cbMagnitude = Math.hypot(cbX, cbY, cbZ);
  if (abMagnitude <= 1e-6 || cbMagnitude <= 1e-6) {
    return null;
  }

  const cosine = (abX * cbX + abY * cbY + abZ * cbZ) / (abMagnitude * cbMagnitude);
  const clampedCosine = Math.max(-1, Math.min(1, cosine));
  return (Math.acos(clampedCosine) * 180) / Math.PI;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function estimatePalmCenter(landmarks) {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const index of PALM_CENTER_INDEXES) {
    const point = getMetricLandmark(landmarks, index);
    if (!point) {
      continue;
    }
    sumX += point.x;
    sumY += point.y;
    sumZ += point.z;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return {
    x: sumX / count,
    y: sumY / count,
    z: sumZ / count,
  };
}

function estimateHandScale(landmarks) {
  const wrist = getMetricLandmark(landmarks, HAND_LANDMARK_INDEX.WRIST);
  const middleMcp = getMetricLandmark(landmarks, HAND_LANDMARK_INDEX.MIDDLE_MCP);
  const primaryScale = distance(wrist, middleMcp);
  if (primaryScale > 1e-4) {
    return primaryScale;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of landmarks) {
    if (!point) {
      continue;
    }
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxZ)
  ) {
    return 0.08;
  }

  return Math.max(0.05, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ));
}

function summarizeFingerPose(landmarks, palmCenter, handScale, fingerSpec) {
  const mcp = getMetricLandmark(landmarks, fingerSpec.mcp);
  const pip = getMetricLandmark(landmarks, fingerSpec.pip);
  const dip = getMetricLandmark(landmarks, fingerSpec.dip);
  const tip = getMetricLandmark(landmarks, fingerSpec.tip);
  if (!mcp || !pip || !tip) {
    return null;
  }

  const safeScale = Math.max(1e-4, handScale);
  const tipDistanceFromPalm = distance(tip, palmCenter) / safeScale;
  const pipDistanceFromPalm = distance(pip, palmCenter) / safeScale;
  const reach = distance(tip, mcp) / safeScale;
  const primaryAngle = angleDegrees(mcp, pip, dip ?? tip);
  const secondaryAngle =
    dip && dip !== pip ? angleDegrees(pip, dip, tip) : null;
  const curlAngle = average([primaryAngle, secondaryAngle]);
  const curledByGeometry =
    (Number.isFinite(curlAngle) && curlAngle <= fingerSpec.curledAngleThreshold) ||
    (reach <= fingerSpec.reachCurledThreshold &&
      tipDistanceFromPalm <= pipDistanceFromPalm + fingerSpec.palmDeltaThreshold);
  const extended =
    Number.isFinite(curlAngle) &&
    curlAngle >= fingerSpec.extendedAngleThreshold &&
    reach >= fingerSpec.reachExtendedThreshold &&
    tipDistanceFromPalm >= pipDistanceFromPalm + fingerSpec.palmDeltaThreshold;

  return {
    name: fingerSpec.name,
    curled: curledByGeometry && !extended,
    extended,
    curlAngle,
    reach,
    tipDistanceFromPalm,
  };
}

export function computeFistClenchMeta(hand, wasClenched = false) {
  const landmarks = getMetricLandmarks(hand);
  const palmCenter = estimatePalmCenter(landmarks);
  const handScale = estimateHandScale(landmarks);
  if (!palmCenter || !Number.isFinite(handScale) || handScale <= 0) {
    return {
      active: false,
      openness: Number.POSITIVE_INFINITY,
      curledFingerCount: 0,
      extendedFingerCount: 0,
      nonThumbCurledCount: 0,
      nonThumbExtendedCount: 0,
      averageCurlAngle: null,
      averageNonThumbReach: null,
    };
  }

  const fingerStates = FIST_FINGER_SPECS
    .map((fingerSpec) => summarizeFingerPose(landmarks, palmCenter, handScale, fingerSpec))
    .filter(Boolean);
  const nonThumbFingerStates = fingerStates.filter((fingerState) => fingerState.name !== "thumb");

  const openness = average(fingerStates.map((fingerState) => fingerState.tipDistanceFromPalm)) ??
    Number.POSITIVE_INFINITY;
  const curledFingerCount = fingerStates.filter((fingerState) => fingerState.curled).length;
  const extendedFingerCount = fingerStates.filter((fingerState) => fingerState.extended).length;
  const nonThumbCurledCount = nonThumbFingerStates.filter((fingerState) => fingerState.curled).length;
  const nonThumbExtendedCount = nonThumbFingerStates.filter((fingerState) => fingerState.extended).length;
  const averageCurlAngle = average(nonThumbFingerStates.map((fingerState) => fingerState.curlAngle));
  const averageNonThumbReach = average(nonThumbFingerStates.map((fingerState) => fingerState.reach));

  const openHandVeto =
    nonThumbExtendedCount >= 2 ||
    openness >= 1.08 ||
    (Number.isFinite(averageNonThumbReach) && averageNonThumbReach >= 0.92);

  const active = openHandVeto
    ? false
    : wasClenched
      ? nonThumbCurledCount >= 2 &&
        openness <= 1.02 &&
        (!Number.isFinite(averageNonThumbReach) || averageNonThumbReach <= 0.9)
      : nonThumbCurledCount >= 3 &&
        nonThumbExtendedCount === 0 &&
        openness <= 0.98 &&
        (!Number.isFinite(averageNonThumbReach) || averageNonThumbReach <= 0.82);

  return {
    active,
    openness,
    curledFingerCount,
    extendedFingerCount,
    nonThumbCurledCount,
    nonThumbExtendedCount,
    averageCurlAngle,
    averageNonThumbReach,
  };
}
