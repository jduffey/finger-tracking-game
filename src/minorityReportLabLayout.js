export const MINORITY_REPORT_GRID_COLUMNS = 3;
export const MINORITY_REPORT_GRID_ROWS = 2;
export const MINORITY_REPORT_SUPER_SECTOR_COLUMNS = 2;
export const MINORITY_REPORT_SUPER_SECTOR_ROWS = 2;
export const MINORITY_REPORT_TILE_GAP = 18;
export const MINORITY_REPORT_SUPER_SECTOR_GAP = 54;
export const MINORITY_REPORT_MIN_PANELS_PER_TILE = 2;
export const MINORITY_REPORT_MAX_PANELS_PER_TILE = 5;
export const MINORITY_REPORT_PANEL_WIDTH = 132;
export const MINORITY_REPORT_PANEL_HEIGHT = 84;
export const MINORITY_REPORT_TILES_PER_SUPER_SECTOR =
  MINORITY_REPORT_GRID_COLUMNS * MINORITY_REPORT_GRID_ROWS;
export const MINORITY_REPORT_SUPER_SECTOR_COUNT =
  MINORITY_REPORT_SUPER_SECTOR_COLUMNS * MINORITY_REPORT_SUPER_SECTOR_ROWS;
export const MINORITY_REPORT_TILE_COUNT =
  MINORITY_REPORT_TILES_PER_SUPER_SECTOR * MINORITY_REPORT_SUPER_SECTOR_COUNT;

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

function getRandomPanelCount(random) {
  const span =
    MINORITY_REPORT_MAX_PANELS_PER_TILE - MINORITY_REPORT_MIN_PANELS_PER_TILE + 1;
  return (
    MINORITY_REPORT_MIN_PANELS_PER_TILE +
    Math.floor(Math.max(0, Math.min(0.999999, random())) * span)
  );
}

