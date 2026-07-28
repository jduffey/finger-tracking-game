import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoOverlap,
  expectUsableTarget,
} from "./helpers/layout.js";

test("Jam Studio reserves a non-overlapping desktop lane for its wheel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/circle-of-fifths.html");

  const setup = page.locator("#circle-fifths-setup-panel");
  const wheel = page.getByRole("group", {
    name: "Interactive circle of fifths chord wheel",
  });
  const controls = page.locator("#circle-fifths-drums-panel");

  await expect(page.getByRole("heading", { name: "Jam Studio", level: 1 })).toBeVisible();
  await expect(setup).toBeVisible();
  await expect(wheel).toBeVisible();
  await expect(controls).toBeVisible();
  await expectNoOverlap(setup, wheel, { gap: 8 });
  await expectNoOverlap(wheel, controls, { gap: 8 });

  const wheelBox = await wheel.boundingBox();
  expect(wheelBox).not.toBeNull();
  expect(Math.abs(wheelBox.width - wheelBox.height)).toBeLessThanOrEqual(2);
  expect(wheelBox.width).toBeGreaterThanOrEqual(480);
  await expectNoHorizontalOverflow(page);
});

test("Jam Studio uses centered document flow and collapsible controls on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/circle-of-fifths.html");

  const setup = page.locator("#circle-fifths-setup-panel");
  const wheel = page.getByRole("group", {
    name: "Interactive circle of fifths chord wheel",
  });
  const controls = page.locator("#circle-fifths-drums-panel");
  const toolbar = page.getByRole("navigation", { name: "Circle controls" });

  await expect(setup).toBeVisible();
  await expect(wheel).toBeVisible();
  await expect(controls).toBeHidden();
  await expect(toolbar).toBeVisible();
  await expectUsableTarget(toolbar.getByRole("button", { name: "Setup" }));
  await expectUsableTarget(toolbar.getByRole("button", { name: "Jam" }));

  const wheelBox = await wheel.boundingBox();
  expect(wheelBox).not.toBeNull();
  expect(Math.abs(wheelBox.width - wheelBox.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(wheelBox.x + wheelBox.width / 2 - 195)).toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: "Close setup panel" }).click();
  await expect(setup).toBeHidden();
  await toolbar.getByRole("button", { name: "Jam" }).click();
  await expect(controls).toBeVisible();
  await expectNoOverlap(controls, wheel, { gap: 8 });

  const flowReport = await page.evaluate(() => ({
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    controlsPosition: getComputedStyle(
      document.querySelector("#circle-fifths-drums-panel"),
    ).position,
    documentScrolls:
      document.documentElement.scrollHeight > window.innerHeight ||
      document.body.scrollHeight > window.innerHeight,
    pageOverflow: getComputedStyle(
      document.querySelector(".circle-fifths-page"),
    ).overflow,
  }));
  expect(flowReport).toEqual({
    bodyOverflowY: "auto",
    controlsPosition: "relative",
    documentScrolls: true,
    pageOverflow: "visible",
  });
  await expectNoHorizontalOverflow(page);
});
