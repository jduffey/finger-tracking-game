import { createScopedLogger } from "./logger.js";
import { createFruitNinjaLayout } from "./fruitNinjaGame.js";

const handBounceLog = createScopedLogger("fullscreenHandBounceGame");

export const FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES = 3;
export const FULLSCREEN_HAND_BOUNCE_CHECKPOINT_MS = 1_800;
export const FULLSCREEN_HAND_BOUNCE_POWER_DURATION_MS = 6_000;
export const FULLSCREEN_HAND_BOUNCE_MAX_FOCUS = 100;
export const FULLSCREEN_HAND_BOUNCE_TARGET_SCORE = 3;
export const FULLSCREEN_HAND_BOUNCE_TRICK_SCORE = 2;
export const FULLSCREEN_HAND_BOUNCE_STARTING_LIVES = 2;

const FULLSCREEN_HAND_BOUNCE_MAX_FRAME_SECONDS = 0.05;
const FULLSCREEN_HAND_BOUNCE_MAX_STEP_SECONDS = 1 / 120;
const FULLSCREEN_HAND_BOUNCE_WALL_RESTITUTION = 0.94;
const FULLSCREEN_HAND_BOUNCE_CEILING_RESTITUTION = 0.88;
const FULLSCREEN_HAND_BOUNCE_HORIZONTAL_PADDLE_INFLUENCE = 0.2;
const FULLSCREEN_HAND_BOUNCE_UPWARD_PADDLE_INFLUENCE = 0.24;
const FULLSCREEN_HAND_BOUNCE_DOWNWARD_PADDLE_PENALTY = 0.12;
const FULLSCREEN_HAND_BOUNCE_CONTACT_COOLDOWN_MS = 90;
const FULLSCREEN_HAND_BOUNCE_BALL_DRAG_PER_SECOND = 0.04;
const FULLSCREEN_HAND_BOUNCE_DEFAULT_SEED = 0x6d2b79f5;
const FULLSCREEN_HAND_BOUNCE_TARGET_SIZE_RATIO = 0.17;
const FULLSCREEN_HAND_BOUNCE_EDGE_TRICK_THRESHOLD = 0.7;
const FULLSCREEN_HAND_BOUNCE_LIFT_TRICK_SPEED_RATIO = 0.2;

const STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: "Palm School",
    shortName: "Warm-up",
    goalText: "Keep four volleys alive",
    durationMs: 32_000,
    requiredSaves: 4,
    requiredTargetHits: 0,
    requiredTrickShots: 0,
    gravityMultiplier: 0.9,
    speedMultiplier: 0.9,
  }),
  Object.freeze({
    name: "Corner Rally",
    shortName: "Aim",
    goalText: "Volley six times, tag two corner targets, and land a trick",
    durationMs: 44_000,
    requiredSaves: 6,
    requiredTargetHits: 2,
    requiredTrickShots: 1,
    gravityMultiplier: 1,
    speedMultiplier: 1,
  }),
  Object.freeze({
    name: "Sky Circuit",
    shortName: "Finale",
    goalText: "Complete the full volley circuit",
    durationMs: 58_000,
    requiredSaves: 9,
    requiredTargetHits: 3,
    requiredTrickShots: 2,
    gravityMultiplier: 1.08,
    speedMultiplier: 1.08,
  }),
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(finite(value, fallback)));
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || FULLSCREEN_HAND_BOUNCE_DEFAULT_SEED;
}

function normalizeSeed(seed) {
  if (Number.isFinite(seed)) {
    return Number(seed) >>> 0 || FULLSCREEN_HAND_BOUNCE_DEFAULT_SEED;
  }
  return hashSeed(seed);
}

export function nextFullscreenHandBounceRandom(seedState) {
  const state =
    (normalizeSeed(seedState) + FULLSCREEN_HAND_BOUNCE_DEFAULT_SEED) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    state,
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
  };
}

export function createFullscreenHandBounceSeededRng(seed) {
  let randomState = normalizeSeed(seed);
  return () => {
    const next = nextFullscreenHandBounceRandom(randomState);
    randomState = next.state;
    return next.value;
  };
}

function normalizeDailyDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

