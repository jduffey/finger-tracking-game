import test from "node:test";
import assert from "node:assert/strict";

import { FINGERPRINT_WORLD_ADJACENCY, FINGERPRINT_WORLD_TILES } from "../src/wfc/wfcTiles.js";
import {
  createWfcState,
  getWfcCellDomain,
  getWfcGrid,
  isWfcGridValid,
  runWfc,
  setWfcConstraint,
  stepWfc,
} from "../src/wfc/wfcSolver.js";

function constantRng(value) {
  return () => value;
}

test("createWfcState starts every cell with the full tile domain", () => {
  const state = createWfcState({ cols: 4, rows: 3 });

  assert.equal(state.status, "ready");
  assert.equal(state.cols, 4);
  assert.equal(state.rows, 3);
  assert.equal(state.domains.length, 12);
  assert.deepEqual(getWfcCellDomain(state, 0, 0), FINGERPRINT_WORLD_TILES.map((tile) => tile.id));
});

test("setWfcConstraint locks a cell and propagates allowed neighbors", () => {
  const state = setWfcConstraint(createWfcState({ cols: 3, rows: 3 }), 1, 1, "water");

  assert.equal(state.status, "ready");
  assert.deepEqual(getWfcCellDomain(state, 1, 1), ["water"]);
  assert.deepEqual(
    getWfcCellDomain(state, 2, 1).toSorted(),
    ["bridge", "sand", "water"],
  );
});

test("setWfcConstraint reports contradictions without throwing", () => {
  const water = setWfcConstraint(createWfcState({ cols: 2, rows: 1 }), 0, 0, "water");
  const impossible = setWfcConstraint(water, 1, 0, "castle");

  assert.equal(impossible.status, "contradiction");
  assert.deepEqual(impossible.contradictionCells, [{ col: 1, row: 0 }]);
});

test("stepWfc collapses the lowest-entropy unresolved cell", () => {
  const seeded = setWfcConstraint(createWfcState({ cols: 3, rows: 1 }), 0, 0, "water");
  const next = stepWfc(seeded, constantRng(0));

  assert.equal(next.status, "ready");
  assert.deepEqual(getWfcCellDomain(next, 1, 0), ["water"]);
  assert.deepEqual(getWfcCellDomain(next, 2, 0).toSorted(), ["bridge", "sand", "water"]);
});

test("runWfc completes a valid grid while preserving placed constraints", () => {
  const withCastle = setWfcConstraint(createWfcState({ cols: 6, rows: 5 }), 0, 0, "castle");
  const seeded = setWfcConstraint(withCastle, 5, 4, "mountain");
  const complete = runWfc(seeded, { maxSteps: 400, rng: constantRng(0.37) });
  const grid = getWfcGrid(complete);

  assert.equal(complete.status, "complete");
  assert.equal(grid[0][0], "castle");
  assert.equal(grid[4][5], "mountain");
  assert.equal(isWfcGridValid(grid, FINGERPRINT_WORLD_ADJACENCY), true);
});
