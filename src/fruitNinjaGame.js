import { createScopedLogger } from "./logger.js";

const fruitNinjaLog = createScopedLogger("fruitNinjaGame");

export const FRUIT_NINJA_BLADE_TRAIL_MS = 220;
export const FRUIT_NINJA_GAME_OVER_LIVES = 3;
export const FRUIT_NINJA_BASE_SCORE = 100;
export const FRUIT_NINJA_COMBO_BONUS = 35;
export const FRUIT_NINJA_BOMB_PENALTY = 180;
export const FRUIT_NINJA_ROUND_DURATION_MS = 60_000;
export const FRUIT_NINJA_TOTAL_WAVES = 5;
export const FRUIT_NINJA_BOMB_TELEGRAPH_MS = 720;
export const FRUIT_NINJA_FEVER_DURATION_MS = 6_000;
export const FRUIT_NINJA_SLOW_TIME_DURATION_MS = 4_200;
export const FRUIT_NINJA_MAX_SHIELDS = 2;
export const FRUIT_NINJA_GOLDEN_BONUS = 250;
export const FRUIT_NINJA_FEVER_MAX = 100;
export const FRUIT_NINJA_COMBO_WINDOW_MS = 520;

export const FRUIT_NINJA_PRECISION_GRADES = Object.freeze({
  perfect: Object.freeze({ label: "Perfect", bonus: 75 }),
  great: Object.freeze({ label: "Great", bonus: 35 }),
  good: Object.freeze({ label: "Good", bonus: 0 }),
});

const FRUIT_NINJA_GRAVITY = 1380;
const FRUIT_NINJA_TARGET_RADIUS_RATIO = 0.052;
const FRUIT_NINJA_MIN_TARGET_RADIUS = 26;
const FRUIT_NINJA_MAX_TARGET_RADIUS = 48;
const FRUIT_NINJA_TARGET_SCALE = 1.5;
const FRUIT_NINJA_MIN_SWIPE_SPEED = 760;
const FRUIT_NINJA_MIN_SEGMENT_LENGTH = 16;
const FRUIT_NINJA_TRAIL_SAMPLE_DISTANCE = 10;
const FRUIT_NINJA_TRAIL_SAMPLE_MS = 16;
const FRUIT_NINJA_POPUP_TTL_MS = 720;
const FRUIT_NINJA_PARTICLE_TTL_MS = 640;
const FRUIT_NINJA_SPLIT_TTL_MS = 820;
const FRUIT_NINJA_MAX_STEP_SECONDS = 0.05;
const FRUIT_NINJA_TARGET_SPEED_SCALE = 0.7;
const FRUIT_NINJA_TARGET_GRAVITY = FRUIT_NINJA_GRAVITY * FRUIT_NINJA_TARGET_SPEED_SCALE ** 2;
const FRUIT_NINJA_TARGET_APEX_MIN_RATIO = 0.2;
const FRUIT_NINJA_TARGET_APEX_MAX_RATIO = 0.28;
const FRUIT_NINJA_FEVER_PER_FRUIT = 18;
const FRUIT_NINJA_WAVE_BANNER_MS = 1_100;
const FRUIT_NINJA_SEED_FALLBACK = 0x6d2b79f5;

const FRUIT_COLORS = [
  { fill: "#ff6b57", accent: "#ffd4bf", name: "Sun Peach" },
  { fill: "#4fd46a", accent: "#d7ffd5", name: "Mint Melon" },
  { fill: "#ffcc45", accent: "#fff3b6", name: "Solar Citrus" },
  { fill: "#59b7ff", accent: "#e3f4ff", name: "Sky Plum" },
];

const SPECIAL_FRUIT_STYLES = Object.freeze({
  golden: Object.freeze({
    fill: "#ffd84d",
    accent: "#fff6b0",
    name: "Golden Starfruit",
  }),
  frost: Object.freeze({
    fill: "#61d8ff",
    accent: "#e7fbff",
    name: "Frost Berry",
  }),
  shield: Object.freeze({
    fill: "#9d7cff",
    accent: "#f0eaff",
    name: "Guard Grape",
  }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : fallback));
}

export function normalizeFruitNinjaSeed(value) {
  if (Number.isFinite(value)) {
    return (Math.trunc(value) >>> 0) || FRUIT_NINJA_SEED_FALLBACK;
  }

  const text = String(value ?? "slice-air");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || FRUIT_NINJA_SEED_FALLBACK;
}

