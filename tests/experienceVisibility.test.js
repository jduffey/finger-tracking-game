import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPERIENCE_LIFECYCLE_EVENTS,
  EXPERIENCE_PAUSE_REASONS,
} from "../src/experienceLifecycle.js";
import {
  createExperienceVisibilityEvent,
  isExperienceDocumentHidden,
  observeExperienceDocumentVisibility,
} from "../src/experienceVisibility.js";

function createFakeDocument(initialVisibility = "visible") {
  const listeners = new Map();
  return {
    hidden: initialVisibility === "hidden",
    visibilityState: initialVisibility,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    },
    setVisibility(visibilityState) {
      this.visibilityState = visibilityState;
      this.hidden = visibilityState === "hidden";
      listeners.get("visibilitychange")?.();
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

test("document visibility maps to scoped pause and resume events", () => {
  const documentTarget = createFakeDocument("hidden");

  assert.equal(isExperienceDocumentHidden(documentTarget), true);
  assert.deepEqual(createExperienceVisibilityEvent(documentTarget), {
    type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
    reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
  });

  documentTarget.setVisibility("visible");
  assert.equal(isExperienceDocumentHidden(documentTarget), false);
  assert.deepEqual(createExperienceVisibilityEvent(documentTarget), {
    type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
    reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
  });
});

test("visibility observer emits changes and has idempotent cleanup", () => {
  const documentTarget = createFakeDocument();
  const events = [];
  const stop = observeExperienceDocumentVisibility({
    documentTarget,
    dispatch: (event) => events.push(event),
    emitInitial: true,
  });

  assert.equal(documentTarget.listenerCount(), 1);
  assert.equal(events[0].type, EXPERIENCE_LIFECYCLE_EVENTS.RESUME);

  documentTarget.setVisibility("hidden");
  documentTarget.setVisibility("visible");
  assert.deepEqual(events.slice(1), [
    {
      type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
      reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
    },
    {
      type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
      reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
    },
  ]);

  stop();
  stop();
  assert.equal(documentTarget.listenerCount(), 0);
  documentTarget.setVisibility("hidden");
  assert.equal(events.length, 3);
});

test("visibility observer is safe without a DOM and validates its dispatcher", () => {
  const stop = observeExperienceDocumentVisibility({
    documentTarget: null,
    dispatch() {},
  });
  assert.doesNotThrow(stop);

  assert.throws(
    () =>
      observeExperienceDocumentVisibility({
        documentTarget: createFakeDocument(),
      }),
    /dispatcher is required/,
  );
});
