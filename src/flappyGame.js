import { createScopedLogger } from "./logger.js";

const flappyLog = createScopedLogger("flappyGame");

export const FLAPPY_PIPE_SCORE = 1;
export const FLAPPY_CENTER_BONUS_SCORE = 2;
export const FLAPPY_DIFFICULTY_SCORE_STEP = 5;
export const FLAPPY_PINCH_FEEDBACK_MS = 180;

const MAX_STEP_SECONDS = 0.05;
const PIPE_CENTER_MARGIN = 72;
const INITIAL_PIPE_COUNT = 3;
const PIPE_RENDER_STRIDE = 3;
const DEFAULT_SEED = 0x6d2b79f5;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(start = 1) {
  let next = start;
  return () => {
    const current = next;
    next += PIPE_RENDER_STRIDE;
    return current;
  };
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || DEFAULT_SEED;
}

function normalizeSeed(seed) {
  if (Number.isFinite(seed)) {
    return Number(seed) >>> 0 || DEFAULT_SEED;
  }
  return hashSeed(seed);
}

export function nextFlappyRandom(seedState) {
  const state = (normalizeSeed(seedState) + DEFAULT_SEED) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    state,
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
  };
}

export function createFlappySeededRng(seed) {
  let state = normalizeSeed(seed);
  return () => {
    const next = nextFlappyRandom(state);
    state = next.state;
    return next.value;
  };
}

function normalizeDailyDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

export function getFlappyDailyChallenge(date = new Date()) {
  const dayKey = normalizeDailyDate(date).toISOString().slice(0, 10);
  return {
    id: `flappy-daily-${dayKey}`,
    mode: "daily",
    dayKey,
    seed: hashSeed(`flappy-daily:${dayKey}`),
  };
}

export function getFlappyDifficulty(score = 0) {
  const normalizedScore = Math.max(0, Number.isFinite(score) ? Math.floor(score) : 0);
  const level = Math.floor(normalizedScore / FLAPPY_DIFFICULTY_SCORE_STEP) + 1;
  return {
    level,
    speedMultiplier: Math.min(1.72, 1 + (level - 1) * 0.08),
    gapScale: Math.max(0.68, 1 - (level - 1) * 0.045),
    gravityMultiplier: Math.min(1.25, 1 + (level - 1) * 0.025),
    centerWindowRatio: Math.max(0.08, 0.14 - (level - 1) * 0.005),
  };
}

function createPipe(layout, x, pipeId, rng = Math.random, difficulty = getFlappyDifficulty()) {
  const gapHeight = layout.gapHeight * difficulty.gapScale;
  const centerMin = PIPE_CENTER_MARGIN + gapHeight / 2;
  const centerMax = layout.playfieldHeight - PIPE_CENTER_MARGIN - gapHeight / 2;
  return {
    id: `pipe-${pipeId}`,
    x,
    width: layout.pipeWidth,
    gapTop:
      clamp(centerMin + rng() * Math.max(0, centerMax - centerMin), centerMin, centerMax) -
      gapHeight / 2,
    gapHeight,
    difficultyLevel: difficulty.level,
    passed: false,
  };
}

function collidesWithPipe(bird, pipe, playfieldHeight) {
  const birdLeft = bird.x - bird.radius;
  const birdRight = bird.x + bird.radius;
  const birdTop = bird.y - bird.radius;
  const birdBottom = bird.y + bird.radius;
  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + pipe.width;
  const gapBottom = pipe.gapTop + pipe.gapHeight;

  if (birdRight < pipeLeft || birdLeft > pipeRight) {
    return false;
  }

  return birdTop <= pipe.gapTop || birdBottom >= Math.min(playfieldHeight, gapBottom);
}

function createStats(overrides = {}) {
  return {
    pipesCleared: 0,
    centerBonuses: 0,
    centerStreak: 0,
    bestCenterStreak: 0,
    flaps: 0,
    elapsedMs: 0,
    maxDifficultyLevel: 1,
    ...overrides,
  };
}

function normalizeStats(state) {
  return createStats(state?.stats);
}

function createInputFeedback(previous, type) {
  return {
    active: true,
    type,
    pulse: (previous?.pulse ?? 0) + 1,
    remainingMs: FLAPPY_PINCH_FEEDBACK_MS,
  };
}

