import test from "node:test";
import assert from "node:assert/strict";

import {
  FINGERPRINT_WORLD_ADJACENCY,
  FINGERPRINT_WORLD_TILES,
  WFC_DIRECTIONS,
  getOppositeWfcDirection,
} from "../src/wfc/wfcTiles.js";

test("Fingerprint Worlds tiles expose a compact fantasy map palette", () => {
  assert.deepEqual(
    FINGERPRINT_WORLD_TILES.map((tile) => tile.id),
    ["grass", "water", "sand", "forest", "mountain", "road", "castle", "bridge"],
  );
  for (const tile of FINGERPRINT_WORLD_TILES) {
    assert.equal(typeof tile.label, "string");
    assert.equal(typeof tile.color, "string");
    assert.ok(tile.weight > 0);
  }
});

test("Fingerprint Worlds adjacency rules are reciprocal in every direction", () => {
  const tileIds = FINGERPRINT_WORLD_TILES.map((tile) => tile.id);

  for (const tileId of tileIds) {
    for (const direction of WFC_DIRECTIONS) {
      const neighbors = FINGERPRINT_WORLD_ADJACENCY[tileId]?.[direction] ?? [];
      assert.ok(neighbors.length > 0, `${tileId}.${direction} should allow at least one neighbor`);

      for (const neighborId of neighbors) {
        const opposite = getOppositeWfcDirection(direction);
        assert.ok(
          FINGERPRINT_WORLD_ADJACENCY[neighborId]?.[opposite]?.includes(tileId),
          `${tileId}.${direction} allows ${neighborId}, but ${neighborId}.${opposite} does not allow ${tileId}`,
        );
      }
    }
  }
});
