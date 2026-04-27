import test from "node:test";
import assert from "node:assert/strict";

import { FULLSCREEN_MODE_LANDING_HOLD_MS } from "../src/fullscreenModeLanding.js";
import {
  areFullscreenExitControlStatesEqual,
  createFullscreenExitControlLayout,
  createFullscreenExitControlState,
  stepFullscreenExitControl,
} from "../src/fullscreenExitControl.js";

function getBoxCenter(layout) {
  return {
    x: layout.left + layout.boxWidth / 2,
    y: layout.top + layout.boxHeight / 2,
  };
}

test("createFullscreenExitControlLayout anchors the exit box in the top right", () => {
  const layout = createFullscreenExitControlLayout(1366, 768);

  assert.ok(layout.left > 0);
  assert.equal(layout.top, 0);
  assert.equal(layout.left + layout.boxWidth, layout.width);
  assert.equal(layout.top + layout.boxHeight <= layout.height, true);
});

test("stepFullscreenExitControl waits for a verified hand before starting the 1.00 second exit hold", () => {
  const base = createFullscreenExitControlState(1280, 720);
  const pointer = getBoxCenter(base.layout);

  const unverified = stepFullscreenExitControl(base, 1 / 60, {
    handVerified: false,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.equal(unverified.handVerified, false);
  assert.equal(unverified.holdActive, false);
  assert.equal(unverified.holdMs, 0);
  assert.equal(unverified.shouldExit, false);

  let held = stepFullscreenExitControl(unverified, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.equal(held.holdActive, true);
  assert.equal(held.holdMs, 0);

  const stepsToExit = Math.ceil((FULLSCREEN_MODE_LANDING_HOLD_MS / 1000) * 60);
  for (let index = 0; index < stepsToExit + 2; index += 1) {
    held = stepFullscreenExitControl(held, 1 / 60, {
      handVerified: true,
      pointerActive: true,
      pointerX: pointer.x,
      pointerY: pointer.y,
    });
    if (held.shouldExit) {
      break;
    }
  }

  assert.equal(held.shouldExit, true);
});

test("stepFullscreenExitControl clears the hold when the pointer leaves the box", () => {
  const base = createFullscreenExitControlState(1280, 720);
  const pointer = getBoxCenter(base.layout);
  const started = stepFullscreenExitControl(base, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });
  const progressed = stepFullscreenExitControl(started, 0.5, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });
  const cleared = stepFullscreenExitControl(progressed, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: 0,
    pointerY: 0,
  });

  assert.ok(progressed.holdMs > 0);
  assert.equal(cleared.holdActive, false);
  assert.equal(cleared.holdMs, 0);
  assert.equal(cleared.shouldExit, false);
});

test("stepFullscreenExitControl does not count points that are outside the visible exit box", () => {
  const base = createFullscreenExitControlState(1280, 720);
  const outsidePointer = {
    x: base.layout.left + base.layout.boxWidth / 2,
    y: base.layout.boxHeight + 32,
  };

  const next = stepFullscreenExitControl(base, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: outsidePointer.x,
    pointerY: outsidePointer.y,
  });

  assert.equal(next.holdActive, false);
  assert.equal(next.holdMs, 0);
  assert.equal(next.shouldExit, false);
});

test("areFullscreenExitControlStatesEqual ignores fresh object identity when visible state is unchanged", () => {
  const base = createFullscreenExitControlState(1280, 720);
  const unchanged = stepFullscreenExitControl(base, 1 / 60, {
    handVerified: false,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
  });
  const pointer = getBoxCenter(base.layout);
  const active = stepFullscreenExitControl(base, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.notEqual(unchanged, base);
  assert.equal(areFullscreenExitControlStatesEqual(base, unchanged), true);
  assert.equal(areFullscreenExitControlStatesEqual(base, active), false);
});
