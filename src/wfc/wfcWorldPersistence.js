import {
  WFC_WORLD_COLS,
  WFC_WORLD_FALLBACK_SEED,
  WFC_WORLD_MODE_ID,
  WFC_WORLD_ROWS,
  WFC_WORLD_SEED_MAX_LENGTH,
  createWfcWorldGame,
  getWfcWorldGrid,
  getWfcWorldQualitySummary,
  normalizeWfcWorldSeed,
} from "./wfcWorldGame.js";
import {
  createWfcState,
  isWfcGridValid,
  setWfcConstraint,
} from "./wfcSolver.js";
import { FINGERPRINT_WORLD_TILES } from "./wfcTiles.js";
import {
  WFC_WORLD_BLANK_TEMPLATE_ID,
  getWfcWorldStarterTemplate,
} from "./wfcWorldTemplates.js";

export const WFC_WORLD_SNAPSHOT_KIND =
  "motion-arcade/fingerprint-world-snapshot";
export const WFC_WORLD_EXPORT_KIND =
  "motion-arcade/fingerprint-world-export";
export const WFC_WORLD_LIBRARY_KIND =
  "motion-arcade/fingerprint-world-library";
export const WFC_WORLD_SCHEMA_VERSION = 2;
export const WFC_WORLD_LIBRARY_STORAGE_KEY =
  "motion-arcade.fingerprint-worlds.v1";

export const WFC_WORLD_PERSISTENCE_LIMITS = Object.freeze({
  maxNameLength: 64,
  maxIdLength: 80,
  maxSeedLength: WFC_WORLD_SEED_MAX_LENGTH,
  maxConstraints: 256,
  maxSnapshots: 24,
  maxSnapshotBytes: 128 * 1024,
  maxLibraryBytes: 512 * 1024,
  maxImportBytes: 512 * 1024,
});

export const WFC_WORLD_PERSISTENCE_STATUS = Object.freeze({
  CREATED: "created",
  REVISED: "revised",
  VALID: "valid",
  INVALID: "invalid",
  UNSUPPORTED: "unsupported",
  TOO_LARGE: "too-large",
  EXPORTED: "exported",
  IMPORTED: "imported",
  RESTORED: "restored",
  SAVED: "saved",
  REMOVED: "removed",
  UNCHANGED: "unchanged",
  STALE_REVISION: "stale-revision",
  LIMIT_REACHED: "limit-reached",
  EMPTY: "empty",
});

const TILE_IDS = new Set(FINGERPRINT_WORLD_TILES.map((tile) => tile.id));
const SNAPSHOT_STATES = new Set(["draft", "complete"]);
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

