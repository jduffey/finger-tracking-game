import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const componentSource = readFileSync(
  new URL("../src/components/ExperienceOverlay.jsx", import.meta.url),
  "utf8",
);
const styleSource = readFileSync(
  new URL("../src/experienceOverlay.css", import.meta.url),
  "utf8",
);

test("experience overlay exposes dialogs, alerts, live regions, and native controls", () => {
  assert.match(componentSource, /aria-modal="true"/);
  assert.match(componentSource, /"alertdialog"\s*:\s*"dialog"/);
  assert.match(componentSource, /aria-live=\{view\.livePriority\}/);
  assert.match(componentSource, /aria-atomic="true"/);
  assert.match(componentSource, /role="timer"/);
  assert.match(componentSource, /type="button"/);
  assert.match(componentSource, /role="group"/);
});

test("experience overlay manages entry, restoration, escape, and trapped tab focus", () => {
  assert.match(componentSource, /previousModalRef/);
  assert.match(componentSource, /focusOriginRef/);
  assert.match(componentSource, /preventScroll:\s*true/);
  assert.match(componentSource, /event\.key === "Escape"/);
  assert.match(componentSource, /event\.key !== "Tab"/);
  assert.match(componentSource, /FOCUSABLE_SELECTOR/);
  assert.match(componentSource, /requestAnimationFrame/);
});

test("overlay CSS preserves usable controls and viewport space across form factors", () => {
  assert.match(styleSource, /min-height:\s*44px/);
  assert.match(styleSource, /env\(safe-area-inset-top\)/);
  assert.match(styleSource, /max-height:\s*min\(88dvh/);
  assert.match(styleSource, /@media \(max-width: 640px\)/);
  assert.match(
    styleSource,
    /@media \(max-height: 520px\) and \(orientation: landscape\)/,
  );
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styleSource, /\[data-reduced-motion="true"\]/);
  assert.match(styleSource, /@media \(forced-colors: active\)/);
});
