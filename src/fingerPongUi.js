import {
  FINGER_PONG_MAX_SCORE,
  FINGER_PONG_WIN_MARGIN,
  hasWonFingerPongMatch,
} from "./fingerPongGame.js";

function safeScore(value) {
  return Math.max(0, Number.isFinite(value) ? Math.round(value) : 0);
}

export function getFingerPongMatchUi(state) {
  const playerScore = safeScore(state?.score);
  const opponentScore = safeScore(state?.opponentScore);
  const playerMatchPoint =
    !hasWonFingerPongMatch(playerScore, opponentScore) &&
    hasWonFingerPongMatch(playerScore + 1, opponentScore);
  const opponentMatchPoint =
    !hasWonFingerPongMatch(opponentScore, playerScore) &&
    hasWonFingerPongMatch(opponentScore + 1, playerScore);
  const deuce =
    playerScore >= FINGER_PONG_MAX_SCORE - 1 &&
    opponentScore >= FINGER_PONG_MAX_SCORE - 1 &&
    playerScore === opponentScore;

  let pressureLabel = "";
  if (deuce) {
    pressureLabel = "Deuce · win two straight";
  } else if (playerMatchPoint && opponentMatchPoint) {
    pressureLabel = "Deciding point";
  } else if (playerMatchPoint) {
    pressureLabel = "Your match point";
  } else if (opponentMatchPoint) {
    pressureLabel = "Save match point";
  }

  return {
    playerScore,
    opponentScore,
    rallyCount: safeScore(state?.rallyCount),
    bestRally: safeScore(state?.bestRally),
    scoreLabel: `${playerScore}–${opponentScore}`,
    serverLabel: state?.server === "opponent" ? "Opponent serves" : "You serve",
    pressureLabel,
    rulesLabel: `First to ${FINGER_PONG_MAX_SCORE} · win by ${FINGER_PONG_WIN_MARGIN}`,
  };
}
