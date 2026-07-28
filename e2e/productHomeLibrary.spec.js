import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectUsableTarget,
} from "./helpers/layout.js";

const PREFERENCES_STORAGE_KEY = "motionArcade.preferences.v1";

test("Home resurfaces cross-area favorites and recents as independent library views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    ({ key, preferences }) => {
      localStorage.setItem(key, JSON.stringify(preferences));
    },
    {
      key: PREFERENCES_STORAGE_KEY,
      preferences: {
        favoriteModeIds: ["sky-patrol", "jam-studio", "pose-quest"],
        recentModeIds: ["pose-quest", "jam-studio", "sky-patrol"],
      },
    },
  );
  await page.goto("/");

  const libraryViews = page.getByRole("group", {
    name: "Choose a library view",
  });
  const favorites = libraryViews.getByRole("button", {
    name: "Favorites: 3 experiences",
  });
  const recent = libraryViews.getByRole("button", {
    name: "Recent: 3 experiences",
  });

  await expectUsableTarget(favorites);
  await expectUsableTarget(recent);
  await favorites.click();
  await expect(favorites).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("list", { name: "3 available experiences" }),
  ).toBeVisible();

  await page
    .getByRole("group", { name: "Filter experiences by area" })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Jam Studio /i }),
  ).toBeVisible();
  await expect(page.getByText("1 experience shown", { exact: true })).toBeVisible();

  await recent.click();
  await expect(recent).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /^Jam Studio /i }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("empty Favorites and Recent views explain how to populate them and recover", async ({
  page,
}) => {
  await page.goto("/");

  const libraryViews = page.getByRole("group", {
    name: "Choose a library view",
  });
  await libraryViews
    .getByRole("button", { name: "Favorites: 0 experiences" })
    .click();
  await expect(page.getByText("No favorites yet.")).toBeVisible();
  await expect(
    page.getByText(/star on any Play, Create, or Labs experience/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Browse all experiences" }).click();
  await expect(
    libraryViews.getByRole("button", { name: /All:/ }),
  ).toHaveAttribute("aria-pressed", "true");

  await libraryViews
    .getByRole("button", { name: "Recent: 0 experiences" })
    .click();
  await expect(page.getByText("No recent experiences yet.")).toBeVisible();
});
