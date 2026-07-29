import { normalizeExperienceResult } from "./experienceResult.js";

export const EXPERIENCE_PHASES = Object.freeze({
  READY: "ready",
  COUNTDOWN: "countdown",
  RUNNING: "running",
  PAUSED: "paused",
  RESULTS: "results",
});

export const EXPERIENCE_LIFECYCLE_EVENTS = Object.freeze({
  START: "start",
  TICK: "tick",
  PAUSE: "pause",
  RESUME: "resume",
  FINISH: "finish",
  RESTART: "restart",
  EXIT: "exit",
});

export const EXPERIENCE_PAUSE_REASONS = Object.freeze({
  MANUAL: "manual",
  VISIBILITY: "visibility",
  TRACKING_LOSS: "tracking-loss",
});

export const EXPERIENCE_COUNTDOWN_KINDS = Object.freeze({
  INITIAL: "initial",
  RESUME: "resume",
});

export const EXPERIENCE_LIFECYCLE_EFFECTS = Object.freeze({
  STARTED: "started",
  COUNTDOWN_COMPLETED: "countdown-completed",
  PAUSED: "paused",
  PAUSE_REASON_CLEARED: "pause-reason-cleared",
  RESUMED: "resumed",
  FINISHED: "finished",
  RESTARTED: "restarted",
  EXIT_REQUESTED: "exit-requested",
});

const ACTIVE_PHASES = new Set([
  EXPERIENCE_PHASES.COUNTDOWN,
  EXPERIENCE_PHASES.RUNNING,
  EXPERIENCE_PHASES.PAUSED,
]);
const PAUSABLE_PHASES = new Set([
  EXPERIENCE_PHASES.COUNTDOWN,
  EXPERIENCE_PHASES.RUNNING,
]);
const RESUMABLE_PHASES = new Set([
  EXPERIENCE_PHASES.COUNTDOWN,
  EXPERIENCE_PHASES.RUNNING,
]);
const VALID_PHASES = new Set(Object.values(EXPERIENCE_PHASES));
const VALID_COUNTDOWN_KINDS = new Set(
  Object.values(EXPERIENCE_COUNTDOWN_KINDS),
);
const VALID_PAUSE_REASONS = new Set(Object.values(EXPERIENCE_PAUSE_REASONS));
const PAUSE_REASON_PRIORITY = Object.freeze([
  EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
  EXPERIENCE_PAUSE_REASONS.MANUAL,
  EXPERIENCE_PAUSE_REASONS.VISIBILITY,
]);
const MAX_COUNTDOWN_MS = 60_000;

function normalizeCountdownMs(value, fallback) {
  const resolved = Number.isFinite(value) ? value : fallback;
  return Math.min(MAX_COUNTDOWN_MS, Math.max(0, resolved));
}

