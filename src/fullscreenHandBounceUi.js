import {
  FULLSCREEN_HAND_BOUNCE_MAX_FOCUS,
  getFullscreenHandBounceResultStats,
  getFullscreenHandBounceTargetRect,
} from "./fullscreenHandBounceGame.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil((milliseconds ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function progressItem(id, label, value, goal) {
  const normalizedGoal = Math.max(0, goal ?? 0);
  const normalizedValue = Math.max(0, value ?? 0);
  return {
    id,
    label,
    value: normalizedValue,
    goal: normalizedGoal,
    complete: normalizedValue >= normalizedGoal,
    text: `${Math.min(normalizedValue, normalizedGoal)}/${normalizedGoal}`,
  };
}

export function getFullscreenHandBounceHudUi(state = {}) {
  state = state ?? {};
  const config = state.stageConfig ?? {};
  return {
    ariaLabel: `Hand Bounce score ${state.score ?? 0}. Stage ${state.stage ?? 1} of ${state.totalStages ?? 1}.`,
    items: [
      { id: "score", label: "Score", value: state.score ?? 0 },
      { id: "saves", label: "Saves", value: state.saveCount ?? 0 },
      {
        id: "stage",
        label: "Stage",
        value: `${state.stage ?? 1}/${state.totalStages ?? 1}`,
      },
      {
        id: "time",
        label: config.shortName ?? "Time",
        value: formatClock(state.stageTimeRemainingMs),
      },
      { id: "lives", label: "Lives", value: state.lives ?? 0 },
      {
        id: "combo",
        label: "Volley",
        value: `${state.comboCount ?? 0}x`,
      },
    ],
  };
}

export function getFullscreenHandBounceStageUi(state = {}) {
  state = state ?? {};
  const config = state.stageConfig ?? {};
  const progress = state.stageProgress ?? {};
  const goals = [
    progressItem("saves", "Volleys", progress.saves, config.requiredSaves),
  ];
  if ((config.requiredTargetHits ?? 0) > 0) {
    goals.push(
      progressItem(
        "targets",
        "Targets",
        progress.targetHits,
        config.requiredTargetHits,
      ),
    );
  }
  if ((config.requiredTrickShots ?? 0) > 0) {
    goals.push(
      progressItem(
        "tricks",
        "Tricks",
        progress.trickShots,
        config.requiredTrickShots,
      ),
    );
  }
  const completionRatio =
    goals.length > 0
      ? goals.reduce(
          (sum, goal) =>
            sum + (goal.goal > 0 ? clamp(goal.value / goal.goal, 0, 1) : 1),
          0,
        ) / goals.length
      : 0;
  return {
    stage: state.stage ?? 1,
    totalStages: state.totalStages ?? 1,
    name: config.name ?? `Stage ${state.stage ?? 1}`,
    goalText: config.goalText ?? "Keep the ball alive",
    goals,
    completionRatio: Number(completionRatio.toFixed(3)),
    timeLabel: formatClock(state.stageTimeRemainingMs),
    urgent: (state.stageTimeRemainingMs ?? Infinity) <= 10_000,
    phase: state.phase ?? state.status ?? "playing",
  };
}

export function getFullscreenHandBounceTargetUi(state = {}) {
  state = state ?? {};
  const rect = getFullscreenHandBounceTargetRect(state);
  if (!rect) {
    return {
      visible: false,
      ariaLabel: "",
    };
  }
  return {
    visible: state.status === "playing" && state.phase === "playing",
    ...rect,
    role: "img",
    ariaLabel: `${rect.label}, ${rect.anchor.replaceAll("-", " ")}`,
    assistiveText: "Aim the rising ball through the highlighted target.",
  };
}

