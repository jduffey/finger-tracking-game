export const MINORITY_REPORT_GRID_COLUMNS = 3;
export const MINORITY_REPORT_GRID_ROWS = 3;
export const MINORITY_REPORT_TILE_GAP = 18;
export const MINORITY_REPORT_PANELS_PER_TILE = 3;
export const MINORITY_REPORT_PANEL_WIDTH = 132;
export const MINORITY_REPORT_PANEL_HEIGHT = 84;
export const MINORITY_REPORT_TILE_COUNT =
  MINORITY_REPORT_GRID_COLUMNS * MINORITY_REPORT_GRID_ROWS;
export const MINORITY_REPORT_PANEL_COUNT =
  MINORITY_REPORT_TILE_COUNT * MINORITY_REPORT_PANELS_PER_TILE;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getMinorityReportTileBounds(stageSize, tileIndex) {
  const width = Math.max(1, stageSize?.width ?? 960);
  const height = Math.max(1, stageSize?.height ?? 640);
  const col = tileIndex % MINORITY_REPORT_GRID_COLUMNS;
  const row = Math.floor(tileIndex / MINORITY_REPORT_GRID_COLUMNS);
  const tileWidth =
    (width - MINORITY_REPORT_TILE_GAP * (MINORITY_REPORT_GRID_COLUMNS + 1)) /
    MINORITY_REPORT_GRID_COLUMNS;
  const tileHeight =
    (height - MINORITY_REPORT_TILE_GAP * (MINORITY_REPORT_GRID_ROWS + 1)) /
    MINORITY_REPORT_GRID_ROWS;
  const left = MINORITY_REPORT_TILE_GAP + col * (tileWidth + MINORITY_REPORT_TILE_GAP);
  const top = MINORITY_REPORT_TILE_GAP + row * (tileHeight + MINORITY_REPORT_TILE_GAP);
  return {
    index: tileIndex,
    col,
    row,
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

function getSceneSlotPlacement(sceneIndex, slotIndex) {
  if (sceneIndex === 1) {
    return [
      { x: 0.28, y: 0.58, rotation: -0.05, scale: 0.98 },
      { x: 0.5, y: 0.42, rotation: 0.02, scale: 1.04 },
      { x: 0.72, y: 0.58, rotation: 0.05, scale: 0.98 },
    ][slotIndex];
  }

  if (sceneIndex === 2) {
    return [
      { x: 0.34, y: 0.34, rotation: -0.09, scale: 0.98 },
      { x: 0.5, y: 0.52, rotation: 0.01, scale: 1.02 },
      { x: 0.66, y: 0.7, rotation: 0.09, scale: 0.98 },
    ][slotIndex];
  }

  return [
    { x: 0.32, y: 0.34, rotation: -0.08, scale: 1 },
    { x: 0.68, y: 0.36, rotation: 0.07, scale: 0.99 },
    { x: 0.5, y: 0.7, rotation: 0.01, scale: 1.03 },
  ][slotIndex];
}

export function getMinorityReportPanelPlacement(sceneIndex, panelIndex, stageSize) {
  const tileIndex = Math.floor(panelIndex / MINORITY_REPORT_PANELS_PER_TILE);
  const slotIndex = panelIndex % MINORITY_REPORT_PANELS_PER_TILE;
  const tileBounds = getMinorityReportTileBounds(stageSize, tileIndex);
  const slotPlacement = getSceneSlotPlacement(sceneIndex, slotIndex);
  return clampMinorityReportPanelPosition(
    {
      tileIndex,
      tileSlotIndex: slotIndex,
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
