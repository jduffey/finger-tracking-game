import {
  getMotionVisualizerPalette,
  normalizeMotionVisualizerState,
} from "./motionVisualizer.js";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round(clamp(number, 240, 4096))
    : fallback;
}

function normalizePoints(points, width, height) {
  return (Array.isArray(points) ? points : [])
    .filter(
      (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
    )
    .map((point, index) => ({
      id: escapeXml(point.id ?? `point-${index + 1}`),
      x: clamp(point.x, 0, width),
      y: clamp(point.y, 0, height),
    }));
}

function circle(x, y, radius, color, opacity, strokeWidth = 3) {
  return `<circle cx="${x}" cy="${y}" r="${Math.max(
    1,
    radius,
  )}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
}

function renderSquares(points, width, height, palette, intensity) {
  const size = 48;
  const lines = [];
  for (let x = 0; x <= width; x += size) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" />`,
    );
  }
  for (let y = 0; y <= height; y += size) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" />`,
    );
  }
  const cells = points.flatMap((point, pointIndex) => {
    const col = Math.floor(point.x / size);
    const row = Math.floor(point.y / size);
    const output = [];
    for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
      for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
        const distance = Math.max(Math.abs(xOffset), Math.abs(yOffset));
        const x = (col + xOffset) * size;
        const y = (row + yOffset) * size;
        if (
          x < 0 ||
          y < 0 ||
          x >= width ||
          y >= height ||
          distance > 2
        ) {
          continue;
        }
        output.push(
          `<rect x="${x}" y="${y}" width="${Math.min(
            size,
            width - x,
          )}" height="${Math.min(size, height - y)}" fill="${
            palette.colors[(distance + pointIndex) % palette.colors.length]
          }" opacity="${(intensity * (3 - distance)) / 330}" />`,
        );
      }
    }
    return output;
  });
  return `<g stroke="${palette.line}" stroke-opacity="0.28">${lines.join(
    "",
  )}</g>${cells.join("")}`;
}

function hexPoints(centerX, centerY, radius) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    return `${centerX + Math.cos(angle) * radius},${
      centerY + Math.sin(angle) * radius
    }`;
  }).join(" ");
}

function renderHex(points, palette, intensity) {
  return points
    .flatMap((point, pointIndex) =>
      [1, 2, 3, 4, 5].map((ring) => {
        const color =
          palette.colors[(pointIndex + ring - 1) % palette.colors.length];
        return `<polygon points="${hexPoints(
          point.x,
          point.y,
          ring * 34,
        )}" fill="${color}" fill-opacity="${
          (intensity / 100) * Math.max(0.04, 0.28 - ring * 0.04)
        }" stroke="${palette.line}" stroke-opacity="0.7" stroke-width="2" />`;
      }),
    )
    .join("");
}

function renderVoronoi(points, width, height, palette, intensity) {
  const safePoints =
    points.length > 0
      ? points
      : [{ id: "center", x: width / 2, y: height / 2 }];
  const gradients = safePoints
    .map((point, index) => {
      const color = palette.colors[index % palette.colors.length];
      return `<radialGradient id="site-${index}" gradientUnits="userSpaceOnUse" cx="${point.x}" cy="${point.y}" r="${
        Math.max(width, height) * 0.62
      }"><stop offset="0" stop-color="${color}" stop-opacity="${
        intensity / 85
      }" /><stop offset="1" stop-color="${color}" stop-opacity="0" /></radialGradient>`;
    })
    .join("");
  const fields = safePoints
    .map(
      (_, index) =>
        `<rect width="${width}" height="${height}" fill="url(#site-${index})" />`,
    )
    .join("");
  const connections = safePoints
    .flatMap((point, index) =>
      safePoints.slice(index + 1).map(
        (other) =>
          `<line x1="${point.x}" y1="${point.y}" x2="${other.x}" y2="${other.y}" />`,
      ),
    )
    .join("");
  return `<defs>${gradients}</defs>${fields}<g stroke="${palette.line}" stroke-opacity="0.42" stroke-width="2">${connections}</g>`;
}

