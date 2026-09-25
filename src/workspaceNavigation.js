const WORKSPACE_NAV_PHASES = new Set([
  "CALIBRATION",
  "SANDBOX",
  "FLIGHT",
  "BODY_POSE",
  "OFF_AXIS_LAB",
  "RUNNER",
  "CONVEYOR",
  "MINORITY_REPORT_LAB",
  "SPATIAL_GESTURE_MEMORY",
  "GESTURE_ANALYTICS_LAB",
  "GESTURE_ART_LAB",
  "GESTURE_CONTROL_OS",
  "GAME",
]);

export function shouldShowWorkspaceNav(phase) {
  return WORKSPACE_NAV_PHASES.has(phase);
}
