import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function getRuleBody(selector) {
  const escapedSelector = selector.replaceAll(".", "\\.");
  const match = styles.match(new RegExp(`(?:^|})[^{}]*${escapedSelector}[^{}]*\\{([^}]*)\\}`));
  assert.ok(match, `Expected ${selector} rule to exist`);
  return match[1];
}

test("Find Your Grind dims only the fullscreen webcam underlay", () => {
  const videoRule = getRuleBody(".fullscreen-camera-video.find-your-grind-underlay");

  assert.match(videoRule, /opacity:\s*0\.25/);
});
