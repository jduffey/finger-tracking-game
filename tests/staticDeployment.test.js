import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const redirects = readFileSync(
  new URL("../public/_redirects", import.meta.url),
  "utf8",
);

test("static hosting preserves the standalone instrument and serves app deep links", () => {
  const rules = redirects
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 3);

  assert.deepEqual(rules.slice(0, 2), [
    ["/circle-of-fifths", "/circle-of-fifths.html", "301"],
    ["/circle-of-fifths/", "/circle-of-fifths.html", "301"],
  ]);
  assert.deepEqual(rules.at(-1), ["/*", "/index.html", "200"]);
});
