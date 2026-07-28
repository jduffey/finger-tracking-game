import { FINGERPRINT_WORLD_TILES } from "./wfcTiles.js";
import {
  createWfcState,
  getWfcGrid,
  isWfcGridValid,
  runWfc,
  setWfcConstraint,
  stepWfc,
} from "./wfcSolver.js";

export const WFC_WORLD_MODE_ID = "fingerprint-worlds";
export const WFC_WORLD_COLS = 39;
export const WFC_WORLD_ROWS = 24;
export const WFC_WORLD_COLLAPSE_STEP_MS = 5;
const WFC_WORLD_CONFLICT_MS = 900;
const WFC_HEX_WIDTH_RATIO = Math.sqrt(3) / 2;
const WFC_HEX_ROW_STEP_RATIO = 0.75;

export const WFC_WORLD_GOAL = Object.freeze({
  id: "shape-a-living-world",
  title: "Shape a living world",
  description:
    "Place a few terrain rules, grow the world, and discover how much variety your choices create.",
  completionCondition: "Generate a valid, fully resolved world.",
  suggestedRuleCount: 3,
  suggestedTerrainCount: 4,
});

export const WFC_WORLD_PALETTE_ACCESSIBILITY = Object.freeze({
  grass: Object.freeze({
    ariaLabel: "Grass terrain",
    symbol: "G",
    pattern: "open dots",
    description: "Flexible meadow terrain that can border every terrain type.",
  }),
  water: Object.freeze({
    ariaLabel: "Water terrain",
    symbol: "W",
    pattern: "horizontal waves",
    description: "Water that joins grass, more water, or a bridge.",
  }),
  forest: Object.freeze({
    ariaLabel: "Forest terrain",
    symbol: "F",
    pattern: "dense chevrons",
    description: "Woodland that grows beside grass, forest, or mountain.",
  }),
  mountain: Object.freeze({
    ariaLabel: "Peak terrain",
    symbol: "M",
    pattern: "triangular ridges",
    description: "High ground that borders grass, forest, or other peaks.",
  }),
  castle: Object.freeze({
    ariaLabel: "Castle landmark",
    symbol: "C",
    pattern: "square battlements",
    description: "A rare landmark that needs grass on every side.",
  }),
  bridge: Object.freeze({
    ariaLabel: "Bridge landmark",
    symbol: "B",
    pattern: "crossed planks",
    description: "A rare crossing that connects water between grassy banks.",
  }),
});

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

function isSameWfcWorldCell(a, b) {
  return a?.col === b?.col && a?.row === b?.row;
}

function getWfcWorldHexVertices(centerX, centerY, width, height) {
  return [
    { x: centerX, y: centerY - height / 2 },
    { x: centerX + width / 2, y: centerY - height / 4 },
    { x: centerX + width / 2, y: centerY + height / 4 },
    { x: centerX, y: centerY + height / 2 },
    { x: centerX - width / 2, y: centerY + height / 4 },
    { x: centerX - width / 2, y: centerY - height / 4 },
  ];
}

function isPointOnLineSegment(point, a, b) {
  const crossProduct = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(crossProduct) > 0.0001) {
    return false;
  }
  const dotProduct = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dotProduct < 0) {
    return false;
  }
  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dotProduct <= squaredLength;
}

