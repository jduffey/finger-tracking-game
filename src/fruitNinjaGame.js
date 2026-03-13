import { createScopedLogger } from "./logger.js";

const fruitNinjaLog = createScopedLogger("fruitNinjaGame");

export const FRUIT_NINJA_BLADE_TRAIL_MS = 220;
export const FRUIT_NINJA_GAME_OVER_LIVES = 3;
export const FRUIT_NINJA_BASE_SCORE = 100;
export const FRUIT_NINJA_COMBO_BONUS = 35;
export const FRUIT_NINJA_BOMB_PENALTY = 180;

const FRUIT_NINJA_GRAVITY = 1380;
const FRUIT_NINJA_TARGET_RADIUS_RATIO = 0.052;
const FRUIT_NINJA_MIN_TARGET_RADIUS = 26;
const FRUIT_NINJA_MAX_TARGET_RADIUS = 48;
const FRUIT_NINJA_MIN_SWIPE_SPEED = 760;
const FRUIT_NINJA_MIN_SEGMENT_LENGTH = 16;
const FRUIT_NINJA_TRAIL_SAMPLE_DISTANCE = 10;
const FRUIT_NINJA_TRAIL_SAMPLE_MS = 16;
const FRUIT_NINJA_COMBO_WINDOW_MS = 520;
const FRUIT_NINJA_POPUP_TTL_MS = 720;
const FRUIT_NINJA_PARTICLE_TTL_MS = 640;
const FRUIT_NINJA_SPLIT_TTL_MS = 820;
const FRUIT_NINJA_MAX_STEP_SECONDS = 0.05;

const FRUIT_COLORS = [
  { fill: "#ff6b57", accent: "#ffd4bf", name: "Sun Peach" },
  { fill: "#4fd46a", accent: "#d7ffd5", name: "Mint Melon" },
  { fill: "#ffcc45", accent: "#fff3b6", name: "Solar Citrus" },
  { fill: "#59b7ff", accent: "#e3f4ff", name: "Sky Plum" },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max, rng = Math.random) {
  return min + rng() * Math.max(0, max - min);
}

function randomChoice(values, rng = Math.random) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const index = Math.floor(rng() * values.length);
  return values[index] ?? values[0] ?? null;
}

export function createFruitNinjaLayout(width, height) {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 320);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const minDimension = Math.min(safeWidth, safeHeight);
  return {
    width: safeWidth,
    height: safeHeight,
    targetRadius: clamp(
      minDimension * FRUIT_NINJA_TARGET_RADIUS_RATIO,
      FRUIT_NINJA_MIN_TARGET_RADIUS,
      FRUIT_NINJA_MAX_TARGET_RADIUS,
    ),
  };
}

function createTargetId(prefix, nextId) {
  return `${prefix}-${nextId}`;
}

function createFruitTarget(layout, nextId, rng = Math.random) {
  const radius = layout.targetRadius * randomBetween(0.88, 1.18, rng);
  const spawnX = randomBetween(radius * 1.2, layout.width - radius * 1.2, rng);
  const spawnY = layout.height + radius * randomBetween(1.2, 1.9, rng);
  const horizontalDirection = spawnX < layout.width * 0.5 ? 1 : -1;
  const vx =
    horizontalDirection * randomBetween(layout.width * 0.09, layout.width * 0.22, rng) +
    randomBetween(-30, 30, rng);
  const vy = -randomBetween(layout.height * 0.92, layout.height * 1.14, rng);
  const palette = randomChoice(FRUIT_COLORS, rng) ?? FRUIT_COLORS[0];
  return {
    id: createTargetId("fruit", nextId),
    kind: "fruit",
    label: palette.name,
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    radius,
    rotation: randomBetween(-0.4, 0.4, rng),
    spin: randomBetween(-2.8, 2.8, rng),
    fill: palette.fill,
    accent: palette.accent,
    missed: false,
  };
}

function createBombTarget(layout, nextId, rng = Math.random) {
  const radius = layout.targetRadius * randomBetween(0.92, 1.08, rng);
  const spawnX = randomBetween(radius * 1.2, layout.width - radius * 1.2, rng);
  const spawnY = layout.height + radius * randomBetween(1.2, 2.0, rng);
  const horizontalDirection = spawnX < layout.width * 0.5 ? 1 : -1;
  const vx =
    horizontalDirection * randomBetween(layout.width * 0.08, layout.width * 0.18, rng) +
    randomBetween(-40, 40, rng);
  const vy = -randomBetween(layout.height * 0.82, layout.height * 1.02, rng);
  return {
    id: createTargetId("bomb", nextId),
    kind: "bomb",
    label: "Bomb",
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    radius,
    rotation: randomBetween(-0.2, 0.2, rng),
    spin: randomBetween(-2.2, 2.2, rng),
    fill: "#111827",
    accent: "#ff7b6b",
    missed: false,
  };
}

