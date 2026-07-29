export const MISSILE_COMMAND_COUNTDOWN_MS = 2_000;
export const MISSILE_COMMAND_THREAT_SCORE = 125;
export const MISSILE_COMMAND_SCORE_BURST_MS = 760;
export const MISSILE_COMMAND_WAVE_COUNT = 5;
export const MISSILE_COMMAND_INTERMISSION_MS = 2_400;
export const MISSILE_COMMAND_MAX_AMMO = 18;
export const MISSILE_COMMAND_MAX_ENERGY = 100;
export const MISSILE_COMMAND_INTERCEPT_ENERGY_COST = 18;
export const MISSILE_COMMAND_CITY_BONUS = 500;
export const MISSILE_COMMAND_PERFECT_WAVE_BONUS = 750;

const MISSILE_COMMAND_MAX_STEP_SECONDS = 0.05;
const MISSILE_COMMAND_SPAWN_DELAY_START_MS = 1_400;
const MISSILE_COMMAND_SPAWN_DELAY_END_MS = 650;
const MISSILE_COMMAND_DIFFICULTY_RAMP_MS = 90_000;
const MISSILE_COMMAND_INTERCEPTOR_MIN_SPEED = 630;
const MISSILE_COMMAND_INTERCEPTOR_SPEED_RATIO = 1.23;
export const MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS = 180;
const MISSILE_COMMAND_ENERGY_REGEN_PER_SECOND = 12;
const MISSILE_COMMAND_DEFAULT_SEED = 0x9e3779b9;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createIdFactory(start = 1) {
  let next = start;
  return () => next++;
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || MISSILE_COMMAND_DEFAULT_SEED;
}

function normalizeSeed(seed) {
  if (Number.isFinite(seed)) {
    return Number(seed) >>> 0 || MISSILE_COMMAND_DEFAULT_SEED;
  }
  return hashSeed(seed);
}

export function nextMissileCommandRandom(seedState) {
  const state = (normalizeSeed(seedState) + MISSILE_COMMAND_DEFAULT_SEED) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return {
    state,
    value: ((value ^ (value >>> 15)) >>> 0) / 4294967296,
  };
}

export function createMissileCommandSeededRng(seed) {
  let state = normalizeSeed(seed);
  return () => {
    const next = nextMissileCommandRandom(state);
    state = next.state;
    return next.value;
  };
}

function normalizeDailyDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

export function getMissileCommandDailyPattern(date = new Date()) {
  const dayKey = normalizeDailyDate(date).toISOString().slice(0, 10);
  const seed = hashSeed(`missile-command:${dayKey}`);
  const patternNames = ["Crossfire", "Falling Stars", "Iron Rain"];
  return {
    id: `missile-command-daily-${dayKey}`,
    mode: "daily",
    dayKey,
    seed,
    patternId: seed % patternNames.length,
    patternName: patternNames[seed % patternNames.length],
    totalWaves: MISSILE_COMMAND_WAVE_COUNT,
  };
}

export function getMissileCommandWaveConfig(wave = 1, patternId = 0) {
  const normalizedWave = Math.max(1, Number.isFinite(wave) ? Math.floor(wave) : 1);
  const normalizedPattern = Math.abs(Number.isFinite(patternId) ? Math.floor(patternId) : 0) % 3;
  return {
    wave: normalizedWave,
    name: ["First Contact", "Crosswind", "Split Sky", "Iron Curtain", "Last Light"][
      Math.min(MISSILE_COMMAND_WAVE_COUNT - 1, normalizedWave - 1)
    ] ?? `Endless Wave ${normalizedWave}`,
    threatCount: 5 + normalizedWave * 2 + normalizedPattern,
    spawnDelayMs: Math.max(520, 1_250 - (normalizedWave - 1) * 125),
    speedMultiplier: Math.min(1.72, 1 + (normalizedWave - 1) * 0.1),
    specialChance: normalizedWave <= 1 ? 0 : Math.min(0.48, 0.14 + normalizedWave * 0.055),
    patternId: normalizedPattern,
  };
}

