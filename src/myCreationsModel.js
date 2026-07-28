import {
  CREATIVE_GALLERY_STATUS,
  readCreativeGallery,
} from "./creativeGallery.js";
import {
  WFC_WORLD_LIBRARY_STORAGE_KEY,
  WFC_WORLD_PERSISTENCE_STATUS,
  createEmptyWfcWorldLibrary,
  parseWfcWorldLibraryJSON,
  restoreWfcWorldSnapshot,
  reviseWfcWorldSnapshot,
  serializeWfcWorldLibrary,
  upsertWfcWorldSnapshot,
} from "./wfc/wfcWorldPersistence.js";
import { FINGERPRINT_WORLD_TILES } from "./wfc/wfcTiles.js";

export const MY_CREATION_KINDS = Object.freeze({
  LIGHT_PAINTING: "light-painting",
  WORLD: "world",
});

export const MY_CREATIONS_SOURCE_STATUS = Object.freeze({
  READY: "ready",
  EMPTY: "empty",
  RECOVERED: "recovered",
  UNAVAILABLE: "unavailable",
  INVALID: "invalid",
  UNSUPPORTED: "unsupported",
});

const WORLD_COLORS = new Map(
  FINGERPRINT_WORLD_TILES.map((tile) => [tile.id, tile.color]),
);

function normalizeSourceStatus(status, { emptyStatus, loadedStatuses }) {
  if (status === emptyStatus) {
    return MY_CREATIONS_SOURCE_STATUS.EMPTY;
  }
  if (loadedStatuses.includes(status)) {
    return status === CREATIVE_GALLERY_STATUS.RECOVERED
      ? MY_CREATIONS_SOURCE_STATUS.RECOVERED
      : MY_CREATIONS_SOURCE_STATUS.READY;
  }
  if (status === CREATIVE_GALLERY_STATUS.UNSUPPORTED) {
    return MY_CREATIONS_SOURCE_STATUS.UNSUPPORTED;
  }
  if (
    status === CREATIVE_GALLERY_STATUS.UNAVAILABLE ||
    status === "unavailable"
  ) {
    return MY_CREATIONS_SOURCE_STATUS.UNAVAILABLE;
  }
  return MY_CREATIONS_SOURCE_STATUS.INVALID;
}

function getWorldPalette(snapshot) {
  const tileIds = [];
  for (const row of Array.isArray(snapshot?.world?.grid)
    ? snapshot.world.grid
    : []) {
    for (const tileId of Array.isArray(row) ? row : []) {
      if (!tileIds.includes(tileId)) {
        tileIds.push(tileId);
      }
    }
  }
  for (const constraint of Array.isArray(snapshot?.world?.constraints)
    ? snapshot.world.constraints
    : []) {
    if (!tileIds.includes(constraint.tileId)) {
      tileIds.push(constraint.tileId);
    }
  }
  const palette = tileIds
    .map((tileId) => WORLD_COLORS.get(tileId))
    .filter(Boolean)
    .slice(0, 6);
  return palette.length > 0 ? palette : ["#65b96f", "#338fd0", "#8e99a5"];
}

function compareNewestFirst(left, right) {
  const leftTime = Date.parse(left.updatedAt ?? "") || 0;
  const rightTime = Date.parse(right.updatedAt ?? "") || 0;
  return rightTime - leftTime || left.title.localeCompare(right.title);
}

export function createMyCreationItems({
  galleryEntries = [],
  worldSnapshots = [],
} = {}) {
  const lightPaintings = (
    Array.isArray(galleryEntries) ? galleryEntries : []
  )
    .filter((entry) => entry?.modeId === "gesture-art")
    .map((entry) => ({
      key: `${MY_CREATION_KINDS.LIGHT_PAINTING}:${entry.id}`,
      sourceId: entry.id,
      kind: MY_CREATION_KINDS.LIGHT_PAINTING,
      modeId: "gesture-art",
      typeLabel: "Light Painting",
      title: entry.title,
      description: entry.description || "Saved motion artwork",
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      palette:
        entry.thumbnail?.palette?.length > 0
          ? [...entry.thumbnail.palette]
          : ["#7cf7c8", "#7893ff", "#ff7cc8"],
      metadataLabel: entry.dataRef?.byteLength
        ? `${Math.max(1, Math.round(entry.dataRef.byteLength / 1024))} KB image`
        : "Saved image",
      canExport:
        entry.dataRef?.kind === "indexeddb" &&
        entry.dataRef?.availability !== "unresolved",
      value: entry,
    }));

  const worlds = (Array.isArray(worldSnapshots) ? worldSnapshots : []).map(
    (snapshot) => ({
      key: `${MY_CREATION_KINDS.WORLD}:${snapshot.id}`,
      sourceId: snapshot.id,
      kind: MY_CREATION_KINDS.WORLD,
      modeId: "world-painter",
      typeLabel: "World",
      title: snapshot.name,
      description:
        snapshot.state === "complete"
          ? "Complete rule-grown landscape"
          : "World draft ready for more terrain rules",
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      palette: getWorldPalette(snapshot),
      metadataLabel: `${
        snapshot.state === "complete" ? "Complete" : "Draft"
      } · Revision ${snapshot.revision} · ${
        snapshot.world.constraints.length
      } ${snapshot.world.constraints.length === 1 ? "rule" : "rules"}`,
      canExport: true,
      value: snapshot,
    }),
  );

  return [...lightPaintings, ...worlds].sort(compareNewestFirst);
}

