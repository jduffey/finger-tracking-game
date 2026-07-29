import assert from "node:assert/strict";
import test from "node:test";

import { getFingerPongMatchUi } from "../src/fingerPongUi.js";

test("Finger Pong UI distinguishes scores, serves, and rally mastery", () => {
  assert.deepEqual(
    getFingerPongMatchUi({
      score: 3,
      opponentScore: 2,
      rallyCount: 5,
      bestRally: 9,
      server: "opponent",
    }),
    {
      playerScore: 3,
      opponentScore: 2,
      rallyCount: 5,
      bestRally: 9,
      scoreLabel: "3–2",
      serverLabel: "Opponent serves",
      pressureLabel: "",
      rulesLabel: "First to 7 · win by 2",
    },
  );
});

test("Finger Pong UI explains deuce and match-point pressure", () => {
  assert.equal(
    getFingerPongMatchUi({ score: 6, opponentScore: 6 }).pressureLabel,
    "Deuce · win two straight",
  );
  assert.equal(
    getFingerPongMatchUi({ score: 6, opponentScore: 4 }).pressureLabel,
    "Your match point",
  );
  assert.equal(
    getFingerPongMatchUi({ score: 4, opponentScore: 6 }).pressureLabel,
    "Save match point",
  );
  assert.equal(
    getFingerPongMatchUi({ score: 8, opponentScore: 7 }).pressureLabel,
    "Your match point",
  );
});
