import test from "node:test";
import assert from "node:assert/strict";
import {
  MISSILE_COMMAND_CITY_BONUS,
  MISSILE_COMMAND_COUNTDOWN_MS,
  MISSILE_COMMAND_INTERCEPT_ENERGY_COST,
  MISSILE_COMMAND_MAX_AMMO,
  MISSILE_COMMAND_MAX_ENERGY,
  MISSILE_COMMAND_PERFECT_WAVE_BONUS,
  MISSILE_COMMAND_THREAT_SCORE,
  MISSILE_COMMAND_WAVE_COUNT,
  createMissileCommandDailyGame,
  createMissileCommandGame,
  createMissileCommandLayout,
  getMissileCommandDailyPattern,
  getMissileCommandMedals,
  getMissileCommandResultStats,
  getMissileCommandSpawnDelayMs,
  getMissileCommandWaveConfig,
  launchMissileCommandInterceptor,
  stepMissileCommandGame,
} from "../src/missileCommandGame.js";

function constantRng(value) {
  return () => value;
}

test("createMissileCommandGame starts in countdown with protected structures", () => {
  const game = createMissileCommandGame(960, 720);
  assert.equal(game.status, "countdown");
  assert.equal(game.countdownMs, MISSILE_COMMAND_COUNTDOWN_MS);
  assert.equal(game.structures.filter((structure) => structure.alive).length, 5);
  assert.equal(game.wave, 1);
  assert.equal(game.totalWaves, MISSILE_COMMAND_WAVE_COUNT);
  assert.equal(game.ammo, MISSILE_COMMAND_MAX_AMMO);
  assert.equal(game.energy, MISSILE_COMMAND_MAX_ENERGY);
});

test("createMissileCommandLayout reserves HUD-safe vertical play space", () => {
  const layout = createMissileCommandLayout(960, 720);

  assert.ok(layout.hudTopInset > 0);
  assert.ok(layout.playTopY >= layout.hudTopInset);
  assert.ok(layout.playBottomY <= layout.groundY);
});

test("createMissileCommandLayout makes defensive missiles 50 percent faster", () => {
  const layout = createMissileCommandLayout(960, 720);

  assert.ok(Math.abs(layout.interceptorSpeed - 885.6) < 0.001);
});

test("launchMissileCommandInterceptor adds a shot during active play", () => {
  const initial = createMissileCommandGame(960, 720);
  const playing = {
    ...initial,
    status: "playing",
    countdownMs: 0,
  };

  const next = launchMissileCommandInterceptor(playing, 420, 180);
  assert.equal(next.interceptors.length, 1);
  assert.ok(next.cooldownMs > 0);
  assert.equal(next.interceptors[0].targetX, 420);
  assert.equal(next.interceptors[0].targetY, 180);
  assert.ok(
    Math.abs(Math.hypot(next.interceptors[0].vx, next.interceptors[0].vy) - next.layout.interceptorSpeed) <
      0.001,
  );
  assert.equal(next.ammo, MISSILE_COMMAND_MAX_AMMO - 1);
  assert.equal(
    next.energy,
    MISSILE_COMMAND_MAX_ENERGY - MISSILE_COMMAND_INTERCEPT_ENERGY_COST,
  );
  assert.equal(next.stats.shotsFired, 1);
});

test("launchMissileCommandInterceptor clamps launch targets to the playfield", () => {
  const initial = createMissileCommandGame(960, 720);
  const playing = {
    ...initial,
    status: "playing",
    countdownMs: 0,
  };

  const next = launchMissileCommandInterceptor(playing, -120, 900);
  assert.equal(next.interceptors.length, 1);
  assert.equal(next.interceptors[0].targetX, 0);
  assert.equal(next.interceptors[0].targetY, playing.layout.height);
});

test("launchMissileCommandInterceptor does not fire once all bases are destroyed", () => {
  const initial = createMissileCommandGame(960, 720);
  const playing = {
    ...initial,
    status: "playing",
    countdownMs: 0,
    structures: initial.structures.map((structure) =>
      structure.type === "base" ? { ...structure, alive: false } : structure,
    ),
  };

  const next = launchMissileCommandInterceptor(playing, 420, 180);
  assert.equal(next, playing);
});

test("stepMissileCommandGame awards score when an explosion catches a threat", () => {
  const initial = createMissileCommandGame(960, 720);
  const next = stepMissileCommandGame(
    {
      ...initial,
      status: "playing",
      countdownMs: 0,
      spawnTimerMs: 10_000,
      threats: [
        {
          id: "threat-1",
          x: 320,
          y: 180,
          startX: 320,
          startY: 0,
          targetX: 320,
          targetY: 620,
          targetStructureId: initial.structures[0].id,
          vx: 0,
          vy: 120,
        },
      ],
      explosions: [
        {
          id: "explosion-1",
          x: 320,
          y: 180,
          ageMs: 300,
          durationMs: 900,
          maxRadius: 90,
        },
      ],
    },
    1 / 60,
    constantRng(0.5),
  );

  assert.equal(next.threats.length, 0);
  assert.equal(next.score, MISSILE_COMMAND_THREAT_SCORE);
  assert.equal(next.threatsStopped, 1);
  assert.equal(next.scoreBursts.length, 1);
  assert.equal(next.scoreBursts[0].value, MISSILE_COMMAND_THREAT_SCORE);
  assert.equal(next.scoreBursts[0].x, 320);
});

