import test from "node:test";
import assert from "node:assert/strict";

import { createTicTacToeLayout } from "../src/ticTacToeGame.js";
import {
  FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID,
  FULLSCREEN_CAMERA_LANDING_OPTIONS,
  FULLSCREEN_CAMERA_MODE_OPTIONS,
  FULLSCREEN_MODE_LANDING_HOLD_MS,
  createFullscreenModeLandingLayout,
  createFullscreenModeLandingState,
  getVerifiedFullscreenMenuHandPointerInput,
  getVerifiedFullscreenMenuHand,
  hasVerifiedFullscreenMenuHand,
  selectFullscreenModeLandingMode,
  stepFullscreenModeLanding,
} from "../src/fullscreenModeLanding.js";

function getBoxCenter(box) {
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

test("createFullscreenModeLandingLayout includes every mode and keeps box proportions", () => {
  const width = 1366;
  const height = 768;
  const layout = createFullscreenModeLandingLayout(width, height);
  const ticTacToeLayout = createTicTacToeLayout(width, height);

  assert.equal(layout.boxes.length, FULLSCREEN_CAMERA_LANDING_OPTIONS.length);
  assert.ok(layout.boxes.some((box) => box.id === "fingerprint-worlds"));
  assert.ok(layout.boxWidth > 0);
  assert.ok(layout.boxHeight > 0);
  assert.ok(
    Math.abs(layout.boxWidth / layout.boxHeight - ticTacToeLayout.resetBoxWidth / ticTacToeLayout.resetBoxHeight) < 1e-6,
  );
});

test("createFullscreenModeLandingLayout includes a large back to input test tile", () => {
  const layout = createFullscreenModeLandingLayout(1366, 768);
  const backBox = layout.boxes.find((box) => box.id === FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID);

  assert.ok(backBox);
  assert.equal(backBox.label, "Back to Input Test");
  assert.equal(backBox.category, "Navigation");
  assert.equal(FULLSCREEN_CAMERA_MODE_OPTIONS.some((option) => option.id === backBox.id), false);
});

test("createFullscreenModeLandingLayout keeps the full menu inside representative viewports", () => {
  for (const [width, height] of [
    [1280, 720],
    [768, 1024],
    [390, 844],
    [640, 360],
  ]) {
    const layout = createFullscreenModeLandingLayout(width, height);
    const minLeft = Math.min(...layout.boxes.map((box) => box.left));
    const minTop = Math.min(...layout.boxes.map((box) => box.top));
    const maxRight = Math.max(...layout.boxes.map((box) => box.left + box.width));
    const maxBottom = Math.max(...layout.boxes.map((box) => box.top + box.height));

    assert.equal(layout.width, width, `${width}x${height} should use the visible viewport width`);
    assert.equal(layout.height, height, `${width}x${height} should use the visible viewport height`);
    assert.ok(minLeft >= 0, `${width}x${height} should not overflow left`);
    assert.ok(minTop >= 0, `${width}x${height} should not overflow top`);
    assert.ok(maxRight <= layout.width, `${width}x${height} should not overflow right`);
    assert.ok(maxBottom <= layout.height, `${width}x${height} should not overflow bottom`);
  }
});

test("createFullscreenModeLandingLayout reserves space for the fullscreen HUD", () => {
  for (const [width, height] of [
    [1280, 720],
    [960, 720],
    [390, 844],
    [320, 440],
  ]) {
    const layout = createFullscreenModeLandingLayout(width, height);
    const minTop = Math.min(...layout.boxes.map((box) => box.top));
    const maxBottom = Math.max(...layout.boxes.map((box) => box.top + box.height));

    assert.ok(layout.contentTop >= 60, `${width}x${height} should reserve the top HUD`);
    assert.ok(layout.height - layout.contentBottom >= 18, `${width}x${height} should preserve bottom padding`);
    assert.ok(minTop >= layout.contentTop, `${width}x${height} should start below the top HUD`);
    assert.ok(maxBottom <= layout.contentBottom, `${width}x${height} should stay inside the safe content area`);
  }
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

test("getVerifiedFullscreenMenuHand selects the first hand with all required fingertips", () => {
  const partialHand = {
    id: "partial",
    fingerTips: {
      thumb: { u: 0.1, v: 0.1 },
      index: { u: 0.2, v: 0.2 },
    },
  };
  const verifiedHand = {
    id: "verified",
    fingerTips: {
      thumb: { u: 0.1, v: 0.1 },
      index: { u: 0.2, v: 0.2 },
      middle: { u: 0.3, v: 0.3 },
      ring: { u: 0.4, v: 0.4 },
      pinky: { u: 0.5, v: 0.5 },
    },
  };

  assert.equal(getVerifiedFullscreenMenuHand([partialHand, verifiedHand]), verifiedHand);
  assert.equal(getVerifiedFullscreenMenuHand([partialHand]), null);
  assert.equal(getVerifiedFullscreenMenuHand(null), null);
});

test("getVerifiedFullscreenMenuHandPointerInput binds hold input to the verified hand", () => {
  const partialHand = {
    id: "partial",
    fingerTips: {
      thumb: { u: 0.1, v: 0.1 },
      index: { u: 0.2, v: 0.2 },
    },
  };
  const verifiedHand = {
    id: "verified",
    fingerTips: {
      thumb: { u: 0.1, v: 0.1 },
      index: { u: 0.7, v: 0.4 },
      middle: { u: 0.3, v: 0.3 },
      ring: { u: 0.4, v: 0.4 },
      pinky: { u: 0.5, v: 0.5 },
    },
  };

  const input = getVerifiedFullscreenMenuHandPointerInput(
    [partialHand, verifiedHand],
    { left: 100, top: 40, width: 800, height: 600 },
    (point) => ({ x: point.u * 800 + 100, y: point.v * 600 + 40 }),
  );

  assert.equal(input.handVerified, true);
  assert.equal(input.pointerActive, true);
  assert.equal(input.pointerX, 560);
  assert.equal(input.pointerY, 240);
});

test("getVerifiedFullscreenMenuHandPointerInput stays inactive without a projected verified hand", () => {
  const input = getVerifiedFullscreenMenuHandPointerInput(
    [
      {
        id: "partial",
        fingerTips: {
          thumb: { u: 0.1, v: 0.1 },
          index: { u: 0.2, v: 0.2 },
        },
      },
    ],
    { left: 0, top: 0, width: 800, height: 600 },
    () => ({ x: 200, y: 200 }),
  );

  assert.deepEqual(input, {
    handVerified: false,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
  });
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

test("stepFullscreenModeLanding selects the back to input test tile after a verified hold", () => {
  const base = createFullscreenModeLandingState(1280, 720);
  const backBox = base.layout.boxes.find((box) => box.id === FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID);
  const pointer = getBoxCenter(backBox);
  const stepsToSelect = Math.ceil((FULLSCREEN_MODE_LANDING_HOLD_MS / 1000) * 60);

  let selectedState = base;
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

  assert.equal(selectedState.selectedModeId, FULLSCREEN_CAMERA_BACK_TO_INPUT_TEST_ID);
});

test("selectFullscreenModeLandingMode lets mouse clicks choose a fullscreen mode without a verified hand", () => {
  const base = createFullscreenModeLandingState(1280, 720);
  const selected = selectFullscreenModeLandingMode(base, "fingerprint-worlds");
  const ignored = selectFullscreenModeLandingMode(base, "not-a-mode");

  assert.equal(selected.handVerified, false);
  assert.equal(selected.selectedModeId, "fingerprint-worlds");
  assert.equal(ignored.selectedModeId, null);
});