function createStats(overrides = {}) {
  return {
    shotsFired: 0,
    ammoSpent: 0,
    energySpent: 0,
    threatsResolved: 0,
    specialThreatsStopped: 0,
    wavesCleared: 0,
    perfectWaves: 0,
    structuresLost: 0,
    citiesLost: 0,
    basesLost: 0,
    cityBonusScore: 0,
    elapsedMs: 0,
    ...overrides,
  };
}

function normalizeStats(state) {
  return createStats(state?.stats);
}

export function getMissileCommandMedals(state) {
  const stats = normalizeStats(state);
  const totalWaves = state?.totalWaves ?? MISSILE_COMMAND_WAVE_COUNT;
  const medals = [];
  if (stats.perfectWaves >= 1) {
    medals.push({
      id: "perfect-wave",
      tier: "bronze",
      label: "Untouched Sky",
      description: "Finish a wave without losing a structure.",
    });
  }
  if (state?.outcome === "victory" && stats.citiesLost === 0) {
    medals.push({
      id: "city-guardian",
      tier: "silver",
      label: "City Guardian",
      description: "Finish the defense with every city standing.",
    });
  }
  if (
    state?.outcome === "victory" &&
    stats.perfectWaves >= totalWaves &&
    stats.structuresLost === 0
  ) {
    medals.push({
      id: "perfect-defense",
      tier: "gold",
      label: "Perfect Defense",
      description: "Clear every wave without losing a structure.",
    });
  }
  return medals;
}

export function getMissileCommandResultStats(state) {
  if (!state?.layout) {
    return null;
  }
  if (state.result) {
    return state.result;
  }
  const stats = normalizeStats(state);
  const shotsFired = stats.shotsFired;
  return {
    outcome: state.outcome ?? (state.status === "game_over" ? "defeat" : "in_progress"),
    score: Math.max(0, state.score ?? 0),
    wavesCleared: stats.wavesCleared,
    totalWaves: state.totalWaves ?? MISSILE_COMMAND_WAVE_COUNT,
    threatsStopped: state.threatsStopped ?? 0,
    shotsFired,
    accuracy:
      shotsFired > 0
        ? Math.min(
            100,
            Math.round(((state.threatsStopped ?? 0) / shotsFired) * 100),
          )
        : 0,
    citiesSurviving: getAliveStructures(state.structures).filter(
      (structure) => structure.type === "city",
    ).length,
    structuresSurviving: getAliveStructures(state.structures).length,
    perfectWaves: stats.perfectWaves,
    specialThreatsStopped: stats.specialThreatsStopped,
    cityBonusScore: stats.cityBonusScore,
    ammoRemaining: Math.max(0, state.ammo ?? 0),
    energyRemaining: Math.round(Math.max(0, state.energy ?? 0)),
    elapsedMs: Math.round(stats.elapsedMs),
    medals: getMissileCommandMedals(state),
  };
}

export function createMissileCommandLayout(width, height) {
  const safeWidth = Math.max(360, Number.isFinite(width) ? width : 360);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const hudTopInset = clamp(safeHeight * 0.12, 58, 96);
  const hudBottomInset = clamp(safeHeight * 0.1, 48, 88);
  const groundBandHeight = clamp(safeHeight * 0.13, 64, 118);
  const groundY = safeHeight - Math.max(groundBandHeight, hudBottomInset);

  return {
    width: safeWidth,
    height: safeHeight,
    hudTopInset,
    hudBottomInset,
    playTopY: hudTopInset,
    playBottomY: groundY,
    groundY,
    interceptorSpeed: Math.max(
      MISSILE_COMMAND_INTERCEPTOR_MIN_SPEED,
      safeHeight * MISSILE_COMMAND_INTERCEPTOR_SPEED_RATIO,
    ),
    threatBaseSpeed: Math.max(80, safeHeight * 0.16),
    threatSpeedBonus: Math.max(60, safeHeight * 0.12),
    blastRadius: clamp(Math.min(safeWidth, safeHeight) * 0.09, 42, 96),
    impactRadius: clamp(Math.min(safeWidth, safeHeight) * 0.05, 24, 50),
    structureStep: safeWidth / 6,
  };
}

