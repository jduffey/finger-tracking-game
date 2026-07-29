import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/wfc/WfcWorldRenderer.jsx", import.meta.url),
  "utf8",
);

test("World Painter exposes terrain and generation controls as keyboard buttons", () => {
  assert.match(source, /aria-pressed=\{tile\.id === game\.selectedTileId\}/);
  assert.match(source, /onSelectTile\?\.\(tile\.id\)/);
  assert.match(source, /onGenerate\?\.\(\)/);
  assert.match(source, /onClear\?\.\(\)/);
  assert.match(source, /type="button"/);
  assert.match(source, /aria-label=\{`\$\{tile\.ariaLabel\}/);
});

test("World Painter announces canvas status without exposing the decorative grid", () => {
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /role="status"/);
  assert.match(source, /normalizeWfcWorldSeed\(game\.seed\)/);
});

test("World Painter isolates the large grid from animation-frame shell renders", () => {
  assert.match(source, /const WfcWorldCell = memo\(/);
  assert.match(source, /const WfcWorldGridCells = memo\(/);
  assert.match(source, /useLayoutEffect\(\(\) => \{/);
  assert.match(source, /children\?\.\[hoverIndex\]/);
  assert.doesNotMatch(source, /getWfcGrid/);
});
