import {
  FRUIT_NINJA_BASE_SCORE,
  FRUIT_NINJA_BOMB_PENALTY,
  FRUIT_NINJA_BOMB_TELEGRAPH_MS,
  FRUIT_NINJA_COMBO_BONUS,
  FRUIT_NINJA_COMBO_WINDOW_MS,
  FRUIT_NINJA_FEVER_DURATION_MS,
  FRUIT_NINJA_FEVER_MAX,
  FRUIT_NINJA_MAX_SHIELDS,
  FRUIT_NINJA_SLOW_TIME_DURATION_MS,
  createFruitNinjaResult,
  getFruitNinjaWaveProfile,
} from "./fruitNinjaGame.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ratio(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }
  return Number(clamp(value / maximum, 0, 1).toFixed(3));
}

function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getFruitNinjaSceneClassName(state) {
  return [
    "fullscreen-camera-fruit-ninja",
    "slice-air-arcade",
    state?.feverMs > 0 ? "fever-active" : "",
    state?.slowTimeMs > 0 ? "slow-time-active" : "",
    state?.status === "gameover" ? "round-complete" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getFruitNinjaRoundUi(state) {
  const durationMs = Math.max(1, Number(state?.roundDurationMs) || 1);
  const remainingMs = clamp(
    Number.isFinite(state?.roundRemainingMs) ? state.roundRemainingMs : durationMs,
    0,
    durationMs,
  );
  const wave = clamp(
    Math.round(Number(state?.wave) || 1),
    1,
    Math.max(1, Math.round(Number(state?.totalWaves) || 1)),
  );
  const profile = getFruitNinjaWaveProfile(wave);
  const urgency =
    remainingMs <= 5_000 ? "critical" : remainingMs <= 15_000 ? "urgent" : "steady";

  return {
    clock: formatClock(remainingMs),
    remainingMs,
    progress: Number((1 - ratio(remainingMs, durationMs)).toFixed(3)),
    urgency,
    wave,
    totalWaves: Math.max(1, Math.round(Number(state?.totalWaves) || 1)),
    waveLabel: profile.label,
    announcementVisible: state?.status === "running" && (state?.waveAnnouncementMs ?? 0) > 0,
    announcement: `Wave ${wave}: ${profile.label}`,
  };
}

export function getFruitNinjaTargetUi(target) {
  const kind = target?.kind === "bomb" ? "bomb" : "fruit";
  const variant = kind === "fruit" ? target?.variant ?? "standard" : "standard";
  const telegraphMs =
    kind === "bomb" && Number.isFinite(target?.telegraphMs)
      ? Math.max(0, target.telegraphMs)
      : 0;
  const armed = kind === "bomb" && (target?.armed === true || telegraphMs <= 0);
  const dangerState = kind !== "bomb" ? "safe" : armed ? "armed" : "telegraphing";
  const className = [
    "fullscreen-camera-fruit-target",
    kind,
    variant !== "standard" ? `special-${variant}` : "",
    dangerState,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    className,
    kind,
    variant,
    dangerState,
    fuseProgress:
      kind === "bomb"
        ? Number((1 - ratio(telegraphMs, target?.fuseMs ?? FRUIT_NINJA_BOMB_TELEGRAPH_MS)).toFixed(3))
        : 0,
    label:
      kind === "bomb"
        ? armed
          ? "Armed bomb"
          : "Bomb incoming"
        : target?.label ?? "Fruit",
    rewardLabel:
      variant === "golden"
        ? "Bonus score"
        : variant === "frost"
          ? "Slow time"
          : variant === "shield"
            ? "Shield"
            : `+${FRUIT_NINJA_BASE_SCORE}`,
  };
}

export function getFruitNinjaBombWarnings(state) {
  if (!state?.layout || !Array.isArray(state.targets)) {
    return [];
  }

  return state.targets
    .filter((target) => target?.kind === "bomb")
    .map((target) => {
      const ui = getFruitNinjaTargetUi(target);
      const offscreen = target.y - target.radius > state.layout.height;
      return {
        id: target.id,
        x: clamp(target.x, target.radius, state.layout.width - target.radius),
        edge: target.x < state.layout.width * 0.5 ? "left" : "right",
        offscreen,
        dangerState: ui.dangerState,
        label: ui.label,
        secondsUntilArmed: Math.max(0, Math.ceil((target.telegraphMs ?? 0) / 100) / 10),
        className: `fullscreen-camera-fruit-bomb-warning ${ui.dangerState} ${
          offscreen ? "offscreen" : "onscreen"
        }`,
      };
    })
    .sort((first, second) => first.secondsUntilArmed - second.secondsUntilArmed);
}

export function getFruitNinjaComboUi(state, now = 0) {
  const count = Math.max(0, Math.round(Number(state?.comboCount) || 0));
  const remainingMs =
    count > 0 && Number.isFinite(state?.comboExpiresAt)
      ? Math.max(0, state.comboExpiresAt - (Number(now) || 0))
      : 0;
  const tier = count >= 12 ? "legendary" : count >= 7 ? "blazing" : count >= 3 ? "chain" : "building";

  return {
    active: count > 0 && remainingMs > 0,
    count,
    label: count > 1 ? `Combo x${count}` : "Build a combo",
    tier,
    remainingMs,
    windowProgress: ratio(remainingMs, FRUIT_NINJA_COMBO_WINDOW_MS),
    bestCombo: Math.max(
      Math.round(Number(state?.bestCombo) || 0),
      Math.round(Number(state?.stats?.bestCombo) || 0),
    ),
  };
}

export function getFruitNinjaPrecisionUi(lastSlice) {
  const grade = lastSlice?.grade;
  if (!grade?.id) {
    return {
      visible: false,
      grade: null,
      label: "",
      bonus: 0,
      className: "fullscreen-camera-fruit-precision hidden",
    };
  }

  return {
    visible: true,
    grade: grade.id,
    label: grade.label,
    bonus: Math.max(0, Math.round(Number(grade.bonus) || 0)),
    speed: Math.max(0, Math.round(Number(grade.speed) || 0)),
    centerRatio: clamp(Number(grade.centerRatio) || 0, 0, 2),
    className: `fullscreen-camera-fruit-precision ${grade.id}`,
  };
}

export function getFruitNinjaPowerUi(state) {
  const feverMs = Math.max(0, Number(state?.feverMs) || 0);
  const slowTimeMs = Math.max(0, Number(state?.slowTimeMs) || 0);
  const shields = clamp(
    Math.round(Number(state?.shields) || 0),
    0,
    FRUIT_NINJA_MAX_SHIELDS,
  );

  return {
    fever: {
      active: feverMs > 0,
      charge: ratio(state?.feverMeter, FRUIT_NINJA_FEVER_MAX),
      remaining: ratio(feverMs, FRUIT_NINJA_FEVER_DURATION_MS),
      label: feverMs > 0 ? "Fever x2" : "Fever",
    },
    slowTime: {
      active: slowTimeMs > 0,
      remaining: ratio(slowTimeMs, FRUIT_NINJA_SLOW_TIME_DURATION_MS),
      label: slowTimeMs > 0 ? "Slow time" : "Frost ready",
    },
    shields: {
      count: shields,
      maximum: FRUIT_NINJA_MAX_SHIELDS,
      charges: Array.from(
        { length: FRUIT_NINJA_MAX_SHIELDS },
        (_, index) => index < shields,
      ),
      label: shields > 0 ? `${shields} shield${shields === 1 ? "" : "s"}` : "No shield",
    },
  };
}

export function getFruitNinjaHud(state, now = 0) {
  const round = getFruitNinjaRoundUi(state);
  const combo = getFruitNinjaComboUi(state, now);
  return {
    status: state?.message ?? "",
    round,
    combo,
    powers: getFruitNinjaPowerUi(state),
    precision: getFruitNinjaPrecisionUi(state?.lastSlice),
    items: [
      { id: "score", label: "Score", value: Math.max(0, Math.round(Number(state?.score) || 0)) },
      { id: "time", label: "Time", value: round.clock },
      {
        id: "lives",
        label: "Lives",
        value: Math.max(0, Math.round(Number(state?.lives) || 0)),
      },
      { id: "wave", label: "Wave", value: `${round.wave}/${round.totalWaves}` },
    ],
  };
}

export function getFruitNinjaLegendItems() {
  return [
    { id: "fruit", label: `Fruit +${FRUIT_NINJA_BASE_SCORE}` },
    { id: "combo", label: `Combo +${FRUIT_NINJA_COMBO_BONUS}` },
    { id: "bomb", label: `Bomb -${FRUIT_NINJA_BOMB_PENALTY}` },
    { id: "golden", label: "Gold = bonus" },
    { id: "frost", label: "Blue = slow" },
    { id: "shield", label: "Purple = shield" },
  ];
}

export function getFruitNinjaRecapUi(state, restartLabel = "Restart Round") {
  if (state?.status !== "gameover") {
    return {
      visible: false,
      title: "",
      grade: null,
      stats: [],
      medals: [],
      restartText: "",
    };
  }

  const result = state.result ?? createFruitNinjaResult(state);
  const stats = result.stats;
  return {
    visible: true,
    title: result.outcome === "completed" ? "Round complete" : "Flight ended",
    grade: result.grade,
    score: result.score,
    personalBest: Math.max(result.score, Math.round(Number(state.personalBest) || 0)),
    stats: [
      { id: "fruit", label: "Fruit", value: stats.fruitSliced },
      { id: "best-combo", label: "Best combo", value: result.bestCombo },
      {
        id: "precision",
        label: "Precision",
        value: `${Math.round(result.precisionRate * 100)}%`,
      },
      { id: "bombs", label: "Bombs hit", value: stats.bombsHit },
    ],
    medals: result.medals.filter((medal) => medal.earned),
    challengeLabel: result.challenge ? `Daily ${result.challenge.dayKey}` : null,
    restartText: `Hold ${restartLabel}`,
  };
}
