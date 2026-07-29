import test from "node:test";
import assert from "node:assert/strict";

import {
  DEVICE_CAPABILITY_STATUS,
  DEVICE_FORM_FACTORS,
  DEVICE_GRAPHICS_APIS,
  DEVICE_ORIENTATIONS,
  DEVICE_PERFORMANCE_TIERS,
  assessDeviceCapabilities,
  collectDeviceCapabilitySignals,
  getCapabilityLaunchRecommendation,
} from "../src/deviceCapabilities.js";

function createCanvasDocument({ webgl2 = false, webgl = false } = {}) {
  return {
    createElement(name) {
      assert.equal(name, "canvas");
      return {
        getContext(contextName) {
          if (contextName === "webgl2") {
            return webgl2 ? {} : null;
          }
          if (
            contextName === "webgl" ||
            contextName === "experimental-webgl"
          ) {
            return webgl ? {} : null;
          }
          return null;
        },
      };
    },
  };
}

function createMatchMedia(matches = []) {
  const activeQueries = new Set(matches);
  return (query) => ({ matches: activeQueries.has(query) });
}

test("capability collection is safe when browser globals are missing", () => {
  const signals = collectDeviceCapabilitySignals({});

  assert.equal(signals.cameraApi, false);
  assert.equal(signals.secureContext, null);
  assert.equal(signals.webgpu, false);
  assert.equal(signals.webgl2, false);
  assert.equal(signals.webgl, false);
  assert.equal(signals.deviceMemoryGb, null);
  assert.equal(signals.logicalProcessorCount, null);
  assert.equal(Object.isFrozen(signals), true);

  const assessment = assessDeviceCapabilities(signals);
  assert.equal(
    assessment.camera.status,
    DEVICE_CAPABILITY_STATUS.BLOCKED,
  );
  assert.equal(
    assessment.graphics.preferredApi,
    DEVICE_GRAPHICS_APIS.NONE,
  );
  assert.equal(
    assessment.performanceTier,
    DEVICE_PERFORMANCE_TIERS.FALLBACK,
  );
  assert.equal(
    assessment.device.formFactor,
    DEVICE_FORM_FACTORS.UNKNOWN,
  );

  const launch = getCapabilityLaunchRecommendation(assessment);
  assert.equal(launch.status, DEVICE_CAPABILITY_STATUS.LIMITED);
  assert.equal(launch.recommendedInputMode, "pointer");
  assert.equal(launch.primaryAction.id, "continue-with-pointer");
});

test("modern desktop signals produce a high-tier camera-ready assessment", () => {
  const signals = collectDeviceCapabilitySignals({
    isSecureContext: true,
    innerWidth: 1_440,
    innerHeight: 900,
    navigator: {
      mediaDevices: {
        getUserMedia() {},
        enumerateDevices() {},
      },
      permissions: { query() {} },
      gpu: {},
      deviceMemory: 16,
      hardwareConcurrency: 12,
      maxTouchPoints: 0,
      userAgentData: { mobile: false },
    },
    screen: { orientation: { type: "landscape-primary" } },
    document: createCanvasDocument({ webgl2: true, webgl: true }),
    matchMedia: createMatchMedia(),
  });
  const assessment = assessDeviceCapabilities(signals);
  const launch = getCapabilityLaunchRecommendation(assessment);

  assert.equal(signals.cameraEnumerationApi, true);
  assert.equal(signals.permissionsApi, true);
  assert.equal(assessment.camera.status, DEVICE_CAPABILITY_STATUS.READY);
  assert.equal(
    assessment.graphics.preferredApi,
    DEVICE_GRAPHICS_APIS.WEBGPU,
  );
  assert.equal(assessment.graphics.webgl2, true);
  assert.equal(
    assessment.performanceTier,
    DEVICE_PERFORMANCE_TIERS.HIGH,
  );
  assert.equal(assessment.device.formFactor, DEVICE_FORM_FACTORS.DESKTOP);
  assert.equal(
    assessment.device.orientation,
    DEVICE_ORIENTATIONS.LANDSCAPE,
  );
  assert.equal(launch.status, DEVICE_CAPABILITY_STATUS.READY);
  assert.equal(launch.title, "Ready for camera play");
  assert.equal(launch.recommendedQualityLevel, "high");
  assert.equal(launch.primaryAction.id, "start-camera");
});

