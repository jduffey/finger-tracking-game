import {
  EXPERIENCE_COUNTDOWN_KINDS,
  EXPERIENCE_PAUSE_REASONS,
  EXPERIENCE_PHASES,
  getPrimaryExperiencePauseReason,
  isExperienceLifecycleState,
} from "../experienceLifecycle.js";
import {
  EXPERIENCE_RESULT_ACTIONS,
  createExperienceResultViewModel,
} from "../experienceResult.js";
import { TRACKING_RECOVERY_PHASES } from "../trackingRecoveryGate.js";

export const EXPERIENCE_OVERLAY_KINDS = Object.freeze({
  HIDDEN: "hidden",
  READY: "ready",
  COUNTDOWN: "countdown",
  HUD: "hud",
  PAUSED: "paused",
  TRACKING_LOST: "tracking-lost",
  RESULTS: "results",
});

export const EXPERIENCE_OVERLAY_ACTIONS = Object.freeze({
  START: "start",
  PAUSE: "pause",
  RESUME: "resume",
  RESTART: EXPERIENCE_RESULT_ACTIONS.RESTART,
  EXIT: EXPERIENCE_RESULT_ACTIONS.EXIT,
});

const MAX_HUD_ITEMS = 6;
const MAX_COPY_LENGTH = 160;
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;

const PAUSE_PRESENTATIONS = Object.freeze({
  [EXPERIENCE_PAUSE_REASONS.MANUAL]: Object.freeze({
    eyebrow: "Experience paused",
    title: "Paused",
    message: "Take a break. Your run is waiting right where you left it.",
    resumeLabel: "Resume",
  }),
  [EXPERIENCE_PAUSE_REASONS.VISIBILITY]: Object.freeze({
    eyebrow: "Experience paused",
    title: "Welcome back",
    message: "The experience paused while this tab was out of view.",
    resumeLabel: "Continue",
  }),
  [EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS]: Object.freeze({
    eyebrow: "Tracking paused",
    title: "Tracking lost",
    message:
      "Move back into view with your hand or body inside the camera frame, then try again.",
    resumeLabel: "Try tracking again",
  }),
});

const PAUSE_REASON_LABELS = Object.freeze({
  [EXPERIENCE_PAUSE_REASONS.MANUAL]: "Paused manually",
  [EXPERIENCE_PAUSE_REASONS.VISIBILITY]: "Tab was out of view",
  [EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS]: "Tracking needs to recover",
});

function normalizeCopy(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const copy = value.trim();
  return copy ? copy.slice(0, MAX_COPY_LENGTH) : fallback;
}

function normalizeHudItem(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const fallbackId = `item-${index + 1}`;
  const id =
    typeof item.id === "string" && SAFE_IDENTIFIER_PATTERN.test(item.id)
      ? item.id
      : fallbackId;
  const label = normalizeCopy(item.label);
  const value =
    typeof item.value === "string" || Number.isFinite(item.value)
      ? String(item.value).slice(0, MAX_COPY_LENGTH)
      : "";
  if (!label || !value) {
    return null;
  }

  return {
    id,
    label,
    value,
    emphasis: item.emphasis === "strong" ? "strong" : "normal",
  };
}

