import test from "node:test";
import assert from "node:assert/strict";
import {
  SPACE_INVADERS_ENEMY_SCORE,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_UFO_SCORE,
  advanceSpaceInvadersWave,
  createSpaceInvadersGame,
  createSpaceInvadersLayout,
  createSpaceInvadersWave,
  getSpaceInvadersResultStats,
  getSpaceInvadersWaveConfig,
  spawnSpaceInvadersPowerUp,
  spawnSpaceInvadersUfo,
  stepSpaceInvadersGame,
} from "../src/spaceInvadersGame.js";

function constantRng(value) {
  return () => value;
}

test("createSpaceInvadersLayout scales the enemies, ship, and shots up by fifteen percent", () => {
  const layout = createSpaceInvadersLayout(960, 720);

  assert.ok(Math.abs(layout.enemyWidth - 66.24) < 0.001);
  assert.ok(Math.abs(layout.enemyHeight - 33.12) < 0.001);
  assert.ok(Math.abs(layout.shipWidth - 132.48) < 0.001);
  assert.ok(Math.abs(layout.shipHeight - 41.4) < 0.001);
  assert.ok(Math.abs(layout.shotWidth - 11.5) < 0.001);
  assert.ok(Math.abs(layout.shotHeight - 28.98) < 0.001);
});

test("createSpaceInvadersGame centers the ship and spawns a full formation", () => {
  const game = createSpaceInvadersGame(960, 720, constantRng(0.2));
  assert.equal(game.status, "playing");
  assert.equal(game.enemies.filter((enemy) => enemy.alive).length, 32);
  assert.equal(game.ship.x, game.layout.width / 2);
  assert.equal(game.wave, 1);
  assert.equal(game.formation.id, "classic");
  assert.equal(game.lives, SPACE_INVADERS_STARTING_LIVES);
  assert.equal(game.shields.length, 3);
  assert.ok(game.shields.every((shield) => shield.hp === shield.maxHp));
});

test("createSpaceInvadersLayout keeps a narrow-screen formation moving horizontally", () => {
  const layout = createSpaceInvadersLayout(320, 568);
  const state = createSpaceInvadersGame(320, 568, constantRng(0.2));
  const highestEnemyY = Math.min(...state.enemies.map((enemy) => enemy.y));
  const leftmostEnemyX = Math.min(...state.enemies.map((enemy) => enemy.x));

  assert.ok(layout.formationWidth < layout.width - 2 * layout.sidePadding);

  const next = stepSpaceInvadersGame(state, 4 / 90, state.ship.x, false, constantRng(0.2));

  assert.equal(
    Math.min(...next.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.y)),
    highestEnemyY,
  );
  assert.ok(
    Math.min(...next.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.x)) > leftmostEnemyX,
  );
});

test("createSpaceInvadersLayout gives short screens enough descent headroom to stay winnable", () => {
  const state = createSpaceInvadersGame(320, 240, constantRng(0.2));
  const layout = state.layout;
  const initialFormationBottom = Math.max(...state.enemies.map((enemy) => enemy.y + enemy.height));

  assert.ok(layout.dangerLineY > initialFormationBottom + layout.descendStep * 4);
  assert.equal(layout.shieldsEnabled, false);
  assert.equal(state.shields.length, 0);

  let current = state;
  for (let descent = 0; descent < 4; descent += 1) {
    const rightmostEnemy = Math.max(...current.enemies.map((enemy) => enemy.x + enemy.width));
    const nudged = {
      ...current,
      enemyDirection: 1,
      enemies: current.enemies.map((enemy) => ({
        ...enemy,
        x: enemy.x + (layout.width - layout.sidePadding - rightmostEnemy) - 1,
      })),
    };

    current = stepSpaceInvadersGame(nudged, 0.05, nudged.ship.x, false, constantRng(0.2));
    assert.equal(current.status, "playing");
  }

  const rightmostEnemy = Math.max(...current.enemies.map((enemy) => enemy.x + enemy.width));
  const finalNudged = {
    ...current,
    enemyDirection: 1,
    enemies: current.enemies.map((enemy) => ({
      ...enemy,
      x: enemy.x + (layout.width - layout.sidePadding - rightmostEnemy) - 1,
    })),
  };
  const landed = stepSpaceInvadersGame(finalNudged, 0.05, finalNudged.ship.x, false, constantRng(0.2));
  assert.equal(landed.status, "gameover");
});