function isPointInPolygon(point, vertices) {
  let inside = false;
  for (let index = 0, previousIndex = vertices.length - 1; index < vertices.length; previousIndex = index, index += 1) {
    const current = vertices[index];
    const previous = vertices[previousIndex];
    if (isPointOnLineSegment(point, previous, current)) {
      return true;
    }
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
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
  const topInset = edge;
  const bottomInset = clamp(safeHeight * 0.05, 24, 46);
  const availableGridWidth = Math.max(1, safeWidth - edge * 2);
  const availableGridHeight = Math.max(1, safeHeight - topInset - bottomInset);
  const cellHeight = Math.floor(
    Math.min(
      availableGridWidth / ((WFC_WORLD_COLS + 0.5) * WFC_HEX_WIDTH_RATIO),
      availableGridHeight / (1 + (WFC_WORLD_ROWS - 1) * WFC_HEX_ROW_STEP_RATIO),
    ),
  );
  const cellWidth = cellHeight * WFC_HEX_WIDTH_RATIO;
  const rowStep = cellHeight * WFC_HEX_ROW_STEP_RATIO;
  const gridWidth = cellWidth * (WFC_WORLD_COLS + 0.5);
  const gridHeight = cellHeight + rowStep * (WFC_WORLD_ROWS - 1);
  const gridLeft = edge + Math.max(0, (availableGridWidth - gridWidth) / 2);
  const gridTop = topInset;
  const panelLeft = safeWidth - panelWidth - edge;
  const tileGap = 8;
  const paletteColumns = 3;
  const paletteTileWidth = (panelWidth - tileGap * (paletteColumns - 1)) / paletteColumns;
  const paletteTileHeight = paletteTileWidth;
  const paletteTop = topInset;
  const palette = FINGERPRINT_WORLD_TILES.map((tile, index) => {
    const col = index % paletteColumns;
    const row = Math.floor(index / paletteColumns);
    const accessibility = WFC_WORLD_PALETTE_ACCESSIBILITY[tile.id];
    return {
      ...tile,
      ariaLabel: accessibility?.ariaLabel ?? `${tile.label} terrain`,
      accessibility: {
        ...accessibility,
        shortcut: String(index + 1),
        selectedAnnouncement: `${tile.label} selected`,
      },
      left: panelLeft + col * (paletteTileWidth + tileGap),
      top: paletteTop + row * (paletteTileHeight + tileGap),
      width: paletteTileWidth,
      height: paletteTileHeight,
    };
  });
  const controlTop =
    paletteTop + Math.ceil(FINGERPRINT_WORLD_TILES.length / paletteColumns) * (paletteTileHeight + tileGap) + 14;
  const controlIds = ["generate", "clear"];
  const availableControlHeight = (safeHeight - bottomInset - controlTop - 20) / controlIds.length;
  const controlHeight = clamp(paletteTileHeight * 1.18, 72, Math.min(96, availableControlHeight));
  const controls = controlIds.map((id, index) => ({
    id,
    label: id === "generate" ? "Generate" : "Clear",
    left: panelLeft,
    top: controlTop + index * (controlHeight + 10),
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
      cellSize: cellHeight,
      cellWidth,
      cellHeight,
      rowStep,
      cellShape: "hex",
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

export function getWfcWorldCellCenter(layout, col, row) {
  const cellWidth = layout?.grid?.cellWidth ?? layout?.grid?.cellSize ?? 0;
  const cellHeight = layout?.grid?.cellHeight ?? layout?.grid?.cellSize ?? 0;
  const rowStep = layout?.grid?.rowStep ?? cellHeight;
  return {
    x: layout.grid.left + cellWidth * (col + 0.5) + (row % 2 === 1 ? cellWidth / 2 : 0),
    y: layout.grid.top + rowStep * row + cellHeight / 2,
  };
}

export function mapPointerToWfcCell(layout, pointerX, pointerY) {
  if (!layout || !isPointInRect(layout.grid, pointerX, pointerY)) {
    return null;
  }
  const point = { x: pointerX, y: pointerY };
  const cellWidth = layout.grid.cellWidth ?? layout.grid.cellSize;
  const cellHeight = layout.grid.cellHeight ?? layout.grid.cellSize;
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const center = getWfcWorldCellCenter(layout, col, row);
      const vertices = getWfcWorldHexVertices(center.x, center.y, cellWidth, cellHeight);
      if (isPointInPolygon(point, vertices)) {
        return { col, row };
      }
    }
  }
  return null;
}

export function createWfcWorldStepInput({
  viewport,
  handDetected = false,
  cursor = null,
  pinchActive = false,
  mouseInput = null,
} = {}) {
  const mousePointerActive =
    Boolean(mouseInput?.pointerActive) &&
    Number.isFinite(mouseInput?.pointerX) &&
    Number.isFinite(mouseInput?.pointerY);
  const mouseActionActive = mousePointerActive && (mouseInput.pinchActive || mouseInput.pinchStarted);
  if (mouseActionActive) {
    return {
      pointerActive: true,
      pointerX: mouseInput.pointerX,
      pointerY: mouseInput.pointerY,
      pinchActive: Boolean(mouseInput.pinchActive),
      ...(mouseInput.pinchStarted ? { pinchStarted: true } : {}),
    };
  }

  const handPointerActive =
    Boolean(handDetected) &&
    Number.isFinite(cursor?.x) &&
    Number.isFinite(cursor?.y) &&
    Number.isFinite(viewport?.left) &&
    Number.isFinite(viewport?.top);
  return {
    pointerActive: handPointerActive,
    pointerX: handPointerActive ? cursor.x - viewport.left : 0,
    pointerY: handPointerActive ? cursor.y - viewport.top : 0,
    pinchActive: handPointerActive && Boolean(pinchActive),
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
    paintDragActive: false,
    lastPaintedCell: null,
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
    paintDragActive: false,
    lastPaintedCell: null,
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
      message: "World complete. Pinch Generate to watch new choices.",
    };
  }
  if (wfc.status === "contradiction") {
    return {
      ...game,
      wfc,
      phase: "conflict",
      conflictMs: WFC_WORLD_CONFLICT_MS,
      collapseAccumulatorMs: 0,
      message: "The generator found a conflict. Move one rule or generate again.",
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
    paintDragActive: pinchActive ? Boolean(game.paintDragActive) : false,
    lastPaintedCell: pinchActive ? game.lastPaintedCell ?? null : null,
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
      nextGame = {
        ...selectWfcWorldTile(nextGame, paletteTile.id),
        paintDragActive: false,
        lastPaintedCell: null,
      };
    } else if (control) {
      nextGame = {
        ...runWfcWorldControl(nextGame, control.id, rng),
        paintDragActive: false,
        lastPaintedCell: null,
      };
    } else if (hoverCell && nextGame.phase !== "collapsing") {
      const paintedGame = placeWfcWorldConstraint(nextGame, hoverCell, nextGame.selectedTileId);
      nextGame = {
        ...paintedGame,
        paintDragActive: paintedGame.phase !== "conflict",
        lastPaintedCell: hoverCell,
      };
    }
  } else if (
    pinchActive &&
    pointerActive &&
    nextGame.paintDragActive &&
    hoverCell &&
    !isSameWfcWorldCell(hoverCell, nextGame.lastPaintedCell) &&
    nextGame.phase !== "collapsing"
  ) {
    const paintedGame = placeWfcWorldConstraint(nextGame, hoverCell, nextGame.selectedTileId);
    nextGame = {
      ...paintedGame,
      paintDragActive: paintedGame.phase !== "conflict",
      lastPaintedCell: hoverCell,
    };
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

function getWfcWorldTileCounts(grid) {
  const counts = Object.fromEntries(FINGERPRINT_WORLD_TILES.map((tile) => [tile.id, 0]));
  let resolvedCells = 0;
  for (const row of grid) {
    for (const tileId of row ?? []) {
      if (Object.hasOwn(counts, tileId)) {
        counts[tileId] += 1;
        resolvedCells += 1;
      }
    }
  }
  return { counts, resolvedCells };
}

function getWfcWorldQualityTier(score) {
  if (score >= 90) {
    return { id: "masterpiece", label: "World masterpiece" };
  }
  if (score >= 75) {
    return { id: "thriving", label: "Thriving world" };
  }
  if (score >= 55) {
    return { id: "distinctive", label: "Distinctive world" };
  }
  if (score >= 30) {
    return { id: "emerging", label: "Emerging world" };
  }
  return { id: "sketch", label: "World sketch" };
}

export function getWfcWorldQualitySummary(game) {
  const grid = getWfcWorldGrid(game);
  const totalCells = Math.max(1, (game?.layout?.cols ?? 0) * (game?.layout?.rows ?? 0));
  const { counts, resolvedCells } = getWfcWorldTileCounts(grid);
  const terrainTypes = FINGERPRINT_WORLD_TILES.filter((tile) => counts[tile.id] > 0).length;
  const landmarkCount = counts.castle + counts.bridge;
  const constraintCount = Array.isArray(game?.constraints) ? game.constraints.length : 0;
  const coverage = clamp(resolvedCells / totalCells, 0, 1);
  const diversity = terrainTypes / FINGERPRINT_WORLD_TILES.length;
  const landmarkRichness = clamp(landmarkCount / 5, 0, 1);
  const authorship = clamp(constraintCount / 6, 0, 1);
  const complete = game?.phase === "complete" && resolvedCells === totalCells;
  const valid = complete && isWfcGridValid(grid);
  const score = Math.round(
    coverage * 40 +
      diversity * 30 +
      landmarkRichness * 15 +
      authorship * 15,
  );
  const tier = getWfcWorldQualityTier(score);
  const dominantTile =
    resolvedCells > 0
      ? FINGERPRINT_WORLD_TILES.reduce(
          (best, tile) =>
            counts[tile.id] > (counts[best?.id] ?? -1) ? tile : best,
          null,
        )
      : null;

  return {
    complete,
    valid,
    score,
    tier: tier.id,
    tierLabel: tier.label,
    totalCells,
    resolvedCells,
    coverage,
    terrainTypes,
    landmarkCount,
    constraintCount,
    dominantTerrainId: dominantTile?.id ?? null,
    dominantTerrainLabel: dominantTile?.label ?? null,
    tileCounts: counts,
  };
}

export function getWfcWorldProgress(game) {
  const quality = getWfcWorldQualitySummary(game);
  const phase = game?.phase ?? "seeding";
  let stage = "seed";
  let stageLabel = "Place terrain rules";
  let instruction = "Choose a terrain, then paint a few anchor cells.";
  let overallPercent = Math.min(
    24,
    Math.round((quality.constraintCount / WFC_WORLD_GOAL.suggestedRuleCount) * 24),
  );

  if (phase === "collapsing") {
    stage = "grow";
    stageLabel = "Grow the world";
    instruction = "The world is resolving your rules into a complete landscape.";
    overallPercent = 25 + Math.round(quality.coverage * 74);
  } else if (phase === "complete") {
    stage = "complete";
    stageLabel = "World complete";
    instruction = "Save this world, share it, or generate another variation.";
    overallPercent = 100;
  } else if (phase === "conflict") {
    stage = "repair";
    stageLabel = "Repair a conflict";
    instruction = "Move or clear one rule so neighboring terrain can agree.";
  } else if (quality.constraintCount > 0) {
    stageLabel = "Ready to grow";
    instruction = "Add another anchor or choose Generate to grow the world.";
  }

  return {
    goalId: WFC_WORLD_GOAL.id,
    phase,
    stage,
    stageLabel,
    instruction,
    overallPercent: clamp(overallPercent, 0, 100),
    resolvedPercent: Math.round(quality.coverage * 100),
    resolvedCells: quality.resolvedCells,
    totalCells: quality.totalCells,
    constraintCount: quality.constraintCount,
    suggestedRuleCount: WFC_WORLD_GOAL.suggestedRuleCount,
    terrainTypes: quality.terrainTypes,
    suggestedTerrainCount: WFC_WORLD_GOAL.suggestedTerrainCount,
    generation: Math.max(0, Math.floor(game?.generation ?? 0)),
    complete: quality.complete,
    needsAttention: phase === "conflict",
  };
}

export function getWfcWorldGoalModel(game) {
  const progress = getWfcWorldProgress(game);
  return {
    ...WFC_WORLD_GOAL,
    status: progress.complete
      ? "complete"
      : progress.needsAttention
        ? "needs-attention"
        : "in-progress",
    progress,
    milestones: [
      {
        id: "seed",
        label: "Place 3 terrain rules",
        current: Math.min(progress.constraintCount, WFC_WORLD_GOAL.suggestedRuleCount),
        target: WFC_WORLD_GOAL.suggestedRuleCount,
        complete: progress.constraintCount >= WFC_WORLD_GOAL.suggestedRuleCount,
      },
      {
        id: "grow",
        label: "Resolve the whole map",
        current: progress.resolvedCells,
        target: progress.totalCells,
        complete: progress.complete,
      },
      {
        id: "discover",
        label: "Discover 4 terrain types",
        current: Math.min(progress.terrainTypes, WFC_WORLD_GOAL.suggestedTerrainCount),
        target: WFC_WORLD_GOAL.suggestedTerrainCount,
        complete: progress.terrainTypes >= WFC_WORLD_GOAL.suggestedTerrainCount,
      },
    ],
  };
}

export function getWfcWorldResult(game) {
  const quality = getWfcWorldQualitySummary(game);
  if (!quality.complete) {
    return null;
  }

  const terrainLabel =
    quality.terrainTypes === 1 ? "1 terrain type" : `${quality.terrainTypes} terrain types`;
  const landmarkLabel =
    quality.landmarkCount === 1 ? "1 landmark" : `${quality.landmarkCount} landmarks`;

  return {
    modeId: WFC_WORLD_MODE_ID,
    outcome: quality.valid ? "complete" : "invalid",
    score: quality.score,
    title: quality.tierLabel,
    summary: `${terrainLabel}, ${landmarkLabel}, and ${quality.constraintCount} placed rules shaped this world.`,
    generation: Math.max(0, Math.floor(game?.generation ?? 0)),
    quality,
    metrics: [
      {
        id: "quality",
        label: "World quality",
        value: quality.score,
        displayValue: `${quality.score}/100`,
      },
      {
        id: "terrain-variety",
        label: "Terrain variety",
        value: quality.terrainTypes,
        displayValue: `${quality.terrainTypes}/${FINGERPRINT_WORLD_TILES.length}`,
      },
      {
        id: "landmarks",
        label: "Landmarks",
        value: quality.landmarkCount,
        displayValue: String(quality.landmarkCount),
      },
      {
        id: "rules",
        label: "Your rules",
        value: quality.constraintCount,
        displayValue: String(quality.constraintCount),
      },
    ],
  };
}
