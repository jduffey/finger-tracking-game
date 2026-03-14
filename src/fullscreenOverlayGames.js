export function runFullscreenOverlayGameUpdates(
  timestamp,
  {
    updateFullscreenBreakoutSimulation,
    updateFullscreenBreakoutCoopSimulation,
    updateFullscreenInvadersSimulation,
    updateFullscreenFlappySimulation,
    updateFullscreenMissileCommandSimulation,
  } = {},
) {
  if (typeof updateFullscreenBreakoutSimulation === "function") {
    updateFullscreenBreakoutSimulation(timestamp);
  }

  if (typeof updateFullscreenBreakoutCoopSimulation === "function") {
    updateFullscreenBreakoutCoopSimulation(timestamp);
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
