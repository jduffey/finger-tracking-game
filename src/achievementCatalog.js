import {
  BEST_METRIC_COMPARISONS,
  createMetricAchievement,
  createSessionMilestoneAchievement,
  createWinStreakAchievement,
} from "./gameProgression.js";

export const ACHIEVEMENT_TIERS = Object.freeze({
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
});

export const ACHIEVEMENT_CATEGORIES = Object.freeze({
  JOURNEY: "journey",
  VICTORY: "victory",
  MASTERY: "mastery",
});

function createFirstWinDefinition(id) {
  return Object.freeze({
    id,
    evaluate({ progress }) {
      return (progress?.totals?.wins ?? 0) >= 1;
    },
  });
}

function freezeMetadata(metadata) {
  return Object.freeze({
    ...metadata,
    progress: Object.freeze({ ...metadata.progress }),
  });
}

function createCatalogEntry(metadata, definition) {
  return Object.freeze({
    metadata: freezeMetadata(metadata),
    definition: Object.freeze(definition),
  });
}

const entries = [
  createCatalogEntry(
    {
      id: "first-session",
      title: "First Motion",
      description: "Play your first Motion Arcade session.",
      requirement: "Play 1 session",
      icon: "spark",
      tier: ACHIEVEMENT_TIERS.BRONZE,
      category: ACHIEVEMENT_CATEGORIES.JOURNEY,
      modeId: null,
      modeLabel: "Motion Arcade",
      progress: {
        source: "total",
        field: "sessionsPlayed",
        target: 1,
        unit: "session",
      },
    },
    createSessionMilestoneAchievement({
      id: "first-session",
      count: 1,
    }),
  ),
  createCatalogEntry(
    {
      id: "five-sessions",
      title: "Five Alive",
      description: "Play five sessions across Motion Arcade.",
      requirement: "Play 5 sessions",
      icon: "arcade",
      tier: ACHIEVEMENT_TIERS.SILVER,
      category: ACHIEVEMENT_CATEGORIES.JOURNEY,
      modeId: null,
      modeLabel: "Motion Arcade",
      progress: {
        source: "total",
        field: "sessionsPlayed",
        target: 5,
        unit: "sessions",
      },
    },
    createSessionMilestoneAchievement({
      id: "five-sessions",
      count: 5,
    }),
  ),
  createCatalogEntry(
    {
      id: "first-win",
      title: "First Victory",
      description: "Win any objective game.",
      requirement: "Win 1 game",
      icon: "trophy",
      tier: ACHIEVEMENT_TIERS.BRONZE,
      category: ACHIEVEMENT_CATEGORIES.VICTORY,
      modeId: null,
      modeLabel: "Motion Arcade",
      progress: {
        source: "total",
        field: "wins",
        target: 1,
        unit: "win",
      },
    },
    createFirstWinDefinition("first-win"),
  ),
  createCatalogEntry(
    {
      id: "finger-pong-win-streak",
      title: "Rally Ruler",
      description: "Win three Finger Pong matches in a row.",
      requirement: "Reach a 3-win streak",
      icon: "flame",
      tier: ACHIEVEMENT_TIERS.GOLD,
      category: ACHIEVEMENT_CATEGORIES.VICTORY,
      modeId: "finger-pong",
      modeLabel: "Finger Pong",
      progress: {
        source: "mode",
        field: "currentWinStreak",
        target: 3,
        unit: "wins",
      },
    },
    createWinStreakAchievement({
      id: "finger-pong-win-streak",
      count: 3,
      modeId: "finger-pong",
    }),
  ),
  createCatalogEntry(
    {
      id: "arcade-run-finisher",
      title: "Circuit Finisher",
      description: "Complete three games in one Arcade Run.",
      requirement: "Complete 3 games in a run",
      icon: "circuit",
      tier: ACHIEVEMENT_TIERS.SILVER,
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      modeId: "arcade-run",
      modeLabel: "Arcade Run",
      progress: {
        source: "bestMetric",
        field: "gamesCompleted",
        target: 3,
        unit: "games",
      },
    },
    createMetricAchievement({
      id: "arcade-run-finisher",
      modeId: "arcade-run",
      metricId: "gamesCompleted",
      threshold: 3,
    }),
  ),
  createCatalogEntry(
    {
      id: "sky-patrol-ace",
      title: "Sky Ace",
      description: "Destroy twelve targets in one Sky Patrol sortie.",
      requirement: "Destroy 12 targets",
      icon: "wings",
      tier: ACHIEVEMENT_TIERS.SILVER,
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      modeId: "sky-patrol",
      modeLabel: "Sky Patrol",
      progress: {
        source: "bestMetric",
        field: "targetsDestroyed",
        target: 12,
        unit: "targets",
      },
    },
    createMetricAchievement({
      id: "sky-patrol-ace",
      modeId: "sky-patrol",
      metricId: "targetsDestroyed",
      threshold: 12,
    }),
  ),
  createCatalogEntry(
    {
      id: "slice-air-score",
      title: "Blade Rhythm",
      description: "Score 1,500 points in a Slice Air round.",
      requirement: "Score 1,500 points",
      icon: "blade",
      tier: ACHIEVEMENT_TIERS.SILVER,
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      modeId: "slice-air",
      modeLabel: "Slice Air",
      progress: {
        source: "bestMetric",
        field: "score",
        target: 1_500,
        unit: "points",
      },
    },
    createMetricAchievement({
      id: "slice-air-score",
      modeId: "slice-air",
      metricId: "score",
      threshold: 1_500,
    }),
  ),
  createCatalogEntry(
    {
      id: "missile-command-guardian",
      title: "City Guardian",
      description: "Stop fifteen threats in one Missile Command defense.",
      requirement: "Stop 15 threats",
      icon: "shield",
      tier: ACHIEVEMENT_TIERS.SILVER,
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      modeId: "missile-command",
      modeLabel: "Missile Command",
      progress: {
        source: "bestMetric",
        field: "threatsStopped",
        target: 15,
        unit: "threats",
      },
    },
    createMetricAchievement({
      id: "missile-command-guardian",
      modeId: "missile-command",
      metricId: "threatsStopped",
      threshold: 15,
    }),
  ),
  createCatalogEntry(
    {
      id: "brick-dodger-minute",
      title: "Untouchable Minute",
      description: "Survive sixty seconds in Brick Dodger.",
      requirement: "Survive 60 seconds",
      icon: "timer",
      tier: ACHIEVEMENT_TIERS.GOLD,
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      modeId: "brick-dodger",
      modeLabel: "Brick Dodger",
      progress: {
        source: "bestMetric",
        field: "survivalMs",
        target: 60_000,
        displayScale: 0.001,
        unit: "seconds",
      },
    },
    createMetricAchievement({
      id: "brick-dodger-minute",
      modeId: "brick-dodger",
      metricId: "survivalMs",
      threshold: 60_000,
    }),
  ),
  createCatalogEntry(
    {
      id: "spatial-memory-six",
      title: "Sixth Sense",
      description: "Complete a six-step Gesture Memory sequence.",
      requirement: "Complete a 6-step sequence",
      icon: "memory",
      tier: ACHIEVEMENT_TIERS.GOLD,
      category: ACHIEVEMENT_CATEGORIES.MASTERY,
      modeId: "spatial-memory",
      modeLabel: "Gesture Memory",
      progress: {
        source: "bestMetric",
        field: "sequenceLength",
        target: 6,
        unit: "steps",
      },
    },
    createMetricAchievement({
      id: "spatial-memory-six",
      modeId: "spatial-memory",
      metricId: "sequenceLength",
      threshold: 6,
      comparison: BEST_METRIC_COMPARISONS.HIGHER,
    }),
  ),
];

