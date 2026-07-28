export const TRACKING_READINESS_STATES = Object.freeze({
  IDLE: "idle",
  REQUESTING_CAMERA: "requesting-camera",
  CAMERA_READY: "camera-ready",
  LOADING_MODEL: "loading-model",
  POSITIONING: "positioning",
  READY: "ready",
  INTERRUPTED: "interrupted",
  DENIED: "denied",
  NO_DEVICE: "no-device",
  DEVICE_BUSY: "device-busy",
  UNSUPPORTED: "unsupported",
  INSECURE: "insecure",
  MODEL_ERROR: "model-error",
  ERROR: "error",
});

export const READINESS_STEPS = Object.freeze([
  Object.freeze({ id: "permission", label: "Camera permission" }),
  Object.freeze({ id: "model", label: "Tracking model" }),
  Object.freeze({ id: "position", label: "Position and lighting" }),
  Object.freeze({ id: "gesture", label: "First gesture" }),
]);

export const TRACKING_INTERACTION_TARGET = Object.freeze({
  u: 0.7,
  v: 0.48,
  radius: 0.13,
  aspectRatio: 16 / 10,
});

export const TRACKING_INTERACTION_HOLD_MS = 600;
const TRACKING_INTERACTION_MAX_SAMPLE_GAP_MS = 240;
const TRACKING_INTERACTION_MAX_DELTA_MS = 100;
const TRACKING_LIGHTING_DIM_LUMA = 58;
const TRACKING_LIGHTING_BRIGHT_LUMA = 218;
const TRACKING_LIGHTING_BRIGHT_PIXEL_RATIO = 0.55;
const TRACKING_FRAMING_EDGE_MARGIN = 0.035;
const TRACKING_FRAMING_MIN_SPAN = 0.14;
const TRACKING_FRAMING_MAX_SPAN = 0.7;

export const TRACKING_ENVIRONMENT_STATUSES = Object.freeze({
  UNKNOWN: "unknown",
  GOOD: "good",
  DIM: "dim",
  BRIGHT: "bright",
  MISSING: "missing",
  EDGE: "edge",
  FAR: "far",
  CLOSE: "close",
});

export const TRACKING_LIGHTING_UNKNOWN = Object.freeze({
  status: TRACKING_ENVIRONMENT_STATUSES.UNKNOWN,
  label: "Checking light",
  message: "Lighting will be checked after the camera starts.",
});

export const TRACKING_FRAMING_UNKNOWN = Object.freeze({
  status: TRACKING_ENVIRONMENT_STATUSES.UNKNOWN,
  label: "Find your hand",
  message: "Show one relaxed hand inside the guide.",
});

function finiteCoordinate(point, key) {
  const rawKey = `${key}Raw`;
  if (Number.isFinite(point?.[rawKey])) {
    return point[rawKey];
  }
  return Number.isFinite(point?.[key]) ? point[key] : null;
}

/**
 * Summarizes a disposable RGBA sample. Callers can draw a tiny camera frame to
 * an offscreen canvas, pass only its pixels here, and immediately discard it.
 */
export function assessTrackingFrameLighting(pixelData) {
  if (!pixelData || pixelData.length < 4) {
    return TRACKING_LIGHTING_UNKNOWN;
  }

  let lumaTotal = 0;
  let brightPixels = 0;
  let pixelCount = 0;
  for (let index = 0; index + 2 < pixelData.length; index += 4) {
    const luma =
      pixelData[index] * 0.2126 +
      pixelData[index + 1] * 0.7152 +
      pixelData[index + 2] * 0.0722;
    lumaTotal += luma;
    brightPixels += luma >= 245 ? 1 : 0;
    pixelCount += 1;
  }
  if (pixelCount === 0) {
    return TRACKING_LIGHTING_UNKNOWN;
  }

  const averageLuma = lumaTotal / pixelCount;
  const brightPixelRatio = brightPixels / pixelCount;
  if (averageLuma < TRACKING_LIGHTING_DIM_LUMA) {
    return {
      status: TRACKING_ENVIRONMENT_STATUSES.DIM,
      label: "Add a little light",
      message: "Face a lamp or window without putting it directly behind you.",
      averageLuma,
    };
  }
  if (
    averageLuma > TRACKING_LIGHTING_BRIGHT_LUMA ||
    brightPixelRatio > TRACKING_LIGHTING_BRIGHT_PIXEL_RATIO
  ) {
    return {
      status: TRACKING_ENVIRONMENT_STATUSES.BRIGHT,
      label: "Reduce glare",
      message: "Angle away from strong direct light so your hand keeps its detail.",
      averageLuma,
    };
  }
  return {
    status: TRACKING_ENVIRONMENT_STATUSES.GOOD,
    label: "Lighting looks good",
    message: "Your hand has enough visible contrast for setup.",
    averageLuma,
  };
}

