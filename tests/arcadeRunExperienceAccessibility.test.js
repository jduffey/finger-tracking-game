import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const componentUrl = new URL(
  "../src/components/ArcadeRunExperience.jsx",
  import.meta.url,
);
const stylesUrl = new URL(
  "../src/components/ArcadeRunExperience.css",
  import.meta.url,
);
const appUrl = new URL("../src/App.jsx", import.meta.url);
const [source, styles, appSource] = await Promise.all([
  readFile(componentUrl, "utf8"),
  readFile(stylesUrl, "utf8"),
  readFile(appUrl, "utf8"),
]);

test("the standalone JSX compiles through the production JSX transformer", async () => {
  const transformed = await transformWithEsbuild(source, componentUrl.pathname, {
    loader: "jsx",
    jsx: "automatic",
  });

  assert.match(transformed.code, /function ArcadeRunExperience/);
  assert.ok(transformed.code.length > 20_000);
});

test("the builder offers explicit 3, 5, and 10 minute and daily choices", () => {
  assert.match(source, /ARCADE_RUN_DURATIONS\.QUICK/);
  assert.match(source, /ARCADE_RUN_DURATIONS\.MIX/);
  assert.match(source, /ARCADE_RUN_DURATIONS\.CIRCUIT/);
  assert.match(source, /Arcade Mix/);
  assert.match(source, /Daily Run/);
  assert.match(source, /Daily route locked/);
  assert.match(source, /Shuffle route/);
  assert.match(source, /<PlaylistPreview plan=\{plan\}/);
});

test("the component exposes correlated launch and result boundaries", () => {
  assert.match(source, /onLaunchMode/);
  assert.match(source, /createArcadeRunLaunchRequest/);
  assert.match(source, /incomingLegResult/);
  assert.match(source, /matchesArcadeRunResultEnvelope/);
  assert.match(source, /completeArcadeRunLeg/);
  assert.match(source, /onLegResultConsumed/);
  assert.match(source, /modeId/);
  assert.match(source, /legId/);
  assert.match(source, /runId/);
});

test("App routes runs, saves sessions synchronously, and returns game results", () => {
  assert.match(appSource, /phase === PHASES\.ARCADE_RUN/);
  assert.match(appSource, /<ArcadeRunExperience/);
  assert.match(appSource, /handleArcadeRunSessionChange/);
  assert.match(appSource, /JSON\.stringify\(session\)/);
  assert.match(appSource, /handleArcadeRunLaunch/);
  assert.match(appSource, /arcadeRunRequest: request/);
  assert.match(appSource, /createArcadeRunResultEnvelope/);
  assert.match(appSource, /returnToArcadeRun/);
  assert.match(appSource, /returningLegRequest/);
  assert.match(appSource, /createArcadeRunProgressionResult/);
  assert.match(appSource, /Continue Arcade Run/);
});

test("run controls expose pause, resume, skip, retry, and continue transitions", () => {
  assert.match(source, /pauseArcadeRun/);
  assert.match(source, /resumeArcadeRun/);
  assert.match(source, /skipArcadeRunLeg/);
  assert.match(source, /retryArcadeRunLeg/);
  assert.match(source, /advanceArcadeRun/);
  assert.match(source, /Pause run/);
  assert.match(source, /Resume game/);
  assert.match(source, /Skip this game/);
  assert.match(source, /Retry last game/);
  assert.match(source, /See run results/);
});

test("resume persistence is injectable and failure remains non-blocking", () => {
  assert.match(source, /resumeSnapshot/);
  assert.match(source, /loadResumeSnapshot/);
  assert.match(source, /storageKey = ARCADE_RUN_STORAGE_KEY/);
  assert.match(source, /serializeArcadeRunSession/);
  assert.match(source, /onPersistSession/);
  assert.match(source, /onClearPersistedSession/);
  assert.match(source, /continuing in memory/);
  assert.match(source, /Progress saved/);
});

test("native semantics and one atomic live status make the flow accessible", () => {
  assert.match(source, /<fieldset className="arx-duration-picker">/);
  assert.match(source, /type="radio"/);
  assert.match(source, /aria-pressed=\{runKind === "daily"\}/);
  assert.match(source, /<progress/);
  assert.match(source, /aria-label="Arcade Run progress"/);
  assert.match(source, /aria-current=/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /aria-live=/);
  assert.match(source, /role=/);
  assert.match(source, /statusHeadingRef\.current\?\.focus\(\)/);
  assert.match(source, /tabIndex=\{-1\}/);
});

test("the final view presents aggregate score, medal case, leg breakdown, and actions", () => {
  assert.match(source, /Total score/);
  assert.match(source, /Medal case/);
  assert.match(source, /Game breakdown/);
  assert.match(source, /summary\.medalCounts/);
  assert.match(source, /Play another run/);
  assert.match(source, /Back to Home/);
  assert.match(source, /onRunComplete/);
});

test("colocated styling is scoped, responsive, compact-height aware, and motion-safe", () => {
  assert.match(styles, /^\.arx \{/m);
  assert.doesNotMatch(styles, /^(html|body|button|input)\s*\{/m);
  assert.match(styles, /@media \(max-width: 940px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(max-height: 720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:root\[data-reduced-motion="true"\]/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /min-height: 44px/);
});
