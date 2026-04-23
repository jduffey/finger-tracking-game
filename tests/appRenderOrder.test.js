import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App computes the fullscreen camera viewport before Tic Tac Toe cursor geometry", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const viewportIndex = source.indexOf("const fullscreenCameraViewport = useMemo");
  const ticTacToeCursorIndex = source.indexOf("const fullscreenTicTacToeCursorPoint =");

  assert.ok(viewportIndex >= 0);
  assert.ok(ticTacToeCursorIndex >= 0);
  assert.ok(
    viewportIndex < ticTacToeCursorIndex,
    "Tic Tac Toe cursor point must not read fullscreenCameraViewport before the hook initializes it",
  );
});
