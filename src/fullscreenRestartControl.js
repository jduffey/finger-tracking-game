import { createTicTacToeLayout } from "./ticTacToeGame.js";
import { FULLSCREEN_MODE_LANDING_HOLD_MS } from "./fullscreenModeLanding.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isPointerInRestartBox(layout, pointer) {
  const boxWidth = layout?.boxWidth ?? layout?.width ?? 0;
  const boxHeight = layout?.boxHeight ?? layout?.height ?? 0;
  return (
    layout &&
    pointer &&
    pointer.x >= layout.left &&
    pointer.x <= layout.left + boxWidth &&
    pointer.y >= layout.top &&
    pointer.y <= layout.top + boxHeight
  );
}

export function createFullscreenRestartControlLayout(width, height) {
  const ticTacToeLayout = createTicTacToeLayout(width, height);
  const layoutWidth = Math.max(1, Number.isFinite(width) ? width : ticTacToeLayout.width);
  const layoutHeight = Math.max(1, Number.isFinite(height) ? height : ticTacToeLayout.height);
  const baseSize = Math.min(layoutWidth, layoutHeight);
  const margin = clamp(baseSize * 0.035, 16, 34);
  const maxWidth = Math.max(96, layoutWidth - margin * 2);
  const maxHeight = Math.max(88, layoutHeight - margin * 2);
  const boxWidth = Math.min(maxWidth, clamp(ticTacToeLayout.resetBoxWidth * 1.02, 132, 220));
  const boxHeight = Math.min(maxHeight, clamp(ticTacToeLayout.resetBoxHeight * 0.88, 104, 158));

  return {
    width: layoutWidth,
    height: layoutHeight,
    left: margin,
    top: layoutHeight - margin - boxHeight,
    boxWidth,
    boxHeight,
  };
}

export function createFullscreenRestartControlState(width, height) {
  return {
    layout: createFullscreenRestartControlLayout(width, height),
    handVerified: false,
    holdActive: false,
    holdMs: 0,
    shouldRestart: false,
  };
}

export function stepFullscreenRestartControl(state, dtSeconds, input) {
  const safeState = state ?? createFullscreenRestartControlState(1280, 720);
  const handVerified = Boolean(input?.handVerified);
  const pointer = {
    active:
      handVerified &&
      input?.pointerActive !== false &&
      Number.isFinite(input?.pointerX) &&
      Number.isFinite(input?.pointerY),
    x: Number.isFinite(input?.pointerX) ? clamp(input.pointerX, 0, safeState.layout.width) : 0,
    y: Number.isFinite(input?.pointerY) ? clamp(input.pointerY, 0, safeState.layout.height) : 0,
  };
  const holdActive = pointer.active && isPointerInRestartBox(safeState.layout, pointer);
  const elapsedMs = Math.max(0, Math.min(0.05, Number.isFinite(dtSeconds) ? dtSeconds : 0)) * 1000;
  const holdMs = holdActive
    ? safeState.holdActive
      ? Math.min(FULLSCREEN_MODE_LANDING_HOLD_MS, safeState.holdMs + elapsedMs)
      : 0
    : 0;

  return {
    ...safeState,
    handVerified,
    holdActive,
    holdMs,
    shouldRestart: holdActive && holdMs >= FULLSCREEN_MODE_LANDING_HOLD_MS,
  };
}