export const ACHIEVEMENT_CATALOG = Object.freeze(
  entries.map((entry, index) =>
    Object.freeze({
      ...entry.metadata,
      catalogIndex: index,
    }),
  ),
);

export const ACHIEVEMENT_DEFINITIONS = Object.freeze(
  entries.map((entry) => entry.definition),
);

const metadataById = new Map(
  ACHIEVEMENT_CATALOG.map((metadata) => [metadata.id, metadata]),
);

function getUnlocks(progress) {
  const unlocked = progress?.achievements?.unlocked;
  return unlocked && typeof unlocked === "object" ? unlocked : {};
}

function getProgressCurrentValue(progress, metadata) {
  const descriptor = metadata.progress;
  if (descriptor.source === "total") {
    return Number.isFinite(progress?.totals?.[descriptor.field])
      ? progress.totals[descriptor.field]
      : 0;
  }
  const mode = progress?.modes?.[metadata.modeId];
  if (descriptor.source === "mode") {
    return Number.isFinite(mode?.[descriptor.field]) ? mode[descriptor.field] : 0;
  }
  if (descriptor.source === "bestMetric") {
    const value = mode?.bestByMetric?.[descriptor.field]?.value;
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
}

function formatProgressNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
}

function createProgressPresentation(progress, metadata, unlocked) {
  const descriptor = metadata.progress;
  const currentRaw = getProgressCurrentValue(progress, metadata);
  const targetRaw = descriptor.target;
  const ratio = unlocked
    ? 1
    : clampRatio(targetRaw > 0 ? currentRaw / targetRaw : 0);
  const displayScale = Number.isFinite(descriptor.displayScale)
    ? descriptor.displayScale
    : 1;
  const current = currentRaw * displayScale;
  const target = targetRaw * displayScale;
  return Object.freeze({
    current,
    target,
    ratio,
    label: `${formatProgressNumber(current)} / ${formatProgressNumber(target)} ${descriptor.unit}`,
  });
}

