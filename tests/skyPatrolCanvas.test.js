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
    translate() {},
    rotate() {},
    drawImage(...args) {
      this.drawImageCalls.push({ args, image: args[0], x: args[1], y: args[2] });
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
    targetsDestroyed: 0,
    lives: 2,
    status: "gameover",
    message: "Squadron down. Pinch to relaunch.",
    airEnemies: [{ id: "fighter-1", x: 240, y: 144 }],
    groundTargets: [
      { id: "turret-1", x: 720, y: 360 },
      { id: "depot-1", x: 480, y: 216 },
    ],
  };

  assert.deepEqual(getSkyPatrolHudState(game), {
    score: 480,
    targetsDestroyed: 0,
    lives: 2,
    activeTargetCount: 3,
    airTargetCount: 1,
    groundTargetCount: 2,
    fireCooldownMs: 0,
    fireReady: true,
    gunCharge: 1,
    gunCooldownMs: 0,
    gunStatus: "ready",
    incomingIndicators: [],
    legendFaded: false,
    radarBlips: [
      { id: "ship", role: "player", xPct: 50, yPct: 78 },
      { id: "fighter-1", role: "air", xPct: 25, yPct: 20 },
      { id: "turret-1", role: "ground", xPct: 75, yPct: 50 },
      { id: "depot-1", role: "ground", xPct: 50, yPct: 30 },
    ],
    startPromptVisible: false,
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
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      legendFaded: true,
    }),
    false,
  );
  assert.equal(
    areSkyPatrolHudStatesEqual(
      { ...hud, radarBlips: [{ id: "ship", xPct: 50, yPct: 78 }] },
      { ...hud, radarBlips: [{ id: "ship", xPct: 51, yPct: 78 }] },
    ),
    false,
  );
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      startPromptVisible: true,
    }),
    false,
  );
  assert.equal(
    areSkyPatrolHudStatesEqual(hud, {
      ...hud,
      gunCharge: 0.5,
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

test("createSkyPatrolCanvasRenderer can draw extracted sprite atlas assets", () => {
  const layout = createSkyPatrolLayout(960, 720);
  const { context, renderer } = createMockRenderer();
  const spriteImage = { complete: true, naturalWidth: 1024 };

  renderer.setSpriteImage(spriteImage);
  renderer.draw({
    layout,
    scrollOffset: 0,
    ship: {
      x: layout.width / 2,
      y: layout.height * 0.78,
      width: layout.playerWidth,
      height: layout.playerHeight,
      bank: 0,
    },
    airEnemies: [],
    groundTargets: [],
    playerShots: [],
    enemyShots: [],
    explosions: [],
  });

  assert.ok(
    context.drawImageCalls.some((call) => call.image === spriteImage && call.args.length === 9),
    "expected the sprite atlas to be drawn with a source rectangle",
  );
});
