import {
  SKY_PATROL_DEPOT_SCORE,
  SKY_PATROL_FIGHTER_SCORE,
  SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS,
  SKY_PATROL_TURRET_SCORE,
} from "./skyPatrolGame.js";

export const SKY_PATROL_LEGEND_FADE_MS = 6500;

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

export function getSkyPatrolTargetHealthPips(entity = {}) {
  const maxHp =
    Number.isFinite(entity.maxHp) && entity.maxHp > 0
      ? entity.maxHp
      : entity.kind === "depot"
      ? 4
      : 2;
  const hp = clamp(Number.isFinite(entity.hp) ? entity.hp : maxHp, 0, maxHp);

  return Array.from({ length: maxHp }, (_, index) => (index < hp ? "filled" : "empty"));
}

export function getSkyPatrolLifeIcons(lives = 0, maxLives = 3) {
  const safeLives = clamp(Number.isFinite(lives) ? lives : 0, 0, maxLives);
  return Array.from({ length: maxLives }, (_, index) => (index < safeLives ? "active" : "lost"));
}

export function getSkyPatrolGameOverUi(hud = {}) {
  if (hud.status !== "gameover") {
    return {
      visible: false,
      title: "",
      stats: [],
      restartText: "",
    };
  }

  return {
    visible: true,
    title: "Squadron down",
    stats: [
      { label: "Score", value: hud.score ?? 0 },
      { label: "Targets", value: hud.targetsDestroyed ?? 0 },
    ],
    restartText: "Hold Restart Sortie",
  };
}

export function getSkyPatrolLegendUi(hud = {}) {
  const elapsedMs = Number.isFinite(hud.elapsedMs) ? hud.elapsedMs : 0;
  const faded =
    typeof hud.legendFaded === "boolean"
      ? hud.legendFaded
      : elapsedMs >= SKY_PATROL_LEGEND_FADE_MS;

  return {
    visible: hud.status !== "gameover",
    compact: true,
    faded,
    items: [
      {
        id: "fighter",
        label: "Fighter",
        value: `+${SKY_PATROL_FIGHTER_SCORE}`,
        role: "air",
      },
      {
        id: "turret",
        label: "Turret",
        value: `+${SKY_PATROL_TURRET_SCORE}`,
        role: "ground",
      },
      {
        id: "depot",
        label: "Depot",
        value: `+${SKY_PATROL_DEPOT_SCORE}`,
        role: "ground",
      },
      {
        id: "fire",
        label: "Pinch",
        value: "Fire",
        role: "control",
      },
    ],
  };
}

export function getSkyPatrolRadarBlips(state = {}) {
  const layout = state.layout ?? {};
  const width = Number.isFinite(layout.width) && layout.width > 0 ? layout.width : 1;
  const height = Number.isFinite(layout.height) && layout.height > 0 ? layout.height : 1;
  const blipSources = [];

  if (state.ship) {
    blipSources.push({
      id: "ship",
      role: "player",
      entity: state.ship,
    });
  }

  for (const enemy of Array.isArray(state.airEnemies) ? state.airEnemies : []) {
    blipSources.push({
      id: enemy.id,
      role: "air",
      entity: enemy,
    });
  }

  for (const target of Array.isArray(state.groundTargets) ? state.groundTargets : []) {
    blipSources.push({
      id: target.id,
      role: "ground",
      entity: target,
    });
  }

  return blipSources.map(({ id, role, entity }) => ({
    id,
    role,
    xPct: Math.round(clamp(((entity.x ?? 0) / width) * 100, 0, 100)),
    yPct: Math.round(clamp(((entity.y ?? 0) / height) * 100, 0, 100)),
  }));
}

export function getSkyPatrolGroundSiteUi(target = {}) {
  if (target.siteTerrain === "runway") {
    return {
      marker: "runway-pad",
      accent: "built",
    };
  }
  if (target.siteTerrain === "road") {
    return {
      marker: "road-pad",
      accent: "built",
    };
  }
  return {
    marker: "field-pad",
    accent: "camo",
  };
}

export function getSkyPatrolDepthCue(entity = {}, layout = {}) {
  const height = Number.isFinite(layout.height) && layout.height > 0 ? layout.height : 1;
  const depth = clamp((entity.y ?? 0) / height, 0, 1);
  const entityHeight = Number.isFinite(entity.height) ? entity.height : 36;
  const isGround = entity.kind === "turret" || entity.kind === "depot";

  if (isGround) {
    return {
      shadowScale: 1.08,
      shadowOpacity: 0.22,
      offsetY: Math.round(entityHeight * 0.22),
    };
  }

  return {
    shadowScale: Number((0.62 + depth * 0.5).toFixed(2)),
    shadowOpacity: Number((0.1 + depth * 0.24).toFixed(2)),
    offsetY: Math.round(entityHeight * (0.28 + depth * 0.34)),
  };
}

export function getSkyPatrolProjectileUi(shot = {}) {
  if (shot.kind === "player") {
    return {
      shape: "player-bolt",
      fill: "#fff2a8",
      core: "#fffef0",
      outline: "#58261c",
    };
  }
  if (shot.kind === "turret") {
    return {
      shape: "turret-shell",
      fill: "#9be9ff",
      core: "#e4fbff",
      outline: "#123646",
    };
  }
  return {
    shape: "fighter-round",
    fill: "#70d6ff",
    core: "#d6f7ff",
    outline: "#123646",
  };
}
