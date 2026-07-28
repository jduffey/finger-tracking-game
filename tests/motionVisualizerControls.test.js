import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL(
    "../src/components/MotionVisualizerControls.jsx",
    import.meta.url,
  ),
  "utf8",
);

test("visualizer controls expose native accessible inputs for the full remix surface", () => {
  assert.match(source, /aria-label="Motion Visualizer controls"/);
  assert.match(source, /role="toolbar"/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /type="range"/);
  assert.match(source, /<select/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Number\s+keys 1–7 switch effects/);
});

test("visualizer controls communicate camera-free export and persisted look actions", () => {
  assert.match(source, /Export artwork/);
  assert.match(source, /never includes the camera/);
  assert.match(source, /Save current/);
  assert.match(source, /Delete saved/);
  assert.match(source, /onToggleFavorite/);
});
