import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FOREST_DISCOVERIES,
  createManualForestOffAxis,
  getForestDiscoveryReveal,
  getForestTrailState,
  isForestDiscoveryFound,
  moveManualForestView,
  normalizeForestView,
} from "../src/offAxisForestDiscovery.js";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("the authored trail exposes one ordered discovery at a time", () => {
  const initial = getForestTrailState([]);
  assert.equal(initial.foundCount, 0);
  assert.equal(initial.totalCount, 3);
  assert.equal(initial.activeDiscovery.id, "cedar-owl");
  assert.equal(initial.complete, false);

  const second = getForestTrailState(["cedar-owl", "unknown", "cedar-owl"]);
  assert.equal(second.foundCount, 1);
  assert.equal(second.activeDiscovery.id, "fern-fox");

  const complete = getForestTrailState(
    FOREST_DISCOVERIES.map((discovery) => discovery.id),
  );
  assert.equal(complete.complete, true);
  assert.equal(complete.activeDiscovery, null);
  assert.equal(complete.activeIndex, -1);
});

test("each clue reveals only after moving in its authored direction", () => {
  const [owl, fox, moth] = FOREST_DISCOVERIES;

  assert.equal(getForestDiscoveryReveal(owl, { x: 0, y: 0 }), 0);
  assert.equal(getForestDiscoveryReveal(owl, { x: 1, y: 0 }), 0);
  assert.equal(isForestDiscoveryFound(owl, { x: -0.38, y: 0 }), true);

  assert.equal(isForestDiscoveryFound(fox, { x: -1, y: 0 }), false);
  assert.equal(isForestDiscoveryFound(fox, { x: 0.38, y: 0 }), true);

  assert.equal(isForestDiscoveryFound(moth, { x: 0, y: -1 }), false);
  assert.equal(isForestDiscoveryFound(moth, { x: 0, y: 0.3 }), true);
});

test("manual pointer and keyboard input remains normalized and recenters", () => {
  assert.deepEqual(normalizeForestView({ x: 4, y: -3 }), { x: 1, y: -1 });
  assert.deepEqual(normalizeForestView({ x: Number.NaN, y: null }), {
    x: 0,
    y: 0,
  });

  const movedLeft = moveManualForestView({ x: -0.95, y: 0 }, "ArrowLeft");
  assert.deepEqual(movedLeft, { x: -1, y: 0 });
  assert.deepEqual(moveManualForestView(movedLeft, "ArrowUp", 0.08), {
    x: -1,
    y: 0.08,
  });
  assert.deepEqual(moveManualForestView(movedLeft, "Home"), { x: 0, y: 0 });
  assert.deepEqual(moveManualForestView(movedLeft, "Enter"), movedLeft);
});

test("manual input drives the same parallax transform vocabulary as head input", () => {
  assert.deepEqual(createManualForestOffAxis({ x: 0.5, y: -0.5 }), {
    cameraShiftXPx: 36,
    cameraShiftYPx: 27,
    chamberRotationDeg: 5,
    chamberPitchDeg: 3.5,
    skewXDeg: -4,
    skewYDeg: -2.5,
    viewportInset: 22,
    depth: 0,
  });
});

test("the lab presents an honest objective, alternative controls, and result flow", () => {
  const componentSource = readSource("src/components/OffAxisChamberLab.jsx");
  const componentStyles = readSource("src/components/OffAxisChamberLab.css");

  assert.match(componentSource, /Experimental tracking lab · On-device head pose/);
  assert.match(componentSource, /not room scanning or true 3D reconstruction/);
  assert.match(componentSource, /Find the owl, fox, and canopy moth in order/);
  assert.match(componentSource, /Pointer \+ keys/);
  assert.match(componentSource, /onPointerMove=\{updateManualViewFromPointer\}/);
  assert.match(componentSource, /onKeyDown=\{handleStageKeyDown\}/);
  assert.match(componentSource, /setArmedDiscoveryId\(activeDiscovery\.id\)/);
  assert.match(componentSource, /Return toward the center to reset your viewpoint/);
  assert.match(componentSource, /Walk the trail again/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /<progress/);
  assert.match(componentSource, /<details className="offaxis-readout">/);

  assert.match(componentStyles, /^\.offaxis-discovery-panel \{/m);
  assert.match(componentStyles, /min-block-size: 44px/);
  assert.match(componentStyles, /@media \(max-width: 760px\)/);
  assert.match(componentStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(componentStyles, /:root\[data-high-contrast="true"\]/);
  assert.doesNotMatch(componentStyles, /^button[\s:{.#>]/m);
});
