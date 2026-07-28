const MAX_EXPERIENCE_NAME_LENGTH = 72;

export const EXPERIENCE_ERROR_CATEGORIES = Object.freeze({
  CAMERA_PERMISSION: "camera-permission",
  CAMERA_DEVICE: "camera-device",
  GRAPHICS: "graphics",
  NETWORK: "network",
  STORAGE: "storage",
  UNEXPECTED: "unexpected",
});

const RECOVERY_COPY = Object.freeze({
  [EXPERIENCE_ERROR_CATEGORIES.CAMERA_PERMISSION]: Object.freeze({
    title: "Camera access needs another try.",
    consequence:
      "This experience stopped before camera input could continue. The recovery screen does not capture or save camera images.",
    nextStep:
      "Check the browser’s camera permission, then retry or return Home to run setup again.",
  }),
  [EXPERIENCE_ERROR_CATEGORIES.CAMERA_DEVICE]: Object.freeze({
    title: "The camera connection was interrupted.",
    consequence:
      "This round stopped because a usable camera stream was no longer available. Your other progress and settings were left alone.",
    nextStep:
      "Reconnect or close any other app using the camera, then retry this experience.",
  }),
  [EXPERIENCE_ERROR_CATEGORIES.GRAPHICS]: Object.freeze({
    title: "This visual scene needs a fresh start.",
    consequence:
      "The experience lost access to graphics hardware, so the current round could not safely continue.",
    nextStep:
      "Retry once. If it happens again, return Home and choose a lighter experience.",
  }),
  [EXPERIENCE_ERROR_CATEGORIES.NETWORK]: Object.freeze({
    title: "Part of this experience did not load.",
    consequence:
      "The current round stopped before all of its local app files were ready. Camera images and saved creations were not included in the error summary.",
    nextStep:
      "Check the connection, then retry. Returning Home will keep the rest of the arcade available.",
  }),
  [EXPERIENCE_ERROR_CATEGORIES.STORAGE]: Object.freeze({
    title: "This experience could not save its latest change.",
    consequence:
      "The current action stopped to avoid claiming that progress was saved when local storage was unavailable.",
    nextStep:
      "Free a little browser storage or use a regular browsing window, then retry.",
  }),
  [EXPERIENCE_ERROR_CATEGORIES.UNEXPECTED]: Object.freeze({
    title: "This experience took an unexpected pause.",
    consequence:
      "The current round stopped before it could continue. Your other local progress and settings were left alone.",
    nextStep:
      "Retry the experience. If the problem repeats, return Home and choose another activity.",
  }),
});

function normalizeErrorText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeExperienceName(value) {
  if (typeof value !== "string") {
    return "This experience";
  }
  const name = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EXPERIENCE_NAME_LENGTH);
  return name || "This experience";
}

export function classifyExperienceError(error) {
  const name = normalizeErrorText(error?.name);
  const code = normalizeErrorText(error?.code);
  const message = normalizeErrorText(error?.message);
  const diagnosticText = `${name} ${code} ${message}`;

  if (
    name === "notallowederror" ||
    name === "securityerror" ||
    name === "permissiondeniederror" ||
    diagnosticText.includes("camera permission")
  ) {
    return EXPERIENCE_ERROR_CATEGORIES.CAMERA_PERMISSION;
  }
  if (
    name === "notfounderror" ||
    name === "notreadableerror" ||
    name === "overconstrainederror" ||
    name === "trackstarterror" ||
    diagnosticText.includes("camera device")
  ) {
    return EXPERIENCE_ERROR_CATEGORIES.CAMERA_DEVICE;
  }
  if (
    name === "webglcontextevent" ||
    name === "gpuvalidationerror" ||
    diagnosticText.includes("webgl") ||
    diagnosticText.includes("graphics context")
  ) {
    return EXPERIENCE_ERROR_CATEGORIES.GRAPHICS;
  }
  if (
    name === "chunkloaderror" ||
    diagnosticText.includes("failed to fetch") ||
    diagnosticText.includes("dynamic import") ||
    diagnosticText.includes("networkerror")
  ) {
    return EXPERIENCE_ERROR_CATEGORIES.NETWORK;
  }
  if (
    name === "quotaexceedederror" ||
    code === "quota_exceeded" ||
    diagnosticText.includes("storage quota")
  ) {
    return EXPERIENCE_ERROR_CATEGORIES.STORAGE;
  }
  return EXPERIENCE_ERROR_CATEGORIES.UNEXPECTED;
}

function createReference(error, category) {
  const fingerprintSource = [
    category,
    typeof error?.name === "string" ? error.name : "",
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < fingerprintSource.length; index += 1) {
    hash ^= fingerprintSource.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `MA-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

/**
 * Creates player-facing recovery copy and a privacy-safe support summary.
 *
 * The returned report deliberately excludes the original error message, stack,
 * component tree, camera data, settings, and saved content. Callers can pass the
 * report to a clipboard or reporting integration without also receiving `error`.
 */
export function createExperienceErrorRecovery(
  error,
  { experienceName } = {},
) {
  const name = normalizeExperienceName(experienceName);
  const category = classifyExperienceError(error);
  const copy = RECOVERY_COPY[category];
  const reference = createReference(error, category);
  const report = Object.freeze({
    category,
    experienceName: name,
    reference,
    text: [
      "Motion Arcade issue summary",
      `Experience: ${name}`,
      `Category: ${category}`,
      `Reference: ${reference}`,
      "Private details omitted: camera data, saved content, error message, and stack trace.",
    ].join("\n"),
  });

  return Object.freeze({
    category,
    consequence: copy.consequence,
    experienceName: name,
    nextStep: copy.nextStep,
    reference,
    report,
    title: copy.title,
  });
}