function createSliceParticles(target, particlePrefix, rng = Math.random) {
  return Array.from({ length: target.kind === "bomb" ? 16 : 10 }, (_, index) => ({
    id: `${particlePrefix}-particle-${index}`,
    kind: target.kind === "bomb" ? "flash" : "juice",
    x: target.x,
    y: target.y,
    vx: randomBetween(-260, 260, rng),
    vy: randomBetween(-320, -30, rng),
    radius: randomBetween(4, 10, rng),
    ttlMs: FRUIT_NINJA_PARTICLE_TTL_MS,
    ageMs: 0,
    fill: target.kind === "bomb" ? "#ffd166" : target.accent,
  }));
}

function createFruitSplitPieces(target, piecePrefix) {
  if (target.kind !== "fruit") {
    return [];
  }

  return [
    {
      id: `${piecePrefix}-left`,
      x: target.x - target.radius * 0.22,
      y: target.y,
      vx: target.vx - target.radius * 2.2,
      vy: target.vy * 0.68,
      rotation: target.rotation,
      angularVelocity: target.spin - 2.2,
      radius: target.radius,
      ttlMs: FRUIT_NINJA_SPLIT_TTL_MS,
      ageMs: 0,
      fill: target.fill,
      accent: target.accent,
      half: "left",
    },
    {
      id: `${piecePrefix}-right`,
      x: target.x + target.radius * 0.22,
      y: target.y,
      vx: target.vx + target.radius * 2.2,
      vy: target.vy * 0.68,
      rotation: target.rotation,
      angularVelocity: target.spin + 2.2,
      radius: target.radius,
      ttlMs: FRUIT_NINJA_SPLIT_TTL_MS,
      ageMs: 0,
      fill: target.fill,
      accent: target.accent,
      half: "right",
    },
  ];
}