function nextSeededRandom(randomState) {
  let nextState = normalizeFruitNinjaSeed(randomState);
  nextState ^= nextState << 13;
  nextState ^= nextState >>> 17;
  nextState ^= nextState << 5;
  nextState >>>= 0;
  return {
    value: nextState / 4294967296,
    randomState: nextState || FRUIT_NINJA_SEED_FALLBACK,
  };
}

export function createFruitNinjaSeededRng(seed) {
  let randomState = normalizeFruitNinjaSeed(seed);
  const rng = () => {
    const next = nextSeededRandom(randomState);
    randomState = next.randomState;
    return next.value;
  };
  rng.getState = () => randomState;
  return rng;
}

function normalizeDailyDate(date) {
  const parsed = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

export function getFruitNinjaDailyChallenge(date = new Date()) {
  const dayKey = normalizeDailyDate(date).toISOString().slice(0, 10);
  return Object.freeze({
    id: `slice-air-daily-${dayKey}`,
    dayKey,
    seed: normalizeFruitNinjaSeed(`slice-air:${dayKey}`),
    roundDurationMs: FRUIT_NINJA_ROUND_DURATION_MS,
    totalWaves: FRUIT_NINJA_TOTAL_WAVES,
  });
}

export function getFruitNinjaWaveProfile(wave = 1) {
  const safeWave = clamp(nonNegativeInteger(wave, 1), 1, FRUIT_NINJA_TOTAL_WAVES);
  return Object.freeze({
    wave: safeWave,
    label: ["Warm-up", "Rush", "Crossfire", "Bomb Run", "Finale"][safeWave - 1],
    spawnCooldownMinMs: Math.max(210, 420 - (safeWave - 1) * 48),
    spawnCooldownMaxMs: Math.max(430, 880 - (safeWave - 1) * 72),
    doubleSpawnChance: clamp(0.32 + (safeWave - 1) * 0.08, 0, 0.64),
    tripleSpawnChance: safeWave >= 4 ? 0.1 + (safeWave - 4) * 0.06 : 0,
    bombChance: clamp(0.23 + (safeWave - 1) * 0.035, 0, 0.38),
    speedMultiplier: 1 + (safeWave - 1) * 0.075,
    specialChance: clamp(0.12 + (safeWave - 1) * 0.025, 0, 0.22),
  });
}

function resolveStepRng(state, suppliedRng) {
  if (typeof suppliedRng === "function") {
    return {
      rng: suppliedRng,
      getRandomState: () => state.randomState ?? null,
    };
  }
  if (Number.isFinite(state.randomState)) {
    const rng = createFruitNinjaSeededRng(state.randomState);
    return {
      rng,
      getRandomState: () => rng.getState(),
    };
  }
  return {
    rng: Math.random,
    getRandomState: () => state.randomState ?? null,
  };
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
    ) * FRUIT_NINJA_TARGET_SCALE,
  };
}

function createTargetId(prefix, nextId) {
  return `${prefix}-${nextId}`;
}

function createTargetLaunch(layout, spawnX, spawnY, radius, horizontalRange, horizontalJitter, rng = Math.random) {
  const horizontalDirection = spawnX < layout.width * 0.5 ? 1 : -1;
  const vx =
    (horizontalDirection * randomBetween(horizontalRange.min, horizontalRange.max, rng) +
      randomBetween(horizontalJitter.min, horizontalJitter.max, rng)) *
    FRUIT_NINJA_TARGET_SPEED_SCALE;
  const desiredApexY = clamp(
    randomBetween(
      layout.height * FRUIT_NINJA_TARGET_APEX_MIN_RATIO,
      layout.height * FRUIT_NINJA_TARGET_APEX_MAX_RATIO,
      rng,
    ),
    radius * 1.15,
    layout.height - radius * 2.5,
  );
  const riseDistance = Math.max(radius * 2.5, spawnY - desiredApexY);
  const vy = -Math.sqrt(2 * FRUIT_NINJA_TARGET_GRAVITY * riseDistance);

  return { vx, vy };
}