export function getFullscreenHandBounceDailyChallenge(date = new Date()) {
  const dayKey = normalizeDailyDate(date).toISOString().slice(0, 10);
  const seed = hashSeed(`hand-bounce-daily:${dayKey}`);
  const routeNames = ["Sunrise Circuit", "Neon Corners", "Cloud Nine"];
  return {
    id: `hand-bounce-daily-${dayKey}`,
    mode: "daily",
    dayKey,
    seed,
    routeId: seed % routeNames.length,
    routeName: routeNames[seed % routeNames.length],
    totalStages: FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
  };
}

export function getFullscreenHandBounceStageConfig(
  stage = 1,
  challenge = null,
) {
  const normalizedStage = clamp(
    Math.floor(finite(stage, 1)),
    1,
    FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
  );
  const base = STAGE_DEFINITIONS[normalizedStage - 1];
  const dailyRouteId =
    challenge?.mode === "daily"
      ? nonNegativeInteger(
          challenge.routeId,
          normalizeSeed(challenge.seed) % 3,
        ) % 3
      : null;

  return {
    ...base,
    stage: normalizedStage,
    totalStages: FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
    routeId: dailyRouteId,
    routeName: challenge?.routeName ?? null,
    targetPatternOffset: dailyRouteId ?? 0,
  };
}

function randomBetween(min, max, rng = Math.random) {
  return min + rng() * Math.max(0, max - min);
}

function intersectsCircleRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function getPaddleRect(paddle) {
  return {
    x: paddle.x - paddle.width / 2,
    y: paddle.y - paddle.height / 2,
    width: paddle.width,
    height: paddle.height,
  };
}

function getSaveMessage(saveCount, comboCount = saveCount) {
  if (comboCount >= 18) {
    return "Unstoppable volley";
  }
  if (comboCount >= 12) {
    return "Locked in";
  }
  if (comboCount >= 7) {
    return "Great save";
  }
  if (comboCount >= 3) {
    return "Nice bounce";
  }
  return "Keep it alive";
}

function createBall(layout, rng = Math.random, stageConfig = null) {
  const direction = rng() < 0.5 ? -1 : 1;
  const speedMultiplier = stageConfig?.speedMultiplier ?? 1;
  return {
    x: layout.width / 2,
    y: layout.spawnY,
    vx:
      direction *
      randomBetween(layout.width * 0.08, layout.width * 0.13, rng) *
      speedMultiplier,
    vy:
      randomBetween(layout.height * 0.08, layout.height * 0.12, rng) *
      speedMultiplier,
    radius: layout.ballRadius,
  };
}

function createBallFromRandomState(layout, randomState, stageConfig) {
  let nextState = normalizeSeed(randomState);
  const rng = () => {
    const next = nextFullscreenHandBounceRandom(nextState);
    nextState = next.state;
    return next.value;
  };
  return {
    ball: createBall(layout, rng, stageConfig),
    randomState: nextState,
  };
}

function normalizePaddleInput(layout, paddleInput) {
  if (
    !layout ||
    !Number.isFinite(paddleInput?.x) ||
    !Number.isFinite(paddleInput?.y) ||
    !Number.isFinite(paddleInput?.width) ||
    !Number.isFinite(paddleInput?.height)
  ) {
    return null;
  }

  const width = clamp(
    paddleInput.width,
    layout.ballRadius * 1.9,
    layout.width * 0.38,
  );
  const height = clamp(
    paddleInput.height,
    layout.ballRadius * 0.72,
    layout.ballRadius * 1.65,
  );

  return {
    x: clamp(paddleInput.x, width / 2, layout.width - width / 2),
    y: clamp(
      paddleInput.y,
      height / 2 + layout.ballRadius * 0.4,
      layout.height - height / 2 - layout.ballRadius * 0.3,
    ),
    width,
    height,
  };
}

function resolvePaddle(state, paddleInput, dtSeconds) {
  const normalized = normalizePaddleInput(state?.layout, paddleInput);
  if (!normalized) {
    return null;
  }

  const previous = state?.paddle;
  const safeDt = Math.max(1 / 240, Number.isFinite(dtSeconds) ? dtSeconds : 0);
  return {
    ...normalized,
    vx: previous ? (normalized.x - previous.x) / safeDt : 0,
    vy: previous ? (normalized.y - previous.y) / safeDt : 0,
  };
}