export function computeSwipeSegments(trailPoints, options = {}) {
  const minSpeed = Number.isFinite(options.minSpeed)
    ? options.minSpeed
    : FRUIT_NINJA_MIN_SWIPE_SPEED;
  const minLength = Number.isFinite(options.minLength)
    ? options.minLength
    : FRUIT_NINJA_MIN_SEGMENT_LENGTH;
  const safePoints = Array.isArray(trailPoints) ? trailPoints : [];
  const segments = [];

  for (let index = 1; index < safePoints.length; index += 1) {
    const start = safePoints[index - 1];
    const end = safePoints[index];
    if (
      !Number.isFinite(start?.x) ||
      !Number.isFinite(start?.y) ||
      !Number.isFinite(start?.timestamp) ||
      !Number.isFinite(end?.x) ||
      !Number.isFinite(end?.y) ||
      !Number.isFinite(end?.timestamp)
    ) {
      continue;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const dtMs = Math.max(1, end.timestamp - start.timestamp);
    const speed = distance / (dtMs / 1000);

    if (distance < minLength || speed < minSpeed) {
      continue;
    }

    segments.push({
      start,
      end,
      distance,
      dtMs,
      speed,
    });
  }

  return segments;
}

export function segmentIntersectsCircle(start, end, circle, padding = 0) {
  if (
    !Number.isFinite(start?.x) ||
    !Number.isFinite(start?.y) ||
    !Number.isFinite(end?.x) ||
    !Number.isFinite(end?.y) ||
    !Number.isFinite(circle?.x) ||
    !Number.isFinite(circle?.y) ||
    !Number.isFinite(circle?.radius)
  ) {
    return false;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lineLengthSquared = dx * dx + dy * dy;
  if (lineLengthSquared <= 1e-9) {
    return Math.hypot(circle.x - start.x, circle.y - start.y) <= circle.radius + padding;
  }

  const projection =
    ((circle.x - start.x) * dx + (circle.y - start.y) * dy) / lineLengthSquared;
  const t = clamp(projection, 0, 1);
  const nearestX = start.x + dx * t;
  const nearestY = start.y + dy * t;
  return Math.hypot(circle.x - nearestX, circle.y - nearestY) <= circle.radius + padding;
}

export function scoreSliceBatch(sliceKinds, comboCount = 0) {
  const safeKinds = Array.isArray(sliceKinds) ? sliceKinds : [];
  let nextComboCount = comboCount;
  let points = 0;
  let bombHit = false;

  for (const kind of safeKinds) {
    if (kind === "fruit") {
      nextComboCount += 1;
      points += FRUIT_NINJA_BASE_SCORE + Math.max(0, nextComboCount - 1) * FRUIT_NINJA_COMBO_BONUS;
      continue;
    }
    if (kind === "bomb") {
      bombHit = true;
      nextComboCount = 0;
      points -= FRUIT_NINJA_BOMB_PENALTY;
    }
  }

  return {
    points,
    bombHit,
    nextComboCount,
  };
}

function defaultSpawnCooldownMs(rng = Math.random) {
  return randomBetween(420, 880, rng);
}

function createPopup(text, x, y, kind, nextId) {
  return {
    id: `popup-${nextId}`,
    text,
    x,
    y,
    kind,
    ttlMs: FRUIT_NINJA_POPUP_TTL_MS,
    ageMs: 0,
  };
}

function createEmptyState(layout) {
  return {
    layout,
    elapsedMs: 0,
    status: "running",
    score: 0,
    lives: FRUIT_NINJA_GAME_OVER_LIVES,
    comboCount: 0,
    comboExpiresAt: 0,
    message: "Swipe fast with your index fingertip to slice fruit and avoid bombs.",
    targets: [],
    splitPieces: [],
    particles: [],
    popups: [],
    bladeTrail: [],
    swipeSegments: [],
    spawnCooldownMs: 140,
    nextTargetId: 1,
    nextFxId: 1,
  };
}

export function createFruitNinjaGame(width, height) {
  const layout = createFruitNinjaLayout(width, height);
  const state = createEmptyState(layout);
  fruitNinjaLog.info("Created fruit ninja game state", layout);
  return state;
}

function pruneBladeTrail(points, now) {
  return points.filter((point) => now - point.timestamp <= FRUIT_NINJA_BLADE_TRAIL_MS);
}

function appendBladePoint(trail, pointer, now) {
  const nextTrail = pruneBladeTrail(Array.isArray(trail) ? trail : [], now);
  if (!pointer?.active || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
    return nextTrail;
  }

  const lastPoint = nextTrail[nextTrail.length - 1];
  const distance = lastPoint ? Math.hypot(pointer.x - lastPoint.x, pointer.y - lastPoint.y) : Infinity;
  const elapsedMs = lastPoint ? now - lastPoint.timestamp : Infinity;
  if (distance < FRUIT_NINJA_TRAIL_SAMPLE_DISTANCE && elapsedMs < FRUIT_NINJA_TRAIL_SAMPLE_MS) {
    return nextTrail;
  }

  nextTrail.push({
    x: pointer.x,
    y: pointer.y,
    timestamp: now,
  });
  return nextTrail;
}

function spawnTargets(state, rng = Math.random) {
  if (state.status !== "running") {
    return state;
  }

  let nextState = state;
  if (state.spawnCooldownMs > 0) {
    return nextState;
  }

  const spawnCount = rng() > 0.68 ? 2 : 1;
  const nextTargets = [...state.targets];
  let nextTargetId = state.nextTargetId;
  for (let index = 0; index < spawnCount; index += 1) {
    const spawnBomb = rng() > 0.77 && nextTargets.every((target) => target.kind !== "bomb");
    nextTargets.push(
      spawnBomb
        ? createBombTarget(state.layout, nextTargetId, rng)
        : createFruitTarget(state.layout, nextTargetId, rng),
    );
    nextTargetId += 1;
  }

  nextState = {
    ...state,
    targets: nextTargets,
    nextTargetId,
    spawnCooldownMs: defaultSpawnCooldownMs(rng),
  };
  return nextState;
}

function advanceFx(items, dtMs, gravity = FRUIT_NINJA_GRAVITY * 0.3) {
  return items
    .map((item) => ({
      ...item,
      x: item.x + item.vx * (dtMs / 1000),
      y: item.y + item.vy * (dtMs / 1000),
      vy: item.vy + gravity * (dtMs / 1000),
      rotation:
        Number.isFinite(item.rotation) && Number.isFinite(item.angularVelocity)
          ? item.rotation + item.angularVelocity * (dtMs / 1000)
          : item.rotation,
      ageMs: item.ageMs + dtMs,
    }))
    .filter((item) => item.ageMs < item.ttlMs);
}

function advancePopups(items, dtMs) {
  return items
    .map((item) => ({
      ...item,
      y: item.y - dtMs * 0.045,
      ageMs: item.ageMs + dtMs,
    }))
    .filter((item) => item.ageMs < item.ttlMs);
}

export function stepFruitNinjaGame(state, dtSeconds, pointer, now = performance.now(), rng = Math.random) {
  if (!state?.layout) {
    return state;
  }

  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, FRUIT_NINJA_MAX_STEP_SECONDS);
  const dtMs = safeDt * 1000;
  const safeNow = Number.isFinite(now) ? now : 0;
  const nextElapsedMs = state.elapsedMs + dtMs;

  let nextState = {
    ...state,
    elapsedMs: nextElapsedMs,
    spawnCooldownMs: state.spawnCooldownMs - dtMs,
    bladeTrail: appendBladePoint(state.bladeTrail, pointer, safeNow),
    particles: advanceFx(state.particles, dtMs),
    splitPieces: advanceFx(state.splitPieces, dtMs, FRUIT_NINJA_GRAVITY * 0.5),
    popups: advancePopups(state.popups, dtMs),
  };

  if (nextState.comboExpiresAt > 0 && safeNow > nextState.comboExpiresAt) {
    nextState.comboCount = 0;
    nextState.comboExpiresAt = 0;
  }

  nextState = spawnTargets(nextState, rng);

  const nextTargets = [];
  let score = nextState.score;
  let lives = nextState.lives;
  let comboCount = nextState.comboCount;
  let comboExpiresAt = nextState.comboExpiresAt;
  let nextFxId = nextState.nextFxId;
  let message = nextState.message;
  const nextParticles = [...nextState.particles];
  const nextSplitPieces = [...nextState.splitPieces];
  const nextPopups = [...nextState.popups];
  const swipeSegments = computeSwipeSegments(nextState.bladeTrail);
  const slicedKinds = [];

  for (const target of nextState.targets) {
    const advancedTarget = {
      ...target,
      x: target.x + target.vx * safeDt,
      y: target.y + target.vy * safeDt,
      vy: target.vy + FRUIT_NINJA_GRAVITY * safeDt,
      rotation: target.rotation + target.spin * safeDt,
    };

    const isSliced = swipeSegments.some((segment) =>
      segmentIntersectsCircle(segment.start, segment.end, advancedTarget, 8),
    );

    if (isSliced) {
      const scoreResult = scoreSliceBatch([advancedTarget.kind], comboCount);
      score += scoreResult.points;
      comboCount = scoreResult.nextComboCount;
      comboExpiresAt =
        advancedTarget.kind === "fruit" ? safeNow + FRUIT_NINJA_COMBO_WINDOW_MS : 0;
      if (scoreResult.bombHit) {
        lives -= 1;
        message = "Bomb clipped. Keep the blade away from dark cores.";
      } else {
        const comboLabel = comboCount > 1 ? `Combo x${comboCount}` : advancedTarget.label;
        message = `${comboLabel} sliced.`;
      }
      nextParticles.push(...createSliceParticles(advancedTarget, `fx-${nextFxId}`, rng));
      nextFxId += 1;
      nextSplitPieces.push(...createFruitSplitPieces(advancedTarget, `split-${nextFxId}`));
      nextFxId += 1;
      nextPopups.push(
        createPopup(
          advancedTarget.kind === "bomb"
            ? `-${FRUIT_NINJA_BOMB_PENALTY}`
            : `+${Math.max(FRUIT_NINJA_BASE_SCORE, scoreResult.points)}`,
          advancedTarget.x,
          advancedTarget.y,
          advancedTarget.kind,
          nextFxId,
        ),
      );
      nextFxId += 1;
      slicedKinds.push(advancedTarget.kind);
      continue;
    }

    const fellPastFloor = advancedTarget.y - advancedTarget.radius > nextState.layout.height + 60;
    if (fellPastFloor) {
      if (advancedTarget.kind === "fruit") {
        lives -= 1;
        comboCount = 0;
        comboExpiresAt = 0;
        message = "Fruit missed. Three misses ends the round.";
        nextPopups.push(
          createPopup("MISS", advancedTarget.x, nextState.layout.height - 36, "miss", nextFxId),
        );
        nextFxId += 1;
      }
      continue;
    }

    nextTargets.push(advancedTarget);
  }

  if (slicedKinds.length > 1) {
    nextPopups.push(
      createPopup(
        `${slicedKinds.filter((kind) => kind === "fruit").length} HIT`,
        nextState.layout.width * 0.5,
        nextState.layout.height * 0.22,
        "combo",
        nextFxId,
      ),
    );
    nextFxId += 1;
  }

  const status = lives <= 0 ? "gameover" : nextState.status;
  if (status === "gameover") {
    message = "Round over. Restart to launch another wave.";
  }

  return {
    ...nextState,
    score: Math.max(0, Math.round(score)),
    lives: Math.max(0, lives),
    comboCount,
    comboExpiresAt,
    message,
    status,
    targets: nextTargets,
    particles: nextParticles,
    splitPieces: nextSplitPieces,
    popups: nextPopups,
    swipeSegments,
    nextFxId,
  };
}
