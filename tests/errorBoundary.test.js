import test from "node:test";
import assert from "node:assert/strict";

import { getRecoveryMessage } from "../src/errorRecovery.js";

test("recovery copy gives camera failures an actionable, non-technical path", () => {
  const message = getRecoveryMessage({ name: "NotAllowedError" });
  assert.match(message, /Camera access/);
  assert.match(message, /Home/);
  assert.equal(message.includes("NotAllowedError"), false);
});

test("recovery copy distinguishes graphics failures and keeps a safe fallback", () => {
  assert.match(getRecoveryMessage({ name: "GPUValidationError" }), /graphics hardware/);
  assert.match(getRecoveryMessage(new Error("boom")), /unexpected problem/);
});
