import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATIVE_GALLERY_EXPORT_KIND,
  CREATIVE_GALLERY_LIMITS,
  CREATIVE_GALLERY_SCHEMA_VERSION,
  CREATIVE_GALLERY_STATUS,
  CREATIVE_GALLERY_STORAGE_KEY,
  createCreativeGalleryStore,
  createEmptyCreativeGallery,
  exportCreativeGalleryJSON,
  importCreativeGalleryJSON,
  migrateCreativeGallery,
  readCreativeGallery,
  sanitizeCreativeGalleryEntry,
  writeCreativeGallery,
} from "../src/creativeGallery.js";

const NOW = "2026-07-28T12:00:00.000Z";

function createStorage(initialValue = null) {
  const entries = new Map();
  if (initialValue !== null) {
    entries.set(CREATIVE_GALLERY_STORAGE_KEY, initialValue);
  }
  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    },
    entries,
  };
}

function makeEntry(overrides = {}) {
  return {
    id: "art-1",
    modeId: "gesture-art",
    title: "Neon Loops",
    description: "A bright motion sketch.",
    createdAt: NOW,
    updatedAt: NOW,
    tags: ["neon", "loops"],
    metadata: {
      tool: "ribbon",
      strokeCount: 42,
    },
    thumbnail: {
      kind: "palette",
      width: 640,
      height: 360,
      palette: ["#ff00aa", "#00ddff"],
    },
    dataRef: {
      kind: "indexeddb",
      key: "gesture-art/art-1",
      mediaType: "application/json",
      byteLength: 2048,
      checksum: "sha256:0123456789abcdef",
    },
    ...overrides,
  };
}

function exportManifest(entries, overrides = {}) {
  return JSON.stringify({
    kind: CREATIVE_GALLERY_EXPORT_KIND,
    version: CREATIVE_GALLERY_SCHEMA_VERSION,
    exportedAt: NOW,
    contentIncluded: false,
    entryCount: entries.length,
    entries,
    ...overrides,
  });
}

test("entry sanitization keeps bounded metadata and rejects embedded or remote data", () => {
  const metadata = {
    useful: "  a   useful value  ",
    nested: { payload: true },
    __proto__: "ignored",
  };
  for (let index = 0; index < 40; index += 1) {
    metadata[`field_${index}`] = index;
  }
  const result = sanitizeCreativeGalleryEntry(
    makeEntry({
      title: "  Neon\u0000   Loops  ",
      tags: ["Neon", "neon", "", "one", "two", "three", "four", "five", "six", "seven"],
      metadata,
      thumbnail: {
        kind: "palette",
        palette: [
          "#ABC",
          "#abc",
          "red",
          "#123456",
          "#abcdef",
          "#12345678",
          "#fff",
          "#000",
          "#111",
          "#222",
          "#333",
        ],
        dataUrl: "data:image/png;base64,not-allowed",
      },
      dataRef: {
        kind: "indexeddb",
        key: "https://example.com/steal",
      },
    }),
    { now: NOW },
  );

  assert.equal(result.ok, false);
  assert.equal(result.entry.title, "Neon Loops");
  assert.equal(result.entry.dataRef, null);
  assert.equal("dataUrl" in result.entry.thumbnail, false);
  assert.equal(result.entry.tags.length, CREATIVE_GALLERY_LIMITS.maxTags);
  assert.ok(
    Object.keys(result.entry.metadata).length <=
      CREATIVE_GALLERY_LIMITS.maxMetadataFields,
  );
  assert.equal("nested" in result.entry.metadata, false);
  assert.ok(result.errors.includes("data-reference-invalid"));
});

test("valid references are metadata-only and normalize optional fields", () => {
  const result = sanitizeCreativeGalleryEntry(makeEntry(), { now: NOW });

  assert.equal(result.ok, true);
  assert.deepEqual(result.entry.dataRef, {
    kind: "indexeddb",
    key: "gesture-art/art-1",
    mediaType: "application/json",
    byteLength: 2048,
    checksum: "sha256:0123456789abcdef",
  });
  assert.deepEqual(result.entry.thumbnail, {
    kind: "palette",
    width: 640,
    height: 360,
    palette: ["#ff00aa", "#00ddff"],
    dataRef: null,
  });
  assert.equal(JSON.stringify(result.entry).includes("base64"), false);
});

