import { MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS } from "./missileCommandGame.js";

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
  const stateName = !handDetected || !aimPoint
    ? "no-hand"
    : !hasBases
    ? "no-bases"
    : cooldown.isCoolingDown
    ? "cooling"
    : "ready";
  const labelByState = {
    ready: "Ready",
    cooling: "Reloading",
    "no-hand": "No hand",
    "no-bases": "No bases",
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

  return {
    progress: Number(progress.toFixed(3)),
    urgency,
    trailClassName: `fullscreen-camera-missile-trail hostile ${urgency}`,
    headClassName: `fullscreen-camera-missile-head hostile ${urgency}`,
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
