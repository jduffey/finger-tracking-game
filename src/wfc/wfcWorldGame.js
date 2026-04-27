import { FINGERPRINT_WORLD_TILES } from "./wfcTiles.js";
import {
  createWfcState,
  getWfcGrid,
  runWfc,
  setWfcConstraint,
  stepWfc,
} from "./wfcSolver.js";

export const WFC_WORLD_MODE_ID = "fingerprint-worlds";
export const WFC_WORLD_COLS = 16;
export const WFC_WORLD_ROWS = 12;
export const WFC_WORLD_COLLAPSE_STEP_MS = 18;
const WFC_WORLD_CONFLICT_MS = 900;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isPointInRect(rect, x, y) {
  return (
    rect &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  );
}

function createConstrainedWfc(cols, rows, constraints) {
  let wfc = createWfcState({ cols, rows });
  for (const constraint of constraints) {
    wfc = setWfcConstraint(wfc, constraint.col, constraint.row, constraint.tileId);
    if (wfc.status === "contradiction") {
      return wfc;
    }
  }
  return wfc;
}

export function createWfcWorldLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(320, Number.isFinite(height) ? height : 320);
  const edge = clamp(Math.min(safeWidth, safeHeight) * 0.035, 16, 34);
  const panelWidth = clamp(safeWidth * 0.22, 174, 250);
  const gap = clamp(safeWidth * 0.018, 14, 28);
  const topInset = clamp(safeHeight * 0.085, 54, 78);
  const bottomInset = clamp(safeHeight * 0.05, 24, 46);
  const availableGridWidth = Math.max(1, safeWidth - edge * 2 - panelWidth - gap);
  const availableGridHeight = Math.max(1, safeHeight - topInset - bottomInset);
  const cellSize = Math.floor(Math.min(availableGridWidth / WFC_WORLD_COLS, availableGridHeight / WFC_WORLD_ROWS));
  const gridWidth = cellSize * WFC_WORLD_COLS;
  const gridHeight = cellSize * WFC_WORLD_ROWS;
  const gridLeft = edge + Math.max(0, (availableGridWidth - gridWidth) / 2);
  const gridTop = topInset + Math.max(0, (availableGridHeight - gridHeight) / 2);
  const panelLeft = Math.min(safeWidth - panelWidth - edge, gridLeft + gridWidth + gap);
  const compactPanel = safeHeight <= 520;
  const tileGap = compactPanel ? 6 : 10;
  const paletteColumns = compactPanel ? 4 : 2;
  const paletteRows = Math.ceil(FINGERPRINT_WORLD_TILES.length / paletteColumns);
  const controlGap = compactPanel ? 6 : 10;
  const controlCount = 3;
  const panelBottom = safeHeight - bottomInset;
  const paletteTileWidth =
    (panelWidth - tileGap * Math.max(0, paletteColumns - 1)) / paletteColumns;
  const paletteTop = topInset;
  const controlHeight = clamp(
    safeHeight * (compactPanel ? 0.095 : 0.08),
    compactPanel ? 32 : 44,
    compactPanel ? 42 : 58,
  );
  const availablePaletteHeight =
    panelBottom -
    paletteTop -
    14 -
    controlCount * controlHeight -
    Math.max(0, controlCount - 1) * controlGap;
  const paletteTileHeight = clamp(
    Math.min(
      paletteTileWidth * 0.72,
      (availablePaletteHeight - Math.max(0, paletteRows - 1) * tileGap) / paletteRows,
    ),
    compactPanel ? 28 : 50,
    compactPanel ? 52 : 74,
  );
  const palette = FINGERPRINT_WORLD_TILES.map((tile, index) => {
    const col = index % paletteColumns;
    const row = Math.floor(index / paletteColumns);
    return {
      ...tile,
      left: panelLeft + col * (paletteTileWidth + tileGap),
      top: paletteTop + row * (paletteTileHeight + tileGap),
      width: paletteTileWidth,
      height: paletteTileHeight,
    };
  });
  const controlTop =
    paletteTop +
    paletteRows * paletteTileHeight +
    Math.max(0, paletteRows - 1) * tileGap +
    14;
  const controls = ["generate", "reroll", "clear"].map((id, index) => ({
    id,
    label: id === "generate" ? "Generate" : id === "reroll" ? "Reroll" : "Clear",
    left: panelLeft,
    top: controlTop + index * (controlHeight + controlGap),
    width: panelWidth,
    height: controlHeight,
  }));

  return {
    width: safeWidth,
    height: safeHeight,
    cols: WFC_WORLD_COLS,
    rows: WFC_WORLD_ROWS,
    grid: {
      left: gridLeft,
      top: gridTop,
      width: gridWidth,
      height: gridHeight,
      cellSize,
    },
    palette,
    controls,
    panel: {
      left: panelLeft,
      top: topInset,
      width: panelWidth,
    },
  };
}