test("stepMissileCommandGame ends the round when the last structure is destroyed", () => {
  const initial = createMissileCommandGame(960, 720);
  const doomedStructure = { ...initial.structures[0], alive: true };
  const next = stepMissileCommandGame(
    {
      ...initial,
      status: "playing",
      countdownMs: 0,
      spawnTimerMs: 10_000,
      structures: [{ ...doomedStructure }],
      threats: [
        {
          id: "threat-1",
          x: doomedStructure.x,
          y: doomedStructure.y - doomedStructure.height * 0.48 - 2,
          startX: doomedStructure.x,
          startY: 0,
          targetX: doomedStructure.x,
          targetY: doomedStructure.y - doomedStructure.height * 0.48,
          targetStructureId: doomedStructure.id,
          vx: 0,
          vy: 120,
        },
      ],
    },
    1 / 30,
    constantRng(0.5),
  );

  assert.equal(next.status, "game_over");
  assert.equal(next.structures[0].alive, false);
});

test("getMissileCommandSpawnDelayMs ramps faster over time", () => {
  assert.ok(getMissileCommandSpawnDelayMs(60_000) < getMissileCommandSpawnDelayMs(0));
  assert.ok(getMissileCommandSpawnDelayMs(120_000) <= getMissileCommandSpawnDelayMs(60_000));
});

test("stepMissileCommandGame spawns threats below the top HUD-safe band", () => {
  const initial = createMissileCommandGame(960, 720);
  const next = stepMissileCommandGame(
    {
      ...initial,
      status: "playing",
      countdownMs: 0,
      spawnTimerMs: 0,
    },
    1 / 60,
    constantRng(0.5),
  );

  assert.equal(next.threats.length, 1);
  assert.ok(next.threats[0].startY >= next.layout.playTopY);
});

test("fire control blocks empty ammo and low energy while energy regenerates", () => {
  const playing = {
    ...createMissileCommandGame(960, 720),
    status: "playing",
    countdownMs: 0,
    ammo: 0,
  };
  const outOfAmmo = launchMissileCommandInterceptor(playing, 420, 180);
  assert.equal(outOfAmmo.interceptors.length, 0);
  assert.equal(outOfAmmo.message, "Out of ammo — hold the line");

  const lowEnergy = launchMissileCommandInterceptor(
    {
      ...playing,
      ammo: 2,
      energy: MISSILE_COMMAND_INTERCEPT_ENERGY_COST - 1,
    },
    420,
    180,
  );
  assert.equal(lowEnergy.interceptors.length, 0);
  assert.equal(lowEnergy.message, "Energy recharging");

  const recharged = stepMissileCommandGame(
    {
      ...lowEnergy,
      spawnTimerMs: 10_000,
    },
    0.05,
    constantRng(0.5),
  );
  assert.ok(recharged.energy > lowEnergy.energy);
});

test("daily patterns use a stable UTC seed and replay the same threat sequence", () => {
  const firstDate = new Date("2026-07-28T23:30:00-04:00");
  const sameUtcDate = new Date("2026-07-29T12:00:00Z");
  const nextDate = new Date("2026-07-30T00:00:00Z");
  assert.deepEqual(
    getMissileCommandDailyPattern(firstDate),
    getMissileCommandDailyPattern(sameUtcDate),
  );
  assert.notEqual(
    getMissileCommandDailyPattern(firstDate).seed,
    getMissileCommandDailyPattern(nextDate).seed,
  );

  const prepare = (game) => ({
    ...game,
    status: "playing",
    countdownMs: 0,
    spawnTimerMs: 0,
  });
  const first = stepMissileCommandGame(
    prepare(createMissileCommandDailyGame(960, 720, { date: firstDate })),
    1 / 60,
  );
  const second = stepMissileCommandGame(
    prepare(createMissileCommandDailyGame(960, 720, { date: sameUtcDate })),
    1 / 60,
  );
  assert.deepEqual(first.threats[0], second.threats[0]);
  assert.equal(first.randomState, second.randomState);
});

