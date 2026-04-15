import test from "node:test";
import assert from "node:assert/strict";

import { createTicTacToeLayout } from "../src/ticTacToeGame.js";
import {
  FULLSCREEN_CAMERA_MODE_OPTIONS,
  FULLSCREEN_MODE_LANDING_HOLD_MS,
  createFullscreenModeLandingLayout,
  createFullscreenModeLandingState,
  hasVerifiedFullscreenMenuHand,
  stepFullscreenModeLanding,
} from "../src/fullscreenModeLanding.js";

function getBoxCenter(box) {
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

test("createFullscreenModeLandingLayout reuses the Tic Tac Toe reset box size", () => {
  const width = 1366;
  const height = 768;
  const layout = createFullscreenModeLandingLayout(width, height);
  const ticTacToeLayout = createTicTacToeLayout(width, height);

  assert.equal(layout.boxWidth, ticTacToeLayout.resetBoxWidth);
  assert.equal(layout.boxHeight, ticTacToeLayout.resetBoxHeight);
  assert.equal(layout.boxes.length, FULLSCREEN_CAMERA_MODE_OPTIONS.length);
});

test("hasVerifiedFullscreenMenuHand only accepts hands with all five fingertips", () => {
  assert.equal(
    hasVerifiedFullscreenMenuHand({
      fingerTips: {
        thumb: { u: 0.1, v: 0.1 },
        index: { u: 0.2, v: 0.2 },
        middle: { u: 0.3, v: 0.3 },
        ring: { u: 0.4, v: 0.4 },
        pinky: { u: 0.5, v: 0.5 },
      },
    }),
    true,
  );
  assert.equal(
    hasVerifiedFullscreenMenuHand({
      fingerTips: {
        thumb: { u: 0.1, v: 0.1 },
        index: { u: 0.2, v: 0.2 },
        middle: { u: 0.3, v: 0.3 },
        ring: { u: 0.4, v: 0.4 },
        pinky: null,
      },
    }),
    false,
  );
});

test("stepFullscreenModeLanding waits for a verified hand before starting a 1.00 second hold", () => {
  const base = createFullscreenModeLandingState(1280, 720);
  const targetBox = base.layout.boxes.find((box) => box.id === "tic-tac-toe");
  const pointer = getBoxCenter(targetBox);

  const unverified = stepFullscreenModeLanding(base, 1 / 60, {
    handVerified: false,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.equal(unverified.handVerified, false);
  assert.equal(unverified.holdModeId, null);
  assert.equal(unverified.holdMs, 0);
  assert.equal(unverified.selectedModeId, null);

  const held = stepFullscreenModeLanding(unverified, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: pointer.x,
    pointerY: pointer.y,
  });

  assert.equal(held.handVerified, true);
  assert.equal(held.holdModeId, "tic-tac-toe");
  assert.equal(held.holdMs, 0);
  assert.equal(held.selectedModeId, null);

  const stepsToSelect = Math.ceil((FULLSCREEN_MODE_LANDING_HOLD_MS / 1000) * 60);
  let selectedState = held;
  for (let index = 0; index < stepsToSelect + 2; index += 1) {
    selectedState = stepFullscreenModeLanding(selectedState, 1 / 60, {
      handVerified: true,
      pointerActive: true,
      pointerX: pointer.x,
      pointerY: pointer.y,
    });
    if (selectedState.selectedModeId) {
      break;
    }
  }

  assert.equal(selectedState.selectedModeId, "tic-tac-toe");
});

test("stepFullscreenModeLanding clears the hold when the pointer leaves the hovered box", () => {
  const base = createFullscreenModeLandingState(1280, 720);
  const firstBox = base.layout.boxes.find((box) => box.id === "square");
  const secondBox = base.layout.boxes.find((box) => box.id === "hex");
  const firstPointer = getBoxCenter(firstBox);
  const secondPointer = getBoxCenter(secondBox);

  const started = stepFullscreenModeLanding(base, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: firstPointer.x,
    pointerY: firstPointer.y,
  });
  const progressed = stepFullscreenModeLanding(started, 0.25, {
    handVerified: true,
    pointerActive: true,
    pointerX: firstPointer.x,
    pointerY: firstPointer.y,
  });
  const switched = stepFullscreenModeLanding(progressed, 1 / 60, {
    handVerified: true,
    pointerActive: true,
    pointerX: secondPointer.x,
    pointerY: secondPointer.y,
  });

  assert.equal(progressed.holdModeId, "square");
  assert.ok(progressed.holdMs > 0);
  assert.equal(switched.holdModeId, "hex");
  assert.equal(switched.holdMs, 0);
  assert.equal(switched.selectedModeId, null);
});