export function getFullscreenHandBouncePowerUi(state = {}) {
  state = state ?? {};
  const focus = clamp(state.focus ?? 0, 0, FULLSCREEN_HAND_BOUNCE_MAX_FOCUS);
  const active = (state.powerModeMs ?? 0) > 0;
  return {
    active,
    focus,
    progress: Number((focus / FULLSCREEN_HAND_BOUNCE_MAX_FOCUS).toFixed(3)),
    label: active ? "Power volley active" : "Power volley",
    detail: active
      ? `Double save score for ${(
          Math.ceil((state.powerModeMs ?? 0) / 100) / 10
        ).toFixed(1)} seconds`
      : `${Math.round(focus)}% charged`,
    ariaLabel: active
      ? "Power volley active. Saves score double."
      : `Power volley ${Math.round(focus)} percent charged.`,
  };
}

export function getFullscreenHandBounceCheckpointUi(state = {}) {
  state = state ?? {};
  if (state.phase !== "checkpoint" || !state.lastStageRecap) {
    return {
      visible: false,
      title: "",
      stats: [],
      nextStageText: "",
    };
  }
  const recap = state.lastStageRecap;
  return {
    visible: true,
    title: `${recap.name} cleared`,
    liveRole: "status",
    stats: [
      { label: "Volleys", value: recap.saves ?? 0 },
      { label: "Targets", value: recap.targetHits ?? 0 },
      { label: "Tricks", value: recap.trickShots ?? 0 },
      { label: "Score earned", value: recap.scoreEarned ?? 0 },
    ],
    nextStageText: `Stage ${Math.min(
      state.totalStages ?? 1,
      (state.stage ?? 1) + 1,
    )} incoming`,
  };
}

export function getFullscreenHandBounceResultUi(state = {}) {
  state = state ?? {};
  if (state.status !== "gameover") {
    return {
      visible: false,
      title: "",
      stats: [],
    };
  }
  const result = getFullscreenHandBounceResultStats(state) ?? {};
  const victory = result.outcome === "victory";
  return {
    visible: true,
    outcome: result.outcome,
    title: victory ? "Circuit complete" : "Rally ended",
    summary: victory
      ? "You cleared every Hand Bounce stage."
      : `You reached stage ${result.stageReached ?? 1}.`,
    newPersonalBest: Boolean(result.newPersonalBest),
    stats: [
      { label: "Score", value: result.score ?? 0 },
      { label: "Volleys", value: result.saves ?? 0 },
      { label: "Targets", value: result.targetHits ?? 0 },
      { label: "Tricks", value: result.trickShots ?? 0 },
      { label: "Best combo", value: `${result.bestCombo ?? 0}x` },
      {
        label: "Stages",
        value: `${result.stagesCleared ?? 0}/${result.totalStages ?? 0}`,
      },
    ],
    restartLabel: victory ? "Play the circuit again" : "Retry the circuit",
  };
}

export function getFullscreenHandBounceLegendUi() {
  return {
    ariaLabel: "How to play Hand Bounce",
    items: [
      {
        id: "move",
        label: "Move",
        detail: "Place your palm or pointer beneath the falling ball.",
      },
      {
        id: "aim",
        label: "Aim",
        detail: "Catch near an edge to steer toward highlighted targets.",
      },
      {
        id: "lift",
        label: "Lift",
        detail: "Move upward through contact to perform a lift trick.",
      },
      {
        id: "focus",
        label: "Charge",
        detail:
          "Volleys, targets, and tricks charge a double-score power volley.",
      },
    ],
  };
}

export function getFullscreenHandBounceAnnouncement(
  state = {},
  previousState = {},
) {
  state = state ?? {};
  previousState = previousState ?? {};
  if (state.status === "gameover" && previousState.status !== "gameover") {
    return getFullscreenHandBounceResultUi(state).title;
  }
  if (state.phase === "checkpoint" && previousState.phase !== "checkpoint") {
    return `${state.lastStageRecap?.name ?? "Stage"} cleared`;
  }
  if ((state.powerModeMs ?? 0) > 0 && (previousState.powerModeMs ?? 0) <= 0) {
    return "Power volley active. Saves score double.";
  }
  if (state.targetIndex !== previousState.targetIndex) {
    return state.message ?? "Target tagged";
  }
  if (state.lives !== previousState.lives) {
    return state.message ?? `${state.lives ?? 0} lives left`;
  }
  return "";
}
