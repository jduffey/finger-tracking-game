import test from "node:test";
import assert from "node:assert/strict";
import {
  getFullscreenDetectorHandLimit,
  getFullscreenTrackedHandLimit,
  getFullscreenTrackedFingerNames,
  shouldShowFullscreenNeonHandOutline,
  shouldShowFullscreenHandSkeleton,
  shouldShowFullscreenInvadersBanner,
} from "../src/fullscreenGameUi.js";

test("getFullscreenTrackedFingerNames limits Tip Ripples to the index fingertip", () => {
  const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];

  assert.deepEqual(getFullscreenTrackedFingerNames("tip-ripples", fingerNames), ["index"]);
});

test("getFullscreenTrackedFingerNames preserves all fingertips for other fullscreen modes", () => {
  const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];

  assert.deepEqual(getFullscreenTrackedFingerNames("voronoi", fingerNames), fingerNames);
});

test("getFullscreenTrackedHandLimit locks tic tac toe to one hand", () => {
  assert.equal(getFullscreenTrackedHandLimit("tic-tac-toe", 2), 1);
  assert.equal(getFullscreenTrackedHandLimit("flappy", 2), 2);
});

test("getFullscreenTrackedHandLimit lets non-Voronoi visualization demos track four hands", () => {
  for (const mode of ["square", "hex", "rings", "pulse", "tip-ripples", "static"]) {
    assert.equal(getFullscreenTrackedHandLimit(mode, 2), 4);
  }
});

test("getFullscreenTrackedHandLimit lets Voronoi track eight hands", () => {
  assert.equal(getFullscreenTrackedHandLimit("voronoi", 2), 8);
});

test("getFullscreenDetectorHandLimit only raises the detector cap for Voronoi", () => {
  assert.equal(getFullscreenDetectorHandLimit("voronoi", 4), 8);

  for (const mode of ["square", "hex", "rings", "pulse", "tip-ripples", "static", "hand-bounce"]) {
    assert.equal(getFullscreenDetectorHandLimit(mode, 4), 4);
  }
});

test("getFullscreenTrackedHandLimit lets Hand Bounce track four hands", () => {
  assert.equal(getFullscreenTrackedHandLimit("hand-bounce", 2), 4);
});

test("shouldShowFullscreenHandSkeleton reuses the Minority Report hand overlay for tic tac toe", () => {
  assert.equal(shouldShowFullscreenHandSkeleton("landing"), false);
  assert.equal(shouldShowFullscreenHandSkeleton("tic-tac-toe"), true);
  assert.equal(shouldShowFullscreenHandSkeleton("brick-dodger"), false);
});

test("shouldShowFullscreenNeonHandOutline reserves neon hand tracing for Sky Patrol", () => {
  assert.equal(shouldShowFullscreenNeonHandOutline("sky-patrol"), true);
  assert.equal(shouldShowFullscreenNeonHandOutline("tic-tac-toe"), false);
  assert.equal(shouldShowFullscreenNeonHandOutline("brick-dodger"), false);
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
