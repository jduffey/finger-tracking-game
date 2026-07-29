import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/SpatialGestureMemory.jsx", import.meta.url),
  "utf8",
);

test("Spatial Gesture Memory exposes semantic phases and live announcements", () => {
  assert.match(source, /aria-label="Round phases"/);
  assert.match(source, /aria-current=\{index === activeIndex \? "step"/);
  assert.match(
    source,
    /aria-live=\{resultVisible \? "assertive" : "polite"\}/,
  );
  assert.match(source, /role=\{resultVisible \? "alert" : "status"\}/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /data-experience-phase=\{experience\.phase\}/);
});

test("every gesture receives an equal native button and keyboard shortcut", () => {
  assert.match(source, /GESTURE_DEFINITIONS\.map/);
  assert.match(source, /<button[\s\S]*?type="button"/);
  assert.match(source, /onClick=\{\(\) => submitGesture\(gesture\.id\)\}/);
  assert.match(source, /aria-keyshortcuts=\{shortcut\}/);
  assert.match(source, /GESTURE_BY_SHORTCUT\.get\(event\.key\)/);
  assert.match(source, /mouse, touch, and keyboard/);
});

test("Reproduce renders numbered hidden steps without expected gesture copy", () => {
  const reproduceBranch = source.match(
    /experience\.phase === SPATIAL_MEMORY_PHASES\.REPRODUCE\)[\s\S]*?if \(experience\.phase === SPATIAL_MEMORY_PHASES\.RESULT\)/,
  )?.[0];
  assert.ok(reproduceBranch);
  assert.match(reproduceBranch, /Hidden step/);
  assert.doesNotMatch(reproduceBranch, /expectedLabel|expectedStep/);
  assert.doesNotMatch(reproduceBranch, /getSpatialMemoryStepLabel/);
});

test("teaching motion is observable and has a reduced-motion fallback", () => {
  assert.match(source, /sgmx-teaching-card/);
  assert.match(source, /sgmx-teach-progress/);
  assert.match(source, /@keyframes sgmx-teach-in/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /:root\[data-reduced-motion="true"\]/);
  assert.match(source, /\.sgmx-motion-safe/);
  assert.match(source, /animation: none !important/);
});

test("the component documents its controlled App integration boundary", () => {
  assert.match(source, /experienceState/);
  assert.match(source, /onExperienceAction\(action\)/);
  assert.match(source, /onGestureInput\(id, meta\)/);
  assert.match(source, /Backward-compatible props/);
  assert.match(source, /state, onStart and onReset continue to work/);
});

test("phase-changing controls transfer focus and cannot reveal teaching mid-attempt", () => {
  assert.match(source, /firstGestureButtonRef\.current\?\.focus/);
  assert.match(source, /readyButtonRef\.current\?\.focus/);
  assert.match(
    source,
    /experience\.phase === SPATIAL_MEMORY_PHASES\.OBSERVE \|\|[\s\S]*?experience\.phase === SPATIAL_MEMORY_PHASES\.READY/,
  );
  assert.doesNotMatch(
    source,
    /experience\.phase !== SPATIAL_MEMORY_PHASES\.RESULT \? \([\s\S]*?Replay teaching/,
  );
});
