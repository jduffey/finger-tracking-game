import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Jam Studio exposes an accessible loop transport and equivalent drum inputs", () => {
  const page = readSource("src/CircleOfFifthsPage.jsx");
  const styles = readSource("src/circleOfFifthsPage.css");

  assert.match(page, /aria-label="Live drum pads"/);
  assert.match(page, /aria-keyshortcuts=\{`\$\{index \+ 1\}`\}/);
  assert.match(page, /onClick=\{\(\) => triggerLoopDrum\(instrument\)\}/);
  assert.match(page, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(page, /> Record/);
  assert.match(page, />\s*Stop\s*</);
  assert.match(page, />\s*Play loop\s*</);
  assert.match(page, />\s*Clear\s*</);
  assert.match(page, />\s*Save local\s*</);
  assert.match(page, />\s*Load saved\s*</);
  assert.match(page, />\s*Export JSON\s*</);
  assert.match(page, /aria-live="polite"[\s\S]*?circle-fifths-loop-status/);
  assert.match(
    page,
    /Local save stores symbolic note timing only—never camera frames or recorded audio\./,
  );
  assert.match(
    styles,
    /\.circle-fifths-loop-transport button,[\s\S]*?min-height: 44px;/,
  );
  assert.match(styles, /\.circle-fifths-loop-name input:focus-visible/);
});
