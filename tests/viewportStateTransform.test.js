import test from "node:test";
import assert from "node:assert/strict";

import { MODE_REGISTRY } from "../src/modeRegistry.js";
import {
  FULLSCREEN_GAME_RESIZE_MODE_IDS,
  GEOMETRY_AXES,
  GEOMETRY_OPERATIONS,
  VIEWPORT_FIT_MODES,
  createLogicalPlayfieldTransform,
  createViewportTransform,
  remapArray,
  remapPositionalState,
  resizeFullscreenGameState,
  resizePositionalState,
} from "../src/viewportStateTransform.js";

test("stretch transforms points, velocities, rectangles, and scalar dimensions", () => {
  const transform = createViewportTransform(
    { x: 10, y: 20, width: 100, height: 200 },
    { width: 200, height: 100 },
  );

  assert.equal(transform.scaleX, 2);
  assert.equal(transform.scaleY, 0.5);
  assert.equal(transform.uniformScale, 0.5);
  assert.deepEqual(transform.mapPoint({ x: 60, y: 120, id: "point" }), {
    x: 100,
    y: 50,
    id: "point",
  });
  assert.deepEqual(transform.mapVelocity({ vx: 8, vy: -12, spin: 2 }), {
    vx: 16,
    vy: -6,
    spin: 2,
  });
  assert.deepEqual(
    transform.mapRectangle({
      x: 20,
      y: 40,
      width: 10,
      height: 20,
      id: "rect",
    }),
    {
      x: 20,
      y: 10,
      width: 20,
      height: 10,
      id: "rect",
    },
  );
  assert.equal(transform.mapScalar(6, GEOMETRY_AXES.X), 12);
  assert.equal(transform.mapScalar(6, GEOMETRY_AXES.Y), 3);
  assert.equal(transform.mapScalar(6, GEOMETRY_AXES.UNIFORM), 3);

  const point = { x: 34, y: 78 };
  const velocity = { vx: 13, vy: -27 };
  const rectangle = { left: 23, top: 41, width: 18, height: 32 };
  assert.deepEqual(transform.unmapPoint(transform.mapPoint(point)), point);
  assert.deepEqual(transform.unmapVelocity(transform.mapVelocity(velocity)), velocity);
  assert.deepEqual(
    transform.unmapRectangle(transform.mapRectangle(rectangle)),
    rectangle,
  );
});

test("contain and cover transforms center their affine playfield predictably", () => {
  const contain = createViewportTransform(
    { width: 100, height: 100 },
    { width: 300, height: 100 },
    { fit: VIEWPORT_FIT_MODES.CONTAIN },
  );
  assert.equal(contain.scaleX, 1);
  assert.equal(contain.scaleY, 1);
  assert.equal(contain.offsetX, 100);
  assert.deepEqual(contain.mapPoint({ x: 0, y: 0 }), { x: 100, y: 0 });
  assert.deepEqual(contain.mapPoint({ x: 100, y: 100 }), { x: 200, y: 100 });

  const cover = createViewportTransform(
    { width: 100, height: 100 },
    { width: 300, height: 100 },
    { fit: VIEWPORT_FIT_MODES.COVER },
  );
  assert.equal(cover.scaleX, 3);
  assert.equal(cover.scaleY, 3);
  assert.equal(cover.offsetY, -100);
  assert.deepEqual(cover.mapPoint({ x: 50, y: 50 }), { x: 150, y: 50 });
});

