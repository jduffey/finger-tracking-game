import { createTicTacToeLayout } from "./ticTacToeGame.js";
import { FULLSCREEN_MODE_LANDING_HOLD_MS } from "./fullscreenModeLanding.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isPointerInExitBox(layout, pointer) {
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

function areFullscreenExitControlLayoutsEqual(previous, next) {
  if (previous === next) {
    return true;
  }
  if (!previous || !next) {
    return false;
  }

  return (
    previous.width === next.width &&
    previous.height === next.height &&
    previous.left === next.left &&
    previous.top === next.top &&
    previous.boxWidth === next.boxWidth &&
    previous.boxHeight === next.boxHeight
  );
}

export function createFullscreenExitControlLayout(width, height) {
  const ticTacToeLayout = createTicTacToeLayout(width, height);
  const exitWidth = clamp(ticTacToeLayout.resetBoxWidth * 0.82, 110, 176);
  const exitHeight = clamp(ticTacToeLayout.resetBoxHeight * 0.78, 96, 144);

  return {
    width: ticTacToeLayout.width,
    height: ticTacToeLayout.height,
    left: ticTacToeLayout.width - exitWidth,
    top: 0,
    boxWidth: exitWidth,
    boxHeight: exitHeight,
  };
}

export function createFullscreenExitControlState(width, height) {
  return {
    layout: createFullscreenExitControlLayout(width, height),
    handVerified: false,
    holdActive: false,
    holdMs: 0,
    shouldExit: false,
  };
}

export function areFullscreenExitControlStatesEqual(previous, next) {
  if (previous === next) {
    return true;
  }
  if (!previous || !next) {
    return false;
  }

  return (
    areFullscreenExitControlLayoutsEqual(previous.layout, next.layout) &&
    previous.handVerified === next.handVerified &&
    previous.holdActive === next.holdActive &&
    previous.holdMs === next.holdMs &&
    previous.shouldExit === next.shouldExit
  );
}

export function stepFullscreenExitControl(state, dtSeconds, input) {
  const safeState = state ?? createFullscreenExitControlState(1280, 720);
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
  const holdActive = pointer.active && isPointerInExitBox(safeState.layout, pointer);
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
    shouldExit: holdActive && holdMs >= FULLSCREEN_MODE_LANDING_HOLD_MS,
  };
}
