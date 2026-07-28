import test from "node:test";
import assert from "node:assert/strict";
import {
  attachCameraStreamToVideo,
  getCameraVideoKeepAliveAction,
  getStaleInferenceKeepAliveAction,
  observeCameraStreamInterruptions,
  releaseCameraStream,
  shouldRunTrackingKeepAlive,
} from "../src/trackingKeepAlive.js";

function createStream(trackReadyState = "live", options = {}) {
  const track = options.track ?? { readyState: trackReadyState };
  return {
    active: options.active ?? true,
    getVideoTracks() {
      return [track];
    },
    getTracks() {
      return [track];
    },
  };
}

test("camera video keep-alive leaves a healthy active video alone", () => {
  const stream = createStream();
  const video = {
    srcObject: stream,
    paused: false,
    ended: false,
    readyState: 4,
  };

  assert.deepEqual(
    getCameraVideoKeepAliveAction({ video, stream, attachedVideoElement: video }),
    {
      shouldAttach: false,
      shouldRecover: false,
      reason: "healthy",
      readyState: 4,
      paused: false,
      ended: false,
      trackCount: 1,
      liveTrackCount: 1,
      streamInactive: false,
      srcObjectChanged: false,
      activeElementChanged: false,
      playbackPaused: false,
      waitingForVideoData: false,
    },
  );
});

test("camera video keep-alive resumes paused playback on the live stream", () => {
  const stream = createStream();
  const video = {
    srcObject: stream,
    paused: true,
    ended: false,
    readyState: 4,
  };

  const action = getCameraVideoKeepAliveAction({
    video,
    stream,
    attachedVideoElement: video,
  });

  assert.equal(action.shouldAttach, true);
  assert.equal(action.reason, "playback_paused");
  assert.equal(action.playbackPaused, true);
});

test("camera video keep-alive reattaches when fullscreen swaps the active video element", () => {
  const stream = createStream();
  const previousVideo = { srcObject: stream, paused: false, ended: false, readyState: 4 };
  const nextVideo = { srcObject: stream, paused: false, ended: false, readyState: 4 };

  const action = getCameraVideoKeepAliveAction({
    video: nextVideo,
    stream,
    attachedVideoElement: previousVideo,
  });

  assert.equal(action.shouldAttach, true);
  assert.equal(action.reason, "active_video_element_changed");
});

test("camera video keep-alive invalidates readiness when the video or stream disappears", () => {
  const stream = createStream();
  const video = {
    srcObject: null,
    paused: false,
    ended: false,
    readyState: 4,
  };

  const missingVideo = getCameraVideoKeepAliveAction({
    video: null,
    stream,
  });
  const missingStream = getCameraVideoKeepAliveAction({
    video,
    stream: null,
  });

  assert.equal(missingVideo.shouldRecover, true);
  assert.equal(missingVideo.reason, "missing_video");
  assert.equal(missingStream.shouldRecover, true);
  assert.equal(missingStream.reason, "missing_stream");
});

test("camera video attachment restores the previous source when playback fails", async () => {
  const previousStream = {};
  const candidateStream = {};
  const playbackError = new Error("playback failed");
  const video = {
    srcObject: previousStream,
    play: async () => {
      throw playbackError;
    },
  };

  await assert.rejects(
    attachCameraStreamToVideo({
      video,
      stream: candidateStream,
    }),
    playbackError,
  );
  assert.equal(video.srcObject, previousStream);
});

test("camera video attachment reports a successful stream transaction", async () => {
  const stream = {};
  let playCalls = 0;
  const video = {
    srcObject: null,
    play: async () => {
      playCalls += 1;
    },
  };

  const result = await attachCameraStreamToVideo({ video, stream });

  assert.deepEqual(result, {
    attached: true,
    srcObjectChanged: true,
  });
  assert.equal(video.srcObject, stream);
  assert.equal(playCalls, 1);
});