function resolvePaddleBounce(state, ball, paddle) {
  const hitOffset = clamp(
    (ball.x - paddle.x) / Math.max(1, paddle.width / 2),
    -1,
    1,
  );
  const incomingSpeed = Math.hypot(ball.vx, ball.vy);
  const targetSpeed = clamp(
    Math.max(
      state.layout.minBounceSpeed +
        state.saveCount * state.layout.saveRampSpeed,
      incomingSpeed * 0.96 + Math.max(0, ball.vy) * 0.08,
    ),
    state.layout.minBounceSpeed,
    state.layout.maxBallSpeed,
  );

  const nextVx = clamp(
    ball.vx * 0.64 +
      hitOffset * state.layout.maxHorizontalSpeed * 0.72 +
      paddle.vx * FULLSCREEN_HAND_BOUNCE_HORIZONTAL_PADDLE_INFLUENCE,
    -state.layout.maxHorizontalSpeed,
    state.layout.maxHorizontalSpeed,
  );

  const minVerticalSpeed = targetSpeed * 0.7;
  const lift =
    Math.max(0, -paddle.vy) * FULLSCREEN_HAND_BOUNCE_UPWARD_PADDLE_INFLUENCE -
    Math.max(0, paddle.vy) * FULLSCREEN_HAND_BOUNCE_DOWNWARD_PADDLE_PENALTY;
  const nextVyMagnitude = clamp(
    Math.sqrt(
      Math.max(
        minVerticalSpeed * minVerticalSpeed,
        targetSpeed * targetSpeed - nextVx * nextVx,
      ),
    ) + lift,
    minVerticalSpeed,
    state.layout.maxBallSpeed,
  );

  return {
    ...ball,
    x: clamp(ball.x, ball.radius, state.layout.width - ball.radius),
    y: paddle.y - paddle.height / 2 - ball.radius - 0.5,
    vx: nextVx,
    vy: -nextVyMagnitude,
  };
}

function createStats(overrides = {}) {
  return {
    stagesCleared: 0,
    targetHits: 0,
    trickShots: 0,
    edgeShots: 0,
    liftShots: 0,
    bankShots: 0,
    bestCombo: 0,
    drops: 0,
    powerUpsActivated: 0,
    focusEarned: 0,
    ...overrides,
  };
}

function normalizeStats(state) {
  return createStats(state?.stats);
}

function createStageProgress(overrides = {}) {
  return {
    saves: 0,
    targetHits: 0,
    trickShots: 0,
    ...overrides,
  };
}

function targetPatternForIndex(index, patternOffset = 0) {
  const patterns = [
    { normalizedX: 0.08, normalizedY: 0.14, anchor: "upper-left" },
    { normalizedX: 0.72, normalizedY: 0.2, anchor: "upper-right" },
    { normalizedX: 0.4, normalizedY: 0.08, anchor: "high-center" },
    { normalizedX: 0.16, normalizedY: 0.3, anchor: "left-bank" },
    { normalizedX: 0.66, normalizedY: 0.32, anchor: "right-bank" },
  ];
  return patterns[(index + patternOffset) % patterns.length];
}

function createTargetZone(stageConfig, targetIndex = 0) {
  if ((stageConfig?.requiredTargetHits ?? 0) <= 0) {
    return null;
  }
  const pattern = targetPatternForIndex(
    targetIndex,
    stageConfig.targetPatternOffset,
  );
  return {
    id: `stage-${stageConfig.stage}-target-${targetIndex + 1}`,
    index: targetIndex,
    ...pattern,
    widthRatio: FULLSCREEN_HAND_BOUNCE_TARGET_SIZE_RATIO,
    heightRatio: FULLSCREEN_HAND_BOUNCE_TARGET_SIZE_RATIO * 0.58,
    label: `Volley target ${targetIndex + 1}`,
  };
}