function compareText(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function sortConstraints(constraints) {
  return [...constraints].sort(
    (a, b) =>
      a.row - b.row ||
      a.col - b.col ||
      compareText(a.tileId, b.tileId),
  );
}

function sortSnapshots(snapshots) {
  return [...snapshots].sort((a, b) => {
    const updatedOrder = compareText(
      b.updatedAt ?? "",
      a.updatedAt ?? "",
    );
    return (
      updatedOrder ||
      compareText(a.name.toLowerCase(), b.name.toLowerCase()) ||
      compareText(a.id, b.id)
    );
  });
}

function stableHash(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function failure(status, errors = []) {
  return {
    ok: false,
    status,
    snapshot: null,
    errors,
  };
}

function getSnapshotWorldFromGame(game) {
  const grid = getWfcWorldGrid(game);
  const complete =
    game?.phase === "complete" &&
    grid.length === WFC_WORLD_ROWS &&
    isWfcGridValid(grid);
  return {
    cols: WFC_WORLD_COLS,
    rows: WFC_WORLD_ROWS,
    generation: normalizeInteger(game?.generation),
    seed: normalizeWfcWorldSeed(game?.seed),
    templateId:
      getWfcWorldStarterTemplate(game?.templateId)?.id ??
      WFC_WORLD_BLANK_TEMPLATE_ID,
    selectedTileId: TILE_IDS.has(game?.selectedTileId)
      ? game.selectedTileId
      : "grass",
    constraints: sortConstraints(
      Array.isArray(game?.constraints)
        ? game.constraints.map(({ col, row, tileId }) => ({
            col,
            row,
            tileId,
          }))
        : [],
    ),
    grid: complete ? grid.map((row) => [...row]) : null,
  };
}

function validateConstraintList(value, errors) {
  if (!Array.isArray(value)) {
    errors.push("world.constraints must be an array");
    return [];
  }
  if (value.length > WFC_WORLD_PERSISTENCE_LIMITS.maxConstraints) {
    errors.push("world.constraints contains too many rules");
    return [];
  }

  const seenCells = new Set();
  const constraints = [];
  for (const constraint of value) {
    if (!isRecord(constraint)) {
      errors.push("Every world constraint must be an object");
      continue;
    }
    const { col, row, tileId } = constraint;
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      col < 0 ||
      col >= WFC_WORLD_COLS ||
      row < 0 ||
      row >= WFC_WORLD_ROWS
    ) {
      errors.push("A world constraint is outside the map");
      continue;
    }
    if (!TILE_IDS.has(tileId)) {
      errors.push("A world constraint uses an unknown terrain");
      continue;
    }
    const cellKey = `${col}:${row}`;
    if (seenCells.has(cellKey)) {
      errors.push("A map cell has more than one saved rule");
      continue;
    }
    seenCells.add(cellKey);
    constraints.push({ col, row, tileId });
  }

  let constrainedState = createWfcState({
    cols: WFC_WORLD_COLS,
    rows: WFC_WORLD_ROWS,
  });
  for (const constraint of sortConstraints(constraints)) {
    constrainedState = setWfcConstraint(
      constrainedState,
      constraint.col,
      constraint.row,
      constraint.tileId,
    );
    if (constrainedState.status === "contradiction") {
      errors.push("The saved terrain rules contradict each other");
      break;
    }
  }
  return sortConstraints(constraints);
}

function validateGrid(value, state, constraints, errors) {
  if (state === "draft") {
    if (value !== null && value !== undefined) {
      errors.push("Draft snapshots cannot contain a resolved grid");
    }
    return null;
  }
  if (!Array.isArray(value) || value.length !== WFC_WORLD_ROWS) {
    errors.push("A complete snapshot must contain every map row");
    return null;
  }

  const grid = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== WFC_WORLD_COLS) {
      errors.push("Every saved map row must contain every map cell");
      return null;
    }
    if (row.some((tileId) => !TILE_IDS.has(tileId))) {
      errors.push("The saved map contains an unknown terrain");
      return null;
    }
    grid.push([...row]);
  }
  if (!isWfcGridValid(grid)) {
    errors.push("The saved map does not satisfy its terrain rules");
    return null;
  }
  for (const constraint of constraints) {
    if (grid[constraint.row]?.[constraint.col] !== constraint.tileId) {
      errors.push("A saved rule does not match the resolved map");
      break;
    }
  }
  return grid;
}