/**
 * Uses normalized hand bounds as a forgiving distance/framing proxy. It never
 * stores landmark vectors and deliberately does not block readiness.
 */
export function assessTrackingHandFraming(hand) {
  const points = Array.isArray(hand?.landmarks)
    ? hand.landmarks
        .map((point) => ({
          u: finiteCoordinate(point, "u"),
          v: finiteCoordinate(point, "v"),
        }))
        .filter(({ u, v }) => Number.isFinite(u) && Number.isFinite(v))
    : [];
  if (points.length < 8) {
    return {
      status: TRACKING_ENVIRONMENT_STATUSES.MISSING,
      label: "Show one full hand",
      message: "Keep your wrist and fingertips visible inside the guide.",
    };
  }

  const uValues = points.map(({ u }) => u);
  const vValues = points.map(({ v }) => v);
  const uMin = Math.min(...uValues);
  const uMax = Math.max(...uValues);
  const vMin = Math.min(...vValues);
  const vMax = Math.max(...vValues);
  const span = Math.max(uMax - uMin, vMax - vMin);
  if (
    uMin < TRACKING_FRAMING_EDGE_MARGIN ||
    uMax > 1 - TRACKING_FRAMING_EDGE_MARGIN ||
    vMin < TRACKING_FRAMING_EDGE_MARGIN ||
    vMax > 1 - TRACKING_FRAMING_EDGE_MARGIN
  ) {
    return {
      status: TRACKING_ENVIRONMENT_STATUSES.EDGE,
      label: "Recenter your hand",
      message: "Bring every fingertip and your wrist away from the frame edge.",
      span,
    };
  }
  if (span < TRACKING_FRAMING_MIN_SPAN) {
    return {
      status: TRACKING_ENVIRONMENT_STATUSES.FAR,
      label: "Move a little closer",
      message: "Bring your hand closer until the guide can see its shape clearly.",
      span,
    };
  }
  if (span > TRACKING_FRAMING_MAX_SPAN) {
    return {
      status: TRACKING_ENVIRONMENT_STATUSES.CLOSE,
      label: "Move a little farther back",
      message: "Leave enough space for relaxed pointing and pinching.",
      span,
    };
  }
  return {
    status: TRACKING_ENVIRONMENT_STATUSES.GOOD,
    label: "Hand distance looks good",
    message: "Your hand is centered with comfortable room to move.",
    span,
  };
}

export function createTrackingInteractionCheck(overrides = {}) {
  return {
    target: TRACKING_INTERACTION_TARGET,
    pointerActive: false,
    pointerU: 0.5,
    pointerV: 0.5,
    inTarget: false,
    holdMs: 0,
    pointerReady: false,
    pinchArmed: false,
    pinchReady: false,
    complete: false,
    lastSampleAt: null,
    framing: TRACKING_FRAMING_UNKNOWN,
    ...overrides,
  };
}

