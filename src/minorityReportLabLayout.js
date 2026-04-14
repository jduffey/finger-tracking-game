export const MINORITY_REPORT_GRID_COLUMNS = 3;
export const MINORITY_REPORT_GRID_ROWS = 2;
export const MINORITY_REPORT_SUPER_SECTOR_COLUMNS = 2;
export const MINORITY_REPORT_SUPER_SECTOR_ROWS = 2;
export const MINORITY_REPORT_TILE_GAP = 18;
export const MINORITY_REPORT_SUPER_SECTOR_GAP = 54;
export const MINORITY_REPORT_MIN_COLUMNS_PER_TILE = 1;
export const MINORITY_REPORT_MAX_COLUMNS_PER_TILE = 5;
export const MINORITY_REPORT_MIN_CARDS_PER_COLUMN = 1;
export const MINORITY_REPORT_MAX_CARDS_PER_COLUMN = 4;
export const MINORITY_REPORT_TILE_GRID_COLUMNS = 8;
export const MINORITY_REPORT_TILE_GRID_ROWS = 6;
export const MINORITY_REPORT_MIN_PANELS_PER_TILE =
  MINORITY_REPORT_MIN_COLUMNS_PER_TILE * MINORITY_REPORT_MIN_CARDS_PER_COLUMN;
export const MINORITY_REPORT_MAX_PANELS_PER_TILE =
  MINORITY_REPORT_MAX_COLUMNS_PER_TILE * MINORITY_REPORT_MAX_CARDS_PER_COLUMN;
export const MINORITY_REPORT_PANEL_WIDTH = 84;
export const MINORITY_REPORT_PANEL_HEIGHT = 84;
export const MINORITY_REPORT_TILES_PER_SUPER_SECTOR =
  MINORITY_REPORT_GRID_COLUMNS * MINORITY_REPORT_GRID_ROWS;
export const MINORITY_REPORT_SUPER_SECTOR_COUNT =
  MINORITY_REPORT_SUPER_SECTOR_COLUMNS * MINORITY_REPORT_SUPER_SECTOR_ROWS;
export const MINORITY_REPORT_TILE_COUNT =
  MINORITY_REPORT_TILES_PER_SUPER_SECTOR * MINORITY_REPORT_SUPER_SECTOR_COUNT;
const MINORITY_REPORT_TILE_GRID_INSET_X = 8;
const MINORITY_REPORT_TILE_GRID_INSET_TOP = 34;
const MINORITY_REPORT_TILE_GRID_INSET_BOTTOM = 10;
const MINORITY_REPORT_GRID_CELL_FILL_X = 0.76;
const MINORITY_REPORT_GRID_CELL_FILL_Y = 0.76;
const MINORITY_REPORT_MIN_PANEL_SCALE = 0.18;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampPanelCount(value) {
  return clamp(
    value,
    MINORITY_REPORT_MIN_PANELS_PER_TILE,
    MINORITY_REPORT_MAX_PANELS_PER_TILE,
  );
}

function clampColumnCount(value) {
  return clamp(
    value,
    MINORITY_REPORT_MIN_COLUMNS_PER_TILE,
    MINORITY_REPORT_MAX_COLUMNS_PER_TILE,
  );
}

function clampColumnCardCount(value) {
  return clamp(
    value,
    MINORITY_REPORT_MIN_CARDS_PER_COLUMN,
    MINORITY_REPORT_MAX_CARDS_PER_COLUMN,
  );
}

function getMinorityReportDefaultGridColumnIndex(tileColumnIndex) {
  return clamp(tileColumnIndex, 0, MINORITY_REPORT_TILE_GRID_COLUMNS - 1);
}

