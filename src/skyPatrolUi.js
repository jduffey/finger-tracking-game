import {
  SKY_PATROL_DEPOT_SCORE,
  SKY_PATROL_FIGHTER_SCORE,
  SKY_PATROL_PLAYER_FIRE_COOLDOWN_MS,
  SKY_PATROL_TURRET_SCORE,
} from "./skyPatrolGame.js";

export const SKY_PATROL_LEGEND_FADE_MS = 6500;
export const SKY_PATROL_START_PROMPT_MS = 4500;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function objectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

export function getSkyPatrolHudItems(hud = {}) {
  hud = objectOrEmpty(hud);
  const gunStatus = hud.gunStatus ?? "ready";
  const fireValue =
    gunStatus === "cooldown"
      ? "Cooldown"
      : gunStatus === "recharging"
        ? "Charging"
        : hud.fireReady
          ? "Ready"
          : "Reload";
  if (Number.isFinite(hud.mission)) {
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
        id: "mission",
        label: "Mission",
        value: `${hud.mission}/${hud.totalMissions ?? 1}`,
      },
      {
        id: "goal",
        label: hud.missionName ?? "Goal",
        value: `${hud.missionProgress ?? 0}/${hud.missionGoal ?? "—"}`,
      },
      {
        id: "combo",
        label: "Combo",
        value: `${Math.max(0, hud.comboCount ?? 0)}x`,
      },
      {
        id: "fire",
        label: "Fire",
        value: fireValue,
      },
    ];
  }
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
      value: fireValue,
    },
  ];
}

