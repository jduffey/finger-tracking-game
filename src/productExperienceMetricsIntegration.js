function defaultNow() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

function defaultLoadMetricsModule() {
  return import("./productExperienceMetrics.js");
}

function reportSafely(onError, error) {
  try {
    onError?.(error);
  } catch {
    // Product measurement must never interrupt play.
  }
}

/**
 * Loads the aggregate metrics implementation only after a scored experience
 * starts. Calls made while the chunk is loading remain ordered on the session
 * promise, while failures degrade to an inert session.
 */
export function createLazyProductExperienceMetrics({
  loadMetricsModule = defaultLoadMetricsModule,
  now = defaultNow,
  onError,
  storage,
} = {}) {
  if (typeof loadMetricsModule !== "function" || typeof now !== "function") {
    throw new TypeError("Metrics integration requires loader and clock functions.");
  }

  let storePromise = null;
  let generation = 0;

  function getStore() {
    if (!storePromise) {
      storePromise = Promise.resolve()
        .then(() => loadMetricsModule())
        .then((metricsModule) => {
          if (
            typeof metricsModule?.createProductExperienceMetricsStore !==
            "function"
          ) {
            throw new TypeError("The product metrics module is unavailable.");
          }
          return metricsModule.createProductExperienceMetricsStore({ storage });
        })
        .catch((error) => {
          reportSafely(onError, error);
          return null;
        });
    }
    return storePromise;
  }

  function beginExperience({
    modeId,
    tutorial = false,
    timestampMs = now(),
  } = {}) {
    const sessionGeneration = generation;
    const sessionPromise = getStore()
      .then((store) => {
        if (sessionGeneration !== generation) {
          return null;
        }
        return (
          store?.beginExperience({
            modeId,
            tutorial,
            timestampMs,
          }) ?? null
        );
      })
      .catch((error) => {
        reportSafely(onError, error);
        return null;
      });

    const invoke = (method, ...args) =>
      sessionPromise
        .then((session) =>
          sessionGeneration === generation
            ? session?.[method]?.(...args) ?? false
            : false,
        )
        .catch((error) => {
          reportSafely(onError, error);
          return false;
        });

    return Object.freeze({
      modeId,
      recordSelection(input) {
        return invoke("recordSelection", input);
      },
      recordFirstSuccess(eventTimestampMs) {
        return invoke("recordFirstSuccess", eventTimestampMs);
      },
      beginTrackingLoss(eventTimestampMs) {
        return invoke("beginTrackingLoss", eventTimestampMs);
      },
      endTrackingLoss(eventTimestampMs) {
        return invoke("endTrackingLoss", eventTimestampMs);
      },
      finishTutorial(outcome) {
        return invoke("finishTutorial", outcome);
      },
      recordRetry() {
        return invoke("recordRetry");
      },
      complete(eventTimestampMs) {
        return invoke("complete", eventTimestampMs);
      },
      abandon(eventTimestampMs) {
        return invoke("abandon", eventTimestampMs);
      },
    });
  }

  function reset() {
    generation += 1;
    if (!storePromise) {
      return Promise.resolve(false);
    }
    return storePromise
      .then((store) => {
        store?.reset?.();
        return Boolean(store);
      })
      .catch((error) => {
        reportSafely(onError, error);
        return false;
      });
  }

  return Object.freeze({
    beginExperience,
    getStore,
    reset,
  });
}

const defaultProductExperienceMetrics =
  createLazyProductExperienceMetrics();

export function beginMeasuredProductExperience(options) {
  return defaultProductExperienceMetrics.beginExperience(options);
}

export function resetMeasuredProductExperiences() {
  return defaultProductExperienceMetrics.reset();
}
