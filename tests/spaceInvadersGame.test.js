import test from "node:test";
import assert from "node:assert/strict";
import {
  SPACE_INVADERS_ENEMY_SCORE,
  createSpaceInvadersGame,
  createSpaceInvadersLayout,
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
});

test("stepSpaceInvadersGame enters game over when an enemy shot hits the ship and restarts on pinch", () => {
  const layout = createSpaceInvadersLayout(960, 720);
  const shipY = layout.shipY;
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
});
