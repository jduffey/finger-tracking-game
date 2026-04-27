import { getTicTacToeCellRect } from "./ticTacToeGame.js";

export const TIC_TAC_TOE_SURFACE_TOKENS = Object.freeze({
  boardRadiusPx: 18,
  panelRadiusPx: 14,
  cellRadiusPx: 16,
  pieceRadiusPx: 16,
});

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value, decimals = 3) {
  return Number(value.toFixed(decimals));
}

export function getTicTacToeTurnUi(state) {
  if (state?.status === "ai-turn") {
    return {
      label: "O thinking",
      detail: "Watch the next move",
      tone: "ai",
      playerRailState: "inactive",
      aiRailState: "active",
    };
  }

  if (state?.draggingPiece) {
    return {
      label: "Release to place",
      detail: "Aim for an open square",
      tone: "dragging",
      playerRailState: "active",
      aiRailState: "inactive",
    };
  }

  if (state?.status === "player-win") {
    return {
      label: "You win",
      detail: "Clear the board to play again",
      tone: "player-win",
      playerRailState: "inactive",
      aiRailState: "inactive",
    };
  }

  if (state?.status === "ai-win") {
    return {
      label: "O wins",
      detail: "Clear the board to try again",
      tone: "ai-win",
      playerRailState: "inactive",
      aiRailState: "inactive",
    };
  }

  if (state?.status === "draw") {
    return {
      label: "Draw board",
      detail: "Clear the board to reset",
      tone: "draw",
      playerRailState: "inactive",
      aiRailState: "inactive",
    };
  }

  return {
    label: "Your turn",
    detail: "Pinch an X to move",
    tone: "player",
    playerRailState: "active",
    aiRailState: "inactive",
  };
}

export function getTicTacToeCellUi(state, index, { draggingCellIndex = -1 } = {}) {
  const mark = state?.board?.[index] ?? null;
  const isEmpty = !mark;
  const isDragging = Boolean(state?.draggingPiece);
  const showPreviewMark = isDragging && isEmpty && state?.previewCellIndex === index;
  const classNames = [isEmpty ? "empty" : "occupied"];

  if (isDragging) {
    classNames.push(isEmpty ? "legal-drop" : "blocked-drop");
    if (showPreviewMark) {
      classNames.push("preview");
    }
    if (draggingCellIndex === index) {
      classNames.push("drag-over");
    }
  } else {
    if (state?.status === "player-turn" && state?.hoverCellIndex === index && isEmpty) {
      classNames.push("hover");
    }
    if (state?.previewCellIndex === index && isEmpty) {
      classNames.push("preview");
    }
  }

  if (state?.winningLine?.includes(index)) {
    classNames.push("winning");
  }
  if (state?.lastMoveIndex === index) {
    classNames.push("last-move");
  }

  return {
    isEmpty,
    showPreviewMark,
    classNames,
  };
}

export function getTicTacToeCursorUi(
  state,
  {
    handDetected = false,
    pinchActive = false,
    draggingCellIndex = -1,
  } = {},
) {
  if (!handDetected) {
    return {
      show: false,
      label: "Find hand",
      tone: "missing",
    };
  }

  if (state?.status === "ai-turn") {
    return {
      show: true,
      label: "Wait",
      tone: "waiting",
    };
  }

  if (state?.draggingPiece) {
    const hoveringCell = draggingCellIndex >= 0 ? state?.board?.[draggingCellIndex] : undefined;
    if (hoveringCell) {
      return {
        show: true,
        label: "Blocked",
        tone: "blocked",
      };
    }

    if (draggingCellIndex >= 0) {
      return {
        show: true,
        label: "Drop",
        tone: "valid",
      };
    }

    return {
      show: true,
      label: "Drag",
      tone: "dragging",
    };
  }

  if (pinchActive) {
    return {
      show: true,
      label: "Grab",
      tone: "pinch",
    };
  }

  return {
    show: true,
    label: "Ready",
    tone: "ready",
  };
}

export function getTicTacToeMarkUi(
  state,
  index,
  mark,
  {
    playerMark = "X",
    aiMark = "O",
  } = {},
) {
  const classNames = [mark === playerMark ? "player" : "ai"];
  const isLastMove = state?.lastMoveIndex === index;

  if (isLastMove) {
    classNames.push("last-move");
  }
  if (mark === aiMark && isLastMove) {
    classNames.push("ai-placed");
  }

  return {
    classNames,
    isLastMove,
  };
}

export function getTicTacToeReservePips(remainingCount, limit) {
  const safeLimit = clampNumber(Math.floor(limit ?? 0), 0, 12);
  const safeRemaining = clampNumber(Math.floor(remainingCount ?? 0), 0, safeLimit);

  return Array.from({ length: safeLimit }, (_, index) => {
    const isFilled = index < safeRemaining;
    return {
      index,
      isFilled,
      className: isFilled ? "filled" : "empty",
    };
  });
}

export function getTicTacToeHudUi(
  state,
  {
    playerWins = 0,
    aiWins = 0,
    draws = 0,
    boardCount = 0,
  } = {},
) {
  const safeBoardCount = Number.isFinite(boardCount) ? boardCount : 0;

  return {
    scoreItems: [
      `You ${Number.isFinite(playerWins) ? playerWins : 0}`,
      `O ${Number.isFinite(aiWins) ? aiWins : 0}`,
      `Draws ${Number.isFinite(draws) ? draws : 0}`,
      `Board ${safeBoardCount}/9`,
    ],
    statusMessage: state?.message ?? "",
    statusTone: state?.status ?? "player-turn",
    showLegend: safeBoardCount === 0 && !state?.draggingPiece && state?.status === "player-turn",
  };
}

export function getTicTacToeResetUi(
  state,
  {
    hasActiveBoard = false,
    totalMs = 1000,
  } = {},
) {
  const safeTotalMs = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 1000;
  const holdMs = clampNumber(state?.resetHoldMs ?? 0, 0, safeTotalMs);
  const progress = hasActiveBoard ? holdMs / safeTotalMs : 0;
  const progressDegrees = `${Math.round(progress * 360)}deg`;

  return {
    label: "New Board",
    countdownText: ((safeTotalMs - holdMs) / 1000).toFixed(2),
    hint: !hasActiveBoard
      ? "Place a mark to enable"
      : state?.resetHoldActive
      ? "Keep your index inside"
      : "Hold your index inside",
    isActive: Boolean(hasActiveBoard && state?.resetHoldActive),
    isDisabled: !hasActiveBoard,
    progress,
    progressDegrees,
  };
}

export function getTicTacToeWinningLineUi(layout, winningLine) {
  if (!layout || !Array.isArray(winningLine) || winningLine.length !== 3) {
    return null;
  }

  const startCell = getTicTacToeCellRect(layout, winningLine[0]);
  const endCell = getTicTacToeCellRect(layout, winningLine[2]);
  if (!startCell || !endCell) {
    return null;
  }

  const dx = endCell.centerX - startCell.centerX;
  const dy = endCell.centerY - startCell.centerY;
  return {
    left: roundNumber(startCell.centerX),
    top: roundNumber(startCell.centerY),
    width: roundNumber(Math.hypot(dx, dy)),
    angleDegrees: roundNumber((Math.atan2(dy, dx) * 180) / Math.PI),
    thickness: roundNumber(clampNumber(layout.cellSize * 0.09, 8, 18)),
  };
}
