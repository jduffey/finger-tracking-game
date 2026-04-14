import test from "node:test";
import assert from "node:assert/strict";
import {
  MINORITY_REPORT_SUPER_SECTOR_COUNT,
  MINORITY_REPORT_TILE_GRID_COLUMNS,
  MINORITY_REPORT_TILE_GRID_ROWS,
  MINORITY_REPORT_TILE_COUNT,
  clampMinorityReportPanelPosition,
  getMinorityReportGridSlotAtPoint,
  getMinorityReportNearestOpenGridSlot,
  getMinorityReportPanelPlacement,
  getMinorityReportRandomPanelAssignments,
  getMinorityReportSuperSectorBoundsList,
  getMinorityReportTileIndexAtPoint,
  getMinorityReportTileBounds,
  getMinorityReportTileGridMetrics,
  getMinorityReportTileBoundsList,
  resolveMinorityReportPanelGridOccupancy,
  snapMinorityReportPanelToGrid,
} from "../src/minorityReportLabLayout.js";

test("getMinorityReportTileBoundsList returns a 2x2 super grid of 3x2 subsets", () => {
  const tiles = getMinorityReportTileBoundsList({ width: 960, height: 640 });
  assert.equal(tiles.length, MINORITY_REPORT_TILE_COUNT);
  assert.equal(getMinorityReportSuperSectorBoundsList({ width: 960, height: 640 }).length, MINORITY_REPORT_SUPER_SECTOR_COUNT);
  assert.ok(tiles[0].left + tiles[0].width < tiles[1].left);
  assert.ok(tiles[0].top + tiles[0].height < tiles[3].top);
  const intraSectorGap = tiles[1].left - (tiles[0].left + tiles[0].width);
  const interSectorGap = tiles[6].left - (tiles[2].left + tiles[2].width);
  assert.ok(interSectorGap > intraSectorGap);
});

test("getMinorityReportRandomPanelAssignments creates two top-row cards per sector", () => {
  const assignments = getMinorityReportRandomPanelAssignments(() => 0.5);
  const perTileAssignments = new Map();

  assert.equal(assignments.length, MINORITY_REPORT_TILE_COUNT * 2);

  for (const assignment of assignments) {
    const tileAssignments = perTileAssignments.get(assignment.tileIndex) ?? [];
    tileAssignments.push(assignment);
    perTileAssignments.set(assignment.tileIndex, tileAssignments);
    assert.equal(assignment.tileSlotCount, 2);
    assert.equal(assignment.tileColumnCount, 2);
    assert.equal(assignment.columnCardIndex, 0);
    assert.equal(assignment.columnCardCount, 1);
    assert.equal(assignment.tileMaxColumnCardCount, 1);
    assert.equal(assignment.gridRowIndex, 0);
  }

  assert.equal(perTileAssignments.size, MINORITY_REPORT_TILE_COUNT);
  for (const tileAssignments of perTileAssignments.values()) {
    assert.equal(tileAssignments.length, 2);
    const sortedAssignments = [...tileAssignments].sort(
      (first, second) => first.tileSlotIndex - second.tileSlotIndex,
    );
    assert.deepEqual(
      sortedAssignments.map((assignment) => assignment.tileSlotIndex),
      [0, 1],
    );
    assert.deepEqual(
      sortedAssignments.map((assignment) => assignment.tileColumnIndex),
      [0, 1],
    );
    assert.deepEqual(
      sortedAssignments.map((assignment) => assignment.gridColumnIndex),
      [0, 1],
    );
  }
});

test("getMinorityReportTileGridMetrics exposes an 8 by 6 snap grid for each sector", () => {
  const metrics = getMinorityReportTileGridMetrics({ width: 960, height: 640 }, 0);
  assert.ok(metrics.width > 0);
  assert.ok(metrics.height > 0);
  assert.equal(
    Math.round(metrics.width / metrics.columnWidth),
    MINORITY_REPORT_TILE_GRID_COLUMNS,
  );
  assert.equal(
    Math.round(metrics.height / metrics.rowHeight),
    MINORITY_REPORT_TILE_GRID_ROWS,
  );
  assert.ok(metrics.panelScale > 0);
  assert.equal(metrics.panelWidth, metrics.panelHeight);
  assert.ok(metrics.panelWidth < metrics.columnWidth);
  assert.ok(metrics.panelHeight < metrics.rowHeight);
});

