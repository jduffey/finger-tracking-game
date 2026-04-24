import { SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS } from "./skyPatrolGame.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getSkyPatrolHudItems(hud = {}) {
  return [
    {
      id: "score",
      label: "Score",
      value: hud.score ?? 0,
    },
    {
      id: "lives",
      label: "Lives",
      value: hud.lives ?? 0,
    },
    {
      id: "air",
      label: "Air",
      value: hud.airTargetCount ?? 0,
    },
    {
      id: "ground",
      label: "Ground",
      value: hud.groundTargetCount ?? 0,
    },
    {
      id: "fire",
      label: "Fire",
      value: hud.fireReady ? "Ready" : "Reload",
    },
  ];
}

export function getSkyPatrolFireCooldownUi(hud = {}) {
  const cooldownMs = clamp(
    Number.isFinite(hud.fireCooldownMs) ? hud.fireCooldownMs : 0,
    0,
    SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS,
  );

  return {
    ready: cooldownMs <= 0,
    progress: Number((1 - cooldownMs / SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS).toFixed(3)),
  };
}
