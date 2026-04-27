import test from "node:test";
import assert from "node:assert/strict";

import {
  clearWfcWorld,
  createWfcWorldGame,
  getWfcWorldControlAtPoint,
  mapPointerToWfcCell,
  selectWfcWorldTile,
  startWfcWorldCollapse,
  stepWfcWorldGame,
} from "../src/wfc/wfcWorldGame.js";
import { getWfcGrid, isWfcGridValid } from "../src/wfc/wfcSolver.js";
import { FINGERPRINT_WORLD_ADJACENCY } from "../src/wfc/wfcTiles.js";

function constantRng(value) {
  return () => value;
}

function cellCenter(game, col, row) {
  const { grid } = game.layout;
  return {
    x: grid.left + grid.cellSize * (col + 0.5),
    y: grid.top + grid.cellSize * (row + 0.5),
  };
}

test("createWfcWorldGame creates a 16 by 12 finger-controlled world layout", () => {
  const game = createWfcWorldGame(1280, 720);

  assert.equal(game.layout.cols, 16);
  assert.equal(game.layout.rows, 12);
  assert.equal(game.selectedTileId, "grass");
  assert.equal(game.phase, "seeding");
  assert.ok(game.layout.grid.cellSize > 0);
  assert.equal(game.layout.palette.length, 8);
  assert.deepEqual(game.layout.controls.map((control) => control.id), ["generate", "reroll", "clear"]);
});

test("createWfcWorldGame keeps palette and controls inside short fullscreen viewports", () => {
  for (const [width, height] of [
    [640, 360],
    [568, 320],
  ]) {
    const game = createWfcWorldGame(width, height);
    const interactiveRects = [...game.layout.palette, ...game.layout.controls];

    for (const rect of interactiveRects) {
      assert.ok(rect.left >= 0, `${rect.id} should not overflow left at ${width}x${height}`);
      assert.ok(rect.top >= 0, `${rect.id} should not overflow top at ${width}x${height}`);
      assert.ok(rect.left + rect.width <= game.layout.width, `${rect.id} should not overflow right at ${width}x${height}`);
      assert.ok(rect.top + rect.height <= game.layout.height, `${rect.id} should not overflow bottom at ${width}x${height}`);
    }
  }
});

test("mapPointerToWfcCell maps index fingertip coordinates into grid cells", () => {
  const game = createWfcWorldGame(1280, 720);
  const center = cellCenter(game, 3, 4);

  assert.deepEqual(mapPointerToWfcCell(game.layout, center.x, center.y), { col: 3, row: 4 });
  assert.equal(mapPointerToWfcCell(game.layout, game.layout.grid.left - 4, center.y), null);
});

test("stepWfcWorldGame pinches once to place a tile constraint", () => {
  const game = createWfcWorldGame(1280, 720);
  const center = cellCenter(game, 2, 5);
  const placed = stepWfcWorldGame(
    game,
    1 / 60,
    { pointerActive: true, pointerX: center.x, pointerY: center.y, pinchActive: true },
    constantRng(0.5),
  );
  const held = stepWfcWorldGame(
    placed,
    1 / 60,
    { pointerActive: true, pointerX: center.x, pointerY: center.y, pinchActive: true },
    constantRng(0.5),
  );

  assert.deepEqual(placed.hoverCell, { col: 2, row: 5 });
  assert.deepEqual(placed.constraints, [{ col: 2, row: 5, tileId: "grass" }]);
  assert.deepEqual(held.constraints, placed.constraints);
});

test("stepWfcWorldGame can select palette tiles and reject conflicting rules kindly", () => {
  const game = createWfcWorldGame(1280, 720);
  const waterTile = game.layout.palette.find((tile) => tile.id === "water");
  const castleTile = game.layout.palette.find((tile) => tile.id === "castle");
  const firstCell = cellCenter(game, 0, 0);
  const secondCell = cellCenter(game, 1, 0);

  const waterSelected = stepWfcWorldGame(
    game,
    1 / 60,
    { pointerActive: true, pointerX: waterTile.left + 4, pointerY: waterTile.top + 4, pinchActive: true },
    constantRng(0.5),
  );
  const waterPlaced = stepWfcWorldGame(
    waterSelected,
    1 / 60,
    { pointerActive: true, pointerX: firstCell.x, pointerY: firstCell.y, pinchActive: false },
    constantRng(0.5),
  );
  const waterPinched = stepWfcWorldGame(
    waterPlaced,
    1 / 60,
    { pointerActive: true, pointerX: firstCell.x, pointerY: firstCell.y, pinchActive: true },
    constantRng(0.5),
  );
  const castleSelected = stepWfcWorldGame(
    waterPinched,
    1 / 60,
    { pointerActive: true, pointerX: castleTile.left + 4, pointerY: castleTile.top + 4, pinchActive: false },
    constantRng(0.5),
  );
  const castlePinched = stepWfcWorldGame(
    castleSelected,
    1 / 60,
    { pointerActive: true, pointerX: castleTile.left + 4, pointerY: castleTile.top + 4, pinchActive: true },
    constantRng(0.5),
  );
  const conflicting = stepWfcWorldGame(
    castlePinched,
    1 / 60,
    { pointerActive: true, pointerX: secondCell.x, pointerY: secondCell.y, pinchActive: false },
    constantRng(0.5),
  );
  const rejected = stepWfcWorldGame(
    conflicting,
    1 / 60,
    { pointerActive: true, pointerX: secondCell.x, pointerY: secondCell.y, pinchActive: true },
    constantRng(0.5),
  );

  assert.equal(castlePinched.selectedTileId, "castle");
  assert.equal(rejected.phase, "conflict");
  assert.match(rejected.message, /conflict/i);
  assert.deepEqual(rejected.constraints, [{ col: 0, row: 0, tileId: "water" }]);
});

test("stepWfcWorldGame animates collapse into a valid complete world", () => {
  const game = createWfcWorldGame(1280, 720);
  const seeded = selectWfcWorldTile(game, "castle");
  const withCastle = stepWfcWorldGame(
    seeded,
    1 / 60,
    { pointerActive: true, ...cellCenter(seeded, 2, 2), pinchActive: true },
    constantRng(0.5),
  );
  const collapsing = startWfcWorldCollapse(withCastle);
  const complete = stepWfcWorldGame(collapsing, 5, {}, constantRng(0.37));
  const grid = getWfcGrid(complete.wfc);

  assert.equal(complete.phase, "complete");
  assert.equal(grid[2][2], "castle");
  assert.equal(isWfcGridValid(grid, FINGERPRINT_WORLD_ADJACENCY), true);
});

test("clear and control hit testing support booth-friendly fallback buttons", () => {
  const game = createWfcWorldGame(1280, 720);
  const generate = game.layout.controls.find((control) => control.id === "generate");
  const selectedControl = getWfcWorldControlAtPoint(game.layout, generate.left + 2, generate.top + 2);
  const cleared = clearWfcWorld(startWfcWorldCollapse(selectWfcWorldTile(game, "road")));

  assert.equal(selectedControl.id, "generate");
  assert.equal(cleared.phase, "seeding");
  assert.equal(cleared.selectedTileId, "road");
  assert.deepEqual(cleared.constraints, []);
});
