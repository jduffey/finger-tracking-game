const LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_TIP: 20,
};

const PALM_CENTER_INDEXES = [
  LANDMARK_INDEX.WRIST,
  LANDMARK_INDEX.INDEX_MCP,
  LANDMARK_INDEX.MIDDLE_MCP,
  LANDMARK_INDEX.RING_MCP,
  LANDMARK_INDEX.PINKY_MCP,
];

const FINGERTIP_INDEXES = [
  LANDMARK_INDEX.THUMB_TIP,
  LANDMARK_INDEX.INDEX_TIP,
  LANDMARK_INDEX.MIDDLE_TIP,
  LANDMARK_INDEX.RING_TIP,
  LANDMARK_INDEX.PINKY_TIP,
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function getPoint(landmarks, index) {
  if (!Array.isArray(landmarks)) {
    return null;
  }
  const point = landmarks[index];
  if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v)) {
    return null;
  }
  return point;
}

function distance2d(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.u - b.u, a.v - b.v);
}

function angleBetweenPoints(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.atan2(b.v - a.v, b.u - a.u);
}

function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2;
  }
  while (wrapped < -Math.PI) {
    wrapped += Math.PI * 2;
  }
  return wrapped;
}

function estimatePalmCenter(landmarks) {
  let count = 0;
  let uSum = 0;
  let vSum = 0;
  for (const index of PALM_CENTER_INDEXES) {
    const point = getPoint(landmarks, index);
    if (!point) {
      continue;
    }
    uSum += point.u;
    vSum += point.v;
    count += 1;
  }
  if (count === 0) {
    return null;
  }
  return {
    u: uSum / count,
    v: vSum / count,
  };
}

function estimateHandScale(landmarks, wrist, middleMcp) {
  const primary = distance2d(wrist, middleMcp);
  if (primary > 0.0001) {
    return primary;
  }

  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  if (Array.isArray(landmarks)) {
    for (const point of landmarks) {
      if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v)) {
        continue;
      }
      minU = Math.min(minU, point.u);
      maxU = Math.max(maxU, point.u);
      minV = Math.min(minV, point.v);
      maxV = Math.max(maxV, point.v);
    }
  }

  if (!Number.isFinite(minU) || !Number.isFinite(maxU) || !Number.isFinite(minV) || !Number.isFinite(maxV)) {
    return 0.08;
  }

  return Math.max(0.05, Math.hypot(maxU - minU, maxV - minV));
}

function computeOpenness(landmarks, palmCenter, handScale) {
  if (!palmCenter) {
    return 0;
  }
  const scale = Math.max(0.0001, handScale);
  let count = 0;
  let total = 0;
  for (const index of FINGERTIP_INDEXES) {
    const tip = getPoint(landmarks, index);
    if (!tip) {
      continue;
    }
    total += Math.hypot(tip.u - palmCenter.u, tip.v - palmCenter.v) / scale;
    count += 1;
  }
  if (count === 0) {
    return 0;
  }
  return total / count;
}

function getFingerTip(hand, landmarks, name, landmarkIndex) {
  const explicitTip = hand?.fingerTips?.[name];
  if (explicitTip && Number.isFinite(explicitTip.u) && Number.isFinite(explicitTip.v)) {
    return explicitTip;
  }
  return getPoint(landmarks, landmarkIndex);
}

function computePointer(indexTip, thumbTip) {
  const fallback = {
    x: safeNumber(thumbTip?.u, safeNumber(indexTip?.u, 0.5)),
    y: safeNumber(thumbTip?.v, safeNumber(indexTip?.v, 0.5)),
  };

  if (!thumbTip) {
    return fallback;
  }

  return {
    x: thumbTip.u,
    y: thumbTip.v,
  };
}