export function getFullscreenHandBounceTargetRect(state) {
  if (!state?.layout || !state.targetZone) {
    return null;
  }
  const width = clamp(
    state.layout.width * state.targetZone.widthRatio,
    state.layout.ballRadius * 2.1,
    state.layout.width * 0.24,
  );
  const height = clamp(
    state.layout.height * state.targetZone.heightRatio,
    state.layout.ballRadius * 1.45,
    state.layout.height * 0.16,
  );
  return {
    id: state.targetZone.id,
    label: state.targetZone.label,
    anchor: state.targetZone.anchor,
    x: clamp(
      state.layout.width * state.targetZone.normalizedX,
      state.layout.ballRadius,
      state.layout.width - width - state.layout.ballRadius,
    ),
    y: clamp(
      state.layout.height * state.targetZone.normalizedY,
      state.layout.ballRadius,
      state.layout.height * 0.48 - height,
    ),
    width,
    height,
  };
}

function getTrickTypes(state, ball, paddle) {
  const hitOffset = Math.abs(
    (ball.x - paddle.x) / Math.max(1, paddle.width / 2),
  );
  const trickTypes = [];
  if (hitOffset >= FULLSCREEN_HAND_BOUNCE_EDGE_TRICK_THRESHOLD) {
    trickTypes.push("edge");
  }
  if (
    paddle.vy <=
    -state.layout.height * FULLSCREEN_HAND_BOUNCE_LIFT_TRICK_SPEED_RATIO
  ) {
    trickTypes.push("lift");
  }
  return trickTypes;
}

function getComboSaveScore(comboCount, powerModeMs) {
  const comboBonus = Math.min(3, Math.floor(Math.max(0, comboCount - 1) / 3));
  const powerMultiplier = powerModeMs > 0 ? 2 : 1;
  return (1 + comboBonus) * powerMultiplier;
}

function addFocus(state, amount) {
  const stats = normalizeStats(state);
  const earned = Math.max(0, finite(amount));
  const nextFocus = (state.focus ?? 0) + earned;
  if (nextFocus < FULLSCREEN_HAND_BOUNCE_MAX_FOCUS) {
    return {
      ...state,
      focus: nextFocus,
      stats: {
        ...stats,
        focusEarned: stats.focusEarned + earned,
      },
    };
  }
  return {
    ...state,
    focus: nextFocus - FULLSCREEN_HAND_BOUNCE_MAX_FOCUS,
    powerModeMs: FULLSCREEN_HAND_BOUNCE_POWER_DURATION_MS,
    message: "Power volley! Saves score double.",
    stats: {
      ...stats,
      focusEarned: stats.focusEarned + earned,
      powerUpsActivated: stats.powerUpsActivated + 1,
    },
  };
}

function hasClearedStage(state) {
  const progress = createStageProgress(state.stageProgress);
  const config =
    state.stageConfig ??
    getFullscreenHandBounceStageConfig(state.stage, state.challenge);
  return (
    progress.saves >= config.requiredSaves &&
    progress.targetHits >= config.requiredTargetHits &&
    progress.trickShots >= config.requiredTrickShots
  );
}

function createStageRecap(state) {
  const progress = createStageProgress(state.stageProgress);
  return {
    stage: state.stage,
    name: state.stageConfig?.name ?? `Stage ${state.stage}`,
    saves: progress.saves,
    targetHits: progress.targetHits,
    trickShots: progress.trickShots,
    scoreEarned: Math.max(0, state.score - (state.stageStartScore ?? 0)),
    timeRemainingMs: Math.round(Math.max(0, state.stageTimeRemainingMs ?? 0)),
  };
}

export function getFullscreenHandBounceResultStats(state) {
  if (!state?.layout) {
    return null;
  }
  if (state.result) {
    return state.result;
  }
  const stats = normalizeStats(state);
  const score = nonNegativeInteger(state.score);
  const previousPersonalBest = nonNegativeInteger(state.personalBest);
  return {
    outcome:
      state.outcome ?? (state.status === "gameover" ? "defeat" : "in_progress"),
    score,
    personalBest: Math.max(previousPersonalBest, score),
    newPersonalBest: score > previousPersonalBest,
    saves: nonNegativeInteger(state.saveCount),
    targetHits: stats.targetHits,
    trickShots: stats.trickShots,
    bestCombo: Math.max(stats.bestCombo, nonNegativeInteger(state.comboCount)),
    stagesCleared: stats.stagesCleared,
    stageReached: clamp(
      nonNegativeInteger(state.stage, 1),
      1,
      FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
    ),
    totalStages: state.totalStages ?? FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
    livesRemaining: nonNegativeInteger(state.lives),
    drops: stats.drops,
    powerUpsActivated: stats.powerUpsActivated,
    elapsedMs: Math.round(Math.max(0, state.elapsedMs ?? 0)),
    challenge: state.challenge ?? null,
    lastStageRecap: state.lastStageRecap ?? null,
  };
}

