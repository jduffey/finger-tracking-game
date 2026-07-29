export const TRACKING_KEEP_ALIVE_INTERVAL_MS = 5000;
export const TRACKING_STALE_INFERENCE_MS = 8000;
export const TRACKING_DETECTOR_RECOVERY_COOLDOWN_MS = 30000;
export const CAMERA_INTERRUPTION_RETRY_DELAY_MS = 750;

export function shouldRunTrackingKeepAlive({
  now,
  lastRunAt,
  intervalMs = TRACKING_KEEP_ALIVE_INTERVAL_MS,
}) {
  if (!Number.isFinite(now)) {
    return false;
  }

  if (!Number.isFinite(lastRunAt) || lastRunAt <= 0) {
    return true;
  }

  return now - lastRunAt >= Math.max(0, intervalMs);
}

export function getCameraVideoKeepAliveAction({
  video,
  stream,
  attachedVideoElement = null,
}) {
  if (!video) {
    return createVideoAction(false, "missing_video", {
      shouldRecover: true,
    });
  }
  if (!stream) {
    return createVideoAction(false, "missing_stream", {
      video,
      shouldRecover: true,
    });
  }

  const videoTracks =
    typeof stream.getVideoTracks === "function" ? stream.getVideoTracks() : [];
  const liveVideoTracks = videoTracks.filter((track) => track?.readyState !== "ended");
  const hasLiveVideoTrack = liveVideoTracks.length > 0;
  const streamInactive = stream.active === false;
  const srcObjectChanged = video.srcObject !== stream;
  const activeElementChanged = Boolean(attachedVideoElement && attachedVideoElement !== video);
  const playbackPaused = Boolean(video.paused || video.ended);
  const waitingForVideoData = Number.isFinite(video.readyState) && video.readyState < 2;
  const shouldRecover = streamInactive || !hasLiveVideoTrack;
  const shouldAttach =
    !shouldRecover &&
    (srcObjectChanged || activeElementChanged || playbackPaused || waitingForVideoData);

  let reason = "healthy";
  if (streamInactive) {
    reason = "stream_inactive";
  } else if (!hasLiveVideoTrack) {
    reason = "no_live_video_track";
  } else if (srcObjectChanged) {
    reason = "stream_detached";
  } else if (activeElementChanged) {
    reason = "active_video_element_changed";
  } else if (playbackPaused) {
    reason = "playback_paused";
  } else if (waitingForVideoData) {
    reason = "waiting_for_video_data";
  }

  return createVideoAction(shouldAttach, reason, {
    video,
    trackCount: videoTracks.length,
    liveTrackCount: liveVideoTracks.length,
    streamInactive,
    shouldRecover,
    srcObjectChanged,
    activeElementChanged,
    playbackPaused,
    waitingForVideoData,
  });
}

export async function attachCameraStreamToVideo({ video, stream } = {}) {
  if (!video || !stream) {
    return {
      attached: false,
      srcObjectChanged: false,
    };
  }

  const previousSrcObject = video.srcObject;
  const srcObjectChanged = previousSrcObject !== stream;
  if (srcObjectChanged) {
    video.srcObject = stream;
  }

  try {
    await video.play();
  } catch (error) {
    if (srcObjectChanged && video.srcObject === stream) {
      video.srcObject = previousSrcObject ?? null;
    }
    throw error;
  }

  return {
    attached: true,
    srcObjectChanged,
  };
}

export function releaseCameraStream({ stream, videoElements = [] } = {}) {
  if (!stream) {
    return {
      detachedVideoCount: 0,
      stoppedTrackCount: 0,
    };
  }

  let detachedVideoCount = 0;
  const uniqueVideoElements = new Set(videoElements.filter(Boolean));
  for (const video of uniqueVideoElements) {
    if (video.srcObject === stream) {
      video.srcObject = null;
      detachedVideoCount += 1;
    }
  }

  const tracks = typeof stream.getTracks === "function" ? stream.getTracks() : [];
  let stoppedTrackCount = 0;
  for (const track of tracks) {
    if (typeof track?.stop === "function") {
      track.stop();
      stoppedTrackCount += 1;
    }
  }

  return {
    detachedVideoCount,
    stoppedTrackCount,
  };
}

