export function runFullscreenOverlayGameUpdates(
  timestamp,
  {
    updateFullscreenBreakoutSimulation,
    updateFullscreenInvadersSimulation,
    updateFullscreenFlappySimulation,
    updateFullscreenMissileCommandSimulation,
  } = {},
) {
  if (typeof updateFullscreenBreakoutSimulation === "function") {
    updateFullscreenBreakoutSimulation(timestamp);
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