export function validateWfcWorldSnapshot(value) {
  try {
    if (!isRecord(value)) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
        "Snapshot must be an object",
      ]);
    }
    if (value.kind !== WFC_WORLD_SNAPSHOT_KIND) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
        "Snapshot kind is not recognized",
      ]);
    }
    if (
      Number.isInteger(value.version) &&
      value.version > WFC_WORLD_SCHEMA_VERSION
    ) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.UNSUPPORTED, [
        "Snapshot was created by a newer version",
      ]);
    }

    const errors = [];
    const sourceVersion = value.version;
    if (sourceVersion !== 1 && sourceVersion !== WFC_WORLD_SCHEMA_VERSION) {
      errors.push("Snapshot version is invalid");
    }
    const id =
      typeof value.id === "string" ? value.id.trim() : "";
    if (
      !id ||
      id.length > WFC_WORLD_PERSISTENCE_LIMITS.maxIdLength ||
      !SAFE_ID_PATTERN.test(id)
    ) {
      errors.push("Snapshot id is invalid");
    }
    const name =
      typeof value.name === "string" ? value.name.trim() : "";
    if (
      !name ||
      name.length > WFC_WORLD_PERSISTENCE_LIMITS.maxNameLength
    ) {
      errors.push("Snapshot name is invalid");
    }
    const revision = value.revision;
    if (!Number.isInteger(revision) || revision < 1) {
      errors.push("Snapshot revision must be a positive integer");
    }
    const createdAt = normalizeTimestamp(value.createdAt);
    const updatedAt = normalizeTimestamp(value.updatedAt);
    if (
      value.createdAt !== null &&
      value.createdAt !== undefined &&
      !createdAt
    ) {
      errors.push("Snapshot creation time is invalid");
    }
    if (
      value.updatedAt !== null &&
      value.updatedAt !== undefined &&
      !updatedAt
    ) {
      errors.push("Snapshot update time is invalid");
    }
    if (
      createdAt &&
      updatedAt &&
      Date.parse(updatedAt) < Date.parse(createdAt)
    ) {
      errors.push("Snapshot update time predates its creation");
    }
    const state = SNAPSHOT_STATES.has(value.state) ? value.state : null;
    if (!state) {
      errors.push("Snapshot state is invalid");
    }

    const world = isRecord(value.world) ? value.world : {};
    if (
      world.cols !== WFC_WORLD_COLS ||
      world.rows !== WFC_WORLD_ROWS
    ) {
      errors.push("Snapshot map dimensions are unsupported");
    }
    const generation = world.generation;
    if (!Number.isInteger(generation) || generation < 0) {
      errors.push("Snapshot generation is invalid");
    }
    let seed;
    let templateId;
    if (sourceVersion === 1) {
      seed = `legacy-${stableHash({
        id,
        generation: normalizeInteger(generation),
        constraints: world.constraints,
        grid: world.grid,
      })}`;
      templateId = WFC_WORLD_BLANK_TEMPLATE_ID;
    } else {
      seed =
        typeof world.seed === "string"
          ? world.seed.trim().replace(/\s+/g, " ")
          : "";
      if (!seed || seed.length > WFC_WORLD_PERSISTENCE_LIMITS.maxSeedLength) {
        errors.push("Snapshot seed is invalid");
        seed = WFC_WORLD_FALLBACK_SEED;
      }
      templateId =
        typeof world.templateId === "string"
          ? world.templateId
          : "";
      if (!getWfcWorldStarterTemplate(templateId)) {
        errors.push("Snapshot starter template is invalid");
        templateId = WFC_WORLD_BLANK_TEMPLATE_ID;
      }
    }
    if (!TILE_IDS.has(world.selectedTileId)) {
      errors.push("Snapshot selected terrain is invalid");
    }
    const constraints = validateConstraintList(world.constraints, errors);
    const grid = state
      ? validateGrid(world.grid, state, constraints, errors)
      : null;

    if (errors.length > 0) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, errors);
    }

    return {
      ok: true,
      status: WFC_WORLD_PERSISTENCE_STATUS.VALID,
      errors: [],
      snapshot: {
        kind: WFC_WORLD_SNAPSHOT_KIND,
        version: WFC_WORLD_SCHEMA_VERSION,
        id,
        name,
        revision,
        createdAt,
        updatedAt,
        state,
        world: {
          cols: WFC_WORLD_COLS,
          rows: WFC_WORLD_ROWS,
          generation,
          seed,
          templateId,
          selectedTileId: world.selectedTileId,
          constraints,
          grid,
        },
      },
    };
  } catch {
    return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
      "Snapshot could not be validated",
    ]);
  }
}