function ageInputFeedback(feedback, elapsedMs) {
  if (!feedback) {
    return null;
  }
  const remainingMs = Math.max(0, (feedback.remainingMs ?? 0) - elapsedMs);
  return {
    ...feedback,
    active: remainingMs > 0,
    remainingMs,
  };
}

export function getFlappyPinchFeedback(state) {
  return (
    state?.inputFeedback ?? {
      active: false,
      type: null,
      pulse: 0,
      remainingMs: 0,
    }
  );
}

export function getFlappyMedals(statsOrState) {
  const stats = statsOrState?.stats
    ? normalizeStats(statsOrState)
    : createStats(statsOrState);
  const medals = [];
  if (stats.pipesCleared >= 1) {
    medals.push({
      id: "first-pipe",
      tier: "bronze",
      label: "First Flight",
      description: "Clear a pipe.",
    });
  }
  if (stats.centerBonuses >= 3 || stats.bestCenterStreak >= 3) {
    medals.push({
      id: "center-line",
      tier: "silver",
      label: "Center Line",
      description: "Earn three centered-gap bonuses.",
    });
  }
  if (stats.pipesCleared >= 20 || stats.bestCenterStreak >= 8) {
    medals.push({
      id: "sky-runner",
      tier: "gold",
      label: "Sky Runner",
      description: "Clear twenty pipes or center eight in a row.",
    });
  }
  return medals;
}

export function getFlappyResultStats(state) {
  if (!state?.layout) {
    return null;
  }
  if (state.result) {
    return state.result;
  }
  const stats = normalizeStats(state);
  const score = Math.max(0, Number.isFinite(state.score) ? state.score : 0);
  const previousPersonalBest = Math.max(
    0,
    Number.isFinite(state.personalBest) ? state.personalBest : 0,
  );
  return {
    score,
    personalBest: Math.max(previousPersonalBest, score),
    newPersonalBest: score > previousPersonalBest,
    pipesCleared: stats.pipesCleared,
    centerBonuses: stats.centerBonuses,
    bestCenterStreak: stats.bestCenterStreak,
    flaps: stats.flaps,
    elapsedMs: Math.round(stats.elapsedMs),
    difficultyLevel: Math.max(stats.maxDifficultyLevel, getFlappyDifficulty(score).level),
    challenge: state.challenge ?? null,
    medals: getFlappyMedals(stats),
  };
}

export function createFlappyLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(480, Number.isFinite(height) ? height : 480);
  const groundHeight = clamp(safeHeight * 0.12, 68, 112);
  const playfieldHeight = safeHeight - groundHeight;
  const birdRadius = clamp(Math.min(safeWidth, playfieldHeight) * 0.032, 14, 22);
  const pipeWidth = clamp(safeWidth * 0.14, 86, 148);
  const gapHeight = clamp(playfieldHeight * 0.3, 170, 250);
  const pipeSpacing = clamp(safeWidth * 0.34, 150, 240);

  return {
    width: safeWidth,
    height: safeHeight,
    groundHeight,
    playfieldHeight,
    birdX: clamp(safeWidth * 0.28, 110, 200),
    birdRadius,
    pipeWidth,
    gapHeight,
    pipeSpacing,
    pipeSpeed: clamp(safeWidth * 0.32, 150, 250),
    gravity: clamp(playfieldHeight * 1.55, 720, 1180),
    flapVelocity: -clamp(playfieldHeight * 0.78, 300, 470),
  };
}

function createGameState(width, height, rng, metadata = {}) {
  const layout = createFlappyLayout(width, height);
  const difficulty = getFlappyDifficulty(0);
  const createPipeId = createIdFactory(1);
  const visiblePipeSpacing = layout.pipeSpacing * PIPE_RENDER_STRIDE;
  const pipes = Array.from({ length: INITIAL_PIPE_COUNT }, (_, index) =>
    createPipe(
      layout,
      layout.width + index * visiblePipeSpacing,
      createPipeId(),
      rng,
      difficulty,
    ),
  );
  const state = {
    layout,
    bird: {
      x: layout.birdX,
      y: layout.playfieldHeight * 0.45,
      vy: 0,
      radius: layout.birdRadius,
      rotation: 0,
    },
    pipes,
    score: 0,
    status: "ready",
    message: "Pinch to flap",
    nextPipeId: 1 + INITIAL_PIPE_COUNT * PIPE_RENDER_STRIDE,
    difficulty,
    stats: createStats(),
    personalBest: 0,
    result: null,
    lastResult: null,
    inputFeedback: {
      active: false,
      type: null,
      pulse: 0,
      remainingMs: 0,
    },
    ...metadata,
  };

  flappyLog.info("Created flappy game state", {
    width: layout.width,
    height: layout.height,
    pipeCount: pipes.length,
    challenge: state.challenge?.id ?? null,
  });
  return state;
}

