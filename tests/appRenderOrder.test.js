import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App computes the fullscreen camera viewport before Tic Tac Toe cursor geometry", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const viewportIndex = source.indexOf("const fullscreenCameraViewport = useMemo");
  const ticTacToeCursorIndex = source.indexOf("const fullscreenTicTacToeCursorPoint =");

  assert.ok(viewportIndex >= 0);
  assert.ok(ticTacToeCursorIndex >= 0);
  assert.ok(
    viewportIndex < ticTacToeCursorIndex,
    "Tic Tac Toe cursor point must not read fullscreenCameraViewport before the hook initializes it",
  );
});

test("fullscreen camera HUD keeps detection status at bottom left without the mode title chip", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.equal(source.includes('<span className="fullscreen-camera-chip">{cameraPanelTitle}</span>'), false);

  const bottomRowIndex = source.indexOf('className="fullscreen-camera-hud-bottom"');
  const statusIndex = source.indexOf('className={`tracking-indicator fullscreen-camera-status');
  const actionsIndex = source.indexOf('className="fullscreen-camera-meta fullscreen-camera-actions"');

  assert.ok(bottomRowIndex >= 0);
  assert.ok(statusIndex > bottomRowIndex);
  assert.ok(actionsIndex > statusIndex);
});

test("App starts in fullscreen camera mode", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const phaseInitializer = source.match(/const \[phase, setPhase\] = useState\([^)]+\);/)?.[0];

  assert.equal(phaseInitializer, "const [phase, setPhase] = useState(PHASES.FULLSCREEN_CAMERA);");
});

test("Find Your Grind breakout uses the browser viewport for its playfield", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const fullscreenBreakoutViewport =\s*fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID\s*\?\s*fullscreenBrowserViewport\s*:\s*fullscreenCameraViewport;/,
  );
  assert.match(
    source,
    /createFindYourGrindBreakoutGame\(\s*fullscreenBreakoutViewport\.width,\s*fullscreenBreakoutViewport\.height,\s*\)/,
  );
  assert.match(source, /style=\{fullscreenBreakoutViewport\?\.style \?\? undefined\}/);
});

test("fullscreen body skeleton uses a separate SVG layer instead of the camera overlay canvas", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const skeletonMarkupIndex = source.indexOf('className="fullscreen-body-skeleton-overlay"');
  const skeletonMarkup = source.slice(skeletonMarkupIndex, skeletonMarkupIndex + 2600);
  const drawFullscreenIndex = source.indexOf("function drawFullscreenOverlay");

  assert.ok(skeletonMarkupIndex >= 0);
  assert.equal(skeletonMarkup.includes("overlayCanvasRef"), false);
  assert.ok(drawFullscreenIndex >= 0);
  assert.equal(
    source.slice(drawFullscreenIndex, source.indexOf("function getVerifiedFullscreenHoldControlInput", drawFullscreenIndex))
      .includes("fullscreenBodySkeleton"),
    false,
  );
  assert.match(styles, /\.fullscreen-body-skeleton-overlay\s*\{/);
  assert.match(styles, /z-index:\s*4;/);
});

test("fullscreen body pose sidecar starts after Voronoi fingertip state updates", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const fullscreenBlockIndex = source.indexOf("const overlayPoints = drawFullscreenOverlay(stableHands)");
  const setIndexPointsIndex = source.indexOf("setFullscreenIndexPoints(overlayPoints.indexPoints)", fullscreenBlockIndex);
  const setTipPointsIndex = source.indexOf("setFullscreenTipPoints(overlayPoints.tipPoints)", fullscreenBlockIndex);
  const scheduleIndex = source.indexOf("scheduleFullscreenBodyPoseDetection", fullscreenBlockIndex);
  const awaitIndex = source.indexOf("await detectPoses", fullscreenBlockIndex);

  assert.ok(fullscreenBlockIndex >= 0);
  assert.ok(setIndexPointsIndex > fullscreenBlockIndex);
  assert.ok(setTipPointsIndex > setIndexPointsIndex);
  assert.ok(scheduleIndex > setTipPointsIndex);
  assert.equal(awaitIndex, -1);
});