export function createWfcWorldSnapshot(
  game,
  {
    id,
    name = "Untitled World",
    revision = 1,
    createdAt = null,
    updatedAt = createdAt,
  } = {},
) {
  if (!game?.layout) {
    return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
      "A world is required",
    ]);
  }
  const normalizedName =
    typeof name === "string" ? name.trim() : "";
  const world = getSnapshotWorldFromGame(game);
  const state = world.grid ? "complete" : "draft";
  const resolvedId =
    id ??
    `world-${stableHash({
      modeId: WFC_WORLD_MODE_ID,
      name: normalizedName,
      state,
      world,
    })}`;
  const result = validateWfcWorldSnapshot({
    kind: WFC_WORLD_SNAPSHOT_KIND,
    version: WFC_WORLD_SCHEMA_VERSION,
    id: resolvedId,
    name: normalizedName,
    revision,
    createdAt,
    updatedAt,
    state,
    world,
  });
  return result.ok
    ? {
        ...result,
        status: WFC_WORLD_PERSISTENCE_STATUS.CREATED,
      }
    : result;
}

export function reviseWfcWorldSnapshot(
  previousSnapshot,
  game,
  { name, updatedAt } = {},
) {
  const previous = validateWfcWorldSnapshot(previousSnapshot);
  if (!previous.ok) {
    return previous;
  }
  const result = createWfcWorldSnapshot(game, {
    id: previous.snapshot.id,
    name: name ?? previous.snapshot.name,
    revision: previous.snapshot.revision + 1,
    createdAt: previous.snapshot.createdAt,
    updatedAt: updatedAt ?? previous.snapshot.updatedAt,
  });
  return result.ok
    ? {
        ...result,
        status: WFC_WORLD_PERSISTENCE_STATUS.REVISED,
      }
    : result;
}

export function restoreWfcWorldSnapshot(
  value,
  { width = 1280, height = 720 } = {},
) {
  const validation = validateWfcWorldSnapshot(value);
  if (!validation.ok) {
    return {
      ...validation,
      game: null,
    };
  }
  const snapshot = validation.snapshot;
  let wfc = createWfcState({
    cols: WFC_WORLD_COLS,
    rows: WFC_WORLD_ROWS,
  });
  if (snapshot.state === "complete") {
    wfc = {
      ...wfc,
      domains: snapshot.world.grid
        .flat()
        .map((tileId) => [tileId]),
      constraints: snapshot.world.constraints.map((constraint) => ({
        ...constraint,
      })),
      contradictionCells: [],
      changedCells: [],
      status: "complete",
      stepCount: WFC_WORLD_COLS * WFC_WORLD_ROWS,
    };
  } else {
    for (const constraint of snapshot.world.constraints) {
      wfc = setWfcConstraint(
        wfc,
        constraint.col,
        constraint.row,
        constraint.tileId,
      );
    }
  }

  const game = {
    ...createWfcWorldGame(width, height, {
      seed: snapshot.world.seed,
    }),
    wfc,
    phase: snapshot.state === "complete" ? "complete" : "seeding",
    selectedTileId: snapshot.world.selectedTileId,
    constraints: snapshot.world.constraints.map((constraint) => ({
      ...constraint,
    })),
    generation: snapshot.world.generation,
    seed: snapshot.world.seed,
    templateId: snapshot.world.templateId,
    randomCursor: 0,
    snapshot: {
      id: snapshot.id,
      name: snapshot.name,
      revision: snapshot.revision,
    },
    message:
      snapshot.state === "complete"
        ? `${snapshot.name} restored with seed ${snapshot.world.seed}. This world is ready to explore.`
        : `${snapshot.name} restored with seed ${snapshot.world.seed}. Add rules or generate the world.`,
  };
  return {
    ok: true,
    status: WFC_WORLD_PERSISTENCE_STATUS.RESTORED,
    errors: [],
    snapshot,
    game,
  };
}

