import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  collectInitialBundleStats,
  findBudgetViolations,
  formatKibibytes,
  parseInitialAssetReferences,
  resolveAssetPath,
} from "../scripts/check-bundle-budget.js";

test("parseInitialAssetReferences finds eager Vite assets without hashed-name assumptions", () => {
  const html = `
    <link href='/assets/theme.x7.css?theme=dark' crossorigin rel='stylesheet'>
    <link rel="modulepreload preload" href="/assets/vendor.any-hash.mjs">
    <script crossorigin src="./assets/main.other-hash.js" type="module"></script>
    <script src="./assets/main.other-hash.js"></script>
    <link rel="prefetch" href="/assets/lazy.js">
    <link rel="preload" as="style" href="/assets/not-applied.css">
    <link rel="icon" href="/favicon.svg">
  `;

  assert.deepEqual(parseInitialAssetReferences(html), {
    js: ["/assets/vendor.any-hash.mjs", "./assets/main.other-hash.js"],
    css: ["/assets/theme.x7.css?theme=dark"],
  });
});

test("collectInitialBundleStats measures and deduplicates the initial graph", (t) => {
  const distDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "motion-arcade-bundle-"),
  );
  t.after(() => fs.rmSync(distDirectory, { recursive: true, force: true }));

  fs.mkdirSync(path.join(distDirectory, "assets"));
  const mainJs = Buffer.from("console.log('main');".repeat(30));
  const vendorJs = Buffer.from("export const value = 42;".repeat(20));
  const styles = Buffer.from(".game{display:grid}".repeat(25));
  fs.writeFileSync(path.join(distDirectory, "assets/main.js"), mainJs);
  fs.writeFileSync(path.join(distDirectory, "assets/vendor.js"), vendorJs);
  fs.writeFileSync(path.join(distDirectory, "assets/main.css"), styles);
  fs.writeFileSync(
    path.join(distDirectory, "index.html"),
    `
      <script type="module" src="/assets/main.js"></script>
      <link rel="modulepreload" href="/assets/vendor.js">
      <link rel="modulepreload" href="/assets/vendor.js">
      <link rel="stylesheet" href="./assets/main.css">
    `,
  );

  const stats = collectInitialBundleStats(
    path.join(distDirectory, "index.html"),
  );

  assert.equal(stats.assets.js.length, 2);
  assert.equal(stats.assets.css.length, 1);
  assert.deepEqual(stats.totals.js, {
    rawBytes: mainJs.byteLength + vendorJs.byteLength,
    gzipBytes:
      gzipSync(mainJs).byteLength + gzipSync(vendorJs).byteLength,
  });
  assert.deepEqual(stats.totals.css, {
    rawBytes: styles.byteLength,
    gzipBytes: gzipSync(styles).byteLength,
  });
});

test("findBudgetViolations reports every exceeded raw or gzip threshold", () => {
  const stats = {
    totals: {
      js: { rawBytes: 101, gzipBytes: 51 },
      css: { rawBytes: 80, gzipBytes: 20 },
    },
  };
  const budgets = {
    js: { rawBytes: 100, gzipBytes: 50 },
    css: { rawBytes: 80, gzipBytes: 19 },
  };

  assert.deepEqual(findBudgetViolations(stats, budgets), [
    {
      assetType: "js",
      sizeType: "rawBytes",
      actual: 101,
      budget: 100,
      overBy: 1,
    },
    {
      assetType: "js",
      sizeType: "gzipBytes",
      actual: 51,
      budget: 50,
      overBy: 1,
    },
    {
      assetType: "css",
      sizeType: "gzipBytes",
      actual: 20,
      budget: 19,
      overBy: 1,
    },
  ]);
});

test("asset resolution rejects traversal and non-local URLs", () => {
  const indexPath = "/tmp/motion-arcade-dist/index.html";

  assert.throws(
    () => resolveAssetPath(indexPath, "../secret.js"),
    /outside dist/,
  );
  assert.throws(
    () => resolveAssetPath(indexPath, "https://cdn.example/app.js"),
    /non-local/,
  );
  assert.throws(
    () => resolveAssetPath(indexPath, "/assets/bad%ZZ.js"),
    /invalid URL encoding/,
  );
});

test("formatKibibytes uses binary units", () => {
  assert.equal(formatKibibytes(1536), "1.5 KiB");
});