test("read distinguishes empty, unavailable, malformed, oversized, and loaded storage", () => {
  assert.equal(
    readCreativeGallery(createStorage(), { now: NOW }).status,
    CREATIVE_GALLERY_STATUS.EMPTY,
  );
  assert.equal(
    readCreativeGallery(null, { now: NOW }).status,
    CREATIVE_GALLERY_STATUS.UNAVAILABLE,
  );
  assert.equal(
    readCreativeGallery(createStorage("{"), { now: NOW }).status,
    CREATIVE_GALLERY_STATUS.INVALID,
  );
  assert.equal(
    readCreativeGallery(
      createStorage("x".repeat(CREATIVE_GALLERY_LIMITS.maxStorageBytes + 1)),
      { now: NOW },
    ).status,
    CREATIVE_GALLERY_STATUS.TOO_LARGE,
  );

  const gallery = {
    ...createEmptyCreativeGallery({ now: NOW }),
    entries: [makeEntry()],
  };
  const storage = createStorage();
  assert.equal(
    writeCreativeGallery(gallery, storage, { now: NOW }).status,
    CREATIVE_GALLERY_STATUS.SAVED,
  );
  const loaded = readCreativeGallery(storage, { now: NOW });
  assert.equal(loaded.status, CREATIVE_GALLERY_STATUS.LOADED);
  assert.equal(loaded.gallery.entries[0].title, "Neon Loops");
});

test("legacy manifests migrate and salvage good records without trusting bad ones", () => {
  const LEGACY_SAVED_AT = "2026-07-20T09:30:00.000Z";
  const legacy = {
    version: 1,
    revision: 3,
    items: [
      {
        id: "old-jam",
        type: "jam-studio",
        name: "  First   Jam ",
        savedAt: LEGACY_SAVED_AT,
        tags: ["groove"],
        previewRef: "indexeddb:thumbnails/old-jam",
        contentRef: "opfs:jams/old-jam.json",
      },
      {
        id: "bad-mode",
        type: "prototype",
        name: "Must not survive",
      },
      {
        type: "world-painter",
        name: "Recovered world",
        savedAt: NOW,
      },
    ],
  };
  const storage = createStorage(JSON.stringify(legacy));
  const read = readCreativeGallery(storage, {
    now: NOW,
    idFactory: ({ index }) => `recovered-${index}`,
  });

  assert.equal(read.status, CREATIVE_GALLERY_STATUS.RECOVERED);
  assert.equal(read.migrated, true);
  assert.equal(read.gallery.version, CREATIVE_GALLERY_SCHEMA_VERSION);
  assert.equal(read.gallery.entries.length, 2);
  assert.equal(
    read.gallery.entries.find((entry) => entry.id === "old-jam").title,
    "First Jam",
  );
  assert.equal(
    read.gallery.entries.find((entry) => entry.id === "old-jam").createdAt,
    LEGACY_SAVED_AT,
  );
  assert.deepEqual(
    read.gallery.entries.find((entry) => entry.id === "old-jam").dataRef,
    { kind: "opfs", key: "jams/old-jam.json" },
  );
  assert.ok(
    read.gallery.entries.some((entry) => entry.id === "recovered-2"),
  );
});

test("duplicate IDs are recovered and future-version storage remains unsupported", () => {
  const duplicateGallery = {
    version: CREATIVE_GALLERY_SCHEMA_VERSION,
    entries: [
      makeEntry(),
      makeEntry({ modeId: "visualizer", title: "Second" }),
    ],
  };
  const normalized = migrateCreativeGallery(duplicateGallery, { now: NOW });
  assert.equal(normalized.entries.length, 2);
  assert.equal(new Set(normalized.entries.map((entry) => entry.id)).size, 2);

  const future = readCreativeGallery(
    createStorage(
      JSON.stringify({
        version: CREATIVE_GALLERY_SCHEMA_VERSION + 1,
        entries: [],
      }),
    ),
    { now: NOW },
  );
  assert.equal(future.status, CREATIVE_GALLERY_STATUS.UNSUPPORTED);
  assert.equal(future.storedVersion, CREATIVE_GALLERY_SCHEMA_VERSION + 1);

  assert.equal(
    readCreativeGallery(
      createStorage(JSON.stringify({ version: "999", entries: [] })),
      { now: NOW },
    ).status,
    CREATIVE_GALLERY_STATUS.INVALID,
  );
});

