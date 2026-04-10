const CONTAINED_CAMERA_PHASES = new Set(["FULLSCREEN_CAMERA", "MINORITY_REPORT_LAB"]);

export function shouldUseContainedCameraFit(phase) {
  return CONTAINED_CAMERA_PHASES.has(phase);
}

export function shouldShowInlineCameraPreview(phase) {
  return phase !== "MINORITY_REPORT_LAB";
}
