import { expect } from "@playwright/test";

export const RESPONSIVE_VIEWPORTS = Object.freeze([
  { label: "desktop 1280×720", width: 1280, height: 720 },
  { label: "desktop 1366×768", width: 1366, height: 768 },
  { label: "desktop 1440×900", width: 1440, height: 900 },
  { label: "desktop 1920×1080", width: 1920, height: 1080 },
  { label: "phone 390×844", width: 390, height: 844 },
  { label: "tablet portrait 768×1024", width: 768, height: 1024 },
  { label: "tablet landscape 1024×768", width: 1024, height: 768 },
]);

export async function expectNoHorizontalOverflow(page) {
  const report = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const visibleElementOverflows = Array.from(body.querySelectorAll("*"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const rendered =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 1 &&
          rect.height > 1;
        const isHorizontalScrollContainer =
          style.overflowX !== "visible" &&
          style.overflowX !== "hidden" &&
          style.overflowX !== "clip" &&
          style.position !== "fixed" &&
          style.position !== "absolute";
        return (
          rendered &&
          isHorizontalScrollContainer &&
          element.scrollWidth > element.clientWidth + 1
        );
      })
      .slice(0, 10)
      .map((element) => ({
        className:
          typeof element.className === "string" ? element.className : "",
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tagName: element.tagName,
      }));

    return {
      bodyOverflow: body.scrollWidth > body.clientWidth + 1,
      documentOverflow: root.scrollWidth > root.clientWidth + 1,
      visibleElementOverflows,
    };
  });

  expect(report).toEqual({
    bodyOverflow: false,
    documentOverflow: false,
    visibleElementOverflows: [],
  });
}

export async function expectUsableTarget(
  locator,
  { minimumHeight = 40, minimumWidth = 24 } = {},
) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();

  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(minimumWidth);
  expect(box.height).toBeGreaterThanOrEqual(minimumHeight);

  const viewport = locator.page().viewportSize();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

export async function expectInsideViewport(locator, { inset = 0 } = {}) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const viewport = locator.page().viewportSize();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(inset - 1);
  expect(box.y).toBeGreaterThanOrEqual(inset - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - inset + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(
    viewport.height - inset + 1,
  );
}

export async function expectNoOverlap(first, second, { gap = 0 } = {}) {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();

  const separated =
    firstBox.x + firstBox.width + gap <= secondBox.x ||
    secondBox.x + secondBox.width + gap <= firstBox.x ||
    firstBox.y + firstBox.height + gap <= secondBox.y ||
    secondBox.y + secondBox.height + gap <= firstBox.y;
  expect(
    separated,
    `Expected non-overlapping rectangles, received ${JSON.stringify({
      first: firstBox,
      second: secondBox,
    })}`,
  ).toBe(true);
}