function finishGame(state, outcome, message) {
  const terminalState = {
    ...state,
    status: "gameover",
    phase: "result",
    outcome,
    message,
    bestScore: Math.max(state.bestScore ?? 0, state.score ?? 0),
  };
  return {
    ...terminalState,
    result: getFullscreenHandBounceResultStats(terminalState),
  };
}

function completeStage(state) {
  const stats = normalizeStats(state);
  const lastStageRecap = createStageRecap(state);
  const completedState = {
    ...state,
    lastStageRecap,
    stats: {
      ...stats,
      stagesCleared: stats.stagesCleared + 1,
    },
  };

  if (
    state.stage >= (state.totalStages ?? FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES)
  ) {
    return finishGame(
      completedState,
      "victory",
      "Circuit cleared. Every volley counted.",
    );
  }

  return {
    ...completedState,
    phase: "checkpoint",
    checkpointMsRemaining: FULLSCREEN_HAND_BOUNCE_CHECKPOINT_MS,
    message: `${lastStageRecap.name} cleared`,
  };
}

function advanceStage(state) {
  const stage = clamp(
    nonNegativeInteger(state.stage, 1) + 1,
    1,
    state.totalStages ?? FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
  );
  const stageConfig = getFullscreenHandBounceStageConfig(
    stage,
    state.challenge,
  );
  const spawned = createBallFromRandomState(
    state.layout,
    state.randomState,
    stageConfig,
  );
  return {
    ...state,
    stage,
    stageConfig,
    stageProgress: createStageProgress(),
    stageStartScore: state.score,
    stageElapsedMs: 0,
    stageTimeRemainingMs: stageConfig.durationMs,
    targetZone: createTargetZone(stageConfig),
    targetIndex: 0,
    ball: spawned.ball,
    randomState: spawned.randomState,
    phase: "playing",
    checkpointMsRemaining: 0,
    comboCount: 0,
    wallBouncesSinceSave: 0,
    message: `${stageConfig.name}: ${stageConfig.goalText}`,
  };
}

function respawnAfterDrop(state, lives) {
  const spawned = createBallFromRandomState(
    state.layout,
    state.randomState,
    state.stageConfig,
  );
  return {
    ...state,
    ball: spawned.ball,
    randomState: spawned.randomState,
    lives,
    comboCount: 0,
    wallBouncesSinceSave: 0,
    lastCollisionAtMs: Number.NEGATIVE_INFINITY,
    message: `${lives} ${lives === 1 ? "life" : "lives"} left — reset and rally`,
  };
}