export function normalizeExperienceCompactHud(hud, modeLabel) {
  const source = hud && typeof hud === "object" ? hud : {};
  const items = [];
  for (const [index, item] of (Array.isArray(source.items)
    ? source.items
    : []
  ).entries()) {
    const normalized = normalizeHudItem(item, index);
    if (normalized) {
      const baseId = normalized.id;
      let suffix = 2;
      while (items.some(({ id }) => id === normalized.id)) {
        normalized.id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      items.push(normalized);
    }
    if (items.length >= MAX_HUD_ITEMS) {
      break;
    }
  }

  return {
    label: normalizeCopy(source.label, normalizeCopy(modeLabel, "Experience")),
    status: normalizeCopy(source.status),
    items,
  };
}

function createAction(id, label, emphasis, extras = {}) {
  return { id, label, emphasis, ...extras };
}

function createHiddenView() {
  return {
    visible: false,
    kind: EXPERIENCE_OVERLAY_KINDS.HIDDEN,
    modal: false,
    blocking: false,
    livePriority: "polite",
    announcement: "",
    actions: [],
  };
}

function createPauseView(
  lifecycle,
  modeLabel,
  exitLabel,
  trackingRecovery,
) {
  const primaryReason =
    getPrimaryExperiencePauseReason(lifecycle) ??
    EXPERIENCE_PAUSE_REASONS.MANUAL;
  let presentation =
    PAUSE_PRESENTATIONS[primaryReason] ??
    PAUSE_PRESENTATIONS[EXPERIENCE_PAUSE_REASONS.MANUAL];
  const isTrackingLost =
    primaryReason === EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS;
  const isReacquiring =
    isTrackingLost &&
    trackingRecovery?.phase === TRACKING_RECOVERY_PHASES.REACQUIRING;
  const recoverySeconds = isReacquiring
    ? Math.max(1, Math.ceil((trackingRecovery.remainingMs ?? 0) / 1_000))
    : null;
  if (isReacquiring) {
    presentation = {
      eyebrow: "Tracking found",
      title: "Hold steady",
      message: `Stay inside the frame for ${recoverySeconds} more ${
        recoverySeconds === 1 ? "second" : "seconds"
      }. Play will resume automatically.`,
    };
  }
  const pauseReasons = lifecycle.pauseReasons.map((reason) => ({
    id: reason,
    label: PAUSE_REASON_LABELS[reason] ?? "Experience paused",
  }));
  const mode = normalizeCopy(modeLabel, "Experience");

  return {
    visible: true,
    kind: isTrackingLost
      ? EXPERIENCE_OVERLAY_KINDS.TRACKING_LOST
      : EXPERIENCE_OVERLAY_KINDS.PAUSED,
    modal: true,
    blocking: true,
    livePriority: isTrackingLost ? "assertive" : "polite",
    isTrackingLost,
    isReacquiring,
    recoveryProgress: isReacquiring
      ? Math.min(1, Math.max(0, trackingRecovery?.progress ?? 0))
      : 0,
    recoverySeconds,
    eyebrow: presentation.eyebrow,
    title: presentation.title,
    message: presentation.message,
    pauseReasons,
    primaryPauseReason: primaryReason,
    announcement: `${mode}. ${presentation.title}. ${presentation.message}`,
    actions: [
      ...(isTrackingLost
        ? []
        : [
            createAction(
              EXPERIENCE_OVERLAY_ACTIONS.RESUME,
              presentation.resumeLabel,
              "primary",
              { reason: primaryReason },
            ),
          ]),
      createAction(
        EXPERIENCE_OVERLAY_ACTIONS.RESTART,
        "Restart",
        "secondary",
      ),
      createAction(
        EXPERIENCE_OVERLAY_ACTIONS.EXIT,
        exitLabel,
        "quiet",
      ),
    ],
  };
}

export function createExperienceOverlayViewModel({
  lifecycle,
  modeLabel,
  instructions,
  hud,
  resultOptions,
  exitLabel,
  trackingRecovery,
} = {}) {
  if (!isExperienceLifecycleState(lifecycle)) {
    return createHiddenView();
  }

  const mode = normalizeCopy(modeLabel, "Experience");
  const normalizedExitLabel = normalizeCopy(exitLabel);
  switch (lifecycle.phase) {
    case EXPERIENCE_PHASES.READY: {
      const title = `Ready for ${mode}?`;
      const message = normalizeCopy(
        instructions,
        "Get comfortable, check your space, and start when you are ready.",
      );
      return {
        visible: true,
        kind: EXPERIENCE_OVERLAY_KINDS.READY,
        modal: true,
        blocking: true,
        livePriority: "polite",
        eyebrow: mode,
        title,
        message,
        announcement: `${title} ${message}`,
        actions: [
          createAction(
            EXPERIENCE_OVERLAY_ACTIONS.START,
            "Start",
            "primary",
          ),
          createAction(
            EXPERIENCE_OVERLAY_ACTIONS.EXIT,
            normalizedExitLabel || "Back to home",
            "quiet",
          ),
        ],
      };
    }

    case EXPERIENCE_PHASES.COUNTDOWN: {
      const seconds = Math.max(
        1,
        Math.ceil(lifecycle.countdownRemainingMs / 1_000),
      );
      const resumeCountdown =
        lifecycle.countdownKind === EXPERIENCE_COUNTDOWN_KINDS.RESUME;
      return {
        visible: true,
        kind: EXPERIENCE_OVERLAY_KINDS.COUNTDOWN,
        modal: false,
        blocking: true,
        livePriority: "assertive",
        eyebrow: resumeCountdown ? "Resuming" : "Get ready",
        title: String(seconds),
        message: resumeCountdown
          ? "The experience resumes when the countdown ends."
          : "The experience starts when the countdown ends.",
        seconds,
        announcement: `${resumeCountdown ? "Resuming" : "Starting"} in ${seconds}`,
        actions: [
          createAction(
            EXPERIENCE_OVERLAY_ACTIONS.EXIT,
            normalizedExitLabel || "Leave experience",
            "quiet",
          ),
        ],
      };
    }

    case EXPERIENCE_PHASES.RUNNING:
      return {
        visible: true,
        kind: EXPERIENCE_OVERLAY_KINDS.HUD,
        modal: false,
        blocking: false,
        livePriority: "polite",
        announcement: "",
        hud: normalizeExperienceCompactHud(hud, mode),
        actions: [
          createAction(
            EXPERIENCE_OVERLAY_ACTIONS.PAUSE,
            "Pause",
            "secondary",
            { reason: EXPERIENCE_PAUSE_REASONS.MANUAL },
          ),
          createAction(
            EXPERIENCE_OVERLAY_ACTIONS.EXIT,
            normalizedExitLabel || "Exit",
            "quiet",
          ),
        ],
      };

    case EXPERIENCE_PHASES.PAUSED:
      return createPauseView(
        lifecycle,
        mode,
        normalizedExitLabel || "Back to home",
        trackingRecovery,
      );

    case EXPERIENCE_PHASES.RESULTS: {
      const normalizedResultView = createExperienceResultViewModel(
        lifecycle.result,
        {
          modeLabel: mode,
          ...(resultOptions && typeof resultOptions === "object"
            ? resultOptions
            : {}),
        },
      );
      return {
        visible: true,
        kind: EXPERIENCE_OVERLAY_KINDS.RESULTS,
        modal: true,
        blocking: true,
        livePriority: "polite",
        eyebrow: normalizedResultView.eyebrow,
        title: normalizedResultView.title,
        message: normalizedResultView.message,
        announcement: normalizedResultView.announcement,
        result: normalizedResultView,
        actions: normalizedResultView.actions.map((action) =>
          createAction(
            action.id,
            action.label,
            action.emphasis ?? "secondary",
          ),
        ),
      };
    }

    default:
      return createHiddenView();
  }
}
