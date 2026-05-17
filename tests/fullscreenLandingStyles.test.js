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

test("fullscreen launcher hovered tiles use a full-card progress fill", () => {
  const tileFillRule = getRuleBody(".fullscreen-camera-mode-landing-box::before");
  const backFillRule = getRuleBody(".fullscreen-camera-landing-back::before");

  for (const ruleBody of [tileFillRule, backFillRule]) {
    assert.match(ruleBody, /height:\s*100%/);
    assert.match(ruleBody, /width:\s*calc\(var\(--hold-progress,\s*0\)\s*\*\s*100%\)/);
    assert.match(ruleBody, /background:\s*linear-gradient\(90deg,\s*rgba\(14,\s*165,\s*233,\s*0\.82\),\s*rgba\(34,\s*211,\s*238,\s*0\.62\)\)/);
  }

  const activeRule = getRuleBody(".fullscreen-camera-mode-landing-box.active");
  assert.match(activeRule, /background:\s*rgba\(12,\s*44,\s*72,\s*0\.9\)/);
});
