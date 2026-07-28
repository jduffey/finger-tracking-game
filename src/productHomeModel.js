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

export const PRODUCT_HOME_AREA_PATHS = Object.freeze({
  all: "/",
  [PRODUCT_AREAS.PLAY]: "/play",
  [PRODUCT_AREAS.CREATE]: "/create",
  [PRODUCT_AREAS.LABS]: "/labs",
});

export function getProductHomeAreaFromPath(pathname) {
  const normalizedPath =
    typeof pathname === "string"
      ? pathname.replace(/\/+$/, "") || "/"
      : "/";
  return (
    Object.entries(PRODUCT_HOME_AREA_PATHS).find(
      ([, path]) => path === normalizedPath,
    )?.[0] ?? null
  );
}

export function getProductHomePathForArea(area) {
  return PRODUCT_HOME_AREA_PATHS[area] ?? PRODUCT_HOME_AREA_PATHS.all;
}

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
    seatedOnly = false,
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
    if (seatedOnly && mode.seatedFriendly !== true) {
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
      mode.seatedFriendly ? "seated friendly" : null,
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

function getQuickPlayCandidates() {
  return getFeaturedModes().filter(
    (mode) =>
      mode.area === PRODUCT_AREAS.PLAY &&
      mode.maturity !== MODE_MATURITY.EXPERIMENTAL &&
      mode.maturity !== MODE_MATURITY.INTERNAL,
  );
}

export function selectQuickPlayMode({
  recentModeIds = [],
  excludedModeIds = [],
  randomValue = Math.random(),
} = {}) {
  const featured = getQuickPlayCandidates();
  const recentIds = Array.isArray(recentModeIds) ? recentModeIds : [];
  const latestModeId = recentIds.find(
    (modeId) => typeof modeId === "string" && modeId,
  );
  const excludedSet = new Set(
    (Array.isArray(excludedModeIds) ? excludedModeIds : []).filter(
      (modeId) => typeof modeId === "string" && modeId,
    ),
  );
  if (latestModeId) {
    excludedSet.add(latestModeId);
  }

  const nonRepeating = featured.filter((mode) => !excludedSet.has(mode.id));
  const withoutLatest = latestModeId
    ? featured.filter((mode) => mode.id !== latestModeId)
    : featured;
  const eligible =
    nonRepeating.length > 0
      ? nonRepeating
      : withoutLatest.length > 0
        ? withoutLatest
        : featured;
  const recentSet = new Set(recentIds);
  const unplayed = eligible.filter((mode) => !recentSet.has(mode.id));
  const candidates = unplayed.length > 0 ? unplayed : eligible;
  if (candidates.length === 0) {
    return null;
  }

  const safeRandomValue = Number.isFinite(randomValue)
    ? Math.min(0.999999, Math.max(0, randomValue))
    : 0;
  return candidates[Math.floor(safeRandomValue * candidates.length)] ?? candidates[0];
}

export function selectHomeRecommendations({
  recentModeIds = [],
  favoriteModeIds = [],
  excludedModeIds = [],
  limit = 2,
} = {}) {
  const candidates = getQuickPlayCandidates();
  const recentSet = new Set(Array.isArray(recentModeIds) ? recentModeIds : []);
  const excludedSet = new Set(
    (Array.isArray(excludedModeIds) ? excludedModeIds : []).filter(Boolean),
  );
  const byId = new Map(candidates.map((mode) => [mode.id, mode]));
  const ordered = [
    ...(Array.isArray(favoriteModeIds) ? favoriteModeIds : [])
      .map((modeId) => byId.get(modeId))
      .filter(Boolean),
    ...candidates.filter((mode) => !recentSet.has(mode.id)),
    ...candidates,
  ];
  const recommendations = [];
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 2;
  if (safeLimit === 0) {
    return recommendations;
  }

  for (const mode of ordered) {
    if (
      excludedSet.has(mode.id) ||
      recommendations.some((entry) => entry.id === mode.id)
    ) {
      continue;
    }
    recommendations.push(mode);
    if (recommendations.length >= safeLimit) {
      break;
    }
  }
  return recommendations;
}

export function hasReturningHomeActivity({
  progression,
  latestResult,
  recentModeIds = [],
  favoriteModeIds = [],
} = {}) {
  return Boolean(
    latestResult ||
      (progression?.totals?.sessionsPlayed ?? 0) > 0 ||
      progression?.recentResults?.length ||
      (Array.isArray(recentModeIds) && recentModeIds.length > 0) ||
      (Array.isArray(favoriteModeIds) && favoriteModeIds.length > 0),
  );
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
    mode.seatedFriendly ? "Seated-friendly" : null,
  ].filter(Boolean);
}