function createFruitTarget(layout, nextId, rng = Math.random, waveProfile = getFruitNinjaWaveProfile(1)) {
  const radius = layout.targetRadius * randomBetween(0.88, 1.18, rng);
  const spawnX = randomBetween(radius * 1.2, layout.width - radius * 1.2, rng);
  const spawnY = layout.height + radius * randomBetween(1.2, 1.9, rng);
  const launch = createTargetLaunch(
    layout,
    spawnX,
    spawnY,
    radius,
    {
      min: layout.width * 0.09,
      max: layout.width * 0.22,
    },
    {
      min: -30,
      max: 30,
    },
    rng,
  );
  const specialRoll = rng();
  const specialThreshold = 1 - waveProfile.specialChance;
  const specialPosition =
    specialRoll >= specialThreshold
      ? (specialRoll - specialThreshold) / Math.max(0.001, waveProfile.specialChance)
      : -1;
  const variant =
    specialPosition < 0
      ? "standard"
      : specialPosition < 0.4
        ? "golden"
        : specialPosition < 0.72
          ? "frost"
          : "shield";
  const palette =
    variant === "standard"
      ? randomChoice(FRUIT_COLORS, rng) ?? FRUIT_COLORS[0]
      : SPECIAL_FRUIT_STYLES[variant];
  return {
    id: createTargetId("fruit", nextId),
    kind: "fruit",
    variant,
    label: palette.name,
    x: spawnX,
    y: spawnY,
    vx: launch.vx * waveProfile.speedMultiplier,
    vy: launch.vy * waveProfile.speedMultiplier,
    radius,
    rotation: randomBetween(-0.4, 0.4, rng),
    spin: randomBetween(-2.8, 2.8, rng),
    fill: palette.fill,
    accent: palette.accent,
    scoreBonus: variant === "golden" ? FRUIT_NINJA_GOLDEN_BONUS : 0,
    effect: variant === "frost" ? "slow-time" : variant === "shield" ? "shield" : null,
    missed: false,
  };
}

function createBombTarget(layout, nextId, rng = Math.random, waveProfile = getFruitNinjaWaveProfile(1)) {
  const radius = layout.targetRadius * randomBetween(0.92, 1.08, rng);
  const spawnX = randomBetween(radius * 1.2, layout.width - radius * 1.2, rng);
  const spawnY = layout.height + radius * randomBetween(1.2, 2.0, rng);
  const launch = createTargetLaunch(
    layout,
    spawnX,
    spawnY,
    radius,
    {
      min: layout.width * 0.08,
      max: layout.width * 0.18,
    },
    {
      min: -40,
      max: 40,
    },
    rng,
  );
  return {
    id: createTargetId("bomb", nextId),
    kind: "bomb",
    label: "Bomb",
    x: spawnX,
    y: spawnY,
    vx: launch.vx * waveProfile.speedMultiplier,
    vy: launch.vy * waveProfile.speedMultiplier,
    radius,
    rotation: randomBetween(-0.2, 0.2, rng),
    spin: randomBetween(-2.2, 2.2, rng),
    fill: "#111827",
    accent: "#ff7b6b",
    telegraphMs: FRUIT_NINJA_BOMB_TELEGRAPH_MS,
    fuseMs: FRUIT_NINJA_BOMB_TELEGRAPH_MS,
    armed: false,
    missed: false,
  };
}

