import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const seriousViolations = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact),
  );
  expect(seriousViolations).toEqual([]);
}

async function expectNoHorizontalOverflow(page) {
  const overflows = await page.locator("body *").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        if (
          style.position === "fixed" ||
          style.position === "absolute" ||
          style.overflowX === "visible" ||
          style.overflowX === "hidden" ||
          style.overflowX === "clip"
        ) {
          return false;
        }
        return element.scrollWidth - element.clientWidth > 1;
      })
      .slice(0, 10)
      .map((element) => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tagName: element.tagName,
      })),
  );
  const documentOverflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect({ documentOverflows, overflows }).toEqual({
    documentOverflows: false,
    overflows: [],
  });
}

test("Home remains understandable and usable without requesting a camera", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /camera is off/i })).toBeVisible();
  await expect(page.getByRole("region", { name: /choose your next move/i })).toBeVisible();
  await expect(page.getByRole("list", { name: /available experiences/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page);
});

test("Settings exposes functional comfort controls in a compact responsive flow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings" }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Dwell selection time" })).toHaveValue(
    "1000",
  );
  await expect(page.getByRole("combobox", { name: "Camera preview" })).toHaveValue(
    "compact",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page);
});

test("Camera-free deep links survive direct navigation and browser Back", async ({
  page,
}) => {
  await page.goto("/labs/probability-table");
  await expect(page).toHaveURL(/\/labs\/probability-table$/);
  await expect(
    page.getByRole("heading", { name: "Probability Table", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /run 10 trials/i })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto("/");
  await page.goto("/play/arcade-run");
  await expect(page).toHaveURL(/\/play\/arcade-run$/);
  await expect(page.getByRole("heading", { name: "Arcade Run", level: 1 })).toBeVisible();
  await page.getByRole("radio", { name: /3 min quick spark/i }).check();
  await expect(page.getByRole("button", { name: /start quick spark/i })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("region", { name: /choose your next move/i })).toBeVisible();
});

test("Play, Create, and Labs are bookmarkable Home destinations", async ({
  page,
}) => {
  for (const destination of ["play", "create", "labs"]) {
    await page.goto(`/${destination}`);
    await expect(page).toHaveURL(new RegExp(`/${destination}$`));
    await expect(
      page.getByRole("button", {
        name: destination[0].toUpperCase() + destination.slice(1),
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  }

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Home catalog remains browseable at a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Labs", exact: true }).click();
  const experienceList = page.getByRole("list", { name: /available experiences/i });
  await expect(
    experienceList.getByRole("button", { name: /^Pose Quest /i }),
  ).toBeVisible();
  await expect(
    experienceList.getByRole("button", { name: /^Sky Patrol /i }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
