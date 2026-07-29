export const CREATIVE_GALLERY_SCHEMA_VERSION = 2;
export const CREATIVE_GALLERY_EXPORT_KIND =
  "motion-arcade-creative-gallery";
export const CREATIVE_GALLERY_STORAGE_KEY = "motionArcade.creativeGallery";

export const CREATIVE_GALLERY_MODE_IDS = Object.freeze([
  "gesture-art",
  "jam-studio",
  "visualizer",
  "world-painter",
]);

export const CREATIVE_GALLERY_LIMITS = Object.freeze({
  maxEntries: 64,
  maxEntriesPerMode: 20,
  maxCandidateEntries: 256,
  maxImportBytes: 256 * 1024,
  maxExportBytes: 256 * 1024,
  maxStorageBytes: 384 * 1024,
  maxTitleLength: 80,
  maxDescriptionLength: 240,
  maxTags: 8,
  maxTagLength: 32,
  maxMetadataFields: 24,
  maxMetadataKeyLength: 32,
  maxMetadataStringLength: 160,
  maxReferenceKeyLength: 240,
  maxReferencedAssetBytes: 100 * 1024 * 1024,
  maxPaletteColors: 8,
  maxCanvasDimension: 16_384,
});

export const CREATIVE_GALLERY_STATUS = Object.freeze({
  LOADED: "loaded",
  EMPTY: "empty",
  MIGRATED: "migrated",
  RECOVERED: "recovered",
  SAVED: "saved",
  RENAMED: "renamed",
  DELETED: "deleted",
  CLEARED: "cleared",
  EXPORTED: "exported",
  IMPORTED: "imported",
  UNAVAILABLE: "unavailable",
  INVALID: "invalid",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
  WRITE_BLOCKED: "write-blocked",
  TOO_LARGE: "too-large",
  QUOTA_EXCEEDED: "quota-exceeded",
  VALIDATION_FAILED: "validation-failed",
  NOT_FOUND: "not-found",
});

const SUPPORTED_MODE_IDS = new Set(CREATIVE_GALLERY_MODE_IDS);
const REFERENCE_KINDS = new Set(["indexeddb", "opfs", "app-storage"]);
const THUMBNAIL_KINDS = new Set(["palette", "reference"]);
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const SAFE_REFERENCE_KEY_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/i;
const SAFE_METADATA_KEY_PATTERN = /^[a-z][a-z0-9_-]*$/i;
const SAFE_MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const SAFE_CHECKSUM_PATTERN = /^sha(?:256|384|512):[a-f0-9]{16,128}$/i;
const COLOR_PATTERN =
  /^#(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/i;
const FALLBACK_TITLES = Object.freeze({
  "gesture-art": "Untitled artwork",
  "jam-studio": "Untitled jam",
  visualizer: "Untitled capture",
  "world-painter": "Untitled world",
});

let generatedIdSequence = 0;

export class UnsupportedCreativeGalleryVersionError extends Error {
  constructor(version) {
    super(`Creative Gallery schema version ${version} is not supported.`);
    this.name = "UnsupportedCreativeGalleryVersionError";
    this.version = version;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveNow(now) {
  let value;
  try {
    value = typeof now === "function" ? now() : now;
  } catch {
    value = undefined;
  }
  try {
    const date = value === undefined ? new Date() : new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toISOString()
      : new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function normalizeTimestamp(value, fallback) {
  try {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
  } catch {
    return fallback;
  }
}

function unicodeSlice(value, maxLength) {
  return [...value].slice(0, maxLength).join("");
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return unicodeSlice(
    value
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    maxLength,
  );
}

function utf8ByteLength(value) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function normalizeId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const id = value.trim();
  return SAFE_ID_PATTERN.test(id) && !RESERVED_KEYS.has(id.toLowerCase())
    ? id
    : null;
}

function makeDefaultId(modeId, timestamp) {
  generatedIdSequence += 1;
  const epoch = Date.parse(timestamp);
  const timePart = Number.isFinite(epoch) ? epoch.toString(36) : "0";
  return `${modeId}-${timePart}-${generatedIdSequence.toString(36)}`;
}

function callIdFactory(idFactory, context) {
  if (typeof idFactory !== "function") {
    return null;
  }
  try {
    return normalizeId(idFactory(context));
  } catch {
    return null;
  }
}

function uniqueId(candidate, usedIds) {
  const normalized = normalizeId(candidate);
  if (normalized && !usedIds.has(normalized)) {
    return normalized;
  }
  const base = unicodeSlice(normalized ?? "gallery-item", 70);
  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const next = `${base}-${suffix}`;
    if (!usedIds.has(next)) {
      return next;
    }
  }
  return null;
}

function sanitizeTags(value, warnings) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    warnings.push("tags-invalid");
    return [];
  }

  const tags = [];
  const seen = new Set();
  for (const rawTag of value.slice(0, CREATIVE_GALLERY_LIMITS.maxTags * 2)) {
    const tag = sanitizeText(rawTag, CREATIVE_GALLERY_LIMITS.maxTagLength);
    const identity = tag.toLocaleLowerCase();
    if (!tag || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    tags.push(tag);
    if (tags.length === CREATIVE_GALLERY_LIMITS.maxTags) {
      break;
    }
  }
  if (tags.length !== value.length) {
    warnings.push("tags-sanitized");
  }
  return tags;
}

function sanitizeMetadata(value, warnings) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    warnings.push("metadata-invalid");
    return {};
  }

  const metadata = {};
  let accepted = 0;
  let inspected = 0;
  for (const [rawKey, rawValue] of Object.entries(value)) {
    inspected += 1;
    if (inspected > CREATIVE_GALLERY_LIMITS.maxMetadataFields * 2) {
      warnings.push("metadata-truncated");
      break;
    }
    const key = rawKey.trim();
    if (
      key.length > CREATIVE_GALLERY_LIMITS.maxMetadataKeyLength ||
      !SAFE_METADATA_KEY_PATTERN.test(key) ||
      RESERVED_KEYS.has(key.toLowerCase())
    ) {
      warnings.push("metadata-field-removed");
      continue;
    }

    let normalizedValue;
    if (typeof rawValue === "string") {
      normalizedValue = sanitizeText(
        rawValue,
        CREATIVE_GALLERY_LIMITS.maxMetadataStringLength,
      );
    } else if (typeof rawValue === "boolean") {
      normalizedValue = rawValue;
    } else if (
      typeof rawValue === "number" &&
      Number.isFinite(rawValue) &&
      Math.abs(rawValue) <= Number.MAX_SAFE_INTEGER
    ) {
      normalizedValue = rawValue;
    } else {
      warnings.push("metadata-field-removed");
      continue;
    }

    Object.defineProperty(metadata, key, {
      configurable: true,
      enumerable: true,
      value: normalizedValue,
      writable: true,
    });
    accepted += 1;
    if (accepted === CREATIVE_GALLERY_LIMITS.maxMetadataFields) {
      if (inspected < Object.keys(value).length) {
        warnings.push("metadata-truncated");
      }
      break;
    }
  }
  return metadata;
}

