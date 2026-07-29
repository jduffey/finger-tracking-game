import { expect, test } from "@playwright/test";

import { SYNTHETIC_HAND_MODEL_STATES } from "./fixtures/trackingHands.js";
import {
  CAMERA_FAILURE_SCENARIOS,
  getCameraRequestCount,
  getCameraTrackStopCount,
  getModelInitializationCount,
  holdTrackingModelInitialization,
  installCameraFailureStub,
  installFailingTrackingModelStub,
  installScriptedTrackingModelStub,
  installSuccessfulTrackingModelStub,
  installSyntheticCameraStub,
  setSyntheticHandModelState,
} from "./helpers/tracking.js";

const CAMERA_ERROR_CASES = [
  {
    id: "permission dismissal",
    scenario: CAMERA_FAILURE_SCENARIOS.dismissed,
    title: "Camera request was dismissed",
    primaryAction: "Ask again",
    secondaryAction: "Continue with mouse or touch",
  },
  {
    id: "permission denial",
    scenario: CAMERA_FAILURE_SCENARIOS.denied,
    title: "Camera access is blocked",
    primaryAction: "Try again",
    secondaryAction: "Continue with mouse or touch",
  },
  {
    id: "missing camera",
    scenario: CAMERA_FAILURE_SCENARIOS.noDevice,
    title: "No camera was found",
    primaryAction: "Check again",
    secondaryAction: "Continue without camera",
  },
  {
    id: "busy camera",
    scenario: CAMERA_FAILURE_SCENARIOS.busy,
    title: "The camera is being used elsewhere",
    primaryAction: "Try again",
    secondaryAction: "Continue without camera",
  },
];

for (const {
  id,
  scenario,
  title,
  primaryAction,
  secondaryAction,
} of CAMERA_ERROR_CASES) {
  test(`tracking setup recovers from ${id} without real camera hardware`, async ({
    page,
  }) => {
    await installCameraFailureStub(page, scenario);
    await holdTrackingModelInitialization(page);
    await page.goto("/setup");

    await page.getByRole("button", { name: "Enable camera" }).click();

    const alert = page.getByRole("alert");
    await expect(
      alert.getByRole("heading", { name: title, level: 2 }),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: primaryAction }),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: secondaryAction }),
    ).toBeVisible();
    await expect.poll(() => getCameraRequestCount(page)).toBe(1);

    await alert.getByRole("button", { name: primaryAction }).click();
    await expect.poll(() => getCameraRequestCount(page)).toBe(2);
    await expect(
      alert.getByRole("heading", { name: title, level: 2 }),
    ).toBeVisible();
  });
}