test("direct writes never persist a silently partial recovery", () => {
  const original = JSON.stringify({
    version: CREATIVE_GALLERY_SCHEMA_VERSION,
    revision: 1,
    updatedAt: NOW,
    entries: [makeEntry({ id: "original" })],
  });
  const storage = createStorage(original);
  const write = writeCreativeGallery(
    {
      version: CREATIVE_GALLERY_SCHEMA_VERSION,
      revision: 2,
      updatedAt: NOW,
      entries: [
        makeEntry({ id: "valid-but-partial" }),
        makeEntry({ id: "invalid", modeId: "not-a-creative-mode" }),
      ],
    },
    storage,
    { now: NOW },
  );

  assert.equal(write.status, CREATIVE_GALLERY_STATUS.VALIDATION_FAILED);
  assert.equal(
    storage.entries.get(CREATIVE_GALLERY_STORAGE_KEY),
    original,
  );

  const exported = exportCreativeGalleryJSON(
    {
      version: CREATIVE_GALLERY_SCHEMA_VERSION,
      revision: 2,
      updatedAt: NOW,
      entries: [
        makeEntry({ id: "valid-but-partial" }),
        makeEntry({ id: "invalid", modeId: "not-a-creative-mode" }),
      ],
    },
    { now: NOW },
  );
  assert.equal(exported.ok, false);
  assert.equal(
    exported.status,
    CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
  );
  assert.equal(exported.json, null);
});

test("store supports save, filtered list, rename, delete, and defensive snapshots", () => {
  const storage = createStorage();
  let counter = 0;
  const events = [];
  const store = createCreativeGalleryStore({
    storage,
    now: () => NOW,
    idFactory: () => `generated-${++counter}`,
  });
  store.subscribe((_gallery, event) => events.push(event.type));
  store.subscribe(() => {
    throw new Error("UI listener failed");
  });

  const art = store.save({
    modeId: "gesture-art",
    title: "  Blue   Ribbons ",
    tags: ["blue", "calm"],
    metadata: { strokeCount: 8 },
  });
  const visualizer = store.save({
    modeId: "visualizer",
    title: "Pulse Bloom",
    tags: ["blue", "pulse"],
  });

  assert.equal(art.ok, true);
  assert.equal(visualizer.ok, true);
  assert.equal(store.list({ modeId: "gesture-art" }).length, 1);
  assert.deepEqual(
    store.list({ query: "ribbons", tags: ["blue"] }).map((entry) => entry.title),
    ["Blue Ribbons"],
  );

  const snapshot = store.getState();
  snapshot.entries.length = 0;
  assert.equal(store.getState().entries.length, 2);

  const renamed = store.rename(art.entry.id, "Azure Trails");
  assert.equal(renamed.status, CREATIVE_GALLERY_STATUS.RENAMED);
  assert.equal(store.list({ sort: "title-asc" })[0].title, "Azure Trails");
  assert.equal(
    store.rename(art.entry.id, "   ").status,
    CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
  );
  assert.equal(
    store.delete("missing").status,
    CREATIVE_GALLERY_STATUS.NOT_FOUND,
  );
  assert.equal(
    store.delete(visualizer.entry.id).status,
    CREATIVE_GALLERY_STATUS.DELETED,
  );
  assert.deepEqual(events, [
    "entry-saved",
    "entry-saved",
    "entry-renamed",
    "entry-deleted",
  ]);
  assert.equal(
    JSON.parse(storage.entries.get(CREATIVE_GALLERY_STORAGE_KEY)).entries.length,
    1,
  );
});

