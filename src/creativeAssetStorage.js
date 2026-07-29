export const CREATIVE_ASSET_DATABASE_NAME = "motion-arcade-creative-assets";
export const CREATIVE_ASSET_STORE_NAME = "assets";
export const CREATIVE_ASSET_DATABASE_VERSION = 1;
export const CREATIVE_ASSET_MAX_BYTES = 24 * 1024 * 1024;

const SAFE_ASSET_KEY = /^[a-z0-9][a-z0-9._-]{0,159}$/i;

function normalizeKey(key) {
  return typeof key === "string" && SAFE_ASSET_KEY.test(key) ? key : null;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Creative asset request failed.")),
      { once: true },
    );
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("Creative asset transaction was aborted.")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("Creative asset transaction failed.")),
      { once: true },
    );
  });
}

export function createCreativeAssetKey(modeId = "creative", now = Date.now()) {
  const safeMode =
    typeof modeId === "string"
      ? modeId.toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "")
      : "creative";
  const safeTime = Number.isFinite(now) ? Math.max(0, Math.floor(now)) : 0;
  return `${safeMode || "creative"}-${safeTime.toString(36)}`;
}

export function validateCreativeAsset({ key, blob } = {}) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) {
    return { ok: false, reason: "invalid-key" };
  }
  if (!(blob instanceof Blob)) {
    return { ok: false, reason: "invalid-blob" };
  }
  if (blob.size <= 0 || blob.size > CREATIVE_ASSET_MAX_BYTES) {
    return { ok: false, reason: "invalid-size" };
  }
  if (!["image/png", "image/webp", "application/json", "audio/webm", "video/webm"].includes(blob.type)) {
    return { ok: false, reason: "unsupported-media-type" };
  }
  return { ok: true, key: normalizedKey };
}

export function openCreativeAssetDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb?.open) {
    return Promise.reject(new Error("Local creative asset storage is unavailable."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(
      CREATIVE_ASSET_DATABASE_NAME,
      CREATIVE_ASSET_DATABASE_VERSION,
    );
    request.addEventListener(
      "upgradeneeded",
      () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(CREATIVE_ASSET_STORE_NAME)) {
          database.createObjectStore(CREATIVE_ASSET_STORE_NAME, {
            keyPath: "key",
          });
        }
      },
      { once: true },
    );
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("Could not open local creative storage.")),
      { once: true },
    );
  });
}

export async function saveCreativeAsset(
  { key, blob, createdAt = new Date().toISOString() },
  { indexedDb } = {},
) {
  const validation = validateCreativeAsset({ key, blob });
  if (!validation.ok) {
    throw new TypeError(`Creative asset rejected: ${validation.reason}.`);
  }
  const database = await openCreativeAssetDatabase(indexedDb);
  try {
    const transaction = database.transaction(CREATIVE_ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(CREATIVE_ASSET_STORE_NAME).put({
      key: validation.key,
      blob,
      mediaType: blob.type,
      byteLength: blob.size,
      createdAt,
    });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
  return {
    kind: "indexeddb",
    key: validation.key,
    mediaType: blob.type,
    byteLength: blob.size,
  };
}

export async function readCreativeAsset(reference, { indexedDb } = {}) {
  const key = normalizeKey(reference?.key);
  if (reference?.kind !== "indexeddb" || !key) {
    return null;
  }
  const database = await openCreativeAssetDatabase(indexedDb);
  try {
    const transaction = database.transaction(CREATIVE_ASSET_STORE_NAME, "readonly");
    const record = await requestResult(
      transaction.objectStore(CREATIVE_ASSET_STORE_NAME).get(key),
    );
    return record?.blob instanceof Blob ? record.blob : null;
  } finally {
    database.close();
  }
}

export async function deleteCreativeAsset(reference, { indexedDb } = {}) {
  const key = normalizeKey(reference?.key);
  if (reference?.kind !== "indexeddb" || !key) {
    return false;
  }
  const database = await openCreativeAssetDatabase(indexedDb);
  try {
    const transaction = database.transaction(CREATIVE_ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(CREATIVE_ASSET_STORE_NAME).delete(key);
    await transactionComplete(transaction);
    return true;
  } finally {
    database.close();
  }
}

export function clearCreativeAssets(indexedDb = globalThis.indexedDB) {
  if (!indexedDb?.deleteDatabase) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const request = indexedDb.deleteDatabase(CREATIVE_ASSET_DATABASE_NAME);
    request.addEventListener("success", () => resolve(true), { once: true });
    request.addEventListener("error", () => resolve(false), { once: true });
    request.addEventListener("blocked", () => resolve(false), { once: true });
  });
}
