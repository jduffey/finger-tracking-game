import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("returning players get a compact action-first home while first visits keep the welcome", () => {
  const source = readSource("src/components/ProductHome.jsx");

  assert.match(source, /isReturningUser \? \(/);
  assert.match(source, /className="product-home-hero is-returning"/);
  assert.match(source, /Welcome back/);
  assert.match(source, /Start an Arcade Run/);
  assert.match(source, />Continue</);
  assert.match(source, />Daily challenge</);
  assert.match(source, /recommendationModes\.map/);
  assert.match(source, /Webcam-powered play/);
  assert.match(source, /Move, play, and make something surprising\./);
});

test("the compact desktop variant is explicitly tuned for a 720px-tall viewport", () => {
  const styles = readSource("src/productHome.css");

  assert.match(
    styles,
    /\.product-home-hero\.is-returning\s*\{[\s\S]*?min-height:\s*0;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1161px\) and \(max-height: 800px\)[\s\S]*?\.product-home-main\.is-returning[\s\S]*?padding-top:\s*24px;/,
  );
  assert.match(
    styles,
    /\.product-returning-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
  );
});

test("Quick Play chooses on click and remembers its last in-session pick", () => {
  const source = readSource("src/components/ProductHome.jsx");

  assert.match(source, /const lastQuickPlayModeIdRef = useRef\(null\);/);
  assert.match(
    source,
    /function launchQuickPlay\(\)[\s\S]*?selectQuickPlayMode\(\{[\s\S]*?excludedModeIds: \[lastQuickPlayModeIdRef\.current\],[\s\S]*?randomValue: Math\.random\(\),/,
  );
  assert.match(
    source,
    /lastQuickPlayModeIdRef\.current = quickPlayMode\.id;[\s\S]*?onSelectMode\(quickPlayMode\);/,
  );
  assert.doesNotMatch(
    source,
    /useMemo\(\s*\(\) => selectQuickPlayMode/,
  );
});

test("the library exposes difficulty and seated-friendly browse controls", () => {
  const source = readSource("src/components/ProductHome.jsx");

  assert.match(source, /<span>Difficulty<\/span>/);
  assert.match(source, /label: "Any difficulty"/);
  assert.match(source, /difficulty: difficultyFilter/);
  assert.match(source, /<span>Play position<\/span>/);
  assert.match(source, />Seated-friendly</);
  assert.match(source, /seatedOnly,/);
  assert.match(source, /setDifficultyFilter\("all"\)/);
  assert.match(source, /setSeatedOnly\(false\)/);
});

test("the library exposes accessible Favorites and Recent views with useful empty states", () => {
  const source = readSource("src/components/ProductHome.jsx");
  const styles = readSource("src/productHome.css");

  assert.match(source, /LIBRARY_COLLECTION_FILTERS/);
  assert.match(source, /selectLibraryCollectionModes\(libraryModes,/);
  assert.match(source, /aria-label="Choose a library view"/);
  assert.match(source, /aria-pressed=\{libraryCollection === filter\.id\}/);
  assert.match(source, /aria-controls="experience-list"/);
  assert.match(source, /No favorites yet\./);
  assert.match(source, /No recent experiences yet\./);
  assert.match(source, /Play, Create, or Labs/);
  assert.match(source, /Browse all experiences/);
  assert.match(source, /aria-live="polite"[\s\S]*?experiences"} shown/);

  assert.match(
    styles,
    /\.product-library-collections \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*?\.product-library-collections \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
  );
});
