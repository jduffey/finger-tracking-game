import test from "node:test";
import assert from "node:assert/strict";

import {
  RESIZABLE_LEFT_PANE_HANDLE_WIDTH_PX,
  RESIZABLE_LEFT_PANE_MIN_WIDTH_PX,
  RESIZABLE_RIGHT_PANE_MIN_WIDTH_PX,
  clampResizableLeftPaneWidth,
} from "../src/layoutSizing.js";

test("clamps the left pane width to the configured minimum", () => {
  const clamped = clampResizableLeftPaneWidth(120, 1200);

  assert.equal(clamped, RESIZABLE_LEFT_PANE_MIN_WIDTH_PX);
});

test("clamps the left pane width so the main panel keeps its minimum width", () => {
  const containerWidth = 1200;
  const clamped = clampResizableLeftPaneWidth(1000, containerWidth);

  assert.equal(
    clamped,
    containerWidth - RESIZABLE_RIGHT_PANE_MIN_WIDTH_PX - RESIZABLE_LEFT_PANE_HANDLE_WIDTH_PX,
  );
});

test("falls back to the minimum width when the container is narrower than both panes", () => {
  const clamped = clampResizableLeftPaneWidth(500, 420);

  assert.equal(clamped, RESIZABLE_LEFT_PANE_MIN_WIDTH_PX);
});