export function exportWfcWorldSnapshotJSON(
  value,
  { exportedAt = null } = {},
) {
  const validation = validateWfcWorldSnapshot(value);
  if (!validation.ok) {
    return {
      ...validation,
      json: null,
      byteLength: 0,
    };
  }
  const normalizedExportedAt = normalizeTimestamp(exportedAt);
  if (exportedAt !== null && exportedAt !== undefined && !normalizedExportedAt) {
    return {
      ...failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
        "Export time is invalid",
      ]),
      json: null,
      byteLength: 0,
    };
  }
  const envelope = {
    kind: WFC_WORLD_EXPORT_KIND,
    version: WFC_WORLD_SCHEMA_VERSION,
    exportedAt: normalizedExportedAt,
    snapshot: validation.snapshot,
  };
  const json = JSON.stringify(envelope, null, 2);
  const byteLength = utf8ByteLength(json);
  if (byteLength > WFC_WORLD_PERSISTENCE_LIMITS.maxSnapshotBytes) {
    return {
      ...failure(WFC_WORLD_PERSISTENCE_STATUS.TOO_LARGE, [
        "Snapshot export is too large",
      ]),
      json: null,
      byteLength,
    };
  }
  return {
    ok: true,
    status: WFC_WORLD_PERSISTENCE_STATUS.EXPORTED,
    errors: [],
    snapshot: validation.snapshot,
    json,
    byteLength,
  };
}

export function importWfcWorldSnapshotJSON(raw) {
  if (typeof raw !== "string") {
    return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
      "Imported snapshot must be JSON text",
    ]);
  }
  if (utf8ByteLength(raw) > WFC_WORLD_PERSISTENCE_LIMITS.maxImportBytes) {
    return failure(WFC_WORLD_PERSISTENCE_STATUS.TOO_LARGE, [
      "Imported snapshot is too large",
    ]);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
      "Imported snapshot is not valid JSON",
    ]);
  }

  let candidate = parsed;
  const warnings = [];
  if (parsed?.kind === WFC_WORLD_EXPORT_KIND) {
    if (
      Number.isInteger(parsed.version) &&
      parsed.version > WFC_WORLD_SCHEMA_VERSION
    ) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.UNSUPPORTED, [
        "Export was created by a newer version",
      ]);
    }
    if (parsed.version !== 1 && parsed.version !== WFC_WORLD_SCHEMA_VERSION) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
        "Export version is invalid",
      ]);
    }
    if (
      parsed.exportedAt !== null &&
      parsed.exportedAt !== undefined &&
      !normalizeTimestamp(parsed.exportedAt)
    ) {
      return failure(WFC_WORLD_PERSISTENCE_STATUS.INVALID, [
        "Export time is invalid",
      ]);
    }
    candidate = parsed.snapshot;
  } else {
    warnings.push("Imported a bare snapshot without an export envelope");
  }
  const validation = validateWfcWorldSnapshot(candidate);
  return validation.ok
    ? {
        ...validation,
        status: WFC_WORLD_PERSISTENCE_STATUS.IMPORTED,
        warnings,
      }
    : validation;
}

export function exportWfcWorldSnapshotText(value) {
  const restored = restoreWfcWorldSnapshot(value);
  if (!restored.ok) {
    return {
      ...restored,
      text: null,
    };
  }
  const { snapshot, game } = restored;
  const quality = getWfcWorldQualitySummary(game);
  const terrainLine = FINGERPRINT_WORLD_TILES.filter(
    (tile) => quality.tileCounts[tile.id] > 0,
  )
    .map((tile) => `${tile.label} ${quality.tileCounts[tile.id]}`)
    .join(" · ");
  const lines = [
    `Fingerprint Worlds — ${snapshot.name}`,
    `${snapshot.state === "complete" ? "Complete world" : "Draft"} · Revision ${snapshot.revision}`,
    `Starter: ${
      getWfcWorldStarterTemplate(snapshot.world.templateId)?.name ??
      "Blank canvas"
    } · Seed: ${snapshot.world.seed}`,
  ];
  if (snapshot.state === "complete") {
    lines.push(`Quality: ${quality.tierLabel} (${quality.score}/100)`);
    lines.push(
      `${quality.terrainTypes} terrain types · ${quality.landmarkCount} landmarks · ${quality.constraintCount} authored rules`,
    );
    if (terrainLine) {
      lines.push(`Terrain: ${terrainLine}`);
    }
  } else {
    lines.push(
      `${quality.constraintCount} authored rules ready for the next generation`,
    );
  }
  lines.push(`Snapshot: ${snapshot.id}`);
  return {
    ok: true,
    status: WFC_WORLD_PERSISTENCE_STATUS.EXPORTED,
    errors: [],
    snapshot,
    text: lines.join("\n"),
  };
}

