const FINGERTIP_INDEXES = [4, 8, 12, 16, 20];
const MCP_INDEXES = [5, 9, 13, 17];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function pointAt(hand, index) {
  const point = hand?.landmarks?.[index];
  if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v)) {
    return null;
  }
  return point;
}

function distance(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.u - b.u, a.v - b.v);
}

function extractPalmOpeness(hand) {
  const wrist = pointAt(hand, 0);
  if (!wrist) {
    return 0;
  }
  const mcpDistances = MCP_INDEXES.map((index) => distance(wrist, pointAt(hand, index))).filter(Boolean);
  const baseline = mcpDistances.length > 0 ? mcpDistances.reduce((sum, value) => sum + value, 0) / mcpDistances.length : 0.08;
  const tipDistances = FINGERTIP_INDEXES.map((index) => distance(wrist, pointAt(hand, index))).filter(Boolean);
  if (tipDistances.length === 0 || baseline <= 1e-4) {
    return 0;
  }
  const averageTipDistance = tipDistances.reduce((sum, value) => sum + value, 0) / tipDistances.length;
  return clamp01((averageTipDistance / baseline - 1.1) / 1.35);
}

function extractPalmScale(hand) {
  const wrist = pointAt(hand, 0);
  if (!wrist) {
    return 0;
  }
  const supports = MCP_INDEXES.map((index) => distance(wrist, pointAt(hand, index))).filter(Boolean);
  if (supports.length === 0) {
    return 0;
  }
  const average = supports.reduce((sum, value) => sum + value, 0) / supports.length;
  return average;
}

function extractWristAngle(hand) {
  const wrist = pointAt(hand, 0);
  const middleMcp = pointAt(hand, 9);
  if (!wrist || !middleMcp) {
    return 0;
  }
  return Math.atan2(middleMcp.v - wrist.v, middleMcp.u - wrist.u);
}

function normalizeHands(hands) {
  if (!Array.isArray(hands)) {
    return [];
  }
  return hands.filter(Boolean).slice(0, 2);
}

export function extractHandFeatures(hands, timestamp, history) {
  const safeHands = normalizeHands(hands);
  const primary = safeHands[0] ?? null;
  const secondary = safeHands[1] ?? null;

  const indexTip = pointAt(primary, 8);
  const thumbTip = pointAt(primary, 4);
  const primaryWrist = pointAt(primary, 0);
  const secondaryWrist = pointAt(secondary, 0);

  const pinchDistance = distance(indexTip, thumbTip);
  const palmOpenness = extractPalmOpeness(primary);
  const wristAngle = extractWristAngle(primary);
  const palmScale = extractPalmScale(primary);

  const dt = Math.max(1 / 120, (timestamp - (history.lastTimestamp ?? timestamp)) / 1000);
  const velocity = indexTip && history.lastIndexTip
    ? Math.hypot(indexTip.u - history.lastIndexTip.u, indexTip.v - history.lastIndexTip.v) / dt
    : 0;

  const twoHandDistance = distance(primaryWrist, secondaryWrist);
  const twoHandAngle = primaryWrist && secondaryWrist
    ? Math.atan2(secondaryWrist.v - primaryWrist.v, secondaryWrist.u - primaryWrist.u)
    : 0;

  return {
    timestamp,
    handsCount: safeHands.length,
    indexTip: indexTip ? { x: indexTip.u, y: indexTip.v } : null,
    pinchDistance,
    palmOpenness,
    wristAngle,
    pointerVelocity: velocity,
    twoHandDistance,
    twoHandAngle,
    palmScale,
  };
}
