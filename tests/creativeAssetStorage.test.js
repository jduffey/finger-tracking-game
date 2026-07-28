import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATIVE_ASSET_MAX_BYTES,
  createCreativeAssetKey,
  openCreativeAssetDatabase,
  readCreativeAsset,
  validateCreativeAsset,
} from "../src/creativeAssetStorage.js";

test("creative asset keys are deterministic, local, and reference-safe", () => {
  assert.equal(createCreativeAssetKey("gesture art", 1_000), "gesture-art-rs");
  assert.equal(createCreativeAssetKey("../../unsafe", 0), "unsafe-0");
});

test("creative assets accept bounded supported blobs and reject unsafe metadata", () => {
  assert.deepEqual(
    validateCreativeAsset({
      key: "gesture-art-1",
      blob: new Blob(["pixels"], { type: "image/png" }),
    }),
    { ok: true, key: "gesture-art-1" },
  );
  assert.equal(
    validateCreativeAsset({
      key: "../outside",
      blob: new Blob(["pixels"], { type: "image/png" }),
    }).reason,
    "invalid-key",
  );
  assert.equal(
    validateCreativeAsset({
      key: "asset",
      blob: new Blob(["html"], { type: "text/html" }),
    }).reason,
    "unsupported-media-type",
  );
  assert.equal(
    validateCreativeAsset({
      key: "asset",
      blob: { size: CREATIVE_ASSET_MAX_BYTES + 1, type: "image/png" },
    }).reason,
    "invalid-blob",
  );
});

test("creative asset APIs fail safely when IndexedDB is unavailable", async () => {
  await assert.rejects(
    openCreativeAssetDatabase(null),
    /unavailable/i,
  );
  assert.equal(
    await readCreativeAsset({ kind: "remote", key: "https://example.test" }),
    null,
  );
});