export function getMinorityReportRandomPanelAssignments(random = Math.random) {
  void random;
  const assignments = [];
  for (let tileIndex = 0; tileIndex < MINORITY_REPORT_TILE_COUNT; tileIndex += 1) {
    for (let tileSlotIndex = 0; tileSlotIndex < 2; tileSlotIndex += 1) {
      assignments.push({
        tileIndex,
        tileSlotIndex,
        tileSlotCount: 2,
        tileColumnIndex: tileSlotIndex,
        tileColumnCount: 2,
        columnCardIndex: 0,
        columnCardCount: 1,
        tileMaxColumnCardCount: 1,
        gridColumnIndex: tileSlotIndex,
        gridRowIndex: 0,
      });
    }
  }
  return assignments;
}

function getMinorityReportBaseTileSize(stageSize) {
  const width = Math.max(1, stageSize?.width ?? 960);
  const height = Math.max(1, stageSize?.height ?? 640);
  const tileWidth =
    (width - MINORITY_REPORT_TILE_GAP * (MINORITY_REPORT_GRID_COLUMNS + 1)) /
    MINORITY_REPORT_GRID_COLUMNS;
  const tileHeight =
    (height - MINORITY_REPORT_TILE_GAP * (MINORITY_REPORT_GRID_ROWS + 1)) /
    MINORITY_REPORT_GRID_ROWS;
  return {
    tileWidth,
    tileHeight,
  };
}

function getMinorityReportSuperSectorSize(stageSize) {
  const { tileWidth, tileHeight } = getMinorityReportBaseTileSize(stageSize);
  return {
    width:
      tileWidth * MINORITY_REPORT_GRID_COLUMNS +
      MINORITY_REPORT_TILE_GAP * (MINORITY_REPORT_GRID_COLUMNS + 1),
    height:
      tileHeight * MINORITY_REPORT_GRID_ROWS +
      MINORITY_REPORT_TILE_GAP * (MINORITY_REPORT_GRID_ROWS + 1),
  };
}

export function getMinorityReportWorkspaceBounds(stageSize) {
  const superSectorSize = getMinorityReportSuperSectorSize(stageSize);
  const width =
    superSectorSize.width * MINORITY_REPORT_SUPER_SECTOR_COLUMNS +
    MINORITY_REPORT_SUPER_SECTOR_GAP * (MINORITY_REPORT_SUPER_SECTOR_COLUMNS - 1);
  const height =
    superSectorSize.height * MINORITY_REPORT_SUPER_SECTOR_ROWS +
    MINORITY_REPORT_SUPER_SECTOR_GAP * (MINORITY_REPORT_SUPER_SECTOR_ROWS - 1);
  return {
    left: 0,
    top: 0,
    width,
    height,
    centerX: width * 0.5,
    centerY: height * 0.5,
  };
}

export function getMinorityReportSuperSectorBounds(stageSize, superSectorIndex) {
  const superSectorSize = getMinorityReportSuperSectorSize(stageSize);
  const col = superSectorIndex % MINORITY_REPORT_SUPER_SECTOR_COLUMNS;
  const row = Math.floor(superSectorIndex / MINORITY_REPORT_SUPER_SECTOR_COLUMNS);
  const left = col * (superSectorSize.width + MINORITY_REPORT_SUPER_SECTOR_GAP);
  const top = row * (superSectorSize.height + MINORITY_REPORT_SUPER_SECTOR_GAP);
  return {
    index: superSectorIndex,
    col,
    row,
    left,
    top,
    width: superSectorSize.width,
    height: superSectorSize.height,
    centerX: left + superSectorSize.width * 0.5,
    centerY: top + superSectorSize.height * 0.5,
  };
}

export function getMinorityReportSuperSectorBoundsList(stageSize) {
  return Array.from(
    { length: MINORITY_REPORT_SUPER_SECTOR_COUNT },
    (_, superSectorIndex) =>
      getMinorityReportSuperSectorBounds(stageSize, superSectorIndex),
  );
}

