import test from "node:test";
import assert from "node:assert/strict";

import { createFullscreenExitControlLayout } from "../src/fullscreenExitControl.js";
import {
  clearWfcWorld,
  createWfcWorldGame,
  createWfcWorldStepInput,
  getWfcWorldCellCenter,
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
  return getWfcWorldCellCenter(game.layout, col, row);
}

test("createWfcWorldGame creates a 20 by 12 finger-controlled world layout", () => {
  const game = createWfcWorldGame(1280, 720);

  assert.equal(game.layout.cols, 20);
  assert.equal(game.layout.rows, 12);
  assert.equal(game.selectedTileId, "grass");
  assert.equal(game.phase, "seeding");
  assert.ok(game.layout.grid.cellSize > 0);
  assert.equal(game.layout.grid.cellShape, "hex");
  assert.ok(game.layout.grid.cellWidth < game.layout.grid.cellHeight);
  assert.equal(game.layout.palette.length, 8);
  assert.ok(game.layout.palette.every((tile) => tile.width === tile.height));
  assert.deepEqual(game.layout.controls.map((control) => control.id), ["generate", "reroll", "clear"]);
  assert.ok(game.layout.controls.every((control) => control.height >= 88));
  assert.ok(game.layout.controls.every((control) => control.top + control.height <= game.layout.height));
});

test("createWfcWorldGame lets terrain cells render underneath the exit box", () => {
  const game = createWfcWorldGame(1280, 720);
  const exitLayout = createFullscreenExitControlLayout(1280, 720);

  assert.ok(game.layout.grid.left < exitLayout.left);
  assert.ok(game.layout.grid.left + game.layout.grid.width > exitLayout.left + exitLayout.boxWidth * 0.5);
});

test("mapPointerToWfcCell maps index fingertip coordinates into grid cells", () => {
  const game = createWfcWorldGame(1280, 720);
  const center = cellCenter(game, 3, 4);
  const oddRowCenter = cellCenter(game, 3, 5);
  const firstCell = cellCenter(game, 0, 0);

  assert.deepEqual(mapPointerToWfcCell(game.layout, center.x, center.y), { col: 3, row: 4 });
  assert.deepEqual(mapPointerToWfcCell(game.layout, oddRowCenter.x, oddRowCenter.y), { col: 3, row: 5 });
  assert.ok(oddRowCenter.x > center.x);
  assert.equal(mapPointerToWfcCell(game.layout, game.layout.grid.left - 4, center.y), null);
  assert.equal(
    mapPointerToWfcCell(
      game.layout,
      firstCell.x - game.layout.grid.cellWidth / 2 + 1,
      firstCell.y - game.layout.grid.cellHeight / 2 + 1,
    ),
    null,
  );
});

test("createWfcWorldStepInput maps active mouse input to pinch-style actions without hover", () => {
  const viewport = { left: 40, top: 60, width: 1280, height: 720 };

  assert.deepEqual(
    createWfcWorldStepInput({
      viewport,
      handDetected: false,
      cursor: null,
      pinchActive: false,
      mouseInput: { pointerActive: true, pointerX: 120, pointerY: 140, pinchActive: true, pinchStarted: true },
    }),
    { pointerActive: true, pointerX: 120, pointerY: 140, pinchActive: true, pinchStarted: true },
  );
  assert.deepEqual(
    createWfcWorldStepInput({
      viewport,
      handDetected: true,
      cursor: { x: 400, y: 300 },
      pinchActive: true,
      mouseInput: { pointerActive: true, pointerX: 120, pointerY: 140, pinchActive: false, pinchStarted: false },
    }),
    { pointerActive: true, pointerX: 360, pointerY: 240, pinchActive: true },
  );
  assert.deepEqual(
    createWfcWorldStepInput({
      viewport,
      handDetected: false,
      cursor: null,
      pinchActive: false,
      mouseInput: { pointerActive: true, pointerX: 120, pointerY: 140, pinchActive: false, pinchStarted: false },
    }),
    { pointerActive: false, pointerX: 0, pointerY: 0, pinchActive: false },
  );
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

test("stepWfcWorldGame drag paints newly hovered cells while pinch is held", () => {
  const game = createWfcWorldGame(1280, 720);
  const firstCell = cellCenter(game, 2, 5);
  const secondCell = cellCenter(game, 3, 5);
  const thirdCell = cellCenter(game, 4, 5);

  const firstPainted = stepWfcWorldGame(
    game,
    1 / 60,
    { pointerActive: true, pointerX: firstCell.x, pointerY: firstCell.y, pinchActive: true },
    constantRng(0.5),
  );
  const secondPainted = stepWfcWorldGame(
    firstPainted,
    1 / 60,
    { pointerActive: true, pointerX: secondCell.x, pointerY: secondCell.y, pinchActive: true },
    constantRng(0.5),
  );
  const heldOverSecond = stepWfcWorldGame(
    secondPainted,
    1 / 60,
    { pointerActive: true, pointerX: secondCell.x, pointerY: secondCell.y, pinchActive: true },
    constantRng(0.5),
  );
  const thirdPainted = stepWfcWorldGame(
    heldOverSecond,
    1 / 60,
    { pointerActive: true, pointerX: thirdCell.x, pointerY: thirdCell.y, pinchActive: true },
    constantRng(0.5),
  );

  assert.deepEqual(thirdPainted.constraints, [
    { col: 2, row: 5, tileId: "grass" },
    { col: 3, row: 5, tileId: "grass" },
    { col: 4, row: 5, tileId: "grass" },
  ]);
  assert.deepEqual(heldOverSecond.constraints, secondPainted.constraints);
});

test("stepWfcWorldGame does not start grid painting from a held palette pinch", () => {
  const game = createWfcWorldGame(1280, 720);
  const waterTile = game.layout.palette.find((tile) => tile.id === "water");
  const center = cellCenter(game, 2, 5);

  const selected = stepWfcWorldGame(
    game,
    1 / 60,
    { pointerActive: true, pointerX: waterTile.left + 4, pointerY: waterTile.top + 4, pinchActive: true },
    constantRng(0.5),
  );
  const movedToGridStillPinching = stepWfcWorldGame(
    selected,
    1 / 60,
    { pointerActive: true, pointerX: center.x, pointerY: center.y, pinchActive: true },
    constantRng(0.5),
  );

  assert.equal(selected.selectedTileId, "water");
  assert.deepEqual(movedToGridStillPinching.constraints, []);
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