export function createFlappyGame(width, height, rng = Math.random) {
  return createGameState(width, height, typeof rng === "function" ? rng : Math.random);
}

export function createFlappyDailyChallengeGame(width, height, options = {}) {
  const normalizedOptions =
    options instanceof Date || typeof options === "string" ? { date: options } : options;
  const baseChallenge = getFlappyDailyChallenge(normalizedOptions?.date);
  const challenge = {
    ...baseChallenge,
    ...(normalizedOptions?.dayKey ? { dayKey: String(normalizedOptions.dayKey) } : {}),
    ...(normalizedOptions?.seed !== undefined
      ? { seed: normalizeSeed(normalizedOptions.seed) }
      : {}),
  };
  challenge.id = `flappy-daily-${challenge.dayKey}`;
  let randomState = challenge.seed;
  const rng = () => {
    const next = nextFlappyRandom(randomState);
    randomState = next.state;
    return next.value;
  };
  const game = createGameState(width, height, rng, {
    challenge,
    initialRandomState: challenge.seed,
  });
  return {
    ...game,
    randomState,
  };
}

function createStepRng(state, explicitRng) {
  if (typeof explicitRng === "function") {
    return {
      rng: explicitRng,
      getRandomState: () => state.randomState,
    };
  }
  if (Number.isFinite(state.randomState)) {
    let randomState = state.randomState;
    return {
      rng: () => {
        const next = nextFlappyRandom(randomState);
        randomState = next.state;
        return next.value;
      },
      getRandomState: () => randomState,
    };
  }
  return {
    rng: Math.random,
    getRandomState: () => state.randomState,
  };
}

function createRestartedGame(state, rng) {
  if (state.challenge?.mode === "daily") {
    return createFlappyDailyChallengeGame(state.layout.width, state.layout.height, {
      dayKey: state.challenge.dayKey,
      seed: state.challenge.seed,
      date: state.challenge.dayKey,
    });
  }
  return createFlappyGame(state.layout.width, state.layout.height, rng);
}

export function flapFlappyGame(state, rng) {
  if (!state?.layout) {
    return state;
  }

  if (state.status === "gameover") {
    const restarted = createRestartedGame(state, rng);
    return {
      ...restarted,
      status: "playing",
      message: "",
      bird: {
        ...restarted.bird,
        vy: restarted.layout.flapVelocity,
        rotation: -18,
      },
      stats: createStats({ flaps: 1 }),
      personalBest: Math.max(
        state.personalBest ?? 0,
        state.result?.personalBest ?? 0,
        state.score ?? 0,
      ),
      lastResult: state.result ?? state.lastResult ?? null,
      inputFeedback: createInputFeedback(state.inputFeedback, "restart"),
    };
  }

  const stats = normalizeStats(state);
  return {
    ...state,
    status: "playing",
    message: "",
    bird: {
      ...state.bird,
      vy: state.layout.flapVelocity,
      rotation: -18,
    },
    stats: {
      ...stats,
      flaps: stats.flaps + 1,
    },
    inputFeedback: createInputFeedback(state.inputFeedback, "flap"),
  };
}