export function createMissileCommandStructures(layout) {
  const step = layout.structureStep;
  const baseWidth = clamp(layout.width * 0.1, 44, 84);
  const cityWidth = clamp(layout.width * 0.08, 38, 72);
  const structures = [];
  const kinds = ["city", "base", "city", "base", "city"];

  for (let index = 0; index < kinds.length; index += 1) {
    const type = kinds[index];
    const x = step * (index + 1);
    const width = type === "base" ? baseWidth : cityWidth;
    const height = type === "base" ? clamp(layout.height * 0.065, 28, 52) : clamp(layout.height * 0.048, 22, 42);
    structures.push({
      id: `structure-${index + 1}`,
      type,
      x,
      y: layout.groundY,
      width,
      height,
      alive: true,
    });
  }

  return structures;
}

function getAliveStructures(structures) {
  return (Array.isArray(structures) ? structures : []).filter((structure) => structure?.alive);
}

function getDifficultyProgress(elapsedMs = 0) {
  return clamp(
    (Number.isFinite(elapsedMs) ? elapsedMs : 0) / MISSILE_COMMAND_DIFFICULTY_RAMP_MS,
    0,
    1,
  );
}

export function getMissileCommandSpawnDelayMs(elapsedMs = 0) {
  const progress = getDifficultyProgress(elapsedMs);
  return Math.round(
    MISSILE_COMMAND_SPAWN_DELAY_START_MS -
      (MISSILE_COMMAND_SPAWN_DELAY_START_MS - MISSILE_COMMAND_SPAWN_DELAY_END_MS) * progress,
  );
}

function getThreatSpeed(layout, elapsedMs = 0, waveConfig = getMissileCommandWaveConfig()) {
  const progress = getDifficultyProgress(elapsedMs);
  return (
    (layout.threatBaseSpeed + layout.threatSpeedBonus * progress) *
    waveConfig.speedMultiplier
  );
}

function createExplosion(x, y, maxRadius, durationMs, color, id, kind) {
  return {
    id: `explosion-${id}`,
    kind,
    x,
    y,
    ageMs: 0,
    durationMs,
    maxRadius,
    color,
  };
}

function createScoreBurst(x, y, value, id) {
  return {
    id: `score-burst-${id}`,
    x,
    y,
    value,
    ageMs: 0,
    durationMs: MISSILE_COMMAND_SCORE_BURST_MS,
  };
}

function ageScoreBursts(scoreBursts, dtMs) {
  return (Array.isArray(scoreBursts) ? scoreBursts : [])
    .map((burst) => ({
      ...burst,
      ageMs: burst.ageMs + dtMs,
    }))
    .filter((burst) => burst.ageMs < burst.durationMs);
}

export function getMissileCommandExplosionRadius(explosion) {
  if (!explosion) {
    return 0;
  }
  const durationMs = Math.max(1, explosion.durationMs);
  const progress = clamp(explosion.ageMs / durationMs, 0, 1);
  if (progress <= 0.6) {
    return explosion.maxRadius * (progress / 0.6);
  }
  return explosion.maxRadius * (1 - (progress - 0.6) / 0.4);
}

