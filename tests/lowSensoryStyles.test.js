import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const styles = readSource("src/styles.css");
const overlayStyles = readSource("src/experienceOverlay.css");
const artStyles = readSource("src/gestureArtStudio.css");
const musicStyles = readSource("src/circleOfFifthsPage.css");

test("low-sensory preference has a document-level style contract", () => {
  const preferences = readSource("src/userPreferences.js");

  assert.match(
    preferences,
    /root\.dataset\.lowSensory\s*=\s*normalized\.lowSensory\s*\?\s*"true"\s*:\s*"false"/,
  );
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\]\s+\.fullscreen-camera-video\s*\{[^}]*filter:\s*saturate\(0\.68\)/s,
  );
});

test("low-sensory fullscreen styles remove decorative persistence but preserve control cues", () => {
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\]\s+\.tracked-cursor-trail,[\s\S]*?\.fullscreen-camera-fruit-particle,[\s\S]*?\.fullscreen-camera-missile-structure-smoke,[\s\S]*?\.fullscreen-camera-missile-explosion-shockwave,[\s\S]*?\{[^}]*display:\s*none/s,
  );
  assert.match(
    styles,
    /\.fullscreen-camera-ring-group:nth-last-child\(n \+ 5\)\s*\{[^}]*display:\s*none/s,
  );
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\]\s+\.fullscreen-camera-fruit-blade-segment\s*\{[^}]*filter:\s*opacity\(0\.42\)/s,
  );
  assert.doesNotMatch(
    styles,
    /data-low-sensory="true"[^{]*\.fullscreen-camera-missile-trail[^{]*\{[^}]*display:\s*none/s,
  );
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\]\s+\.fullscreen-camera-missile-trail\.hostile\.critical\s*\{[^}]*background:\s*#e65f61/s,
  );
});

test("low-sensory fullscreen styles replace flashes with static state cues", () => {
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\][\s\S]*?\.fullscreen-camera-tic-tac-toe-mark\.ai-placed,[\s\S]*?\.fullscreen-camera-invaders-ship\.invulnerable,[\s\S]*?\.fullscreen-camera-wfc-cell\.changed,[\s\S]*?\{[^}]*animation:\s*none/s,
  );
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\]\s+\.fullscreen-camera-invaders-ship\.invulnerable\s*\{[^}]*opacity:\s*0\.58/s,
  );
  assert.match(
    styles,
    /:root\[data-low-sensory="true"\][\s\S]*?\.fullscreen-camera-brick-dodger-lane-signal,[\s\S]*?\{[^}]*transition:\s*none/s,
  );
});

test("shared overlays and creative modes honor low-sensory without hiding core output", () => {
  assert.match(
    overlayStyles,
    /:root\[data-low-sensory="true"\]\s+\.experience-overlay-dialog,[\s\S]*?\.experience-overlay-countdown > strong\s*\{[^}]*animation:\s*none/s,
  );
  assert.match(
    artStyles,
    /html\[data-low-sensory="true"\]\s+\.gesture-art-tools\s*\{[^}]*transition:\s*none/s,
  );
  assert.doesNotMatch(
    artStyles,
    /data-low-sensory="true"[^{]*\.gesture-art-canvas\s*\{[^}]*display:\s*none/s,
  );
  assert.match(
    musicStyles,
    /:root\[data-low-sensory="true"\][\s\S]*?\.circle-fifths-finger-glow\s*\{[^}]*display:\s*none/s,
  );
  assert.match(
    musicStyles,
    /:root\[data-low-sensory="true"\]\s+\.circle-fifths-page\s+\.circle-fifths-video\s*\{[^}]*filter:\s*saturate\(0\.62\)/s,
  );
});
