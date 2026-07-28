import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const KIBIBYTE = 1024;

/**
 * These limits intentionally leave a small amount of headroom above the July
 * 2026 main-entry baseline. They cover only assets the browser eagerly
 * discovers from dist/index.html; lazy game and tracking chunks are excluded.
 */
export const DEFAULT_BUNDLE_BUDGETS = Object.freeze({
  js: Object.freeze({
    rawBytes: 800 * KIBIBYTE,
    gzipBytes: 250 * KIBIBYTE,
  }),
  css: Object.freeze({
    rawBytes: 210 * KIBIBYTE,
    gzipBytes: 42 * KIBIBYTE,
  }),
});

function parseAttributes(source) {
  const attributes = new Map();
  const attributePattern =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of source.matchAll(attributePattern)) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attributes.set(
      name.toLowerCase(),
      doubleQuoted ?? singleQuoted ?? unquoted ?? "",
    );
  }

  return attributes;
}

function stripQueryAndHash(assetUrl) {
  return assetUrl.split(/[?#]/, 1)[0];
}

function hasExtension(assetUrl, extensions) {
  const pathname = stripQueryAndHash(assetUrl).toLowerCase();
  return extensions.some((extension) => pathname.endsWith(extension));
}

/**
 * Returns the local JS and CSS references that are part of an HTML document's
 * eager load graph. Dynamic imports and ordinary prefetch/preload hints are not
 * startup assets and are deliberately ignored.
 */
export function parseInitialAssetReferences(html) {
  const references = {
    js: [],
    css: [],
  };
  const seen = {
    js: new Set(),
    css: new Set(),
  };
  const tagPattern = /<(script|link)\b([^>]*)>/gi;

  for (const match of html.matchAll(tagPattern)) {
    const tagName = match[1].toLowerCase();
    const attributes = parseAttributes(match[2]);

    if (tagName === "script") {
      const src = attributes.get("src");
      if (src && hasExtension(src, [".js", ".mjs"]) && !seen.js.has(src)) {
        seen.js.add(src);
        references.js.push(src);
      }
      continue;
    }

    const relTokens = (attributes.get("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const href = attributes.get("href");
    if (!href) {
      continue;
    }

    if (
      relTokens.includes("modulepreload") &&
      hasExtension(href, [".js", ".mjs"]) &&
      !seen.js.has(href)
    ) {
      seen.js.add(href);
      references.js.push(href);
    }

    if (
      relTokens.includes("stylesheet") &&
      hasExtension(href, [".css"]) &&
      !seen.css.has(href)
    ) {
      seen.css.add(href);
      references.css.push(href);
    }
  }

  return references;
}

export function resolveAssetPath(indexPath, assetUrl) {
  if (
    assetUrl.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(assetUrl)
  ) {
    throw new Error(`Cannot measure non-local initial asset: ${assetUrl}`);
  }

  let pathname;
  try {
    pathname = decodeURIComponent(stripQueryAndHash(assetUrl));
  } catch {
    throw new Error(`Initial asset has invalid URL encoding: ${assetUrl}`);
  }

  const distDirectory = path.dirname(path.resolve(indexPath));
  const assetPath = pathname.startsWith("/")
    ? path.resolve(distDirectory, `.${pathname}`)
    : path.resolve(distDirectory, pathname);
  const relativePath = path.relative(distDirectory, assetPath);

  if (
    relativePath === "" ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath === ".." ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Initial asset resolves outside dist: ${assetUrl}`);
  }

  return assetPath;
}

function measureAsset(indexPath, reference) {
  const assetPath = resolveAssetPath(indexPath, reference);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Initial asset is missing: ${reference} (${assetPath})`);
  }

  const contents = fs.readFileSync(assetPath);
  return {
    reference,
    assetPath,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents).byteLength,
  };
}

function summarizeAssets(assets) {
  return assets.reduce(
    (totals, asset) => ({
      rawBytes: totals.rawBytes + asset.rawBytes,
      gzipBytes: totals.gzipBytes + asset.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
}

export function collectInitialBundleStats(indexPath) {
  const resolvedIndexPath = path.resolve(indexPath);
  if (!fs.existsSync(resolvedIndexPath)) {
    throw new Error(
      `Production entry not found at ${resolvedIndexPath}. Run npm run build first.`,
    );
  }

  const html = fs.readFileSync(resolvedIndexPath, "utf8");
  const references = parseInitialAssetReferences(html);
  const assets = {
    js: references.js.map((reference) =>
      measureAsset(resolvedIndexPath, reference),
    ),
    css: references.css.map((reference) =>
      measureAsset(resolvedIndexPath, reference),
    ),
  };

  if (assets.js.length === 0) {
    throw new Error("No initial JavaScript assets were found in dist/index.html.");
  }
  if (assets.css.length === 0) {
    throw new Error("No initial stylesheet assets were found in dist/index.html.");
  }

  return {
    indexPath: resolvedIndexPath,
    assets,
    totals: {
      js: summarizeAssets(assets.js),
      css: summarizeAssets(assets.css),
    },
  };
}

export function findBudgetViolations(
  stats,
  budgets = DEFAULT_BUNDLE_BUDGETS,
) {
  const violations = [];

  for (const assetType of ["js", "css"]) {
    for (const sizeType of ["rawBytes", "gzipBytes"]) {
      const actual = stats.totals[assetType][sizeType];
      const budget = budgets[assetType][sizeType];
      if (actual > budget) {
        violations.push({
          assetType,
          sizeType,
          actual,
          budget,
          overBy: actual - budget,
        });
      }
    }
  }

  return violations;
}

export function formatKibibytes(bytes) {
  return `${(bytes / KIBIBYTE).toFixed(1)} KiB`;
}

function formatCategory(stats, budgets, assetType) {
  const totals = stats.totals[assetType];
  const budget = budgets[assetType];
  return [
    `${assetType.toUpperCase()} (${stats.assets[assetType].length} files)`,
    `${formatKibibytes(totals.rawBytes)} raw / ${formatKibibytes(totals.gzipBytes)} gzip`,
    `budget ${formatKibibytes(budget.rawBytes)} raw / ${formatKibibytes(budget.gzipBytes)} gzip`,
  ].join(": ");
}

export function runBundleBudgetCheck({
  indexPath = path.resolve("dist/index.html"),
  budgets = DEFAULT_BUNDLE_BUDGETS,
  output = console,
} = {}) {
  const stats = collectInitialBundleStats(indexPath);
  const violations = findBudgetViolations(stats, budgets);

  output.log(`Initial bundle budget: ${stats.indexPath}`);
  output.log(formatCategory(stats, budgets, "js"));
  output.log(formatCategory(stats, budgets, "css"));

  if (violations.length > 0) {
    const details = violations
      .map(
        ({ assetType, sizeType, actual, budget, overBy }) =>
          `${assetType.toUpperCase()} ${sizeType === "rawBytes" ? "raw" : "gzip"} ` +
          `is ${formatKibibytes(actual)} (budget ${formatKibibytes(budget)}, ` +
          `${formatKibibytes(overBy)} over)`,
      )
      .join("; ");
    throw new Error(`Initial bundle budget exceeded: ${details}`);
  }

  output.log("Initial bundle is within budget.");
  return stats;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const requestedIndex = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve("dist/index.html");

  try {
    runBundleBudgetCheck({ indexPath: requestedIndex });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
