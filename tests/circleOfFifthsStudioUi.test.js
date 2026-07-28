import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Jam Studio exposes native, accessible sound and groove controls", () => {
  const page = readSource("src/CircleOfFifthsPage.jsx");
  const styles = readSource("src/circleOfFifthsPage.css");

  assert.match(page, />Timbre<\/span>[\s\S]*?<select/);
  assert.match(page, />Arpeggio<\/span>[\s\S]*?<select/);
  assert.match(page, />Key<\/span>[\s\S]*?<select/);
  assert.match(page, />Scale<\/span>[\s\S]*?<select/);
  assert.match(page, /aria-pressed=\{keyLockEnabled\}/);
  assert.match(page, /aria-label="Chord progression presets"/);
  assert.match(page, /aria-current=\{isNext \? "step" : undefined\}/);
  assert.match(page, /\{drumsPlaying \? "Pause groove" : "Start groove"\}/);
  assert.match(page, /aria-label="Drum mutes"/);
  assert.match(page, /aria-label=\{`Drum mix volume, \$\{drumVolume\} percent`\}/);

  assert.match(styles, /\.circle-fifths-select-grid select \{[\s\S]*?min-height: 44px;/);
  assert.match(styles, /\.circle-fifths-mute-buttons button \{[\s\S]*?min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?circle-fifths-drum-mix/);
});

test("sound and drum controls feed the Web Audio scheduling path", () => {
  const page = readSource("src/CircleOfFifthsPage.jsx");

  assert.match(page, /syncContinuousChord\([\s\S]*?timbreId:[\s\S]*?arpeggioMode:/);
  assert.match(page, /getJamArpeggioStepDurationMs\(soundOptions\.bpm, arpeggio\.id\)/);
  assert.match(page, /getDrumMixOptions: \(\) => \(\{/);
  assert.match(page, /getJamDrumMixScale\(instrument, volumePercent, mutedInstruments\)/);
});

test("Jam Studio keeps the wheel primary and collapses ready setup into a reopenable status", () => {
  const page = readSource("src/CircleOfFifthsPage.jsx");
  const styles = readSource("src/circleOfFifthsPage.css");

  assert.match(page, /const \[setupExpanded, setSetupExpanded\] = useState\(true\)/);
  assert.match(
    page,
    /setSessionState\("active"\);[\s\S]*?setSetupExpanded\(false\);/,
  );
  assert.match(page, /data-collapsed=\{setupCollapsed\}/);
  assert.match(page, /className="circle-fifths-session-summary"/);
  assert.match(page, /aria-controls="circle-fifths-setup-content"/);
  assert.match(page, /<summary>Tracking details<\/summary>/);
  assert.match(page, /ref=\{wheelRef\}/);
  assert.match(page, /getWheelPointFromClientPoint\(/);

  assert.match(
    styles,
    /grid-template-areas:\s*"back wheel chord"\s*"setup wheel controls";/,
  );
  assert.match(
    styles,
    /\.circle-fifths-page \.circle-fifths-wheel \{[\s\S]*?aspect-ratio: 1;[\s\S]*?position: relative;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 1080px\)[\s\S]*?body \{[\s\S]*?overflow-y: auto;[\s\S]*?\.circle-fifths-page,[\s\S]*?height: auto;[\s\S]*?overflow: visible;/,
  );
  assert.match(
    styles,
    /\.circle-fifths-panel-bottom-right\[data-mobile-open="true"\] \{[\s\S]*?display: block;/,
  );
});
