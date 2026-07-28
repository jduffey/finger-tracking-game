import test from "node:test";
import assert from "node:assert/strict";
import {
  JAM_LOOP_FORMAT,
  JAM_LOOP_MAX_DURATION_MS,
  JAM_LOOP_SCHEMA_VERSION,
  JAM_LOOP_STORAGE_KEY,
  clearSavedJamLoop,
  createJamLoop,
  exportJamLoopJson,
  getJamLoopSummary,
  loadSavedJamLoop,
  normalizeJamLoop,
  saveJamLoop,
} from "../src/circleOfFifthsLoops.js";

function createMemoryStorage(initialValue = null) {
  let storedValue = initialValue;
  return {
    getItem(key) {
      assert.equal(key, JAM_LOOP_STORAGE_KEY);
      return storedValue;
    },
    setItem(key, value) {
      assert.equal(key, JAM_LOOP_STORAGE_KEY);
      storedValue = value;
    },
    removeItem(key) {
      assert.equal(key, JAM_LOOP_STORAGE_KEY);
      storedValue = null;
    },
    inspect() {
      return storedValue;
    },
  };
}

test("normalizeJamLoop keeps supported events ordered and bounded", () => {
  const loop = normalizeJamLoop(
    {
      id: "  loop-one  ",
      name: "  First take  ",
      durationMs: JAM_LOOP_MAX_DURATION_MS + 5000,
      bpm: 999,
      beatId: "shuffle",
      events: [
        { type: "drum-hit", atMs: 900, instrument: "snare" },
        { type: "unknown", atMs: 200 },
        { type: "chord-on", atMs: 100, segmentId: "outer-C-major" },
        { type: "drum-hit", atMs: 300, instrument: "cowbell" },
        { type: "chord-off", atMs: 700 },
      ],
      createdAt: 1000,
      updatedAt: 1100,
    },
    { now: 1200 },
  );

  assert.equal(loop.id, "loop-one");
  assert.equal(loop.name, "First take");
  assert.equal(loop.durationMs, JAM_LOOP_MAX_DURATION_MS);
  assert.equal(loop.bpm, 160);
  assert.deepEqual(loop.events, [
    { type: "chord-on", atMs: 100, segmentId: "outer-C-major" },
    { type: "chord-off", atMs: 700 },
    { type: "drum-hit", atMs: 900, instrument: "snare" },
  ]);
});

test("createJamLoop and summary describe recorded chord and drum material", () => {
  const loop = createJamLoop(
    {
      name: "Pocket",
      durationMs: 2500,
      events: [
        { type: "chord-on", atMs: 0, segmentId: "inner-A-minor" },
        { type: "drum-hit", atMs: 500, instrument: "kick" },
        { type: "drum-hit", atMs: 1000, instrument: "hat" },
        { type: "chord-off", atMs: 2000 },
      ],
    },
    { now: 5000 },
  );

  assert.equal(loop.createdAt, 5000);
  assert.equal(loop.updatedAt, 5000);
  assert.deepEqual(getJamLoopSummary(loop), {
    eventCount: 4,
    chordCount: 1,
    drumHitCount: 2,
    durationMs: 2500,
    durationLabel: "2.5 sec",
  });
});

test("saved jam loops round-trip through the versioned local document", () => {
  const storage = createMemoryStorage();
  const loop = createJamLoop(
    {
      name: "Night idea",
      durationMs: 1800,
      beatId: "night-drive",
      bpm: 96,
      events: [{ type: "drum-hit", atMs: 420, instrument: "kick" }],
    },
    { now: 1000 },
  );

  const saved = saveJamLoop(loop, storage, { now: 1500 });
  const loaded = loadSavedJamLoop(storage);
  const document = JSON.parse(storage.inspect());

  assert.equal(saved.ok, true);
  assert.equal(saved.status, "saved");
  assert.equal(saved.loop.updatedAt, 1500);
  assert.equal(document.format, JAM_LOOP_FORMAT);
  assert.equal(document.schemaVersion, JAM_LOOP_SCHEMA_VERSION);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.loop, saved.loop);
});

test("loading rejects corrupt and unsupported saved loop documents", () => {
  const corrupt = loadSavedJamLoop(createMemoryStorage("{not json"));
  const unsupported = loadSavedJamLoop(
    createMemoryStorage(
      JSON.stringify({
        format: JAM_LOOP_FORMAT,
        schemaVersion: JAM_LOOP_SCHEMA_VERSION + 1,
        loop: {},
      }),
    ),
  );

  assert.equal(corrupt.status, "error");
  assert.equal(corrupt.loop, null);
  assert.equal(unsupported.status, "invalid");
  assert.equal(unsupported.loop, null);
});

test("JSON export is portable, named, and contains exact sequencer events", () => {
  const exported = exportJamLoopJson(
    createJamLoop(
      {
        name: "C / G Sketch",
        durationMs: 1000,
        events: [
          { type: "chord-on", atMs: 20, segmentId: "outer-C-major" },
          { type: "chord-off", atMs: 800 },
        ],
      },
      { now: 1000 },
    ),
  );
  const parsed = JSON.parse(exported.json);

  assert.equal(exported.filename, "c-g-sketch.jam-loop.json");
  assert.equal(parsed.format, JAM_LOOP_FORMAT);
  assert.equal(parsed.schemaVersion, JAM_LOOP_SCHEMA_VERSION);
  assert.deepEqual(parsed.loop.events, [
    { type: "chord-on", atMs: 20, segmentId: "outer-C-major" },
    { type: "chord-off", atMs: 800 },
  ]);
});

test("clearSavedJamLoop removes the local save slot", () => {
  const storage = createMemoryStorage("{}");

  assert.deepEqual(clearSavedJamLoop(storage), {
    ok: true,
    status: "cleared",
  });
  assert.equal(storage.inspect(), null);
  assert.equal(loadSavedJamLoop(storage).status, "empty");
});