test("camera video keep-alive requests stream recovery when the video track ended", () => {
  const stream = createStream("ended");
  const video = {
    srcObject: stream,
    paused: false,
    ended: false,
    readyState: 4,
  };

  const action = getCameraVideoKeepAliveAction({
    video,
    stream,
    attachedVideoElement: video,
  });

  assert.equal(action.shouldAttach, false);
  assert.equal(action.shouldRecover, true);
  assert.equal(action.reason, "no_live_video_track");
  assert.equal(action.liveTrackCount, 0);
});

test("camera video keep-alive requests stream recovery when the stream is inactive", () => {
  const stream = createStream("live", { active: false });
  const video = {
    srcObject: stream,
    paused: false,
    ended: false,
    readyState: 4,
  };

  const action = getCameraVideoKeepAliveAction({
    video,
    stream,
    attachedVideoElement: video,
  });

  assert.equal(action.shouldAttach, false);
  assert.equal(action.shouldRecover, true);
  assert.equal(action.reason, "stream_inactive");
  assert.equal(action.streamInactive, true);
});

test("camera stream release detaches matching videos and stops every track", () => {
  const stoppedTracks = [];
  const tracks = [
    { stop: () => stoppedTracks.push("video") },
    { stop: () => stoppedTracks.push("audio") },
  ];
  const stream = {
    getTracks: () => tracks,
  };
  const matchingVideo = { srcObject: stream };
  const unrelatedStream = {};
  const unrelatedVideo = { srcObject: unrelatedStream };

  const result = releaseCameraStream({
    stream,
    videoElements: [matchingVideo, matchingVideo, unrelatedVideo],
  });

  assert.deepEqual(result, {
    detachedVideoCount: 1,
    stoppedTrackCount: 2,
  });
  assert.equal(matchingVideo.srcObject, null);
  assert.equal(unrelatedVideo.srcObject, unrelatedStream);
  assert.deepEqual(stoppedTracks, ["video", "audio"]);
});

test("camera stream interruption observer reports one ended or inactive event and unsubscribes", () => {
  const track = new EventTarget();
  track.readyState = "live";
  const stream = new EventTarget();
  stream.active = true;
  stream.getVideoTracks = () => [track];
  const reasons = [];

  const stopObserving = observeCameraStreamInterruptions(stream, (reason) => {
    reasons.push(reason);
  });

  track.dispatchEvent(new Event("ended"));
  stream.dispatchEvent(new Event("inactive"));
  assert.deepEqual(reasons, ["video_track_ended"]);

  stopObserving();
  track.dispatchEvent(new Event("ended"));
  assert.deepEqual(reasons, ["video_track_ended"]);
});

test("stale inference keep-alive recovers only after the stale window and cooldown", () => {
  assert.equal(
    getStaleInferenceKeepAliveAction({
      now: 12000,
      inferenceBusy: true,
      inferenceStartedAt: 5000,
      staleMs: 8000,
    }).shouldRecover,
    false,
  );

  assert.equal(
    getStaleInferenceKeepAliveAction({
      now: 14000,
      inferenceBusy: true,
      inferenceStartedAt: 5000,
      staleMs: 8000,
    }).shouldRecover,
    true,
  );

  const coolingDown = getStaleInferenceKeepAliveAction({
    now: 14000,
    inferenceBusy: true,
    inferenceStartedAt: 5000,
    lastRecoveryAt: 10000,
    staleMs: 8000,
    cooldownMs: 30000,
  });
  assert.equal(coolingDown.shouldRecover, false);
  assert.equal(coolingDown.reason, "recovery_cooldown");
});

test("tracking keep-alive scheduler runs immediately and then on its interval", () => {
  assert.equal(shouldRunTrackingKeepAlive({ now: 1000, lastRunAt: 0, intervalMs: 5000 }), true);
  assert.equal(
    shouldRunTrackingKeepAlive({ now: 4000, lastRunAt: 1000, intervalMs: 5000 }),
    false,
  );
  assert.equal(
    shouldRunTrackingKeepAlive({ now: 6000, lastRunAt: 1000, intervalMs: 5000 }),
    true,
  );
});