function legacyReferenceFromString(value) {
  if (typeof value !== "string") {
    return value;
  }
  const match = /^(indexeddb|opfs|app-storage):(.+)$/i.exec(value.trim());
  if (!match) {
    return value;
  }
  return {
    kind: match[1].toLowerCase(),
    key: match[2],
  };
}

function sanitizeDataReference(value, warnings, warningPrefix) {
  if (value === undefined || value === null) {
    return null;
  }
  const candidate = legacyReferenceFromString(value);
  if (!isRecord(candidate)) {
    warnings.push(`${warningPrefix}-invalid`);
    return null;
  }

  const kind =
    typeof candidate.kind === "string" ? candidate.kind.toLowerCase() : "";
  const key =
    typeof candidate.key === "string" ? candidate.key.trim() : "";
  if (
    !REFERENCE_KINDS.has(kind) ||
    key.length === 0 ||
    key.length > CREATIVE_GALLERY_LIMITS.maxReferenceKeyLength ||
    !SAFE_REFERENCE_KEY_PATTERN.test(key) ||
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("//")
  ) {
    warnings.push(`${warningPrefix}-invalid`);
    return null;
  }

  const reference = { kind, key };
  if (candidate.mediaType !== undefined && candidate.mediaType !== null) {
    const mediaType =
      typeof candidate.mediaType === "string"
        ? candidate.mediaType.trim().toLowerCase()
        : "";
    if (
      mediaType.length <= 96 &&
      SAFE_MEDIA_TYPE_PATTERN.test(mediaType)
    ) {
      reference.mediaType = mediaType;
    } else {
      warnings.push(`${warningPrefix}-media-type-removed`);
    }
  }

  if (candidate.byteLength !== undefined && candidate.byteLength !== null) {
    const byteLength = safeInteger(
      candidate.byteLength,
      0,
      CREATIVE_GALLERY_LIMITS.maxReferencedAssetBytes,
    );
    if (byteLength !== null) {
      reference.byteLength = byteLength;
    } else {
      warnings.push(`${warningPrefix}-byte-length-removed`);
    }
  }

  if (candidate.checksum !== undefined && candidate.checksum !== null) {
    const checksum =
      typeof candidate.checksum === "string"
        ? candidate.checksum.trim().toLowerCase()
        : "";
    if (SAFE_CHECKSUM_PATTERN.test(checksum)) {
      reference.checksum = checksum;
    } else {
      warnings.push(`${warningPrefix}-checksum-removed`);
    }
  }
  if (candidate.availability === "unresolved") {
    reference.availability = "unresolved";
  }

  return reference;
}

function sanitizePalette(value, warnings) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    warnings.push("thumbnail-palette-invalid");
    return [];
  }
  const palette = [];
  const seen = new Set();
  for (const rawColor of value.slice(
    0,
    CREATIVE_GALLERY_LIMITS.maxPaletteColors * 2,
  )) {
    const color =
      typeof rawColor === "string" ? rawColor.trim().toLowerCase() : "";
    if (!COLOR_PATTERN.test(color) || seen.has(color)) {
      continue;
    }
    seen.add(color);
    palette.push(color);
    if (palette.length === CREATIVE_GALLERY_LIMITS.maxPaletteColors) {
      break;
    }
  }
  if (palette.length !== value.length) {
    warnings.push("thumbnail-palette-sanitized");
  }
  return palette;
}

function sanitizeThumbnail(value, warnings) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    warnings.push("thumbnail-invalid");
    return null;
  }

  const palette = sanitizePalette(value.palette, warnings);
  const dataRef = sanitizeDataReference(
    value.dataRef,
    warnings,
    "thumbnail-reference",
  );
  let kind =
    typeof value.kind === "string" ? value.kind.trim().toLowerCase() : "";
  if (!THUMBNAIL_KINDS.has(kind)) {
    kind = dataRef ? "reference" : palette.length > 0 ? "palette" : "";
    warnings.push("thumbnail-kind-sanitized");
  }
  if (
    !kind ||
    (kind === "reference" && !dataRef) ||
    (kind === "palette" && palette.length === 0)
  ) {
    warnings.push("thumbnail-removed");
    return null;
  }

  const width = safeInteger(
    value.width,
    1,
    CREATIVE_GALLERY_LIMITS.maxCanvasDimension,
  );
  const height = safeInteger(
    value.height,
    1,
    CREATIVE_GALLERY_LIMITS.maxCanvasDimension,
  );
  if (
    (value.width !== undefined && width === null) ||
    (value.height !== undefined && height === null)
  ) {
    warnings.push("thumbnail-dimensions-sanitized");
  }

  return {
    kind,
    width,
    height,
    palette,
    dataRef,
  };
}

