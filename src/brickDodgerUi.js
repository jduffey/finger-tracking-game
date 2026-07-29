import {
  BRICK_DODGER_SLOW_TIME_MS,
  getBrickDodgerResultStats,
  getBrickDodgerStageConfig,
} from "./brickDodgerGame.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getBrickDodgerStageUi(state) {
  const config =
    state?.stageConfig ?? getBrickDodgerStageConfig(state?.stage);
  const durationMs = Math.max(1, config.durationMs);
  const elapsedMs = clamp(state?.stageElapsedMs ?? 0, 0, durationMs);
  return {
    stage: config.stage,
    name: config.name,
    threatLevel: config.threatLevel,
    threatLabel: config.threatLabel,
    progress: Number((elapsedMs / durationMs).toFixed(3)),
    remainingMs: Math.max(0, durationMs - elapsedMs),
    phase:
      state?.status === "stage_recap"
        ? "recap"
        : state?.status === "gameover"
          ? "complete"
          : "running",
    className: `brick-dodger-stage threat-${config.threatLevel}`,
  };
}

function getHazardArrivalMs(state, hazard) {
  const distance = (state.layout.playerY ?? 0) - (hazard.y ?? 0);
  if (distance <= 0) {
    return 0;
  }
  const timeScale = (state.slowTimeMs ?? 0) > 0 ? 0.55 : 1;
  return (distance / Math.max(1, (hazard.vy ?? 0) * timeScale)) * 1000;
}

export function getBrickDodgerLaneTelegraphUi(state) {
  if (!state?.layout?.laneCenters) {
    return [];
  }
  const telegraphs = Array.isArray(state.laneTelegraphs)
    ? state.laneTelegraphs
    : [];
  const hazards = Array.isArray(state.hazards) ? state.hazards : [];

  return state.layout.laneCenters.map((centerX, laneIndex) => {
    const laneTelegraphs = telegraphs.filter(
      (telegraph) => telegraph.laneIndex === laneIndex,
    );
    const laneHazards = hazards.filter(
      (hazard) =>
        hazard.laneIndex === laneIndex &&
        (hazard.y ?? 0) <= state.layout.playerY,
    );
    const hazardArrivals = laneHazards.map((hazard) =>
      getHazardArrivalMs(state, hazard),
    );
    const telegraphArrivals = laneTelegraphs
      .filter((telegraph) => telegraph.kind === "hazard")
      .map((telegraph) => telegraph.arrivalMs ?? Number.POSITIVE_INFINITY);
    const arrivalMs = Math.min(
      ...hazardArrivals,
      ...telegraphArrivals,
      Number.POSITIVE_INFINITY,
    );
    const pickup = laneTelegraphs.find(
      (telegraph) => telegraph.kind === "pickup",
    );
    const urgency =
      arrivalMs <= 650
        ? "critical"
        : arrivalMs <= 1_400
          ? "warning"
          : Number.isFinite(arrivalMs)
            ? "watch"
            : pickup
              ? "pickup"
              : "clear";
    return {
      laneIndex,
      centerX,
      urgency,
      arrivalMs: Number.isFinite(arrivalMs) ? Math.round(arrivalMs) : null,
      hazardCount: laneHazards.length,
      pickupType: pickup?.pickupType ?? null,
      threatLevel:
        laneTelegraphs[0]?.threatLevel ??
        state.threatLevel?.level ??
        state.stageConfig?.threatLevel ??
        1,
      className: `brick-dodger-lane-telegraph ${urgency}`,
      label:
        urgency === "critical"
          ? "Move"
          : urgency === "warning"
            ? "Incoming"
            : pickup
              ? pickup.pickupType === "slow-time"
                ? "Slow time"
                : pickup.pickupType === "shield"
                  ? "Shield"
                  : "Bonus"
              : "",
    };
  });
}

export function getBrickDodgerPickupUi(pickup) {
  const type =
    pickup?.type === "shield" || pickup?.type === "slow-time"
      ? pickup.type
      : "score";
  const metadata = {
    score: { label: "Bonus", icon: "+", tone: "gold" },
    shield: { label: "Shield", icon: "S", tone: "cyan" },
    "slow-time": { label: "Slow time", icon: "T", tone: "violet" },
  }[type];
  return {
    type,
    ...metadata,
    className: `brick-dodger-pickup ${type}`,
  };
}

export function getBrickDodgerMultiplierUi(state) {
  const multiplier = Math.max(1, state?.nearMissMultiplier ?? 1);
  const streak = Math.max(0, state?.nearMissStreak ?? 0);
  return {
    visible: streak > 0,
    streak,
    multiplier,
    label: streak > 0 ? `Near miss x${multiplier}` : "",
    className: `brick-dodger-multiplier ${
      multiplier >= 3 ? "hot" : multiplier >= 2 ? "building" : "steady"
    }`,
  };
}

export function getBrickDodgerSlowTimeUi(state) {
  const remainingMs = Math.max(0, state?.slowTimeMs ?? 0);
  return {
    active: remainingMs > 0,
    remainingMs,
    progress: Number(
      clamp(remainingMs / BRICK_DODGER_SLOW_TIME_MS, 0, 1).toFixed(3),
    ),
    label: remainingMs > 0 ? "Slow time" : "",
  };
}

export function getBrickDodgerStageRecapUi(state) {
  if (state?.status !== "stage_recap" || !state.lastStageRecap) {
    return {
      visible: false,
      title: "",
      stats: [],
      remainingMs: 0,
    };
  }
  const recap = state.lastStageRecap;
  return {
    visible: true,
    title: recap.clean ? "Clean stage" : "Stage clear",
    subtitle: recap.name,
    remainingMs: Math.max(0, state.stageRecapMs ?? 0),
    stats: [
      { label: "Score", value: recap.scoreEarned },
      { label: "Near misses", value: recap.nearMisses },
      { label: "Pickups", value: recap.pickups },
      { label: "Hits", value: recap.hits },
    ],
  };
}

export function getBrickDodgerResultUi(state) {
  if (state?.status !== "gameover") {
    return {
      visible: false,
      title: "",
      stats: [],
    };
  }
  const result = getBrickDodgerResultStats(state);
  return {
    visible: true,
    title: "Run complete",
    stats: [
      { label: "Score", value: result.score },
      { label: "Stage", value: result.stageReached },
      { label: "Near misses", value: result.nearMisses },
      { label: "Best multiplier", value: `x${result.bestMultiplier}` },
    ],
  };
}
