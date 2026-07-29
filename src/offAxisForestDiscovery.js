const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const FOREST_DISCOVERIES = Object.freeze([
  Object.freeze({
    id: "cedar-owl",
    name: "Cedar owl",
    glyph: "🦉",
    instruction: "Lean left to peek around the cedar at the trail edge.",
    axis: "x",
    direction: -1,
    threshold: 0.38,
    revealStart: 0.08,
    position: Object.freeze({ x: 17, y: 29 }),
  }),
  Object.freeze({
    id: "fern-fox",
    name: "Fern fox",
    glyph: "🦊",
    instruction: "Lean right and watch the near trunks slide past the far hills.",
    axis: "x",
    direction: 1,
    threshold: 0.38,
    revealStart: 0.08,
    position: Object.freeze({ x: 79, y: 68 }),
  }),
  Object.freeze({
    id: "canopy-moth",
    name: "Canopy moth",
    glyph: "✦",
    instruction: "Lift your view toward the canopy to catch the final glimmer.",
    axis: "y",
    direction: 1,
    threshold: 0.3,
    revealStart: 0.05,
    position: Object.freeze({ x: 55, y: 18 }),
  }),
]);

export function normalizeForestView(view = {}) {
  return {
    x: clamp(Number.isFinite(view.x) ? view.x : 0, -1, 1),
    y: clamp(Number.isFinite(view.y) ? view.y : 0, -1, 1),
  };
}

export function getForestDiscoveryReveal(discovery, view) {
  if (!discovery) {
    return 0;
  }

  const normalizedView = normalizeForestView(view);
  const signal = normalizedView[discovery.axis] * discovery.direction;
  const revealRange = Math.max(0.01, discovery.threshold - discovery.revealStart);
  return clamp((signal - discovery.revealStart) / revealRange, 0, 1);
}

export function isForestDiscoveryFound(discovery, view) {
  return getForestDiscoveryReveal(discovery, view) >= 1;
}

export function getForestTrailState(foundIds = []) {
  const foundSet = new Set(
    Array.isArray(foundIds)
      ? foundIds.filter((id) => FOREST_DISCOVERIES.some((discovery) => discovery.id === id))
      : [],
  );
  const activeIndex = FOREST_DISCOVERIES.findIndex(
    (discovery) => !foundSet.has(discovery.id),
  );
  const foundCount = foundSet.size;

  return {
    activeDiscovery:
      activeIndex >= 0 ? FOREST_DISCOVERIES[activeIndex] : null,
    activeIndex,
    complete: foundCount === FOREST_DISCOVERIES.length,
    foundCount,
    totalCount: FOREST_DISCOVERIES.length,
  };
}

export function createManualForestOffAxis(view = {}) {
  const normalizedView = normalizeForestView(view);

  return {
    cameraShiftXPx: Number((normalizedView.x * 72).toFixed(3)),
    cameraShiftYPx: Number((normalizedView.y * -54).toFixed(3)),
    chamberRotationDeg: Number((normalizedView.x * 10).toFixed(3)),
    chamberPitchDeg: Number((normalizedView.y * -7).toFixed(3)),
    skewXDeg: Number((normalizedView.x * -8).toFixed(3)),
    skewYDeg: Number((normalizedView.y * 5).toFixed(3)),
    viewportInset: 22,
    depth: 0,
  };
}

export function moveManualForestView(view, key, step = 0.14) {
  const current = normalizeForestView(view);
  const safeStep = clamp(Number.isFinite(step) ? Math.abs(step) : 0.14, 0.01, 1);

  switch (key) {
    case "ArrowLeft":
      return normalizeForestView({ ...current, x: current.x - safeStep });
    case "ArrowRight":
      return normalizeForestView({ ...current, x: current.x + safeStep });
    case "ArrowUp":
      return normalizeForestView({ ...current, y: current.y + safeStep });
    case "ArrowDown":
      return normalizeForestView({ ...current, y: current.y - safeStep });
    case "Home":
      return { x: 0, y: 0 };
    default:
      return current;
  }
}