function coerceLegacyEntry(rawEntry) {
  if (!isRecord(rawEntry)) {
    return rawEntry;
  }
  let thumbnail = rawEntry.thumbnail;
  if (!thumbnail && rawEntry.previewRef) {
    thumbnail = {
      kind: "reference",
      dataRef: legacyReferenceFromString(rawEntry.previewRef),
    };
  }
  return {
    id: rawEntry.id,
    modeId: rawEntry.modeId ?? rawEntry.mode ?? rawEntry.type,
    title: rawEntry.title ?? rawEntry.name,
    description: rawEntry.description,
    createdAt: rawEntry.createdAt ?? rawEntry.savedAt,
    updatedAt: rawEntry.updatedAt ?? rawEntry.savedAt,
    tags: rawEntry.tags,
    metadata: rawEntry.metadata,
    thumbnail,
    dataRef:
      rawEntry.dataRef ??
      legacyReferenceFromString(rawEntry.contentRef ?? rawEntry.assetRef),
  };
}

function sanitizeEntryDetailed(
  rawValue,
  {
    fallbackNow,
    idFactory,
    index = 0,
    recoverInvalidId = false,
    legacy = false,
  },
) {
  const warnings = [];
  const errors = [];
  const value = legacy ? coerceLegacyEntry(rawValue) : rawValue;
  if (!isRecord(value)) {
    return {
      entry: null,
      errors: ["entry-invalid"],
      warnings,
    };
  }

  const modeId =
    typeof value.modeId === "string" ? value.modeId.trim() : "";
  if (!SUPPORTED_MODE_IDS.has(modeId)) {
    errors.push("mode-id-invalid");
  }

  let id = normalizeId(value.id);
  if (!id && recoverInvalidId && SUPPORTED_MODE_IDS.has(modeId)) {
    id =
      callIdFactory(idFactory, {
        index,
        modeId,
        entry: value,
        purpose: "recovery",
      }) ?? `${modeId}-recovered-${index + 1}`;
    id = normalizeId(id);
    warnings.push("id-recovered");
  } else if (!id) {
    errors.push("id-invalid");
  }
  if (errors.length > 0) {
    return { entry: null, errors, warnings };
  }

  const rawTitle = sanitizeText(
    value.title,
    CREATIVE_GALLERY_LIMITS.maxTitleLength,
  );
  const title = rawTitle || FALLBACK_TITLES[modeId];
  if (title !== value.title) {
    warnings.push("title-sanitized");
  }
  const description = sanitizeText(
    value.description,
    CREATIVE_GALLERY_LIMITS.maxDescriptionLength,
  );
  if (
    value.description !== undefined &&
    description !== value.description
  ) {
    warnings.push("description-sanitized");
  }

  const createdAt = normalizeTimestamp(value.createdAt, fallbackNow);
  let updatedAt = normalizeTimestamp(value.updatedAt, createdAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    updatedAt = createdAt;
    warnings.push("timestamps-sanitized");
  }
  if (createdAt !== value.createdAt || updatedAt !== value.updatedAt) {
    warnings.push("timestamps-sanitized");
  }

  const dataWarningsBefore = warnings.length;
  const dataRef = sanitizeDataReference(
    value.dataRef,
    warnings,
    "data-reference",
  );
  const thumbnail = sanitizeThumbnail(value.thumbnail, warnings);

  return {
    entry: {
      id,
      modeId,
      title,
      description,
      createdAt,
      updatedAt,
      tags: sanitizeTags(value.tags, warnings),
      metadata: sanitizeMetadata(value.metadata, warnings),
      thumbnail,
      dataRef,
    },
    errors,
    warnings,
    invalidReference:
      value.dataRef != null &&
      dataRef === null &&
      warnings.length > dataWarningsBefore,
  };
}

/**
 * Sanitizes an entry without persisting it. Store saves reject malformed IDs,
 * unsupported modes, and unsafe data references; harmless display metadata is
 * normalized and reported as warnings.
 */
export function sanitizeCreativeGalleryEntry(
  value,
  { now, idFactory, recoverInvalidId = false } = {},
) {
  const result = sanitizeEntryDetailed(value, {
    fallbackNow: resolveNow(now),
    idFactory,
    recoverInvalidId,
  });
  return {
    ok: Boolean(result.entry) && !result.invalidReference,
    entry: result.entry ? clone(result.entry) : null,
    errors: result.invalidReference
      ? [...result.errors, "data-reference-invalid"]
      : [...result.errors],
    warnings: [...result.warnings],
  };
}

export function createEmptyCreativeGallery({ now } = {}) {
  return {
    version: CREATIVE_GALLERY_SCHEMA_VERSION,
    revision: 0,
    updatedAt: now === undefined ? null : resolveNow(now),
    entries: [],
  };
}

function compareEntriesNewestFirst(left, right) {
  const timeDifference =
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  return timeDifference || left.id.localeCompare(right.id);
}

