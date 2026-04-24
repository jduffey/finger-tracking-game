import test from "node:test";
import assert from "node:assert/strict";

import { getFullscreenRestartControlLabel } from "../src/fullscreenRestartModes.js";

test("getFullscreenRestartControlLabel returns labels for terminal fullscreen modes", () => {
  assert.equal(
    getFullscreenRestartControlLabel("hand-bounce", {
      handBounce: { status: "gameover" },
    }),
    "Restart Bounce",
  );
  assert.equal(
    getFullscreenRestartControlLabel("brick-dodger", {
      brickDodger: { status: "gameover" },
    }),
    "Restart Run",
  );
  assert.equal(
    getFullscreenRestartControlLabel("finger-pong", {
      fingerPong: { status: "won" },
    }),
    "Restart Rally",
  );
  assert.equal(
    getFullscreenRestartControlLabel("fruit-ninja", {
      fruitNinja: { status: "gameover" },
    }),
    "Restart Round",
  );
  assert.equal(
    getFullscreenRestartControlLabel("sky-patrol", {
      skyPatrol: { status: "gameover" },
    }),
    "Restart Sortie",
  );
  assert.equal(
    getFullscreenRestartControlLabel("missile-command", {
      missileCommand: { status: "game_over" },
    }),
    "Restart Defense",
  );
});

test("getFullscreenRestartControlLabel stays hidden during active rounds and modes with existing restart UI", () => {
  assert.equal(
    getFullscreenRestartControlLabel("hand-bounce", {
      handBounce: { status: "playing" },
    }),
    null,
  );
  assert.equal(
    getFullscreenRestartControlLabel("brick-dodger", {
      brickDodger: { status: "playing" },
    }),
    null,
  );
  assert.equal(
    getFullscreenRestartControlLabel("finger-pong", {
      fingerPong: { status: "playing" },
    }),
    null,
  );
  assert.equal(
    getFullscreenRestartControlLabel("fruit-ninja", {
      fruitNinja: { status: "playing" },
    }),
    null,
  );
  assert.equal(
    getFullscreenRestartControlLabel("missile-command", {
      missileCommand: { status: "playing" },
    }),
    null,
  );
  assert.equal(
    getFullscreenRestartControlLabel("sky-patrol", {
      skyPatrol: { status: "playing" },
    }),
    null,
  );
  assert.equal(
    getFullscreenRestartControlLabel("tic-tac-toe", {
      ticTacToe: { status: "player" },
    }),
    null,
  );
});
