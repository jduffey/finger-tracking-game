import { expect, test } from "@playwright/test";

import {
  RESPONSIVE_VIEWPORTS,
  expectInsideViewport,
  expectNoHorizontalOverflow,
  expectNoOverlap,
  expectUsableTarget,
} from "./helpers/layout.js";

test.describe("responsive Home release matrix", () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`keeps the primary Home actions usable at ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectUsableTarget(
        page.getByRole("button", { name: "Open My Creations" }),
      );
      await expectUsableTarget(
        page.getByRole("button", { name: /camera is off/i }),
      );
      await expectUsableTarget(
        page.getByRole("button", { name: "Open settings" }),
      );

      await expectUsableTarget(
        page.getByRole("button", { name: "Start an Arcade Run" }).first(),
      );

      const search = page.getByRole("searchbox", {
        name: "Search experiences",
      });
      await expectUsableTarget(search);
      await search.fill("Probability Table");
      const experienceList = page.getByRole("list", {
        name: /available experience/i,
      });
      await expect(
        experienceList.getByRole("button", {
          name: /^Probability Table /i,
        }),
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });
  }
});

for (const viewport of [
  { label: "desktop", width: 1366, height: 768 },
  { label: "phone", width: 390, height: 844 },
]) {
  test(`Settings and a Labs experience preserve routing at ${viewport.label} size`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    await expectUsableTarget(page.getByRole("button", { name: /home/i }));
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /home/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Labs", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Labs", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    const probabilityCard = page
      .getByRole("list", { name: /available experience/i })
      .getByRole("button", { name: /^Probability Table /i });
    await probabilityCard.scrollIntoViewIfNeeded();
    await probabilityCard.click();

    await expect(page).toHaveURL(/\/labs\/probability-table$/);
    await expect(
      page.getByRole("heading", { name: "Probability Table", level: 2 }),
    ).toBeVisible();
    await expectUsableTarget(
      page.getByRole("button", { name: /run 10 trials/i }),
    );
    await expectNoHorizontalOverflow(page);
  });
}

for (const viewport of [
  { label: "desktop", width: 1440, height: 900 },
  { label: "phone", width: 390, height: 844 },
]) {
  test(`My Creations remains usable at ${viewport.label} size`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const launcher = page.getByRole("button", {
      name: "Open My Creations",
    });
    await launcher.click();

    const dialog = page.getByRole("dialog", { name: "My Creations" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);
    await expectUsableTarget(
      dialog.getByRole("button", { name: "Close My Creations" }),
    );
    await expectUsableTarget(
      dialog.getByRole("searchbox", { name: "Search creations" }),
    );
    await expect(
      dialog.getByRole("button", { name: "Create a Light Painting" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Create a World" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await dialog
      .getByRole("button", { name: "Close My Creations" })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });
}

for (const viewport of [
  { label: "short desktop", width: 1280, height: 720 },
  { label: "phone", width: 390, height: 844 },
]) {
  test(`the live Whack-a-Mole board keeps overlay chrome out of its safe zone at ${viewport.label} size`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/play/whack-a-mole");

    await page
      .getByRole("button", { name: "Explore without camera" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ready, Set, Whack", level: 2 }),
    ).toBeVisible();
    await page.getByRole("button", { name: /start round/i }).click();

    const board = page.getByRole("group", {
      name: /Whack-a-Mole garden/i,
    });
    await expect(board).toBeVisible({ timeout: 10_000 });

    const localHud = page.getByLabel("Round statistics");
    const globalHud = page.locator(".experience-overlay-hud");
    await expect(localHud).toBeVisible();
    await expect(globalHud).toBeVisible();
    await expect(page.locator(".experience-overlay-backdrop")).toHaveCount(0);
    await expectNoOverlap(board, localHud, { gap: 2 });
    await expectNoOverlap(board, globalHud, { gap: 2 });
    await expectNoHorizontalOverflow(page);
  });
}
