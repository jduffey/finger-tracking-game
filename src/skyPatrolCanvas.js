import {
  SKY_PATROL_STARTING_LIVES,
  getSkyPatrolTerrainRows,
  getSkyPatrolTerrainScrollMetrics,
} from "./skyPatrolGame.js";
import {
  getSkyPatrolDepthCue,
  getSkyPatrolGroundSiteUi,
  getSkyPatrolIncomingIndicators,
  SKY_PATROL_LEGEND_FADE_MS,
  SKY_PATROL_START_PROMPT_MS,
  getSkyPatrolProjectileUi,
  getSkyPatrolRadarBlips,
  getSkyPatrolTargetHealthPips,
  getSkyPatrolThreatUi,
} from "./skyPatrolUi.js";

const SKY_PATROL_TERRAIN_CACHE_EXTRA_ROWS = 4;

const TERRAIN_PALETTE = {
  "deep-water": {
    base: "#0b486a",
    shadow: "#08314c",
    accent: "#14698a",
    highlight: "#6fc9df",
  },
  "shallow-water": {
    base: "#157a90",
    shadow: "#0d5466",
    accent: "#25a9bf",
    highlight: "#9beaf1",
  },
  beach: {
    base: "#deb56f",
    shadow: "#b88945",
    accent: "#efcf90",
    highlight: "#fff0c5",
  },
  grass: {
    base: "#4b8a4d",
    shadow: "#2f6034",
    accent: "#6aac5f",
    highlight: "#d7ffbe",
  },
  forest: {
    base: "#295530",
    shadow: "#17341e",
    accent: "#3d7545",
    highlight: "#c9f6bf",
  },
  runway: {
    base: "#575e73",
    shadow: "#383d4d",
    accent: "#747d92",
    highlight: "#f4f1de",
  },
  road: {
    base: "#6c5c48",
    shadow: "#473a2d",
    accent: "#87725a",
    highlight: "#f1d66e",
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundPixel(value) {
  return Math.round(value);
}

function getCanvasDocument(canvas) {
  if (canvas?.ownerDocument?.createElement) {
    return canvas.ownerDocument;
  }
  if (typeof document !== "undefined" && document?.createElement) {
    return document;
  }
  return null;
}

function createAuxiliaryCanvas(referenceCanvas) {
  const canvasDocument = getCanvasDocument(referenceCanvas);
  return canvasDocument ? canvasDocument.createElement("canvas") : null;
}

function getEntityBounds(entity) {
  return {
    left: roundPixel(entity.x - entity.width / 2),
    top: roundPixel(entity.y - entity.height / 2),
    width: Math.max(1, roundPixel(entity.width)),
    height: Math.max(1, roundPixel(entity.height)),
  };
}

function drawPixelStrokeRect(ctx, x, y, width, height, color) {
  if (width <= 1 || height <= 1) {
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 1);
  ctx.fillRect(x, y + height - 1, width, 1);
  ctx.fillRect(x, y + 1, 1, Math.max(0, height - 2));
  ctx.fillRect(x + width - 1, y + 1, 1, Math.max(0, height - 2));
}

function fillPixelPath(ctx, points, fill, stroke = null) {
  if (!Array.isArray(points) || points.length === 0) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(roundPixel(points[0].x), roundPixel(points[0].y));
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(roundPixel(points[index].x), roundPixel(points[index].y));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawTexturedTerrainSegment(ctx, terrain, x, y, width, height, tileSize) {
  const palette = TERRAIN_PALETTE[terrain] ?? TERRAIN_PALETTE.grass;
  const stripeWidth = Math.max(3, roundPixel(tileSize * 0.38));
  const accentWidth = Math.max(2, roundPixel(tileSize * 0.16));
  const patchSize = Math.max(2, roundPixel(tileSize * 0.18));

  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = palette.base;
  ctx.fillRect(x, y, width, height);

  if (terrain === "deep-water" || terrain === "shallow-water") {
    for (let offsetX = 0; offsetX < width; offsetX += stripeWidth * 2) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x + offsetX, y, stripeWidth, height);
      ctx.fillStyle = palette.highlight;
      ctx.fillRect(x + offsetX, y, Math.max(1, accentWidth), 1);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(x, y, width, 1);
    return;
  }

  if (terrain === "runway") {
    ctx.fillStyle = palette.accent;
    for (let offsetX = 0; offsetX < width; offsetX += stripeWidth * 2) {
      ctx.fillRect(x + offsetX, y, stripeWidth, height);
    }
    const centerLineWidth = Math.max(2, roundPixel(tileSize * 0.18));
    const centerLineX = x + roundPixel(width / 2 - centerLineWidth / 2);
    for (let offsetY = 0; offsetY < height; offsetY += Math.max(4, roundPixel(tileSize * 0.52))) {
      ctx.fillStyle = palette.highlight;
      ctx.fillRect(centerLineX, y + offsetY, centerLineWidth, Math.max(2, roundPixel(tileSize * 0.24)));
    }
    drawPixelStrokeRect(ctx, x, y, width, height, "rgba(18, 20, 27, 0.62)");
    return;
  }

  if (terrain === "road") {
    ctx.fillStyle = palette.accent;
    for (let offsetX = 0; offsetX < width; offsetX += stripeWidth * 2) {
      ctx.fillRect(x + offsetX, y, stripeWidth, height);
    }
    const centerLineWidth = Math.max(2, roundPixel(tileSize * 0.16));
    const centerLineX = x + roundPixel(width / 2 - centerLineWidth / 2);
    ctx.fillStyle = palette.highlight;
    ctx.fillRect(centerLineX, y, centerLineWidth, height);
    return;
  }

  for (let offsetX = 0; offsetX < width; offsetX += stripeWidth * 2) {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + offsetX, y, Math.min(stripeWidth, width - offsetX), height);
  }

  const patchStride = terrain === "forest" ? patchSize * 7 : patchSize * 6;
  for (let patchX = patchStride; patchX < width; patchX += patchStride) {
    const patchY = ((patchX / Math.max(1, patchSize)) % 2) * patchSize * 2;
    ctx.fillStyle = palette.highlight;
    ctx.fillRect(
      x + patchX,
      y + clamp(patchY, 1, Math.max(1, height - patchSize - 1)),
      patchSize,
      patchSize,
    );
  }
}

function paintTerrainBuffer(renderer, layout, scrollOffset) {
  const terrainCanvas = renderer.terrainCanvas;
  const terrainCtx = renderer.terrainCtx;
  if (!terrainCanvas || !terrainCtx || !layout) {
    return;
  }

  const { startWorldRow } = getSkyPatrolTerrainScrollMetrics(layout, scrollOffset);
  const rowCount = layout.visibleTerrainRows + SKY_PATROL_TERRAIN_CACHE_EXTRA_ROWS;
  const width = Math.max(1, roundPixel(layout.width));
  const height = Math.max(1, Math.ceil(rowCount * layout.tileSize));
  const cacheKey = [
    width,
    height,
    layout.tileSize.toFixed(3),
    startWorldRow,
    rowCount,
  ].join("|");

  if (renderer.terrainCacheKey === cacheKey) {
    return;
  }

  if (terrainCanvas.width !== width || terrainCanvas.height !== height) {
    terrainCanvas.width = width;
    terrainCanvas.height = height;
  }

  terrainCtx.clearRect(0, 0, terrainCanvas.width, terrainCanvas.height);
  terrainCtx.imageSmoothingEnabled = false;
  const terrainRows = getSkyPatrolTerrainRows(layout, startWorldRow, rowCount);
  for (let rowIndex = 0; rowIndex < terrainRows.length; rowIndex += 1) {
    const row = terrainRows[rowIndex];
    const rowY = rowIndex * layout.tileSize;
    const rowHeight = Math.ceil(layout.tileSize + 1);
    for (const segment of row.segments) {
      const left = roundPixel(segment.startColumn * layout.tileSize);
      const segmentWidth = Math.ceil(segment.length * layout.tileSize + 1);
      drawTexturedTerrainSegment(
        terrainCtx,
        segment.terrain,
        left,
        rowY,
        segmentWidth,
        rowHeight,
        layout.tileSize,
      );
    }
  }

  renderer.terrainCacheKey = cacheKey;
}

function drawTerrain(ctx, renderer, state) {
  const { layout, scrollOffset } = state;
  paintTerrainBuffer(renderer, layout, scrollOffset);

  if (!renderer.terrainCanvas) {
    return;
  }

  const { rowOffset } = getSkyPatrolTerrainScrollMetrics(layout, scrollOffset);
  const drawY = roundPixel(rowOffset - layout.tileSize);
  ctx.drawImage(renderer.terrainCanvas, 0, drawY);
}

function drawPlayerShip(ctx, ship) {
  const { left, top, width, height } = getEntityBounds(ship);
  const wingSpan = roundPixel(width * 0.34);
  const bodyWidth = Math.max(6, roundPixel(width * 0.26));
  const outline = "#151922";

  fillPixelPath(
    ctx,
    [
      { x: left + width * 0.5, y: top },
      { x: left + width * 0.74, y: top + height * 0.24 },
      { x: left + width, y: top + height * 0.5 },
      { x: left + width * 0.72, y: top + height * 0.68 },
      { x: left + width * 0.6, y: top + height },
      { x: left + width * 0.4, y: top + height },
      { x: left + width * 0.28, y: top + height * 0.68 },
      { x: left, y: top + height * 0.5 },
      { x: left + width * 0.26, y: top + height * 0.24 },
    ],
    "#f3df9e",
    outline,
  );
  ctx.fillStyle = "#eb8a3c";
  ctx.fillRect(left + roundPixel(width * 0.5 - bodyWidth / 2), top + roundPixel(height * 0.16), bodyWidth, roundPixel(height * 0.68));
  ctx.fillStyle = "#4cb9ff";
  ctx.fillRect(left + roundPixel(width * 0.5 - bodyWidth * 0.32), top + roundPixel(height * 0.22), Math.max(3, roundPixel(bodyWidth * 0.64)), Math.max(4, roundPixel(height * 0.2)));
  ctx.fillStyle = "#fff8d6";
  ctx.fillRect(left + roundPixel(width * 0.5 - wingSpan), top + roundPixel(height * 0.44), wingSpan, Math.max(4, roundPixel(height * 0.12)));
  ctx.fillRect(left + width - wingSpan, top + roundPixel(height * 0.44), wingSpan, Math.max(4, roundPixel(height * 0.12)));
}

function drawEnemyShip(ctx, enemy) {
  const threatUi = getSkyPatrolThreatUi(enemy);
  const { left, top, width, height } = getEntityBounds(enemy);
  if (threatUi.shape === "air-chevron") {
    ctx.fillStyle = "rgba(255, 231, 176, 0.2)";
    fillPixelPath(
      ctx,
      [
        { x: left + width * 0.5, y: top + height * 0.18 },
        { x: left + width * 0.9, y: top + height * 0.58 },
        { x: left + width * 0.62, y: top + height * 0.5 },
        { x: left + width * 0.5, y: top + height * 0.92 },
        { x: left + width * 0.38, y: top + height * 0.5 },
        { x: left + width * 0.1, y: top + height * 0.58 },
      ],
      "rgba(255, 226, 150, 0.2)",
    );
  }
  fillPixelPath(
    ctx,
    [
      { x: left + width * 0.5, y: top },
      { x: left + width * 0.78, y: top + height * 0.22 },
      { x: left + width, y: top + height * 0.48 },
      { x: left + width * 0.7, y: top + height * 0.76 },
      { x: left + width * 0.58, y: top + height },
      { x: left + width * 0.42, y: top + height },
      { x: left + width * 0.3, y: top + height * 0.76 },
      { x: left, y: top + height * 0.48 },
      { x: left + width * 0.22, y: top + height * 0.22 },
    ],
    "#ef8a68",
    "#291316",
  );
  ctx.fillStyle = "#ffd2a7";
  ctx.fillRect(left + roundPixel(width * 0.36), top + roundPixel(height * 0.18), Math.max(4, roundPixel(width * 0.28)), Math.max(6, roundPixel(height * 0.24)));
  ctx.fillStyle = "#6d2022";
  ctx.fillRect(left + roundPixel(width * 0.18), top + roundPixel(height * 0.5), Math.max(4, roundPixel(width * 0.18)), Math.max(4, roundPixel(height * 0.12)));
  ctx.fillRect(left + roundPixel(width * 0.64), top + roundPixel(height * 0.5), Math.max(4, roundPixel(width * 0.18)), Math.max(4, roundPixel(height * 0.12)));
  drawHealthPips(ctx, enemy, top - 6);
}

function drawGroundTarget(ctx, target) {
  const threatUi = getSkyPatrolThreatUi(target);
  const { left, top, width, height } = getEntityBounds(target);
  drawGroundTargetSite(ctx, target);
  if (target.kind === "depot") {
    ctx.fillStyle = "#463626";
    ctx.fillRect(left, top + roundPixel(height * 0.18), width, height - roundPixel(height * 0.18));
    ctx.fillStyle = "#9d855b";
    ctx.fillRect(left + 1, top + roundPixel(height * 0.18), Math.max(1, width - 2), Math.max(1, height - roundPixel(height * 0.2) - 1));
    ctx.fillStyle = "#cfb07e";
    fillPixelPath(
      ctx,
      [
        { x: left, y: top + height * 0.2 },
        { x: left + width * 0.5, y: top },
        { x: left + width, y: top + height * 0.2 },
      ],
      "#d7c28e",
      "#463626",
    );
    ctx.fillStyle = "#60452f";
    ctx.fillRect(left + roundPixel(width * 0.38), top + roundPixel(height * 0.42), Math.max(4, roundPixel(width * 0.24)), Math.max(4, roundPixel(height * 0.42)));
    if (threatUi.shape === "ground-depot") {
      ctx.fillStyle = "#f1d66e";
      ctx.fillRect(left + roundPixel(width * 0.14), top + roundPixel(height * 0.3), Math.max(3, roundPixel(width * 0.14)), Math.max(3, roundPixel(height * 0.16)));
      ctx.fillRect(left + roundPixel(width * 0.72), top + roundPixel(height * 0.3), Math.max(3, roundPixel(width * 0.14)), Math.max(3, roundPixel(height * 0.16)));
    }
    return;
  }

  ctx.fillStyle = "#2c332a";
  ctx.fillRect(left, top + roundPixel(height * 0.12), width, height - roundPixel(height * 0.12));
  ctx.fillStyle = "#6c7f57";
  ctx.fillRect(left + 1, top + roundPixel(height * 0.18), Math.max(1, width - 2), Math.max(1, height - roundPixel(height * 0.24) - 1));
  ctx.fillStyle = "#d8e7b1";
  ctx.fillRect(left + roundPixel(width * 0.38), top, Math.max(4, roundPixel(width * 0.24)), Math.max(4, roundPixel(height * 0.24)));
  ctx.fillStyle = "#1d231d";
  ctx.fillRect(left + roundPixel(width * 0.44), top - Math.max(2, roundPixel(height * 0.14)), Math.max(2, roundPixel(width * 0.12)), Math.max(4, roundPixel(height * 0.34)));
  if (threatUi.shape === "ground-emplacement") {
    ctx.fillStyle = "#d8e7b1";
    ctx.fillRect(left + roundPixel(width * 0.18), top + roundPixel(height * 0.64), Math.max(3, roundPixel(width * 0.64)), Math.max(3, roundPixel(height * 0.12)));
  }
  drawHealthPips(ctx, target, top - 6);
}

function drawEntityShadow(ctx, entity, layout) {
  const cue = getSkyPatrolDepthCue(entity, layout);
  const shadowWidth = Math.max(8, roundPixel((entity.width ?? 24) * cue.shadowScale));
  const shadowHeight = Math.max(4, roundPixel((entity.height ?? 24) * 0.16 * cue.shadowScale));
  const centerX = entity.x ?? 0;
  const centerY = (entity.y ?? 0) + cue.offsetY;

  ctx.save();
  ctx.globalAlpha = cue.shadowOpacity;
  fillPixelPath(
    ctx,
    [
      { x: centerX - shadowWidth / 2, y: centerY },
      { x: centerX, y: centerY - shadowHeight / 2 },
      { x: centerX + shadowWidth / 2, y: centerY },
      { x: centerX, y: centerY + shadowHeight / 2 },
    ],
    "rgba(8, 15, 24, 0.72)",
  );
  ctx.restore();
}

function drawGroundTargetSite(ctx, target) {
  const siteUi = getSkyPatrolGroundSiteUi(target);
  const { top, width, height } = getEntityBounds(target);
  const padWidth = Math.max(width + 10, roundPixel(width * 1.44));
  const padHeight = Math.max(8, roundPixel(height * 0.28));
  const padLeft = roundPixel(target.x - padWidth / 2);
  const padTop = roundPixel(top + height * 0.74);

  if (siteUi.marker === "runway-pad") {
    ctx.fillStyle = "rgba(31, 36, 48, 0.78)";
    ctx.fillRect(padLeft, padTop, padWidth, padHeight);
    ctx.fillStyle = "rgba(244, 241, 222, 0.78)";
    for (let x = padLeft + 4; x < padLeft + padWidth - 4; x += 12) {
      ctx.fillRect(
        x,
        padTop + roundPixel(padHeight * 0.46),
        6,
        Math.max(2, roundPixel(padHeight * 0.16)),
      );
    }
    return;
  }

  if (siteUi.marker === "road-pad") {
    ctx.fillStyle = "rgba(79, 63, 45, 0.78)";
    ctx.fillRect(padLeft, padTop, padWidth, padHeight);
    ctx.fillStyle = "rgba(241, 214, 110, 0.72)";
    ctx.fillRect(
      padLeft + 3,
      padTop + roundPixel(padHeight * 0.42),
      Math.max(4, padWidth - 6),
      Math.max(2, roundPixel(padHeight * 0.18)),
    );
    return;
  }

  ctx.fillStyle = "rgba(30, 61, 36, 0.7)";
  ctx.fillRect(padLeft, padTop, padWidth, padHeight);
  ctx.fillStyle = "rgba(180, 219, 128, 0.38)";
  ctx.fillRect(
    padLeft + 3,
    padTop + 2,
    Math.max(5, roundPixel(padWidth * 0.28)),
    Math.max(2, roundPixel(padHeight * 0.32)),
  );
  ctx.fillRect(
    padLeft + roundPixel(padWidth * 0.62),
    padTop + roundPixel(padHeight * 0.54),
    Math.max(5, roundPixel(padWidth * 0.26)),
    Math.max(2, roundPixel(padHeight * 0.28)),
  );
}

function drawHealthPips(ctx, entity, y) {
  const pips = getSkyPatrolTargetHealthPips(entity);
  if (pips.length <= 1) {
    return;
  }

  const pipWidth = 5;
  const pipGap = 2;
  const totalWidth = pips.length * pipWidth + (pips.length - 1) * pipGap;
  const startX = roundPixel(entity.x - totalWidth / 2);
  for (let index = 0; index < pips.length; index += 1) {
    ctx.fillStyle = pips[index] === "filled" ? "#fff2a8" : "rgba(12, 18, 26, 0.72)";
    ctx.fillRect(startX + index * (pipWidth + pipGap), roundPixel(y), pipWidth, 3);
  }
}

function drawProjectile(ctx, shot) {
  const projectileUi = getSkyPatrolProjectileUi(shot);
  const { left, top, width, height } = getEntityBounds(shot);

  if (projectileUi.shape === "fighter-round") {
    fillPixelPath(
      ctx,
      [
        { x: left + width * 0.5, y: top },
        { x: left + width, y: top + height * 0.5 },
        { x: left + width * 0.5, y: top + height },
        { x: left, y: top + height * 0.5 },
      ],
      projectileUi.fill,
      projectileUi.outline,
    );
    ctx.fillStyle = projectileUi.core;
    ctx.fillRect(
      left + roundPixel(width * 0.34),
      top + roundPixel(height * 0.34),
      Math.max(2, roundPixel(width * 0.32)),
      Math.max(2, roundPixel(height * 0.32)),
    );
    return;
  }

  if (projectileUi.shape === "turret-shell") {
    ctx.fillStyle = projectileUi.outline;
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = projectileUi.fill;
    ctx.fillRect(left + 1, top + 1, Math.max(1, width - 2), Math.max(1, height - 2));
    ctx.fillStyle = projectileUi.core;
    ctx.fillRect(
      left + roundPixel(width * 0.3),
      top + roundPixel(height * 0.18),
      Math.max(2, roundPixel(width * 0.4)),
      Math.max(2, roundPixel(height * 0.26)),
    );
    ctx.fillStyle = "rgba(155, 233, 255, 0.28)";
    ctx.fillRect(
      left + roundPixel(width * 0.2),
      top - Math.max(2, roundPixel(height * 0.28)),
      Math.max(2, roundPixel(width * 0.6)),
      Math.max(2, roundPixel(height * 0.26)),
    );
    return;
  }

  ctx.fillStyle = projectileUi.outline;
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = projectileUi.fill;
  ctx.fillRect(left + 1, top + 1, Math.max(1, width - 2), Math.max(1, height - 2));
  ctx.fillStyle = projectileUi.core;
  ctx.fillRect(
    left + roundPixel(width * 0.34),
    top + 1,
    Math.max(2, roundPixel(width * 0.32)),
    Math.max(2, height - 2),
  );
}

function drawExplosion(ctx, explosion, tileSize) {
  const progress = clamp(explosion.ageMs / Math.max(1, explosion.ttlMs), 0, 1);
  const size = tileSize * (1.1 + progress * 2.1);
  const block = Math.max(2, roundPixel(tileSize * 0.18));
  const left = roundPixel(explosion.x - size / 2);
  const top = roundPixel(explosion.y - size / 2);
  const centerX = left + roundPixel(size / 2);
  const centerY = top + roundPixel(size / 2);
  const colors =
    explosion.kind === "ground"
      ? ["rgba(255, 235, 171, 0.92)", "rgba(255, 142, 84, 0.84)", "rgba(98, 63, 29, 0.58)"]
      : ["rgba(255, 248, 190, 0.96)", "rgba(255, 162, 74, 0.86)", "rgba(255, 84, 68, 0.54)"];

  ctx.fillStyle = colors[2];
  ctx.fillRect(centerX - block * 2, centerY - block * 2, block * 4, block * 4);
  ctx.fillStyle = colors[1];
  ctx.fillRect(centerX - block * 3, centerY - block, block * 6, block * 2);
  ctx.fillRect(centerX - block, centerY - block * 3, block * 2, block * 6);
  ctx.fillStyle = colors[0];
  ctx.fillRect(centerX - block * 2, centerY - block, block * 4, block * 2);
  ctx.fillRect(centerX - block, centerY - block * 2, block * 2, block * 4);
}

function drawScoreBurst(ctx, burst, tileSize) {
  const progress = clamp(burst.ageMs / Math.max(1, burst.ttlMs), 0, 1);
  const y = burst.y - progress * tileSize * 1.6;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = "#fff2a8";
  ctx.font = `${Math.max(10, roundPixel(tileSize * 0.72))}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`+${burst.value}`, roundPixel(burst.x), roundPixel(y));
  ctx.restore();
}

function drawSkyPatrolFrame(renderer, state) {
  const ctx = renderer.ctx;
  const canvas = renderer.canvas;
  if (!ctx || !canvas || !state?.layout) {
    return;
  }

  const targetWidth = Math.max(1, roundPixel(state.layout.width));
  const targetHeight = Math.max(1, roundPixel(state.layout.height));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  if ((state.damageFlashMs ?? 0) > 0) {
    const flashProgress = clamp(state.damageFlashMs / 320, 0, 1);
    ctx.fillStyle = `rgba(255, 104, 78, ${0.22 * flashProgress})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawTerrain(ctx, renderer, state);

  for (const target of state.groundTargets ?? []) {
    drawEntityShadow(ctx, target, state.layout);
    drawGroundTarget(ctx, target);
  }
  for (const enemy of state.airEnemies ?? []) {
    drawEntityShadow(ctx, enemy, state.layout);
    drawEnemyShip(ctx, enemy);
  }
  for (const shot of state.playerShots ?? []) {
    drawProjectile(ctx, shot);
  }
  for (const shot of state.enemyShots ?? []) {
    drawProjectile(ctx, shot);
  }
  if (state.ship) {
    drawEntityShadow(ctx, state.ship, state.layout);
    ctx.save();
    if (state.ship.invulnerableMs > 0) {
      ctx.globalAlpha = 0.58;
    }
    drawPlayerShip(ctx, state.ship);
    ctx.restore();
  }
  for (const explosion of state.explosions ?? []) {
    drawExplosion(ctx, explosion, state.layout.tileSize);
  }
  for (const burst of state.scoreBursts ?? []) {
    drawScoreBurst(ctx, burst, state.layout.tileSize);
  }
}

export function getSkyPatrolHudState(state) {
  if (!state) {
    return null;
  }

  return {
    score: state.score ?? 0,
    targetsDestroyed: state.targetsDestroyed ?? 0,
    lives: state.lives ?? SKY_PATROL_STARTING_LIVES,
    activeTargetCount: (state.airEnemies?.length ?? 0) + (state.groundTargets?.length ?? 0),
    airTargetCount: state.airEnemies?.length ?? 0,
    groundTargetCount: state.groundTargets?.length ?? 0,
    fireCooldownMs: state.fireCooldownMs ?? 0,
    fireReady: (state.fireCooldownMs ?? 0) <= 0,
    incomingIndicators: getSkyPatrolIncomingIndicators(state),
    legendFaded: (state.elapsedMs ?? 0) >= SKY_PATROL_LEGEND_FADE_MS,
    radarBlips: getSkyPatrolRadarBlips(state),
    startPromptVisible:
      (state.status ?? "playing") === "playing" &&
      (state.elapsedMs ?? 0) < SKY_PATROL_START_PROMPT_MS,
    status: state.status ?? "playing",
    message: state.message ?? "",
  };
}

export function areSkyPatrolHudStatesEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.score === b.score &&
    a.targetsDestroyed === b.targetsDestroyed &&
    a.lives === b.lives &&
    a.activeTargetCount === b.activeTargetCount &&
    a.airTargetCount === b.airTargetCount &&
    a.groundTargetCount === b.groundTargetCount &&
    a.fireCooldownMs === b.fireCooldownMs &&
    a.fireReady === b.fireReady &&
    JSON.stringify(a.incomingIndicators ?? []) === JSON.stringify(b.incomingIndicators ?? []) &&
    a.legendFaded === b.legendFaded &&
    JSON.stringify(a.radarBlips ?? []) === JSON.stringify(b.radarBlips ?? []) &&
    a.startPromptVisible === b.startPromptVisible &&
    a.status === b.status &&
    a.message === b.message
  );
}

export function createSkyPatrolCanvasRenderer(canvas) {
  const ctx = canvas?.getContext?.("2d") ?? null;
  const terrainCanvas = createAuxiliaryCanvas(canvas);
  const terrainCtx = terrainCanvas?.getContext?.("2d") ?? null;

  return {
    canvas,
    ctx,
    terrainCanvas,
    terrainCtx,
    terrainCacheKey: "",
    clear() {
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    },
    resize(width, height) {
      if (!this.canvas) {
        return;
      }
      const nextWidth = Math.max(1, roundPixel(width));
      const nextHeight = Math.max(1, roundPixel(height));
      if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
        this.canvas.width = nextWidth;
        this.canvas.height = nextHeight;
        this.terrainCacheKey = "";
      }
    },
    draw(state) {
      drawSkyPatrolFrame(this, state);
    },
  };
}