export function getMinorityReportRandomPanelAssignments(random = Math.random) {
  const assignments = [];
  for (let tileIndex = 0; tileIndex < MINORITY_REPORT_TILE_COUNT; tileIndex += 1) {
    const tileSlotCount = getRandomPanelCount(random);
    for (let tileSlotIndex = 0; tileSlotIndex < tileSlotCount; tileSlotIndex += 1) {
      assignments.push({
        tileIndex,
        tileSlotIndex,
        tileSlotCount,
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

function getSceneSlotPlacement(sceneIndex, slotIndex, slotCount = 3) {
  const normalizedSlotCount = clampPanelCount(slotCount);

  if (sceneIndex === 1) {
    return {
      2: [
        { x: 0.34, y: 0.6, rotation: -0.05, scale: 1 },
        { x: 0.66, y: 0.44, rotation: 0.05, scale: 1.02 },
      ],
      3: [
        { x: 0.28, y: 0.58, rotation: -0.05, scale: 0.98 },
        { x: 0.5, y: 0.42, rotation: 0.02, scale: 1.04 },
        { x: 0.72, y: 0.58, rotation: 0.05, scale: 0.98 },
      ],
      4: [
        { x: 0.26, y: 0.58, rotation: -0.07, scale: 0.96 },
        { x: 0.46, y: 0.38, rotation: -0.01, scale: 1.03 },
        { x: 0.62, y: 0.46, rotation: 0.03, scale: 1.01 },
        { x: 0.78, y: 0.64, rotation: 0.08, scale: 0.96 },
      ],
      5: [
        { x: 0.24, y: 0.6, rotation: -0.08, scale: 0.95 },
        { x: 0.42, y: 0.38, rotation: -0.03, scale: 1.01 },
        { x: 0.56, y: 0.46, rotation: 0.02, scale: 1.04 },
        { x: 0.7, y: 0.56, rotation: 0.05, scale: 1 },
        { x: 0.82, y: 0.7, rotation: 0.09, scale: 0.95 },
      ],
    }[normalizedSlotCount][slotIndex];
  }

  if (sceneIndex === 2) {
    return {
      2: [
        { x: 0.4, y: 0.38, rotation: -0.08, scale: 0.99 },
        { x: 0.6, y: 0.66, rotation: 0.08, scale: 0.99 },
      ],
      3: [
        { x: 0.34, y: 0.34, rotation: -0.09, scale: 0.98 },
        { x: 0.5, y: 0.52, rotation: 0.01, scale: 1.02 },
        { x: 0.66, y: 0.7, rotation: 0.09, scale: 0.98 },
      ],
      4: [
        { x: 0.3, y: 0.32, rotation: -0.1, scale: 0.97 },
        { x: 0.46, y: 0.46, rotation: -0.03, scale: 1.02 },
        { x: 0.58, y: 0.6, rotation: 0.03, scale: 1.02 },
        { x: 0.72, y: 0.74, rotation: 0.1, scale: 0.97 },
      ],
      5: [
        { x: 0.26, y: 0.3, rotation: -0.1, scale: 0.96 },
        { x: 0.38, y: 0.42, rotation: -0.05, scale: 1 },
        { x: 0.5, y: 0.54, rotation: 0.01, scale: 1.04 },
        { x: 0.62, y: 0.66, rotation: 0.05, scale: 1 },
        { x: 0.74, y: 0.78, rotation: 0.1, scale: 0.96 },
      ],
    }[normalizedSlotCount][slotIndex];
  }

  return {
    2: [
      { x: 0.36, y: 0.42, rotation: -0.07, scale: 1 },
      { x: 0.64, y: 0.62, rotation: 0.07, scale: 1 },
    ],
    3: [
      { x: 0.32, y: 0.34, rotation: -0.08, scale: 1 },
      { x: 0.68, y: 0.36, rotation: 0.07, scale: 0.99 },
      { x: 0.5, y: 0.7, rotation: 0.01, scale: 1.03 },
    ],
    4: [
      { x: 0.28, y: 0.34, rotation: -0.08, scale: 0.98 },
      { x: 0.7, y: 0.36, rotation: 0.08, scale: 0.98 },
      { x: 0.36, y: 0.7, rotation: -0.03, scale: 1.01 },
      { x: 0.64, y: 0.72, rotation: 0.03, scale: 1.01 },
    ],
    5: [
      { x: 0.26, y: 0.32, rotation: -0.09, scale: 0.97 },
      { x: 0.72, y: 0.34, rotation: 0.09, scale: 0.97 },
      { x: 0.34, y: 0.64, rotation: -0.04, scale: 1 },
      { x: 0.66, y: 0.66, rotation: 0.04, scale: 1 },
      { x: 0.5, y: 0.48, rotation: 0.01, scale: 1.04 },
    ],
  }[normalizedSlotCount][slotIndex];
}

export function getMinorityReportPanelPlacement(sceneIndex, panelAssignment, stageSize) {
  const tileIndex = panelAssignment?.tileIndex ?? 0;
  const slotIndex = panelAssignment?.tileSlotIndex ?? 0;
  const tileSlotCount = clampPanelCount(panelAssignment?.tileSlotCount ?? 3);
  const tileBounds = getMinorityReportTileBounds(stageSize, tileIndex);
  const slotPlacement = getSceneSlotPlacement(sceneIndex, slotIndex, tileSlotCount);
  return clampMinorityReportPanelPosition(
    {
      tileIndex,
      superSectorIndex: tileBounds.superSectorIndex,
      localTileIndex: tileBounds.localTileIndex,
      tileSlotIndex: slotIndex,
      tileSlotCount,
      x: tileBounds.left + tileBounds.width * slotPlacement.x,
      y: tileBounds.top + tileBounds.height * slotPlacement.y,
      rotation: slotPlacement.rotation,
      scale: slotPlacement.scale,
    },
    stageSize,
  );
}

export function clampMinorityReportPanelPosition(panel, stageSize) {
  const tileBounds = getMinorityReportTileBounds(stageSize, panel.tileIndex ?? 0);
  const halfWidth = MINORITY_REPORT_PANEL_WIDTH * 0.5;
  const halfHeight = MINORITY_REPORT_PANEL_HEIGHT * 0.5;
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
