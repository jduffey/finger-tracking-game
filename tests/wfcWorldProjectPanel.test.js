import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const componentSource = readFileSync(
  new URL("../src/wfc/WfcWorldProjectPanel.jsx", import.meta.url),
  "utf8",
);
const styleSource = readFileSync(
  new URL("../src/wfc/WfcWorldProjectPanel.css", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../src/App.jsx", import.meta.url),
  "utf8",
);

test("project panel supports controlled state or an internal local library", () => {
  assert.match(componentSource, /library: controlledLibrary/);
  assert.match(componentSource, /const isControlled = controlledLibrary !== undefined/);
  assert.match(componentSource, /validateWfcWorldLibrary\(controlledLibrary\)/);
  assert.match(componentSource, /window\.localStorage/);
  assert.match(componentSource, /WFC_WORLD_LIBRARY_STORAGE_KEY/);
  assert.match(componentSource, /parseWfcWorldLibraryJSON/);
  assert.match(componentSource, /serializeWfcWorldLibrary/);
  assert.match(componentSource, /onLibraryChange\?\.\(nextLibrary, event\)/);
  assert.match(componentSource, /Browser storage was unavailable/);
});

test("named saves create explicit revisions and allow intentional branches", () => {
  assert.match(componentSource, /<span>World name<\/span>/);
  assert.match(componentSource, /maxLength="64"/);
  assert.match(componentSource, /createWfcWorldSnapshot/);
  assert.match(componentSource, /reviseWfcWorldSnapshot/);
  assert.match(componentSource, /upsertWfcWorldSnapshot/);
  assert.match(componentSource, /Save revision/);
  assert.match(componentSource, /Save project/);
  assert.match(componentSource, /Save as new/);
  assert.match(componentSource, /getUniqueSnapshotId/);
  assert.match(componentSource, /onSave\?\.\(saved\.snapshot, saved\.library\)/);
});

test("the local library exposes browse, restore, export, share, and guarded delete actions", () => {
  assert.match(componentSource, /<h3 id=\{`\$\{headingId\}-library`\}>Saved worlds<\/h3>/);
  assert.match(componentSource, /library\.snapshots\.map/);
  assert.match(componentSource, /aria-pressed=\{selected\}/);
  assert.match(componentSource, /Restore selected/);
  assert.match(componentSource, /restoreWfcWorldSnapshot/);
  assert.match(componentSource, /onRestore\?\.\(restored\.game, restored\.snapshot\)/);
  assert.match(componentSource, /Export JSON/);
  assert.match(componentSource, /Copy summary/);
  assert.match(componentSource, /Confirm delete/);
  assert.match(componentSource, /removeWfcWorldSnapshot/);
  assert.match(componentSource, /onDelete\?\.\(selectedSnapshot, removed\.library\)/);
});

test("JSON import and export stay usable when optional browser APIs are absent", () => {
  assert.match(componentSource, /exportWfcWorldSnapshotJSON/);
  assert.match(componentSource, /importWfcWorldSnapshotJSON/);
  assert.match(componentSource, /accept="\.json,application\/json"/);
  assert.match(componentSource, /await file\.text\(\)/);
  assert.match(componentSource, /Validate and import/);
  assert.match(componentSource, /onImport\?\.\(imported\.snapshot, saved\.library\)/);
  assert.match(componentSource, /downloadTextFile/);
  assert.match(componentSource, /navigator\.clipboard\?\.writeText/);
  assert.match(componentSource, /readOnly/);
  assert.match(componentSource, /World summary is ready to copy below/);
  assert.match(componentSource, /format: "json"/);
  assert.match(componentSource, /format: "text"/);
});

test("finite goal and quality models are exposed as accessible progress and metrics", () => {
  assert.match(componentSource, /getWfcWorldGoalModel\(game\)/);
  assert.match(componentSource, /getWfcWorldQualitySummary\(game\)/);
  assert.match(componentSource, /<progress/);
  assert.match(componentSource, /aria-label="World creation progress"/);
  assert.match(componentSource, /aria-label="World goal milestones"/);
  assert.match(componentSource, /quality\.tierLabel/);
  assert.match(componentSource, /Terrain types/);
  assert.match(componentSource, /Landmarks/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /aria-atomic="true"/);
  assert.match(componentSource, /role="status"/);
});

test("generator setup exposes user-visible seeds and meaningful starters", () => {
  assert.match(componentSource, /Reproducible setup/);
  assert.match(componentSource, /<span>World seed<\/span>/);
  assert.match(componentSource, /maxLength="48"/);
  assert.match(componentSource, /WFC_WORLD_STARTER_TEMPLATES\.map/);
  assert.match(componentSource, /Starter template/);
  assert.match(componentSource, /selectedStarterTemplate\.description/);
  assert.match(componentSource, /Start from template/);
  assert.match(componentSource, /Apply seed to current rules/);
  assert.match(componentSource, /Surprise me/);
  assert.match(componentSource, /applyWfcWorldTemplate/);
  assert.match(componentSource, /setWfcWorldSeed/);
  assert.match(componentSource, /createWfcWorldSeed/);
  assert.match(componentSource, /onWorldChange\(nextGame, event\)/);
  assert.match(componentSource, /onRestore\?\.\(nextGame, null\)/);
  assert.match(
    appSource,
    /onWorldChange=\{handleFullscreenWfcWorldChange\}/,
  );
  assert.match(styleSource, /\.wfc-project-generator-fields/);
  assert.match(styleSource, /\.wfc-project-seed-value/);
});

test("component styling is scoped, compact, responsive, and reduced-motion safe", () => {
  assert.match(styleSource, /^\.wfc-project \{/m);
  assert.doesNotMatch(styleSource, /^button[\s:{.#>]/m);
  assert.match(styleSource, /max-block-size: min\(90dvh, 54rem\)/);
  assert.match(styleSource, /scrollbar-gutter: stable/);
  assert.match(styleSource, /min-block-size: 2\.7rem/);
  assert.match(styleSource, /touch-action: manipulation/);
  assert.match(styleSource, /@media \(max-width: 900px\)/);
  assert.match(styleSource, /@media \(max-width: 560px\)/);
  assert.match(styleSource, /@media \(max-height: 720px\)/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styleSource, /:root\[data-reduced-motion="true"\]/);
  assert.match(styleSource, /transition: none !important/);
});
