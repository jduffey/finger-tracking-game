const MINORITY_REPORT_STAGE_MIN_SCALE = 0.45;
const MINORITY_REPORT_STAGE_MAX_SCALE = 2.6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function shouldUseMinorityReportZoom(twoHand, continuous) {
  return Boolean(
    twoHand?.present &&
      (continuous?.twoHandManipulationActive || twoHand?.pinchBothActive),
  );
}

export function normalizeMinorityReportStageTransform(transform) {
  return {
    x: 0,
    y: 0,
    scale: clamp(transform?.scale ?? 1, MINORITY_REPORT_STAGE_MIN_SCALE, MINORITY_REPORT_STAGE_MAX_SCALE),
    rotation: 0,
  };
}

export function getMinorityReportZoomTransform(baseTransform, baseDistance, currentDistance) {
  const normalizedBase = normalizeMinorityReportStageTransform(baseTransform);
  const distanceRatio = currentDistance / Math.max(0.02, baseDistance);
  return normalizeMinorityReportStageTransform({
    scale: normalizedBase.scale * distanceRatio,
  });
}
