import test from "node:test";
import assert from "node:assert/strict";
import {
  MINORITY_REPORT_MAX_PANELS_PER_TILE,
  MINORITY_REPORT_MIN_PANELS_PER_TILE,
  MINORITY_REPORT_SUPER_SECTOR_COUNT,
  MINORITY_REPORT_TILE_COUNT,
  clampMinorityReportPanelPosition,
  getMinorityReportPanelPlacement,
  getMinorityReportRandomPanelAssignments,
  getMinorityReportSuperSectorBoundsList,
  getMinorityReportTileIndexAtPoint,
  getMinorityReportTileBounds,
  getMinorityReportTileBoundsList,
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

test("getMinorityReportRandomPanelAssignments keeps every sector between 2 and 5 cards", () => {
  const randomValues = [0, 0.24, 0.5, 0.74, 0.999];
  let randomIndex = 0;
  const assignments = getMinorityReportRandomPanelAssignments(() => {
    const value = randomValues[randomIndex % randomValues.length];
    randomIndex += 1;
    return value;
  });
  const perTileCounts = new Map();
  for (const assignment of assignments) {
    perTileCounts.set(
      assignment.tileIndex,
      (perTileCounts.get(assignment.tileIndex) ?? 0) + 1,
    );
  }

  assert.equal(perTileCounts.size, MINORITY_REPORT_TILE_COUNT);
  for (const count of perTileCounts.values()) {
    assert.ok(count >= MINORITY_REPORT_MIN_PANELS_PER_TILE);
    assert.ok(count <= MINORITY_REPORT_MAX_PANELS_PER_TILE);
  }
});

test("getMinorityReportPanelPlacement respects the generated per-sector card counts", () => {
  const assignments = getMinorityReportRandomPanelAssignments(() => 0.5);
  const perTileCounts = new Map();
  for (const assignment of assignments) {
    const placement = getMinorityReportPanelPlacement(0, assignment, {
      width: 960,
      height: 640,
    });
    perTileCounts.set(
      placement.tileIndex,
      (perTileCounts.get(placement.tileIndex) ?? 0) + 1,
    );
  }

  assert.equal(perTileCounts.size, MINORITY_REPORT_TILE_COUNT);
  for (const count of perTileCounts.values()) {
    assert.equal(count, 4);
  }
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
