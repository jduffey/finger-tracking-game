import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeLogData, shouldRecordLogLevel } from "../src/logger.js";

test("routine debug events require an explicit diagnostics opt-in", () => {
  assert.equal(shouldRecordLogLevel("DEBUG", { debug: false }), false);
  assert.equal(shouldRecordLogLevel("DEBUG", { debug: true }), true);
  assert.equal(shouldRecordLogLevel("INFO", { debug: false }), true);
  assert.equal(shouldRecordLogLevel("ERROR", { debug: false }), true);
});

test("diagnostic sanitization redacts camera frames and landmark vectors", () => {
  assert.deepEqual(
    sanitizeLogData({
      mode: "sky-patrol",
      score: 120,
      frame: { width: 640, height: 480 },
      landmarks: [{ x: 0.2, y: 0.4 }],
      nested: {
        featureVectors: [0.1, 0.2],
        reason: "tracking-loss",
      },
    }),
    {
      mode: "sky-patrol",
      score: 120,
      frame: "[redacted local camera data]",
      landmarks: "[redacted local camera data]",
      nested: {
        featureVectors: "[redacted local camera data]",
        reason: "tracking-loss",
      },
    },
  );
});
