import test from "node:test";
import assert from "node:assert/strict";

import {
  SKY_PATROL_ACTIVE_HAND_CONNECTIONS,
  SKY_PATROL_ACTIVE_HAND_TIP_INDEXES,
  getSkyPatrolActiveHandTipStyle,
} from "../src/skyPatrolHandOverlay.js";

test("Sky Patrol active hand overlay only traces thumb and index fingers", () => {
  const tracedIndexes = new Set(SKY_PATROL_ACTIVE_HAND_CONNECTIONS.flat());

  assert.deepEqual(SKY_PATROL_ACTIVE_HAND_TIP_INDEXES, [4, 8]);
  for (const hiddenIndex of [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    assert.equal(tracedIndexes.has(hiddenIndex), false);
  }
});

test("Sky Patrol active hand overlay turns fingertip dots red while pinching", () => {
  assert.match(getSkyPatrolActiveHandTipStyle(true).fill, /255, 56, 76/);
  assert.notEqual(
    getSkyPatrolActiveHandTipStyle(false).fill,
    getSkyPatrolActiveHandTipStyle(true).fill,
  );
});