export function getSkyPatrolFireCooldownUi(hud = {}) {
  hud = objectOrEmpty(hud);
  const gunStatus = hud.gunStatus ?? "ready";
  if (gunStatus === "cooldown" || gunStatus === "recharging") {
    const gunCharge = clamp(Number.isFinite(hud.gunCharge) ? hud.gunCharge : 0, 0, 1);
    return {
      ready: false,
      progress: Number(gunCharge.toFixed(3)),
    };
  }

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

export function getSkyPatrolGunCooldownUi(hud = {}) {
  hud = objectOrEmpty(hud);
  const state =
    hud.gunStatus === "cooldown" || hud.gunStatus === "recharging" ? hud.gunStatus : "ready";
  const fill = Number(clamp(Number.isFinite(hud.gunCharge) ? hud.gunCharge : 1, 0, 1).toFixed(3));
  const cooldownMs = Math.max(0, Number.isFinite(hud.gunCooldownMs) ? hud.gunCooldownMs : 0);

  return {
    fill,
    state,
    stateLabel:
      state === "cooldown" ? "Cooling" : state === "recharging" ? "Recharging" : "Guns ready",
    cooldownLabel: state === "cooldown" ? `${(Math.ceil(cooldownMs / 100) / 10).toFixed(1)}s` : "",
    cooling: state === "cooldown",
  };
}

export function getSkyPatrolIncomingIndicators(state = {}) {
  state = objectOrEmpty(state);
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
  entity = objectOrEmpty(entity);
  if (entity.kind === "ace") {
    return {
      role: "boss",
      shape: "air-boss",
      archetype: "Storm ace",
    };
  }
  if (entity.kind === "bomber") {
    return {
      role: "air",
      shape: "air-heavy",
      archetype: "Bomber",
    };
  }
  if (entity.kind === "interceptor") {
    return {
      role: "air",
      shape: "air-dart",
      archetype: "Interceptor",
    };
  }
  if (entity.kind === "fighter") {
    return {
      role: "air",
      shape: "air-chevron",
      archetype: "Fighter",
    };
  }
  if (entity.kind === "depot") {
    return {
      role: "ground",
      shape: "ground-depot",
      archetype: "Depot",
    };
  }
  return {
    role: "ground",
    shape: "ground-emplacement",
    archetype: "Turret",
  };
}

export function getSkyPatrolMissionUi(state = {}) {
  state = objectOrEmpty(state);
  const missionConfig = objectOrEmpty(state.missionConfig);
  const mission = Math.max(1, state.mission ?? 1);
  const totalMissions = Math.max(mission, state.totalMissions ?? mission);
  const goal = Math.max(0, missionConfig.targetGoal ?? state.missionGoal ?? 0);
  const progress = clamp(state.missionProgress ?? 0, 0, Math.max(goal, 0));

  return {
    mission,
    totalMissions,
    name: missionConfig.name ?? state.missionName ?? `Mission ${mission}`,
    goalText: missionConfig.goalText ?? state.missionGoalText ?? "",
    progress,
    goal,
    progressRatio: goal > 0 ? Number((progress / goal).toFixed(3)) : 0,
    boss: Boolean(missionConfig.boss ?? state.bossMission),
    phase:
      state.status === "checkpoint"
        ? "checkpoint"
        : state.status === "gameover"
          ? state.outcome === "victory"
            ? "complete"
            : "failed"
          : "active",
  };
}

export function getSkyPatrolCheckpointUi(state = {}) {
  state = objectOrEmpty(state);
  if (state.status !== "checkpoint") {
    return {
      visible: false,
      title: "",
      stats: [],
      nextMissionText: "",
    };
  }
  const recap = objectOrEmpty(state.lastMissionRecap);
  return {
    visible: true,
    title: recap.clean ? "Clean checkpoint" : "Checkpoint reached",
    stats: [
      { label: "Mission", value: recap.name ?? `Mission ${state.mission ?? 1}` },
      { label: "Score earned", value: recap.scoreEarned ?? 0 },
      { label: "Accuracy", value: `${recap.accuracy ?? 0}%` },
      { label: "Bonus", value: recap.checkpointBonus ?? 0 },
    ],
    nextMissionText: `Mission ${Math.min(
      state.totalMissions ?? (state.mission ?? 1) + 1,
      (state.mission ?? 1) + 1,
    )} incoming`,
  };
}

export function getSkyPatrolTelegraphUi(telegraph = {}) {
  telegraph = objectOrEmpty(telegraph);
  const durationMs = Math.max(1, telegraph.durationMs ?? 1);
  return {
    id: telegraph.id ?? "",
    label: telegraph.label ?? "Incoming",
    kind: telegraph.kind ?? "fighter",
    x: telegraph.x ?? 0,
    urgency: Number(clamp((telegraph.ageMs ?? 0) / durationMs, 0, 1).toFixed(3)),
    boss: telegraph.kind === "ace",
  };
}

export function getSkyPatrolPowerUpUi(powerUp = {}) {
  powerUp = objectOrEmpty(powerUp);
  const definitions = {
    shield: {
      label: "Shield",
      icon: "shield",
      detail: "Blocks one hit",
      color: "#72ddf7",
    },
    repair: {
      label: "Repair",
      icon: "repair",
      detail: "Restores one life",
      color: "#9ff28c",
    },
    overdrive: {
      label: "Overdrive",
      icon: "overdrive",
      detail: "Faster fire and slower heat",
      color: "#ffd166",
    },
    wingman: {
      label: "Wingman",
      icon: "wingman",
      detail: "Adds a center cannon",
      color: "#d8b4fe",
    },
  };
  const type = definitions[powerUp.type] ? powerUp.type : "wingman";
  return {
    type,
    ...definitions[type],
  };
}

export function getSkyPatrolComboUi(state = {}) {
  state = objectOrEmpty(state);
  const count = Math.max(0, state.comboCount ?? 0);
  return {
    visible: count >= 2,
    count,
    label: count >= 2 ? `${count}x strike chain` : "",
    multiplier: Number((1 + Math.min(Math.max(0, count - 1), 10) * 0.08).toFixed(2)),
    remainingMs: Math.max(0, state.comboExpiresMs ?? 0),
  };
}

export function getSkyPatrolOnboardingUi(state = {}) {
  state = objectOrEmpty(state);
  const startSafetyMs = Math.max(0, state.startSafetyMs ?? 0);
  const mission = getSkyPatrolMissionUi(state);
  return {
    visible: state.status === "playing" && startSafetyMs > 0,
    title: mission.name,
    objective: mission.goalText,
    safetyLabel:
      startSafetyMs > 0
        ? `Threat fire delayed ${(Math.ceil(startSafetyMs / 100) / 10).toFixed(1)}s`
        : "",
    controls: ["Move your hand to strafe", "Pinch to fire"],
  };
}

export function getSkyPatrolTargetHealthPips(entity = {}) {
  entity = objectOrEmpty(entity);
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
  hud = objectOrEmpty(hud);
  if (hud.status !== "gameover") {
    return {
      visible: false,
      title: "",
      stats: [],
      restartText: "",
    };
  }

  const result = hud.result;
  if (result && typeof result === "object") {
    const victory = result.outcome === "victory";
    return {
      visible: true,
      title: victory ? "Patrol complete" : "Squadron down",
      outcome: result.outcome,
      stats: [
        { label: "Score", value: result.score ?? hud.score ?? 0 },
        {
          label: "Missions",
          value: `${result.missionsCleared ?? 0}/${result.totalMissions ?? 0}`,
        },
        { label: "Targets", value: result.targetsDestroyed ?? 0 },
        { label: "Accuracy", value: `${result.accuracy ?? 0}%` },
        { label: "Best combo", value: `${result.bestCombo ?? 0}x` },
        { label: "Power-ups", value: result.powerUpsCollected ?? 0 },
      ],
      restartText: victory ? "Hold Fly Again" : "Hold Restart Sortie",
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
  hud = objectOrEmpty(hud);
  const elapsedMs = Number.isFinite(hud.elapsedMs) ? hud.elapsedMs : 0;
  const faded =
    typeof hud.legendFaded === "boolean"
      ? hud.legendFaded
      : elapsedMs >= SKY_PATROL_LEGEND_FADE_MS;

  const items = [
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
  ];
  if (Number.isFinite(hud.mission)) {
    items.push({
      id: "wingman",
      label: "Overheat",
      value: "Call wingmen",
      role: "control",
    });
  }

  return {
    visible: hud.status !== "gameover",
    compact: true,
    faded,
    items,
  };
}

export function getSkyPatrolRadarBlips(state = {}) {
  state = objectOrEmpty(state);
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
  target = objectOrEmpty(target);
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
  entity = objectOrEmpty(entity);
  layout = objectOrEmpty(layout);
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
  shot = objectOrEmpty(shot);
  if (shot.kind === "player" || shot.kind === "wingman") {
    return {
      shape: "player-bolt",
      fill: "#fff2a8",
      core: "#fffef0",
      outline: "#58261c",
      glow: "rgba(255, 245, 132, 0.78)",
      sprite: "playerBolt",
    };
  }
  if (shot.kind === "turret") {
    return {
      shape: "turret-shell",
      fill: "#9be9ff",
      core: "#e4fbff",
      outline: "#123646",
      glow: "rgba(93, 228, 255, 0.76)",
      sprite: "enemyBomb",
    };
  }
  return {
    shape: "fighter-round",
    fill: "#70d6ff",
    core: "#d6f7ff",
    outline: "#123646",
    glow: "rgba(112, 214, 255, 0.74)",
    sprite: "purpleOrb",
  };
}

export function getSkyPatrolStartPromptUi(hud = {}) {
  hud = objectOrEmpty(hud);
  const elapsedMs = Number.isFinite(hud.elapsedMs) ? hud.elapsedMs : 0;
  const visible =
    hud.status === "playing" &&
    (typeof hud.startPromptVisible === "boolean"
      ? hud.startPromptVisible
      : (hud.startSafetyMs ?? 0) > 0 || elapsedMs < SKY_PATROL_START_PROMPT_MS);

  return {
    visible,
    title: hud.missionName ?? "Sky Patrol",
    detail:
      hud.missionGoalText
        ? `${hud.missionGoalText}. Move to strafe; pinch to fire.`
        : "Move to strafe. Pinch to fire twin cannons.",
  };
}
