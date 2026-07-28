export function getRecoveryMessage(error) {
  const name = typeof error?.name === "string" ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access stopped unexpectedly. You can return Home and try setup again.";
  }
  if (name === "WebGLContextEvent" || name === "GPUValidationError") {
    return "This visual experience lost access to graphics hardware. Try again or choose a lighter mode.";
  }
  return "This experience hit an unexpected problem. Your camera and local settings are still under your control.";
}
