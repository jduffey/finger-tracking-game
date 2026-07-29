import test from "node:test";
import assert from "node:assert/strict";

import {
  completeWfcWorldNow,
  createWfcWorldGame,
  getWfcWorldCellCenter,
  getWfcWorldGrid,
  selectWfcWorldTile,
  startWfcWorldCollapse,
  stepWfcWorldGame,
} from "../src/wfc/wfcWorldGame.js";
import {
  WFC_WORLD_EXPORT_KIND,
  WFC_WORLD_LIBRARY_KIND,
  WFC_WORLD_PERSISTENCE_LIMITS,
  WFC_WORLD_PERSISTENCE_STATUS,
  WFC_WORLD_SCHEMA_VERSION,
  WFC_WORLD_SNAPSHOT_KIND,
  createEmptyWfcWorldLibrary,
  createWfcWorldSnapshot,
  exportWfcWorldSnapshotJSON,
  exportWfcWorldSnapshotText,
  importWfcWorldSnapshotJSON,
  parseWfcWorldLibraryJSON,
  removeWfcWorldSnapshot,
  restoreWfcWorldSnapshot,
  reviseWfcWorldSnapshot,
  serializeWfcWorldLibrary,
  upsertWfcWorldSnapshot,
  validateWfcWorldLibrary,
  validateWfcWorldSnapshot,
} from "../src/wfc/wfcWorldPersistence.js";
import { isWfcGridValid } from "../src/wfc/wfcSolver.js";
import { WFC_WORLD_BLANK_TEMPLATE_ID } from "../src/wfc/wfcWorldTemplates.js";

const CREATED_AT = "2026-07-28T12:00:00.000Z";
const UPDATED_AT = "2026-07-28T12:15:00.000Z";

function constantRng(value) {
  return () => value;
}

function createSeededWorld() {
  const game = selectWfcWorldTile(
    createWfcWorldGame(1280, 720, {
      seed: "castle-coast-314",
      templateId: "highland-keep",
    }),
    "castle",
  );
  const center = getWfcWorldCellCenter(game.layout, 2, 2);
  return stepWfcWorldGame(
    game,
    1 / 60,
    {
      pointerActive: true,
      pointerX: center.x,
      pointerY: center.y,
      pinchActive: true,
    },
    constantRng(0.5),
  );
}

function createCompleteWorld() {
  return completeWfcWorldNow(
    startWfcWorldCollapse(createSeededWorld()),
    constantRng(0.37),
  );
}