function normalizeGalleryDetailed(value, { now, idFactory } = {}) {
  if (!isRecord(value)) {
    throw new TypeError("Creative Gallery payload must be an object.");
  }
  const fallbackNow = resolveNow(now);
  const hasExplicitVersion = Object.prototype.hasOwnProperty.call(
    value,
    "version",
  );
  if (hasExplicitVersion && !Number.isInteger(value.version)) {
    throw new TypeError("Creative Gallery schema version must be an integer.");
  }
  const storedVersion = hasExplicitVersion ? value.version : 0;
  if (storedVersion > CREATIVE_GALLERY_SCHEMA_VERSION) {
    throw new UnsupportedCreativeGalleryVersionError(storedVersion);
  }
  if (storedVersion < 0) {
    throw new TypeError("Creative Gallery schema version is invalid.");
  }

  const legacy = storedVersion < CREATIVE_GALLERY_SCHEMA_VERSION;
  const sourceEntries = legacy
    ? Array.isArray(value.items)
      ? value.items
      : value.entries
    : value.entries;
  if (!Array.isArray(sourceEntries)) {
    throw new TypeError("Creative Gallery entries must be an array.");
  }

  const warnings = [];
  const normalizedEntries = [];
  const candidateEntries = sourceEntries.slice(
    0,
    CREATIVE_GALLERY_LIMITS.maxCandidateEntries,
  );
  if (candidateEntries.length !== sourceEntries.length) {
    warnings.push({
      code: "candidate-limit",
      skipped: sourceEntries.length - candidateEntries.length,
    });
  }

  for (let index = 0; index < candidateEntries.length; index += 1) {
    const result = sanitizeEntryDetailed(candidateEntries[index], {
      fallbackNow,
      idFactory,
      index,
      recoverInvalidId: true,
      legacy,
    });
    if (!result.entry) {
      warnings.push({
        code: "entry-skipped",
        index,
        reasons: result.errors,
      });
      continue;
    }
    if (result.warnings.length > 0) {
      warnings.push({
        code: "entry-sanitized",
        index,
        reasons: result.warnings,
      });
    }
    normalizedEntries.push(result.entry);
  }

  normalizedEntries.sort(compareEntriesNewestFirst);
  const entries = [];
  const perModeCounts = new Map();
  const usedIds = new Set();
  for (const entry of normalizedEntries) {
    if (entries.length === CREATIVE_GALLERY_LIMITS.maxEntries) {
      warnings.push({ code: "total-quota", skipped: 1 });
      continue;
    }
    const modeCount = perModeCounts.get(entry.modeId) ?? 0;
    if (modeCount === CREATIVE_GALLERY_LIMITS.maxEntriesPerMode) {
      warnings.push({
        code: "mode-quota",
        modeId: entry.modeId,
        skipped: 1,
      });
      continue;
    }
    const resolvedId = uniqueId(entry.id, usedIds);
    if (!resolvedId) {
      warnings.push({ code: "entry-skipped", reasons: ["id-collision"] });
      continue;
    }
    if (resolvedId !== entry.id) {
      warnings.push({ code: "id-collision-recovered", previousId: entry.id });
    }
    usedIds.add(resolvedId);
    perModeCounts.set(entry.modeId, modeCount + 1);
    entries.push({ ...entry, id: resolvedId });
  }

  const latestEntryTimestamp = entries[0]?.updatedAt ?? null;
  let normalizedUpdatedAt =
    value.updatedAt === null || value.updatedAt === undefined
      ? latestEntryTimestamp
      : normalizeTimestamp(value.updatedAt, latestEntryTimestamp ?? fallbackNow);
  if (
    value.updatedAt !== null &&
    value.updatedAt !== undefined &&
    normalizedUpdatedAt !== value.updatedAt
  ) {
    warnings.push({ code: "updated-at-sanitized" });
  }
  if (
    latestEntryTimestamp &&
    (!normalizedUpdatedAt ||
      Date.parse(normalizedUpdatedAt) < Date.parse(latestEntryTimestamp))
  ) {
    normalizedUpdatedAt = latestEntryTimestamp;
    warnings.push({ code: "updated-at-recovered" });
  }
  if (
    value.revision !== undefined &&
    safeRevision(value.revision) !== value.revision
  ) {
    warnings.push({ code: "revision-sanitized" });
  }

  return {
    gallery: {
      version: CREATIVE_GALLERY_SCHEMA_VERSION,
      revision: safeRevision(value.revision),
      updatedAt: normalizedUpdatedAt,
      entries,
    },
    storedVersion,
    migrated: legacy,
    recovered: warnings.length > 0,
    warnings,
  };
}

export function migrateCreativeGallery(value, options) {
  return normalizeGalleryDetailed(value, options).gallery;
}

function readFailure(status, now, storedVersion = null) {
  return {
    gallery: createEmptyCreativeGallery(),
    status,
    storedVersion,
    migrated: false,
    recovered: false,
    warnings: [],
  };
}

/**
 * Reads the gallery without throwing. Oversized input is rejected before
 * JSON.parse, and a bad entry cannot make otherwise valid work disappear.
 */
export function readCreativeGallery(storage, { now, idFactory } = {}) {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage?.getItem) {
    return readFailure(CREATIVE_GALLERY_STATUS.UNAVAILABLE, now);
  }

  let raw;
  try {
    raw = resolvedStorage.getItem(CREATIVE_GALLERY_STORAGE_KEY);
  } catch {
    return readFailure(CREATIVE_GALLERY_STATUS.UNAVAILABLE, now);
  }
  if (raw === null || raw === undefined || raw === "") {
    return readFailure(CREATIVE_GALLERY_STATUS.EMPTY, now);
  }
  if (
    typeof raw !== "string" ||
    utf8ByteLength(raw) > CREATIVE_GALLERY_LIMITS.maxStorageBytes
  ) {
    return readFailure(CREATIVE_GALLERY_STATUS.TOO_LARGE, now);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return readFailure(CREATIVE_GALLERY_STATUS.INVALID, now);
  }
  const storedVersion = Number.isInteger(parsed?.version)
    ? parsed.version
    : 0;
  try {
    const normalized = normalizeGalleryDetailed(parsed, { now, idFactory });
    return {
      ...normalized,
      status: normalized.recovered
        ? CREATIVE_GALLERY_STATUS.RECOVERED
        : normalized.migrated
          ? CREATIVE_GALLERY_STATUS.MIGRATED
          : CREATIVE_GALLERY_STATUS.LOADED,
    };
  } catch (error) {
    return readFailure(
      error instanceof UnsupportedCreativeGalleryVersionError
        ? CREATIVE_GALLERY_STATUS.UNSUPPORTED
        : CREATIVE_GALLERY_STATUS.INVALID,
      now,
      storedVersion,
    );
  }
}

export function loadCreativeGallery(storage, options) {
  return readCreativeGallery(storage, options).gallery;
}