test("mobile, orientation, touch, contrast, and motion hints become launch guidance", () => {
  const signals = collectDeviceCapabilitySignals({
    isSecureContext: false,
    innerWidth: 390,
    innerHeight: 844,
    navigator: {
      mediaDevices: { getUserMedia() {} },
      deviceMemory: 2,
      hardwareConcurrency: 4,
      maxTouchPoints: 5,
      userAgentData: { mobile: true },
    },
    document: createCanvasDocument({ webgl: true }),
    matchMedia: createMatchMedia([
      "(pointer: coarse)",
      "(hover: none)",
      "(prefers-reduced-motion: reduce)",
      "(prefers-contrast: more)",
    ]),
  });
  const assessment = assessDeviceCapabilities(signals);
  const launch = getCapabilityLaunchRecommendation(assessment);

  assert.equal(assessment.device.formFactor, DEVICE_FORM_FACTORS.MOBILE);
  assert.equal(
    assessment.device.orientation,
    DEVICE_ORIENTATIONS.PORTRAIT,
  );
  assert.equal(assessment.device.touchCapable, true);
  assert.equal(assessment.preferences.reducedMotion, true);
  assert.equal(assessment.preferences.highContrast, true);
  assert.equal(
    assessment.performanceTier,
    DEVICE_PERFORMANCE_TIERS.CONSTRAINED,
  );
  assert.equal(launch.status, DEVICE_CAPABILITY_STATUS.LIMITED);
  assert.equal(launch.title, "Camera needs a secure connection");
  assert.match(launch.message, /HTTPS/);
  assert.deepEqual(
    launch.notices.map((notice) => notice.id),
    ["landscape-recommended", "reduced-motion", "high-contrast"],
  );

  const withoutFallback = getCapabilityLaunchRecommendation(assessment, {
    pointerFallback: false,
  });
  assert.equal(withoutFallback.status, DEVICE_CAPABILITY_STATUS.BLOCKED);
  assert.equal(withoutFallback.recommendedInputMode, "camera");
});

test("unknown secure-context state asks for a check instead of claiming failure", () => {
  const assessment = assessDeviceCapabilities({
    cameraApi: true,
    secureContext: null,
    webgl2: true,
    webgl: true,
    viewportWidth: 1_024,
    viewportHeight: 768,
  });
  const launch = getCapabilityLaunchRecommendation(assessment);

  assert.equal(
    assessment.camera.status,
    DEVICE_CAPABILITY_STATUS.UNKNOWN,
  );
  assert.equal(launch.status, DEVICE_CAPABILITY_STATUS.LIMITED);
  assert.equal(launch.primaryAction.id, "check-camera");
  assert.equal(launch.secondaryAction.id, "continue-with-pointer");
});

test("graphics fallback remains playable and receives plain-language basic-mode copy", () => {
  const assessment = assessDeviceCapabilities({
    cameraApi: true,
    secureContext: true,
    viewportWidth: 1_280,
    viewportHeight: 720,
  });
  const launch = getCapabilityLaunchRecommendation(assessment);

  assert.equal(assessment.camera.status, DEVICE_CAPABILITY_STATUS.READY);
  assert.equal(
    assessment.performanceTier,
    DEVICE_PERFORMANCE_TIERS.FALLBACK,
  );
  assert.equal(launch.status, DEVICE_CAPABILITY_STATUS.LIMITED);
  assert.equal(launch.title, "Basic mode recommended");
  assert.equal(launch.recommendedQualityLevel, "minimal");
  assert.doesNotMatch(launch.message, /WebGL|WebGPU/);
});

test("hostile getters and canvas probes cannot crash capability collection", () => {
  const environment = {
    location: { hostname: "localhost" },
    matchMedia() {
      throw new Error("media query unavailable");
    },
  };
  Object.defineProperty(environment, "navigator", {
    get() {
      throw new Error("navigator unavailable");
    },
  });
  Object.defineProperty(environment, "document", {
    get() {
      return {
        createElement() {
          throw new Error("canvas unavailable");
        },
      };
    },
  });
  Object.defineProperty(environment, "screen", {
    get() {
      throw new Error("screen unavailable");
    },
  });

  assert.doesNotThrow(() => collectDeviceCapabilitySignals(environment));
  const signals = collectDeviceCapabilitySignals(environment);
  assert.equal(signals.secureContext, true);
  assert.equal(signals.cameraApi, false);
  assert.equal(signals.webgl, false);
  assert.equal(signals.prefersReducedMotion, false);
});

test("non-camera experiences get an unconditional pointer-first launch", () => {
  const assessment = assessDeviceCapabilities({});
  const launch = getCapabilityLaunchRecommendation(assessment, {
    trackingRequired: false,
  });

  assert.equal(launch.status, DEVICE_CAPABILITY_STATUS.READY);
  assert.equal(launch.recommendedInputMode, "pointer");
  assert.equal(launch.primaryAction.label, "Start");
});
