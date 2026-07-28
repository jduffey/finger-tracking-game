import {
  EXPERIENCE_LIFECYCLE_EVENTS,
  EXPERIENCE_PAUSE_REASONS,
} from "./experienceLifecycle.js";

export function isExperienceDocumentHidden(
  documentTarget = globalThis.document,
) {
  return Boolean(
    documentTarget &&
      (documentTarget.hidden === true ||
        documentTarget.visibilityState === "hidden"),
  );
}

export function createExperienceVisibilityEvent(
  documentTarget = globalThis.document,
) {
  return isExperienceDocumentHidden(documentTarget)
    ? {
        type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
        reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
      }
    : {
        type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
        reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
      };
}

/**
 * Converts document visibility changes into lifecycle events. The returned
 * cleanup is always safe to call, including during server rendering.
 */
export function observeExperienceDocumentVisibility({
  documentTarget = globalThis.document,
  dispatch,
  emitInitial = false,
} = {}) {
  if (typeof dispatch !== "function") {
    throw new TypeError("A lifecycle event dispatcher is required.");
  }
  if (
    !documentTarget ||
    typeof documentTarget.addEventListener !== "function" ||
    typeof documentTarget.removeEventListener !== "function"
  ) {
    return () => {};
  }

  let observing = true;
  const handleVisibilityChange = () => {
    if (!observing) {
      return;
    }
    dispatch(createExperienceVisibilityEvent(documentTarget));
  };

  documentTarget.addEventListener("visibilitychange", handleVisibilityChange);
  if (emitInitial) {
    handleVisibilityChange();
  }

  return () => {
    if (!observing) {
      return;
    }
    observing = false;
    documentTarget.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
}
