const SESSION_CANCELLED_CODE = "MEDIA_TRACKING_SESSION_CANCELLED";

export class MediaTrackingSessionCancelledError extends Error {
  constructor(message = "The media tracking session was superseded.") {
    super(message);
    this.name = "MediaTrackingSessionCancelledError";
    this.code = SESSION_CANCELLED_CODE;
  }
}

export function isMediaTrackingSessionCancelledError(error) {
  return error?.code === SESSION_CANCELLED_CODE;
}

export async function closeAudioContext(audioContext, onCleanupError = () => {}) {
  if (!audioContext || audioContext.state === "closed") {
    return;
  }

  try {
    await audioContext.close?.();
  } catch (error) {
    onCleanupError(error, "audio-context");
  }
}

export function createMediaTrackingSessionController({
  requestStream,
  createDetector,
  getVideoElement,
  waitForVideoMetadata,
  onSessionChange = () => {},
  onCleanupError = () => {},
}) {
  if (typeof requestStream !== "function") {
    throw new TypeError("requestStream must be a function.");
  }
  if (typeof createDetector !== "function") {
    throw new TypeError("createDetector must be a function.");
  }
  if (typeof getVideoElement !== "function") {
    throw new TypeError("getVideoElement must be a function.");
  }
  if (typeof waitForVideoMetadata !== "function") {
    throw new TypeError("waitForVideoMetadata must be a function.");
  }

  let activeSession = null;
  let closed = false;
  let operationSequence = 0;
  const pendingAttempts = new Set();

  function cancelPendingAttempts() {
    for (const attempt of pendingAttempts) {
      attempt.abortController.abort();
    }
  }

  function assertCurrentAttempt(attempt) {
    if (
      closed ||
      attempt.abortController.signal.aborted ||
      attempt.operationId !== operationSequence
    ) {
      throw new MediaTrackingSessionCancelledError();
    }
  }

  async function start() {
    if (closed) {
      throw new MediaTrackingSessionCancelledError("The media tracking session is closed.");
    }

    operationSequence += 1;
    const operationId = operationSequence;
    cancelPendingAttempts();

    const previousSession = activeSession;
    activeSession = null;
    onSessionChange(null);

    const attempt = {
      operationId,
      abortController: new AbortController(),
      resources: createEmptySession(),
    };
    pendingAttempts.add(attempt);

    try {
      await releaseSessionResources(previousSession, onCleanupError);
      assertCurrentAttempt(attempt);

      const videoElement = getVideoElement();
      if (!videoElement) {
        throw new Error("Camera element is not ready.");
      }
      attempt.resources.videoElement = videoElement;

      const stream = await requestStream({
        signal: attempt.abortController.signal,
      });
      attempt.resources.stream = stream;
      assertCurrentAttempt(attempt);

      videoElement.srcObject = stream;
      await waitForVideoMetadata(videoElement, attempt.abortController.signal);
      assertCurrentAttempt(attempt);

      await videoElement.play();
      assertCurrentAttempt(attempt);

      const detector = await createDetector({
        signal: attempt.abortController.signal,
      });
      attempt.resources.detector = detector;
      assertCurrentAttempt(attempt);

      pendingAttempts.delete(attempt);
      activeSession = attempt.resources;
      onSessionChange(activeSession);
      return activeSession;
    } catch (error) {
      pendingAttempts.delete(attempt);
      await releaseSessionResources(attempt.resources, onCleanupError);

      if (
        closed ||
        attempt.abortController.signal.aborted ||
        operationId !== operationSequence
      ) {
        throw new MediaTrackingSessionCancelledError();
      }
      throw error;
    }
  }

  async function stop() {
    operationSequence += 1;
    cancelPendingAttempts();

    const sessionsToRelease = [
      activeSession,
      ...Array.from(pendingAttempts, (attempt) => attempt.resources),
    ];
    activeSession = null;
    onSessionChange(null);

    await Promise.all(
      sessionsToRelease.map((session) => releaseSessionResources(session, onCleanupError)),
    );
  }

  async function close() {
    closed = true;
    await stop();
  }

  return {
    close,
    start,
    stop,
  };
}

function createEmptySession() {
  return {
    detector: null,
    stream: null,
    videoElement: null,
  };
}

async function releaseSessionResources(session, onCleanupError) {
  if (!session) {
    return;
  }

  const detector = session.detector;
  const stream = session.stream;
  const videoElement = session.videoElement;
  session.detector = null;
  session.stream = null;
  session.videoElement = null;

  if (videoElement && stream && videoElement.srcObject === stream) {
    try {
      videoElement.pause?.();
    } catch (error) {
      onCleanupError(error, "video");
    }

    try {
      videoElement.srcObject = null;
    } catch (error) {
      onCleanupError(error, "video");
    }
  }

  if (stream) {
    try {
      const tracks = stream.getTracks?.() ?? [];
      for (const track of tracks) {
        try {
          track.stop();
        } catch (error) {
          onCleanupError(error, "stream-track");
        }
      }
    } catch (error) {
      onCleanupError(error, "stream");
    }
  }

  if (detector) {
    try {
      await detector.dispose?.();
    } catch (error) {
      onCleanupError(error, "detector");
    }
  }
}
