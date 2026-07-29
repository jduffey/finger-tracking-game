import test from "node:test";
import assert from "node:assert/strict";
import {
  areWfcWorldCellVisualStatesEqual,
  getWfcWorldCellClassName,
  getWfcWorldCellIndex,
  getWfcWorldCellVisualState,
} from "../src/wfc/wfcWorldRenderModel.js";

const layout = Object.freeze({ cols: 39, rows: 24 });

test("World Painter maps visible cells to stable row-major indexes", () => {
  assert.equal(getWfcWorldCellIndex(layout, { col: 0, row: 0 }), 0);
  assert.equal(getWfcWorldCellIndex(layout, { col: 38, row: 23 }), 935);
  assert.equal(getWfcWorldCellIndex(layout, { col: 4, row: 3 }), 121);
  assert.equal(getWfcWorldCellIndex(layout, { col: 39, row: 0 }), -1);
  assert.equal(getWfcWorldCellIndex(layout, { col: 0, row: 24 }), -1);
  assert.equal(getWfcWorldCellIndex(layout, null), -1);
});

test("World Painter cell equality follows visible state instead of domain identity", () => {
  const previous = getWfcWorldCellVisualState(["grass", "water"], {
    changed: false,
  });
  const cloned = getWfcWorldCellVisualState(["grass", "water"], {
    changed: false,
  });
  const sameCountDifferentOptions = getWfcWorldCellVisualState(["forest", "mountain"], {
    changed: false,
  });

  assert.equal(areWfcWorldCellVisualStatesEqual(previous, cloned), true);
  assert.equal(areWfcWorldCellVisualStatesEqual(previous, sameCountDifferentOptions), true);
  assert.equal(
    areWfcWorldCellVisualStatesEqual(
      previous,
      getWfcWorldCellVisualState(["grass"], { changed: false }),
    ),
    false,
  );
  assert.equal(
    areWfcWorldCellVisualStatesEqual(
      previous,
      getWfcWorldCellVisualState(["grass", "water"], { changed: true }),
    ),
    false,
  );
});

test("World Painter preserves collapsed, conflict, and constraint styling", () => {
  const state = getWfcWorldCellVisualState(["castle"], {
    changed: true,
    conflict: true,
    constrained: true,
  });

  assert.deepEqual(state, {
    tileId: "castle",
    domainSize: 1,
    changed: true,
    conflict: true,
    constrained: true,
  });
  assert.equal(
    getWfcWorldCellClassName(state),
    "fullscreen-camera-wfc-cell collapsed changed conflict constrained tile-castle",
  );
  assert.equal(
    getWfcWorldCellClassName(getWfcWorldCellVisualState(["grass", "water"])),
    "fullscreen-camera-wfc-cell unresolved",
  );
});