test("a busy camera can fall back into the requested pointer-play experience", async ({
  page,
}) => {
  await installCameraFailureStub(page, CAMERA_FAILURE_SCENARIOS.busy);
  await holdTrackingModelInitialization(page);
  await page.goto("/play/whack-a-mole");

  await expect(
    page.getByRole("heading", { name: "Get ready to move.", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enable camera" }).click();

  const alert = page.getByRole("alert");
  await expect(
    alert.getByRole("heading", {
      name: "The camera is being used elsewhere",
      level: 2,
    }),
  ).toBeVisible();
  await alert
    .getByRole("button", { name: "Continue without camera" })
    .click();

  await expect(page).toHaveURL(/\/play\/whack-a-mole$/u);
  await expect(
    page.getByRole("heading", { name: "Ready, Set, Whack", level: 2 }),
  ).toBeVisible();
});

test("busy-camera recovery keeps alternate devices available before retry", async ({
  page,
}) => {
  await installSyntheticCameraStub(page, {
    deviceLabels: ["Front test camera", "USB test camera"],
    failAfterRequestCount: 1,
  });
  await installSuccessfulTrackingModelStub(page);
  await page.goto("/setup");

  await page.getByRole("button", { name: "Enable camera" }).click();
  const setupCameraSelect = page.getByRole("combobox", { name: "Camera" });
  await expect(setupCameraSelect).toBeVisible();
  await expect(setupCameraSelect).toHaveValue("e2e-camera-1");

  await setupCameraSelect.selectOption({
    label: "USB test camera",
  });

  const alert = page.getByRole("alert");
  await expect(
    alert.getByRole("heading", {
      name: "The camera is being used elsewhere",
      level: 2,
    }),
  ).toBeVisible();
  const recoveryCameraSelect = alert.getByRole("combobox", {
    name: "Camera",
  });
  await expect(recoveryCameraSelect).toHaveValue("e2e-camera-2");
  await expect(recoveryCameraSelect.locator("option")).toHaveText([
    "Front test camera",
    "USB test camera",
  ]);

  await recoveryCameraSelect.selectOption({
    label: "Front test camera",
  });
  await expect.poll(() => getCameraRequestCount(page)).toBe(3);
  await expect(recoveryCameraSelect).toHaveValue("e2e-camera-1");

  await alert.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => getCameraRequestCount(page)).toBe(4);
});

test("an active camera stays visible after setup and can be stopped from Home", async ({
  page,
}) => {
  await installSyntheticCameraStub(page);
  await installSuccessfulTrackingModelStub(page);
  await page.goto("/setup");

  await page.getByRole("button", { name: "Enable camera" }).click();
  await expect(
    page.getByRole("button", { name: "Stop camera" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Distance & frame")).toBeVisible();
  await expect(
    page.getByText(/No image or landmark history is saved/i),
  ).toBeVisible();
  await expect.poll(() => getCameraRequestCount(page)).toBe(1);

  await page.getByRole("button", { name: "Home" }).click();
  const stopCamera = page.getByRole("button", {
    name: "Camera is on. Turn camera off.",
  });
  await expect(stopCamera).toBeVisible();
  await stopCamera.click();

  await expect(stopCamera).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Camera is off\. Open camera/i }),
  ).toBeVisible();
  await expect.poll(() => getCameraTrackStopCount(page)).toBeGreaterThan(0);
});

test("tracking model failure offers retry and pointer fallback", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await installSyntheticCameraStub(page);
  await installFailingTrackingModelStub(page);
  await page.goto("/play/whack-a-mole");

  await page.getByRole("button", { name: "Enable camera" }).click();

  const alert = page.getByRole("alert");
  await expect(
    alert.getByRole("heading", {
      name: "Hand tracking could not start",
      level: 2,
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    alert.getByRole("button", { name: "Retry tracking" }),
  ).toBeVisible();
  await expect.poll(() => getModelInitializationCount(page)).toBe(1);
  await expect.poll(() => getCameraRequestCount(page)).toBe(1);

  await alert.getByRole("button", { name: "Retry tracking" }).click();
  await expect.poll(() => getModelInitializationCount(page)).toBe(2);
  await expect.poll(() => getCameraRequestCount(page)).toBe(1);
  await expect(
    alert.getByRole("heading", {
      name: "Hand tracking could not start",
      level: 2,
    }),
  ).toBeVisible();

  await alert
    .getByRole("button", { name: "Continue without tracking" })
    .click();
  await expect(page).toHaveURL(/\/play\/whack-a-mole$/u);
  await expect(
    page.getByRole("heading", { name: "Ready, Set, Whack", level: 2 }),
  ).toBeVisible();
});

test("successful tracking setup gates play and runtime recovery requires stable reacquisition", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await installSyntheticCameraStub(page);
  await installScriptedTrackingModelStub(page);
  await page.goto("/play/whack-a-mole");

  await page.getByRole("button", { name: "Enable camera" }).click();
  await expect(
    page.getByRole("heading", { name: "Pinch once", level: 2 }),
  ).toBeVisible({ timeout: 20_000 });

  await setSyntheticHandModelState(
    page,
    SYNTHETIC_HAND_MODEL_STATES.PINCHED,
  );
  await expect(
    page.getByRole("heading", { name: "You’re ready", level: 2 }),
  ).toBeVisible();

  await setSyntheticHandModelState(page, SYNTHETIC_HAND_MODEL_STATES.OPEN);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/play\/whack-a-mole$/u);

  const experience = page.locator(".wamx");
  await expect(
    page.getByRole("heading", { name: "Ready, Set, Whack", level: 2 }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start round/i }).click();
  await expect(experience).toHaveAttribute(
    "data-experience-phase",
    "playing",
    { timeout: 15_000 },
  );

  await setSyntheticHandModelState(page, SYNTHETIC_HAND_MODEL_STATES.MISSING);
  const trackingDialog = page.getByRole("alertdialog");
  await expect(
    trackingDialog.getByRole("heading", {
      name: "Tracking lost",
      level: 2,
    }),
  ).toBeVisible({ timeout: 6_000 });
  await expect(experience).toHaveAttribute("data-experience-phase", "paused");

  await setSyntheticHandModelState(page, SYNTHETIC_HAND_MODEL_STATES.OPEN);
  await expect(
    trackingDialog.getByRole("heading", {
      name: "Hold steady",
      level: 2,
    }),
  ).toBeVisible();

  await page.waitForTimeout(1_000);
  await expect(trackingDialog).toBeVisible();
  await expect(experience).toHaveAttribute("data-experience-phase", "paused");
  await expect(
    trackingDialog.getByRole("progressbar"),
  ).toHaveAttribute("aria-valuenow", /^(?:[1-9]|[1-8][0-9]|9[0-8])$/);

  await expect(trackingDialog).toBeHidden({ timeout: 6_000 });
  await expect(experience).not.toHaveAttribute(
    "data-experience-phase",
    "paused",
  );
});
