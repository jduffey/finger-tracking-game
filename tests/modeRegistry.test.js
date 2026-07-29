import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  APP_PHASES,
  MODE_MATURITY,
  MODE_REGISTRY,
  PLAY_FALLBACK_KINDS,
  PLAY_PERSISTENCE_KINDS,
  PLAY_RELEASE_BAR,
  PLAY_START_KINDS,
  PRODUCT_AREAS,
  TRACKING_PROFILES,
  getFeaturedModes,
  getModeByFullscreenId,
  getModeById,
  getModeByPhase,
  getModeByPath,
  getModesByPhase,
  isPlayReleaseCandidate,
  listModes,
  validateModeRegistry,
} from "../src/modeRegistry.js";

test("mode registry is internally valid and immutable", () => {
  assert.deepEqual(validateModeRegistry(), []);
  assert.equal(Object.isFrozen(MODE_REGISTRY), true);
  assert.ok(MODE_REGISTRY.length >= 25);
  assert.ok(MODE_REGISTRY.every((mode) => Object.isFrozen(mode)));
  assert.ok(
    MODE_REGISTRY.filter((mode) => mode.releaseCapabilities).every((mode) =>
      Object.isFrozen(mode.releaseCapabilities),
    ),
  );
});

test("mode registry defines one coherent Play, Create, Labs, and Setup taxonomy", () => {
  const areas = new Set(MODE_REGISTRY.map((mode) => mode.area));

  assert.deepEqual(
    [...areas].sort(),
    [
      PRODUCT_AREAS.CREATE,
      PRODUCT_AREAS.LABS,
      PRODUCT_AREAS.PLAY,
      PRODUCT_AREAS.SETUP,
    ].sort(),
  );
  assert.ok(listModes({ area: PRODUCT_AREAS.PLAY }).length >= 10);
  assert.ok(listModes({ area: PRODUCT_AREAS.CREATE }).length >= 4);
  assert.ok(listModes({ area: PRODUCT_AREAS.LABS }).length >= 8);
});

test("public experiences explicitly declare honest seated-play support", () => {
  const publicModes = MODE_REGISTRY.filter(
    (mode) =>
      !mode.hiddenFromLibrary &&
      mode.maturity !== MODE_MATURITY.INTERNAL,
  );

  assert.ok(publicModes.every((mode) => typeof mode.seatedFriendly === "boolean"));
  assert.equal(getModeById("sky-patrol").seatedFriendly, true);
  assert.equal(getModeById("jam-studio").seatedFriendly, true);
  assert.equal(getModeById("pose-quest").seatedFriendly, false);
});

test("featured library is curated and excludes internal experiments", () => {
  const featured = getFeaturedModes();

  assert.ok(featured.length >= 6);
  assert.ok(featured.length <= 9);
  assert.ok(featured.every((mode) => mode.maturity !== MODE_MATURITY.INTERNAL));
  assert.ok(featured.some((mode) => mode.id === "sky-patrol"));
  assert.ok(featured.some((mode) => mode.id === "gesture-art"));
  assert.ok(featured.some((mode) => mode.id === "jam-studio"));
});

test("fullscreen variants resolve to their consolidated library experience", () => {
  assert.equal(getModeByFullscreenId("sky-patrol")?.id, "sky-patrol");
  assert.equal(getModeByFullscreenId("fruit-ninja")?.id, "slice-air");
  assert.equal(getModeByFullscreenId("square")?.id, "visualizer");
  assert.equal(getModeByFullscreenId("tip-ripples")?.id, "visualizer");
  assert.equal(getModeByFullscreenId("find-your-grind-breakout")?.id, "breakout");
  assert.equal(getModeByFullscreenId("missing"), null);
});

test("player-facing capability claims match the experiences that exist", () => {
  const twoHandBreakout = getModeById("breakout-coop");
  assert.equal(twoHandBreakout.label, "Two-Hand Breakout");
  assert.equal(twoHandBreakout.trackingProfile, "two-hands");
  assert.equal(twoHandBreakout.players, 1);

  const ticTacToe = getModeById("tic-tac-toe");
  assert.equal(ticTacToe.players, 1);
  assert.equal(ticTacToe.difficulty, "Medium");
  assert.doesNotMatch(ticTacToe.objective, /another player|best-of/i);

  const visualizer = getModeById("visualizer");
  assert.equal(visualizer.maturity, MODE_MATURITY.SUPPORTED);
  assert.equal(visualizer.featured, true);
  assert.match(visualizer.objective, /export|artwork/i);
  assert.deepEqual(visualizer.variants, [
    "square",
    "hex",
    "voronoi",
    "rings",
    "pulse",
    "tip-ripples",
    "static",
  ]);

  for (const trackingOnlyLabId of [
    "track-runner",
    "star-flight",
    "conveyor-toss",
    "pinch-sandbox",
  ]) {
    assert.equal(
      getModeById(trackingOnlyLabId).supportsPointerFallback,
      false,
    );
  }
  const probabilityTable = getModeById("probability-table");
  assert.equal(probabilityTable.trackingProfile, "none");
  assert.equal(probabilityTable.supportsPointerFallback, true);

  const forest = getModeById("forest-discovery");
  assert.match(forest.summary, /three|guardian/i);
  assert.equal(forest.supportsPointerFallback, true);
});

test("mode registry supports stable ids and paths", () => {
  assert.equal(getModeById("tracking-setup")?.phase, APP_PHASES.TRACKING_SETUP);
  assert.equal(getModeByPath("/create/jam-studio")?.href, "/circle-of-fifths.html");
  assert.equal(getModeByPhase(APP_PHASES.RUNNER)?.id, "track-runner");
  assert.ok(getModesByPhase(APP_PHASES.FULLSCREEN_CAMERA).length > 10);
  assert.equal(getModeById("missing"), null);
  assert.equal(getModeByPath("/missing"), null);
});

