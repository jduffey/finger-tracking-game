export const DEVICE_CAPABILITY_STATUS = Object.freeze({
  READY: "ready",
  LIMITED: "limited",
  BLOCKED: "blocked",
  UNKNOWN: "unknown",
});

export const DEVICE_GRAPHICS_APIS = Object.freeze({
  WEBGPU: "webgpu",
  WEBGL_2: "webgl2",
  WEBGL: "webgl",
  NONE: "none",
});

export const DEVICE_PERFORMANCE_TIERS = Object.freeze({
  HIGH: "high",
  STANDARD: "standard",
  CONSTRAINED: "constrained",
  FALLBACK: "fallback",
});

export const DEVICE_FORM_FACTORS = Object.freeze({
  MOBILE: "mobile",
  TABLET: "tablet",
  DESKTOP: "desktop",
  UNKNOWN: "unknown",
});

export const DEVICE_ORIENTATIONS = Object.freeze({
  PORTRAIT: "portrait",
  LANDSCAPE: "landscape",
  UNKNOWN: "unknown",
});

/**
 * Browser facts consumed by {@link assessDeviceCapabilities}. Keeping this
 * shape flat makes it straightforward to record, redact, and reproduce in
 * tests without passing browser objects through application code.
 *
 * @typedef {object} DeviceCapabilitySignals
 * @property {boolean} cameraApi
 * @property {boolean} cameraEnumerationApi
 * @property {boolean} permissionsApi
 * @property {boolean|null} secureContext
 * @property {boolean} webgpu
 * @property {boolean} webgl2
 * @property {boolean} webgl
 * @property {number|null} deviceMemoryGb
 * @property {number|null} logicalProcessorCount
 * @property {string|null} screenOrientationType
 * @property {number|null} viewportWidth
 * @property {number|null} viewportHeight
 * @property {number} maxTouchPoints
 * @property {boolean} coarsePointer
 * @property {boolean} noHover
 * @property {boolean} mobileHint
 * @property {boolean} prefersReducedMotion
 * @property {boolean} prefersHighContrast
 * @property {boolean} forcedColors
 */

/**
 * @typedef {object} DeviceCapabilityAssessment
 * @property {{status: string, apiAvailable: boolean, enumerationAvailable: boolean, permissionsApiAvailable: boolean, secureContext: boolean|null}} camera
 * @property {{preferredApi: string, webgpu: boolean, webgl2: boolean, webgl: boolean}} graphics
 * @property {{memoryGb: number|null, logicalProcessorCount: number|null, formFactor: string, orientation: string, touchCapable: boolean, coarsePointer: boolean, mobileHint: boolean}} device
 * @property {{reducedMotion: boolean, highContrast: boolean, forcedColors: boolean}} preferences
 * @property {string} performanceTier
 * @property {ReadonlyArray<{code: string, severity: string, message: string}>} issues
 */