function stepFullscreenHandBounceSubstep(
  state,
  dtSeconds,
  paddle,
  nextElapsedMs,
) {
  const drag = Math.exp(
    -FULLSCREEN_HAND_BOUNCE_BALL_DRAG_PER_SECOND * dtSeconds,
  );
  const layout = state.layout;
  const stageConfig =
    state.stageConfig ??
    getFullscreenHandBounceStageConfig(state.stage, state.challenge);
  const powerModeMs = Math.max(0, (state.powerModeMs ?? 0) - dtSeconds * 1000);
  const gravityScale =
    stageConfig.gravityMultiplier * (powerModeMs > 0 ? 0.88 : 1);
  let ball = {
    ...state.ball,
    x: state.ball.x + state.ball.vx * dtSeconds,
    y: state.ball.y + state.ball.vy * dtSeconds,
    vx: state.ball.vx * drag,
    vy: state.ball.vy + layout.gravity * gravityScale * dtSeconds,
  };
  let wallBouncesSinceSave = state.wallBouncesSinceSave ?? 0;

  if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx) * FULLSCREEN_HAND_BOUNCE_WALL_RESTITUTION;
    wallBouncesSinceSave += 1;
  } else if (ball.x + ball.radius >= layout.width) {
    ball.x = layout.width - ball.radius;
    ball.vx = -Math.abs(ball.vx) * FULLSCREEN_HAND_BOUNCE_WALL_RESTITUTION;
    wallBouncesSinceSave += 1;
  }

  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy) * FULLSCREEN_HAND_BOUNCE_CEILING_RESTITUTION;
  }

  let nextState = {
    ...state,
    ball,
    paddle,
    elapsedMs: nextElapsedMs,
    stageElapsedMs: (state.stageElapsedMs ?? 0) + dtSeconds * 1000,
    stageTimeRemainingMs: Math.max(
      0,
      (state.stageTimeRemainingMs ?? stageConfig.durationMs) - dtSeconds * 1000,
    ),
    powerModeMs,
    wallBouncesSinceSave,
  };

  const targetRect = getFullscreenHandBounceTargetRect(nextState);
  if (targetRect && ball.vy < 0 && intersectsCircleRect(ball, targetRect)) {
    const stats = normalizeStats(nextState);
    const stageProgress = createStageProgress(nextState.stageProgress);
    const bankShot = wallBouncesSinceSave > 0;
    const targetIndex = (nextState.targetIndex ?? 0) + 1;
    const targetScore =
      FULLSCREEN_HAND_BOUNCE_TARGET_SCORE +
      (bankShot ? FULLSCREEN_HAND_BOUNCE_TRICK_SCORE : 0);
    nextState = {
      ...nextState,
      score: nextState.score + targetScore,
      bestScore: Math.max(nextState.bestScore, nextState.score + targetScore),
      targetIndex,
      targetZone: createTargetZone(stageConfig, targetIndex),
      stageProgress: {
        ...stageProgress,
        targetHits: stageProgress.targetHits + 1,
        trickShots: stageProgress.trickShots + (bankShot ? 1 : 0),
      },
      stats: {
        ...stats,
        targetHits: stats.targetHits + 1,
        trickShots: stats.trickShots + (bankShot ? 1 : 0),
        bankShots: stats.bankShots + (bankShot ? 1 : 0),
      },
      message: bankShot ? "Bank target! Trick bonus." : "Target tagged",
    };
    nextState = addFocus(nextState, bankShot ? 28 : 20);
  }

  ball = nextState.ball;
  if (
    paddle &&
    nextElapsedMs - nextState.lastCollisionAtMs >=
      FULLSCREEN_HAND_BOUNCE_CONTACT_COOLDOWN_MS &&
    ball.vy > paddle.vy - 18 &&
    ball.y < paddle.y + paddle.height * 0.55 &&
    intersectsCircleRect(ball, getPaddleRect(paddle))
  ) {
    const trickTypes = getTrickTypes(nextState, ball, paddle);
    const saveCount = nextState.saveCount + 1;
    const comboCount = (nextState.comboCount ?? 0) + 1;
    const saveScore = getComboSaveScore(comboCount, powerModeMs);
    const trickScore = trickTypes.length * FULLSCREEN_HAND_BOUNCE_TRICK_SCORE;
    const stats = normalizeStats(nextState);
    const stageProgress = createStageProgress(nextState.stageProgress);
    const score = nextState.score + saveScore + trickScore;
    nextState = {
      ...nextState,
      ball: resolvePaddleBounce({ ...nextState, saveCount }, ball, paddle),
      score,
      saveCount,
      comboCount,
      bestScore: Math.max(nextState.bestScore, score),
      message:
        trickTypes.length > 0
          ? `${trickTypes.map((type) => (type === "edge" ? "Edge" : "Lift")).join(" + ")} trick`
          : getSaveMessage(saveCount, comboCount),
      lastCollisionAtMs: nextElapsedMs,
      wallBouncesSinceSave: 0,
      stageProgress: {
        ...stageProgress,
        saves: stageProgress.saves + 1,
        trickShots: stageProgress.trickShots + trickTypes.length,
      },
      stats: {
        ...stats,
        trickShots: stats.trickShots + trickTypes.length,
        edgeShots: stats.edgeShots + (trickTypes.includes("edge") ? 1 : 0),
        liftShots: stats.liftShots + (trickTypes.includes("lift") ? 1 : 0),
        bestCombo: Math.max(stats.bestCombo, comboCount),
      },
    };
    nextState = addFocus(nextState, 12 + trickTypes.length * 10);
  }

  if (hasClearedStage(nextState)) {
    return completeStage(nextState);
  }

  if (nextState.stageTimeRemainingMs <= 0) {
    return finishGame(
      nextState,
      "defeat",
      `${stageConfig.name} timed out. Try the route again.`,
    );
  }

  if (nextState.ball.y - nextState.ball.radius > layout.height) {
    const stats = normalizeStats(nextState);
    const lives = Math.max(0, (nextState.lives ?? 1) - 1);
    const droppedState = {
      ...nextState,
      lives,
      comboCount: 0,
      stats: {
        ...stats,
        drops: stats.drops + 1,
      },
    };
    if (lives <= 0) {
      return finishGame(
        droppedState,
        "defeat",
        "Final ball dropped. Rally over.",
      );
    }
    return respawnAfterDrop(droppedState, lives);
  }

  return nextState;
}