test("store enforces per-mode quotas without silently deleting older work", () => {
  let counter = 0;
  const store = createCreativeGalleryStore({
    storage: createStorage(),
    now: () => NOW,
    idFactory: () => `quota-${++counter}`,
  });
  for (
    let index = 0;
    index < CREATIVE_GALLERY_LIMITS.maxEntriesPerMode;
    index += 1
  ) {
    assert.equal(
      store.save({
        modeId: "world-painter",
        title: `World ${index + 1}`,
      }).ok,
      true,
    );
  }
  const rejected = store.save({
    modeId: "world-painter",
    title: "One world too many",
  });

  assert.equal(rejected.status, CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED);
  assert.equal(rejected.quota, "mode");
  assert.equal(
    store.list({ modeId: "world-painter" }).length,
    CREATIVE_GALLERY_LIMITS.maxEntriesPerMode,
  );
  assert.equal(
    store
      .list({ modeId: "world-painter" })
      .some((entry) => entry.title === "World 1"),
    true,
  );
});

test("persistence failures retain in-memory work and future data is write-blocked", () => {
  const failingStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("localStorage quota");
    },
    removeItem() {
      throw new Error("restricted");
    },
  };
  const memoryStore = createCreativeGalleryStore({
    storage: failingStorage,
    now: () => NOW,
    idFactory: () => "memory-art",
  });
  assert.equal(
    memoryStore.save({ modeId: "gesture-art", title: "Memory Art" }).ok,
    true,
  );
  assert.equal(memoryStore.getState().entries.length, 1);
  assert.equal(
    memoryStore.getPersistenceStatus(),
    CREATIVE_GALLERY_STATUS.FAILED,
  );

  const futurePayload = JSON.stringify({
    version: CREATIVE_GALLERY_SCHEMA_VERSION + 10,
    futureField: true,
    entries: [],
  });
  const futureStorage = createStorage(futurePayload);
  const futureStore = createCreativeGalleryStore({
    storage: futureStorage,
    now: () => NOW,
    idFactory: () => "future-art",
  });
  futureStore.save({ modeId: "gesture-art", title: "Session-only work" });
  assert.equal(
    futureStore.getPersistenceStatus(),
    CREATIVE_GALLERY_STATUS.WRITE_BLOCKED,
  );
  assert.equal(
    futureStorage.entries.get(CREATIVE_GALLERY_STORAGE_KEY),
    futurePayload,
  );
  futureStore.clear();
  assert.equal(
    futureStorage.entries.has(CREATIVE_GALLERY_STORAGE_KEY),
    false,
  );

  const futureThatCannotClear = {
    value: futurePayload,
    writes: 0,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.writes += 1;
      this.value = value;
    },
    removeItem() {
      throw new Error("clear denied");
    },
  };
  const blockedStore = createCreativeGalleryStore({
    storage: futureThatCannotClear,
    now: () => NOW,
    idFactory: () => "still-blocked",
  });
  assert.equal(
    blockedStore.clear().status,
    CREATIVE_GALLERY_STATUS.FAILED,
  );
  blockedStore.save({ modeId: "gesture-art", title: "Do not overwrite" });
  assert.equal(futureThatCannotClear.writes, 0);
  assert.equal(futureThatCannotClear.value, futurePayload);

  const futureWithoutRemove = {
    value: futurePayload,
    writes: 0,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.writes += 1;
      this.value = value;
    },
  };
  const unavailableClearStore = createCreativeGalleryStore({
    storage: futureWithoutRemove,
    now: () => NOW,
    idFactory: () => "unavailable-clear",
  });
  assert.equal(unavailableClearStore.clear().ok, false);
  unavailableClearStore.save({
    modeId: "gesture-art",
    title: "Still do not overwrite",
  });
  assert.equal(futureWithoutRemove.writes, 0);
  assert.equal(futureWithoutRemove.value, futurePayload);
});

