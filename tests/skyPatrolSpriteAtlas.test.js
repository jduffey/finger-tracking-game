import test from "node:test";
import assert from "node:assert/strict";

import {
  SKY_PATROL_ENEMY_SPRITE_KEYS,
  SKY_PATROL_EXPLOSION_SPRITE_KEYS,
  SKY_PATROL_PLAYER_SPRITE_KEYS,
  SKY_PATROL_SPRITES,
} from "../src/skyPatrolSpriteAtlas.js";

test("Sky Patrol extracted atlas includes non-terrain gameplay sprites", () => {
  for (const key of [
    ...SKY_PATROL_PLAYER_SPRITE_KEYS,
    ...SKY_PATROL_ENEMY_SPRITE_KEYS,
    ...SKY_PATROL_EXPLOSION_SPRITE_KEYS,
    "playerBolt",
    "enemyBomb",
    "rocket",
    "cloudLarge",
    "powerShield",
  ]) {
    assert.ok(SKY_PATROL_SPRITES[key], `expected sprite ${key}`);
    assert.ok(SKY_PATROL_SPRITES[key].w > 0);
    assert.ok(SKY_PATROL_SPRITES[key].h > 0);
  }
});

test("Sky Patrol extracted atlas metadata excludes terrain sprite names", () => {
  const spriteNames = Object.keys(SKY_PATROL_SPRITES).join(" ");

  assert.doesNotMatch(spriteNames, /water|island|runway|terrain|beach/i);
});