function createThreat(
  layout,
  structures,
  elapsedMs,
  threatId,
  rng = Math.random,
  waveConfig = getMissileCommandWaveConfig(),
) {
  const aliveStructures = getAliveStructures(structures);
  if (aliveStructures.length === 0) {
    return null;
  }

  const targetIndex = Math.min(
    aliveStructures.length - 1,
    Math.floor(rng() * aliveStructures.length),
  );
  const target = aliveStructures[targetIndex];
  const margin = clamp(layout.width * 0.08, 28, 72);
  const startX = margin + rng() * Math.max(1, layout.width - margin * 2);
  const startY = layout.playTopY ?? clamp(layout.height * 0.12, 58, 96);
  const targetX = target.x;
  const targetY = target.y - target.height * 0.48;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const specialRoll = rng();
  const special =
    specialRoll >= waveConfig.specialChance
      ? "standard"
      : specialRoll < waveConfig.specialChance * 0.42
        ? "armored"
        : "fast";
  const speed =
    getThreatSpeed(layout, elapsedMs, waveConfig) *
    (special === "fast" ? 1.52 : special === "armored" ? 0.82 : 1);

  return {
    id: `threat-${threatId}`,
    startX,
    startY,
    x: startX,
    y: startY,
    targetX,
    targetY,
    targetStructureId: target.id,
    vx: (dx / distance) * speed,
    vy: (dy / distance) * speed,
    type: special,
    hitPoints: special === "armored" ? 2 : 1,
    maxHitPoints: special === "armored" ? 2 : 1,
    scoreValue: Math.round(
      MISSILE_COMMAND_THREAT_SCORE *
        (special === "armored" ? 2 : special === "fast" ? 1.5 : 1),
    ),
    lastExplosionId: null,
  };
}

function getLaunchOrigin(state, targetX) {
  const aliveBases = getAliveStructures(state?.structures).filter(
    (structure) => structure.type === "base",
  );
  if (aliveBases.length === 0) {
    return null;
  }

  return aliveBases.reduce((closest, candidate) => {
    if (!closest) {
      return candidate;
    }
    const closestDistance = Math.abs(closest.x - targetX);
    const candidateDistance = Math.abs(candidate.x - targetX);
    return candidateDistance < closestDistance ? candidate : closest;
  }, null);
}

export function launchMissileCommandInterceptor(state, targetX, targetY) {
  if (!state?.layout || state.status !== "playing") {
    return state;
  }
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || state.cooldownMs > 0) {
    return state;
  }

  const clampedTargetX = clamp(targetX, 0, state.layout.width);
  const clampedTargetY = clamp(targetY, 0, state.layout.height);

  const origin = getLaunchOrigin(state, clampedTargetX);
  if (!origin) {
    return state;
  }
  const ammo = Number.isFinite(state.ammo) ? state.ammo : MISSILE_COMMAND_MAX_AMMO;
  const energy = Number.isFinite(state.energy) ? state.energy : MISSILE_COMMAND_MAX_ENERGY;
  if (ammo <= 0) {
    return {
      ...state,
      message: "Out of ammo — hold the line",
    };
  }
  if (energy < MISSILE_COMMAND_INTERCEPT_ENERGY_COST) {
    return {
      ...state,
      message: "Energy recharging",
    };
  }

  const originY = origin.y - origin.height * 0.7;
  const dx = clampedTargetX - origin.x;
  const dy = clampedTargetY - originY;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) {
    return state;
  }

  return {
    ...state,
    interceptors: [
      ...state.interceptors,
      {
        id: `interceptor-${state.nextInterceptorId}`,
        originX: origin.x,
        originY,
        x: origin.x,
        y: originY,
        targetX: clampedTargetX,
        targetY: clampedTargetY,
        vx: (dx / distance) * state.layout.interceptorSpeed,
        vy: (dy / distance) * state.layout.interceptorSpeed,
      },
    ],
    nextInterceptorId: state.nextInterceptorId + 1,
    cooldownMs: MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS,
    ammo: ammo - 1,
    energy: energy - MISSILE_COMMAND_INTERCEPT_ENERGY_COST,
    waveShotsFired: (state.waveShotsFired ?? 0) + 1,
    stats: {
      ...normalizeStats(state),
      shotsFired: normalizeStats(state).shotsFired + 1,
      ammoSpent: normalizeStats(state).ammoSpent + 1,
      energySpent:
        normalizeStats(state).energySpent + MISSILE_COMMAND_INTERCEPT_ENERGY_COST,
    },
  };
}