export function createFullscreenHandBounceLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(480, Number.isFinite(height) ? height : 480);
  const fruitLayout = createFruitNinjaLayout(safeWidth, safeHeight);
  const ballRadius = fruitLayout.targetRadius;

  return {
    width: safeWidth,
    height: safeHeight,
    ballRadius,
    spawnY: ballRadius * 1.08,
    gravity: clamp(safeHeight * 2.7, 1_200, 2_240),
    minBounceSpeed: clamp(safeHeight * 0.95, 380, 860),
    maxBallSpeed: clamp(safeHeight * 2.05, 820, 1_780),
    maxHorizontalSpeed: clamp(safeWidth * 0.64, 320, 900),
    saveRampSpeed: clamp(safeHeight * 0.018, 10, 22),
  };
}

function normalizeCreationOptions(rngOrOptions) {
  if (typeof rngOrOptions === "function") {
    return {
      rng: rngOrOptions,
    };
  }
  if (rngOrOptions && typeof rngOrOptions === "object") {
    return rngOrOptions;
  }
  return {};
}

function createGameState(width, height, options = {}) {
  const layout = createFullscreenHandBounceLayout(width, height);
  const challenge = options.challenge ?? null;
  const stage = 1;
  const stageConfig = getFullscreenHandBounceStageConfig(stage, challenge);
  const fallbackRng =
    typeof options.rng === "function" ? options.rng : Math.random;
  const seed = normalizeSeed(
    options.seed ??
      challenge?.seed ??
      Math.floor(clamp(fallbackRng(), 0, 0.999999999) * 4294967296),
  );
  const spawned = createBallFromRandomState(layout, seed, stageConfig);
  const personalBest = nonNegativeInteger(options.personalBest);
  const state = {
    version: 2,
    layout,
    ball: spawned.ball,
    paddle: null,
    score: 0,
    saveCount: 0,
    bestScore: personalBest,
    personalBest,
    elapsedMs: 0,
    stageElapsedMs: 0,
    stageTimeRemainingMs: stageConfig.durationMs,
    lastCollisionAtMs: Number.NEGATIVE_INFINITY,
    status: "playing",
    phase: "playing",
    outcome: null,
    result: null,
    message: `${stageConfig.name}: ${stageConfig.goalText}`,
    stage,
    totalStages: FULLSCREEN_HAND_BOUNCE_TOTAL_STAGES,
    stageConfig,
    stageProgress: createStageProgress(),
    stageStartScore: 0,
    checkpointMsRemaining: 0,
    lastStageRecap: null,
    targetIndex: 0,
    targetZone: createTargetZone(stageConfig),
    comboCount: 0,
    focus: 0,
    powerModeMs: 0,
    wallBouncesSinceSave: 0,
    lives: FULLSCREEN_HAND_BOUNCE_STARTING_LIVES,
    maxLives: FULLSCREEN_HAND_BOUNCE_STARTING_LIVES,
    stats: createStats(),
    challenge,
    initialRandomState: seed,
    randomState: spawned.randomState,
  };

  handBounceLog.info("Created fullscreen hand bounce campaign", {
    width: layout.width,
    height: layout.height,
    ballRadius: layout.ballRadius,
    challenge: challenge?.id ?? null,
  });
  return state;
}

