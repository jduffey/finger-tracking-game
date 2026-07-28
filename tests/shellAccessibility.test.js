import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("the product shell keeps setup and settings available to mobile and assistive users", () => {
  const home = readSource("src/components/ProductHome.jsx");
  const homeStyles = readSource("src/productHome.css");

  assert.match(home, /aria-label="Open settings"/);
  assert.match(home, /aria-controls="experience-list"/);
  assert.match(home, /role="list"/);
  assert.match(homeStyles, /@media \(max-width: 980px\)[\s\S]*?\.product-home \{[\s\S]*?overflow: visible;/);
  assert.doesNotMatch(
    homeStyles,
    /\.product-home-icon-button\s*\{[^}]*display:\s*none;/,
  );
});

test("tracking setup uses valid progress markup and a single mobile scroller", () => {
  const setup = readSource("src/components/TrackingSetup.jsx");
  const setupStyles = readSource("src/trackingSetup.css");

  assert.doesNotMatch(setup, /tracking-setup-progress-fill/);
  assert.match(setup, /aria-busy=\{loading\}/);
  assert.match(setup, /aria-label="Live mirrored camera preview"/);
  assert.match(
    setupStyles,
    /@media \(max-width: 980px\)[\s\S]*?\.tracking-setup-page \{[\s\S]*?overflow: visible;/,
  );
  assert.match(
    setupStyles,
    /@media \(min-width: 901px\) and \(max-height: 800px\)[\s\S]*?grid-template-columns:/,
  );
});

test("settings labels controls and confirms destructive local-data deletion", () => {
  const settings = readSource("src/components/SettingsPanel.jsx");
  const settingsStyles = readSource("src/settingsPanel.css");

  assert.match(settings, /controlId="dominant-hand"/);
  assert.match(settings, /href="\/privacy\.html"/);
  assert.match(settings, /Yes, delete local data/);
  assert.match(
    settingsStyles,
    /@media \(max-width: 980px\)[\s\S]*?\.settings-page \{[\s\S]*?overflow: visible;/,
  );
});

test("Circle of Fifths exposes keyboard controls and non-overlapping mobile panels", () => {
  const page = readSource("src/CircleOfFifthsPage.jsx");
  const pageStyles = readSource("src/circleOfFifthsPage.css");
  const bootstrap = readSource("src/circleOfFifthsMain.jsx");

  assert.match(page, /type="range"/);
  assert.match(page, /aria-pressed=\{isActive\}/);
  assert.match(page, /onKeyDown=\{\(event\) =>/);
  assert.match(page, /aria-controls="circle-fifths-setup-panel"/);
  assert.match(
    pageStyles,
    /\.circle-fifths-panel-left\[data-mobile-open="true"\],[\s\S]*?display: block;/,
  );
  assert.match(bootstrap, /import "\.\/circleOfFifthsPage\.css";/);
});