export function mapPointerToWfcCell(layout, pointerX, pointerY) {
  if (!layout || !isPointInRect(layout.grid, pointerX, pointerY)) {
    return null;
  }
  return {
    col: clamp(Math.floor((pointerX - layout.grid.left) / layout.grid.cellSize), 0, layout.cols - 1),
    row: clamp(Math.floor((pointerY - layout.grid.top) / layout.grid.cellSize), 0, layout.rows - 1),
  };
}

export function getWfcWorldControlAtPoint(layout, pointerX, pointerY) {
  return layout?.controls?.find((control) => isPointInRect(control, pointerX, pointerY)) ?? null;
}

export function getWfcWorldPaletteTileAtPoint(layout, pointerX, pointerY) {
  return layout?.palette?.find((tile) => isPointInRect(tile, pointerX, pointerY)) ?? null;
}

export function createWfcWorldGame(width, height) {
  const layout = createWfcWorldLayout(width, height);
  return {
    layout,
    wfc: createWfcState({ cols: layout.cols, rows: layout.rows }),
    phase: "seeding",
    selectedTileId: "grass",
    hoverCell: null,
    constraints: [],
    previousPinchActive: false,
    collapseAccumulatorMs: 0,
    conflictMs: 0,
    generation: 0,
    message: "Pinch map cells to place rules, then pinch Generate.",
  };
}

export function selectWfcWorldTile(game, tileId) {
  if (!game || !FINGERPRINT_WORLD_TILES.some((tile) => tile.id === tileId)) {
    return game;
  }
  return {
    ...game,
    selectedTileId: tileId,
    message: `${FINGERPRINT_WORLD_TILES.find((tile) => tile.id === tileId)?.label ?? tileId} rule selected.`,
  };
}

function placeWfcWorldConstraint(game, cell, tileId) {
  if (!cell) {
    return game;
  }
  const nextWfc = setWfcConstraint(game.wfc, cell.col, cell.row, tileId);
  if (nextWfc.status === "contradiction") {
    return {
      ...game,
      phase: "conflict",
      conflictMs: WFC_WORLD_CONFLICT_MS,
      message: "Those rules conflict. Try a softer neighboring tile.",
    };
  }

  return {
    ...game,
    wfc: nextWfc,
    phase: "seeding",
    constraints: nextWfc.constraints,
    message: `${FINGERPRINT_WORLD_TILES.find((tile) => tile.id === tileId)?.label ?? tileId} rule placed.`,
  };
}

export function startWfcWorldCollapse(game) {
  if (!game) {
    return game;
  }
  const wfc = createConstrainedWfc(game.layout.cols, game.layout.rows, game.constraints);
  if (wfc.status === "contradiction") {
    return {
      ...game,
      wfc,
      phase: "conflict",
      conflictMs: WFC_WORLD_CONFLICT_MS,
      message: "Those rules conflict. Clear or move one rule.",
    };
  }
  return {
    ...game,
    wfc,
    phase: wfc.status === "complete" ? "complete" : "collapsing",
    collapseAccumulatorMs: 0,
    generation: game.generation + 1,
    message: "Wave Function Collapse is filling the world.",
  };
}

export function clearWfcWorld(game) {
  if (!game) {
    return game;
  }
  return {
    ...game,
    wfc: createWfcState({ cols: game.layout.cols, rows: game.layout.rows }),
    phase: "seeding",
    hoverCell: null,
    constraints: [],
    collapseAccumulatorMs: 0,
    conflictMs: 0,
    message: "World cleared. Pinch cells to place new rules.",
  };
}

