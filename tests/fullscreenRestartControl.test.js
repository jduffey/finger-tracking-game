import test from "node:test";
import assert from "node:assert/strict";

import { FULLSCREEN_MODE_LANDING_HOLD_MS } from "../src/fullscreenModeLanding.js";
import {
  createFullscreenRestartControlLayout,
  createFullscreenRestartControlState,
  stepFullscreenRestartControl,
} from "../src/fullscreenRestartControl.js";

function getBoxCenter(layout) {
  return {
    x: layout.left + layout.boxWidth / 2,
    y: layout.top + layout.boxHeight / 2,
  };
}

test("createFullscreenRestartControlLayout anchors the restart box in the bottom left", () => {
  const layout = createFullscreenRestartControlLayout(1366, 768);

  assert.ok(layout.left > 0);
  assert.ok(layout.top > 0);
  assert.equal(layout.left + layout.boxWidth <= layout.width, true);
  assert.equal(layout.top + layout.boxHeight < layout.height, true);
  assert.ok(layout.left < layout.width / 2);
  assert.ok(layout.top > layout.height / 2);
});

test("createFullscreenRestartControlLayout keeps the restart box inside short fullscreen viewports", () => {
  for (const [width, height] of [
    [640, 360],
    [480, 320],
  ]) {
    const layout = createFullscreenRestartControlLayout(width, height);

    assert.equal(layout.width, width, `${width}x${height} should use the visible viewport width`);
    assert.equal(layout.height, height, `${width}x${height} should use the visible viewport height`);
    assert.ok(layout.left >= 0, `${width}x${height} should not overflow left`);
    assert.ok(layout.top >= 0, `${width}x${height} should not overflow top`);
    assert.ok(layout.left + layout.boxWidth <= width, `${width}x${height} should not overflow right`);
    assert.ok(layout.top + layout.boxHeight <= height, `${width}x${height} should not overflow bottom`);
  }
});

test("stepFullscreenRestartControl waits for a verified hand before starting the restart hold", () => {
  const base = createFullscreenRestartControlState(1280, 720);
  const pointer = getBoxCenter(base.layout);

  const unverified = stepFullscreenRestartControl(base, 1 / 60, {
    handVerified: false,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.equal(unverified.handVerified, false);
  assert.equal(unverified.holdActive, false);
  assert.equal(unverified.holdMs, 0);
  assert.equal(unverified.shouldRestart, false);

  let held = stepFullscreenRestartControl(unverified, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.equal(held.holdActive, true);
  assert.equal(held.holdMs, 0);

  const stepsToRestart = Math.ceil((FULLSCREEN_MODE_LANDING_HOLD_MS / 1000) * 60);
  for (let index = 0; index < stepsToRestart + 2; index += 1) {
    held = stepFullscreenRestartControl(held, 1 / 60, {
      handVerified: true,
      pointerActive: true,
      pointerX: pointer.x,
      pointerY: pointer.y,
    });
    if (held.shouldRestart) {
      break;
    }
  }

  assert.equal(held.shouldRestart, true);
});

test("stepFullscreenRestartControl clears the hold when the pointer leaves the box", () => {
  const base = createFullscreenRestartControlState(1280, 720);
  const pointer = getBoxCenter(base.layout);
  const started = stepFullscreenRestartControl(base, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });
  const progressed = stepFullscreenRestartControl(started, 0.5, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });
  const cleared = stepFullscreenRestartControl(progressed, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: base.layout.left + base.layout.boxWidth + 32,
    pointerY: pointer.y,
  });

  assert.ok(progressed.holdMs > 0);
  assert.equal(cleared.holdActive, false);
  assert.equal(cleared.holdMs, 0);
  assert.equal(cleared.shouldRestart, false);
});

test("stepFullscreenRestartControl does not count points that are outside the visible box", () => {
  const base = createFullscreenRestartControlState(1280, 720);
  const outsidePointer = {
    x: base.layout.left + base.layout.boxWidth + 1,
    y: base.layout.top + base.layout.boxHeight / 2,
  };

  const next = stepFullscreenRestartControl(base, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: outsidePointer.x,
    pointerY: outsidePointer.y,
  });

  assert.equal(next.holdActive, false);
  assert.equal(next.holdMs, 0);
  assert.equal(next.shouldRestart, false);
});
