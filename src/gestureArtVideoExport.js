export const GESTURE_ART_VIDEO_DURATION_MS = 10_000;
export const GESTURE_ART_VIDEO_MAX_BYTES = 24 * 1024 * 1024;
export const GESTURE_ART_VIDEO_FRAME_RATE = 30;

export const GESTURE_ART_WEBM_TYPES = Object.freeze([
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
]);

function createExportError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = "GestureArtVideoExportError";
  error.code = code;
  return error;
}

function stopStreamTracks(stream) {
  for (const track of stream?.getTracks?.() ?? []) {
    try {
      track.stop();
    } catch {
      // A broken browser track must not prevent the remaining tracks from ending.
    }
  }
}

export function selectGestureArtWebmType(MediaRecorderCtor) {
  if (
    typeof MediaRecorderCtor !== "function" ||
    typeof MediaRecorderCtor.isTypeSupported !== "function"
  ) {
    return null;
  }

  for (const mimeType of GESTURE_ART_WEBM_TYPES) {
    try {
      if (MediaRecorderCtor.isTypeSupported(mimeType)) {
        return mimeType;
      }
    } catch {
      // Keep negotiating if a browser rejects one candidate unexpectedly.
    }
  }
  return null;
}

export function getGestureArtVideoExportCapability({
  canvas,
  MediaRecorderCtor = globalThis.MediaRecorder,
} = {}) {
  if (!canvas || typeof canvas.captureStream !== "function") {
    return {
      supported: false,
      reason: "canvas-stream-unavailable",
      mimeType: null,
    };
  }
  if (typeof MediaRecorderCtor !== "function") {
    return {
      supported: false,
      reason: "media-recorder-unavailable",
      mimeType: null,
    };
  }

  const mimeType = selectGestureArtWebmType(MediaRecorderCtor);
  if (!mimeType) {
    return {
      supported: false,
      reason: "webm-unavailable",
      mimeType: null,
    };
  }

  return {
    supported: true,
    reason: null,
    mimeType,
  };
}

/**
 * Records only the supplied artwork canvas. The returned controller always
 * stops the canvas capture tracks after completion, failure, or cancellation.
 */
export function startGestureArtCanvasRecording({
  canvas,
  durationMs = GESTURE_ART_VIDEO_DURATION_MS,
  frameRate = GESTURE_ART_VIDEO_FRAME_RATE,
  maxBytes = GESTURE_ART_VIDEO_MAX_BYTES,
  MediaRecorderCtor = globalThis.MediaRecorder,
  schedule = globalThis.setTimeout.bind(globalThis),
  cancelSchedule = globalThis.clearTimeout.bind(globalThis),
} = {}) {
  const capability = getGestureArtVideoExportCapability({
    canvas,
    MediaRecorderCtor,
  });
  if (!capability.supported) {
    throw createExportError(
      capability.reason,
      "WebM canvas recording is not available in this browser.",
    );
  }

  const boundedDuration = Math.min(
    GESTURE_ART_VIDEO_DURATION_MS,
    Math.max(250, Number(durationMs) || GESTURE_ART_VIDEO_DURATION_MS),
  );
  const boundedFrameRate = Math.min(
    GESTURE_ART_VIDEO_FRAME_RATE,
    Math.max(1, Number(frameRate) || GESTURE_ART_VIDEO_FRAME_RATE),
  );
  const boundedMaxBytes = Math.min(
    GESTURE_ART_VIDEO_MAX_BYTES,
    Math.max(1, Number(maxBytes) || GESTURE_ART_VIDEO_MAX_BYTES),
  );

  let stream;
  try {
    stream = canvas.captureStream(boundedFrameRate);
  } catch (error) {
    throw createExportError(
      "capture-failed",
      "The artwork canvas could not start a video stream.",
      error,
    );
  }

  const tracks = stream?.getTracks?.() ?? [];
  if (tracks.length === 0) {
    stopStreamTracks(stream);
    throw createExportError(
      "capture-failed",
      "The artwork canvas did not provide a video track.",
    );
  }

  let recorder;
  try {
    recorder = new MediaRecorderCtor(stream, {
      mimeType: capability.mimeType,
      videoBitsPerSecond: 3_000_000,
    });
  } catch (error) {
    stopStreamTracks(stream);
    throw createExportError(
      "recorder-start-failed",
      "The browser could not create a WebM recorder.",
      error,
    );
  }

  let resolvePromise;
  let rejectPromise;
  let timerId = null;
  let settled = false;
  let captureEnded = false;
  let terminalError = null;
  let totalBytes = 0;
  const chunks = [];

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const endCapture = () => {
    if (captureEnded) {
      return;
    }
    captureEnded = true;
    stopStreamTracks(stream);
  };

  const cleanup = () => {
    if (timerId !== null) {
      cancelSchedule(timerId);
      timerId = null;
    }
    recorder.removeEventListener?.("dataavailable", handleData);
    recorder.removeEventListener?.("error", handleError);
    recorder.removeEventListener?.("stop", handleStop);
    endCapture();
  };

  const rejectOnce = (error) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    rejectPromise(error);
  };

  const resolveOnce = (result) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    resolvePromise(result);
  };

  function handleData(event) {
    const chunk = event?.data;
    if (!(chunk instanceof Blob) || chunk.size === 0 || terminalError) {
      return;
    }
    if (totalBytes + chunk.size > boundedMaxBytes) {
      terminalError = createExportError(
        "size-limit",
        "The video reached its safe size limit.",
      );
      requestStop();
      return;
    }
    chunks.push(chunk);
    totalBytes += chunk.size;
  }

  function handleError(event) {
    terminalError = createExportError(
      "recording-failed",
      "The browser stopped recording the artwork.",
      event?.error,
    );
    requestStop();
  }

  function handleStop() {
    if (terminalError) {
      rejectOnce(terminalError);
      return;
    }
    const blob = new Blob(chunks, { type: capability.mimeType });
    if (blob.size === 0) {
      rejectOnce(
        createExportError(
          "empty-recording",
          "The browser produced an empty artwork video.",
        ),
      );
      return;
    }
    resolveOnce({
      blob,
      durationMs: boundedDuration,
      mimeType: capability.mimeType,
    });
  }

  function requestStop() {
    if (settled) {
      return;
    }
    if (timerId !== null) {
      cancelSchedule(timerId);
      timerId = null;
    }
    if (recorder.state === "inactive") {
      handleStop();
      return;
    }
    try {
      recorder.stop();
      endCapture();
    } catch (error) {
      rejectOnce(
        terminalError ??
          createExportError(
            "recording-failed",
            "The browser could not finish the artwork video.",
            error,
          ),
      );
    }
  }

  const cancel = () => {
    if (settled) {
      return;
    }
    terminalError = createExportError(
      "cancelled",
      "Artwork video export was cancelled.",
    );
    requestStop();
  };

  recorder.addEventListener("dataavailable", handleData);
  recorder.addEventListener("error", handleError);
  recorder.addEventListener("stop", handleStop);

  try {
    recorder.start(1_000);
    if (!settled) {
      timerId = schedule(requestStop, boundedDuration);
    }
  } catch (error) {
    rejectOnce(
      createExportError(
        "recorder-start-failed",
        "The browser could not start the WebM recorder.",
        error,
      ),
    );
  }

  return {
    cancel,
    durationMs: boundedDuration,
    mimeType: capability.mimeType,
    promise,
  };
}