export function filterMyCreationItems(
  items,
  { kind = "all", query = "" } = {},
) {
  const normalizedQuery =
    typeof query === "string" ? query.trim().toLocaleLowerCase() : "";
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (kind !== "all" && item.kind !== kind) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return [item.title, item.description, item.typeLabel, item.metadataLabel]
      .filter(Boolean)
      .some((value) =>
        String(value).toLocaleLowerCase().includes(normalizedQuery),
      );
  });
}

export function readMyCreationLibraries(storage) {
  const creativeRead = readCreativeGallery(storage);
  const creativeStatus = normalizeSourceStatus(creativeRead.status, {
    emptyStatus: CREATIVE_GALLERY_STATUS.EMPTY,
    loadedStatuses: [
      CREATIVE_GALLERY_STATUS.LOADED,
      CREATIVE_GALLERY_STATUS.MIGRATED,
      CREATIVE_GALLERY_STATUS.RECOVERED,
    ],
  });

  let worldRead;
  if (!storage?.getItem) {
    worldRead = {
      ok: false,
      status: "unavailable",
      library: createEmptyWfcWorldLibrary(),
      errors: ["Browser storage is unavailable"],
    };
  } else {
    try {
      worldRead = parseWfcWorldLibraryJSON(
        storage.getItem(WFC_WORLD_LIBRARY_STORAGE_KEY),
      );
    } catch {
      worldRead = {
        ok: false,
        status: "unavailable",
        library: createEmptyWfcWorldLibrary(),
        errors: ["Saved worlds could not be read"],
      };
    }
  }
  const worldStatus = normalizeSourceStatus(worldRead.status, {
    emptyStatus: WFC_WORLD_PERSISTENCE_STATUS.EMPTY,
    loadedStatuses: [
      WFC_WORLD_PERSISTENCE_STATUS.IMPORTED,
      WFC_WORLD_PERSISTENCE_STATUS.VALID,
    ],
  });

  return {
    gallery: creativeRead.gallery,
    worldLibrary: worldRead.ok
      ? worldRead.library
      : createEmptyWfcWorldLibrary(),
    creativeStatus,
    worldStatus,
    warnings: creativeRead.warnings ?? [],
    errors: worldRead.errors ?? [],
  };
}

export function renameWorldCreation(
  library,
  snapshotId,
  name,
  { now = new Date().toISOString() } = {},
) {
  const snapshot = library?.snapshots?.find(
    (candidate) => candidate.id === snapshotId,
  );
  if (!snapshot) {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.INVALID,
      library,
      errors: ["Saved world was not found"],
    };
  }
  const restored = restoreWfcWorldSnapshot(snapshot);
  if (!restored.ok) {
    return { ...restored, library };
  }
  const revised = reviseWfcWorldSnapshot(snapshot, restored.game, {
    name,
    updatedAt: now,
  });
  if (!revised.ok) {
    return { ...revised, library };
  }
  return upsertWfcWorldSnapshot(library, revised.snapshot);
}

export function persistWorldCreationLibrary(storage, library) {
  const serialized = serializeWfcWorldLibrary(library);
  if (!serialized.ok) {
    return serialized;
  }
  if (!storage?.setItem) {
    return {
      ...serialized,
      ok: false,
      status: "unavailable",
      errors: ["Browser storage is unavailable"],
    };
  }
  try {
    storage.setItem(WFC_WORLD_LIBRARY_STORAGE_KEY, serialized.json);
    return {
      ...serialized,
      status: WFC_WORLD_PERSISTENCE_STATUS.SAVED,
    };
  } catch {
    return {
      ...serialized,
      ok: false,
      status: "unavailable",
      errors: ["World library could not be saved"],
    };
  }
}
