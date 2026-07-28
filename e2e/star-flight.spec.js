import { expect, test } from "@playwright/test";

import { SYNTHETIC_HAND_MODEL_STATES } from "./fixtures/trackingHands.js";
import {
  installScriptedTrackingModelStub,
  installSyntheticCameraStub,
  setSyntheticHandModelState,
} from "./helpers/tracking.js";

test("Star Flight exposes coherent courses and a usable phone-width layout", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installSyntheticCameraStub(page);
  await installScriptedTrackingModelStub(page);
  await page.goto("/labs/star-flight");

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

  await expect(page).toHaveURL(/\/labs\/star-flight$/u);
  await expect(
    page.getByRole("heading", { name: "Star Flight", level: 2 }),
  ).toBeVisible();

  const coursePicker = page.getByRole("group", {
    name: "Choose a flight course",
  });
  const courseButtons = coursePicker.getByRole("button");
  await expect(courseButtons).toHaveCount(4);
  await expect(
    coursePicker.getByRole("button", { name: /Cadet Circuit/i }),
  ).toHaveAttribute("aria-pressed", "true");

  await coursePicker
    .getByRole("button", { name: /Comet Slalom/i })
    .click();
  await expect(
    coursePicker.getByRole("button", { name: /Comet Slalom/i }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Comet Slalom flight status"),
  ).toContainText("Gate 1/12");
  await expect(
    page.getByText("Set your neutral pose"),
  ).toBeVisible();

  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    buttonHeights: [...document.querySelectorAll(".flight-course-picker button")]
      .map((button) => button.getBoundingClientRect().height),
    stageWidth: document
      .querySelector(".flight-stage")
      ?.getBoundingClientRect().width,
  }));
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.stageWidth).toBeGreaterThan(340);
  expect(layout.buttonHeights.every((height) => height >= 44)).toBe(true);
});
