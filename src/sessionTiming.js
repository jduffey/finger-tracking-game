export const SESSION_TIMING_STATES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  STOPPED: "stopped",
});

export const DEFAULT_FIXED_STEP_SECONDS = 1 / 60;
export const DEFAULT_MAX_CATCH_UP_STEPS = 5;

const STEP_EPSILON_MS = 1e-7;

function defaultNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function requirePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
  return value;
}

function requireCatchUpStepCount(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("maxCatchUpSteps must be a positive integer.");
  }
  return value;
}

function seconds(milliseconds) {
  return milliseconds / 1000;
}

/**
 * Creates a monotonic session clock backed by an accumulator-based fixed step.
 *
 * The active clock records all wall time while running. The simulation clock
 * records only fixed steps that were actually executed. Large frame gaps run at
 * most `maxCatchUpSteps`; excess whole steps are reported as dropped time while
 * the fractional remainder is retained for interpolation.
 */
export function createFixedStepSessionTiming(options = {}) {
  const stepSeconds = requirePositiveNumber(
    options.stepSeconds ?? DEFAULT_FIXED_STEP_SECONDS,
    "stepSeconds",
  );
  const stepMs = stepSeconds * 1000;
  const maxCatchUpSteps = requireCatchUpStepCount(
    options.maxCatchUpSteps ?? DEFAULT_MAX_CATCH_UP_STEPS,
  );
  const readNow = typeof options.now === "function" ? options.now : defaultNow;
  const configuredStepHandler =
    typeof options.onStep === "function" ? options.onStep : null;

  let state = SESSION_TIMING_STATES.IDLE;
  let startedAtMs = null;
  let endedAtMs = null;
  let lastTimestampMs = null;
  let activeElapsedMs = 0;
  let simulatedElapsedMs = 0;
  let accumulatorMs = 0;
  let droppedElapsedMs = 0;
  let discardedElapsedMs = 0;
  let totalSteps = 0;

  function resolveTimestamp(timestamp) {
    const value = timestamp === undefined ? readNow() : timestamp;
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError("timestamp must be a non-negative finite number.");
    }
    return value;
  }

  function monotonicTimestamp(timestamp) {
    const resolved = resolveTimestamp(timestamp);
    return lastTimestampMs === null ? resolved : Math.max(lastTimestampMs, resolved);
  }

  function getSessionEnd(timestamp) {
    if (state === SESSION_TIMING_STATES.IDLE || startedAtMs === null) {
      return null;
    }
    if (state === SESSION_TIMING_STATES.STOPPED) {
      return endedAtMs;
    }
    return Math.max(startedAtMs, resolveTimestamp(timestamp));
  }

  function createSnapshot(timestamp, frame = {}) {
    const sessionEnd = getSessionEnd(timestamp);
    const sessionElapsedMs =
      sessionEnd === null || startedAtMs === null ? 0 : Math.max(0, sessionEnd - startedAtMs);
    const projectedActiveElapsedMs =
      state === SESSION_TIMING_STATES.RUNNING &&
      lastTimestampMs !== null &&
      sessionEnd !== null
        ? activeElapsedMs + Math.max(0, sessionEnd - lastTimestampMs)
        : activeElapsedMs;
    const pausedElapsedMs = Math.max(0, sessionElapsedMs - projectedActiveElapsedMs);
    const interpolationRemainderMs =
      accumulatorMs <= 0 ? 0 : accumulatorMs % stepMs;

    return Object.freeze({
      state,
      running: state === SESSION_TIMING_STATES.RUNNING,
      paused: state === SESSION_TIMING_STATES.PAUSED,
      stepSeconds,
      stepMs,
      maxCatchUpSteps,
      steps: frame.steps ?? 0,
      totalSteps,
      frameDeltaMs: frame.frameDeltaMs ?? 0,
      frameDeltaSeconds: seconds(frame.frameDeltaMs ?? 0),
      droppedFrameMs: frame.droppedFrameMs ?? 0,
      discardedFrameMs: frame.discardedFrameMs ?? 0,
      droppedElapsedMs,
      droppedElapsedSeconds: seconds(droppedElapsedMs),
      discardedElapsedMs,
      discardedElapsedSeconds: seconds(discardedElapsedMs),
      accumulatorMs,
      interpolationAlpha: interpolationRemainderMs / stepMs,
      elapsedMs: projectedActiveElapsedMs,
      elapsedSeconds: seconds(projectedActiveElapsedMs),
      activeElapsedMs: projectedActiveElapsedMs,
      activeElapsedSeconds: seconds(projectedActiveElapsedMs),
      simulatedElapsedMs,
      simulatedElapsedSeconds: seconds(simulatedElapsedMs),
      sessionElapsedMs,
      sessionElapsedSeconds: seconds(sessionElapsedMs),
      pausedElapsedMs,
      pausedElapsedSeconds: seconds(pausedElapsedMs),
      startedAtMs,
      endedAtMs,
      lastTimestampMs,
    });
  }

  function start(timestamp) {
    const currentTimestamp = resolveTimestamp(timestamp);
    state = SESSION_TIMING_STATES.RUNNING;
    startedAtMs = currentTimestamp;
    endedAtMs = null;
    lastTimestampMs = currentTimestamp;
    activeElapsedMs = 0;
    simulatedElapsedMs = 0;
    accumulatorMs = 0;
    droppedElapsedMs = 0;
    discardedElapsedMs = 0;
    totalSteps = 0;
    return createSnapshot(currentTimestamp);
  }

  function advance(timestamp, onStep) {
    const currentTimestamp = monotonicTimestamp(timestamp);
    if (state === SESSION_TIMING_STATES.IDLE) {
      return start(currentTimestamp);
    }
    if (state !== SESSION_TIMING_STATES.RUNNING) {
      return createSnapshot(currentTimestamp);
    }

    const frameDeltaMs = Math.max(0, currentTimestamp - lastTimestampMs);
    lastTimestampMs = currentTimestamp;
    activeElapsedMs += frameDeltaMs;
    accumulatorMs += frameDeltaMs;

    const stepHandler = typeof onStep === "function" ? onStep : configuredStepHandler;
    const availableSteps = Math.floor((accumulatorMs + STEP_EPSILON_MS) / stepMs);
    const steps = Math.min(availableSteps, maxCatchUpSteps);

    for (let frameStepIndex = 0; frameStepIndex < steps; frameStepIndex += 1) {
      accumulatorMs = Math.max(0, accumulatorMs - stepMs);
      simulatedElapsedMs += stepMs;
      totalSteps += 1;
      stepHandler?.(
        stepSeconds,
        Object.freeze({
          frameStepIndex,
          stepIndex: totalSteps,
          simulatedElapsedMs,
          simulatedElapsedSeconds: seconds(simulatedElapsedMs),
          activeElapsedMs,
          activeElapsedSeconds: seconds(activeElapsedMs),
          sessionElapsedMs: currentTimestamp - startedAtMs,
          sessionElapsedSeconds: seconds(currentTimestamp - startedAtMs),
        }),
      );
    }

    const excessWholeSteps = Math.floor((accumulatorMs + STEP_EPSILON_MS) / stepMs);
    const droppedFrameMs = excessWholeSteps * stepMs;
    if (droppedFrameMs > 0) {
      accumulatorMs = Math.max(0, accumulatorMs - droppedFrameMs);
      droppedElapsedMs += droppedFrameMs;
    }

    return createSnapshot(currentTimestamp, {
      droppedFrameMs,
      frameDeltaMs,
      steps,
    });
  }

  function pause(timestamp) {
    const currentTimestamp = monotonicTimestamp(timestamp);
    if (state !== SESSION_TIMING_STATES.RUNNING) {
      return createSnapshot(currentTimestamp);
    }

    const activeFrameMs = Math.max(0, currentTimestamp - lastTimestampMs);
    activeElapsedMs += activeFrameMs;
    const discardedFrameMs = accumulatorMs + activeFrameMs;
    discardedElapsedMs += discardedFrameMs;
    accumulatorMs = 0;
    lastTimestampMs = currentTimestamp;
    state = SESSION_TIMING_STATES.PAUSED;
    return createSnapshot(currentTimestamp, {
      discardedFrameMs,
      frameDeltaMs: activeFrameMs,
    });
  }

  function resume(timestamp) {
    const currentTimestamp = monotonicTimestamp(timestamp);
    if (state !== SESSION_TIMING_STATES.PAUSED) {
      return createSnapshot(currentTimestamp);
    }

    state = SESSION_TIMING_STATES.RUNNING;
    lastTimestampMs = currentTimestamp;
    accumulatorMs = 0;
    return createSnapshot(currentTimestamp);
  }

  function stop(timestamp) {
    const currentTimestamp = monotonicTimestamp(timestamp);
    if (state === SESSION_TIMING_STATES.IDLE) {
      return createSnapshot(currentTimestamp);
    }
    if (state === SESSION_TIMING_STATES.STOPPED) {
      return createSnapshot(endedAtMs);
    }

    let discardedFrameMs = 0;
    let activeFrameMs = 0;
    if (state === SESSION_TIMING_STATES.RUNNING) {
      activeFrameMs = Math.max(0, currentTimestamp - lastTimestampMs);
      activeElapsedMs += activeFrameMs;
      discardedFrameMs = accumulatorMs + activeFrameMs;
      discardedElapsedMs += discardedFrameMs;
    }

    accumulatorMs = 0;
    lastTimestampMs = currentTimestamp;
    endedAtMs = currentTimestamp;
    state = SESSION_TIMING_STATES.STOPPED;
    return createSnapshot(currentTimestamp, {
      discardedFrameMs,
      frameDeltaMs: activeFrameMs,
    });
  }

  function reset() {
    state = SESSION_TIMING_STATES.IDLE;
    startedAtMs = null;
    endedAtMs = null;
    lastTimestampMs = null;
    activeElapsedMs = 0;
    simulatedElapsedMs = 0;
    accumulatorMs = 0;
    droppedElapsedMs = 0;
    discardedElapsedMs = 0;
    totalSteps = 0;
    return createSnapshot(0);
  }

  function snapshot(timestamp) {
    if (state === SESSION_TIMING_STATES.IDLE) {
      return createSnapshot(0);
    }
    return createSnapshot(monotonicTimestamp(timestamp));
  }

  return Object.freeze({
    advance,
    pause,
    reset,
    resume,
    snapshot,
    start,
    stop,
  });
}
