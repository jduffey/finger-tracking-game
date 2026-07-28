import test from "node:test";
import assert from "node:assert/strict";
import {
  closeAudioContext,
  createMediaTrackingSessionController,
  isMediaTrackingSessionCancelledError,
} from "../src/mediaTrackingSession.js";

test("restarting releases the previous stream and detector before activating replacements", async () => {
  const first = createResources("first");
  const second = createResources("second");
  const resources = [first, second];
  const sessionChanges = [];
  const video = createVideo();
  const controller = createController({
    resources,
    video,
    onSessionChange: (session) => sessionChanges.push(session),
  });

  await controller.start();
  await controller.start();

  assert.equal(first.track.stopCalls, 1);
  assert.equal(first.detector.disposeCalls, 1);
  assert.equal(second.track.stopCalls, 0);
  assert.equal(second.detector.disposeCalls, 0);
  assert.equal(video.srcObject, second.stream);
  assert.equal(sessionChanges.at(-1)?.stream, second.stream);
});

test("a detector startup failure stops the acquired stream and detaches the video", async () => {
  const resource = createResources("failed");
  const video = createVideo();
  const controller = createMediaTrackingSessionController({
    requestStream: async () => resource.stream,
    createDetector: async () => {
      throw new Error("detector failed");
    },
    getVideoElement: () => video,
    waitForVideoMetadata: async () => {},
  });

  await assert.rejects(controller.start(), /detector failed/);

  assert.equal(resource.track.stopCalls, 1);
  assert.equal(video.pauseCalls, 1);
  assert.equal(video.srcObject, null);
});

test("a detector that resolves after stop is disposed instead of becoming active", async () => {
  const resource = createResources("late-detector");
  const detectorDeferred = createDeferred();
  const video = createVideo();
  const controller = createMediaTrackingSessionController({
    requestStream: async () => resource.stream,
    createDetector: () => detectorDeferred.promise,
    getVideoElement: () => video,
    waitForVideoMetadata: async () => {},
  });

  const starting = controller.start();
  await waitFor(() => video.playCalls === 1);
  await controller.stop();
  detectorDeferred.resolve(resource.detector);

  await assert.rejects(starting, isMediaTrackingSessionCancelledError);
  assert.equal(resource.track.stopCalls, 1);
  assert.equal(resource.detector.disposeCalls, 1);
  assert.equal(video.srcObject, null);
});

test("a stream that resolves after close is stopped and cannot attach to the video", async () => {
  const resource = createResources("late-stream");
  const streamDeferred = createDeferred();
  const video = createVideo();
  let streamRequested = false;
  const controller = createMediaTrackingSessionController({
    requestStream: () => {
      streamRequested = true;
      return streamDeferred.promise;
    },
    createDetector: async () => resource.detector,
    getVideoElement: () => video,
    waitForVideoMetadata: async () => {},
  });

  const starting = controller.start();
  await waitFor(() => streamRequested);
  await controller.close();
  streamDeferred.resolve(resource.stream);

  await assert.rejects(starting, isMediaTrackingSessionCancelledError);
  assert.equal(resource.track.stopCalls, 1);
  assert.equal(resource.detector.disposeCalls, 0);
  assert.equal(video.playCalls, 0);
  assert.equal(video.srcObject, null);
});

test("late cleanup from a superseded start does not pause the replacement video", async () => {
  const first = createResources("first");
  const second = createResources("second");
  const firstMetadata = createDeferred();
  const video = createVideo();
  let requestCount = 0;
  const controller = createMediaTrackingSessionController({
    requestStream: async () => {
      requestCount += 1;
      return requestCount === 1 ? first.stream : second.stream;
    },
    createDetector: async () => (requestCount === 1 ? first.detector : second.detector),
    getVideoElement: () => video,
    waitForVideoMetadata: () =>
      requestCount === 1 ? firstMetadata.promise : Promise.resolve(),
  });

  const firstStart = controller.start();
  await waitFor(() => video.srcObject === first.stream);
  await controller.start();
  firstMetadata.resolve();

  await assert.rejects(firstStart, isMediaTrackingSessionCancelledError);
  assert.equal(first.track.stopCalls, 1);
  assert.equal(video.pauseCalls, 0);
  assert.equal(video.srcObject, second.stream);
});

test("cleanup failures do not prevent the remaining resources from being released", async () => {
  const cleanupErrors = [];
  const track = {
    stop() {
      throw new Error("track cleanup failed");
    },
  };
  const detector = {
    async dispose() {
      throw new Error("detector cleanup failed");
    },
  };
  const video = createVideo();
  const controller = createMediaTrackingSessionController({
    requestStream: async () => ({
      getTracks: () => [track],
    }),
    createDetector: async () => detector,
    getVideoElement: () => video,
    waitForVideoMetadata: async () => {},
    onCleanupError: (error, resourceType) => {
      cleanupErrors.push([resourceType, error.message]);
    },
  });

  await controller.start();
  await controller.stop();

  assert.deepEqual(cleanupErrors, [
    ["stream-track", "track cleanup failed"],
    ["detector", "detector cleanup failed"],
  ]);
  assert.equal(video.srcObject, null);
});

test("closeAudioContext closes a live context and ignores one that is already closed", async () => {
  const liveContext = {
    state: "running",
    closeCalls: 0,
    async close() {
      this.closeCalls += 1;
      this.state = "closed";
    },
  };
  const closedContext = {
    state: "closed",
    closeCalls: 0,
    async close() {
      this.closeCalls += 1;
    },
  };

  await closeAudioContext(liveContext);
  await closeAudioContext(closedContext);

  assert.equal(liveContext.closeCalls, 1);
  assert.equal(closedContext.closeCalls, 0);
});

function createController({ resources, video, onSessionChange = () => {} }) {
  let resourceIndex = 0;
  let pendingResource = null;

  return createMediaTrackingSessionController({
    requestStream: async () => {
      pendingResource = resources[resourceIndex];
      return pendingResource.stream;
    },
    createDetector: async () => {
      const detector = pendingResource.detector;
      resourceIndex += 1;
      return detector;
    },
    getVideoElement: () => video,
    waitForVideoMetadata: async () => {},
    onSessionChange,
  });
}

function createResources(label) {
  const track = {
    label,
    stopCalls: 0,
    stop() {
      this.stopCalls += 1;
    },
  };
  const detector = {
    label,
    disposeCalls: 0,
    dispose() {
      this.disposeCalls += 1;
    },
  };
  const stream = {
    label,
    getTracks: () => [track],
  };
  return {
    detector,
    stream,
    track,
  };
}

function createVideo() {
  return {
    pauseCalls: 0,
    playCalls: 0,
    srcObject: null,
    pause() {
      this.pauseCalls += 1;
    },
    async play() {
      this.playCalls += 1;
    },
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve,
  };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Condition was not reached.");
}
