import { expect, test } from "@playwright/test";

import {
  CAMERA_FAILURE_SCENARIOS,
  getCameraRequestCount,
  getModelInitializationCount,
  holdTrackingModelInitialization,
  installCameraFailureStub,
  installFailingTrackingModelStub,
  installSuccessfulTrackingModelStub,
  installSyntheticCameraStub,
} from "./helpers/tracking.js";

const CAMERA_ERROR_CASES = [
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
