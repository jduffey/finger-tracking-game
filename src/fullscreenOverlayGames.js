export function runFullscreenOverlayGameUpdates(
  timestamp,
  {
    updateFullscreenBreakoutSimulation,
    updateFullscreenFlappySimulation,
  } = {},
) {
  if (typeof updateFullscreenBreakoutSimulation === "function") {
    updateFullscreenBreakoutSimulation(timestamp);
  }

  if (typeof updateFullscreenFlappySimulation === "function") {
    updateFullscreenFlappySimulation(timestamp);
  }
}