test("getMinorityReportRandomPanelAssignments places each sector card in neighboring top-row slots", () => {
  const assignments = getMinorityReportRandomPanelAssignments(() => 0.5);
  const stageSize = { width: 960, height: 640 };
  const perTilePlacements = new Map();

  for (const assignment of assignments) {
    const metrics = getMinorityReportTileGridMetrics(stageSize, assignment.tileIndex);
    const placement = getMinorityReportPanelPlacement(0, assignment, stageSize);
    const tilePlacements = perTilePlacements.get(assignment.tileIndex) ?? [];
    tilePlacements.push(placement);
    perTilePlacements.set(assignment.tileIndex, tilePlacements);
    assert.equal(placement.gridRowIndex, 0);
    assert.equal(
      placement.x,
      metrics.left + ((assignment.gridColumnIndex + 0.5) * metrics.columnWidth),
    );
    assert.equal(placement.y, metrics.top + (0.5 * metrics.rowHeight));
  }

  for (const tilePlacements of perTilePlacements.values()) {
    const slotKeys = new Set(
      tilePlacements.map((placement) => `${placement.gridColumnIndex}:${placement.gridRowIndex}`),
    );
    assert.equal(slotKeys.size, 2);
    assert.equal(slotKeys.has("0:0"), true);
    assert.equal(slotKeys.has("1:0"), true);
  }
});

test("resolveMinorityReportPanelGridOccupancy eliminates duplicate load-time grid cells", () => {
  const stageSize = { width: 960, height: 640 };
  const duplicatePanels = [
    {
      id: "panel-a",
      ...getMinorityReportPanelPlacement(
        0,
        {
          tileIndex: 0,
          tileSlotIndex: 0,
          tileSlotCount: 2,
          tileColumnIndex: 0,
          tileColumnCount: 2,
          columnCardIndex: 0,
          columnCardCount: 1,
          tileMaxColumnCardCount: 1,
          gridColumnIndex: 0,
          gridRowIndex: 0,
        },
        stageSize,
      ),
    },
    {
      id: "panel-b",
      ...getMinorityReportPanelPlacement(
        0,
        {
          tileIndex: 0,
          tileSlotIndex: 1,
          tileSlotCount: 2,
          tileColumnIndex: 1,
          tileColumnCount: 2,
          columnCardIndex: 0,
          columnCardCount: 1,
          tileMaxColumnCardCount: 1,
          gridColumnIndex: 0,
          gridRowIndex: 0,
        },
        stageSize,
      ),
    },
  ];

  const resolvedPanels = resolveMinorityReportPanelGridOccupancy(
    duplicatePanels,
    stageSize,
    (panel) => ({ x: panel.x, y: panel.y }),
  );

  assert.equal(resolvedPanels.length, 2);
  assert.notEqual(
    `${resolvedPanels[0].gridColumnIndex}:${resolvedPanels[0].gridRowIndex}`,
    `${resolvedPanels[1].gridColumnIndex}:${resolvedPanels[1].gridRowIndex}`,
  );
  assert.equal(resolvedPanels[0].gridColumnIndex, 0);
  assert.equal(resolvedPanels[0].gridRowIndex, 0);
});

test("getMinorityReportPanelPlacement centers cards on their assigned grid cells", () => {
  const stageSize = { width: 960, height: 640 };
  const metrics = getMinorityReportTileGridMetrics(stageSize, 0);
  const placement = getMinorityReportPanelPlacement(
    0,
    {
      tileIndex: 0,
      tileSlotIndex: 2,
      tileSlotCount: 7,
      tileColumnIndex: 1,
      tileColumnCount: 3,
      columnCardIndex: 2,
      columnCardCount: 4,
      tileMaxColumnCardCount: 4,
      gridColumnIndex: 5,
      gridRowIndex: 3,
    },
    stageSize,
  );

  assert.equal(placement.gridColumnIndex, 5);
  assert.equal(placement.gridRowIndex, 3);
  assert.equal(placement.rotation, 0);
  assert.equal(placement.x, metrics.left + (5.5 * metrics.columnWidth));
  assert.equal(placement.y, metrics.top + (3.5 * metrics.rowHeight));
});