function isFiniteCoordinate(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Advances the setup interaction check using normalized, display-space pointer
 * coordinates. A pinch that was already held while acquiring the target does
 * not count: the player must release and pinch deliberately.
 */
export function updateTrackingInteractionCheck(state, sample = {}) {
  const current = state ?? createTrackingInteractionCheck();
  const pointerActive =
    sample.handDetected !== false &&
    isFiniteCoordinate(sample.pointerU) &&
    isFiniteCoordinate(sample.pointerV);

  if (!pointerActive) {
    return {
      ...current,
      pointerActive: false,
      inTarget: false,
      holdMs: current.pointerReady ? current.holdMs : 0,
      lastSampleAt: null,
      framing:
        sample.framing ??
        (sample.handDetected === false
          ? assessTrackingHandFraming(null)
          : current.framing),
    };
  }

  const pointerU = sample.pointerU;
  const pointerV = sample.pointerV;
  const target = current.target ?? TRACKING_INTERACTION_TARGET;
  const distance = Math.hypot(
    (pointerU - target.u) * (target.aspectRatio ?? 1),
    pointerV - target.v,
  );
  const inTarget = distance <= target.radius;
  const timestamp = Number.isFinite(sample.timestamp)
    ? sample.timestamp
    : current.lastSampleAt ?? 0;
  const elapsed =
    Number.isFinite(current.lastSampleAt) && timestamp >= current.lastSampleAt
      ? timestamp - current.lastSampleAt
      : 0;
  const continuous =
    current.pointerActive &&
    current.inTarget &&
    inTarget &&
    elapsed <= TRACKING_INTERACTION_MAX_SAMPLE_GAP_MS;
  const holdMs = current.pointerReady
    ? current.holdMs
    : inTarget
      ? continuous
        ? Math.min(
            TRACKING_INTERACTION_HOLD_MS,
            current.holdMs + Math.min(elapsed, TRACKING_INTERACTION_MAX_DELTA_MS),
          )
        : 0
      : 0;
  const pointerReady =
    current.pointerReady || holdMs >= TRACKING_INTERACTION_HOLD_MS;
  const pinchActive = Boolean(sample.pinchActive);
  const pinchArmed = pointerReady
    ? current.pinchArmed || !pinchActive
    : false;
  const pinchReady =
    current.pinchReady ||
    (pointerReady && pinchArmed && pinchActive && inTarget);

  return {
    ...current,
    pointerActive: true,
    pointerU,
    pointerV,
    inTarget,
    holdMs,
    pointerReady,
    pinchArmed,
    pinchReady,
    complete: pinchReady,
    lastSampleAt: timestamp,
    framing: sample.framing ?? current.framing,
  };
}

export function getTrackingInteractionPresentation(check) {
  const current = check ?? createTrackingInteractionCheck();
  const holdProgress = Math.min(
    1,
    Math.max(0, current.holdMs / TRACKING_INTERACTION_HOLD_MS),
  );

  if (current.complete) {
    return {
      phase: "complete",
      title: "Point and pinch confirmed",
      message: "Your hand control looks steady and your pinch registered.",
      holdProgress: 1,
    };
  }
  if (current.pointerReady) {
    return {
      phase: "pinch",
      title: current.inTarget ? "Pinch once" : "Return to the target",
      message: current.inTarget
        ? "Touch your thumb and index finger together, then release."
        : "Move the pointer back onto the target before pinching.",
      holdProgress: 1,
    };
  }
  if (!current.pointerActive) {
    return {
      phase: "find-hand",
      title: "Show one hand",
      message: "Hold one hand where the camera can see it.",
      holdProgress,
    };
  }
  if (current.inTarget) {
    return {
      phase: "hold",
      title: "Hold steady",
      message: "Keep the pointer inside the target for a moment.",
      holdProgress,
    };
  }
  return {
    phase: "point",
    title: "Point at the target",
    message: "Move your index-finger pointer onto the glowing target.",
    holdProgress,
  };
}

export function classifyCameraError(error) {
  const name = error?.name ?? "";
  const message = `${error?.message ?? ""}`.toLocaleLowerCase();

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return TRACKING_READINESS_STATES.DENIED;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return TRACKING_READINESS_STATES.NO_DEVICE;
  }
  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    message.includes("in use") ||
    message.includes("busy")
  ) {
    return TRACKING_READINESS_STATES.DEVICE_BUSY;
  }
  if (name === "SecurityError" || message.includes("secure context")) {
    return TRACKING_READINESS_STATES.INSECURE;
  }
  if (name === "TypeError" && !globalThis.isSecureContext) {
    return TRACKING_READINESS_STATES.INSECURE;
  }
  if (name === "NotSupportedError" || message.includes("not support")) {
    return TRACKING_READINESS_STATES.UNSUPPORTED;
  }
  if (name === "AbortError") {
    return TRACKING_READINESS_STATES.INTERRUPTED;
  }
  return TRACKING_READINESS_STATES.ERROR;
}