test("invalid and oversized storage are quarantined until a confirmed clear", () => {
  for (const raw of [
    "{not-json",
    "x".repeat(CREATIVE_GALLERY_LIMITS.maxStorageBytes + 1),
  ]) {
    const storage = createStorage(raw);
    const store = createCreativeGalleryStore({
      storage,
      now: () => NOW,
      idFactory: () => "quarantined-entry",
    });
    store.save({
      modeId: "gesture-art",
      title: "Must stay in memory",
    });

    assert.equal(
      store.getPersistenceStatus(),
      CREATIVE_GALLERY_STATUS.WRITE_BLOCKED,
    );
    assert.equal(storage.entries.get(CREATIVE_GALLERY_STORAGE_KEY), raw);

    assert.equal(store.clear().ok, true);
    store.save({
      modeId: "gesture-art",
      title: "Safe after confirmed clear",
    });
    assert.notEqual(storage.entries.get(CREATIVE_GALLERY_STORAGE_KEY), raw);
  }
});

test("JSON exports are explicitly reference-only, filterable, and round-trip", () => {
  const gallery = {
    version: CREATIVE_GALLERY_SCHEMA_VERSION,
    revision: 2,
    updatedAt: NOW,
    entries: [
      makeEntry(),
      makeEntry({
        id: "jam-1",
        modeId: "jam-studio",
        title: "Night Jam",
        dataRef: {
          kind: "opfs",
          key: "jams/night.json",
          mediaType: "application/json",
        },
      }),
    ],
  };
  const exported = exportCreativeGalleryJSON(gallery, {
    now: NOW,
    modeId: "jam-studio",
  });

  assert.equal(exported.ok, true);
  const payload = JSON.parse(exported.json);
  assert.equal(payload.kind, CREATIVE_GALLERY_EXPORT_KIND);
  assert.equal(payload.contentIncluded, false);
  assert.equal(payload.assetReferences, "local-only");
  assert.equal(payload.entryCount, 1);
  assert.equal(payload.entries[0].id, "jam-1");
  assert.equal("content" in payload.entries[0], false);
  assert.ok(exported.byteLength <= CREATIVE_GALLERY_LIMITS.maxExportBytes);

  const imported = importCreativeGalleryJSON(exported.json, { now: NOW });
  assert.equal(imported.ok, true);
  assert.equal(imported.gallery.entries[0].dataRef.kind, "opfs");
  assert.equal(
    imported.gallery.entries[0].dataRef.availability,
    "unresolved",
  );
});

test("JSON import rejects malformed, binary-claiming, oversized, and future payloads", () => {
  assert.equal(
    importCreativeGalleryJSON("{").status,
    CREATIVE_GALLERY_STATUS.INVALID,
  );
  assert.equal(
    importCreativeGalleryJSON(
      exportManifest([], { contentIncluded: true }),
    ).status,
    CREATIVE_GALLERY_STATUS.INVALID,
  );
  assert.equal(
    importCreativeGalleryJSON(
      "x".repeat(CREATIVE_GALLERY_LIMITS.maxImportBytes + 1),
    ).status,
    CREATIVE_GALLERY_STATUS.TOO_LARGE,
  );
  assert.equal(
    importCreativeGalleryJSON(
      exportManifest([], {
        version: CREATIVE_GALLERY_SCHEMA_VERSION + 1,
      }),
    ).status,
    CREATIVE_GALLERY_STATUS.UNSUPPORTED,
  );
  assert.equal(
    importCreativeGalleryJSON(
      exportManifest([], {
        version: "999",
      }),
    ).status,
    CREATIVE_GALLERY_STATUS.INVALID,
  );
  assert.equal(
    importCreativeGalleryJSON(
      exportManifest([], {
        entryCount: 100,
      }),
    ).status,
    CREATIVE_GALLERY_STATUS.INVALID,
  );
});

