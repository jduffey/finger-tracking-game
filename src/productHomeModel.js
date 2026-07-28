import {
  MODE_MATURITY,
  PRODUCT_AREAS,
  getFeaturedModes,
  getModeById,
  listModes,
} from "./modeRegistry.js";

export const HOME_AREA_ORDER = Object.freeze([
  PRODUCT_AREAS.PLAY,
  PRODUCT_AREAS.CREATE,
  PRODUCT_AREAS.LABS,
]);

export const HOME_AREA_COPY = Object.freeze({
  [PRODUCT_AREAS.PLAY]: Object.freeze({
    label: "Play",
    summary: "Complete rounds, set personal bests, and master motion controls.",
  }),
  [PRODUCT_AREAS.CREATE]: Object.freeze({
    label: "Create",
    summary: "Paint, perform, generate, and save something of your own.",
  }),
  [PRODUCT_AREAS.LABS]: Object.freeze({
    label: "Labs",
    summary: "Explore clearly labeled experiments and tracking prototypes.",
  }),
});

export function getHomeSections() {
  return HOME_AREA_ORDER.map((area) => ({
    area,
    ...HOME_AREA_COPY[area],
    modes: listModes({ area }),
  }));
}

export function filterLibraryModes(
  modes,
  {
    query = "",
    area = "all",
    maxMinutes = null,
    difficulty = "all",
    trackingProfile = "all",
    players = null,
  } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return (Array.isArray(modes) ? modes : []).filter((mode) => {
    if (area !== "all" && mode.area !== area) {
      return false;
    }
    if (
      Number.isFinite(maxMinutes) &&
      (mode.typicalMinutes ?? Number.POSITIVE_INFINITY) > maxMinutes
    ) {
      return false;
    }
    if (
      difficulty &&
      difficulty !== "all" &&
      mode.difficulty?.toLocaleLowerCase() !==
        difficulty.toLocaleLowerCase()
    ) {
      return false;
    }
    if (
      trackingProfile &&
      trackingProfile !== "all" &&
      mode.trackingProfile !== trackingProfile
    ) {
      return false;
    }
    if (
      Number.isFinite(players) &&
      (mode.players ?? 1) !== players
    ) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    return [
      mode.label,
      mode.summary,
      mode.objective,
      mode.controlHint,
      mode.difficulty,
      mode.area,
    ]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function selectDailyChallengeMode({ date = new Date() } = {}) {
  const candidates = listModes({ area: PRODUCT_AREAS.PLAY }).filter(
    (mode) =>
      mode.dailyChallenge === true &&
      mode.maturity !== MODE_MATURITY.EXPERIMENTAL &&
      mode.maturity !== MODE_MATURITY.INTERNAL,
  );
  if (candidates.length === 0) {
    return null;
  }

  const parsedDate = date instanceof Date ? date : new Date(date);
  const timestamp = parsedDate.getTime();
  if (!Number.isFinite(timestamp)) {
    return candidates[0];
  }
  const dayNumber = Math.floor(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate(),
    ) / 86_400_000,
  );
  return candidates[((dayNumber % candidates.length) + candidates.length) % candidates.length];
}

export function getLibraryModes({ includeInternal = false } = {}) {
  const modes = HOME_AREA_ORDER.flatMap((area) => listModes({ area }));
  return includeInternal
    ? modes
    : modes.filter((mode) => mode.maturity !== MODE_MATURITY.INTERNAL);
}

export function selectQuickPlayMode({
  recentModeIds = [],
  randomValue = Math.random(),
} = {}) {
  const featured = getFeaturedModes().filter(
    (mode) =>
      mode.area === PRODUCT_AREAS.PLAY &&
      mode.maturity !== MODE_MATURITY.EXPERIMENTAL &&
      mode.maturity !== MODE_MATURITY.INTERNAL,
  );
  const recentSet = new Set(Array.isArray(recentModeIds) ? recentModeIds : []);
  const unplayed = featured.filter((mode) => !recentSet.has(mode.id));
  const candidates = unplayed.length > 0 ? unplayed : featured;
  if (candidates.length === 0) {
    return null;
  }

  const safeRandomValue = Number.isFinite(randomValue)
    ? Math.min(0.999999, Math.max(0, randomValue))
    : 0;
  return candidates[Math.floor(safeRandomValue * candidates.length)] ?? candidates[0];
}

export function selectContinueMode(recentModeIds = []) {
  if (!Array.isArray(recentModeIds)) {
    return null;
  }

  return (
    recentModeIds
      .map((modeId) => getModeById(modeId))
      .find(
        (mode) =>
          mode &&
          !mode.hiddenFromLibrary &&
          HOME_AREA_ORDER.includes(mode.area),
      ) ?? null
  );
}

export function formatModeMetadata(mode) {
  return [
    mode.controlHint,
    mode.typicalMinutes ? `${mode.typicalMinutes} min` : null,
    mode.players ? `${mode.players} ${mode.players === 1 ? "player" : "players"}` : null,
    mode.difficulty,
  ].filter(Boolean);
}