test("stepSpaceInvadersGame reverses direction and descends at the edge", () => {
  const layout = createSpaceInvadersLayout(960, 720);
  const state = createSpaceInvadersGame(960, 720, constantRng(0.2));
  const highestEnemyY = Math.min(...state.enemies.map((enemy) => enemy.y));
  const rightmostEnemy = Math.max(...state.enemies.map((enemy) => enemy.x + enemy.width));
  const nudged = {
    ...state,
    enemyDirection: 1,
    enemies: state.enemies.map((enemy) => ({
      ...enemy,
      x: enemy.x + (layout.width - layout.sidePadding - rightmostEnemy) - 1,
    })),
  };

  const next = stepSpaceInvadersGame(nudged, 0.05, nudged.ship.x, false, constantRng(0.2));
  assert.equal(next.enemyDirection, -1);
  assert.equal(
    Math.min(...next.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.y)),
    highestEnemyY + layout.descendStep,
  );
});

test("stepSpaceInvadersGame rate limits player shots while pinch is held", () => {
  const initial = createSpaceInvadersGame(960, 720, constantRng(0.2));
  const first = stepSpaceInvadersGame(initial, 0.016, initial.ship.x, true, constantRng(0.2));
  const second = stepSpaceInvadersGame(first, 0.016, first.ship.x, true, constantRng(0.2));
  const afterCooldown = stepSpaceInvadersGame(second, 0.3, second.ship.x, true, constantRng(0.2));

  assert.equal(first.playerShots.length, 1);
  assert.equal(second.playerShots.length, 1);
  assert.equal(afterCooldown.playerShots.length, 2);
});

test("stepSpaceInvadersGame awards score when a player shot destroys an enemy", () => {
  const layout = createSpaceInvadersLayout(960, 720);
  const state = {
    ...createSpaceInvadersGame(960, 720, constantRng(0.2)),
    enemies: [
      {
        id: "enemy-1",
        row: 0,
        column: 0,
        x: 300,
        y: 150,
        width: layout.enemyWidth,
        height: layout.enemyHeight,
        alive: true,
      },
    ],
    playerShots: [
      {
        id: "player-shot-1",
        x: 300 + layout.enemyWidth / 2 - layout.shotWidth / 2,
        y: 150 + layout.enemyHeight + 2,
        width: layout.shotWidth,
        height: layout.shotHeight,
        vy: -layout.playerShotSpeed,
      },
    ],
    enemyShots: [],
  };

  const next = stepSpaceInvadersGame(state, 0.016, state.ship.x, false, constantRng(0.2));
  assert.equal(next.score, SPACE_INVADERS_ENEMY_SCORE);
  assert.equal(next.status, "cleared");
  assert.deepEqual(next.interWave, {
    nextWave: 2,
    remainingMs: 1500,
  });
  assert.equal(next.stats.enemiesDestroyed, 1);
  assert.equal(next.stats.wavesCleared, 1);
});

test("stepSpaceInvadersGame enters game over when an enemy shot hits the ship and restarts on pinch", () => {
  const layout = createSpaceInvadersLayout(960, 720);
  const shipY = layout.shipY;
  const state = {
    ...createSpaceInvadersGame(960, 720, constantRng(0.2)),
    lives: 1,
    enemies: [
      {
        id: "enemy-1",
        row: 0,
        column: 0,
        x: 300,
        y: 150,
        width: layout.enemyWidth,
        height: layout.enemyHeight,
        alive: true,
      },
    ],
    enemyShots: [
      {
        id: "enemy-shot-1",
        x: layout.width / 2 - layout.shotWidth / 2,
        y: shipY - layout.shipHeight / 2,
        width: layout.shotWidth,
        height: layout.shotHeight,
        vy: layout.enemyShotSpeed,
      },
    ],
  };

  const gameOver = stepSpaceInvadersGame(state, 0.016, state.ship.x, false, constantRng(0.2));
  assert.equal(gameOver.status, "gameover");

  const restarted = stepSpaceInvadersGame(gameOver, 1, gameOver.ship.x, true, constantRng(0.2));
  assert.equal(restarted.status, "playing");
  assert.equal(restarted.enemies.filter((enemy) => enemy.alive).length, 32);
  assert.equal(restarted.score, gameOver.score);
  assert.equal(restarted.lives, SPACE_INVADERS_STARTING_LIVES);
});

