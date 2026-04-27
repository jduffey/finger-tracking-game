import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function getRuleBody(selector) {
  const escapedSelector = selector.replaceAll(".", "\\.");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected ${selector} rule to exist`);
  return match[1];
}

test("Sky Patrol top HUD bar is centered horizontally", () => {
  const scoreboardRules = [...styles.matchAll(/\.fullscreen-camera-sky-patrol-scoreboard\s*\{([^}]*)\}/g)];

  assert.ok(scoreboardRules.length >= 2);
  for (const [, ruleBody] of scoreboardRules) {
    assert.match(ruleBody, /left:\s*50%/);
    assert.match(ruleBody, /right:\s*auto/);
    assert.match(ruleBody, /transform:\s*translateX\(-50%\)/);
  }
});

test("Sky Patrol start title sits below the centered HUD bar", () => {
  const startPromptRule = getRuleBody(".fullscreen-camera-sky-patrol-banner.start-prompt");

  assert.match(startPromptRule, /top:\s*92px/);
});
