import test from "node:test";
import assert from "node:assert/strict";
import {
  getFullscreenTrackedFingerNames,
  shouldShowFullscreenInvadersBanner,
} from "../src/fullscreenGameUi.js";

test("getFullscreenTrackedFingerNames limits Tip Ripples modes to the index fingertip", () => {
  const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];

  assert.deepEqual(getFullscreenTrackedFingerNames("tip-ripples", fingerNames), ["index"]);
  assert.deepEqual(getFullscreenTrackedFingerNames("tip-ripples-v2", fingerNames), ["index"]);
});

test("getFullscreenTrackedFingerNames preserves all fingertips for other fullscreen modes", () => {
  const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];

  assert.deepEqual(getFullscreenTrackedFingerNames("voronoi", fingerNames), fingerNames);
});

test("shouldShowFullscreenInvadersBanner hides the banner while the round is active", () => {
  assert.equal(
    shouldShowFullscreenInvadersBanner({
      status: "playing",
      message: "Pinch to fire",
    }),
    false,
  );
});

test("shouldShowFullscreenInvadersBanner shows the banner for end-of-round states", () => {
  assert.equal(
    shouldShowFullscreenInvadersBanner({
      status: "gameover",
      message: "Ship hit. Pinch to restart",
    }),
    true,
  );
  assert.equal(
    shouldShowFullscreenInvadersBanner({
      status: "cleared",
      message: "Wave cleared. Pinch to restart",
    }),
    true,
  );
});