export function createFruitNinjaTarget(
  layout,
  nextId,
  { kind = "fruit", wave = 1 } = {},
  rng = Math.random,
) {
  const profile = getFruitNinjaWaveProfile(wave);
  return kind === "bomb"
    ? createBombTarget(layout, nextId, rng, profile)
    : createFruitTarget(layout, nextId, rng, profile);
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

function distanceFromSegmentToPoint(start, end, point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lineLengthSquared = dx * dx + dy * dy;
  if (lineLengthSquared <= 1e-9) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lineLengthSquared;
  const t = clamp(projection, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function gradeFruitNinjaSlice(segment, target) {
  if (
    !segment?.start ||
    !segment?.end ||
    !Number.isFinite(segment.speed) ||
    !Number.isFinite(target?.radius) ||
    target.radius <= 0
  ) {
    return null;
  }

  const centerDistance = distanceFromSegmentToPoint(segment.start, segment.end, target);
  const centerRatio = centerDistance / target.radius;
  const id =
    centerRatio <= 0.22 && segment.speed >= 1_100
      ? "perfect"
      : centerRatio <= 0.58
        ? "great"
        : "good";
  const grade = FRUIT_NINJA_PRECISION_GRADES[id];
  return {
    id,
    label: grade.label,
    bonus: grade.bonus,
    centerRatio: Number(centerRatio.toFixed(3)),
    speed: Math.round(segment.speed),
  };
}

export function scoreSliceBatch(sliceKinds, comboCount = 0) {
  const safeKinds = Array.isArray(sliceKinds) ? sliceKinds : [];
  const fruitCount = safeKinds.filter((kind) => kind === "fruit").length;
  const bombCount = safeKinds.filter((kind) => kind === "bomb").length;
  let points = 0;

  for (let index = 0; index < fruitCount; index += 1) {
    const comboValue = comboCount + index + 1;
    points += FRUIT_NINJA_BASE_SCORE + Math.max(0, comboValue - 1) * FRUIT_NINJA_COMBO_BONUS;
  }

  return {
    points: points - bombCount * FRUIT_NINJA_BOMB_PENALTY,
    bombHit: bombCount > 0,
    nextComboCount: bombCount > 0 ? 0 : comboCount + fruitCount,
  };
}

function defaultSpawnCooldownMs(rng = Math.random, waveProfile = getFruitNinjaWaveProfile(1)) {
  return randomBetween(
    waveProfile.spawnCooldownMinMs,
    waveProfile.spawnCooldownMaxMs,
    rng,
  );
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

function createFruitNinjaStats() {
  return {
    fruitSliced: 0,
    bombsHit: 0,
    bombsShielded: 0,
    misses: 0,
    bestCombo: 0,
    perfectSlices: 0,
    greatSlices: 0,
    goodSlices: 0,
    goldenFruit: 0,
    frostFruit: 0,
    shieldFruit: 0,
    feverActivations: 0,
    wavesReached: 1,
  };
}

function normalizeCreateOptions(options) {
  if (options instanceof Date) {
    return { dailyDate: options };
  }
  if (Number.isFinite(options) || typeof options === "string") {
    return { seed: options };
  }
  return options && typeof options === "object" ? options : {};
}

function createEmptyState(layout, options = {}) {
  const challenge = options.challenge ?? null;
  const roundDurationMs = Math.max(
    1_000,
    Number.isFinite(options.roundDurationMs)
      ? options.roundDurationMs
      : challenge?.roundDurationMs ?? FRUIT_NINJA_ROUND_DURATION_MS,
  );
  const seed =
    options.seed === undefined && !challenge
      ? null
      : normalizeFruitNinjaSeed(options.seed ?? challenge?.seed);
  return {
    layout,
    elapsedMs: 0,
    roundDurationMs,
    roundRemainingMs: roundDurationMs,
    status: "running",
    endReason: null,
    score: 0,
    personalBest: nonNegativeInteger(options.personalBest),
    lives: FRUIT_NINJA_GAME_OVER_LIVES,
    comboCount: 0,
    comboExpiresAt: 0,
    bestCombo: 0,
    wave: 1,
    totalWaves: FRUIT_NINJA_TOTAL_WAVES,
    waveAnnouncementMs: FRUIT_NINJA_WAVE_BANNER_MS,
    feverMeter: 0,
    feverMs: 0,
    slowTimeMs: 0,
    shields: 0,
    lastSlice: null,
    challenge,
    randomSeed: seed,
    randomState: seed,
    stats: createFruitNinjaStats(),
    result: null,
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

export function createFruitNinjaGame(width, height, options = {}) {
  const safeOptions = normalizeCreateOptions(options);
  const challenge = safeOptions.dailyDate
    ? getFruitNinjaDailyChallenge(safeOptions.dailyDate)
    : safeOptions.challenge ?? null;
  const layout = createFruitNinjaLayout(width, height);
  const state = createEmptyState(layout, {
    ...safeOptions,
    challenge,
  });
  fruitNinjaLog.info("Created fruit ninja game state", layout);
  return state;
}

export function createFruitNinjaDailyGame(width, height, date = new Date()) {
  const challenge = getFruitNinjaDailyChallenge(date);
  return createFruitNinjaGame(width, height, {
    challenge,
    seed: challenge.seed,
  });
}

export function getFruitNinjaMedals(stateOrStats) {
  const stats = stateOrStats?.stats ?? stateOrStats ?? {};
  const score = nonNegativeInteger(stateOrStats?.score);
  const fruitSliced = nonNegativeInteger(stats.fruitSliced);
  const bestCombo = nonNegativeInteger(stats.bestCombo, stateOrStats?.bestCombo);
  const precisionSlices =
    nonNegativeInteger(stats.perfectSlices) + nonNegativeInteger(stats.greatSlices);
  const bombsHit = nonNegativeInteger(stats.bombsHit);

  return [
    {
      id: "fruit-storm",
      label: "Fruit Storm",
      description: "Slice 30 fruit in one round.",
      earned: fruitSliced >= 30,
    },
    {
      id: "clean-blade",
      label: "Clean Blade",
      description: "Finish with no bomb hits.",
      earned: fruitSliced > 0 && bombsHit === 0,
    },
    {
      id: "combo-master",
      label: "Combo Master",
      description: "Reach a 12-fruit combo.",
      earned: bestCombo >= 12,
    },
    {
      id: "precision-artist",
      label: "Precision Artist",
      description: "Land 10 Great or Perfect slices.",
      earned: precisionSlices >= 10,
    },
    {
      id: "high-score",
      label: "Five-Star Flight",
      description: "Score 5,000 points.",
      earned: score >= 5_000,
    },
  ];
}

export function createFruitNinjaResult(state, endReason = state?.endReason ?? "round-complete") {
  const stats = {
    ...createFruitNinjaStats(),
    ...(state?.stats ?? {}),
    bestCombo: Math.max(
      nonNegativeInteger(state?.stats?.bestCombo),
      nonNegativeInteger(state?.bestCombo),
    ),
    wavesReached: Math.max(
      1,
      nonNegativeInteger(state?.stats?.wavesReached, state?.wave),
    ),
  };
  const gradedSlices =
    stats.perfectSlices + stats.greatSlices + stats.goodSlices;
  const precisionRate = gradedSlices > 0
    ? (stats.perfectSlices + stats.greatSlices) / gradedSlices
    : 0;
  const score = nonNegativeInteger(state?.score);
  const grade =
    score >= 6_000 && precisionRate >= 0.7
      ? "S"
      : score >= 4_000
        ? "A"
        : score >= 2_000
          ? "B"
          : score >= 800
            ? "C"
            : "D";

  return {
    version: 1,
    modeId: "slice-air",
    outcome: endReason === "out-of-lives" ? "missed-out" : "completed",
    endReason,
    score,
    grade,
    elapsedMs: nonNegativeInteger(state?.elapsedMs),
    roundDurationMs: nonNegativeInteger(state?.roundDurationMs),
    wave: Math.max(1, nonNegativeInteger(state?.wave, 1)),
    livesRemaining: nonNegativeInteger(state?.lives),
    bestCombo: stats.bestCombo,
    precisionRate: Number(precisionRate.toFixed(3)),
    stats,
    medals: getFruitNinjaMedals({ ...state, score, stats }),
    challenge: state?.challenge
      ? {
          id: state.challenge.id,
          dayKey: state.challenge.dayKey,
          seed: state.challenge.seed,
        }
      : null,
  };
}

export function restartFruitNinjaGame(state, options = {}) {
  if (!state?.layout) {
    return state;
  }
  const preserveChallenge = options.preserveChallenge !== false;
  const challenge = preserveChallenge ? state.challenge ?? null : null;
  return createFruitNinjaGame(state.layout.width, state.layout.height, {
    challenge,
    seed: challenge?.seed ?? options.seed,
    roundDurationMs: options.roundDurationMs ?? state.roundDurationMs,
    personalBest: Math.max(
      nonNegativeInteger(state.personalBest),
      nonNegativeInteger(state.score),
    ),
  });
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

  const waveProfile = getFruitNinjaWaveProfile(state.wave);
  const spawnRoll = rng();
  const spawnCount =
    waveProfile.tripleSpawnChance > 0 && spawnRoll > 1 - waveProfile.tripleSpawnChance
      ? 3
      : spawnRoll > 1 - waveProfile.doubleSpawnChance
        ? 2
        : 1;
  const nextTargets = [...state.targets];
  let nextTargetId = state.nextTargetId;
  for (let index = 0; index < spawnCount; index += 1) {
    const spawnBomb =
      rng() > 1 - waveProfile.bombChance &&
      nextTargets.every((target) => target.kind !== "bomb");
    nextTargets.push(
      spawnBomb
        ? createBombTarget(state.layout, nextTargetId, rng, waveProfile)
        : createFruitTarget(state.layout, nextTargetId, rng, waveProfile),
    );
    nextTargetId += 1;
  }

  nextState = {
    ...state,
    targets: nextTargets,
    nextTargetId,
    spawnCooldownMs:
      defaultSpawnCooldownMs(rng, waveProfile) *
      (state.feverMs > 0 ? 0.58 : 1),
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

function getWaveForElapsed(elapsedMs, roundDurationMs) {
  const waveDurationMs = roundDurationMs / FRUIT_NINJA_TOTAL_WAVES;
  return clamp(
    Math.floor(Math.max(0, elapsedMs) / Math.max(1, waveDurationMs)) + 1,
    1,
    FRUIT_NINJA_TOTAL_WAVES,
  );
}

function getBestSliceGrade(segments, target) {
  const grades = segments
    .filter((segment) => segmentIntersectsCircle(segment.start, segment.end, target, 8))
    .map((segment) => gradeFruitNinjaSlice(segment, target))
    .filter(Boolean);
  return grades.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }
    if (candidate.centerRatio !== best.centerRatio) {
      return candidate.centerRatio < best.centerRatio ? candidate : best;
    }
    return candidate.speed > best.speed ? candidate : best;
  }, null);
}

function finalizeFruitNinjaState(state, endReason) {
  const score = Math.max(0, Math.round(state.score));
  const personalBest = Math.max(nonNegativeInteger(state.personalBest), score);
  const terminal = {
    ...state,
    score,
    personalBest,
    status: "gameover",
    endReason,
    message:
      endReason === "round-complete"
        ? "Time! Round complete. Review your flight recap."
        : "Round over. Restart to launch another wave.",
    swipeSegments: [],
  };
  return {
    ...terminal,
    result: createFruitNinjaResult(terminal, endReason),
  };
}

export function stepFruitNinjaGame(state, dtSeconds, pointer, now = performance.now(), rng = null) {
  if (!state?.layout) {
    return state;
  }

  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, FRUIT_NINJA_MAX_STEP_SECONDS);
  const dtMs = safeDt * 1000;
  const safeNow = Number.isFinite(now) ? now : 0;
  const previousElapsedMs = Number.isFinite(state.elapsedMs) ? state.elapsedMs : 0;
  const nextElapsedMs = previousElapsedMs + dtMs;
  const roundDurationMs = Number.isFinite(state.roundDurationMs)
    ? state.roundDurationMs
    : FRUIT_NINJA_ROUND_DURATION_MS;
  const previousRemainingMs = Number.isFinite(state.roundRemainingMs)
    ? state.roundRemainingMs
    : Math.max(0, roundDurationMs - previousElapsedMs);
  const roundRemainingMs = Math.max(0, previousRemainingMs - dtMs);
  const previousWave = clamp(nonNegativeInteger(state.wave, 1), 1, FRUIT_NINJA_TOTAL_WAVES);
  const wave = getWaveForElapsed(nextElapsedMs, roundDurationMs);
  const waveChanged = wave > previousWave;
  const targetTimeScale = state.slowTimeMs > 0 ? 0.55 : 1;
  const targetDt = safeDt * targetTimeScale;
  const resolvedRng = resolveStepRng(state, rng);
  const stepRng = resolvedRng.rng;
  const stats = {
    ...createFruitNinjaStats(),
    ...(state.stats ?? {}),
    wavesReached: Math.max(
      nonNegativeInteger(state.stats?.wavesReached, 1),
      wave,
    ),
  };

  let nextState = {
    ...state,
    elapsedMs: nextElapsedMs,
    roundDurationMs,
    roundRemainingMs,
    wave,
    totalWaves: FRUIT_NINJA_TOTAL_WAVES,
    waveAnnouncementMs: waveChanged
      ? FRUIT_NINJA_WAVE_BANNER_MS
      : Math.max(0, (state.waveAnnouncementMs ?? 0) - dtMs),
    spawnCooldownMs: (state.spawnCooldownMs ?? 0) - dtMs,
    feverMs: Math.max(0, (state.feverMs ?? 0) - dtMs),
    slowTimeMs: Math.max(0, (state.slowTimeMs ?? 0) - dtMs),
    bladeTrail: appendBladePoint(state.bladeTrail ?? [], pointer, safeNow),
    particles: advanceFx(state.particles ?? [], dtMs),
    splitPieces: advanceFx(state.splitPieces ?? [], dtMs, FRUIT_NINJA_GRAVITY * 0.5),
    popups: advancePopups(state.popups ?? [], dtMs),
    stats,
  };

  if (nextState.comboExpiresAt > 0 && safeNow > nextState.comboExpiresAt) {
    nextState.comboCount = 0;
    nextState.comboExpiresAt = 0;
  }

  if (nextState.status !== "running") {
    const terminalReason = state.endReason ?? "out-of-lives";
    return {
      ...nextState,
      message: "Round over. Restart to launch another wave.",
      swipeSegments: [],
      result: state.result ?? createFruitNinjaResult(nextState, terminalReason),
    };
  }

  if (waveChanged) {
    nextState.message = `Wave ${wave}: ${getFruitNinjaWaveProfile(wave).label}.`;
  }

  nextState = spawnTargets(nextState, stepRng);

  const nextTargets = [];
  let score = nextState.score;
  let lives = nextState.lives;
  let comboCount = nextState.comboCount;
  let comboExpiresAt = nextState.comboExpiresAt;
  let bestCombo = Math.max(
    nonNegativeInteger(nextState.bestCombo),
    nonNegativeInteger(stats.bestCombo),
  );
  let feverMeter = clamp(Number(nextState.feverMeter) || 0, 0, FRUIT_NINJA_FEVER_MAX);
  let feverMs = nextState.feverMs;
  let slowTimeMs = nextState.slowTimeMs;
  let shields = clamp(
    nonNegativeInteger(nextState.shields),
    0,
    FRUIT_NINJA_MAX_SHIELDS,
  );
  let lastSlice = nextState.lastSlice ?? null;
  let nextFxId = nextState.nextFxId;
  let message = nextState.message;
  const nextParticles = [...nextState.particles];
  const nextSplitPieces = [...nextState.splitPieces];
  const nextPopups = [...nextState.popups];
  const swipeSegments = computeSwipeSegments(nextState.bladeTrail);
  const slicedTargets = [];

  for (const target of nextState.targets) {
    const telegraphMs =
      target.kind === "bomb"
        ? Math.max(
            0,
            (Number.isFinite(target.telegraphMs) ? target.telegraphMs : 0) - dtMs,
          )
        : undefined;
    const advancedTarget = {
      ...target,
      x: target.x + target.vx * targetDt,
      y: target.y + target.vy * targetDt,
      vy: target.vy + FRUIT_NINJA_TARGET_GRAVITY * targetDt,
      rotation: target.rotation + target.spin * targetDt,
      ...(target.kind === "bomb"
        ? {
            telegraphMs,
            armed: telegraphMs <= 0,
          }
        : {}),
    };

    const sliceGrade = getBestSliceGrade(swipeSegments, advancedTarget);
    const isSliced = Boolean(sliceGrade);

    if (isSliced) {
      nextParticles.push(...createSliceParticles(advancedTarget, `fx-${nextFxId}`, stepRng));
      nextFxId += 1;
      nextSplitPieces.push(...createFruitSplitPieces(advancedTarget, `split-${nextFxId}`));
      nextFxId += 1;
      nextPopups.push(
        createPopup(
          advancedTarget.kind === "bomb" ? "BOMB" : advancedTarget.label,
          advancedTarget.x,
          advancedTarget.y,
          advancedTarget.kind,
          nextFxId,
        ),
      );
      nextFxId += 1;
      slicedTargets.push({
        ...advancedTarget,
        sliceGrade: advancedTarget.kind === "fruit" ? sliceGrade : null,
      });
      continue;
    }

    const fellPastFloor = advancedTarget.y - advancedTarget.radius > nextState.layout.height + 60;
    if (fellPastFloor) {
      if (advancedTarget.kind === "fruit") {
        lives -= 1;
        comboCount = 0;
        comboExpiresAt = 0;
        stats.misses += 1;
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

  if (slicedTargets.length > 0) {
    const slicedKinds = slicedTargets.map((target) => target.kind);
    const scoreResult = scoreSliceBatch(slicedKinds, comboCount);
    const fruitSlices = slicedTargets.filter((target) => target.kind === "fruit");
    const bombHits = slicedTargets.filter((target) => target.kind === "bomb").length;
    const shieldedBombs = Math.min(shields, bombHits);
    const unshieldedBombs = bombHits - shieldedBombs;
    const precisionBonus = fruitSlices.reduce(
      (total, target) => total + (target.sliceGrade?.bonus ?? 0),
      0,
    );
    const specialBonus = fruitSlices.reduce(
      (total, target) => total + nonNegativeInteger(target.scoreBonus),
      0,
    );
    const fruitScoreResult = scoreSliceBatch(
      fruitSlices.map(() => "fruit"),
      comboCount,
    );
    const positivePoints = fruitScoreResult.points + precisionBonus + specialBonus;
    const feverMultiplier = feverMs > 0 ? 2 : 1;
    const batchPoints =
      positivePoints * feverMultiplier -
      unshieldedBombs * FRUIT_NINJA_BOMB_PENALTY;
    score += batchPoints;
    comboCount = scoreResult.nextComboCount;
    comboExpiresAt =
      fruitSlices.length > 0 && !scoreResult.bombHit ? safeNow + FRUIT_NINJA_COMBO_WINDOW_MS : 0;
    bestCombo = Math.max(bestCombo, comboCount);

    stats.fruitSliced += fruitSlices.length;
    stats.bombsHit += bombHits;
    stats.bombsShielded += shieldedBombs;
    stats.bestCombo = Math.max(stats.bestCombo, bestCombo);
    for (const target of fruitSlices) {
      const gradeId = target.sliceGrade?.id ?? "good";
      if (gradeId === "perfect") {
        stats.perfectSlices += 1;
      } else if (gradeId === "great") {
        stats.greatSlices += 1;
      } else {
        stats.goodSlices += 1;
      }
      if (target.variant === "golden") {
        stats.goldenFruit += 1;
      } else if (target.variant === "frost") {
        stats.frostFruit += 1;
        slowTimeMs = Math.max(slowTimeMs, FRUIT_NINJA_SLOW_TIME_DURATION_MS);
      } else if (target.variant === "shield") {
        stats.shieldFruit += 1;
        shields = Math.min(FRUIT_NINJA_MAX_SHIELDS, shields + 1);
      }
    }
    shields = Math.max(0, shields - shieldedBombs);

    if (fruitSlices.length > 0 && feverMs <= 0) {
      feverMeter += fruitSlices.length * FRUIT_NINJA_FEVER_PER_FRUIT;
      if (feverMeter >= FRUIT_NINJA_FEVER_MAX) {
        feverMeter = 0;
        feverMs = FRUIT_NINJA_FEVER_DURATION_MS;
        stats.feverActivations += 1;
      }
    }

    const latestFruit = fruitSlices[fruitSlices.length - 1];
    if (latestFruit) {
      lastSlice = {
        targetId: latestFruit.id,
        variant: latestFruit.variant ?? "standard",
        grade: latestFruit.sliceGrade,
        points: batchPoints,
        atMs: safeNow,
      };
    }

    if (scoreResult.bombHit) {
      lives -= unshieldedBombs;
      message =
        unshieldedBombs > 0
          ? "Bomb clipped. Keep the blade away from dark cores."
          : "Shield save! The bomb blast was absorbed.";
    } else if (feverMs === FRUIT_NINJA_FEVER_DURATION_MS) {
      message = "Fever flight! Double score and faster fruit.";
    } else if (latestFruit?.variant === "frost") {
      message = "Frost Berry sliced. Targets slowed.";
    } else if (latestFruit?.variant === "shield") {
      message = "Guard Grape sliced. Shield charged.";
    } else {
      message =
        comboCount > 1
          ? `Combo x${comboCount} sliced.`
          : `${fruitSlices[0]?.label ?? "Fruit"} sliced.`;
    }

    const focalTarget = slicedTargets[slicedTargets.length - 1];
    nextPopups.push(
      createPopup(
        batchPoints >= 0 ? `+${batchPoints}` : `${batchPoints}`,
        focalTarget?.x ?? nextState.layout.width * 0.5,
        focalTarget?.y ?? nextState.layout.height * 0.24,
        scoreResult.bombHit ? "bomb" : "combo",
        nextFxId,
      ),
    );
    nextFxId += 1;

    if (latestFruit?.sliceGrade) {
      nextPopups.push(
        createPopup(
          latestFruit.sliceGrade.label.toUpperCase(),
          latestFruit.x,
          latestFruit.y - latestFruit.radius,
          `precision-${latestFruit.sliceGrade.id}`,
          nextFxId,
        ),
      );
      nextFxId += 1;
    }
  }

  if (slicedTargets.length > 1) {
    const fruitHitCount = slicedTargets.filter((target) => target.kind === "fruit").length;
    nextPopups.push(
      createPopup(
        `${fruitHitCount} HIT`,
        nextState.layout.width * 0.5,
        nextState.layout.height * 0.22,
        "combo",
        nextFxId,
      ),
    );
    nextFxId += 1;
  }

  const runningState = {
    ...nextState,
    score: Math.max(0, Math.round(score)),
    lives: Math.max(0, lives),
    comboCount,
    comboExpiresAt,
    bestCombo,
    feverMeter: clamp(feverMeter, 0, FRUIT_NINJA_FEVER_MAX),
    feverMs,
    slowTimeMs,
    shields,
    lastSlice,
    message,
    targets: nextTargets,
    particles: nextParticles,
    splitPieces: nextSplitPieces,
    popups: nextPopups,
    swipeSegments,
    nextFxId,
    stats,
    randomState: resolvedRng.getRandomState(),
  };

  if (lives <= 0) {
    return finalizeFruitNinjaState(runningState, "out-of-lives");
  }
  if (roundRemainingMs <= 0) {
    return finalizeFruitNinjaState(runningState, "round-complete");
  }
  return runningState;
}