export function createFullscreenHandBounceGame(
  width,
  height,
  rngOrOptions = Math.random,
) {
  return createGameState(width, height, normalizeCreationOptions(rngOrOptions));
}

export function createFullscreenHandBounceDailyGame(
  width,
  height,
  options = {},
) {
  const normalizedOptions =
    options instanceof Date || typeof options === "string"
      ? { date: options }
      : options;
  const baseChallenge = getFullscreenHandBounceDailyChallenge(
    normalizedOptions?.date,
  );
  const challenge = {
    ...baseChallenge,
    ...(normalizedOptions?.dayKey
      ? { dayKey: String(normalizedOptions.dayKey) }
      : {}),
    ...(normalizedOptions?.seed !== undefined
      ? { seed: normalizeSeed(normalizedOptions.seed) }
      : {}),
    ...(normalizedOptions?.routeId !== undefined
      ? { routeId: nonNegativeInteger(normalizedOptions.routeId) % 3 }
      : {}),
  };
  challenge.id = `hand-bounce-daily-${challenge.dayKey}`;
  return createGameState(width, height, {
    ...normalizedOptions,
    seed: challenge.seed,
    challenge,
  });
}

export function restartFullscreenHandBounceGame(state, options = {}) {
  if (!state?.layout) {
    return state;
  }
  const personalBest = Math.max(
    nonNegativeInteger(state.personalBest),
    nonNegativeInteger(state.bestScore),
    nonNegativeInteger(state.score),
    nonNegativeInteger(state.result?.personalBest),
  );
  if (state.challenge?.mode === "daily") {
    return createFullscreenHandBounceDailyGame(
      state.layout.width,
      state.layout.height,
      {
        dayKey: state.challenge.dayKey,
        date: state.challenge.dayKey,
        seed: state.challenge.seed,
        routeId: state.challenge.routeId,
        personalBest,
        ...options,
      },
    );
  }
  return createFullscreenHandBounceGame(
    state.layout.width,
    state.layout.height,
    {
      seed: options.seed ?? state.initialRandomState,
      personalBest,
      ...options,
    },
  );
}

export function stepFullscreenHandBounceGame(state, dtSeconds, paddleInput) {
  if (!state?.layout || !state.ball) {
    return state;
  }

  const safeDt = clamp(
    Number.isFinite(dtSeconds) ? dtSeconds : 0,
    0,
    FULLSCREEN_HAND_BOUNCE_MAX_FRAME_SECONDS,
  );
  const paddle = resolvePaddle(state, paddleInput, safeDt);
  let nextState = {
    ...state,
    paddle,
    bestScore: Math.max(state.bestScore ?? 0, state.score ?? 0),
  };

  if (safeDt <= 0 || nextState.status !== "playing") {
    return nextState;
  }

  if (nextState.phase === "checkpoint") {
    const elapsedMs = safeDt * 1000;
    const checkpointMsRemaining = Math.max(
      0,
      (nextState.checkpointMsRemaining ?? 0) - elapsedMs,
    );
    nextState = {
      ...nextState,
      elapsedMs: nextState.elapsedMs + elapsedMs,
      checkpointMsRemaining,
      powerModeMs: Math.max(0, (nextState.powerModeMs ?? 0) - elapsedMs),
    };
    return checkpointMsRemaining <= 0 ? advanceStage(nextState) : nextState;
  }

  let remaining = safeDt;
  let workingState = nextState;
  while (
    remaining > 1e-9 &&
    workingState.status === "playing" &&
    workingState.phase === "playing"
  ) {
    const stepSeconds = Math.min(
      FULLSCREEN_HAND_BOUNCE_MAX_STEP_SECONDS,
      remaining,
    );
    const nextElapsedMs = workingState.elapsedMs + stepSeconds * 1000;
    workingState = stepFullscreenHandBounceSubstep(
      workingState,
      stepSeconds,
      paddle,
      nextElapsedMs,
    );
    remaining -= stepSeconds;
  }

  return {
    ...workingState,
    bestScore: Math.max(workingState.bestScore ?? 0, workingState.score ?? 0),
  };
}
