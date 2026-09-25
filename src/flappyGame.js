import { createScopedLogger } from "./logger.js";

const flappyLog = createScopedLogger("flappyGame");

export const FLAPPY_PIPE_SCORE = 1;

const MAX_STEP_SECONDS = 0.05;
const PIPE_CENTER_MARGIN = 72;
const INITIAL_PIPE_COUNT = 3;
const PIPE_RENDER_STRIDE = 3;

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

function createPipe(layout, x, pipeId, rng = Math.random) {
  const centerMin = PIPE_CENTER_MARGIN + layout.gapHeight / 2;
  const centerMax = layout.playfieldHeight - PIPE_CENTER_MARGIN - layout.gapHeight / 2;
  return {
    id: `pipe-${pipeId}`,
    x,
    width: layout.pipeWidth,
    gapTop:
      clamp(centerMin + rng() * Math.max(0, centerMax - centerMin), centerMin, centerMax) -
      layout.gapHeight / 2,
    gapHeight: layout.gapHeight,
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

export function createFlappyGame(width, height, rng = Math.random) {
  const layout = createFlappyLayout(width, height);
  const createPipeId = createIdFactory(1);
  const visiblePipeSpacing = layout.pipeSpacing * PIPE_RENDER_STRIDE;
  const pipes = Array.from({ length: INITIAL_PIPE_COUNT }, (_, index) =>
    createPipe(
      layout,
      layout.width + index * visiblePipeSpacing,
      createPipeId(),
      rng,
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
  };

  flappyLog.info("Created flappy game state", {
    width: layout.width,
    height: layout.height,
    pipeCount: pipes.length,
  });
  return state;
}

export function flapFlappyGame(state, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }

  if (state.status === "gameover") {
    const restarted = createFlappyGame(state.layout.width, state.layout.height, rng);
    return {
      ...restarted,
      status: "playing",
      message: "",
      bird: {
        ...restarted.bird,
        vy: restarted.layout.flapVelocity,
        rotation: -18,
      },
    };
  }

  return {
    ...state,
    status: "playing",
    message: "",
    bird: {
      ...state.bird,
      vy: state.layout.flapVelocity,
      rotation: -18,
    },
  };
}

export function stepFlappyGame(state, dtSeconds, rng = Math.random) {
  if (!state?.layout) {
    return state;
  }

  if (state.status !== "playing") {
    return state;
  }

  const safeDt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, MAX_STEP_SECONDS);
  if (safeDt <= 0) {
    return state;
  }

  const layout = state.layout;
  const visiblePipeSpacing = layout.pipeSpacing * PIPE_RENDER_STRIDE;
  const nextBirdY = state.bird.y + state.bird.vy * safeDt + 0.5 * layout.gravity * safeDt * safeDt;
  const nextBirdVy = state.bird.vy + layout.gravity * safeDt;
  const movedPipes = state.pipes
    .map((pipe) => ({
      ...pipe,
      x: pipe.x - layout.pipeSpeed * safeDt,
    }))
    .filter((pipe) => pipe.x + pipe.width >= -2);

  const rightMostPipeX = movedPipes.reduce(
    (max, pipe) => Math.max(max, pipe.x),
    Number.NEGATIVE_INFINITY,
  );
  let spawnedPipe = false;
  if (rightMostPipeX <= layout.width - visiblePipeSpacing) {
    movedPipes.push(
      createPipe(
        layout,
        Number.isFinite(rightMostPipeX) ? rightMostPipeX + visiblePipeSpacing : layout.width,
        state.nextPipeId,
        rng,
      ),
    );
    spawnedPipe = true;
  }

  let scoreDelta = 0;
  const scoredPipes = movedPipes.map((pipe) => {
    if (!pipe.passed && pipe.x + pipe.width < state.bird.x - state.bird.radius) {
      scoreDelta += FLAPPY_PIPE_SCORE;
      return {
        ...pipe,
        passed: true,
      };
    }
    return pipe;
  });

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

  return {
    ...state,
    bird: {
      ...nextBird,
      y: gameOver
        ? clamp(nextBird.y, nextBird.radius, layout.playfieldHeight - nextBird.radius)
        : nextBird.y,
      rotation: gameOver ? 90 : nextBird.rotation,
    },
    pipes: scoredPipes,
    score: state.score + scoreDelta,
    status: gameOver ? "gameover" : "playing",
    message: gameOver ? "Pinch to restart" : "",
    nextPipeId: spawnedPipe ? state.nextPipeId + PIPE_RENDER_STRIDE : state.nextPipeId,
  };
}
