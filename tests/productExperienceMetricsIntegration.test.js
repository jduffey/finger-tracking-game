import assert from "node:assert/strict";
import test from "node:test";

import {
  createLazyProductExperienceMetrics,
} from "../src/productExperienceMetricsIntegration.js";

test("the lazy integration preserves event order and the true start timestamp", async () => {
  const calls = [];
  let loadCount = 0;
  const session = {
    recordSelection(input) {
      calls.push(["selection", input]);
      return true;
    },
    recordFirstSuccess(timestampMs) {
      calls.push(["first-success", timestampMs]);
      return true;
    },
    complete(timestampMs) {
      calls.push(["complete", timestampMs]);
      return true;
    },
  };
  const integration = createLazyProductExperienceMetrics({
    loadMetricsModule: async () => {
      loadCount += 1;
      return {
        createProductExperienceMetricsStore() {
          return {
            beginExperience(options) {
              calls.push(["begin", options]);
              return session;
            },
          };
        },
      };
    },
    now: () => 125,
  });

  assert.equal(loadCount, 0);
  const measured = integration.beginExperience({
    modeId: "whack-a-mole",
    tutorial: true,
  });
  const selection = measured.recordSelection({
    inputMethod: "gesture",
    succeeded: true,
  });
  const firstSuccess = measured.recordFirstSuccess(480);
  const completed = measured.complete(900);

  assert.equal(await selection, true);
  assert.equal(await firstSuccess, true);
  assert.equal(await completed, true);
  assert.equal(loadCount, 1);
  assert.deepEqual(calls, [
    [
      "begin",
      {
        modeId: "whack-a-mole",
        timestampMs: 125,
        tutorial: true,
      },
    ],
    [
      "selection",
      {
        inputMethod: "gesture",
        succeeded: true,
      },
    ],
    ["first-success", 480],
    ["complete", 900],
  ]);
});

test("one lazy store is shared across measured experiences", async () => {
  let storeCreations = 0;
  const startedModes = [];
  const integration = createLazyProductExperienceMetrics({
    loadMetricsModule: async () => ({
      createProductExperienceMetricsStore() {
        storeCreations += 1;
        return {
          beginExperience({ modeId }) {
            startedModes.push(modeId);
            return {
              abandon() {
                return true;
              },
            };
          },
        };
      },
    }),
    now: () => 0,
  });

  await Promise.all([
    integration.beginExperience({ modeId: "breakout" }).abandon(10),
    integration.beginExperience({ modeId: "flappy" }).abandon(20),
  ]);

  assert.equal(storeCreations, 1);
  assert.deepEqual(startedModes, ["breakout", "flappy"]);
});

test("instrumentation load and callback failures remain non-blocking", async () => {
  const reported = [];
  const integration = createLazyProductExperienceMetrics({
    loadMetricsModule: async () => {
      throw new Error("chunk unavailable");
    },
    now: () => 0,
    onError(error) {
      reported.push(error.message);
      throw new Error("reporter unavailable");
    },
  });

  const session = integration.beginExperience({ modeId: "sky-patrol" });

  assert.equal(
    await session.recordSelection({
      inputMethod: "pointer",
      succeeded: false,
    }),
    false,
  );
  assert.equal(await session.complete(100), false);
  assert.deepEqual(reported, ["chunk unavailable"]);
});