export function writeCreativeGallery(gallery, storage, { now, idFactory } = {}) {
  const resolvedStorage = resolveStorage(storage);
  let normalized;
  try {
    normalized = normalizeGalleryDetailed(gallery, { now, idFactory });
  } catch (error) {
    return {
      gallery: createEmptyCreativeGallery(),
      status:
        error instanceof UnsupportedCreativeGalleryVersionError
          ? CREATIVE_GALLERY_STATUS.WRITE_BLOCKED
          : CREATIVE_GALLERY_STATUS.INVALID,
    };
  }
  if (normalized.recovered) {
    return {
      gallery: normalized.gallery,
      status: CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
      warnings: normalized.warnings,
    };
  }
  normalized = normalized.gallery;

  let serialized;
  try {
    serialized = JSON.stringify(normalized);
  } catch {
    return {
      gallery: normalized,
      status: CREATIVE_GALLERY_STATUS.INVALID,
    };
  }
  if (utf8ByteLength(serialized) > CREATIVE_GALLERY_LIMITS.maxStorageBytes) {
    return {
      gallery: normalized,
      status: CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
    };
  }
  if (!resolvedStorage?.setItem) {
    return {
      gallery: normalized,
      status: CREATIVE_GALLERY_STATUS.UNAVAILABLE,
    };
  }
  try {
    resolvedStorage.setItem(CREATIVE_GALLERY_STORAGE_KEY, serialized);
    return {
      gallery: normalized,
      status: CREATIVE_GALLERY_STATUS.SAVED,
    };
  } catch {
    return {
      gallery: normalized,
      status: CREATIVE_GALLERY_STATUS.FAILED,
    };
  }
}

export function removeCreativeGallery(storage) {
  const resolvedStorage = resolveStorage(storage);
  const gallery = createEmptyCreativeGallery();
  if (!resolvedStorage?.removeItem) {
    return {
      gallery,
      status: CREATIVE_GALLERY_STATUS.UNAVAILABLE,
    };
  }
  try {
    resolvedStorage.removeItem(CREATIVE_GALLERY_STORAGE_KEY);
    return {
      gallery,
      status: CREATIVE_GALLERY_STATUS.CLEARED,
    };
  } catch {
    return {
      gallery,
      status: CREATIVE_GALLERY_STATUS.FAILED,
    };
  }
}

function selectExportEntries(gallery, { modeId, entryIds } = {}) {
  if (modeId !== undefined && !SUPPORTED_MODE_IDS.has(modeId)) {
    return null;
  }
  let selectedIds = null;
  if (entryIds !== undefined) {
    if (
      !Array.isArray(entryIds) ||
      entryIds.length > CREATIVE_GALLERY_LIMITS.maxEntries
    ) {
      return null;
    }
    selectedIds = new Set();
    for (const id of entryIds) {
      const normalizedId = normalizeId(id);
      if (!normalizedId) {
        return null;
      }
      selectedIds.add(normalizedId);
    }
  }
  return gallery.entries.filter(
    (entry) =>
      (modeId === undefined || entry.modeId === modeId) &&
      (selectedIds === null || selectedIds.has(entry.id)),
  );
}

/**
 * Exports a manifest only. Binary creative data and rendered thumbnails remain
 * outside localStorage; the JSON records typed references to those assets.
 */
export function exportCreativeGalleryJSON(
  gallery,
  { now, modeId, entryIds } = {},
) {
  let normalized;
  try {
    normalized = normalizeGalleryDetailed(gallery, { now });
  } catch (error) {
    return {
      ok: false,
      status:
        error instanceof UnsupportedCreativeGalleryVersionError
          ? CREATIVE_GALLERY_STATUS.UNSUPPORTED
          : CREATIVE_GALLERY_STATUS.INVALID,
      json: null,
      byteLength: 0,
    };
  }
  if (normalized.recovered) {
    return {
      ok: false,
      status: CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
      json: null,
      byteLength: 0,
      warnings: normalized.warnings,
    };
  }
  normalized = normalized.gallery;
  const entries = selectExportEntries(normalized, { modeId, entryIds });
  if (!entries) {
    return {
      ok: false,
      status: CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
      json: null,
      byteLength: 0,
    };
  }

  const envelope = {
    kind: CREATIVE_GALLERY_EXPORT_KIND,
    version: CREATIVE_GALLERY_SCHEMA_VERSION,
    exportedAt: resolveNow(now),
    contentIncluded: false,
    assetReferences: "local-only",
    entryCount: entries.length,
    entries,
  };
  const json = JSON.stringify(envelope, null, 2);
  const byteLength = utf8ByteLength(json);
  if (byteLength > CREATIVE_GALLERY_LIMITS.maxExportBytes) {
    return {
      ok: false,
      status: CREATIVE_GALLERY_STATUS.TOO_LARGE,
      json: null,
      byteLength,
    };
  }
  return {
    ok: true,
    status: CREATIVE_GALLERY_STATUS.EXPORTED,
    json,
    byteLength,
    entryCount: entries.length,
  };
}

/**
 * Parses and sanitizes an export manifest, but does not merge it into a store.
 * The byte limit is checked before parsing to bound memory and CPU work.
 */