function clampRatio(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function normalizeAchievementIds(values) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = typeof value === "string" ? value : value?.id;
    if (typeof id === "string" && metadataById.has(id) && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function createAchievementCard(progress, metadata, newIds = new Set()) {
  const unlock = getUnlocks(progress)[metadata.id] ?? null;
  const unlocked = Boolean(unlock);
  return Object.freeze({
    ...metadata,
    unlocked,
    unlockedAt: unlock?.unlockedAt ?? null,
    sessionId: unlock?.sessionId ?? null,
    isNew: newIds.has(metadata.id),
    progressState: createProgressPresentation(progress, metadata, unlocked),
  });
}

export function getAchievementMetadata(id) {
  return metadataById.get(id) ?? null;
}

export function listAchievementCards(
  progress,
  {
    modeId = null,
    includeGlobal = true,
    unlockedOnly = false,
    newlyUnlocked = [],
    sort = "catalog",
  } = {},
) {
  const newIds = new Set(normalizeAchievementIds(newlyUnlocked));
  const cards = ACHIEVEMENT_CATALOG.filter(
    (metadata) =>
      (!modeId ||
        metadata.modeId === modeId ||
        (includeGlobal && metadata.modeId === null)) &&
      (!unlockedOnly || Boolean(getUnlocks(progress)[metadata.id])),
  ).map((metadata) => createAchievementCard(progress, metadata, newIds));

  if (sort !== "recent") {
    return cards;
  }
  return cards.sort((left, right) => {
    if (left.unlocked !== right.unlocked) {
      return left.unlocked ? -1 : 1;
    }
    if (left.unlockedAt !== right.unlockedAt) {
      return (right.unlockedAt ?? "").localeCompare(left.unlockedAt ?? "");
    }
    return left.catalogIndex - right.catalogIndex;
  });
}

export function getHomeAchievementSummary(progress, { limit = 3 } = {}) {
  const cards = listAchievementCards(progress, { sort: "recent" });
  const unlocked = cards.filter((card) => card.unlocked);
  const locked = cards
    .filter((card) => !card.unlocked)
    .sort(
      (left, right) =>
        right.progressState.ratio - left.progressState.ratio ||
        left.catalogIndex - right.catalogIndex,
    );
  const safeLimit = Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 3);
  return Object.freeze({
    unlockedCount: unlocked.length,
    totalCount: cards.length,
    completionPercent:
      cards.length === 0 ? 0 : Math.round((unlocked.length / cards.length) * 100),
    recent: Object.freeze(unlocked.slice(0, safeLimit)),
    next: locked[0] ?? null,
  });
}

export function getResultAchievementCards(progress, achievementUnlocks = []) {
  const ids = normalizeAchievementIds(achievementUnlocks);
  const newIds = new Set(ids);
  return ids.map((id) =>
    createAchievementCard(progress, metadataById.get(id), newIds),
  );
}
