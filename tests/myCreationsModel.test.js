import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATIVE_GALLERY_SCHEMA_VERSION,
  CREATIVE_GALLERY_STORAGE_KEY,
  createCreativeGalleryStore,
} from "../src/creativeGallery.js";
import {
  MY_CREATION_KINDS,
  MY_CREATIONS_SOURCE_STATUS,
  createMyCreationItems,
  filterMyCreationItems,
  persistWorldCreationLibrary,
  readMyCreationLibraries,
  renameWorldCreation,
} from "../src/myCreationsModel.js";
import { createWfcWorldGame } from "../src/wfc/wfcWorldGame.js";
import {
  WFC_WORLD_LIBRARY_STORAGE_KEY,
  createEmptyWfcWorldLibrary,
  createWfcWorldSnapshot,
  serializeWfcWorldLibrary,
  upsertWfcWorldSnapshot,
} from "../src/wfc/wfcWorldPersistence.js";

const NOW = "2026-07-28T12:00:00.000Z";
const LATER = "2026-07-29T12:00:00.000Z";

function createStorage() {
  const entries = new Map();
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

function createWorldLibrary() {
  const snapshot = createWfcWorldSnapshot(
    createWfcWorldGame(1280, 720),
    {
      id: "world-meadow",
      name: "Meadow Atlas",
      createdAt: NOW,
      updatedAt: NOW,
    },
  );
  assert.equal(snapshot.ok, true);
  const saved = upsertWfcWorldSnapshot(
    createEmptyWfcWorldLibrary(),
    snapshot.snapshot,
  );
  assert.equal(saved.ok, true);
  return saved.library;
}

function createPainting(overrides = {}) {
  return {
    id: "painting-neon",
    modeId: "gesture-art",
    title: "Neon Loops",
    description: "A bright motion sketch.",
    createdAt: NOW,
    updatedAt: LATER,
    thumbnail: {
      palette: ["#ff00aa", "#00ddff"],
    },
    dataRef: {
      kind: "indexeddb",
      key: "painting-neon",
      mediaType: "image/png",
      byteLength: 4096,
    },
    ...overrides,
  };
}

test("unified creation items combine paintings and worlds with honest metadata", () => {
  const worldLibrary = createWorldLibrary();
  const items = createMyCreationItems({
    galleryEntries: [
      createPainting(),
      createPainting({
        id: "jam-ignored",
        modeId: "jam-studio",
        title: "Not part of this shelf",
      }),
    ],
    worldSnapshots: worldLibrary.snapshots,
  });

  assert.deepEqual(
    items.map((item) => item.kind),
    [MY_CREATION_KINDS.LIGHT_PAINTING, MY_CREATION_KINDS.WORLD],
  );
  assert.equal(items[0].title, "Neon Loops");
  assert.equal(items[0].metadataLabel, "4 KB image");
  assert.equal(items[0].canExport, true);
  assert.match(items[1].metadataLabel, /Draft · Revision 1/);
  assert.equal(items[1].modeId, "world-painter");
  assert.ok(items[1].palette.length > 0);

  const unresolved = createMyCreationItems({
    galleryEntries: [
      createPainting({
        dataRef: {
          ...createPainting().dataRef,
          availability: "unresolved",
        },
      }),
    ],
  });
  assert.equal(unresolved[0].canExport, false);
});

test("creation filtering searches type, title, description, and metadata", () => {
  const items = createMyCreationItems({
    galleryEntries: [createPainting()],
    worldSnapshots: createWorldLibrary().snapshots,
  });

  assert.deepEqual(
    filterMyCreationItems(items, { query: "neon" }).map((item) => item.title),
    ["Neon Loops"],
  );
  assert.deepEqual(
    filterMyCreationItems(items, {
      kind: MY_CREATION_KINDS.WORLD,
      query: "revision",
    }).map((item) => item.title),
    ["Meadow Atlas"],
  );
  assert.deepEqual(filterMyCreationItems(items, { query: "missing" }), []);
});

test("both durable local libraries load without merging or rewriting them", () => {
  const storage = createStorage();
  const galleryStore = createCreativeGalleryStore({
    storage,
    now: () => NOW,
    idFactory: () => "painting-neon",
  });
  const savedPainting = galleryStore.save({
    modeId: "gesture-art",
    title: "Neon Loops",
  });
  assert.equal(savedPainting.ok, true);

  const worldLibrary = createWorldLibrary();
  const serializedWorlds = serializeWfcWorldLibrary(worldLibrary);
  storage.setItem(
    WFC_WORLD_LIBRARY_STORAGE_KEY,
    serializedWorlds.json,
  );
  const beforeGallery = storage.getItem(CREATIVE_GALLERY_STORAGE_KEY);
  const beforeWorlds = storage.getItem(WFC_WORLD_LIBRARY_STORAGE_KEY);

  const loaded = readMyCreationLibraries(storage);

  assert.equal(loaded.creativeStatus, MY_CREATIONS_SOURCE_STATUS.READY);
  assert.equal(loaded.worldStatus, MY_CREATIONS_SOURCE_STATUS.READY);
  assert.equal(loaded.gallery.entries.length, 1);
  assert.equal(loaded.worldLibrary.snapshots.length, 1);
  assert.equal(storage.getItem(CREATIVE_GALLERY_STORAGE_KEY), beforeGallery);
  assert.equal(storage.getItem(WFC_WORLD_LIBRARY_STORAGE_KEY), beforeWorlds);
});

test("world renaming creates a valid revision and persistence fails safely", () => {
  const library = createWorldLibrary();
  const renamed = renameWorldCreation(
    library,
    "world-meadow",
    "Cloud Garden",
    { now: LATER },
  );

  assert.equal(renamed.ok, true);
  assert.equal(renamed.snapshot.id, "world-meadow");
  assert.equal(renamed.snapshot.name, "Cloud Garden");
  assert.equal(renamed.snapshot.revision, 2);
  assert.equal(renamed.snapshot.createdAt, NOW);

  const storage = createStorage();
  assert.equal(
    persistWorldCreationLibrary(storage, renamed.library).ok,
    true,
  );
  assert.match(
    storage.getItem(WFC_WORLD_LIBRARY_STORAGE_KEY),
    /Cloud Garden/,
  );
  assert.equal(
    persistWorldCreationLibrary(null, renamed.library).status,
    "unavailable",
  );
  assert.equal(
    renameWorldCreation(library, "missing", "Nope", { now: LATER }).ok,
    false,
  );
});

test("unavailable storage produces independent empty sources", () => {
  const loaded = readMyCreationLibraries(null);

  assert.equal(
    loaded.creativeStatus,
    MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE,
  );
  assert.equal(
    loaded.worldStatus,
    MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE,
  );
  assert.deepEqual(loaded.gallery.entries, []);
  assert.deepEqual(loaded.worldLibrary.snapshots, []);
});

test("invalid and future local metadata is reported without being overwritten", () => {
  const storage = createStorage();
  const futureGallery = JSON.stringify({
    version: CREATIVE_GALLERY_SCHEMA_VERSION + 1,
    entries: [],
  });
  const invalidWorlds = "{not-world-json";
  storage.setItem(CREATIVE_GALLERY_STORAGE_KEY, futureGallery);
  storage.setItem(WFC_WORLD_LIBRARY_STORAGE_KEY, invalidWorlds);

  const loaded = readMyCreationLibraries(storage);

  assert.equal(
    loaded.creativeStatus,
    MY_CREATIONS_SOURCE_STATUS.UNSUPPORTED,
  );
  assert.equal(loaded.worldStatus, MY_CREATIONS_SOURCE_STATUS.INVALID);
  assert.equal(storage.getItem(CREATIVE_GALLERY_STORAGE_KEY), futureGallery);
  assert.equal(
    storage.getItem(WFC_WORLD_LIBRARY_STORAGE_KEY),
    invalidWorlds,
  );
});