test("store import merges with collision recovery or atomically replaces", () => {
  const storage = createStorage();
  let counter = 0;
  const store = createCreativeGalleryStore({
    storage,
    now: () => NOW,
    idFactory: () => `local-${++counter}`,
  });
  const saved = store.save({
    id: "shared-id",
    modeId: "visualizer",
    title: "Local",
  });
  const manifest = exportManifest([
    makeEntry({
      id: "shared-id",
      modeId: "visualizer",
      title: "Imported",
    }),
    makeEntry({
      id: "jam-import",
      modeId: "jam-studio",
      title: "Imported Jam",
    }),
  ]);

  const merged = store.importJSON(manifest);
  assert.equal(merged.ok, true);
  assert.equal(merged.importedCount, 2);
  assert.equal(new Set(merged.gallery.entries.map((entry) => entry.id)).size, 3);
  assert.ok(
    merged.warnings.some(
      (warning) => warning.code === "id-collision-recovered",
    ),
  );
  assert.ok(store.getState().entries.some((entry) => entry.id === saved.entry.id));

  const replaced = store.importJSON(
    exportManifest([
      makeEntry({
        id: "world-only",
        modeId: "world-painter",
        title: "Replacement",
      }),
    ]),
    { strategy: "replace" },
  );
  assert.equal(replaced.importedCount, 1);
  assert.deepEqual(
    store.getState().entries.map((entry) => entry.id),
    ["world-only"],
  );
});

test("an all-invalid replace import cannot erase an existing gallery", () => {
  const store = createCreativeGalleryStore({
    storage: createStorage(),
    now: () => NOW,
  });
  store.save({
    id: "keep-me",
    modeId: "gesture-art",
    title: "Keep me",
  });
  const result = store.importJSON(
    exportManifest([
      makeEntry({
        id: "invalid-mode",
        modeId: "breakout",
      }),
    ]),
    { strategy: "replace" },
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, CREATIVE_GALLERY_STATUS.INVALID);
  assert.deepEqual(
    store.getState().entries.map((entry) => entry.id),
    ["keep-me"],
  );
});

test("stores refresh revisions before mutation to avoid ordinary stale-tab overwrites", () => {
  const storage = createStorage();
  let counter = 0;
  const firstStore = createCreativeGalleryStore({
    storage,
    now: () => NOW,
    idFactory: () => `tab-${++counter}`,
  });
  const secondStore = createCreativeGalleryStore({
    storage,
    now: () => NOW,
    idFactory: () => `tab-${++counter}`,
  });

  firstStore.save({ modeId: "gesture-art", title: "From tab one" });
  secondStore.save({ modeId: "jam-studio", title: "From tab two" });
  firstStore.save({ modeId: "visualizer", title: "Back in tab one" });

  const persisted = readCreativeGallery(storage, { now: NOW });
  assert.equal(persisted.gallery.entries.length, 3);
  assert.deepEqual(
    new Set(persisted.gallery.entries.map((entry) => entry.title)),
    new Set(["From tab one", "From tab two", "Back in tab one"]),
  );
  assert.equal(persisted.gallery.revision, 3);
});

test("imports recover valid entries and skip unsafe records without exceeding quotas", () => {
  const entries = [
    makeEntry({ id: "good-art" }),
    makeEntry({
      id: "unsafe-ref",
      title: "Unsafe reference is stripped",
      dataRef: {
        kind: "indexeddb",
        key: "../../somewhere",
      },
    }),
    makeEntry({
      id: "wrong-mode",
      modeId: "breakout",
    }),
  ];
  for (
    let index = 0;
    index < CREATIVE_GALLERY_LIMITS.maxEntriesPerMode + 5;
    index += 1
  ) {
    entries.push(
      makeEntry({
        id: `jam-${index}`,
        modeId: "jam-studio",
        title: `Jam ${index}`,
      }),
    );
  }

  const imported = importCreativeGalleryJSON(exportManifest(entries), {
    now: NOW,
  });
  assert.equal(imported.ok, true);
  assert.equal(imported.status, CREATIVE_GALLERY_STATUS.RECOVERED);
  assert.equal(
    imported.gallery.entries.filter((entry) => entry.modeId === "jam-studio")
      .length,
    CREATIVE_GALLERY_LIMITS.maxEntriesPerMode,
  );
  assert.equal(
    imported.gallery.entries.find((entry) => entry.id === "unsafe-ref").dataRef,
    null,
  );
  assert.equal(
    imported.gallery.entries.some((entry) => entry.id === "wrong-mode"),
    false,
  );
});