export function createEmptyWfcWorldLibrary() {
  return {
    kind: WFC_WORLD_LIBRARY_KIND,
    version: WFC_WORLD_SCHEMA_VERSION,
    revision: 0,
    snapshots: [],
  };
}

export function validateWfcWorldLibrary(value) {
  try {
    if (!isRecord(value)) {
      return {
        ok: false,
        status: WFC_WORLD_PERSISTENCE_STATUS.INVALID,
        library: null,
        errors: ["World library must be an object"],
      };
    }
    if (
      Number.isInteger(value.version) &&
      value.version > WFC_WORLD_SCHEMA_VERSION
    ) {
      return {
        ok: false,
        status: WFC_WORLD_PERSISTENCE_STATUS.UNSUPPORTED,
        library: null,
        errors: ["World library was created by a newer version"],
      };
    }
    const errors = [];
    if (value.kind !== WFC_WORLD_LIBRARY_KIND) {
      errors.push("World library kind is not recognized");
    }
    if (value.version !== 1 && value.version !== WFC_WORLD_SCHEMA_VERSION) {
      errors.push("World library version is invalid");
    }
    if (!Number.isInteger(value.revision) || value.revision < 0) {
      errors.push("World library revision is invalid");
    }
    if (!Array.isArray(value.snapshots)) {
      errors.push("World library snapshots must be an array");
    } else if (
      value.snapshots.length > WFC_WORLD_PERSISTENCE_LIMITS.maxSnapshots
    ) {
      errors.push("World library contains too many snapshots");
    }
    const snapshots = [];
    const ids = new Set();
    for (const candidate of Array.isArray(value.snapshots)
      ? value.snapshots
      : []) {
      const validation = validateWfcWorldSnapshot(candidate);
      if (!validation.ok) {
        errors.push(...validation.errors);
        continue;
      }
      if (ids.has(validation.snapshot.id)) {
        errors.push("World library contains duplicate snapshot ids");
        continue;
      }
      ids.add(validation.snapshot.id);
      snapshots.push(validation.snapshot);
    }
    if (errors.length > 0) {
      return {
        ok: false,
        status: WFC_WORLD_PERSISTENCE_STATUS.INVALID,
        library: null,
        errors,
      };
    }
    return {
      ok: true,
      status: WFC_WORLD_PERSISTENCE_STATUS.VALID,
      errors: [],
      library: {
        kind: WFC_WORLD_LIBRARY_KIND,
        version: WFC_WORLD_SCHEMA_VERSION,
        revision: value.revision,
        snapshots: sortSnapshots(snapshots),
      },
    };
  } catch {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.INVALID,
      library: null,
      errors: ["World library could not be validated"],
    };
  }
}

