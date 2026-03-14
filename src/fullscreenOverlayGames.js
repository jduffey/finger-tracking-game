export function runFullscreenOverlayGameUpdates(
  timestamp,
  {
    updateFullscreenBreakoutSimulation,
    updateFullscreenFingerPongSimulation,
    updateFullscreenInvadersSimulation,
    updateFullscreenFlappySimulation,
    updateFullscreenMissileCommandSimulation,
  } = {},
) {
  if (typeof updateFullscreenBreakoutSimulation === "function") {
    updateFullscreenBreakoutSimulation(timestamp);
  }

  if (typeof updateFullscreenFingerPongSimulation === "function") {
    updateFullscreenFingerPongSimulation(timestamp);
  }

  if (typeof updateFullscreenInvadersSimulation === "function") {
    updateFullscreenInvadersSimulation(timestamp);
  }

  if (typeof updateFullscreenFlappySimulation === "function") {
    updateFullscreenFlappySimulation(timestamp);
  }

  if (typeof updateFullscreenMissileCommandSimulation === "function") {
    updateFullscreenMissileCommandSimulation(timestamp);
  }
}