export function observeCameraStreamInterruptions(stream, onInterrupted) {
  if (!stream || typeof onInterrupted !== "function") {
    return () => {};
  }

  const subscriptions = [];
  let active = true;

  const subscribe = (target, eventName, reason) => {
    if (typeof target?.addEventListener !== "function") {
      return;
    }

    const listener = () => {
      if (!active) {
        return;
      }
      active = false;
      onInterrupted(reason);
    };
    target.addEventListener(eventName, listener);
    subscriptions.push(() => target.removeEventListener?.(eventName, listener));
  };

  subscribe(stream, "inactive", "stream_inactive");
  const videoTracks =
    typeof stream.getVideoTracks === "function" ? stream.getVideoTracks() : [];
  videoTracks.forEach((track) => subscribe(track, "ended", "video_track_ended"));

  return () => {
    active = false;
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

export function getStaleInferenceKeepAliveAction({
  now,
  inferenceBusy,
  inferenceStartedAt,
  recoveryInProgress = false,
  lastRecoveryAt = 0,
  staleMs = TRACKING_STALE_INFERENCE_MS,
  cooldownMs = TRACKING_DETECTOR_RECOVERY_COOLDOWN_MS,
}) {
  if (!Number.isFinite(now)) {
    return createInferenceAction(false, "invalid_time");
  }

  if (!inferenceBusy) {
    return createInferenceAction(false, "idle");
  }

  if (recoveryInProgress) {
    return createInferenceAction(false, "recovery_in_progress");
  }

  if (!Number.isFinite(inferenceStartedAt) || inferenceStartedAt <= 0) {
    return createInferenceAction(false, "missing_start_time");
  }

  const ageMs = Math.max(0, now - inferenceStartedAt);
  const recoveryAgeMs =
    Number.isFinite(lastRecoveryAt) && lastRecoveryAt > 0
      ? Math.max(0, now - lastRecoveryAt)
      : Number.POSITIVE_INFINITY;
  const cooldownRemainingMs = Math.max(0, Math.max(0, cooldownMs) - recoveryAgeMs);

  if (cooldownRemainingMs > 0) {
    return createInferenceAction(false, "recovery_cooldown", {
      ageMs,
      cooldownRemainingMs,
    });
  }

  if (ageMs < Math.max(0, staleMs)) {
    return createInferenceAction(false, "within_stale_window", {
      ageMs,
      cooldownRemainingMs,
    });
  }

  return createInferenceAction(true, "stale_inference", {
    ageMs,
    cooldownRemainingMs,
  });
}

function createVideoAction(shouldAttach, reason, details = {}) {
  const video = details.video;
  return {
    shouldAttach,
    shouldRecover: Boolean(details.shouldRecover),
    reason,
    readyState: video?.readyState ?? null,
    paused: video ? Boolean(video.paused) : null,
    ended: video ? Boolean(video.ended) : null,
    trackCount: details.trackCount ?? 0,
    liveTrackCount: details.liveTrackCount ?? 0,
    streamInactive: Boolean(details.streamInactive),
    srcObjectChanged: Boolean(details.srcObjectChanged),
    activeElementChanged: Boolean(details.activeElementChanged),
    playbackPaused: Boolean(details.playbackPaused),
    waitingForVideoData: Boolean(details.waitingForVideoData),
  };
}

function createInferenceAction(shouldRecover, reason, details = {}) {
  return {
    shouldRecover,
    reason,
    ageMs: details.ageMs ?? 0,
    cooldownRemainingMs: details.cooldownRemainingMs ?? 0,
  };
}