test("wave configs are finite and introduce deterministic special threats", () => {
  const opening = getMissileCommandWaveConfig(1);
  const later = getMissileCommandWaveConfig(4);
  assert.ok(Number.isInteger(opening.threatCount));
  assert.ok(opening.threatCount > 0);
  assert.ok(later.speedMultiplier > opening.speedMultiplier);
  assert.ok(later.specialChance > opening.specialChance);

  const game = createMissileCommandGame(960, 720);
  const waveThree = getMissileCommandWaveConfig(3);
  const spawned = stepMissileCommandGame(
    {
      ...game,
      status: "playing",
      countdownMs: 0,
      wave: 3,
      waveConfig: waveThree,
      waveThreatLimit: waveThree.threatCount,
      spawnTimerMs: 0,
    },
    1 / 60,
    constantRng(0),
  );
  assert.equal(spawned.threats[0].type, "armored");
  assert.equal(spawned.threats[0].hitPoints, 2);
  assert.equal(spawned.threats[0].scoreValue, MISSILE_COMMAND_THREAT_SCORE * 2);
});

test("armored threats require distinct blast hits and award special-threat score", () => {
  const game = createMissileCommandGame(960, 720);
  const armored = {
    id: "threat-armored",
    type: "armored",
    hitPoints: 2,
    maxHitPoints: 2,
    scoreValue: MISSILE_COMMAND_THREAT_SCORE * 2,
    lastExplosionId: null,
    x: 320,
    y: 180,
    startX: 320,
    startY: 0,
    targetX: 320,
    targetY: 620,
    targetStructureId: game.structures[0].id,
    vx: 0,
    vy: 0,
  };
  const blast = {
    id: "explosion-1",
    x: 320,
    y: 180,
    ageMs: 300,
    durationMs: 900,
    maxRadius: 90,
  };
  const state = {
    ...game,
    status: "playing",
    countdownMs: 0,
    spawnTimerMs: 10_000,
    threats: [armored],
    explosions: [blast],
  };
  const firstHit = stepMissileCommandGame(state, 1 / 60, constantRng(0.5));
  assert.equal(firstHit.threats[0].hitPoints, 1);
  assert.equal(firstHit.score, 0);

  const sameBlast = stepMissileCommandGame(firstHit, 1 / 60, constantRng(0.5));
  assert.equal(sameBlast.threats.length, 1);
  assert.equal(sameBlast.score, 0);

  const destroyed = stepMissileCommandGame(
    {
      ...sameBlast,
      explosions: [
        ...sameBlast.explosions,
        {
          ...blast,
          id: "explosion-2",
        },
      ],
    },
    1 / 60,
    constantRng(0.5),
  );
  assert.equal(destroyed.threats.length, 0);
  assert.equal(destroyed.score, MISSILE_COMMAND_THREAT_SCORE * 2);
  assert.equal(destroyed.stats.specialThreatsStopped, 1);
});

test("clearing a wave awards surviving-city and perfect-defense bonuses then rests", () => {
  const game = createMissileCommandGame(960, 720);
  const state = {
    ...game,
    status: "playing",
    countdownMs: 0,
    spawnTimerMs: 10_000,
    waveThreatLimit: 0,
    waveThreatsSpawned: 0,
    waveThreatsResolved: 0,
  };
  const cleared = stepMissileCommandGame(state, 1 / 60, constantRng(0.5));
  assert.equal(cleared.status, "intermission");
  assert.equal(
    cleared.score,
    3 * MISSILE_COMMAND_CITY_BONUS + MISSILE_COMMAND_PERFECT_WAVE_BONUS,
  );
  assert.equal(cleared.lastWaveRecap.perfect, true);
  assert.equal(cleared.stats.wavesCleared, 1);
  assert.equal(cleared.stats.perfectWaves, 1);

  const advanced = stepMissileCommandGame(
    {
      ...cleared,
      intermissionMs: 20,
    },
    0.05,
    constantRng(0.5),
  );
  assert.equal(advanced.status, "playing");
  assert.equal(advanced.wave, 2);
  assert.equal(advanced.waveThreatsSpawned, 0);
  assert.equal(advanced.lastWaveRecap.wave, 1);
});

test("the final perfect wave produces a structured victory and gold medal", () => {
  const game = createMissileCommandGame(960, 720);
  const finalWave = getMissileCommandWaveConfig(MISSILE_COMMAND_WAVE_COUNT);
  const state = {
    ...game,
    status: "playing",
    countdownMs: 0,
    wave: MISSILE_COMMAND_WAVE_COUNT,
    waveConfig: finalWave,
    waveThreatLimit: 0,
    waveThreatsSpawned: 0,
    waveThreatsResolved: 0,
    spawnTimerMs: 10_000,
    stats: {
      ...game.stats,
      wavesCleared: MISSILE_COMMAND_WAVE_COUNT - 1,
      perfectWaves: MISSILE_COMMAND_WAVE_COUNT - 1,
    },
  };
  const victory = stepMissileCommandGame(state, 1 / 60, constantRng(0.5));
  const result = getMissileCommandResultStats(victory);

  assert.equal(victory.status, "game_over");
  assert.equal(victory.outcome, "victory");
  assert.equal(result.wavesCleared, MISSILE_COMMAND_WAVE_COUNT);
  assert.equal(result.citiesSurviving, 3);
  assert.deepEqual(
    getMissileCommandMedals(victory).map((medal) => medal.id),
    ["perfect-wave", "city-guardian", "perfect-defense"],
  );
});