export function getMinorityReportTileBounds(stageSize, tileIndex) {
  const { tileWidth, tileHeight } = getMinorityReportBaseTileSize(stageSize);
  const superSectorIndex = Math.floor(tileIndex / MINORITY_REPORT_TILES_PER_SUPER_SECTOR);
  const localTileIndex = tileIndex % MINORITY_REPORT_TILES_PER_SUPER_SECTOR;
  const col = localTileIndex % MINORITY_REPORT_GRID_COLUMNS;
  const row = Math.floor(localTileIndex / MINORITY_REPORT_GRID_COLUMNS);
  const superSector = getMinorityReportSuperSectorBounds(stageSize, superSectorIndex);
  const left =
    superSector.left + MINORITY_REPORT_TILE_GAP + col * (tileWidth + MINORITY_REPORT_TILE_GAP);
  const top =
    superSector.top + MINORITY_REPORT_TILE_GAP + row * (tileHeight + MINORITY_REPORT_TILE_GAP);
  return {
    index: tileIndex,
    col,
    row,
    localTileIndex,
    superSectorIndex,
    left,
    top,
    width: tileWidth,
    height: tileHeight,
    centerX: left + tileWidth * 0.5,
    centerY: top + tileHeight * 0.5,
  };
}

export function getMinorityReportTileBoundsList(stageSize) {
  return Array.from({ length: MINORITY_REPORT_TILE_COUNT }, (_, tileIndex) =>
    getMinorityReportTileBounds(stageSize, tileIndex),
  );
}

export function getMinorityReportTileIndexAtPoint(point, stageSize) {
  if (!point) {
    return null;
  }

  for (let tileIndex = 0; tileIndex < MINORITY_REPORT_TILE_COUNT; tileIndex += 1) {
    const tile = getMinorityReportTileBounds(stageSize, tileIndex);
    if (
      point.x >= tile.left &&
      point.x <= tile.left + tile.width &&
      point.y >= tile.top &&
      point.y <= tile.top + tile.height
    ) {
      return tileIndex;
    }
  }

  return null;
}

export function getMinorityReportTileGridMetrics(stageSize, tileIndex) {
  const tileBounds = getMinorityReportTileBounds(stageSize, tileIndex);
  const left = tileBounds.left + MINORITY_REPORT_TILE_GRID_INSET_X;
  const top = tileBounds.top + MINORITY_REPORT_TILE_GRID_INSET_TOP;
  const width = Math.max(1, tileBounds.width - MINORITY_REPORT_TILE_GRID_INSET_X * 2);
  const height = Math.max(
    1,
    tileBounds.height -
      MINORITY_REPORT_TILE_GRID_INSET_TOP -
      MINORITY_REPORT_TILE_GRID_INSET_BOTTOM,
  );
  const columnWidth = width / MINORITY_REPORT_TILE_GRID_COLUMNS;
  const rowHeight = height / MINORITY_REPORT_TILE_GRID_ROWS;
  const panelScale = clamp(
    Math.min(
      (columnWidth * MINORITY_REPORT_GRID_CELL_FILL_X) / MINORITY_REPORT_PANEL_WIDTH,
      (rowHeight * MINORITY_REPORT_GRID_CELL_FILL_Y) / MINORITY_REPORT_PANEL_HEIGHT,
      1,
    ),
    MINORITY_REPORT_MIN_PANEL_SCALE,
    1,
  );
  return {
    tileBounds,
    left,
    top,
    width,
    height,
    columnWidth,
    rowHeight,
    panelScale,
    panelWidth: MINORITY_REPORT_PANEL_WIDTH * panelScale,
    panelHeight: MINORITY_REPORT_PANEL_HEIGHT * panelScale,
  };
}

function getMinorityReportGridSlotKey(tileIndex, gridColumnIndex, gridRowIndex) {
  return `${tileIndex}:${gridColumnIndex}:${gridRowIndex}`;
}

function normalizeGridSlotIndices(panelAssignment) {
  const tileColumnCount = clampColumnCount(panelAssignment?.tileColumnCount ?? 3);
  const tileColumnIndex = clamp(
    panelAssignment?.tileColumnIndex ?? 0,
    0,
    tileColumnCount - 1,
  );
  const defaultGridColumnIndex = getMinorityReportDefaultGridColumnIndex(
    tileColumnIndex,
    tileColumnCount,
  );
  return {
    gridColumnIndex: clamp(
      panelAssignment?.gridColumnIndex ?? defaultGridColumnIndex,
      0,
      MINORITY_REPORT_TILE_GRID_COLUMNS - 1,
    ),
    gridRowIndex: clamp(
      panelAssignment?.gridRowIndex ?? panelAssignment?.columnCardIndex ?? 0,
      0,
      MINORITY_REPORT_TILE_GRID_ROWS - 1,
    ),
  };
}

