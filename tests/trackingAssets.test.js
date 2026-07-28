import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  MEDIAPIPE_HANDS_ASSET_NAMES,
  MEDIAPIPE_HANDS_SOLUTION_PATH,
  MOVENET_MODEL_BASE_PATH,
  MOVENET_MODEL_PATHS,
  getMoveNetModelPath,
} from "../src/trackingAssetConfig.js";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const moveNetVendorDirectory = path.join(
  projectRoot,
  "public/vendor/movenet",
);

test("MediaPipe hands uses a same-origin solution path with a complete local asset set", () => {
  assert.equal(MEDIAPIPE_HANDS_SOLUTION_PATH, "/vendor/mediapipe/hands");
  assert.ok(MEDIAPIPE_HANDS_ASSET_NAMES.includes("hands.js"));
  assert.ok(MEDIAPIPE_HANDS_ASSET_NAMES.some((name) => name.endsWith(".wasm")));
  assert.ok(MEDIAPIPE_HANDS_ASSET_NAMES.some((name) => name.endsWith(".tflite")));

  for (const fileName of MEDIAPIPE_HANDS_ASSET_NAMES) {
    assert.equal(
      existsSync(path.join(projectRoot, "node_modules/@mediapipe/hands", fileName)),
      true,
      `${fileName} should be available from the pinned dependency`,
    );
  }
});

test("the application no longer configures a third-party MediaPipe CDN", () => {
  const handTrackingSource = readFileSync(
    path.join(projectRoot, "src/handTracking.js"),
    "utf8",
  );
  assert.equal(handTrackingSource.includes("cdn.jsdelivr.net"), false);
  assert.match(handTrackingSource, /MEDIAPIPE_HANDS_SOLUTION_PATH/);
});

test("MoveNet runtime configuration only exposes same-origin model paths", () => {
  assert.equal(MOVENET_MODEL_BASE_PATH, "/vendor/movenet");
  assert.deepEqual(MOVENET_MODEL_PATHS, {
    "SinglePose.Lightning":
      "/vendor/movenet/singlepose-lightning-v4/model.json",
    "MultiPose.Lightning":
      "/vendor/movenet/multipose-lightning-v1/model.json",
  });

  for (const [modelType, modelPath] of Object.entries(MOVENET_MODEL_PATHS)) {
    assert.equal(getMoveNetModelPath(modelType), modelPath);
    assert.match(modelPath, /^\/vendor\/movenet\/[^/]+\/model\.json$/);
    assert.equal(modelPath.includes("://"), false);
  }
  assert.equal(getMoveNetModelPath("SinglePose.Thunder"), null);

  const poseTrackingSource = readFileSync(
    path.join(projectRoot, "src/poseTracking.js"),
    "utf8",
  );
  assert.match(poseTrackingSource, /getMoveNetModelPath/);
  assert.match(poseTrackingSource, /modelUrl/);
  assert.equal(poseTrackingSource.includes("tfhub.dev"), false);
  assert.equal(poseTrackingSource.includes("storage.googleapis.com"), false);
});

test("vendored MoveNet artifacts match their official-source checksums", () => {
  const provenancePath = path.join(
    moveNetVendorDirectory,
    "provenance.json",
  );
  const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));

  assert.equal(provenance.publisher, "Google");
  assert.equal(provenance.license, "Apache-2.0");
  assert.equal(provenance.models.length, 2);
  assert.equal(
    existsSync(path.join(moveNetVendorDirectory, provenance.licenseFile)),
    true,
  );
  assert.equal(
    existsSync(path.join(moveNetVendorDirectory, "NOTICE.txt")),
    true,
  );

  let totalBytes = 0;
  for (const model of provenance.models) {
    assert.equal(model.source.startsWith("https://tfhub.dev/google/"), true);
    assert.equal(model.runtimePath, getMoveNetModelPath(model.modelType));

    const declaredAssetPaths = new Set(
      model.assets.map((asset) => asset.path),
    );
    for (const asset of model.assets) {
      const assetPath = path.join(moveNetVendorDirectory, asset.path);
      const contents = readFileSync(assetPath);
      totalBytes += contents.byteLength;
      assert.equal(contents.byteLength, asset.bytes, `${asset.path} size`);
      assert.equal(
        createHash("sha256").update(contents).digest("hex"),
        asset.sha256,
        `${asset.path} SHA-256`,
      );

      if (!asset.path.endsWith("/model.json")) {
        continue;
      }
      const modelJson = JSON.parse(contents.toString("utf8"));
      for (const shardPath of modelJson.weightsManifest.flatMap(
        (group) => group.paths,
      )) {
        assert.equal(path.basename(shardPath), shardPath);
        assert.equal(
          declaredAssetPaths.has(
            path.posix.join(path.posix.dirname(asset.path), shardPath),
          ),
          true,
          `${asset.path} should only reference declared local shards`,
        );
      }
    }
  }

  assert.equal(totalBytes, 14516137);
});

test("deployment headers keep MoveNet fetches same-origin and immutable", () => {
  const headersSource = readFileSync(
    path.join(projectRoot, "public/_headers"),
    "utf8",
  );
  assert.match(headersSource, /connect-src 'self'/);
  assert.match(
    headersSource,
    /\/vendor\/movenet\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/,
  );
  assert.match(
    headersSource,
    /\/vendor\/movenet\/\*[\s\S]*Cross-Origin-Resource-Policy: same-origin/,
  );
});