function runAnimatedCollapse(game, dtMs, rng) {
  if (game.phase !== "collapsing") {
    return game;
  }
  let wfc = game.wfc;
  let accumulator = game.collapseAccumulatorMs + dtMs;
  let steps = Math.floor(accumulator / WFC_WORLD_COLLAPSE_STEP_MS);
  accumulator -= steps * WFC_WORLD_COLLAPSE_STEP_MS;

  while (steps > 0 && wfc.status !== "complete" && wfc.status !== "contradiction") {
    wfc = stepWfc(wfc, rng);
    steps -= 1;
  }

  if (wfc.status === "complete") {
    return {
      ...game,
      wfc,
      phase: "complete",
      collapseAccumulatorMs: 0,
      message: "World complete. Pinch Reroll to watch new choices.",
    };
  }
  if (wfc.status === "contradiction") {
    return {
      ...game,
      wfc,
      phase: "conflict",
      conflictMs: WFC_WORLD_CONFLICT_MS,
      collapseAccumulatorMs: 0,
      message: "The generator found a conflict. Move one rule or reroll.",
    };
  }

  return {
    ...game,
    wfc,
    collapseAccumulatorMs: accumulator,
  };
}

function runWfcWorldControl(game, controlId, rng) {
  switch (controlId) {
    case "generate":
      return startWfcWorldCollapse(game);
    case "reroll":
      return {
        ...startWfcWorldCollapse({
          ...game,
          wfc: createConstrainedWfc(game.layout.cols, game.layout.rows, game.constraints),
        }),
        message: "Rerolling the world around your rules.",
      };
    case "clear":
      return clearWfcWorld(game);
    default:
      return game;
  }
}

export function stepWfcWorldGame(game, dtSeconds, input = {}, rng = Math.random) {
  if (!game?.layout) {
    return game;
  }

  const dtMs = Math.max(0, (Number.isFinite(dtSeconds) ? dtSeconds : 0) * 1000);
  const pointerX = Number.isFinite(input.pointerX) ? input.pointerX : input.x;
  const pointerY = Number.isFinite(input.pointerY) ? input.pointerY : input.y;
  const pointerActive = input.pointerActive !== false && Number.isFinite(pointerX) && Number.isFinite(pointerY);
  const hoverCell = pointerActive ? mapPointerToWfcCell(game.layout, pointerX, pointerY) : null;
  const pinchActive = Boolean(input.pinchActive);
  const pinchStarted = Boolean(input.pinchStarted) || (pinchActive && !game.previousPinchActive);
  const generateRequested = Boolean(input.generateRequested || input.openPalmStarted);

  let nextGame = {
    ...game,
    hoverCell,
    previousPinchActive: pinchActive,
    conflictMs: Math.max(0, (game.conflictMs ?? 0) - dtMs),
  };
  if (nextGame.phase === "conflict" && nextGame.conflictMs <= 0) {
    nextGame = {
      ...nextGame,
      phase: "seeding",
      message: "Adjust a rule, then generate again.",
    };
  }

  if (generateRequested) {
    nextGame = startWfcWorldCollapse(nextGame);
  }

  if (pinchStarted && pointerActive) {
    const paletteTile = getWfcWorldPaletteTileAtPoint(nextGame.layout, pointerX, pointerY);
    const control = getWfcWorldControlAtPoint(nextGame.layout, pointerX, pointerY);
    if (paletteTile) {
      nextGame = selectWfcWorldTile(nextGame, paletteTile.id);
    } else if (control) {
      nextGame = runWfcWorldControl(nextGame, control.id, rng);
    } else if (hoverCell && nextGame.phase !== "collapsing") {
      nextGame = placeWfcWorldConstraint(nextGame, hoverCell, nextGame.selectedTileId);
    }
  }

  return runAnimatedCollapse(nextGame, dtMs, rng);
}

export function getWfcWorldGrid(game) {
  return getWfcGrid(game?.wfc);
}

export function completeWfcWorldNow(game, rng = Math.random) {
  const completeWfc = runWfc(game?.wfc, { maxSteps: game?.layout?.cols * game?.layout?.rows * 4, rng });
  return {
    ...game,
    wfc: completeWfc,
    phase: completeWfc.status === "complete" ? "complete" : "conflict",
    message: completeWfc.status === "complete" ? "World complete." : "The rules conflict.",
  };
}