export function importCreativeGalleryJSON(raw, { now, idFactory } = {}) {
  if (
    typeof raw !== "string" ||
    utf8ByteLength(raw) > CREATIVE_GALLERY_LIMITS.maxImportBytes
  ) {
    return {
      ok: false,
      status:
        typeof raw === "string"
          ? CREATIVE_GALLERY_STATUS.TOO_LARGE
          : CREATIVE_GALLERY_STATUS.INVALID,
      gallery: null,
      warnings: [],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      status: CREATIVE_GALLERY_STATUS.INVALID,
      gallery: null,
      warnings: [],
    };
  }
  if (
    !isRecord(parsed) ||
    parsed.kind !== CREATIVE_GALLERY_EXPORT_KIND ||
    parsed.contentIncluded !== false
  ) {
    return {
      ok: false,
      status: CREATIVE_GALLERY_STATUS.INVALID,
      gallery: null,
      warnings: [],
    };
  }

  if (!Number.isInteger(parsed.version)) {
    return {
      ok: false,
      status: CREATIVE_GALLERY_STATUS.INVALID,
      gallery: null,
      warnings: [],
    };
  }
  const storedVersion = parsed.version;
  if (storedVersion <= CREATIVE_GALLERY_SCHEMA_VERSION) {
    const manifestEntries =
      storedVersion < CREATIVE_GALLERY_SCHEMA_VERSION &&
      Array.isArray(parsed.items)
        ? parsed.items
        : parsed.entries;
    const entryCountIsValid =
      Number.isInteger(parsed.entryCount) &&
      parsed.entryCount >= 0 &&
      parsed.entryCount <= CREATIVE_GALLERY_LIMITS.maxCandidateEntries &&
      Array.isArray(manifestEntries) &&
      parsed.entryCount === manifestEntries.length;
    if (
      (storedVersion === CREATIVE_GALLERY_SCHEMA_VERSION &&
        !entryCountIsValid) ||
      (parsed.entryCount !== undefined && !entryCountIsValid)
    ) {
      return {
        ok: false,
        status: CREATIVE_GALLERY_STATUS.INVALID,
        gallery: null,
        warnings: [],
        storedVersion,
      };
    }
  }
  try {
    const normalized = normalizeGalleryDetailed(
      {
        version: storedVersion,
        revision: 0,
        updatedAt: parsed.exportedAt,
        entries: parsed.entries,
        items: parsed.items,
      },
      { now, idFactory },
    );
    const sourceEntries =
      storedVersion < CREATIVE_GALLERY_SCHEMA_VERSION &&
      Array.isArray(parsed.items)
        ? parsed.items
        : parsed.entries;
    if (
      Array.isArray(sourceEntries) &&
      sourceEntries.length > 0 &&
      normalized.gallery.entries.length === 0
    ) {
      return {
        ok: false,
        status: CREATIVE_GALLERY_STATUS.INVALID,
        gallery: null,
        warnings: normalized.warnings,
        storedVersion,
      };
    }
    const gallery = {
      ...normalized.gallery,
      entries: normalized.gallery.entries.map((entry) => ({
        ...entry,
        dataRef: entry.dataRef
          ? { ...entry.dataRef, availability: "unresolved" }
          : null,
        thumbnail: entry.thumbnail
          ? {
              ...entry.thumbnail,
              dataRef: entry.thumbnail.dataRef
                ? {
                    ...entry.thumbnail.dataRef,
                    availability: "unresolved",
                  }
                : null,
            }
          : null,
      })),
    };
    return {
      ok: true,
      status: normalized.recovered
        ? CREATIVE_GALLERY_STATUS.RECOVERED
        : normalized.migrated
          ? CREATIVE_GALLERY_STATUS.MIGRATED
          : CREATIVE_GALLERY_STATUS.IMPORTED,
      gallery,
      warnings: normalized.warnings,
      storedVersion,
    };
  } catch (error) {
    return {
      ok: false,
      status:
        error instanceof UnsupportedCreativeGalleryVersionError
          ? CREATIVE_GALLERY_STATUS.UNSUPPORTED
          : CREATIVE_GALLERY_STATUS.INVALID,
      gallery: null,
      warnings: [],
      storedVersion,
    };
  }
}

function galleryFitsStorage(gallery) {
  try {
    return (
      utf8ByteLength(JSON.stringify(gallery)) <=
      CREATIVE_GALLERY_LIMITS.maxStorageBytes
    );
  } catch {
    return false;
  }
}

function countEntriesForMode(entries, modeId) {
  let count = 0;
  for (const entry of entries) {
    if (entry.modeId === modeId) {
      count += 1;
    }
  }
  return count;
}

function mutationFailure(status, gallery, details = {}) {
  return {
    ok: false,
    status,
    gallery: clone(gallery),
    ...details,
  };
}

/**
 * Framework-agnostic local gallery store. Persistence failures do not discard
 * the current session's in-memory work, while future-version storage remains
 * untouched until the user explicitly clears it.
 */