function createMissileCommandState(width, height, metadata = {}) {
  const layout = createMissileCommandLayout(width, height);
  const wave = 1;
  const patternId = metadata.challenge?.patternId ?? 0;
  const waveConfig = getMissileCommandWaveConfig(wave, patternId);

  return {
    layout,
    structures: createMissileCommandStructures(layout),
    threats: [],
    interceptors: [],
    explosions: [],
    scoreBursts: [],
    score: 0,
    threatsStopped: 0,
    wave,
    totalWaves: metadata.challenge?.totalWaves ?? MISSILE_COMMAND_WAVE_COUNT,
    waveConfig,
    waveThreatLimit: waveConfig.threatCount,
    waveThreatsSpawned: 0,
    waveThreatsResolved: 0,
    waveThreatsStopped: 0,
    waveStructuresLost: 0,
    waveShotsFired: 0,
    waveStartScore: 0,
    waveStartAliveStructureIds: createMissileCommandStructures(layout).map(
      (structure) => structure.id,
    ),
    intermissionMs: 0,
    ammo: MISSILE_COMMAND_MAX_AMMO,
    maxAmmo: MISSILE_COMMAND_MAX_AMMO,
    energy: MISSILE_COMMAND_MAX_ENERGY,
    maxEnergy: MISSILE_COMMAND_MAX_ENERGY,
    status: "countdown",
    countdownMs: MISSILE_COMMAND_COUNTDOWN_MS,
    elapsedMs: 0,
    spawnTimerMs: 900,
    cooldownMs: 0,
    nextThreatId: 1,
    nextInterceptorId: 1,
    nextExplosionId: 1,
    nextScoreBurstId: 1,
    message: "Pinch to fire",
    stats: createStats(),
    lastWaveRecap: null,
    outcome: null,
    result: null,
    ...metadata,
  };
}

export function createMissileCommandGame(width, height) {
  return createMissileCommandState(width, height);
}

