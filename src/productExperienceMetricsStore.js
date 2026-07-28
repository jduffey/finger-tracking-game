import {
  PRODUCT_EXPERIENCE_METRICS_PRIVACY,
  PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION,
  PRODUCT_METRIC_EVENT_TYPES,
  PRODUCT_METRIC_INPUT_METHODS,
  PRODUCT_METRIC_TUTORIAL_OUTCOMES,
  PRODUCT_METRICS_STORAGE_STATUS,
  clearProductExperienceMetrics,
  readProductExperienceMetrics,
  recordProductExperienceMetric,
  serializeProductExperienceMetrics,
  writeProductExperienceMetrics,
} from "./productExperienceMetricsCore.js";

const TUTORIAL_OUTCOMES = Object.freeze(
  Object.values(PRODUCT_METRIC_TUTORIAL_OUTCOMES),
);

function defaultNow() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

function resolveTimestamp(value, now) {
  const timestamp = value === undefined ? now() : value;
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError(
      "Metrics timestamps must be non-negative finite numbers.",
    );
  }
  return timestamp;
}

/**
 * Framework-agnostic integration:
 *
 * const session = metrics.beginExperience({ modeId, tutorial: true });
 * session.recordSelection({ succeeded: false, inputMethod: "gesture" });
 * session.recordFirstSuccess();
 * session.beginTrackingLoss();
 * session.endTrackingLoss();
 * session.finishTutorial("completed");
 * session.complete();
 *
 * Only aggregate reducer output is persisted. The session's monotonic timestamps
 * and one-shot flags remain in memory and disappear when the page closes.
 */
export function createProductExperienceMetricsStore({
  storage,
  now = defaultNow,
} = {}) {
  if (typeof now !== "function") {
    throw new TypeError("Metrics now must be a function.");
  }
  const initial = readProductExperienceMetrics(storage);
  let metrics = initial.metrics;
  let persistenceStatus = initial.status;
  let writesBlocked =
    initial.status === PRODUCT_METRICS_STORAGE_STATUS.UNSUPPORTED;
  const listeners = new Set();

  function getSnapshot() {
    return metrics;
  }

  function getPersistenceStatus() {
    return persistenceStatus;
  }

  function notify(event) {
    for (const listener of listeners) {
      try {
        listener(metrics, event);
      } catch {
        // Product instrumentation must never interrupt the experience.
      }
    }
  }

  function persist() {
    if (writesBlocked) {
      persistenceStatus = PRODUCT_METRICS_STORAGE_STATUS.WRITE_BLOCKED;
      return;
    }
    const written = writeProductExperienceMetrics(metrics, storage);
    persistenceStatus = written.status;
  }

  function record(event) {
    const recorded = recordProductExperienceMetric(metrics, event);
    if (!recorded.accepted) {
      return recorded;
    }
    metrics = recorded.metrics;
    persist();
    notify(recorded.event);
    return {
      ...recorded,
      persistenceStatus,
    };
  }

  function beginExperience({
    modeId,
    tutorial = false,
    timestampMs,
  } = {}) {
    const startedAtMs = resolveTimestamp(timestampMs, now);
    const started = record({
      type: PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_STARTED,
      modeId,
    });
    if (!started.accepted) {
      throw new TypeError("A valid modeId is required to begin metrics.");
    }
    if (tutorial) {
      record({
        type: PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_STARTED,
        modeId,
      });
    }

    let closed = false;
    let firstSuccessRecorded = false;
    let trackingLossStartedAtMs = null;
    let tutorialOutcome = tutorial ? null : "not-applicable";

    function recordSelection({
      succeeded,
      inputMethod = PRODUCT_METRIC_INPUT_METHODS.OTHER,
    } = {}) {
      if (closed) {
        return false;
      }
      return record({
        type: PRODUCT_METRIC_EVENT_TYPES.SELECTION_ATTEMPT,
        modeId,
        succeeded,
        inputMethod,
      }).accepted;
    }

    function recordFirstSuccess(timestampMs) {
      if (closed || firstSuccessRecorded) {
        return false;
      }
      const successAtMs = resolveTimestamp(timestampMs, now);
      const accepted = record({
        type: PRODUCT_METRIC_EVENT_TYPES.FIRST_SUCCESS,
        modeId,
        durationMs: Math.max(0, successAtMs - startedAtMs),
      }).accepted;
      firstSuccessRecorded = accepted;
      return accepted;
    }

    function beginTrackingLoss(timestampMs) {
      if (closed || trackingLossStartedAtMs !== null) {
        return false;
      }
      trackingLossStartedAtMs = resolveTimestamp(timestampMs, now);
      return true;
    }

    function endTrackingLoss(timestampMs) {
      if (trackingLossStartedAtMs === null) {
        return false;
      }
      const restoredAtMs = resolveTimestamp(timestampMs, now);
      const durationMs = Math.max(
        0,
        restoredAtMs - trackingLossStartedAtMs,
      );
      trackingLossStartedAtMs = null;
      return record({
        type: PRODUCT_METRIC_EVENT_TYPES.TRACKING_LOSS,
        modeId,
        durationMs,
      }).accepted;
    }

    function finishTutorial(outcome) {
      if (
        !tutorial ||
        tutorialOutcome !== null ||
        !TUTORIAL_OUTCOMES.includes(outcome)
      ) {
        return false;
      }
      const accepted = record({
        type: PRODUCT_METRIC_EVENT_TYPES.TUTORIAL_OUTCOME,
        modeId,
        outcome,
      }).accepted;
      if (accepted) {
        tutorialOutcome = outcome;
      }
      return accepted;
    }

    function recordRetry() {
      if (closed) {
        return false;
      }
      return record({
        type: PRODUCT_METRIC_EVENT_TYPES.RETRY,
        modeId,
      }).accepted;
    }

    function close(outcome, timestampMs) {
      if (closed) {
        return false;
      }
      if (trackingLossStartedAtMs !== null) {
        endTrackingLoss(timestampMs);
      }
      if (tutorial && tutorialOutcome === null) {
        finishTutorial(PRODUCT_METRIC_TUTORIAL_OUTCOMES.ABANDONED);
      }
      const accepted = record({
        type:
          outcome === "completed"
            ? PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_COMPLETED
            : PRODUCT_METRIC_EVENT_TYPES.EXPERIENCE_ABANDONED,
        modeId,
      }).accepted;
      closed = accepted;
      return accepted;
    }

    return Object.freeze({
      modeId,
      recordSelection,
      recordFirstSuccess,
      beginTrackingLoss,
      endTrackingLoss,
      finishTutorial,
      recordRetry,
      complete(timestampMs) {
        return close("completed", timestampMs);
      },
      abandon(timestampMs) {
        return close("abandoned", timestampMs);
      },
      isClosed() {
        return closed;
      },
    });
  }

  function reset() {
    const cleared = clearProductExperienceMetrics(storage);
    metrics = cleared.metrics;
    persistenceStatus = cleared.status;
    if (
      !writesBlocked ||
      cleared.status === PRODUCT_METRICS_STORAGE_STATUS.CLEARED
    ) {
      writesBlocked = false;
    }
    notify({ type: "metrics-reset" });
    return cleared;
  }

  function exportJSON(options) {
    return serializeProductExperienceMetrics(metrics, options);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Metrics listener must be a function.");
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    schemaVersion: PRODUCT_EXPERIENCE_METRICS_SCHEMA_VERSION,
    privacy: PRODUCT_EXPERIENCE_METRICS_PRIVACY,
    getSnapshot,
    getPersistenceStatus,
    record,
    beginExperience,
    exportJSON,
    reset,
    subscribe,
  });
}
