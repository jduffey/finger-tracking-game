export function runFullscreenOverlayGameUpdates(
  timestamp,
  {
    updateFullscreenHandBounceSimulation,
    updateFullscreenBrickDodgerSimulation,
    updateFullscreenBreakoutSimulation,
    updateFullscreenBreakoutCoopSimulation,
    updateFullscreenFingerPongSimulation,
    updateFullscreenInvadersSimulation,
    updateFullscreenFlappySimulation,
    updateFullscreenMissileCommandSimulation,
    updateFullscreenTicTacToeSimulation,
  } = {},
) {
  if (typeof updateFullscreenHandBounceSimulation === "function") {
    updateFullscreenHandBounceSimulation(timestamp);
  }

  if (typeof updateFullscreenBrickDodgerSimulation === "function") {
    updateFullscreenBrickDodgerSimulation(timestamp);
  }

  if (typeof updateFullscreenBreakoutSimulation === "function") {
    updateFullscreenBreakoutSimulation(timestamp);
  }

  if (typeof updateFullscreenBreakoutCoopSimulation === "function") {
    updateFullscreenBreakoutCoopSimulation(timestamp);
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

  if (typeof updateFullscreenTicTacToeSimulation === "function") {
    updateFullscreenTicTacToeSimulation(timestamp);
  }
}
