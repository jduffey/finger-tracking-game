function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value, min, max) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp((value - min) / Math.max(1e-6, max - min), 0, 1);
}

function circularMotionDetected(path) {
  if (!Array.isArray(path) || path.length < 18) {
    return false;
  }
  const points = path.slice(-28);
  const centroid = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 },
  );

  let angleSpan = 0;
  let radiusVariance = 0;
  let previousAngle = null;
  const radii = [];

  for (const point of points) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const radius = Math.hypot(dx, dy);
    radii.push(radius);
    const angle = Math.atan2(dy, dx);
    if (previousAngle !== null) {
      let delta = angle - previousAngle;
      while (delta > Math.PI) {
        delta -= Math.PI * 2;
      }
      while (delta < -Math.PI) {
        delta += Math.PI * 2;
      }
      angleSpan += delta;
    }
    previousAngle = angle;
  }

  const avgRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  for (const radius of radii) {
    radiusVariance += Math.abs(radius - avgRadius);
  }
  radiusVariance /= Math.max(1, radii.length);

  return Math.abs(angleSpan) > Math.PI * 1.55 && avgRadius > 0.02 && radiusVariance < avgRadius * 0.45;
}

export function mapFeaturesToArt(features, history) {
  const brushThickness = 1 + normalize(0.16 - features.pinchDistance, 0.02, 0.14) * 28;
  const paletteMix = normalize(features.palmOpenness, 0, 1);
  const hueRotation = normalize(features.wristAngle, -Math.PI, Math.PI) * 360;
  const emissionRate = 2 + normalize(features.pointerVelocity, 0, 1.6) * 48;
  const zoom = features.handsCount >= 2 ? 0.7 + normalize(features.twoHandDistance, 0.08, 0.55) * 1.9 : 1;
  const fieldRotation = features.handsCount >= 2
    ? normalize(features.twoHandAngle, -Math.PI, Math.PI) * Math.PI * 2 - Math.PI
    : 0;

  const indexPath = history.indexPath;
  if (features.indexTip) {
    indexPath.push({ x: features.indexTip.x, y: features.indexTip.y, t: features.timestamp });
  }
  while (indexPath.length > 40) {
    indexPath.shift();
  }

  const pushVelocity = history.lastPalmScale > 0
    ? (features.palmScale - history.lastPalmScale) / Math.max(1e-6, features.timestamp - history.lastTimestamp)
    : 0;

  const clearRequested = circularMotionDetected(indexPath) && features.pointerVelocity > 0.25;
  const freezeToggleRequested = pushVelocity > 0.00022 && features.handsCount > 0;

  return {
    attractor: features.indexTip,
    brushThickness,
    paletteMix,
    hueRotation,
    emissionRate,
    zoom,
    fieldRotation,
    handsCount: features.handsCount,
    clearRequested,
    freezeToggleRequested,
  };
}
