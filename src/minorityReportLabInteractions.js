const MINORITY_REPORT_STAGE_MIN_SCALE = 0.45;
const MINORITY_REPORT_STAGE_MAX_SCALE = 2.6;
const MINORITY_REPORT_FOCUS_FILL_RATIO = 0.82;

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
    x: Number.isFinite(transform?.x) ? transform.x : 0,
    y: Number.isFinite(transform?.y) ? transform.y : 0,
    scale: clamp(transform?.scale ?? 1, MINORITY_REPORT_STAGE_MIN_SCALE, MINORITY_REPORT_STAGE_MAX_SCALE),
    rotation: 0,
  };
}

export function getMinorityReportZoomTransform(baseTransform, baseDistance, currentDistance) {
  const normalizedBase = normalizeMinorityReportStageTransform(baseTransform);
  const distanceRatio = currentDistance / Math.max(0.02, baseDistance);
  return normalizeMinorityReportStageTransform({
    x: normalizedBase.x,
    y: normalizedBase.y,
    scale: normalizedBase.scale * distanceRatio,
  });
}

export function getMinorityReportAnchoredZoomTransform({
  baseTransform,
  baseDistance,
  currentDistance,
  stageSize,
  baseLocalAnchor,
  currentMidpoint,
}) {
  const normalizedBase = normalizeMinorityReportStageTransform(baseTransform);
  const distanceRatio = currentDistance / Math.max(0.02, baseDistance);
  const nextScale = clamp(
    normalizedBase.scale * distanceRatio,
    MINORITY_REPORT_STAGE_MIN_SCALE,
    MINORITY_REPORT_STAGE_MAX_SCALE,
  );

  const width = Math.max(1, stageSize?.width ?? 960);
  const height = Math.max(1, stageSize?.height ?? 640);
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const anchorX = Number.isFinite(baseLocalAnchor?.x) ? baseLocalAnchor.x : centerX;
  const anchorY = Number.isFinite(baseLocalAnchor?.y) ? baseLocalAnchor.y : centerY;
  const midpointX = (Number.isFinite(currentMidpoint?.x) ? currentMidpoint.x : 0.5) * width;
  const midpointY = (Number.isFinite(currentMidpoint?.y) ? currentMidpoint.y : 0.5) * height;

  return normalizeMinorityReportStageTransform({
    x: midpointX - centerX - (anchorX - centerX) * nextScale,
    y: midpointY - centerY - (anchorY - centerY) * nextScale,
    scale: nextScale,
  });
}

export function getMinorityReportFocusTransform(stageSize, tileBounds) {
  const width = Math.max(1, stageSize?.width ?? 960);
  const height = Math.max(1, stageSize?.height ?? 640);
  const focusScale = clamp(
    Math.min(
      (width * MINORITY_REPORT_FOCUS_FILL_RATIO) / Math.max(1, tileBounds?.width ?? width),
      (height * MINORITY_REPORT_FOCUS_FILL_RATIO) / Math.max(1, tileBounds?.height ?? height),
    ),
    MINORITY_REPORT_STAGE_MIN_SCALE,
    MINORITY_REPORT_STAGE_MAX_SCALE,
  );
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  return normalizeMinorityReportStageTransform({
    x: (centerX - (tileBounds?.centerX ?? centerX)) * focusScale,
    y: (centerY - (tileBounds?.centerY ?? centerY)) * focusScale,
    scale: focusScale,
  });
}
