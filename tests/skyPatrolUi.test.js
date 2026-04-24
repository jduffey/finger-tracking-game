import test from "node:test";
import assert from "node:assert/strict";

import { getSkyPatrolFireCooldownUi, getSkyPatrolHudItems } from "../src/skyPatrolUi.js";

test("getSkyPatrolHudItems builds tactical HUD chips", () => {
  const items = getSkyPatrolHudItems({
    score: 480,
    lives: 2,
    airTargetCount: 1,
    groundTargetCount: 2,
    fireReady: true,
  });

  assert.deepEqual(
    items.map((item) => item.id),
    ["score", "lives", "air", "ground", "fire"],
  );
  assert.deepEqual(
    items.map((item) => item.value),
    [480, 2, 1, 2, "Ready"],
  );
});

test("getSkyPatrolFireCooldownUi exposes fire reload progress", () => {
  assert.deepEqual(getSkyPatrolFireCooldownUi({ fireCooldownMs: 65 }), {
    ready: false,
    progress: 0.5,
  });
  assert.deepEqual(getSkyPatrolFireCooldownUi({ fireCooldownMs: 0 }), {
    ready: true,
    progress: 1,
  });
});