test("waves rotate through deterministic formations and increase pressure", () => {
  const layout = createSpaceInvadersLayout(960, 720);
  const first = createSpaceInvadersWave(layout, 1);
  const second = createSpaceInvadersWave(layout, 2);
  const repeatedSecond = createSpaceInvadersWave(layout, 2);
  const lateConfig = getSpaceInvadersWaveConfig(8);

  assert.equal(first.formation.id, "classic");
  assert.equal(second.formation.id, "staggered");
  assert.equal(first.enemies.length, 32);
  assert.deepEqual(second, repeatedSecond);
  assert.notDeepEqual(
    first.enemies.map(({ x, y }) => ({ x, y })),
    second.enemies.map(({ x, y }) => ({ x, y })),
  );
  assert.ok(lateConfig.enemySpeedMultiplier > first.config.enemySpeedMultiplier);
  assert.ok(lateConfig.enemyFireIntervalMs < first.config.enemyFireIntervalMs);
  assert.equal(lateConfig.enemyBurstSize, 3);
});

test("enemy fire becomes a deterministic multi-column burst on later waves", () => {
  const game = createSpaceInvadersGame(960, 720, constantRng(0.2), { wave: 4 });
  const readyToFire = {
    ...game,
    enemyFireCooldownMs: 0,
  };
  const next = stepSpaceInvadersGame(
    readyToFire,
    0.016,
    readyToFire.ship.x,
    false,
    constantRng(0.2),
  );

  assert.equal(next.enemyShots.length, 2);
  assert.equal(new Set(next.enemyShots.map((shot) => shot.x)).size, 2);
  assert.equal(next.stats.enemyShotsFired, 2);
});

test("shields absorb enemy fire and visibly lose integrity", () => {
  const game = createSpaceInvadersGame(960, 720, constantRng(0.2));
  const shield = game.shields[0];
  const state = {
    ...game,
    enemyShots: [
      {
        id: "enemy-shot-shield",
        x: shield.x + shield.width / 2 - game.layout.shotWidth / 2,
        y: shield.y,
        width: game.layout.shotWidth,
        height: game.layout.shotHeight,
        vy: game.layout.enemyShotSpeed,
      },
    ],
  };
  const next = stepSpaceInvadersGame(state, 1 / 120, state.ship.x, false, constantRng(0.2));

  assert.equal(next.enemyShots.length, 0);
  assert.equal(next.shields[0].hp, shield.hp - 1);
  assert.equal(next.lives, SPACE_INVADERS_STARTING_LIVES);
});

test("ship hits consume lives, add recovery invulnerability, and eventually end the run", () => {
  const game = createSpaceInvadersGame(960, 720, constantRng(0.2));
  const createHit = (state, id) => ({
    ...state,
    shipInvulnerableMs: 0,
    enemyShots: [
      {
        id,
        x: state.ship.x - state.layout.shotWidth / 2,
        y: state.ship.y - state.ship.height / 2,
        width: state.layout.shotWidth,
        height: state.layout.shotHeight,
        vy: state.layout.enemyShotSpeed,
      },
    ],
  });

  const firstHit = stepSpaceInvadersGame(
    createHit(game, "enemy-shot-1"),
    0.016,
    game.ship.x,
    false,
    constantRng(0.2),
  );
  assert.equal(firstHit.status, "playing");
  assert.equal(firstHit.lives, 2);
  assert.ok(firstHit.shipInvulnerableMs > 0);
  assert.equal(firstHit.stats.livesLost, 1);

  const secondHit = stepSpaceInvadersGame(
    createHit(firstHit, "enemy-shot-2"),
    0.016,
    firstHit.ship.x,
    false,
    constantRng(0.2),
  );
  assert.equal(secondHit.status, "playing");
  assert.equal(secondHit.lives, 1);

  const finalHit = stepSpaceInvadersGame(
    createHit(secondHit, "enemy-shot-3"),
    0.016,
    secondHit.ship.x,
    false,
    constantRng(0.2),
  );
  assert.equal(finalHit.status, "gameover");
  assert.equal(finalHit.lives, 0);
  assert.equal(finalHit.result.livesLost, 3);
  assert.equal(getSpaceInvadersResultStats(finalHit).bestWave, 1);
});

