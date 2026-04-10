const MINORITY_REPORT_STAGE_MIN_SCALE = 0.1;
const MINORITY_REPORT_STAGE_MAX_SCALE = 2.6;
const MINORITY_REPORT_FOCUS_FILL_RATIO = 0.82;
const MINORITY_REPORT_OVERVIEW_FILL_RATIO = 0.94;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function shouldUseMinorityReportZoom(twoHand, continuous) {
  return Boolean(
    twoHand?.present &&
      (continuous?.twoHandManipulationActive || twoHand?.pinchBothActive),
  );
}

export function shouldResetMinorityReportFocus(currentFocusedTileIndex, requestedTileIndex) {
  return (
    Number.isInteger(requestedTileIndex) &&
    currentFocusedTileIndex === requestedTileIndex
  );
}

export function getMinorityReportPinchSequenceAction(
  previousPinch,
  requestedTileIndex,
  now,
  maxDelayMs,
) {
  const isSameTargetSequence =
    previousPinch &&
    previousPinch.tileIndex === requestedTileIndex &&
    now - previousPinch.timestamp <= maxDelayMs;
  const count = isSameTargetSequence ? (previousPinch.count ?? 1) + 1 : 1;
  const isSectorPinch = Number.isInteger(requestedTileIndex);

  if (isSectorPinch && count >= 2) {
    return {
      action: "focus",
      state: null,
    };
  }

  if (!isSectorPinch && count >= 3) {
    return {
      action: "overview",
      state: null,
    };
  }

  return {
    action: null,
    state: {
      timestamp: now,
      tileIndex: requestedTileIndex,
      count,
    },
  };
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

export function getMinorityReportOverviewTransform(stageSize, workspaceBounds) {
  const width = Math.max(1, stageSize?.width ?? 960);
  const height = Math.max(1, stageSize?.height ?? 640);
  const workspaceWidth = Math.max(1, workspaceBounds?.width ?? width);
  const workspaceHeight = Math.max(1, workspaceBounds?.height ?? height);
  const overviewScale = clamp(
    Math.min(
      (width * MINORITY_REPORT_OVERVIEW_FILL_RATIO) / workspaceWidth,
      (height * MINORITY_REPORT_OVERVIEW_FILL_RATIO) / workspaceHeight,
    ),
    MINORITY_REPORT_STAGE_MIN_SCALE,
    MINORITY_REPORT_STAGE_MAX_SCALE,
  );
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const workspaceCenterX = Number.isFinite(workspaceBounds?.centerX)
    ? workspaceBounds.centerX
    : workspaceWidth * 0.5;
  const workspaceCenterY = Number.isFinite(workspaceBounds?.centerY)
    ? workspaceBounds.centerY
    : workspaceHeight * 0.5;
  return normalizeMinorityReportStageTransform({
    x: (centerX - workspaceCenterX) * overviewScale,
    y: (centerY - workspaceCenterY) * overviewScale,
    scale: overviewScale,
  });
}