test("a fixed logical playfield survives resize without mutating simulation state", () => {
  const logicalState = Object.freeze({
    player: Object.freeze({ x: 800, y: 450 }),
    score: 42,
  });
  const portraitTransform = createLogicalPlayfieldTransform(
    { width: 1600, height: 900 },
    { width: 900, height: 1600 },
  );
  const landscapeTransform = createLogicalPlayfieldTransform(
    { width: 1600, height: 900 },
    { width: 1200, height: 800 },
  );

  assert.equal(portraitTransform.scaleX, 0.5625);
  assert.equal(portraitTransform.offsetY, 546.875);
  assert.deepEqual(portraitTransform.mapPoint(logicalState.player), {
    x: 450,
    y: 800,
  });
  assert.deepEqual(landscapeTransform.mapPoint(logicalState.player), {
    x: 600,
    y: 400,
  });
  assert.deepEqual(
    portraitTransform.unmapPoint(
      portraitTransform.mapPoint(logicalState.player),
    ),
    logicalState.player,
  );
  assert.deepEqual(logicalState, {
    player: { x: 800, y: 450 },
    score: 42,
  });
});

test("schema remapping preserves gameplay progress and remaps nested arrays immutably", () => {
  const state = {
    layout: { width: 100, height: 200, gravity: 900 },
    score: 88,
    status: "playing",
    elapsedMs: 12_000,
    ball: {
      id: "ball-1",
      x: 25,
      y: 100,
      vx: 20,
      vy: -40,
      radius: 8,
    },
    bounds: {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    },
    targets: [
      {
        id: "target-1",
        x: 80,
        y: 150,
        vx: -10,
        vy: 30,
        radius: 5,
        targetX: 20,
      },
    ],
  };
  const nextLayout = { width: 200, height: 100, gravity: 700 };
  const schema = {
    fields: {
      ball: {
        operations: [
          GEOMETRY_OPERATIONS.POINT,
          GEOMETRY_OPERATIONS.VELOCITY,
        ],
        scalars: { radius: GEOMETRY_AXES.UNIFORM },
      },
      bounds: {
        operations: [GEOMETRY_OPERATIONS.RECTANGLE],
      },
      targets: {
        items: {
          operations: [
            GEOMETRY_OPERATIONS.POINT,
            GEOMETRY_OPERATIONS.VELOCITY,
          ],
          coordinates: { targetX: GEOMETRY_AXES.X },
          scalars: { radius: GEOMETRY_AXES.UNIFORM },
        },
      },
    },
  };
  const resized = resizePositionalState(state, nextLayout, schema);

  assert.notEqual(resized, state);
  assert.equal(resized.layout, nextLayout);
  assert.equal(resized.score, 88);
  assert.equal(resized.status, "playing");
  assert.equal(resized.elapsedMs, 12_000);
  assert.deepEqual(resized.ball, {
    id: "ball-1",
    x: 50,
    y: 50,
    vx: 40,
    vy: -20,
    radius: 4,
  });
  assert.deepEqual(resized.bounds, {
    x: 20,
    y: 10,
    width: 60,
    height: 20,
  });
  assert.deepEqual(resized.targets[0], {
    id: "target-1",
    x: 160,
    y: 75,
    vx: -20,
    vy: 15,
    radius: 2.5,
    targetX: 40,
  });
  assert.deepEqual(state.ball, {
    id: "ball-1",
    x: 25,
    y: 100,
    vx: 20,
    vy: -40,
    radius: 8,
  });
  assert.equal(state.layout.gravity, 900);
});

test("remapArray handles positional collections without changing source entries", () => {
  const source = [
    { id: "one", x: 2, y: 4 },
    { id: "two", x: 5, y: 8 },
  ];
  const transform = createViewportTransform(
    { width: 10, height: 10 },
    { width: 20, height: 30 },
  );
  const remapped = remapArray(source, (point) => transform.mapPoint(point));

  assert.deepEqual(remapped, [
    { id: "one", x: 4, y: 12 },
    { id: "two", x: 10, y: 24 },
  ]);
  assert.deepEqual(source, [
    { id: "one", x: 2, y: 4 },
    { id: "two", x: 5, y: 8 },
  ]);
  assert.equal(remapArray(null, () => null), null);
});

test("fullscreen resize schemas cover every result-capable fullscreen registry mode", () => {
  const expectedModeIds = MODE_REGISTRY.filter(
    (mode) =>
      mode.entryKind === "fullscreen-mode" &&
      mode.supportsResults &&
      mode.fullscreenMode,
  )
    .flatMap((mode) => [mode.fullscreenMode, ...(mode.variants ?? [])])
    .sort();

  assert.deepEqual(FULLSCREEN_GAME_RESIZE_MODE_IDS, expectedModeIds);
});

