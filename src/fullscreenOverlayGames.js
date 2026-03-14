export function runFullscreenOverlayGameUpdates(
  timestamp,
  {
    updateFullscreenBrickDodgerSimulation,
    updateFullscreenBreakoutSimulation,
    updateFullscreenInvadersSimulation,
    updateFullscreenFlappySimulation,
    updateFullscreenMissileCommandSimulation,
  } = {},
) {
  if (typeof updateFullscreenBrickDodgerSimulation === "function") {
    updateFullscreenBrickDodgerSimulation(timestamp);
  }

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