function normalizeDeltaMs(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function addElapsedMs(elapsedMs, deltaMs) {
  return Math.min(Number.MAX_SAFE_INTEGER, elapsedMs + deltaMs);
}

function normalizePauseReason(value) {
  if (value === undefined || value === null) {
    return EXPERIENCE_PAUSE_REASONS.MANUAL;
  }
  return VALID_PAUSE_REASONS.has(value) ? value : null;
}

function sortPauseReasons(reasons) {
  return PAUSE_REASON_PRIORITY.filter((reason) => reasons.includes(reason));
}

function createTransition(state, accepted = false, effects = []) {
  return { state, accepted, effects };
}

function createStartedState(state) {
  if (state.configuration.initialCountdownMs > 0) {
    return {
      ...state,
      phase: EXPERIENCE_PHASES.COUNTDOWN,
      countdownKind: EXPERIENCE_COUNTDOWN_KINDS.INITIAL,
      countdownRemainingMs: state.configuration.initialCountdownMs,
    };
  }
  return {
    ...state,
    phase: EXPERIENCE_PHASES.RUNNING,
    countdownKind: null,
    countdownRemainingMs: 0,
  };
}

/**
 * Creates a serializable lifecycle state. Configuration lives in the state so
 * React reducers and imperative loops do not need a second source of truth.
 */
export function createExperienceLifecycle(options = {}) {
  const settings = options && typeof options === "object" ? options : {};
  const state = {
    phase: EXPERIENCE_PHASES.READY,
    attempt: 1,
    elapsedMs: 0,
    countdownKind: null,
    countdownRemainingMs: 0,
    pauseReasons: [],
    resumePhase: null,
    result: null,
    configuration: Object.freeze({
      initialCountdownMs: normalizeCountdownMs(settings.countdownMs, 3_000),
      resumeCountdownMs: normalizeCountdownMs(settings.resumeCountdownMs, 1_000),
    }),
  };

  return settings.autoStart ? createStartedState(state) : state;
}

export function isExperienceLifecycleState(value) {
  if (!value || typeof value !== "object" || !VALID_PHASES.has(value.phase)) {
    return false;
  }
  if (
    !Number.isInteger(value.attempt) ||
    value.attempt < 1 ||
    !Number.isFinite(value.elapsedMs) ||
    value.elapsedMs < 0 ||
    value.elapsedMs > Number.MAX_SAFE_INTEGER ||
    !Number.isFinite(value.countdownRemainingMs) ||
    value.countdownRemainingMs < 0 ||
    !Array.isArray(value.pauseReasons) ||
    value.pauseReasons.some((reason) => !VALID_PAUSE_REASONS.has(reason)) ||
    new Set(value.pauseReasons).size !== value.pauseReasons.length ||
    !value.configuration ||
    !Number.isFinite(value.configuration.initialCountdownMs) ||
    value.configuration.initialCountdownMs < 0 ||
    value.configuration.initialCountdownMs > MAX_COUNTDOWN_MS ||
    !Number.isFinite(value.configuration.resumeCountdownMs) ||
    value.configuration.resumeCountdownMs < 0 ||
    value.configuration.resumeCountdownMs > MAX_COUNTDOWN_MS
  ) {
    return false;
  }

  if (value.phase === EXPERIENCE_PHASES.PAUSED) {
    if (
      value.pauseReasons.length === 0 ||
      !RESUMABLE_PHASES.has(value.resumePhase)
    ) {
      return false;
    }
    if (value.resumePhase === EXPERIENCE_PHASES.COUNTDOWN) {
      return (
        VALID_COUNTDOWN_KINDS.has(value.countdownKind) &&
        value.countdownRemainingMs > 0 &&
        value.result === null
      );
    }
    return (
      value.countdownKind === null &&
      value.countdownRemainingMs === 0 &&
      value.result === null
    );
  }

  if (value.pauseReasons.length > 0 || value.resumePhase !== null) {
    return false;
  }
  if (value.phase === EXPERIENCE_PHASES.COUNTDOWN) {
    return (
      VALID_COUNTDOWN_KINDS.has(value.countdownKind) &&
      value.countdownRemainingMs > 0 &&
      value.result === null
    );
  }
  if (value.countdownKind !== null || value.countdownRemainingMs !== 0) {
    return false;
  }
  if (value.phase === EXPERIENCE_PHASES.RESULTS) {
    return Boolean(value.result) && typeof value.result === "object";
  }

  return value.result === null;
}

export function isExperienceActive(state) {
  return ACTIVE_PHASES.has(state?.phase);
}

export function getPrimaryExperiencePauseReason(state) {
  if (state?.phase !== EXPERIENCE_PHASES.PAUSED) {
    return null;
  }
  return sortPauseReasons(state.pauseReasons ?? [])[0] ?? null;
}

export function getExperienceLifecycleCapabilities(state) {
  return {
    canStart: state?.phase === EXPERIENCE_PHASES.READY,
    canPause: PAUSABLE_PHASES.has(state?.phase),
    canResume: state?.phase === EXPERIENCE_PHASES.PAUSED,
    canRestart: Boolean(state) && state.phase !== EXPERIENCE_PHASES.READY,
    canExit: Boolean(state),
  };
}

/**
 * Applies one lifecycle event and reports declarative effects for integration
 * code. Invalid transitions preserve object identity and return accepted=false.
 */
export function transitionExperienceLifecycle(state, rawEvent) {
  if (!isExperienceLifecycleState(state)) {
    throw new TypeError("A valid experience lifecycle state is required.");
  }

  const event =
    typeof rawEvent === "string" ? { type: rawEvent } : rawEvent ?? {};

  switch (event.type) {
    case EXPERIENCE_LIFECYCLE_EVENTS.START: {
      if (state.phase !== EXPERIENCE_PHASES.READY) {
        return createTransition(state);
      }
      const nextState = createStartedState(state);
      return createTransition(nextState, true, [
        {
          type: EXPERIENCE_LIFECYCLE_EFFECTS.STARTED,
          attempt: nextState.attempt,
          phase: nextState.phase,
        },
      ]);
    }

    case EXPERIENCE_LIFECYCLE_EVENTS.TICK: {
      const deltaMs = normalizeDeltaMs(event.deltaMs);
      if (deltaMs === 0) {
        return createTransition(state);
      }

      if (state.phase === EXPERIENCE_PHASES.RUNNING) {
        return createTransition(
          {
            ...state,
            elapsedMs: addElapsedMs(state.elapsedMs, deltaMs),
          },
          true,
        );
      }

      if (state.phase !== EXPERIENCE_PHASES.COUNTDOWN) {
        return createTransition(state);
      }

      if (deltaMs < state.countdownRemainingMs) {
        return createTransition(
          {
            ...state,
            countdownRemainingMs: state.countdownRemainingMs - deltaMs,
          },
          true,
        );
      }

      const overflowMs = deltaMs - state.countdownRemainingMs;
      return createTransition(
        {
          ...state,
          phase: EXPERIENCE_PHASES.RUNNING,
          countdownKind: null,
          countdownRemainingMs: 0,
          elapsedMs: addElapsedMs(state.elapsedMs, overflowMs),
        },
        true,
        [{ type: EXPERIENCE_LIFECYCLE_EFFECTS.COUNTDOWN_COMPLETED }],
      );
    }

    case EXPERIENCE_LIFECYCLE_EVENTS.PAUSE: {
      const reason = normalizePauseReason(event.reason);
      if (!reason) {
        return createTransition(state);
      }
      if (state.phase === EXPERIENCE_PHASES.PAUSED) {
        if (state.pauseReasons.includes(reason)) {
          return createTransition(state);
        }
        const pauseReasons = sortPauseReasons([...state.pauseReasons, reason]);
        return createTransition(
          { ...state, pauseReasons },
          true,
          [
            {
              type: EXPERIENCE_LIFECYCLE_EFFECTS.PAUSED,
              reason,
              pauseReasons,
            },
          ],
        );
      }

      if (!PAUSABLE_PHASES.has(state.phase)) {
        return createTransition(state);
      }

      const pauseReasons = [reason];
      return createTransition(
        {
          ...state,
          phase: EXPERIENCE_PHASES.PAUSED,
          pauseReasons,
          resumePhase: state.phase,
        },
        true,
        [
          {
            type: EXPERIENCE_LIFECYCLE_EFFECTS.PAUSED,
            reason,
            pauseReasons,
          },
        ],
      );
    }

    case EXPERIENCE_LIFECYCLE_EVENTS.RESUME: {
      if (state.phase !== EXPERIENCE_PHASES.PAUSED) {
        return createTransition(state);
      }
      const reason = normalizePauseReason(event.reason);
      if (!reason) {
        return createTransition(state);
      }
      if (!state.pauseReasons.includes(reason)) {
        return createTransition(state);
      }

      const pauseReasons = state.pauseReasons.filter(
        (activeReason) => activeReason !== reason,
      );
      if (pauseReasons.length > 0) {
        return createTransition(
          { ...state, pauseReasons },
          true,
          [
            {
              type: EXPERIENCE_LIFECYCLE_EFFECTS.PAUSE_REASON_CLEARED,
              reason,
              pauseReasons,
            },
          ],
        );
      }

      if (state.resumePhase === EXPERIENCE_PHASES.COUNTDOWN) {
        return createTransition(
          {
            ...state,
            phase: EXPERIENCE_PHASES.COUNTDOWN,
            pauseReasons: [],
            resumePhase: null,
          },
          true,
          [
            {
              type: EXPERIENCE_LIFECYCLE_EFFECTS.RESUMED,
              phase: EXPERIENCE_PHASES.COUNTDOWN,
              viaCountdown: true,
            },
          ],
        );
      }

      const resumesWithCountdown = state.configuration.resumeCountdownMs > 0;
      const phase = resumesWithCountdown
        ? EXPERIENCE_PHASES.COUNTDOWN
        : EXPERIENCE_PHASES.RUNNING;
      return createTransition(
        {
          ...state,
          phase,
          countdownKind: resumesWithCountdown
            ? EXPERIENCE_COUNTDOWN_KINDS.RESUME
            : null,
          countdownRemainingMs: resumesWithCountdown
            ? state.configuration.resumeCountdownMs
            : 0,
          pauseReasons: [],
          resumePhase: null,
        },
        true,
        [
          {
            type: EXPERIENCE_LIFECYCLE_EFFECTS.RESUMED,
            phase,
            viaCountdown: resumesWithCountdown,
          },
        ],
      );
    }

    case EXPERIENCE_LIFECYCLE_EVENTS.FINISH: {
      if (!ACTIVE_PHASES.has(state.phase)) {
        return createTransition(state);
      }
      const result = normalizeExperienceResult(event.result, {
        fallbackDurationMs: state.elapsedMs,
      });
      const nextState = {
        ...state,
        phase: EXPERIENCE_PHASES.RESULTS,
        countdownKind: null,
        countdownRemainingMs: 0,
        pauseReasons: [],
        resumePhase: null,
        result,
      };
      return createTransition(nextState, true, [
        {
          type: EXPERIENCE_LIFECYCLE_EFFECTS.FINISHED,
          result,
        },
      ]);
    }

    case EXPERIENCE_LIFECYCLE_EVENTS.RESTART: {
      if (state.phase === EXPERIENCE_PHASES.READY) {
        return createTransition(state);
      }
      let nextState = {
        ...state,
        phase: EXPERIENCE_PHASES.READY,
        attempt: state.attempt + 1,
        elapsedMs: 0,
        countdownKind: null,
        countdownRemainingMs: 0,
        pauseReasons: [],
        resumePhase: null,
        result: null,
      };
      if (event.start !== false) {
        nextState = createStartedState(nextState);
      }
      return createTransition(nextState, true, [
        {
          type: EXPERIENCE_LIFECYCLE_EFFECTS.RESTARTED,
          attempt: nextState.attempt,
          phase: nextState.phase,
        },
      ]);
    }

    case EXPERIENCE_LIFECYCLE_EVENTS.EXIT:
      return createTransition(state, true, [
        {
          type: EXPERIENCE_LIFECYCLE_EFFECTS.EXIT_REQUESTED,
          phase: state.phase,
          attempt: state.attempt,
          result: state.result,
        },
      ]);

    default:
      return createTransition(state);
  }
}

export function reduceExperienceLifecycle(state, event) {
  return transitionExperienceLifecycle(state, event).state;
}
