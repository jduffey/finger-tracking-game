import test from "node:test";
import assert from "node:assert/strict";
import { getHandOverlayStyle } from "../src/handOverlayStyles.js";

test("left hand always uses the orange overlay palette", () => {
  const style = getHandOverlayStyle({ label: "Left" }, 1);
  assert.equal(style.point, "rgba(255, 141, 87, 0.95)");
  assert.equal(style.poseFill, "rgba(255, 167, 110, 0.95)");
});

test("right hand always uses the blue overlay palette even when it is the only hand", () => {
  const style = getHandOverlayStyle({ label: "Right" }, 0);
  assert.equal(style.point, "rgba(86, 196, 255, 0.95)");
  assert.equal(style.poseFill, "rgba(110, 204, 255, 0.95)");
});

test("unlabeled hands still fall back to index-based palettes", () => {
  assert.equal(
    getHandOverlayStyle({}, 0).point,
    "rgba(255, 141, 87, 0.95)",
  );
  assert.equal(
    getHandOverlayStyle({}, 1).point,
    "rgba(86, 196, 255, 0.95)",
  );
});
