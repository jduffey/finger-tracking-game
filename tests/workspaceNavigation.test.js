import test from "node:test";
import assert from "node:assert/strict";

import {
  getWorkspaceNavigationGroups,
  shouldShowWorkspaceNav,
} from "../src/workspaceNavigation.js";

test("shows the workspace nav for the active game phase", () => {
  assert.equal(shouldShowWorkspaceNav("GAME"), true);
});

test("shows the workspace nav for the off-axis lab phase", () => {
  assert.equal(shouldShowWorkspaceNav("OFF_AXIS_LAB"), true);
});

test("shows the workspace nav for roulette and every registered phase experience", () => {
  assert.equal(shouldShowWorkspaceNav("ROULETTE"), true);
  assert.equal(shouldShowWorkspaceNav("SPATIAL_GESTURE_MEMORY"), true);
  assert.equal(shouldShowWorkspaceNav("GESTURE_ART_LAB"), true);
});

test("does not show the workspace nav for unrelated phases", () => {
  assert.equal(shouldShowWorkspaceNav("FULLSCREEN_CAMERA"), false);
  assert.equal(shouldShowWorkspaceNav("HOME"), false);
});

test("builds Play, Create, and Labs navigation from the shared registry", () => {
  const groups = getWorkspaceNavigationGroups();

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Play", "Create", "Labs"],
  );
  assert.ok(groups.every((group) => group.modes.length > 0));
  assert.ok(groups[0].modes.some((mode) => mode.id === "spatial-memory"));
  assert.ok(groups[1].modes.some((mode) => mode.id === "gesture-art"));
  assert.ok(groups[2].modes.some((mode) => mode.id === "probability-table"));
});