export function createMissileCommandDailyGame(width, height, options = {}) {
  const normalizedOptions =
    options instanceof Date || typeof options === "string" ? { date: options } : options;
  const baseChallenge = getMissileCommandDailyPattern(normalizedOptions?.date);
  const challenge = {
    ...baseChallenge,
    ...(normalizedOptions?.dayKey ? { dayKey: String(normalizedOptions.dayKey) } : {}),
    ...(normalizedOptions?.seed !== undefined
      ? { seed: normalizeSeed(normalizedOptions.seed) }
      : {}),
  };
  challenge.id = `missile-command-daily-${challenge.dayKey}`;
  return createMissileCommandState(width, height, {
    challenge,
    randomState: challenge.seed,
    initialRandomState: challenge.seed,
  });
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
        const next = nextMissileCommandRandom(randomState);
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

export function advanceMissileCommandWave(state) {
  if (!state?.layout) {
    return state;
  }
  const wave = Math.max(1, (state.wave ?? 1) + 1);
  const waveConfig = getMissileCommandWaveConfig(
    wave,
    state.challenge?.patternId ?? state.waveConfig?.patternId ?? 0,
  );
  const aliveBases = getAliveStructures(state.structures).filter(
    (structure) => structure.type === "base",
  ).length;
  const maxAmmo = 12 + aliveBases * 3;
  return {
    ...state,
    wave,
    waveConfig,
    waveThreatLimit: waveConfig.threatCount,
    waveThreatsSpawned: 0,
    waveThreatsResolved: 0,
    waveThreatsStopped: 0,
    waveStructuresLost: 0,
    waveShotsFired: 0,
    waveStartScore: state.score,
    waveStartAliveStructureIds: getAliveStructures(state.structures).map(
      (structure) => structure.id,
    ),
    threats: [],
    interceptors: [],
    explosions: [],
    scoreBursts: [],
    ammo: maxAmmo,
    maxAmmo,
    energy: Math.min(
      state.maxEnergy ?? MISSILE_COMMAND_MAX_ENERGY,
      (state.energy ?? 0) + 40,
    ),
    status: "playing",
    intermissionMs: 0,
    spawnTimerMs: 700,
    message: `Wave ${wave}: ${waveConfig.name}`,
    result: null,
  };
}

function completeMissileCommandWave(state) {
  const aliveCities = getAliveStructures(state.structures).filter(
    (structure) => structure.type === "city",
  ).length;
  const cityBonus = aliveCities * MISSILE_COMMAND_CITY_BONUS;
  const perfect = (state.waveStructuresLost ?? 0) === 0;
  const perfectBonus = perfect ? MISSILE_COMMAND_PERFECT_WAVE_BONUS : 0;
  const scoreDelta = cityBonus + perfectBonus;
  const stats = normalizeStats(state);
  const nextStats = {
    ...stats,
    wavesCleared: stats.wavesCleared + 1,
    perfectWaves: stats.perfectWaves + (perfect ? 1 : 0),
    cityBonusScore: stats.cityBonusScore + scoreDelta,
  };
  const recap = {
    wave: state.wave,
    name: state.waveConfig?.name ?? `Wave ${state.wave}`,
    threatsStopped: state.waveThreatsStopped ?? 0,
    threatsResolved: state.waveThreatsResolved ?? 0,
    shotsFired: state.waveShotsFired ?? 0,
    structuresLost: state.waveStructuresLost ?? 0,
    citiesSurviving: aliveCities,
    cityBonus,
    perfectBonus,
    perfect,
    scoreEarned: state.score + scoreDelta - (state.waveStartScore ?? 0),
  };
  const campaignComplete = (state.wave ?? 1) >= (state.totalWaves ?? MISSILE_COMMAND_WAVE_COUNT);
  const completedState = {
    ...state,
    score: state.score + scoreDelta,
    stats: nextStats,
    lastWaveRecap: recap,
    threats: [],
    interceptors: [],
    intermissionMs: campaignComplete ? 0 : MISSILE_COMMAND_INTERMISSION_MS,
    status: campaignComplete ? "game_over" : "intermission",
    outcome: campaignComplete ? "victory" : null,
    message: campaignComplete
      ? "Defense complete"
      : perfect
        ? `Perfect wave — ${state.waveConfig?.name ?? state.wave}`
        : `Wave ${state.wave} secured`,
  };
  if (!campaignComplete) {
    return completedState;
  }
  return {
    ...completedState,
    result: getMissileCommandResultStats(completedState),
  };
}

export function stepMissileCommandGame(state, dtSeconds, rng) {
  if (!state?.layout) {
    return state;
  }

  const safeDt = clamp(
    Number.isFinite(dtSeconds) ? dtSeconds : 0,
    0,
    MISSILE_COMMAND_MAX_STEP_SECONDS,
  );
  const dtMs = safeDt * 1000;
  const random = createStepRng(state, rng);
  const waveConfig =
    state.waveConfig ??
    getMissileCommandWaveConfig(state.wave, state.challenge?.patternId ?? 0);
  const stats = normalizeStats(state);
  let nextState = {
    ...state,
    elapsedMs: state.elapsedMs + dtMs,
    wave: state.wave ?? 1,
    totalWaves: state.totalWaves ?? MISSILE_COMMAND_WAVE_COUNT,
    waveConfig,
    waveThreatLimit: state.waveThreatLimit ?? waveConfig.threatCount,
    waveThreatsSpawned: state.waveThreatsSpawned ?? 0,
    waveThreatsResolved: state.waveThreatsResolved ?? 0,
    waveThreatsStopped: state.waveThreatsStopped ?? 0,
    waveStructuresLost: state.waveStructuresLost ?? 0,
    waveShotsFired: state.waveShotsFired ?? 0,
    ammo: state.ammo ?? MISSILE_COMMAND_MAX_AMMO,
    maxAmmo: state.maxAmmo ?? MISSILE_COMMAND_MAX_AMMO,
    energy: Math.min(
      state.maxEnergy ?? MISSILE_COMMAND_MAX_ENERGY,
      (state.energy ?? MISSILE_COMMAND_MAX_ENERGY) +
        (state.status === "playing" || state.status === "intermission"
          ? MISSILE_COMMAND_ENERGY_REGEN_PER_SECOND * safeDt
          : 0),
    ),
    maxEnergy: state.maxEnergy ?? MISSILE_COMMAND_MAX_ENERGY,
    cooldownMs: Math.max(0, (state.cooldownMs ?? 0) - dtMs),
    scoreBursts: ageScoreBursts(state.scoreBursts, dtMs),
    stats: {
      ...stats,
      elapsedMs:
        state.status === "game_over" ? stats.elapsedMs : stats.elapsedMs + dtMs,
    },
    ...(Number.isFinite(random.getRandomState())
      ? { randomState: random.getRandomState() }
      : {}),
  };

  if (nextState.status === "countdown") {
    const countdownMs = Math.max(0, nextState.countdownMs - dtMs);
    const status = countdownMs <= 0 ? "playing" : "countdown";
    return {
      ...nextState,
      countdownMs,
      status,
      message: status === "playing" ? "Pinch to fire" : `${Math.max(1, Math.ceil(countdownMs / 1000))}`,
    };
  }

  if (nextState.status === "game_over") {
    return nextState;
  }

  if (nextState.status === "intermission") {
    const intermissionMs = Math.max(0, (nextState.intermissionMs ?? 0) - dtMs);
    if (intermissionMs > 0) {
      return {
        ...nextState,
        intermissionMs,
        message: `${nextState.lastWaveRecap?.name ?? `Wave ${nextState.wave}`} secured`,
      };
    }
    return advanceMissileCommandWave({
      ...nextState,
      intermissionMs: 0,
    });
  }

  let spawnTimerMs = nextState.spawnTimerMs - dtMs;
  const nextThreats = [];
  for (const threat of nextState.threats) {
    const x = threat.x + threat.vx * safeDt;
    const y = threat.y + threat.vy * safeDt;
    const reachedTarget =
      Math.hypot(threat.targetX - x, threat.targetY - y) <= Math.max(8, Math.hypot(threat.vx, threat.vy) * safeDt);

    if (reachedTarget) {
      const targetWasAlive = nextState.structures.some(
        (structure) => structure.id === threat.targetStructureId && structure.alive,
      );
      const targetType = nextState.structures.find(
        (structure) => structure.id === threat.targetStructureId,
      )?.type;
      const impactStats = normalizeStats(nextState);
      nextState = {
        ...nextState,
        structures: nextState.structures.map((structure) =>
          structure.id === threat.targetStructureId ? { ...structure, alive: false } : structure,
        ),
        explosions: [
          ...nextState.explosions,
          createExplosion(
            threat.targetX,
            threat.targetY,
            nextState.layout.impactRadius,
            520,
            "rgba(255, 117, 61, 0.78)",
            nextState.nextExplosionId,
            "impact",
          ),
        ],
        nextExplosionId: nextState.nextExplosionId + 1,
        waveThreatsResolved: nextState.waveThreatsResolved + 1,
        waveStructuresLost:
          nextState.waveStructuresLost + (targetWasAlive ? 1 : 0),
        stats: {
          ...impactStats,
          threatsResolved: impactStats.threatsResolved + 1,
          structuresLost: impactStats.structuresLost + (targetWasAlive ? 1 : 0),
          citiesLost:
            impactStats.citiesLost + (targetWasAlive && targetType === "city" ? 1 : 0),
          basesLost:
            impactStats.basesLost + (targetWasAlive && targetType === "base" ? 1 : 0),
        },
      };
      continue;
    }

    nextThreats.push({
      ...threat,
      x,
      y,
    });
  }

  while (
    spawnTimerMs <= 0 &&
    nextState.waveThreatsSpawned < nextState.waveThreatLimit
  ) {
    const spawned = createThreat(
      nextState.layout,
      nextState.structures,
      nextState.elapsedMs,
      nextState.nextThreatId,
      random.rng,
      nextState.waveConfig,
    );
    spawnTimerMs += nextState.waveConfig.spawnDelayMs;
    if (!spawned) {
      break;
    }
    nextThreats.push(spawned);
    nextState = {
      ...nextState,
      nextThreatId: nextState.nextThreatId + 1,
      waveThreatsSpawned: nextState.waveThreatsSpawned + 1,
    };
  }

  const nextInterceptors = [];
  for (const interceptor of nextState.interceptors) {
    const x = interceptor.x + interceptor.vx * safeDt;
    const y = interceptor.y + interceptor.vy * safeDt;
    const reachedTarget =
      Math.hypot(interceptor.targetX - x, interceptor.targetY - y) <=
      Math.max(10, Math.hypot(interceptor.vx, interceptor.vy) * safeDt);

    if (reachedTarget) {
      nextState = {
        ...nextState,
        explosions: [
          ...nextState.explosions,
          createExplosion(
            interceptor.targetX,
            interceptor.targetY,
            nextState.layout.blastRadius,
            960,
            "rgba(255, 233, 122, 0.82)",
            nextState.nextExplosionId,
            "interceptor",
          ),
        ],
        nextExplosionId: nextState.nextExplosionId + 1,
      };
      continue;
    }

    nextInterceptors.push({
      ...interceptor,
      x,
      y,
    });
  }

  const nextExplosions = [];
  for (const explosion of nextState.explosions) {
    const updated = {
      ...explosion,
      ageMs: explosion.ageMs + dtMs,
    };
    if (updated.ageMs < updated.durationMs) {
      nextExplosions.push(updated);
    }
  }

  let score = nextState.score;
  let threatsStopped = nextState.threatsStopped;
  let waveThreatsStopped = nextState.waveThreatsStopped;
  let waveThreatsResolved = nextState.waveThreatsResolved;
  let statsState = normalizeStats(nextState);
  let nextScoreBursts = nextState.scoreBursts;
  const survivingThreats = [];
  for (const threat of nextThreats) {
    const hitExplosion = nextExplosions.find(
      (explosion) =>
        explosion.id !== threat.lastExplosionId &&
        Math.hypot(threat.x - explosion.x, threat.y - explosion.y) <=
        getMissileCommandExplosionRadius(explosion),
    );
    if (hitExplosion) {
      const hitPoints = Number.isFinite(threat.hitPoints) ? threat.hitPoints : 1;
      if (hitPoints > 1) {
        survivingThreats.push({
          ...threat,
          hitPoints: hitPoints - 1,
          lastExplosionId: hitExplosion.id,
        });
        continue;
      }
      const scoreValue = Math.round(threat.scoreValue ?? MISSILE_COMMAND_THREAT_SCORE);
      score += scoreValue;
      threatsStopped += 1;
      waveThreatsStopped += 1;
      waveThreatsResolved += 1;
      statsState = {
        ...statsState,
        threatsResolved: statsState.threatsResolved + 1,
        specialThreatsStopped:
          statsState.specialThreatsStopped + (threat.type && threat.type !== "standard" ? 1 : 0),
      };
      nextScoreBursts = [
        ...nextScoreBursts,
        createScoreBurst(
          threat.x,
          threat.y,
          scoreValue,
          nextState.nextScoreBurstId,
        ),
      ];
      nextState = {
        ...nextState,
        nextScoreBurstId: nextState.nextScoreBurstId + 1,
      };
      continue;
    }
    survivingThreats.push(threat);
  }

  const aliveStructures = getAliveStructures(nextState.structures);
  const gameOver = aliveStructures.length === 0;
  let finalState = {
    ...nextState,
    threats: survivingThreats,
    interceptors: nextInterceptors,
    explosions: nextExplosions,
    scoreBursts: nextScoreBursts,
    score,
    threatsStopped,
    waveThreatsStopped,
    waveThreatsResolved,
    stats: statsState,
    spawnTimerMs,
    status: gameOver ? "game_over" : "playing",
    outcome: gameOver ? "defeat" : nextState.outcome,
    message: gameOver ? "Defense lost" : "Pinch to fire",
    ...(Number.isFinite(random.getRandomState())
      ? { randomState: random.getRandomState() }
      : {}),
  };
  if (gameOver) {
    return {
      ...finalState,
      result: getMissileCommandResultStats(finalState),
    };
  }
  const waveComplete =
    finalState.waveThreatsSpawned >= finalState.waveThreatLimit &&
    finalState.waveThreatsResolved >= finalState.waveThreatLimit &&
    survivingThreats.length === 0;
  if (waveComplete) {
    finalState = completeMissileCommandWave(finalState);
  }
  return finalState;
}