function getMinorityReportGridSlotCenter(metrics, gridColumnIndex, gridRowIndex) {
  return {
    x: metrics.left + (gridColumnIndex + 0.5) * metrics.columnWidth,
    y: metrics.top + (gridRowIndex + 0.5) * metrics.rowHeight,
  };
}

export function getMinorityReportGridSlotAtPoint(point, stageSize, tileIndex) {
  if (!point) {
    return null;
  }
  const metrics = getMinorityReportTileGridMetrics(stageSize, tileIndex);
  return {
    gridColumnIndex: clamp(
      Math.floor((point.x - metrics.left) / Math.max(1, metrics.columnWidth)),
      0,
      MINORITY_REPORT_TILE_GRID_COLUMNS - 1,
    ),
    gridRowIndex: clamp(
      Math.floor((point.y - metrics.top) / Math.max(1, metrics.rowHeight)),
      0,
      MINORITY_REPORT_TILE_GRID_ROWS - 1,
    ),
  };
}

export function getMinorityReportNearestOpenGridSlot({
  point,
  stageSize,
  tileIndex,
  occupiedSlotKeys = new Set(),
}) {
  const metrics = getMinorityReportTileGridMetrics(stageSize, tileIndex);
  const anchor = point ?? {
    x: metrics.left + metrics.width * 0.5,
    y: metrics.top + metrics.height * 0.5,
  };
  let winner = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let gridRowIndex = 0; gridRowIndex < MINORITY_REPORT_TILE_GRID_ROWS; gridRowIndex += 1) {
    for (
      let gridColumnIndex = 0;
      gridColumnIndex < MINORITY_REPORT_TILE_GRID_COLUMNS;
      gridColumnIndex += 1
    ) {
      const slotKey = getMinorityReportGridSlotKey(
        tileIndex,
        gridColumnIndex,
        gridRowIndex,
      );
      if (occupiedSlotKeys.has(slotKey)) {
        continue;
      }
      const center = getMinorityReportGridSlotCenter(
        metrics,
        gridColumnIndex,
        gridRowIndex,
      );
      const distance =
        (center.x - anchor.x) * (center.x - anchor.x) +
        (center.y - anchor.y) * (center.y - anchor.y);
      if (
        distance < bestDistance ||
        (distance === bestDistance &&
          winner &&
          (gridRowIndex < winner.gridRowIndex ||
            (gridRowIndex === winner.gridRowIndex &&
              gridColumnIndex < winner.gridColumnIndex)))
      ) {
        winner = {
          gridColumnIndex,
          gridRowIndex,
        };
        bestDistance = distance;
      }
    }
  }

  return winner ?? getMinorityReportGridSlotAtPoint(anchor, stageSize, tileIndex);
}