function renderConcentric(
  points,
  width,
  height,
  palette,
  intensity,
  step,
) {
  const maxRadius = Math.hypot(width, height);
  return points
    .flatMap((point, pointIndex) => {
      const output = [];
      for (let radius = step; radius <= maxRadius; radius += step) {
        const color =
          palette.colors[
            (pointIndex + Math.floor(radius / step)) %
              palette.colors.length
          ];
        output.push(
          circle(
            point.x,
            point.y,
            radius,
            color,
            Math.max(0.1, intensity / 100 - radius / maxRadius / 1.4),
            step >= 70 ? 3 : Math.max(4, step * 0.18),
          ),
        );
      }
      return output;
    })
    .join("");
}

function renderRings(points, palette, intensity) {
  return points
    .flatMap((point, pointIndex) =>
      [22, 40, 58, 76, 94].map((radius, ringIndex) =>
        circle(
          point.x,
          point.y,
          radius,
          palette.colors[
            (pointIndex + ringIndex) % palette.colors.length
          ],
          0.28 + intensity / 140,
          Math.max(7, radius * 0.36),
        ),
      ),
    )
    .join("");
}

export function createMotionVisualizerSnapshotSvg({
  settings,
  width,
  height,
  indexPoints,
  tipPoints,
} = {}) {
  const normalized = normalizeMotionVisualizerState(settings);
  const safeWidth = normalizeDimension(width, 1280);
  const safeHeight = normalizeDimension(height, 720);
  const palette = getMotionVisualizerPalette(normalized.palette);
  const indexes = normalizePoints(indexPoints, safeWidth, safeHeight);
  const tips = normalizePoints(tipPoints, safeWidth, safeHeight);
  const primaryPoints =
    normalized.effect === "voronoi" ||
    normalized.effect === "tip-ripples"
      ? tips
      : indexes;
  const points =
    primaryPoints.length > 0
      ? primaryPoints
      : [{ id: "center", x: safeWidth / 2, y: safeHeight / 2 }];

  let artwork = "";
  if (normalized.effect === "square") {
    artwork = renderSquares(
      points,
      safeWidth,
      safeHeight,
      palette,
      normalized.intensity,
    );
  } else if (normalized.effect === "hex") {
    artwork = renderHex(points, palette, normalized.intensity);
  } else if (normalized.effect === "voronoi") {
    artwork = renderVoronoi(
      points,
      safeWidth,
      safeHeight,
      palette,
      normalized.intensity,
    );
  } else if (normalized.effect === "rings") {
    artwork = renderRings(points, palette, normalized.intensity);
  } else if (normalized.effect === "pulse") {
    artwork = renderConcentric(
      points,
      safeWidth,
      safeHeight,
      palette,
      normalized.intensity,
      44,
    );
  } else if (normalized.effect === "tip-ripples") {
    artwork = renderConcentric(
      points,
      safeWidth,
      safeHeight,
      palette,
      normalized.intensity,
      62,
    );
  } else {
    artwork =
      renderConcentric(
        points,
        safeWidth,
        safeHeight,
        palette,
        normalized.intensity,
        74,
      ) +
      (points.length === 2
        ? `<line x1="${points[0].x}" y1="${points[0].y}" x2="${points[1].x}" y2="${points[1].y}" stroke="${palette.line}" stroke-width="3" opacity="0.8" />`
        : "");
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">`,
    "<title>Motion Visualizer artwork</title>",
    `<desc>${escapeXml(
      `${normalized.effect} effect using the ${normalized.palette} palette. Camera imagery is intentionally omitted.`,
    )}</desc>`,
    `<rect width="${safeWidth}" height="${safeHeight}" fill="${palette.background}" />`,
    `<g style="mix-blend-mode:screen">${artwork}</g>`,
    "</svg>",
  ].join("");
}

export function createMotionVisualizerSnapshotFilename(
  effectId,
  date = new Date(),
) {
  const safeEffect = String(effectId || "artwork")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const day =
    date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toISOString().slice(0, 10)
      : "snapshot";
  return `motion-visualizer-${safeEffect || "artwork"}-${day}.svg`;
}
