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

export function getSkyPatrolIncomingIndicators(state = {}) {
  const layout = state.layout ?? {};
  const width = Number.isFinite(layout.width) ? layout.width : 0;
  const topThreshold = Math.max(36, (layout.height ?? 0) * 0.08);
  const entities = [
    ...(Array.isArray(state.airEnemies) ? state.airEnemies : []),
    ...(Array.isArray(state.groundTargets) ? state.groundTargets : []),
  ];

  return entities
    .filter((entity) => entity.y + (entity.height ?? 0) / 2 < topThreshold)
    .map((entity) => ({
      id: entity.id,
      kind: entity.kind,
      edge: "top",
      x: Math.round(clamp(entity.x ?? 0, 18, Math.max(18, width - 18))),
    }));
}

export function getSkyPatrolThreatUi(entity = {}) {
  if (entity.kind === "fighter") {
    return {
      role: "air",
      shape: "air-chevron",
    };
  }
  if (entity.kind === "depot") {
    return {
      role: "ground",
      shape: "ground-depot",
    };
  }
  return {
    role: "ground",
    shape: "ground-emplacement",
  };
}
