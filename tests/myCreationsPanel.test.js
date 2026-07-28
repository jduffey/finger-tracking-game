import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const panelSource = readSource("src/components/MyCreationsPanel.jsx");
const panelStyles = readSource("src/components/MyCreationsPanel.css");

test("Home lazy-loads an accessible My Creations dialog and restores focus", () => {
  const homeSource = readSource("src/components/ProductHome.jsx");
  const launcherSource = readSource(
    "src/components/MyCreationsLauncher.jsx",
  );

  assert.match(
    homeSource,
    /import\("\.\/MyCreationsLauncher\.jsx"\)/,
  );
  assert.match(homeSource, /<Suspense/);
  assert.match(homeSource, /<MyCreationsLauncher onSelectMode=\{onSelectMode\}/);
  assert.match(
    launcherSource,
    /lazy\(\(\) => import\("\.\/MyCreationsPanel\.jsx"\)\)/,
  );
  assert.match(launcherSource, /aria-label="Open My Creations"/);
  assert.match(launcherSource, /aria-haspopup="dialog"/);
  assert.match(launcherSource, /aria-expanded=\{open\}/);
  assert.match(launcherSource, /buttonRef\.current\?\.focus\(\)/);
  assert.match(launcherSource, /onOpenMode=\{openMode\}/);
});

test("the unified shelf reads both durable stores and labels their local-only limits", () => {
  assert.match(panelSource, /createCreativeGalleryStore/);
  assert.match(panelSource, /readMyCreationLibraries/);
  assert.match(panelSource, /worldLibrary\.snapshots/);
  assert.match(panelSource, /modeId === "gesture-art"/);
  assert.match(panelSource, /My Creations/);
  assert.match(panelSource, /Local only/);
  assert.match(panelSource, /saved work stays in this browser/i);
  assert.match(panelSource, /Some saved creation metadata could not be read/);
  assert.match(panelSource, /Your creative shelf is ready/);
  assert.match(panelSource, /No creations match/);
});

test("safe item actions cover open, rename, guarded delete, and real exports", () => {
  assert.match(panelSource, /Open World Painter/);
  assert.match(panelSource, /Open Light Painting/);
  assert.match(panelSource, /galleryStoreRef\.current\.rename/);
  assert.match(panelSource, /renameWorldCreation/);
  assert.match(panelSource, /galleryStoreRef\.current\.delete/);
  assert.match(panelSource, /removeWfcWorldSnapshot/);
  assert.match(panelSource, /Confirm delete/);
  assert.match(panelSource, /deleteCreativeAsset/);
  assert.match(panelSource, /readCreativeAsset/);
  assert.match(panelSource, /exportWfcWorldSnapshotJSON/);
  assert.match(panelSource, /fingerprint-world\.json/);
  assert.match(panelSource, /Image content is not available in this browser/);
});

test("Light Painting deletion persists metadata before clearing its image asset", () => {
  const metadataDeleteIndex = panelSource.indexOf(
    "galleryStoreRef.current.delete(item.sourceId)",
  );
  const assetDeleteIndex = panelSource.indexOf(
    "assetCleared = await deleteCreativeAsset(reference)",
  );

  assert.ok(metadataDeleteIndex >= 0);
  assert.ok(assetDeleteIndex > metadataDeleteIndex);
  assert.match(panelSource, /if \(\s*persisted &&\s*reference/);
  assert.match(panelSource, /its saved image was left intact/);
});

test("dialog keyboard behavior, status feedback, and touch targets are explicit", () => {
  assert.match(panelSource, /aria-modal="true"/);
  assert.match(panelSource, /role="dialog"/);
  assert.match(panelSource, /event\.key === "Escape"/);
  assert.match(panelSource, /event\.key !== "Tab"/);
  assert.match(panelSource, /event\.shiftKey/);
  assert.match(panelSource, /aria-live="polite"/);
  assert.match(panelSource, /aria-atomic="true"/);
  assert.match(panelSource, /aria-pressed=\{activeFilter === filter\.id\}/);
  assert.match(panelSource, /autoFocus/);
  assert.match(panelStyles, /min-block-size: 44px/);
});

test("component styling stays scoped, compact, responsive, and motion-safe", () => {
  assert.match(panelStyles, /^\.my-creations-backdrop \{/m);
  assert.match(panelStyles, /^\.my-creations-dialog \{/m);
  assert.doesNotMatch(panelStyles, /^button[\s:{.#>]/m);
  assert.match(panelStyles, /max-block-size: min\(90dvh, 48rem\)/);
  assert.match(panelStyles, /scrollbar-gutter: stable/);
  assert.match(panelStyles, /@media \(max-width: 820px\)/);
  assert.match(panelStyles, /@media \(max-width: 560px\)/);
  assert.match(panelStyles, /@media \(max-height: 720px\)/);
  assert.match(panelStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(panelStyles, /:root\[data-reduced-motion="true"\]/);
  assert.match(panelStyles, /:root\[data-high-contrast="true"\]/);
});