export function upsertWfcWorldSnapshot(libraryValue, snapshotValue) {
  const library = validateWfcWorldLibrary(libraryValue);
  if (!library.ok) {
    return library;
  }
  const snapshot = validateWfcWorldSnapshot(snapshotValue);
  if (!snapshot.ok) {
    return {
      ...snapshot,
      library: null,
    };
  }
  const existing = library.library.snapshots.find(
    (entry) => entry.id === snapshot.snapshot.id,
  );
  if (existing && snapshot.snapshot.revision < existing.revision) {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.STALE_REVISION,
      library: library.library,
      snapshot: existing,
      errors: ["A newer revision is already saved"],
    };
  }
  if (
    existing &&
    snapshot.snapshot.revision === existing.revision &&
    JSON.stringify(snapshot.snapshot) === JSON.stringify(existing)
  ) {
    return {
      ok: true,
      status: WFC_WORLD_PERSISTENCE_STATUS.UNCHANGED,
      library: library.library,
      snapshot: existing,
      errors: [],
    };
  }
  if (existing && snapshot.snapshot.revision === existing.revision) {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.STALE_REVISION,
      library: library.library,
      snapshot: existing,
      errors: ["Conflicting content uses the same snapshot revision"],
    };
  }
  if (
    !existing &&
    library.library.snapshots.length >=
      WFC_WORLD_PERSISTENCE_LIMITS.maxSnapshots
  ) {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.LIMIT_REACHED,
      library: library.library,
      snapshot: null,
      errors: ["World library is full"],
    };
  }
  const snapshots = sortSnapshots([
    ...library.library.snapshots.filter(
      (entry) => entry.id !== snapshot.snapshot.id,
    ),
    snapshot.snapshot,
  ]);
  return {
    ok: true,
    status: WFC_WORLD_PERSISTENCE_STATUS.SAVED,
    errors: [],
    snapshot: snapshot.snapshot,
    library: {
      ...library.library,
      revision: library.library.revision + 1,
      snapshots,
    },
  };
}

export function removeWfcWorldSnapshot(libraryValue, snapshotId) {
  const validation = validateWfcWorldLibrary(libraryValue);
  if (!validation.ok) {
    return validation;
  }
  const snapshots = validation.library.snapshots.filter(
    (snapshot) => snapshot.id !== snapshotId,
  );
  if (snapshots.length === validation.library.snapshots.length) {
    return {
      ok: true,
      status: WFC_WORLD_PERSISTENCE_STATUS.UNCHANGED,
      errors: [],
      library: validation.library,
    };
  }
  return {
    ok: true,
    status: WFC_WORLD_PERSISTENCE_STATUS.REMOVED,
    errors: [],
    library: {
      ...validation.library,
      revision: validation.library.revision + 1,
      snapshots,
    },
  };
}

export function serializeWfcWorldLibrary(libraryValue) {
  const validation = validateWfcWorldLibrary(libraryValue);
  if (!validation.ok) {
    return {
      ...validation,
      json: null,
      byteLength: 0,
    };
  }
  const json = JSON.stringify(validation.library);
  const byteLength = utf8ByteLength(json);
  if (byteLength > WFC_WORLD_PERSISTENCE_LIMITS.maxLibraryBytes) {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.TOO_LARGE,
      library: validation.library,
      errors: ["World library is too large"],
      json: null,
      byteLength,
    };
  }
  return {
    ok: true,
    status: WFC_WORLD_PERSISTENCE_STATUS.EXPORTED,
    errors: [],
    library: validation.library,
    json,
    byteLength,
  };
}

export function parseWfcWorldLibraryJSON(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return {
      ok: true,
      status: WFC_WORLD_PERSISTENCE_STATUS.EMPTY,
      errors: [],
      library: createEmptyWfcWorldLibrary(),
    };
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.INVALID,
      errors: ["World library must be JSON text"],
      library: null,
    };
  }
  if (utf8ByteLength(raw) > WFC_WORLD_PERSISTENCE_LIMITS.maxImportBytes) {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.TOO_LARGE,
      errors: ["World library is too large"],
      library: null,
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      status: WFC_WORLD_PERSISTENCE_STATUS.INVALID,
      errors: ["World library is not valid JSON"],
      library: null,
    };
  }
  const validation = validateWfcWorldLibrary(parsed);
  return validation.ok
    ? {
        ...validation,
        status: WFC_WORLD_PERSISTENCE_STATUS.IMPORTED,
      }
    : validation;
}