function snapshotOptions(overrides = {}) {
  return {
    name: "Castle Coast",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

test("snapshot creation is named, versioned, stable, and deterministic", () => {
  const game = createCompleteWorld();
  const first = createWfcWorldSnapshot(game, snapshotOptions());
  const second = createWfcWorldSnapshot(game, snapshotOptions());

  assert.equal(first.ok, true);
  assert.equal(first.status, WFC_WORLD_PERSISTENCE_STATUS.CREATED);
  assert.deepEqual(second.snapshot, first.snapshot);
  assert.equal(first.snapshot.kind, WFC_WORLD_SNAPSHOT_KIND);
  assert.equal(first.snapshot.version, WFC_WORLD_SCHEMA_VERSION);
  assert.match(first.snapshot.id, /^world-[a-f0-9]{8}$/);
  assert.equal(first.snapshot.name, "Castle Coast");
  assert.equal(first.snapshot.revision, 1);
  assert.equal(first.snapshot.state, "complete");
  assert.equal(first.snapshot.world.seed, "castle-coast-314");
  assert.equal(first.snapshot.world.templateId, "highland-keep");
  assert.deepEqual(first.snapshot.world.grid, getWfcWorldGrid(game));

  const firstExport = exportWfcWorldSnapshotJSON(first.snapshot, {
    exportedAt: UPDATED_AT,
  });
  const secondExport = exportWfcWorldSnapshotJSON(second.snapshot, {
    exportedAt: UPDATED_AT,
  });
  assert.equal(firstExport.json, secondExport.json);
  assert.equal(JSON.parse(firstExport.json).kind, WFC_WORLD_EXPORT_KIND);
});

test("draft snapshots restore authored rules without pretending generation finished", () => {
  const game = createSeededWorld();
  const created = createWfcWorldSnapshot(game, snapshotOptions({
    name: "Castle Draft",
  }));
  const restored = restoreWfcWorldSnapshot(created.snapshot, {
    width: 640,
    height: 360,
  });

  assert.equal(created.snapshot.state, "draft");
  assert.equal(created.snapshot.world.grid, null);
  assert.equal(restored.ok, true);
  assert.equal(restored.status, WFC_WORLD_PERSISTENCE_STATUS.RESTORED);
  assert.equal(restored.game.phase, "seeding");
  assert.equal(restored.game.layout.width, 640);
  assert.equal(restored.game.snapshot.name, "Castle Draft");
  assert.equal(restored.game.seed, "castle-coast-314");
  assert.equal(restored.game.templateId, "highland-keep");
  assert.deepEqual(restored.game.constraints, created.snapshot.world.constraints);
  assert.match(restored.game.message, /add rules or generate/i);
});

test("complete snapshot JSON round-trips the exact valid world", () => {
  const created = createWfcWorldSnapshot(
    createCompleteWorld(),
    snapshotOptions(),
  );
  const exported = exportWfcWorldSnapshotJSON(created.snapshot, {
    exportedAt: UPDATED_AT,
  });
  const imported = importWfcWorldSnapshotJSON(exported.json);
  const restored = restoreWfcWorldSnapshot(imported.snapshot);

  assert.equal(exported.ok, true);
  assert.ok(exported.byteLength <= WFC_WORLD_PERSISTENCE_LIMITS.maxSnapshotBytes);
  assert.equal(imported.status, WFC_WORLD_PERSISTENCE_STATUS.IMPORTED);
  assert.deepEqual(imported.snapshot, created.snapshot);
  assert.deepEqual(
    getWfcWorldGrid(restored.game),
    created.snapshot.world.grid,
  );
  assert.equal(isWfcGridValid(getWfcWorldGrid(restored.game)), true);
  assert.equal(restored.game.phase, "complete");
});

test("snapshot revisions preserve identity and creation time", () => {
  const draft = createWfcWorldSnapshot(
    createSeededWorld(),
    snapshotOptions(),
  );
  const revised = reviseWfcWorldSnapshot(
    draft.snapshot,
    createCompleteWorld(),
    {
      name: "Castle Coast Complete",
      updatedAt: UPDATED_AT,
    },
  );

  assert.equal(revised.ok, true);
  assert.equal(revised.status, WFC_WORLD_PERSISTENCE_STATUS.REVISED);
  assert.equal(revised.snapshot.id, draft.snapshot.id);
  assert.equal(revised.snapshot.revision, 2);
  assert.equal(revised.snapshot.createdAt, CREATED_AT);
  assert.equal(revised.snapshot.updatedAt, UPDATED_AT);
  assert.equal(revised.snapshot.name, "Castle Coast Complete");
  assert.equal(revised.snapshot.state, "complete");
});

test("safe validation rejects malformed, contradictory, mismatched, and future snapshots", () => {
  const created = createWfcWorldSnapshot(
    createCompleteWorld(),
    snapshotOptions(),
  ).snapshot;
  const future = validateWfcWorldSnapshot({
    ...created,
    version: WFC_WORLD_SCHEMA_VERSION + 1,
  });
  const mismatchedGrid = structuredClone(created);
  mismatchedGrid.world.grid[2][2] = "water";
  const contradictory = {
    ...created,
    state: "draft",
    world: {
      ...created.world,
      grid: null,
      constraints: [
        { col: 0, row: 0, tileId: "water" },
        { col: 1, row: 0, tileId: "castle" },
      ],
    },
  };
  const invalidSeed = structuredClone(created);
  invalidSeed.world.seed = "x".repeat(
    WFC_WORLD_PERSISTENCE_LIMITS.maxSeedLength + 1,
  );
  const invalidTemplate = structuredClone(created);
  invalidTemplate.world.templateId = "missing-starter";

  assert.equal(future.status, WFC_WORLD_PERSISTENCE_STATUS.UNSUPPORTED);
  assert.equal(validateWfcWorldSnapshot(mismatchedGrid).ok, false);
  assert.match(
    validateWfcWorldSnapshot(mismatchedGrid).errors.join(" "),
    /terrain rules|does not match/i,
  );
  assert.equal(validateWfcWorldSnapshot(contradictory).ok, false);
  assert.match(
    validateWfcWorldSnapshot(contradictory).errors.join(" "),
    /contradict/i,
  );
  assert.match(
    validateWfcWorldSnapshot(invalidSeed).errors.join(" "),
    /seed/i,
  );
  assert.match(
    validateWfcWorldSnapshot(invalidTemplate).errors.join(" "),
    /starter template/i,
  );
  assert.equal(importWfcWorldSnapshotJSON("{").ok, false);
  assert.equal(
    importWfcWorldSnapshotJSON(
      "x".repeat(WFC_WORLD_PERSISTENCE_LIMITS.maxImportBytes + 1),
    ).status,
    WFC_WORLD_PERSISTENCE_STATUS.TOO_LARGE,
  );
});

test("plain-text exports provide a compact, shareable world summary", () => {
  const created = createWfcWorldSnapshot(
    createCompleteWorld(),
    snapshotOptions(),
  );
  const exported = exportWfcWorldSnapshotText(created.snapshot);

  assert.equal(exported.ok, true);
  assert.match(exported.text, /^Fingerprint Worlds — Castle Coast/m);
  assert.match(exported.text, /Complete world · Revision 1/);
  assert.match(exported.text, /Starter: Highland keep/);
  assert.match(exported.text, /Seed: castle-coast-314/);
  assert.match(exported.text, /Quality: .+ \(\d+\/100\)/);
  assert.match(exported.text, /terrain types/);
  assert.match(exported.text, new RegExp(created.snapshot.id));
});

test("legacy version-one snapshots and libraries migrate without losing worlds", () => {
  const current = createWfcWorldSnapshot(
    createCompleteWorld(),
    snapshotOptions(),
  ).snapshot;
  const legacy = structuredClone(current);
  legacy.version = 1;
  delete legacy.world.seed;
  delete legacy.world.templateId;

  const firstValidation = validateWfcWorldSnapshot(legacy);
  const secondValidation = validateWfcWorldSnapshot(legacy);
  const legacyLibrary = {
    kind: WFC_WORLD_LIBRARY_KIND,
    version: 1,
    revision: 4,
    snapshots: [legacy],
  };
  const migratedLibrary = validateWfcWorldLibrary(legacyLibrary);
  const restored = restoreWfcWorldSnapshot(firstValidation.snapshot);
  const imported = importWfcWorldSnapshotJSON(
    JSON.stringify({
      kind: WFC_WORLD_EXPORT_KIND,
      version: 1,
      exportedAt: UPDATED_AT,
      snapshot: legacy,
    }),
  );

  assert.equal(firstValidation.ok, true);
  assert.deepEqual(firstValidation.snapshot, secondValidation.snapshot);
  assert.equal(firstValidation.snapshot.version, WFC_WORLD_SCHEMA_VERSION);
  assert.match(firstValidation.snapshot.world.seed, /^legacy-[a-f0-9]{8}$/);
  assert.equal(
    firstValidation.snapshot.world.templateId,
    WFC_WORLD_BLANK_TEMPLATE_ID,
  );
  assert.deepEqual(firstValidation.snapshot.world.grid, current.world.grid);
  assert.equal(migratedLibrary.ok, true);
  assert.equal(migratedLibrary.library.version, WFC_WORLD_SCHEMA_VERSION);
  assert.equal(migratedLibrary.library.revision, 4);
  assert.equal(restored.game.seed, firstValidation.snapshot.world.seed);
  assert.deepEqual(getWfcWorldGrid(restored.game), current.world.grid);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.snapshot, firstValidation.snapshot);
});

test("the pure local library saves revisions, prevents stale overwrites, and serializes", () => {
  const draft = createWfcWorldSnapshot(
    createSeededWorld(),
    snapshotOptions(),
  ).snapshot;
  const complete = reviseWfcWorldSnapshot(
    draft,
    createCompleteWorld(),
    { updatedAt: UPDATED_AT },
  ).snapshot;

  const initial = createEmptyWfcWorldLibrary();
  const savedDraft = upsertWfcWorldSnapshot(initial, draft);
  const savedComplete = upsertWfcWorldSnapshot(savedDraft.library, complete);
  const stale = upsertWfcWorldSnapshot(savedComplete.library, draft);
  const serialized = serializeWfcWorldLibrary(savedComplete.library);
  const parsed = parseWfcWorldLibraryJSON(serialized.json);

  assert.equal(initial.kind, WFC_WORLD_LIBRARY_KIND);
  assert.equal(savedDraft.status, WFC_WORLD_PERSISTENCE_STATUS.SAVED);
  assert.equal(savedDraft.library.revision, 1);
  assert.equal(savedComplete.library.revision, 2);
  assert.equal(savedComplete.library.snapshots.length, 1);
  assert.equal(savedComplete.library.snapshots[0].revision, 2);
  assert.equal(stale.status, WFC_WORLD_PERSISTENCE_STATUS.STALE_REVISION);
  assert.equal(serialized.ok, true);
  assert.ok(serialized.byteLength <= WFC_WORLD_PERSISTENCE_LIMITS.maxLibraryBytes);
  assert.equal(parsed.status, WFC_WORLD_PERSISTENCE_STATUS.IMPORTED);
  assert.deepEqual(parsed.library, savedComplete.library);

  const removed = removeWfcWorldSnapshot(
    parsed.library,
    complete.id,
  );
  assert.equal(removed.status, WFC_WORLD_PERSISTENCE_STATUS.REMOVED);
  assert.deepEqual(removed.library.snapshots, []);
  assert.equal(validateWfcWorldLibrary(removed.library).ok, true);
});

test("bare snapshots remain importable with an explicit compatibility warning", () => {
  const snapshot = createWfcWorldSnapshot(
    createSeededWorld(),
    snapshotOptions(),
  ).snapshot;
  const imported = importWfcWorldSnapshotJSON(JSON.stringify(snapshot));

  assert.equal(imported.ok, true);
  assert.equal(imported.warnings.length, 1);
  assert.match(imported.warnings[0], /bare snapshot/i);
});
