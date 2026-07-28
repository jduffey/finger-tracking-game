import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL(
    "../src/components/WhackAMoleExperience.jsx",
    import.meta.url,
  ),
  "utf8",
);

test("the standalone surface presents teach, countdown, play, pause, and recap states", () => {
  assert.match(source, /WHACK_A_MOLE_PHASES\.IDLE/);
  assert.match(source, /WHACK_A_MOLE_PHASES\.TEACH/);
  assert.match(source, /WHACK_A_MOLE_PHASES\.COUNTDOWN/);
  assert.match(source, /WHACK_A_MOLE_PHASES\.PLAYING/);
  assert.match(source, /WHACK_A_MOLE_PHASES\.PAUSED/);
  assert.match(source, /WHACK_A_MOLE_PHASES\.RESULT/);
  assert.match(source, /Ripple\. Reveal\. React\./);
  assert.match(source, /Round recap/);
});

test("normal, gold, and decoy targets are visually and verbally distinct", () => {
  assert.match(source, /Garden mole/);
  assert.match(source, /Gold mole/);
  assert.match(source, /Red decoy/);
  assert.match(source, /Whack it/);
  assert.match(source, /Chase it/);
  assert.match(source, /Leave it/);
  assert.match(source, /wamx-target--normal/);
  assert.match(source, /wamx-target--gold/);
  assert.match(source, /wamx-target--decoy/);
  assert.match(source, /wamx-target--telegraph/);
});

test("every hole is a native button with equal pointer and number-key input", () => {
  assert.match(
    source,
    /Array\.from\([\s\S]*?experience\.config\.holeCount/,
  );
  assert.match(source, /<button[\s\S]*?type="button"/);
  assert.match(source, /onClick=\{\(\) => hitHole\(holeIndex, "pointer"\)\}/);
  assert.match(source, /aria-keyshortcuts=\{String\(holeIndex \+ 1\)\}/);
  assert.match(source, /Number\.parseInt\(event\.key, 10\) - 1/);
  assert.match(source, /hitHole\(holeIndex, "keyboard"\)/);
  assert.match(source, /Tap a hole or press its number/);
});

test("target changes and the final result use one atomic live status", () => {
  assert.match(
    source,
    /aria-live=\{resultVisible \? "assertive" : "polite"\}/,
  );
  assert.match(
    source,
    /role=\{resultVisible \? "alert" : "status"\}/,
  );
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /\{experience\.announcement\}/);
  assert.match(source, /aria-label=\{holeLabel\}/);
});

test("focus follows play, pause, and result transitions", () => {
  assert.match(source, /holeButtonRefs\.current\[0\]\?\.focus\(\)/);
  assert.match(source, /resumeButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /resultHeadingRef\.current\?\.focus\(\)/);
  assert.match(source, /ref=\{resultHeadingRef\} tabIndex=\{-1\}/);
  assert.match(source, /ref=\{resumeButtonRef\}/);
});

test("pause and resume hooks freeze both setup and active rounds", () => {
  assert.match(source, /type: WHACK_A_MOLE_ACTIONS\.PAUSE/);
  assert.match(source, /type: WHACK_A_MOLE_ACTIONS\.RESUME/);
  assert.match(source, /The clock and current target will continue exactly/);
  assert.match(source, /Restart round/);
});

test("the component has a controlled reducer boundary and a camera input contract", () => {
  assert.match(source, /state: controlledState/);
  assert.match(source, /onAction/);
  assert.match(source, /reduceWhackAMoleGame\(previous, action\)/);
  assert.match(source, /source: "camera"/);
  assert.match(source, /type: WHACK_A_MOLE_ACTIONS\.HIT_HOLE/);
  assert.match(source, /onComplete\?\.\(experience\.result \?\? summary\)/);
});

test("daily play resolves a stable seed while rematches preserve the board", () => {
  assert.match(source, /createDailyWhackAMoleSeed/);
  assert.match(source, /dailyChallengeId/);
  assert.match(source, /seed: resolvedSeed/);
  assert.match(source, /Play same board again/);
  assert.match(source, /Same seed means the same target pattern/);
});

test("styling is component-scoped, responsive, and safe for reduced motion", () => {
  assert.match(source, /const WHACK_A_MOLE_STYLES = `/);
  assert.match(source, /\.wamx \{/);
  assert.match(source, /@media \(max-width: 880px\)/);
  assert.match(source, /@media \(max-width: 620px\)/);
  assert.match(source, /@media \(max-height: 720px\)/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /:root\[data-reduced-motion="true"\]/);
  assert.match(source, /animation: none !important/);
  assert.match(source, /touch-action: manipulation/);
});