export function getMinorityReportPanelPlacement(_sceneIndex, panelAssignment, stageSize) {
  const tileIndex = panelAssignment?.tileIndex ?? 0;
  const slotIndex = panelAssignment?.tileSlotIndex ?? 0;
  const tileSlotCount = clampPanelCount(panelAssignment?.tileSlotCount ?? 3);
  const tileColumnIndex = clamp(
    panelAssignment?.tileColumnIndex ?? 0,
    0,
    clampColumnCount(panelAssignment?.tileColumnCount ?? 3) - 1,
  );
  const columnCardIndex = clamp(
    panelAssignment?.columnCardIndex ?? 0,
    0,
    clampColumnCardCount(panelAssignment?.columnCardCount ?? 1) - 1,
  );
  const columnCardCount = clampColumnCardCount(panelAssignment?.columnCardCount ?? 1);
  const tileColumnCount = clampColumnCount(panelAssignment?.tileColumnCount ?? 3);
  const tileMaxColumnCardCount = clampColumnCardCount(
    panelAssignment?.tileMaxColumnCardCount ?? columnCardCount,
  );
  const { gridColumnIndex, gridRowIndex } = normalizeGridSlotIndices(panelAssignment);
  const tileBounds = getMinorityReportTileBounds(stageSize, tileIndex);
  const metrics = getMinorityReportTileGridMetrics(stageSize, tileIndex);
  const center = getMinorityReportGridSlotCenter(metrics, gridColumnIndex, gridRowIndex);
  return clampMinorityReportPanelPosition(
    {
      tileIndex,
      superSectorIndex: tileBounds.superSectorIndex,
      localTileIndex: tileBounds.localTileIndex,
      tileSlotIndex: slotIndex,
      tileSlotCount,
      tileColumnIndex,
      tileColumnCount,
      columnCardIndex,
      columnCardCount,
      tileMaxColumnCardCount,
      gridColumnIndex,
      gridRowIndex,
      x: center.x,
      y: center.y,
      rotation: 0,
      scale: metrics.panelScale,
    },
    stageSize,
  );
}

export function snapMinorityReportPanelToGrid(
  panel,
  stageSize,
  allPanels = [],
  preferredPoint = null,
) {
  const tileIndex = panel?.tileIndex ?? 0;
  const occupiedSlotKeys = new Set();
  for (const otherPanel of allPanels) {
    if (!otherPanel || otherPanel.id === panel?.id || otherPanel.tileIndex !== tileIndex) {
      continue;
    }
    const otherSlot = normalizeGridSlotIndices(otherPanel);
    occupiedSlotKeys.add(
      getMinorityReportGridSlotKey(
        tileIndex,
        otherSlot.gridColumnIndex,
        otherSlot.gridRowIndex,
      ),
    );
  }

  const placement = getMinorityReportPanelPlacement(0, panel, stageSize);
  const slot = getMinorityReportNearestOpenGridSlot({
    point:
      preferredPoint ??
      (Number.isFinite(panel?.x) && Number.isFinite(panel?.y)
        ? { x: panel.x, y: panel.y }
        : { x: placement.x, y: placement.y }),
    stageSize,
    tileIndex,
    occupiedSlotKeys,
  });
  return getMinorityReportPanelPlacement(
    0,
    {
      ...panel,
      gridColumnIndex: slot.gridColumnIndex,
      gridRowIndex: slot.gridRowIndex,
    },
    stageSize,
  );
}

export function resolveMinorityReportPanelGridOccupancy(
  panels,
  stageSize,
  getPreferredPoint = null,
) {
  const resolvedPanels = [];
  for (const panel of Array.isArray(panels) ? panels : []) {
    const preferredPoint =
      typeof getPreferredPoint === "function"
        ? getPreferredPoint(panel)
        : null;
    const snapped = snapMinorityReportPanelToGrid(
      panel,
      stageSize,
      resolvedPanels,
      preferredPoint,
    );
    const nextPanel = {
      ...panel,
      ...snapped,
    };
    resolvedPanels.push(nextPanel);
  }
  return resolvedPanels;
}

export function clampMinorityReportPanelPosition(panel, stageSize) {
  const tileBounds = getMinorityReportTileBounds(stageSize, panel.tileIndex ?? 0);
  const halfWidth = MINORITY_REPORT_PANEL_WIDTH * (panel.scale ?? 1) * 0.5;
  const halfHeight = MINORITY_REPORT_PANEL_HEIGHT * (panel.scale ?? 1) * 0.5;
  const minX = tileBounds.left + halfWidth;
  const maxX = tileBounds.left + tileBounds.width - halfWidth;
  const minY = tileBounds.top + halfHeight;
  const maxY = tileBounds.top + tileBounds.height - halfHeight;
  return {
    ...panel,
    x: clamp(panel.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(panel.y, Math.min(minY, maxY), Math.max(minY, maxY)),
  };
}
