import test from "node:test";
import assert from "node:assert/strict";

import { shouldShowWorkspaceNav } from "../src/workspaceNavigation.js";

test("shows the workspace nav for the active game phase", () => {
  assert.equal(shouldShowWorkspaceNav("GAME"), true);
});

test("does not show the workspace nav for unrelated phases", () => {
  assert.equal(shouldShowWorkspaceNav("FULLSCREEN_CAMERA"), false);
});