export function createTrackingReadinessState(overrides = {}) {
  return {
    status: TRACKING_READINESS_STATES.IDLE,
    cameraReady: false,
    modelReady: false,
    handDetected: false,
    pointerReady: false,
    pinchReady: false,
    activeStep: 0,
    error: null,
    selectedDeviceId: "",
    ...overrides,
  };
}

function getActiveStep(state) {
  if (!state.cameraReady) {
    return 0;
  }
  if (!state.modelReady) {
    return 1;
  }
  if (state.pointerReady && state.pinchReady) {
    return 3;
  }
  if (!state.handDetected) {
    return 2;
  }
  return 3;
}

export function reduceTrackingReadiness(state, event) {
  const current = state ?? createTrackingReadinessState();
  switch (event?.type) {
    case "START_REQUEST":
      return {
        ...current,
        status: TRACKING_READINESS_STATES.REQUESTING_CAMERA,
        cameraReady: false,
        modelReady: false,
        handDetected: false,
        pointerReady: false,
        pinchReady: false,
        activeStep: 0,
        error: null,
      };
    case "CAMERA_READY": {
      const next = {
        ...current,
        status: TRACKING_READINESS_STATES.LOADING_MODEL,
        cameraReady: true,
        selectedDeviceId: event.deviceId ?? current.selectedDeviceId,
        error: null,
      };
      return { ...next, activeStep: getActiveStep(next) };
    }
    case "MODEL_LOADING":
      return {
        ...current,
        status: TRACKING_READINESS_STATES.LOADING_MODEL,
        activeStep: 1,
        error: null,
      };
    case "MODEL_READY": {
      const next = {
        ...current,
        status: TRACKING_READINESS_STATES.POSITIONING,
        modelReady: true,
        error: null,
      };
      return { ...next, activeStep: getActiveStep(next) };
    }
    case "HAND_DETECTED": {
      const handDetected = Boolean(event.detected);
      const interactionComplete = current.pointerReady && current.pinchReady;
      const next = {
        ...current,
        handDetected,
        pointerReady:
          handDetected || interactionComplete ? current.pointerReady : false,
        pinchReady:
          handDetected || interactionComplete ? current.pinchReady : false,
        status: interactionComplete
          ? TRACKING_READINESS_STATES.READY
          : TRACKING_READINESS_STATES.POSITIONING,
      };
      return { ...next, activeStep: getActiveStep(next) };
    }
    case "POINTER_READY": {
      const pointerReady = Boolean(event.ready);
      const next = {
        ...current,
        pointerReady,
        pinchReady: pointerReady ? current.pinchReady : false,
        status: pointerReady && current.pinchReady
          ? TRACKING_READINESS_STATES.READY
          : TRACKING_READINESS_STATES.POSITIONING,
        error: null,
      };
      return { ...next, activeStep: getActiveStep(next) };
    }
    case "PINCH_READY": {
      const pinchReady = Boolean(event.ready) && current.pointerReady;
      const next = {
        ...current,
        pinchReady,
        status:
          current.pointerReady && pinchReady
            ? TRACKING_READINESS_STATES.READY
            : TRACKING_READINESS_STATES.POSITIONING,
        error: null,
      };
      return { ...next, activeStep: getActiveStep(next) };
    }
    case "RESET_INTERACTION": {
      const next = {
        ...current,
        status:
          current.cameraReady && current.modelReady
            ? TRACKING_READINESS_STATES.POSITIONING
            : current.status,
        handDetected: false,
        pointerReady: false,
        pinchReady: false,
        error: null,
      };
      return { ...next, activeStep: getActiveStep(next) };
    }
    case "CAMERA_ERROR": {
      const status = classifyCameraError(event.error);
      return {
        ...current,
        status,
        cameraReady: false,
        modelReady: false,
        handDetected: false,
        pointerReady: false,
        pinchReady: false,
        activeStep: 0,
        error: event.error ?? null,
      };
    }
    case "MODEL_ERROR":
      return {
        ...current,
        status: TRACKING_READINESS_STATES.MODEL_ERROR,
        modelReady: false,
        handDetected: false,
        pointerReady: false,
        pinchReady: false,
        activeStep: 1,
        error: event.error ?? null,
      };
    case "TRACK_INTERRUPTED":
      return {
        ...current,
        status: TRACKING_READINESS_STATES.INTERRUPTED,
        cameraReady: false,
        handDetected: false,
        pointerReady: false,
        pinchReady: false,
        activeStep: 0,
        error: event.error ?? null,
      };
    case "STOP":
      return createTrackingReadinessState({
        selectedDeviceId: current.selectedDeviceId,
      });
    default:
      return current;
  }
}