test("snapMinorityReportPanelToGrid picks a different open slot when the nearest one is occupied", () => {
  const stageSize = { width: 960, height: 640 };
  const occupiedPanel = getMinorityReportPanelPlacement(
    0,
    {
      id: "panel-occupied",
      tileIndex: 0,
      tileSlotIndex: 0,
      tileSlotCount: 2,
      tileColumnIndex: 0,
      tileColumnCount: 3,
      columnCardIndex: 0,
      columnCardCount: 2,
      tileMaxColumnCardCount: 2,
      gridColumnIndex: 3,
      gridRowIndex: 2,
    },
    stageSize,
  );
  const incomingPanel = getMinorityReportPanelPlacement(
    0,
    {
      id: "panel-incoming",
      tileIndex: 0,
      tileSlotIndex: 1,
      tileSlotCount: 2,
      tileColumnIndex: 1,
      tileColumnCount: 3,
      columnCardIndex: 0,
      columnCardCount: 2,
      tileMaxColumnCardCount: 2,
      gridColumnIndex: 4,
      gridRowIndex: 2,
    },
    stageSize,
  );
  const preferredPoint = {
    x: occupiedPanel.x,
    y: occupiedPanel.y,
  };

  const snapped = snapMinorityReportPanelToGrid(
    {
      ...incomingPanel,
      id: "panel-incoming",
    },
    stageSize,
    [
      { ...occupiedPanel, id: "panel-occupied" },
      { ...incomingPanel, id: "panel-incoming" },
    ],
    preferredPoint,
  );

  assert.notEqual(snapped.gridColumnIndex, occupiedPanel.gridColumnIndex);
  assert.notEqual(
    `${snapped.gridColumnIndex}:${snapped.gridRowIndex}`,
    `${occupiedPanel.gridColumnIndex}:${occupiedPanel.gridRowIndex}`,
  );
  assert.deepEqual(
    getMinorityReportGridSlotAtPoint(
      { x: snapped.x, y: snapped.y },
      stageSize,
      snapped.tileIndex,
    ),
    {
      gridColumnIndex: snapped.gridColumnIndex,
      gridRowIndex: snapped.gridRowIndex,
    },
  );
});

test("getMinorityReportNearestOpenGridSlot resolves an open cell inside the 8 by 6 grid", () => {
  const slot = getMinorityReportNearestOpenGridSlot({
    point: { x: 0, y: 0 },
    stageSize: { width: 960, height: 640 },
    tileIndex: 0,
    occupiedSlotKeys: new Set(["0:0:0"]),
  });

  assert.ok(slot.gridColumnIndex >= 0 && slot.gridColumnIndex < MINORITY_REPORT_TILE_GRID_COLUMNS);
  assert.ok(slot.gridRowIndex >= 0 && slot.gridRowIndex < MINORITY_REPORT_TILE_GRID_ROWS);
  assert.notDeepEqual(slot, { gridColumnIndex: 0, gridRowIndex: 0 });
});

test("clampMinorityReportPanelPosition keeps a card inside its assigned sector", () => {
  const tile = getMinorityReportTileBounds({ width: 960, height: 640 }, 4);
  const clamped = clampMinorityReportPanelPosition(
    {
      tileIndex: 4,
      x: tile.left - 100,
      y: tile.top + tile.height + 100,
    },
    { width: 960, height: 640 },
  );

  assert.ok(clamped.x >= tile.left);
  assert.ok(clamped.x <= tile.left + tile.width);
  assert.ok(clamped.y >= tile.top);
  assert.ok(clamped.y <= tile.top + tile.height);
});

test("getMinorityReportTileIndexAtPoint resolves sectors and ignores the gaps", () => {
  const tiles = getMinorityReportTileBoundsList({ width: 960, height: 640 });
  assert.equal(
    getMinorityReportTileIndexAtPoint(
      { x: tiles[12].centerX, y: tiles[12].centerY },
      { width: 960, height: 640 },
    ),
    12,
  );
  assert.equal(
    getMinorityReportTileIndexAtPoint(
      { x: tiles[0].left + tiles[0].width + 4, y: tiles[0].centerY },
      { width: 960, height: 640 },
    ),
    null,
  );
});
