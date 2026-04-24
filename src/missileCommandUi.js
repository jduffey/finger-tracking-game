import { MISSILE_COMMAND_INTERCEPT_COOLDOWN_MS } from "./missileCommandGame.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAliveBases(structures) {
  return (Array.isArray(structures) ? structures : []).filter(
    (structure) => structure?.alive && structure.type === "base",
  );
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
