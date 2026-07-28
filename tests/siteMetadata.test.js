import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function readRepositoryFile(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readRepositoryFile(relativePath));
}

test("each application entry point publishes useful identity and privacy metadata", () => {
  for (const entryPoint of ["index.html", "circle-of-fifths.html"]) {
    const html = readRepositoryFile(entryPoint);

    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta\s+name="description"/);
    assert.match(html, /<meta\s+name="theme-color"\s+content="#070b16"/);
    assert.match(html, /<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"/);
    assert.match(html, /<link\s+rel="privacy-policy"\s+href="\/privacy\.html"/);
    assert.match(html, /<noscript>/);
    assert.match(html, /<title>[^<]*Motion Arcade[^<]*<\/title>/);
  }
});

test("web app manifest has stable scope, colors, and a resolvable icon", () => {
  const manifest = readJson("public/manifest.webmanifest");

  assert.equal(manifest.name, "Motion Arcade");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#070b16");
  assert.equal(manifest.theme_color, "#070b16");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

  for (const icon of manifest.icons) {
    const localIconPath = path.join(repositoryRoot, "public", icon.src.replace(/^\//, ""));
    assert.equal(existsSync(localIconPath), true, `Missing manifest icon: ${icon.src}`);
  }
});

test("public privacy page documents the app's meaningful data boundaries", () => {
  const privacyPage = readRepositoryFile("public/privacy.html");

  assert.match(privacyPage, /processed locally in your browser/i);
  assert.match(privacyPage, /not uploaded or saved/i);
  assert.match(privacyPage, /does not request\s+microphone\s+access/i);
  assert.match(privacyPage, /same site as the app/i);
  assert.match(privacyPage, /localStorage/);
  assert.match(privacyPage, /production builds do not send\s+those logs/i);
});

test("the package exposes one local and CI quality command", () => {
  const packageJson = readJson("package.json");

  assert.equal(packageJson.engines.node, "^20.19.0 || >=22.12.0");
  assert.equal(packageJson.scripts["test:ci"], "node --test --test-reporter=spec");
  assert.equal(
    packageJson.scripts.check,
    "npm run test:ci && npm run build && npm run check:bundle-budget && npm run audit",
  );
  assert.equal(
    packageJson.scripts["check:bundle-budget"],
    "node scripts/check-bundle-budget.js",
  );
  assert.equal(packageJson.scripts.audit, "npm audit --audit-level=high");
});