export function stepFlappyGame(state, dtSeconds, rng) {
  if (!state?.layout) {
    return state;
  }

  const elapsedSeconds = Math.max(0, Number.isFinite(dtSeconds) ? dtSeconds : 0);
  const safeDt = clamp(elapsedSeconds, 0, MAX_STEP_SECONDS);
  const agedFeedback = ageInputFeedback(state.inputFeedback, elapsedSeconds * 1000);
  if (state.status !== "playing" || safeDt <= 0) {
    return agedFeedback === state.inputFeedback
      ? state
      : {
          ...state,
          inputFeedback: agedFeedback,
        };
  }

  const layout = state.layout;
  const difficulty = getFlappyDifficulty(state.score);
  const visiblePipeSpacing = layout.pipeSpacing * PIPE_RENDER_STRIDE;
  const gravity = layout.gravity * difficulty.gravityMultiplier;
  const nextBirdY = state.bird.y + state.bird.vy * safeDt + 0.5 * gravity * safeDt * safeDt;
  const nextBirdVy = state.bird.vy + gravity * safeDt;
  const movedPipes = state.pipes
    .map((pipe) => ({
      ...pipe,
      x: pipe.x - layout.pipeSpeed * difficulty.speedMultiplier * safeDt,
    }))
    .filter((pipe) => pipe.x + pipe.width >= -2);

  let scoreDelta = 0;
  let pipesClearedDelta = 0;
  let centerBonusesDelta = 0;
  let centerStreak = normalizeStats(state).centerStreak;
  let bestCenterStreak = normalizeStats(state).bestCenterStreak;
  const scoredPipes = movedPipes.map((pipe) => {
    if (!pipe.passed && pipe.x + pipe.width < state.bird.x - state.bird.radius) {
      const gapCenter = pipe.gapTop + pipe.gapHeight / 2;
      const centerWindow = Math.max(
        state.bird.radius * 1.25,
        pipe.gapHeight * difficulty.centerWindowRatio,
      );
      const centered = Math.abs(nextBirdY - gapCenter) <= centerWindow;
      pipesClearedDelta += 1;
      scoreDelta += FLAPPY_PIPE_SCORE;
      if (centered) {
        scoreDelta += FLAPPY_CENTER_BONUS_SCORE;
        centerBonusesDelta += 1;
        centerStreak += 1;
        bestCenterStreak = Math.max(bestCenterStreak, centerStreak);
      } else {
        centerStreak = 0;
      }
      return {
        ...pipe,
        passed: true,
        centered,
      };
    }
    return pipe;
  });

  const nextScore = state.score + scoreDelta;
  const nextDifficulty = getFlappyDifficulty(nextScore);
  const rightMostPipeX = scoredPipes.reduce(
    (max, pipe) => Math.max(max, pipe.x),
    Number.NEGATIVE_INFINITY,
  );
  const random = createStepRng(state, rng);
  let spawnedPipe = false;
  if (rightMostPipeX <= layout.width - visiblePipeSpacing) {
    scoredPipes.push(
      createPipe(
        layout,
        Number.isFinite(rightMostPipeX) ? rightMostPipeX + visiblePipeSpacing : layout.width,
        state.nextPipeId,
        random.rng,
        nextDifficulty,
      ),
    );
    spawnedPipe = true;
  }

  const nextBird = {
    ...state.bird,
    y: nextBirdY,
    vy: nextBirdVy,
    rotation: clamp((nextBirdVy / 420) * 35, -20, 80),
  };

  const hitPipe = scoredPipes.some((pipe) => collidesWithPipe(nextBird, pipe, layout.playfieldHeight));
  const hitGround = nextBird.y + nextBird.radius >= layout.playfieldHeight;
  const hitCeiling = nextBird.y - nextBird.radius <= 0;
  const gameOver = hitPipe || hitGround || hitCeiling;
  const previousStats = normalizeStats(state);
  const stats = {
    ...previousStats,
    pipesCleared: previousStats.pipesCleared + pipesClearedDelta,
    centerBonuses: previousStats.centerBonuses + centerBonusesDelta,
    centerStreak,
    bestCenterStreak,
    elapsedMs: previousStats.elapsedMs + elapsedSeconds * 1000,
    maxDifficultyLevel: Math.max(previousStats.maxDifficultyLevel, nextDifficulty.level),
  };
  const intermediateState = {
    ...state,
    bird: {
      ...nextBird,
      y: gameOver
        ? clamp(nextBird.y, nextBird.radius, layout.playfieldHeight - nextBird.radius)
        : nextBird.y,
      rotation: gameOver ? 90 : nextBird.rotation,
    },
    pipes: scoredPipes,
    score: nextScore,
    status: gameOver ? "gameover" : "playing",
    message: gameOver ? "Pinch to restart" : "",
    nextPipeId: spawnedPipe ? state.nextPipeId + PIPE_RENDER_STRIDE : state.nextPipeId,
    difficulty: nextDifficulty,
    stats,
    inputFeedback: agedFeedback,
    ...(Number.isFinite(random.getRandomState())
      ? { randomState: random.getRandomState() }
      : {}),
  };

  if (!gameOver) {
    return {
      ...intermediateState,
      result: null,
    };
  }

  const result = getFlappyResultStats(intermediateState);
  return {
    ...intermediateState,
    personalBest: result.personalBest,
    result,
  };
}