test("cleared waves enter an intermission and advance without losing run state", () => {
  const game = createSpaceInvadersGame(960, 720, constantRng(0.2));
  const cleared = {
    ...game,
    score: 1000,
    lives: 2,
    status: "cleared",
    restartCooldownMs: 700,
    interWave: {
      nextWave: 2,
      remainingMs: 1500,
    },
    stats: {
      ...game.stats,
      wavesCleared: 1,
    },
  };

  const waiting = stepSpaceInvadersGame(
    cleared,
    0.5,
    cleared.ship.x,
    false,
    constantRng(0.2),
  );
  assert.equal(waiting.status, "cleared");
  assert.equal(waiting.interWave.remainingMs, 1000);

  const advanced = stepSpaceInvadersGame(
    waiting,
    1,
    waiting.ship.x,
    false,
    constantRng(0.2),
  );
  assert.equal(advanced.status, "playing");
  assert.equal(advanced.wave, 2);
  assert.equal(advanced.formation.id, "staggered");
  assert.equal(advanced.score, 1000);
  assert.equal(advanced.lives, 2);
  assert.equal(advanced.stats.wavesCleared, 1);
  assert.equal(advanced.enemies.filter((enemy) => enemy.alive).length, 32);

  const explicitAdvance = advanceSpaceInvadersWave(
    {
      ...advanced,
      interWave: { nextWave: 3, remainingMs: 0 },
    },
    constantRng(0.2),
  );
  assert.equal(explicitAdvance.wave, 3);
  assert.equal(explicitAdvance.formation.id, "pinch");
});

test("shooting a UFO awards bonus score and drops a deterministic power-up", () => {
  const game = spawnSpaceInvadersUfo(
    createSpaceInvadersGame(960, 720, constantRng(0.2)),
    1,
  );
  const ufo = {
    ...game.ufo,
    x: 300,
    y: 100,
  };
  const state = {
    ...game,
    ufo,
    playerShots: [
      {
        id: "player-shot-ufo",
        x: ufo.x + ufo.width / 2 - game.layout.shotWidth / 2,
        y: ufo.y + ufo.height / 2,
        width: game.layout.shotWidth,
        height: game.layout.shotHeight,
        vy: -game.layout.playerShotSpeed,
      },
    ],
  };
  const next = stepSpaceInvadersGame(state, 1 / 120, state.ship.x, false, constantRng(0.2));

  assert.equal(next.ufo, null);
  assert.equal(next.score, SPACE_INVADERS_UFO_SCORE);
  assert.equal(next.stats.ufoHits, 1);
  assert.equal(next.powerUps.length, 1);
  assert.equal(next.powerUps[0].type, "rapid-fire");
});

test("power-ups can enable rapid fire or repair damaged shields", () => {
  const game = createSpaceInvadersGame(960, 720, constantRng(0.2));
  const rapidDrop = spawnSpaceInvadersPowerUp(
    game,
    "rapid-fire",
    game.ship.x,
    game.ship.y - game.layout.powerUpSize / 2,
  );
  const powered = stepSpaceInvadersGame(
    rapidDrop,
    1 / 120,
    rapidDrop.ship.x,
    false,
    constantRng(0.2),
  );
  assert.equal(powered.activePowerUp.type, "rapid-fire");
  assert.equal(powered.stats.powerUpsCollected, 1);

  const firstShot = stepSpaceInvadersGame(
    powered,
    0.016,
    powered.ship.x,
    true,
    constantRng(0.2),
  );
  const rapidSecondShot = stepSpaceInvadersGame(
    firstShot,
    0.12,
    firstShot.ship.x,
    true,
    constantRng(0.2),
  );
  assert.equal(rapidSecondShot.playerShots.length, 2);

  const damaged = {
    ...powered,
    activePowerUp: null,
    shields: powered.shields.map((shield) => ({ ...shield, hp: 1 })),
  };
  const repairDrop = spawnSpaceInvadersPowerUp(
    damaged,
    "shield-repair",
    damaged.ship.x,
    damaged.ship.y - damaged.layout.powerUpSize / 2,
  );
  const repaired = stepSpaceInvadersGame(
    repairDrop,
    1 / 120,
    repairDrop.ship.x,
    false,
    constantRng(0.2),
  );
  assert.ok(repaired.shields.every((shield) => shield.hp === 3));
  assert.equal(repaired.stats.powerUpsCollected, 2);
});
