const IMMERSIVE_CAMERA_PHASES = new Set(["FULLSCREEN_CAMERA", "MINORITY_REPORT_LAB"]);

export function shouldUseImmersiveAppLayout(phase) {
  return IMMERSIVE_CAMERA_PHASES.has(phase);
}

export function shouldUseContainedCameraFit(phase) {
  return IMMERSIVE_CAMERA_PHASES.has(phase);
}

export function shouldShowInlineCameraPreview(phase) {
  return phase !== "MINORITY_REPORT_LAB";
}