export function extractSingleHandFeature(hand, previousFeature, dtSeconds) {
  if (!hand) {
    return null;
  }

  const landmarks = Array.isArray(hand.landmarks) ? hand.landmarks : [];
  const wrist = getPoint(landmarks, LANDMARK_INDEX.WRIST);
  const middleMcp = getPoint(landmarks, LANDMARK_INDEX.MIDDLE_MCP);
  const palmCenter = estimatePalmCenter(landmarks);

  const thumbTip = getFingerTip(hand, landmarks, "thumb", LANDMARK_INDEX.THUMB_TIP);
  const indexTip = getFingerTip(hand, landmarks, "index", LANDMARK_INDEX.INDEX_TIP);
  const pinchDistance = Number.isFinite(hand.pinchDistance)
    ? hand.pinchDistance
    : distance2d(thumbTip, indexTip);

  const pointer = computePointer(indexTip, thumbTip);
  const handScale = estimateHandScale(landmarks, wrist, middleMcp);
  const openness = computeOpenness(landmarks, palmCenter, handScale);

  const safeDt = Math.max(1 / 120, safeNumber(dtSeconds, 1 / 60));
  const previousPointer = previousFeature?.pointer;
  const velocityX = previousPointer
    ? (pointer.x - safeNumber(previousPointer.x, pointer.x)) / safeDt
    : 0;
  const velocityY = previousPointer
    ? (pointer.y - safeNumber(previousPointer.y, pointer.y)) / safeDt
    : 0;

  return {
    id: hand.id,
    label: hand.label,
    score: safeNumber(hand.score, 0),
    pointer,
    pinchDistance,
    pinchMidpoint: thumbTip && indexTip
      ? { x: (thumbTip.u + indexTip.u) * 0.5, y: (thumbTip.v + indexTip.v) * 0.5 }
      : pointer,
    openness,
    handScale,
    velocity: {
      x: velocityX,
      y: velocityY,
      speed: Math.hypot(velocityX, velocityY),
    },
    wrist: wrist ? { x: wrist.u, y: wrist.v } : null,
    palmCenter: palmCenter ? { x: palmCenter.u, y: palmCenter.v } : null,
    angle: wrist && middleMcp ? angleBetweenPoints(wrist, middleMcp) : 0,
    landmarksCount: landmarks.length,
  };
}

export function extractTwoHandFeature(firstHandFeature, secondHandFeature, previousTwoHand, dtSeconds) {
  if (!firstHandFeature || !secondHandFeature) {
    return null;
  }

  const pointerA = firstHandFeature.pointer;
  const pointerB = secondHandFeature.pointer;
  const midpoint = {
    x: (pointerA.x + pointerB.x) * 0.5,
    y: (pointerA.y + pointerB.y) * 0.5,
  };
  const distance = Math.hypot(pointerA.x - pointerB.x, pointerA.y - pointerB.y);
  const angle = Math.atan2(pointerB.y - pointerA.y, pointerB.x - pointerA.x);

  const safeDt = Math.max(1 / 120, safeNumber(dtSeconds, 1 / 60));
  const previousDistance = safeNumber(previousTwoHand?.distance, distance);
  const previousAngle = safeNumber(previousTwoHand?.angle, angle);
  const previousMidpoint = previousTwoHand?.midpoint ?? midpoint;

  const dDistance = (distance - previousDistance) / safeDt;
  const dAngle = wrapAngle(angle - previousAngle) / safeDt;
  const midpointVelocity = {
    x: (midpoint.x - safeNumber(previousMidpoint.x, midpoint.x)) / safeDt,
    y: (midpoint.y - safeNumber(previousMidpoint.y, midpoint.y)) / safeDt,
  };

  const averageVelocity = {
    x: (safeNumber(firstHandFeature.velocity?.x) + safeNumber(secondHandFeature.velocity?.x)) * 0.5,
    y: (safeNumber(firstHandFeature.velocity?.y) + safeNumber(secondHandFeature.velocity?.y)) * 0.5,
  };

  return {
    id: `${firstHandFeature.id}|${secondHandFeature.id}`,
    handAId: firstHandFeature.id,
    handBId: secondHandFeature.id,
    midpoint,
    distance,
    angle,
    dDistance,
    dAngle,
    midpointVelocity,
    averageVelocity: {
      ...averageVelocity,
      speed: Math.hypot(averageVelocity.x, averageVelocity.y),
    },
  };
}

function toFixedLengthWindow(window, frameCount) {
  if (!Array.isArray(window) || window.length < frameCount) {
    return null;
  }
  return window.slice(window.length - frameCount);
}

export function flattenSingleHandWindow(window, frameCount) {
  const slice = toFixedLengthWindow(window, frameCount);
  if (!slice) {
    return null;
  }

  const vector = [];
  for (const feature of slice) {
    vector.push(
      safeNumber(feature.pointer?.x),
      safeNumber(feature.pointer?.y),
      safeNumber(feature.pinchDistance),
      safeNumber(feature.openness),
      safeNumber(feature.handScale),
      safeNumber(feature.velocity?.x),
      safeNumber(feature.velocity?.y),
    );
  }
  return vector;
}

export function flattenTwoHandWindow(window, frameCount) {
  const slice = toFixedLengthWindow(window, frameCount);
  if (!slice) {
    return null;
  }

  const vector = [];
  for (const feature of slice) {
    vector.push(
      safeNumber(feature.midpoint?.x),
      safeNumber(feature.midpoint?.y),
      safeNumber(feature.distance),
      safeNumber(feature.angle),
      safeNumber(feature.dDistance),
      safeNumber(feature.dAngle),
      safeNumber(feature.averageVelocity?.x),
      safeNumber(feature.averageVelocity?.y),
    );
  }
  return vector;
}

export function wrapAngleDelta(value) {
  return wrapAngle(value);
}