export function createCreativeGalleryStore({
  storage,
  now = () => new Date().toISOString(),
  idFactory,
} = {}) {
  const initialRead = readCreativeGallery(storage, {
    now: resolveNow(now),
    idFactory,
  });
  let gallery = initialRead.gallery;
  let persistenceStatus = initialRead.status;
  let writesBlocked =
    initialRead.status === CREATIVE_GALLERY_STATUS.UNSUPPORTED ||
    initialRead.status === CREATIVE_GALLERY_STATUS.INVALID ||
    initialRead.status === CREATIVE_GALLERY_STATUS.TOO_LARGE;
  let localIdSequence = 0;
  const listeners = new Set();

  function timestamp() {
    return resolveNow(now);
  }

  function getState() {
    return clone(gallery);
  }

  function getPersistenceStatus() {
    return persistenceStatus;
  }

  function refreshFromPersistence() {
    if (writesBlocked) {
      return;
    }
    const latest = readCreativeGallery(storage, {
      now: timestamp(),
      idFactory,
    });
    if (
      latest.status === CREATIVE_GALLERY_STATUS.UNSUPPORTED ||
      latest.status === CREATIVE_GALLERY_STATUS.INVALID ||
      latest.status === CREATIVE_GALLERY_STATUS.TOO_LARGE
    ) {
      writesBlocked = true;
      persistenceStatus = latest.status;
      return;
    }
    // This catches ordinary stale stores before a mutation. localStorage has no
    // atomic compare-and-swap, so truly simultaneous cross-tab writes still
    // need a Web Lock or an integration-level single-writer coordinator.
    if (
      latest.status === CREATIVE_GALLERY_STATUS.LOADED ||
      latest.status === CREATIVE_GALLERY_STATUS.MIGRATED ||
      latest.status === CREATIVE_GALLERY_STATUS.RECOVERED
    ) {
      const latestUpdatedAt = Date.parse(latest.gallery.updatedAt ?? 0);
      const localUpdatedAt = Date.parse(gallery.updatedAt ?? 0);
      if (
        latest.gallery.revision > gallery.revision ||
        (latest.gallery.revision === gallery.revision &&
          latestUpdatedAt > localUpdatedAt)
      ) {
        gallery = latest.gallery;
        persistenceStatus = latest.status;
      }
    } else if (
      latest.status === CREATIVE_GALLERY_STATUS.EMPTY &&
      (persistenceStatus === CREATIVE_GALLERY_STATUS.LOADED ||
        persistenceStatus === CREATIVE_GALLERY_STATUS.MIGRATED ||
        persistenceStatus === CREATIVE_GALLERY_STATUS.RECOVERED ||
        persistenceStatus === CREATIVE_GALLERY_STATUS.SAVED)
    ) {
      gallery = latest.gallery;
      persistenceStatus = latest.status;
    }
  }

  function notify(event) {
    const snapshot = getState();
    for (const listener of listeners) {
      try {
        listener(snapshot, event);
      } catch {
        // Gallery UI listeners cannot invalidate persisted creative work.
      }
    }
  }

  function generateId(modeId, at) {
    localIdSequence += 1;
    const fromFactory = callIdFactory(idFactory, {
      modeId,
      now: at,
      sequence: localIdSequence,
      purpose: "save",
    });
    const candidate = fromFactory ?? makeDefaultId(modeId, at);
    return uniqueId(candidate, new Set(gallery.entries.map((entry) => entry.id)));
  }

  function persist(nextGallery, event) {
    gallery = nextGallery;
    if (writesBlocked) {
      persistenceStatus = CREATIVE_GALLERY_STATUS.WRITE_BLOCKED;
    } else {
      const write = writeCreativeGallery(gallery, storage, {
        now: timestamp(),
        idFactory,
      });
      gallery = write.gallery;
      persistenceStatus = write.status;
    }
    notify(event);
  }

  function list({
    modeId,
    query = "",
    tags = [],
    sort = "updated-desc",
  } = {}) {
    if (modeId !== undefined && !SUPPORTED_MODE_IDS.has(modeId)) {
      return [];
    }
    const normalizedQuery = sanitizeText(query, 80).toLocaleLowerCase();
    const requestedTags = Array.isArray(tags)
      ? tags
          .map((tag) =>
            sanitizeText(tag, CREATIVE_GALLERY_LIMITS.maxTagLength)
              .toLocaleLowerCase(),
          )
          .filter(Boolean)
      : [];
    const entries = gallery.entries.filter((entry) => {
      if (modeId !== undefined && entry.modeId !== modeId) {
        return false;
      }
      const entryTags = entry.tags.map((tag) => tag.toLocaleLowerCase());
      if (!requestedTags.every((tag) => entryTags.includes(tag))) {
        return false;
      }
      return (
        !normalizedQuery ||
        entry.title.toLocaleLowerCase().includes(normalizedQuery) ||
        entry.description.toLocaleLowerCase().includes(normalizedQuery) ||
        entryTags.some((tag) => tag.includes(normalizedQuery))
      );
    });
    if (sort === "created-asc") {
      entries.sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt),
      );
    } else if (sort === "title-asc") {
      entries.sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        }),
      );
    } else {
      entries.sort(compareEntriesNewestFirst);
    }
    return clone(entries);
  }

  function save(input) {
    refreshFromPersistence();
    if (!isRecord(input)) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        { errors: ["entry-invalid"] },
      );
    }
    const at = timestamp();
    const hasSuppliedId =
      input.id !== undefined && input.id !== null && input.id !== "";
    const suppliedId = !hasSuppliedId ? null : normalizeId(input.id);
    if (hasSuppliedId && !suppliedId) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        { errors: ["id-invalid"] },
      );
    }
    const existingIndex = suppliedId
      ? gallery.entries.findIndex((entry) => entry.id === suppliedId)
      : -1;
    const existing = existingIndex >= 0 ? gallery.entries[existingIndex] : null;
    const modeId = input.modeId ?? existing?.modeId;
    if (!SUPPORTED_MODE_IDS.has(modeId)) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        { errors: ["mode-id-invalid"] },
      );
    }
    if (existing && modeId !== existing.modeId) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        { errors: ["mode-id-immutable"] },
      );
    }
    if (!existing) {
      if (gallery.entries.length >= CREATIVE_GALLERY_LIMITS.maxEntries) {
        return mutationFailure(
          CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
          gallery,
          { quota: "total" },
        );
      }
      if (
        countEntriesForMode(gallery.entries, modeId) >=
        CREATIVE_GALLERY_LIMITS.maxEntriesPerMode
      ) {
        return mutationFailure(
          CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
          gallery,
          { quota: "mode", modeId },
        );
      }
    }

    const id = suppliedId ?? generateId(modeId, at);
    if (!id) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
        gallery,
        { quota: "identifiers" },
      );
    }
    const rawEntry = {
      ...(existing ?? {}),
      ...input,
      id,
      modeId,
      createdAt: existing?.createdAt ?? input.createdAt ?? at,
      updatedAt: at,
    };
    const sanitized = sanitizeEntryDetailed(rawEntry, {
      fallbackNow: at,
      recoverInvalidId: false,
    });
    if (!sanitized.entry || sanitized.invalidReference) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        {
          errors: sanitized.invalidReference
            ? [...sanitized.errors, "data-reference-invalid"]
            : sanitized.errors,
          warnings: sanitized.warnings,
        },
      );
    }

    const entries = [...gallery.entries];
    if (existingIndex >= 0) {
      entries[existingIndex] = sanitized.entry;
    } else {
      entries.push(sanitized.entry);
    }
    entries.sort(compareEntriesNewestFirst);
    const nextGallery = {
      version: CREATIVE_GALLERY_SCHEMA_VERSION,
      revision: gallery.revision + 1,
      updatedAt: at,
      entries,
    };
    if (!galleryFitsStorage(nextGallery)) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
        gallery,
        { quota: "storage-bytes" },
      );
    }
    persist(nextGallery, {
      type: existing ? "entry-updated" : "entry-saved",
      entryId: id,
      modeId,
    });
    return {
      ok: true,
      status: CREATIVE_GALLERY_STATUS.SAVED,
      entry: clone(sanitized.entry),
      gallery: getState(),
      warnings: sanitized.warnings,
      persistenceStatus,
    };
  }

  function rename(id, title) {
    refreshFromPersistence();
    const normalizedId = normalizeId(id);
    const existing = normalizedId
      ? gallery.entries.find((entry) => entry.id === normalizedId)
      : null;
    if (!existing) {
      return mutationFailure(CREATIVE_GALLERY_STATUS.NOT_FOUND, gallery);
    }
    const normalizedTitle = sanitizeText(
      title,
      CREATIVE_GALLERY_LIMITS.maxTitleLength,
    );
    if (!normalizedTitle) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        { errors: ["title-empty"] },
      );
    }

    const at = timestamp();
    const renamed = {
      ...existing,
      title: normalizedTitle,
      updatedAt: at,
    };
    const entries = gallery.entries
      .map((entry) => (entry.id === normalizedId ? renamed : entry))
      .sort(compareEntriesNewestFirst);
    const nextGallery = {
      ...gallery,
      revision: gallery.revision + 1,
      updatedAt: at,
      entries,
    };
    if (!galleryFitsStorage(nextGallery)) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
        gallery,
        { quota: "storage-bytes" },
      );
    }
    persist(nextGallery, {
      type: "entry-renamed",
      entryId: normalizedId,
      modeId: existing.modeId,
    });
    return {
      ok: true,
      status: CREATIVE_GALLERY_STATUS.RENAMED,
      entry: clone(renamed),
      gallery: getState(),
      persistenceStatus,
    };
  }

  function deleteEntry(id) {
    refreshFromPersistence();
    const normalizedId = normalizeId(id);
    const existing = normalizedId
      ? gallery.entries.find((entry) => entry.id === normalizedId)
      : null;
    if (!existing) {
      return mutationFailure(CREATIVE_GALLERY_STATUS.NOT_FOUND, gallery);
    }
    const at = timestamp();
    const nextGallery = {
      ...gallery,
      revision: gallery.revision + 1,
      updatedAt: at,
      entries: gallery.entries.filter((entry) => entry.id !== normalizedId),
    };
    persist(nextGallery, {
      type: "entry-deleted",
      entryId: normalizedId,
      modeId: existing.modeId,
    });
    return {
      ok: true,
      status: CREATIVE_GALLERY_STATUS.DELETED,
      deletedId: normalizedId,
      gallery: getState(),
      persistenceStatus,
    };
  }

  function clear() {
    const removal = removeCreativeGallery(storage);
    gallery = createEmptyCreativeGallery();
    if (removal.status === CREATIVE_GALLERY_STATUS.CLEARED) {
      writesBlocked = false;
    }
    persistenceStatus = removal.status;
    notify({ type: "gallery-cleared" });
    return {
      ok:
        removal.status === CREATIVE_GALLERY_STATUS.CLEARED ||
        (removal.status === CREATIVE_GALLERY_STATUS.UNAVAILABLE &&
          !writesBlocked),
      status: removal.status,
      gallery: getState(),
    };
  }

  function exportJSON(options) {
    return exportCreativeGalleryJSON(gallery, {
      ...options,
      now: timestamp(),
    });
  }

  function importJSON(raw, { strategy = "merge" } = {}) {
    refreshFromPersistence();
    if (strategy !== "merge" && strategy !== "replace") {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.VALIDATION_FAILED,
        gallery,
        { errors: ["import-strategy-invalid"] },
      );
    }
    const imported = importCreativeGalleryJSON(raw, {
      now: timestamp(),
      idFactory,
    });
    if (!imported.ok) {
      return mutationFailure(imported.status, gallery, {
        warnings: imported.warnings,
      });
    }

    const entries = strategy === "replace" ? [] : [...gallery.entries];
    const usedIds = new Set(entries.map((entry) => entry.id));
    const perModeCounts = new Map();
    for (const modeId of CREATIVE_GALLERY_MODE_IDS) {
      perModeCounts.set(modeId, countEntriesForMode(entries, modeId));
    }
    let importedCount = 0;
    let skippedCount = 0;
    const warnings = [...imported.warnings];
    for (const importedEntry of imported.gallery.entries) {
      if (entries.length >= CREATIVE_GALLERY_LIMITS.maxEntries) {
        skippedCount += 1;
        warnings.push({ code: "total-quota", entryId: importedEntry.id });
        continue;
      }
      const modeCount = perModeCounts.get(importedEntry.modeId) ?? 0;
      if (modeCount >= CREATIVE_GALLERY_LIMITS.maxEntriesPerMode) {
        skippedCount += 1;
        warnings.push({
          code: "mode-quota",
          entryId: importedEntry.id,
          modeId: importedEntry.modeId,
        });
        continue;
      }
      const resolvedId = uniqueId(importedEntry.id, usedIds);
      if (!resolvedId) {
        skippedCount += 1;
        warnings.push({ code: "id-collision", entryId: importedEntry.id });
        continue;
      }
      if (resolvedId !== importedEntry.id) {
        warnings.push({
          code: "id-collision-recovered",
          previousId: importedEntry.id,
          nextId: resolvedId,
        });
      }
      usedIds.add(resolvedId);
      perModeCounts.set(importedEntry.modeId, modeCount + 1);
      entries.push({ ...importedEntry, id: resolvedId });
      importedCount += 1;
    }
    entries.sort(compareEntriesNewestFirst);

    const at = timestamp();
    const nextGallery = {
      version: CREATIVE_GALLERY_SCHEMA_VERSION,
      revision: gallery.revision + 1,
      updatedAt: at,
      entries,
    };
    if (!galleryFitsStorage(nextGallery)) {
      return mutationFailure(
        CREATIVE_GALLERY_STATUS.QUOTA_EXCEEDED,
        gallery,
        { quota: "storage-bytes", warnings },
      );
    }
    persist(nextGallery, {
      type: "gallery-imported",
      strategy,
      importedCount,
      skippedCount,
    });
    return {
      ok: true,
      status: CREATIVE_GALLERY_STATUS.IMPORTED,
      gallery: getState(),
      importedCount,
      skippedCount,
      warnings,
      persistenceStatus,
    };
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState,
    getPersistenceStatus,
    list,
    save,
    rename,
    delete: deleteEntry,
    clear,
    exportJSON,
    importJSON,
    subscribe,
  };
}