test("supported Play modes meet one explicit lifecycle and persistence bar", () => {
  const releaseModes = MODE_REGISTRY.filter(isPlayReleaseCandidate);

  assert.ok(releaseModes.length >= 14);
  assert.ok(
    releaseModes.every(
      (mode) =>
        mode.objective &&
        PLAY_RELEASE_BAR.startKinds.includes(mode.releaseCapabilities.start) &&
        PLAY_RELEASE_BAR.requiredBooleanCapabilities.every(
          (capability) => mode.releaseCapabilities[capability] === true,
        ) &&
        mode.releaseCapabilities.fallback === PLAY_FALLBACK_KINDS.POINTER &&
        PLAY_RELEASE_BAR.persistenceKinds.includes(
          mode.releaseCapabilities.persistence,
        ) &&
        mode.supportsPointerFallback === true &&
        mode.supportsPause === true &&
        mode.supportsResults === true,
    ),
  );
  assert.equal(
    getModeById("arcade-run").releaseCapabilities.start,
    PLAY_START_KINDS.EXPLICIT,
  );
  assert.equal(
    getModeById("arcade-run").releaseCapabilities.persistence,
    PLAY_PERSISTENCE_KINDS.RESUMABLE_RUN,
  );
  assert.equal(
    getModeById("sky-patrol").releaseCapabilities.start,
    PLAY_START_KINDS.AUTOMATIC,
  );
  assert.equal(
    getModeById("whack-a-mole").releaseCapabilities.persistence,
    PLAY_PERSISTENCE_KINDS.PROGRESSION,
  );
});

test("Labs can remain below the Play release bar while declaring honest inputs", () => {
  const publicLabs = listModes({ area: PRODUCT_AREAS.LABS }).filter(
    (mode) => mode.maturity !== MODE_MATURITY.INTERNAL,
  );

  assert.ok(
    publicLabs.every(
      (mode) => typeof mode.supportsPointerFallback === "boolean",
    ),
  );
  assert.ok(
    publicLabs.some(
      (mode) => mode.maturity === MODE_MATURITY.EXPERIMENTAL,
    ),
  );
  assert.ok(publicLabs.every((mode) => !isPlayReleaseCandidate(mode)));
});

test("registry validation reports route, schema, and release-bar failures", () => {
  const first = createValidLabMode({
    id: "duplicate",
    path: "/duplicate",
    fullscreenMode: "same",
  });
  const second = createValidLabMode({
    id: "duplicate",
    label: "Second",
    path: "/duplicate",
    fullscreenMode: "same",
  });
  const invalidMetadata = createValidLabMode({
    id: "invalid-metadata",
    path: "/invalid-metadata",
    maturity: "beta",
    trackingProfile: "magic",
    players: 0,
    typicalMinutes: 0,
  });
  const incomplete = { id: "", path: "/incomplete" };
  const errors = validateModeRegistry([
    first,
    second,
    invalidMetadata,
    incomplete,
  ]);

  assert.ok(errors.includes("Duplicate mode id: duplicate"));
  assert.ok(errors.includes("Duplicate mode path: /duplicate"));
  assert.ok(errors.includes("Duplicate fullscreen mode: same"));
  assert.ok(
    errors.includes("Mode invalid-metadata has an invalid maturity: beta"),
  );
  assert.ok(
    errors.includes(
      "Mode invalid-metadata has an invalid tracking profile: magic",
    ),
  );
  assert.ok(
    errors.includes(
      "Library mode invalid-metadata must declare a positive player count.",
    ),
  );
  assert.ok(
    errors.includes(
      "Library mode invalid-metadata must declare a positive duration.",
    ),
  );
  assert.ok(
    errors.some((error) =>
      error.startsWith("Mode <unknown> is missing required metadata:"),
    ),
  );
});

test("registry validation rejects unsupported Play capability claims", () => {
  const errors = validateModeRegistry([
    {
      ...createValidLabMode({
        id: "unfinished-play",
        path: "/play/unfinished-play",
      }),
      area: PRODUCT_AREAS.PLAY,
      maturity: MODE_MATURITY.SUPPORTED,
      objective: "",
      supportsPause: false,
      supportsPointerFallback: false,
      supportsResults: false,
      releaseCapabilities: {
        start: "sometimes",
        pause: false,
        results: false,
        retry: false,
        home: false,
        fallback: "gesture-only",
        persistence: "none",
      },
    },
  ]);

  for (const fragment of [
    "must declare an objective",
    "valid start capability",
    "must support pause",
    "must support results",
    "must support retry",
    "must support home",
    "must declare a valid fallback",
    "must declare valid persistence",
    "must expose pointer fallback",
    "must expose pause support",
    "must expose result support",
  ]) {
    assert.ok(
      errors.some((error) => error.includes(fragment)),
      `Expected release validation error containing "${fragment}"`,
    );
  }
});

test("the command-line registry validator executes successfully", () => {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(
    process.execPath,
    ["scripts/validate-mode-registry.js"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mode registry valid:/);
  assert.match(result.stdout, /Play release modes meet the capability bar/);
});

function createValidLabMode(overrides = {}) {
  return {
    id: "valid-lab",
    label: "Valid Lab",
    path: "/labs/valid-lab",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "A bounded validation fixture.",
    phase: APP_PHASES.SANDBOX,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Point to explore",
    typicalMinutes: 2,
    players: 1,
    seatedFriendly: true,
    supportsPointerFallback: false,
    ...overrides,
  };
}