test("Breakout resize preserves the round and remaps balls, capsules, and bricks", () => {
  const state = {
    layout: { width: 400, height: 800 },
    score: 1_700,
    lives: 2,
    level: 3,
    status: "playing",
    countdownMs: 0,
    paddle: { x: 200 },
    balls: [
      { id: "ball-9", x: 100, y: 400, vx: 40, vy: -80, radius: 10 },
    ],
    capsules: [
      { id: "capsule-2", x: 300, y: 200, vy: 50, width: 20, height: 30 },
    ],
    bricks: [
      {
        id: "brick-1",
        x: 20,
        y: 40,
        width: 60,
        height: 30,
        destroyed: true,
      },
    ],
  };
  const nextLayout = { width: 800, height: 400 };
  const resized = resizeFullscreenGameState("breakout", state, nextLayout);

  assert.equal(resized.score, 1_700);
  assert.equal(resized.lives, 2);
  assert.equal(resized.level, 3);
  assert.equal(resized.status, "playing");
  assert.deepEqual(resized.balls[0], {
    id: "ball-9",
    x: 200,
    y: 200,
    vx: 80,
    vy: -40,
    radius: 5,
  });
  assert.deepEqual(resized.capsules[0], {
    id: "capsule-2",
    x: 600,
    y: 100,
    vy: 25,
    width: 40,
    height: 15,
  });
  assert.deepEqual(resized.bricks[0], {
    id: "brick-1",
    x: 40,
    y: 20,
    width: 120,
    height: 15,
    destroyed: true,
  });
});

test("nested Fruit Ninja trails and Missile Command target coordinates remap", () => {
  const fruit = resizeFullscreenGameState(
    "fruit-ninja",
    {
      layout: { width: 100, height: 100 },
      score: 200,
      status: "running",
      bladeTrail: [{ x: 25, y: 75, timestamp: 42 }],
      swipeSegments: [
        {
          start: { x: 10, y: 20 },
          end: { x: 40, y: 80 },
          speed: 700,
        },
      ],
    },
    { width: 200, height: 300 },
  );
  assert.deepEqual(fruit.bladeTrail, [{ x: 50, y: 225, timestamp: 42 }]);
  assert.deepEqual(fruit.swipeSegments, [
    {
      start: { x: 20, y: 60 },
      end: { x: 80, y: 240 },
      speed: 700,
    },
  ]);
  assert.equal(fruit.score, 200);

  const missile = resizeFullscreenGameState(
    "missile-command",
    {
      layout: { width: 200, height: 100 },
      score: 500,
      status: "playing",
      threats: [
        {
          id: "threat-1",
          startX: 10,
          startY: 20,
          x: 50,
          y: 40,
          targetX: 180,
          targetY: 90,
          vx: 20,
          vy: 10,
        },
      ],
    },
    { width: 100, height: 200 },
  );
  assert.deepEqual(missile.threats[0], {
    id: "threat-1",
    startX: 5,
    startY: 40,
    x: 25,
    y: 80,
    targetX: 90,
    targetY: 180,
    vx: 10,
    vy: 20,
  });
  assert.equal(missile.score, 500);
});

test("invalid geometry configuration fails early", () => {
  assert.throws(
    () => createViewportTransform({ width: 0, height: 10 }, { width: 10, height: 10 }),
    /positive width and height/,
  );
  assert.throws(
    () =>
      remapPositionalState(
        { point: { x: 1, y: 2 } },
        {},
        { fields: { point: { operations: ["point"] } } },
      ),
    /viewport transform/,
  );
  assert.throws(
    () =>
      resizeFullscreenGameState(
        "unknown-game",
        { layout: { width: 10, height: 10 } },
        { width: 20, height: 20 },
      ),
    /No fullscreen resize schema/,
  );
});