function safeRead(reader, fallback = null) {
  try {
    const value = reader();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function safePositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function safeMatchMedia(matchMedia, query) {
  if (typeof matchMedia !== "function") {
    return false;
  }

  return Boolean(
    safeRead(() => matchMedia(query)?.matches, false),
  );
}

function supportsCanvasContext(documentLike, contextName) {
  if (!documentLike || typeof documentLike.createElement !== "function") {
    return false;
  }

  return Boolean(
    safeRead(() => {
      const canvas = documentLike.createElement("canvas");
      return canvas && typeof canvas.getContext === "function"
        ? canvas.getContext(contextName)
        : null;
    }, null),
  );
}

function isLocalDevelopmentHost(hostname) {
  if (typeof hostname !== "string") {
    return false;
  }

  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized.endsWith(".localhost")
  );
}

function inferSecureContext(root) {
  const explicitValue = safeRead(() => root.isSecureContext, null);
  if (typeof explicitValue === "boolean") {
    return explicitValue;
  }

  const hostname = safeRead(() => root.location?.hostname, null);
  return isLocalDevelopmentHost(hostname) ? true : null;
}

function inferMobileHint(navigatorLike) {
  const clientHint = safeRead(
    () => navigatorLike.userAgentData?.mobile,
    null,
  );
  if (typeof clientHint === "boolean") {
    return clientHint;
  }

  const userAgent = safeRead(() => navigatorLike.userAgent, "");
  return typeof userAgent === "string"
    ? /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(userAgent)
    : false;
}

/**
 * Safely captures relevant browser and device hints. It intentionally avoids
 * permission prompts and asynchronous probing; calling it never opens a
 * camera or requests a user decision.
 *
 * @param {object|null|undefined} [environment=globalThis] Browser-like global.
 * @returns {Readonly<DeviceCapabilitySignals>}
 */
export function collectDeviceCapabilitySignals(environment = globalThis) {
  const root =
    environment && typeof environment === "object" ? environment : {};
  const navigatorLike =
    safeRead(() => root.navigator, null) || {};
  const documentLike = safeRead(() => root.document, null);
  const screenLike = safeRead(() => root.screen, null);
  const mediaDevices = safeRead(() => navigatorLike.mediaDevices, null);
  const matchMedia = safeRead(() => {
    const candidate = root.matchMedia;
    return typeof candidate === "function"
      ? candidate.bind(root)
      : null;
  }, null);

  const webgl2 = supportsCanvasContext(documentLike, "webgl2");
  const webgl =
    webgl2 ||
    supportsCanvasContext(documentLike, "webgl") ||
    supportsCanvasContext(documentLike, "experimental-webgl");

  const viewportWidth = safePositiveNumber(
    safeRead(
      () =>
        root.innerWidth ??
        documentLike?.documentElement?.clientWidth,
      null,
    ),
  );
  const viewportHeight = safePositiveNumber(
    safeRead(
      () =>
        root.innerHeight ??
        documentLike?.documentElement?.clientHeight,
      null,
    ),
  );
  const maxTouchPoints =
    safePositiveNumber(
      safeRead(() => navigatorLike.maxTouchPoints, null),
    ) || 0;
  const forcedColors = safeMatchMedia(matchMedia, "(forced-colors: active)");

  return Object.freeze({
    cameraApi: Boolean(
      mediaDevices &&
        typeof safeRead(() => mediaDevices.getUserMedia, null) === "function",
    ),
    cameraEnumerationApi: Boolean(
      mediaDevices &&
        typeof safeRead(() => mediaDevices.enumerateDevices, null) ===
          "function",
    ),
    permissionsApi:
      typeof safeRead(() => navigatorLike.permissions?.query, null) ===
      "function",
    secureContext: inferSecureContext(root),
    webgpu: Boolean(safeRead(() => navigatorLike.gpu, null)),
    webgl2,
    webgl,
    deviceMemoryGb: safePositiveNumber(
      safeRead(() => navigatorLike.deviceMemory, null),
    ),
    logicalProcessorCount: safePositiveNumber(
      safeRead(() => navigatorLike.hardwareConcurrency, null),
    ),
    screenOrientationType: safeRead(
      () => screenLike?.orientation?.type,
      null,
    ),
    viewportWidth,
    viewportHeight,
    maxTouchPoints,
    coarsePointer: safeMatchMedia(matchMedia, "(pointer: coarse)"),
    noHover: safeMatchMedia(matchMedia, "(hover: none)"),
    mobileHint: inferMobileHint(navigatorLike),
    prefersReducedMotion: safeMatchMedia(
      matchMedia,
      "(prefers-reduced-motion: reduce)",
    ),
    prefersHighContrast:
      safeMatchMedia(matchMedia, "(prefers-contrast: more)") ||
      forcedColors,
    forcedColors,
  });
}

function asBoolean(value) {
  return value === true;
}

function normalizeOrientation(type, width, height) {
  if (typeof type === "string") {
    if (type.toLowerCase().startsWith("portrait")) {
      return DEVICE_ORIENTATIONS.PORTRAIT;
    }
    if (type.toLowerCase().startsWith("landscape")) {
      return DEVICE_ORIENTATIONS.LANDSCAPE;
    }
  }

  if (Number.isFinite(width) && Number.isFinite(height) && width !== height) {
    return width > height
      ? DEVICE_ORIENTATIONS.LANDSCAPE
      : DEVICE_ORIENTATIONS.PORTRAIT;
  }

  return DEVICE_ORIENTATIONS.UNKNOWN;
}

function inferFormFactor(signals) {
  const width = safePositiveNumber(signals.viewportWidth);
  const height = safePositiveNumber(signals.viewportHeight);
  const shortestSide =
    width !== null && height !== null ? Math.min(width, height) : null;
  const touchCapable =
    safePositiveNumber(signals.maxTouchPoints) !== null ||
    asBoolean(signals.coarsePointer) ||
    asBoolean(signals.noHover);

  if (
    asBoolean(signals.mobileHint) ||
    (touchCapable && shortestSide !== null && shortestSide <= 600)
  ) {
    return DEVICE_FORM_FACTORS.MOBILE;
  }
  if (touchCapable && shortestSide !== null && shortestSide <= 1_100) {
    return DEVICE_FORM_FACTORS.TABLET;
  }
  if (width !== null || height !== null) {
    return DEVICE_FORM_FACTORS.DESKTOP;
  }
  return DEVICE_FORM_FACTORS.UNKNOWN;
}

function selectGraphicsApi(signals) {
  if (asBoolean(signals.webgpu)) {
    return DEVICE_GRAPHICS_APIS.WEBGPU;
  }
  if (asBoolean(signals.webgl2)) {
    return DEVICE_GRAPHICS_APIS.WEBGL_2;
  }
  if (asBoolean(signals.webgl)) {
    return DEVICE_GRAPHICS_APIS.WEBGL;
  }
  return DEVICE_GRAPHICS_APIS.NONE;
}

function selectPerformanceTier(signals, graphicsApi) {
  const memoryGb = safePositiveNumber(signals.deviceMemoryGb);
  const processorCount = safePositiveNumber(
    signals.logicalProcessorCount,
  );
  const constrained =
    (memoryGb !== null && memoryGb <= 2) ||
    (processorCount !== null && processorCount <= 2);

  if (graphicsApi === DEVICE_GRAPHICS_APIS.NONE) {
    return DEVICE_PERFORMANCE_TIERS.FALLBACK;
  }
  if (constrained) {
    return DEVICE_PERFORMANCE_TIERS.CONSTRAINED;
  }

  const highEndGraphics =
    graphicsApi === DEVICE_GRAPHICS_APIS.WEBGPU ||
    graphicsApi === DEVICE_GRAPHICS_APIS.WEBGL_2;
  const highEndMemory = memoryGb !== null && memoryGb >= 8;
  const highEndCpu = processorCount !== null && processorCount >= 6;
  if (highEndGraphics && highEndMemory && highEndCpu) {
    return DEVICE_PERFORMANCE_TIERS.HIGH;
  }

  return DEVICE_PERFORMANCE_TIERS.STANDARD;
}

function selectCameraStatus(signals) {
  if (!asBoolean(signals.cameraApi) || signals.secureContext === false) {
    return DEVICE_CAPABILITY_STATUS.BLOCKED;
  }
  if (signals.secureContext !== true) {
    return DEVICE_CAPABILITY_STATUS.UNKNOWN;
  }
  return DEVICE_CAPABILITY_STATUS.READY;
}

function createIssue(code, severity, message) {
  return Object.freeze({ code, severity, message });
}

/**
 * Converts raw facts into stable product-level capabilities. Memory and CPU
 * values remain hints: missing values never count against the device.
 *
 * @param {Partial<DeviceCapabilitySignals>|null|undefined} signals
 * @returns {Readonly<DeviceCapabilityAssessment>}
 */
export function assessDeviceCapabilities(signals = {}) {
  const facts = signals && typeof signals === "object" ? signals : {};
  const preferredApi = selectGraphicsApi(facts);
  const performanceTier = selectPerformanceTier(facts, preferredApi);
  const cameraStatus = selectCameraStatus(facts);
  const orientation = normalizeOrientation(
    facts.screenOrientationType,
    facts.viewportWidth,
    facts.viewportHeight,
  );
  const formFactor = inferFormFactor(facts);
  const issues = [];

  if (facts.secureContext === false) {
    issues.push(
      createIssue(
        "insecure-context",
        "blocking",
        "Camera access needs HTTPS or a localhost address.",
      ),
    );
  }
  if (!asBoolean(facts.cameraApi)) {
    issues.push(
      createIssue(
        "camera-api-unavailable",
        "blocking",
        "This browser does not expose the camera controls the experience needs.",
      ),
    );
  }
  if (
    asBoolean(facts.cameraApi) &&
    facts.secureContext !== true &&
    facts.secureContext !== false
  ) {
    issues.push(
      createIssue(
        "secure-context-unknown",
        "warning",
        "Camera support needs a quick check before play starts.",
      ),
    );
  }
  if (preferredApi === DEVICE_GRAPHICS_APIS.NONE) {
    issues.push(
      createIssue(
        "accelerated-graphics-unavailable",
        "warning",
        "Graphics acceleration was not detected, so basic visual settings are recommended.",
      ),
    );
  }
  if (performanceTier === DEVICE_PERFORMANCE_TIERS.CONSTRAINED) {
    issues.push(
      createIssue(
        "constrained-device",
        "notice",
        "A lighter performance mode should keep tracking and play responsive.",
      ),
    );
  }

  return Object.freeze({
    camera: Object.freeze({
      status: cameraStatus,
      apiAvailable: asBoolean(facts.cameraApi),
      enumerationAvailable: asBoolean(facts.cameraEnumerationApi),
      permissionsApiAvailable: asBoolean(facts.permissionsApi),
      secureContext:
        typeof facts.secureContext === "boolean"
          ? facts.secureContext
          : null,
    }),
    graphics: Object.freeze({
      preferredApi,
      webgpu: asBoolean(facts.webgpu),
      webgl2: asBoolean(facts.webgl2),
      webgl: asBoolean(facts.webgl) || asBoolean(facts.webgl2),
    }),
    device: Object.freeze({
      memoryGb: safePositiveNumber(facts.deviceMemoryGb),
      logicalProcessorCount: safePositiveNumber(
        facts.logicalProcessorCount,
      ),
      formFactor,
      orientation,
      touchCapable:
        safePositiveNumber(facts.maxTouchPoints) !== null ||
        asBoolean(facts.coarsePointer) ||
        asBoolean(facts.noHover),
      coarsePointer: asBoolean(facts.coarsePointer),
      mobileHint: asBoolean(facts.mobileHint),
    }),
    preferences: Object.freeze({
      reducedMotion: asBoolean(facts.prefersReducedMotion),
      highContrast:
        asBoolean(facts.prefersHighContrast) ||
        asBoolean(facts.forcedColors),
      forcedColors: asBoolean(facts.forcedColors),
    }),
    performanceTier,
    issues: Object.freeze(issues),
  });
}

function qualityForPerformanceTier(performanceTier) {
  switch (performanceTier) {
    case DEVICE_PERFORMANCE_TIERS.HIGH:
      return "high";
    case DEVICE_PERFORMANCE_TIERS.CONSTRAINED:
      return "low";
    case DEVICE_PERFORMANCE_TIERS.FALLBACK:
      return "minimal";
    default:
      return "balanced";
  }
}

function createAction(id, label) {
  return Object.freeze({ id, label });
}

function createNotice(id, message, priority = "helpful") {
  return Object.freeze({ id, message, priority });
}

/**
 * Creates launch copy and actions suitable for a setup screen. Camera
 * limitations become a pointer-mode recommendation when that fallback exists,
 * rather than presenting an unnecessary dead end.
 *
 * @param {DeviceCapabilityAssessment|null|undefined} capabilities
 * @param {{trackingRequired?: boolean, pointerFallback?: boolean}} [options]
 * @returns {Readonly<{status: string, title: string, message: string, recommendedInputMode: string, recommendedQualityLevel: string, primaryAction: {id: string, label: string}|null, secondaryAction: {id: string, label: string}|null, notices: ReadonlyArray<{id: string, message: string, priority: string}>}>}
 */
export function getCapabilityLaunchRecommendation(
  capabilities,
  options = {},
) {
  const assessment =
    capabilities &&
    typeof capabilities === "object" &&
    capabilities.camera &&
    capabilities.graphics &&
    capabilities.device &&
    capabilities.preferences &&
    typeof capabilities.performanceTier === "string"
      ? capabilities
      : assessDeviceCapabilities({});
  const settings = options && typeof options === "object" ? options : {};
  const trackingRequired = settings.trackingRequired !== false;
  const pointerFallback = settings.pointerFallback !== false;
  const notices = [];
  const quality = qualityForPerformanceTier(assessment.performanceTier);

  if (
    assessment.device.formFactor === DEVICE_FORM_FACTORS.MOBILE &&
    assessment.device.orientation === DEVICE_ORIENTATIONS.PORTRAIT
  ) {
    notices.push(
      createNotice(
        "landscape-recommended",
        "Turn the device sideways for a larger play area.",
      ),
    );
  }
  if (assessment.preferences.reducedMotion) {
    notices.push(
      createNotice(
        "reduced-motion",
        "Motion effects will stay reduced to match your device setting.",
        "preference",
      ),
    );
  }
  if (assessment.preferences.highContrast) {
    notices.push(
      createNotice(
        "high-contrast",
        "Controls and status messages should use their clearest contrast.",
        "preference",
      ),
    );
  }

  if (!trackingRequired) {
    return Object.freeze({
      status: DEVICE_CAPABILITY_STATUS.READY,
      title: "Ready to play",
      message: "This experience works with the controls already available.",
      recommendedInputMode: "pointer",
      recommendedQualityLevel: quality,
      primaryAction: createAction("start", "Start"),
      secondaryAction: null,
      notices: Object.freeze(notices),
    });
  }

  if (assessment.camera.secureContext === false) {
    const hasFallback = pointerFallback;
    return Object.freeze({
      status: hasFallback
        ? DEVICE_CAPABILITY_STATUS.LIMITED
        : DEVICE_CAPABILITY_STATUS.BLOCKED,
      title: "Camera needs a secure connection",
      message: hasFallback
        ? "Open this page over HTTPS or on localhost to use the camera. You can still play with pointer controls."
        : "Open this page over HTTPS or on localhost, then try the camera again.",
      recommendedInputMode: hasFallback ? "pointer" : "camera",
      recommendedQualityLevel: quality,
      primaryAction: hasFallback
        ? createAction("continue-with-pointer", "Use pointer controls")
        : createAction("retry-camera", "Try camera again"),
      secondaryAction: createAction("open-camera-help", "Camera help"),
      notices: Object.freeze(notices),
    });
  }

  if (!assessment.camera.apiAvailable) {
    const hasFallback = pointerFallback;
    return Object.freeze({
      status: hasFallback
        ? DEVICE_CAPABILITY_STATUS.LIMITED
        : DEVICE_CAPABILITY_STATUS.BLOCKED,
      title: "Camera controls are not available",
      message: hasFallback
        ? "This browser cannot open the camera here, but pointer controls are ready."
        : "Try a current browser with camera support to use this experience.",
      recommendedInputMode: hasFallback ? "pointer" : "camera",
      recommendedQualityLevel: quality,
      primaryAction: hasFallback
        ? createAction("continue-with-pointer", "Use pointer controls")
        : createAction("open-camera-help", "Camera help"),
      secondaryAction: hasFallback
        ? createAction("open-camera-help", "Camera help")
        : null,
      notices: Object.freeze(notices),
    });
  }

  if (assessment.camera.status === DEVICE_CAPABILITY_STATUS.UNKNOWN) {
    return Object.freeze({
      status: DEVICE_CAPABILITY_STATUS.LIMITED,
      title: "Camera support needs a quick check",
      message:
        "Start camera setup to confirm access. Pointer controls remain available if the check fails.",
      recommendedInputMode: "camera",
      recommendedQualityLevel: quality,
      primaryAction: createAction("check-camera", "Check camera"),
      secondaryAction: pointerFallback
        ? createAction("continue-with-pointer", "Use pointer controls")
        : null,
      notices: Object.freeze(notices),
    });
  }

  if (
    assessment.performanceTier === DEVICE_PERFORMANCE_TIERS.FALLBACK ||
    assessment.performanceTier === DEVICE_PERFORMANCE_TIERS.CONSTRAINED
  ) {
    return Object.freeze({
      status:
        assessment.performanceTier === DEVICE_PERFORMANCE_TIERS.FALLBACK
          ? DEVICE_CAPABILITY_STATUS.LIMITED
          : DEVICE_CAPABILITY_STATUS.READY,
      title:
        assessment.performanceTier === DEVICE_PERFORMANCE_TIERS.FALLBACK
          ? "Basic mode recommended"
          : "Ready in performance mode",
      message:
        assessment.performanceTier === DEVICE_PERFORMANCE_TIERS.FALLBACK
          ? "Camera play can start with simpler visuals while the app watches performance."
          : "Camera play is ready with lighter effects for smoother tracking.",
      recommendedInputMode: "camera",
      recommendedQualityLevel: quality,
      primaryAction: createAction("start-camera", "Start camera"),
      secondaryAction: pointerFallback
        ? createAction("continue-with-pointer", "Use pointer controls")
        : null,
      notices: Object.freeze(notices),
    });
  }

  return Object.freeze({
    status: DEVICE_CAPABILITY_STATUS.READY,
    title: "Ready for camera play",
    message:
      "Your browser has the camera and graphics features needed to begin.",
    recommendedInputMode: "camera",
    recommendedQualityLevel: quality,
    primaryAction: createAction("start-camera", "Start camera"),
    secondaryAction: pointerFallback
      ? createAction("continue-with-pointer", "Use pointer controls")
      : null,
    notices: Object.freeze(notices),
  });
}
