import test from "node:test";
import assert from "node:assert/strict";

import {
  areSkyPatrolHudStatesEqual,
  createSkyPatrolCanvasRenderer,
  getSkyPatrolHudState,
} from "../src/skyPatrolCanvas.js";
import { createSkyPatrolGame, createSkyPatrolLayout } from "../src/skyPatrolGame.js";

function createMockContext() {
  return {
    drawImageCalls: [],
    beginPath() {},
    clearRect() {},
    closePath() {},
    fill() {},
    fillRect() {},
    lineTo() {},
    moveTo() {},
    restore() {},
    save() {},
    stroke() {},
    drawImage(image, x, y) {
      this.drawImageCalls.push({ image, x, y });
    },
  };
}

function createMockCanvas(context, ownerDocument) {
  return {
    width: 0,
    height: 0,
    ownerDocument,
    getContext(type) {
      assert.equal(type, "2d");
      return context;
    },
  };
}

function createMockRenderer() {
  const ownerDocument = {
    createElement(tagName) {
      assert.equal(tagName, "canvas");
      return createMockCanvas(createMockContext(), ownerDocument);
    },
  };
  const context = createMockContext();
  const canvas = createMockCanvas(context, ownerDocument);

  return {
    context,
    renderer: createSkyPatrolCanvasRenderer(canvas),
  };
}

function getRenderedTerrainRowY(renderer, context, layout, scrollOffset, worldRow) {
  context.drawImageCalls.length = 0;
  renderer.draw({
    layout,
    scrollOffset,
    ship: null,
    airEnemies: [],
    groundTargets: [],
    playerShots: [],
    enemyShots: [],
    explosions: [],
  });

  const terrainDraw = context.drawImageCalls[0];
  assert.ok(terrainDraw, "expected the terrain buffer to be drawn");
  const startWorldRow = Number(renderer.terrainCacheKey.split("|")[3]);
  assert.ok(Number.isFinite(startWorldRow), "expected a numeric terrain cache start row");

  return terrainDraw.y + (worldRow - startWorldRow) * layout.tileSize;
}

test("getSkyPatrolHudState summarizes the visible Sky Patrol HUD values", () => {
  const game = {
    ...createSkyPatrolGame(960, 720),
    score: 480,
    lives: 2,
    status: "gameover",
    message: "Squadron down. Pinch to relaunch.",
    airEnemies: [{ id: "fighter-1" }],
    groundTargets: [{ id: "turret-1" }, { id: "depot-1" }],
  };

  assert.deepEqual(getSkyPatrolHudState(game), {
    score: 480,
    lives: 2,
    activeTargetCount: 3,
    airTargetCount: 1,
    groundTargetCount: 2,
    fireReady: true,
    status: "gameover",
    message: "Squadron down. Pinch to relaunch.",
  });
});

test("areSkyPatrolHudStatesEqual only changes when the rendered HUD changes", () => {
  const hud = {
    score: 100,
    lives: 3,
    activeTargetCount: 4,
    status: "playing",
    message: "Pinch to fire twin cannons.",
  };

  assert.equal(areSkyPatrolHudStatesEqual(hud, { ...hud }), true);
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      activeTargetCount: 5,
    }),
    false,
  );
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      message: "Direct hit. Regroup and re-engage.",
    }),
    false,
  );
});

test("createSkyPatrolCanvasRenderer keeps terrain rows continuous when the cache wraps", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const { context, renderer } = createMockRenderer();
  const beforeWrapY = getRenderedTerrainRowY(
    renderer,
    context,
    layout,
    layout.tileSize * 0.99,
    0,
  );
  const afterWrapY = getRenderedTerrainRowY(
    renderer,
    context,
    layout,
    layout.tileSize * 1.01,
    0,
  );

  assert.ok(
    Math.abs(afterWrapY - beforeWrapY) < 2,
    `expected cached terrain to move continuously, saw ${beforeWrapY} -> ${afterWrapY}`,
  );
});
