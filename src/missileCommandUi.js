import {
  MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS,
  MISSILE_COMMAND_INTERCEPT_ENERGY_COST,
  MISSILE_COMMAND_MAX_AMMO,
  MISSILE_COMMAND_MAX_ENERGY,
} from "./missileCommandGame.js";

export function getMissileCommandSceneClassName() {
  return "fullscreen-camera-missile-command retro-defense";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAliveBases(structures) {
  return (Array.isArray(structures) ? structures : []).filter(
    (structure) => structure?.alive && structure.type === "base",
  );
}

function getFallbackAimPoint(state) {
  if (!state?.layout) {
    return null;
  }
  return {
    x: state.layout.width / 2,
    y: Math.max(42, state.layout.groundY * 0.42),
  };
}

export function getMissileCommandLaunchPreview(state, aimPoint) {
  if (
    !state?.layout ||
    state.status !== "playing" ||
    !aimPoint ||
    !Number.isFinite(aimPoint.x) ||
    !Number.isFinite(aimPoint.y)
  ) {
    return null;
  }

  const targetX = clamp(aimPoint.x, 0, state.layout.width);
  const targetY = clamp(aimPoint.y, 0, state.layout.height);
  const origin = getAliveBases(state.structures).reduce((closest, candidate) => {
    if (!closest) {
      return candidate;
    }
    return Math.abs(candidate.x - targetX) < Math.abs(closest.x - targetX)
      ? candidate
      : closest;
  }, null);

  if (!origin) {
    return null;
  }

  const originX = origin.x;
  const originY = origin.y - origin.height * 0.7;
  const dx = targetX - originX;
  const dy = targetY - originY;

  return {
    originStructureId: origin.id,
    originX,
    originY,
    targetX,
    targetY,
    distance: Math.hypot(dx, dy),
    angleRad: Math.atan2(dy, dx),
  };
}

export function getMissileCommandCooldownUi(state) {
  const cooldownMs = clamp(
    Number.isFinite(state?.cooldownMs) ? state.cooldownMs : 0,
    0,
    MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS,
  );
  const reloadProgress =
    MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS <= 0
      ? 1
      : 1 - cooldownMs / MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS;

  return {
    isCoolingDown: cooldownMs > 0,
    reloadProgress: Number(reloadProgress.toFixed(3)),
  };
}

export function getMissileCommandCrosshairUi(state, aimPoint, handDetected) {
  if (!state?.layout) {
    return {
      state: "hidden",
      className: "fullscreen-camera-missile-crosshair hidden",
      point: null,
      label: "",
    };
  }

  const point =
    aimPoint && Number.isFinite(aimPoint.x) && Number.isFinite(aimPoint.y)
      ? aimPoint
      : getFallbackAimPoint(state);
  const hasBases = getAliveBases(state.structures).length > 0;
  const cooldown = getMissileCommandCooldownUi(state);
  const ammo = state.ammo ?? MISSILE_COMMAND_MAX_AMMO;
  const energy = state.energy ?? MISSILE_COMMAND_MAX_ENERGY;
  const stateName = !handDetected || !aimPoint
    ? "no-hand"
    : !hasBases
    ? "no-bases"
    : ammo <= 0
    ? "no-ammo"
    : energy < MISSILE_COMMAND_INTERCEPT_ENERGY_COST
    ? "recharging"
    : cooldown.isCoolingDown
    ? "cooling"
    : "ready";
  const labelByState = {
    ready: "Ready",
    cooling: "Reloading",
    "no-hand": "No hand",
    "no-bases": "No bases",
    "no-ammo": "No ammo",
    recharging: "Charging",
  };

  return {
    state: stateName,
    className: `fullscreen-camera-missile-crosshair ${stateName}`,
    point,
    label: labelByState[stateName] ?? "",
  };
}

export function getMissileCommandTargetWarnings(state) {
  if (!state?.layout || !Array.isArray(state.structures) || !Array.isArray(state.threats)) {
    return [];
  }

  const warningsByStructureId = new Map();
  for (const threat of state.threats) {
    if (!threat?.targetStructureId) {
      continue;
    }
    const target = state.structures.find(
      (structure) => structure.id === threat.targetStructureId && structure.alive,
    );
    if (!target) {
      continue;
    }

    const existing = warningsByStructureId.get(target.id);
    const threatCount = (existing?.threatCount ?? 0) + 1;
    warningsByStructureId.set(target.id, {
      structureId: target.id,
      x: target.x,
      y: target.y - target.height * 0.52,
      width: target.width,
      height: target.height,
      threatCount,
      className: `fullscreen-camera-missile-target-warning ${
        threatCount > 1 ? "multiple" : "single"
      }`,
    });
  }

  return Array.from(warningsByStructureId.values());
}

export function getMissileCommandStructureUi(structure, { selectedLaunchBaseId = null } = {}) {
  const alive = Boolean(structure?.alive);
  const selectedLaunchBase = alive && structure?.id === selectedLaunchBaseId;
  const className = [
    "fullscreen-camera-missile-structure",
    structure?.type ?? "",
    structure?.type === "base" ? "shape-triangle" : "shape-block",
    alive ? "alive" : "destroyed rubble",
    selectedLaunchBase ? "selected-launch-base" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    className,
    showSmoke: !alive,
    fragments: alive
      ? []
      : [
          { id: "left", className: "fragment-left" },
          { id: "center", className: "fragment-center" },
          { id: "right", className: "fragment-right" },
    ],
  };
}

export function getMissileCommandThreatUi(threat) {
  const totalDistance = Math.max(
    1,
    Math.hypot((threat?.targetX ?? 0) - (threat?.startX ?? 0), (threat?.targetY ?? 0) - (threat?.startY ?? 0)),
  );
  const traveledDistance = Math.hypot(
    (threat?.x ?? 0) - (threat?.startX ?? 0),
    (threat?.y ?? 0) - (threat?.startY ?? 0),
  );
  const progress = clamp(traveledDistance / totalDistance, 0, 1);
  const urgency = progress >= 0.82 ? "critical" : progress >= 0.58 ? "urgent" : "distant";
  const type = threat?.type ?? "standard";

  return {
    progress: Number(progress.toFixed(3)),
    urgency,
    type,
    hitPoints: threat?.hitPoints ?? 1,
    trailClassName: `fullscreen-camera-missile-trail hostile ${urgency} ${type}`,
    headClassName: `fullscreen-camera-missile-head hostile shape-diamond ${urgency} ${type}`,
  };
}

export function getMissileCommandInterceptorUi() {
  return {
    trailClassName: "fullscreen-camera-missile-trail interceptor",
    headClassName: "fullscreen-camera-missile-head interceptor shape-circle",
  };
}

export function getMissileCommandLegendItems(threatScore) {
  return [
    {
      id: "threat-score",
      icon: "+",
      label: `+${Number.isFinite(threatScore) ? threatScore : 0}`,
    },
    {
      id: "pinch-fire",
      icon: "P",
      label: "Fire",
    },
  ];
}

export function getMissileCommandTacticalMetrics(state) {
  const structures = Array.isArray(state?.structures) ? state.structures : [];
  const bases = structures.filter((structure) => structure.alive && structure.type === "base").length;
  const cities = structures.filter((structure) => structure.alive && structure.type === "city").length;
  const incoming = Array.isArray(state?.threats) ? state.threats.length : 0;
  const pressure = incoming >= 5 ? "high" : incoming >= 3 ? "elevated" : "steady";
  const score = state?.score ?? 0;
  const intercepts = state?.threatsStopped ?? 0;

  return {
    score,
    intercepts,
    incoming,
    bases,
    cities,
    pressure,
    wave: state?.wave ?? 1,
    totalWaves: state?.totalWaves ?? 1,
    items: [
      { id: "score", label: "Score", value: score },
      { id: "intercepts", label: "Hits", value: intercepts },
      { id: "incoming", label: "In", value: incoming },
      { id: "bases", label: "Bases", value: bases },
      { id: "cities", label: "Cities", value: cities },
      { id: "pressure", label: "Pressure", value: pressure },
    ],
  };
}

export function getMissileCommandResourceUi(state) {
  const maxAmmo = Math.max(1, state?.maxAmmo ?? MISSILE_COMMAND_MAX_AMMO);
  const ammo = clamp(state?.ammo ?? maxAmmo, 0, maxAmmo);
  const maxEnergy = Math.max(1, state?.maxEnergy ?? MISSILE_COMMAND_MAX_ENERGY);
  const energy = clamp(state?.energy ?? maxEnergy, 0, maxEnergy);
  const canFire =
    state?.status === "playing" &&
    getAliveBases(state?.structures).length > 0 &&
    ammo > 0 &&
    energy >= MISSILE_COMMAND_INTERCEPT_ENERGY_COST &&
    (state?.cooldownMs ?? 0) <= 0;
  return {
    ammo,
    maxAmmo,
    ammoRatio: Number((ammo / maxAmmo).toFixed(3)),
    energy: Math.round(energy),
    maxEnergy,
    energyRatio: Number((energy / maxEnergy).toFixed(3)),
    shotEnergyCost: MISSILE_COMMAND_INTERCEPT_ENERGY_COST,
    canFire,
    state:
      ammo <= 0
        ? "empty"
        : energy < MISSILE_COMMAND_INTERCEPT_ENERGY_COST
          ? "charging"
          : canFire
            ? "ready"
            : "waiting",
  };
}

export function getMissileCommandWaveUi(state) {
  const wave = Math.max(1, state?.wave ?? 1);
  const totalWaves = Math.max(wave, state?.totalWaves ?? wave);
  const limit = Math.max(1, state?.waveThreatLimit ?? 1);
  const resolved = clamp(state?.waveThreatsResolved ?? 0, 0, limit);
  return {
    wave,
    totalWaves,
    name: state?.waveConfig?.name ?? `Wave ${wave}`,
    progress: Number((resolved / limit).toFixed(3)),
    threatsRemaining: Math.max(0, limit - resolved),
    specialThreats: (state?.threats ?? []).filter(
      (threat) => threat.type && threat.type !== "standard",
    ).length,
    phase:
      state?.status === "intermission"
        ? "calm"
        : state?.status === "game_over"
          ? "complete"
          : state?.status === "countdown"
            ? "briefing"
            : "defending",
  };
}

export function getMissileCommandIntermissionUi(state) {
  if (state?.status !== "intermission" || !state.lastWaveRecap) {
    return {
      visible: false,
      title: "",
      remainingMs: 0,
      stats: [],
    };
  }
  const recap = state.lastWaveRecap;
  return {
    visible: true,
    title: recap.perfect ? "Perfect wave" : "Sky secured",
    remainingMs: Math.max(0, state.intermissionMs ?? 0),
    nextWave: Math.min(state.totalWaves ?? state.wave + 1, state.wave + 1),
    stats: [
      { label: "Intercepts", value: recap.threatsStopped },
      { label: "Cities", value: recap.citiesSurviving },
      { label: "City bonus", value: recap.cityBonus },
      { label: "Perfect bonus", value: recap.perfectBonus },
    ],
  };
}

export function getMissileCommandExplosionUi(explosion) {
  const durationMs = Math.max(1, explosion?.durationMs ?? 1);
  const progress = clamp((explosion?.ageMs ?? 0) / durationMs, 0, 1);
  const kind = explosion?.kind ?? "interceptor";

  return {
    className: `fullscreen-camera-missile-explosion ${kind}`,
    coreOpacity: Number((1 - progress * 0.75).toFixed(3)),
    shockwaveOpacity: Number(Math.max(0, 1 - progress).toFixed(3)),
    shockwaveScale: Number((0.72 + progress * 0.5).toFixed(3)),
  };
}

export function getMissileCommandCountdownUi(state) {
  if (state?.status !== "countdown" || (state?.countdownMs ?? 0) <= 0) {
    return {
      visible: false,
      title: "",
      seconds: 0,
      structureIds: [],
    };
  }

  return {
    visible: true,
    title: "Defend",
    seconds: Math.max(1, Math.ceil(state.countdownMs / 1000)),
    structureIds: (Array.isArray(state.structures) ? state.structures : [])
      .filter((structure) => structure.alive)
    .map((structure) => structure.id),
  };
}

export function getMissileCommandGameOverUi(state, restartLabel = "Restart Defense") {
  if (state?.status !== "game_over") {
    return {
      visible: false,
      title: "",
      stats: [],
      restartText: "",
    };
  }

  const result = state.result;
  return {
    visible: true,
    title: result?.outcome === "victory" ? "Defense complete" : "Defense lost",
    stats: result
      ? [
          { label: "Score", value: result.score },
          { label: "Waves", value: `${result.wavesCleared}/${result.totalWaves}` },
          { label: "Cities", value: result.citiesSurviving },
          { label: "Accuracy", value: `${result.accuracy}%` },
        ]
      : [
          { label: "Score", value: state.score ?? 0 },
          { label: "Intercepts", value: state.threatsStopped ?? 0 },
        ],
    medals: result?.medals ?? [],
    restartText: `Hold ${restartLabel}`,
  };
}
