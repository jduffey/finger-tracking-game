export function getFullscreenRestartControlLabel(mode, states = {}) {
  switch (mode) {
    case "hand-bounce":
      return states.handBounce?.status === "gameover" ? "Restart Bounce" : null;
    case "brick-dodger":
      return states.brickDodger?.status === "gameover" ? "Restart Run" : null;
    case "finger-pong":
      return states.fingerPong?.status === "won" || states.fingerPong?.status === "lost"
        ? "Restart Rally"
        : null;
    case "breakout":
    case "find-your-grind-breakout":
      return states.breakout?.status === "cleared"
        ? "Next Level"
        : states.breakout?.status === "gameover"
          ? "Restart Breakout"
          : null;
    case "fruit-ninja":
      return states.fruitNinja?.status === "gameover" ? "Restart Round" : null;
    case "sky-patrol":
      return states.skyPatrol?.status === "gameover" ? "Restart Sortie" : null;
    case "missile-command":
      return states.missileCommand?.status === "game_over" ? "Restart Defense" : null;
    default:
      return null;
  }
}