export function getReadinessProgress(state) {
  const current = state ?? createTrackingReadinessState();
  if (current.status === TRACKING_READINESS_STATES.READY) {
    return 1;
  }
  if (current.pointerReady) {
    return 0.875;
  }

  return Math.min(0.75, Math.max(0, current.activeStep / READINESS_STEPS.length));
}

export function getCameraErrorPresentation(status) {
  const presentations = {
    [TRACKING_READINESS_STATES.DENIED]: {
      title: "Camera access is blocked",
      message:
        "Allow camera access in your browser settings, then return here and try again.",
      primaryAction: "Try again",
      secondaryAction: "Continue with mouse or touch",
    },
    [TRACKING_READINESS_STATES.NO_DEVICE]: {
      title: "No camera was found",
      message: "Connect a camera or continue with the available mouse, touch, and keyboard controls.",
      primaryAction: "Check again",
      secondaryAction: "Continue without camera",
    },
    [TRACKING_READINESS_STATES.DEVICE_BUSY]: {
      title: "The camera is being used elsewhere",
      message: "Close other camera apps or choose another camera, then try again.",
      primaryAction: "Try again",
      secondaryAction: "Continue without camera",
    },
    [TRACKING_READINESS_STATES.INSECURE]: {
      title: "A secure connection is required",
      message: "Camera access works on HTTPS or a trusted local development address.",
      primaryAction: "Retry camera",
      secondaryAction: "Continue without camera",
    },
    [TRACKING_READINESS_STATES.UNSUPPORTED]: {
      title: "This browser cannot use the camera",
      message: "Use a current desktop browser or continue with alternative controls.",
      primaryAction: "Check again",
      secondaryAction: "Continue without camera",
    },
    [TRACKING_READINESS_STATES.MODEL_ERROR]: {
      title: "Hand tracking could not start",
      message: "Check the connection and graphics support, then retry the tracking model.",
      primaryAction: "Retry tracking",
      secondaryAction: "Continue without tracking",
    },
    [TRACKING_READINESS_STATES.INTERRUPTED]: {
      title: "Camera connection was interrupted",
      message: "Reconnect the camera or choose another device. Your current activity is paused.",
      primaryAction: "Reconnect",
      secondaryAction: "Continue without camera",
    },
    [TRACKING_READINESS_STATES.ERROR]: {
      title: "The camera could not start",
      message: "Check camera permissions and availability, then try again.",
      primaryAction: "Try again",
      secondaryAction: "Continue without camera",
    },
  };

  return presentations[status] ?? null;
}
