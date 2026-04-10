import test from "node:test";
import assert from "node:assert/strict";
import {
  MINORITY_REPORT_PANEL_COUNT,
  MINORITY_REPORT_PANELS_PER_TILE,
  clampMinorityReportPanelPosition,
  getMinorityReportPanelPlacement,
  getMinorityReportTileIndexAtPoint,
  getMinorityReportTileBounds,
  getMinorityReportTileBoundsList,
} from "../src/minorityReportLabLayout.js";

test("getMinorityReportTileBoundsList returns a 3x3 grid with visible gaps", () => {
  const tiles = getMinorityReportTileBoundsList({ width: 960, height: 640 });
  assert.equal(tiles.length, 9);
  assert.ok(tiles[0].left + tiles[0].width < tiles[1].left);
  assert.ok(tiles[0].top + tiles[0].height < tiles[3].top);
});

test("getMinorityReportPanelPlacement distributes cards evenly across all nine sectors", () => {
  const perTileCounts = new Map();
  for (let panelIndex = 0; panelIndex < MINORITY_REPORT_PANEL_COUNT; panelIndex += 1) {
    const placement = getMinorityReportPanelPlacement(0, panelIndex, {
      width: 960,
      height: 640,
    });
    perTileCounts.set(
      placement.tileIndex,
      (perTileCounts.get(placement.tileIndex) ?? 0) + 1,
    );
  }

  assert.equal(perTileCounts.size, 9);
  for (const count of perTileCounts.values()) {
    assert.equal(count, MINORITY_REPORT_PANELS_PER_TILE);
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
      { x: tiles[4].centerX, y: tiles[4].centerY },
      { width: 960, height: 640 },
    ),
    4,
  );
  assert.equal(
    getMinorityReportTileIndexAtPoint(
      { x: tiles[0].left + tiles[0].width + 4, y: tiles[0].centerY },
      { width: 960, height: 640 },
    ),
    null,
  );
});
