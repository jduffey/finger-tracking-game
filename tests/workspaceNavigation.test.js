import test from "node:test";
import assert from "node:assert/strict";

import { shouldShowWorkspaceNav } from "../src/workspaceNavigation.js";

test("shows the workspace nav for the active game phase", () => {
  assert.equal(shouldShowWorkspaceNav("GAME"), true);
});

test("shows the workspace nav for the off-axis lab phase", () => {
  assert.equal(shouldShowWorkspaceNav("OFF_AXIS_LAB"), true);
});

test("does not show the workspace nav for unrelated phases", () => {
  assert.equal(shouldShowWorkspaceNav("FULLSCREEN_CAMERA"), false);
});
