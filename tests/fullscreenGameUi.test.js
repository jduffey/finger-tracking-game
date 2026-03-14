import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowFullscreenInvadersBanner } from "../src/fullscreenGameUi.js";

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
