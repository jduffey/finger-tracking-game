import test from "node:test";
import assert from "node:assert/strict";

import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_TIERS,
  getAchievementMetadata,
  getHomeAchievementSummary,
  getResultAchievementCards,
  listAchievementCards,
} from "../src/achievementCatalog.js";
import {
  createInitialGameProgression,
  recordGameResult,
} from "../src/gameProgression.js";
import {
  MODE_MATURITY,
  MODE_REGISTRY,
  PRODUCT_AREAS,
  getModeById,
} from "../src/modeRegistry.js";

const START = "2026-07-01T12:00:00.000Z";

function record(progress, result) {
  return recordGameResult(progress, result, {
    now: result.endedAt ?? START,
    achievementDefinitions: ACHIEVEMENT_DEFINITIONS,
  });
}

test("catalog metadata and definitions are stable, unique, and player-facing", () => {
  const ids = ACHIEVEMENT_CATALOG.map(({ id }) => id);
  const definitionIds = ACHIEVEMENT_DEFINITIONS.map(({ id }) => id);

  assert.equal(ACHIEVEMENT_CATALOG.length, 9);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(definitionIds, ids);
  assert.ok(ACHIEVEMENT_CATALOG.every((medal) => Object.isFrozen(medal)));
  assert.ok(ACHIEVEMENT_DEFINITIONS.every((definition) => Object.isFrozen(definition)));
  assert.ok(
    ACHIEVEMENT_CATALOG.every(
      (medal) =>
        medal.title &&
        medal.description &&
        medal.requirement &&
        medal.icon &&
        Object.values(ACHIEVEMENT_TIERS).includes(medal.tier) &&
        Object.values(ACHIEVEMENT_CATEGORIES).includes(medal.category),
    ),
  );
  assert.ok(
    ACHIEVEMENT_CATALOG.filter(({ modeId }) => modeId).every(({ modeId }) =>
      getModeById(modeId),
    ),
  );
  assert.equal(getAchievementMetadata("first-session")?.title, "First Motion");
  assert.equal(getAchievementMetadata("missing"), null);
});

test("every result-capable flagship Play experience has a mastery medal", () => {
  const flagshipModeIds = MODE_REGISTRY.filter(
    (mode) =>
      mode.area === PRODUCT_AREAS.PLAY &&
      mode.maturity === MODE_MATURITY.FLAGSHIP &&
      mode.supportsResults,
  )
    .map((mode) => mode.id)
    .sort();
  const masteryModeIds = ACHIEVEMENT_CATALOG.filter(
    (medal) => medal.category === ACHIEVEMENT_CATEGORIES.MASTERY,
  )
    .map((medal) => medal.modeId)
    .sort();

  assert.deepEqual(masteryModeIds, flagshipModeIds);
});

test("first-session and five-session medals unlock at their exact milestones", () => {
  let progress = createInitialGameProgression({ now: START });
  let firstUnlocks = [];
  let fifthUnlocks = [];

  for (let index = 1; index <= 5; index += 1) {
    const recorded = record(progress, {
      sessionId: `journey-${index}`,
      modeId: "hand-bounce",
      outcome: "completed",
      score: index,
      endedAt: `2026-07-0${index}T12:00:00.000Z`,
    });
    progress = recorded.progress;
    if (index === 1) {
      firstUnlocks = recorded.achievementUnlocks.map(({ id }) => id);
    }
    if (index === 5) {
      fifthUnlocks = recorded.achievementUnlocks.map(({ id }) => id);
    }
  }

  assert.deepEqual(firstUnlocks, ["first-session"]);
  assert.deepEqual(fifthUnlocks, ["five-sessions"]);
  assert.equal(progress.totals.sessionsPlayed, 5);
  assert.ok(progress.achievements.unlocked["first-session"]);
  assert.ok(progress.achievements.unlocked["five-sessions"]);
});

test("first victory and Finger Pong win streak unlock independently", () => {
  let progress = createInitialGameProgression({ now: START });
  const unlocksByMatch = [];

  for (let index = 1; index <= 3; index += 1) {
    const recorded = record(progress, {
      sessionId: `pong-win-${index}`,
      modeId: "finger-pong",
      outcome: "won",
      score: 7,
      metrics: {
        opponentScore: 7 - index,
        bestRally: 10 + index,
      },
      endedAt: `2026-07-0${index}T13:00:00.000Z`,
    });
    progress = recorded.progress;
    unlocksByMatch.push(recorded.achievementUnlocks.map(({ id }) => id));
  }

  assert.deepEqual(unlocksByMatch[0], ["first-session", "first-win"]);
  assert.deepEqual(unlocksByMatch[1], []);
  assert.deepEqual(unlocksByMatch[2], ["finger-pong-win-streak"]);
  assert.equal(progress.modes["finger-pong"].currentWinStreak, 3);

  progress = record(progress, {
    sessionId: "pong-loss",
    modeId: "finger-pong",
    outcome: "lost",
    score: 2,
    endedAt: "2026-07-04T13:00:00.000Z",
  }).progress;
  const streakCard = listAchievementCards(progress, {
    modeId: "finger-pong",
    includeGlobal: false,
  })[0];
  assert.equal(streakCard.unlocked, true);
  assert.equal(streakCard.progressState.ratio, 1);
  assert.equal(progress.modes["finger-pong"].currentWinStreak, 0);
});

test("flagship mastery medals evaluate their normalized skill metrics", () => {
  const cases = [
    {
      expectedId: "sky-patrol-ace",
      modeId: "sky-patrol",
      outcome: "lost",
      score: 1_200,
      metrics: { targetsDestroyed: 12 },
    },
    {
      expectedId: "slice-air-score",
      modeId: "slice-air",
      outcome: "completed",
      score: 1_500,
      metrics: {},
    },
    {
      expectedId: "missile-command-guardian",
      modeId: "missile-command",
      outcome: "lost",
      score: 1_000,
      metrics: { threatsStopped: 15 },
    },
    {
      expectedId: "brick-dodger-minute",
      modeId: "brick-dodger",
      outcome: "completed",
      score: 2_000,
      metrics: { survivalMs: 60_000 },
    },
    {
      expectedId: "spatial-memory-six",
      modeId: "spatial-memory",
      outcome: "won",
      score: 900,
      metrics: { sequenceLength: 6 },
    },
  ];

  for (const [index, result] of cases.entries()) {
    const recorded = record(createInitialGameProgression({ now: START }), {
      sessionId: `mastery-${index}`,
      ...result,
      endedAt: START,
    });
    const unlockedIds = recorded.achievementUnlocks.map(({ id }) => id);
    assert.ok(
      unlockedIds.includes(result.expectedId),
      `${result.expectedId} should unlock at its threshold`,
    );
  }
});

test("mastery medals remain locked below their thresholds and expose progress", () => {
  const recorded = record(createInitialGameProgression({ now: START }), {
    sessionId: "brick-progress",
    modeId: "brick-dodger",
    outcome: "completed",
    score: 800,
    metrics: { survivalMs: 30_000 },
    endedAt: START,
  });
  const masteryUnlocks = recorded.achievementUnlocks.filter(
    ({ id }) => getAchievementMetadata(id)?.category === ACHIEVEMENT_CATEGORIES.MASTERY,
  );
  const card = listAchievementCards(recorded.progress, {
    modeId: "brick-dodger",
    includeGlobal: false,
  })[0];

  assert.deepEqual(masteryUnlocks, []);
  assert.equal(card.id, "brick-dodger-minute");
  assert.equal(card.unlocked, false);
  assert.deepEqual(card.progressState, {
    current: 30,
    target: 60,
    ratio: 0.5,
    label: "30 / 60 seconds",
  });
});

test("Home and result helpers merge metadata with durable unlock records", () => {
  let progress = createInitialGameProgression({ now: START });
  const sliceResult = record(progress, {
    sessionId: "slice-medal",
    modeId: "slice-air",
    outcome: "completed",
    score: 1_800,
    endedAt: "2026-07-01T12:00:00.000Z",
  });
  progress = sliceResult.progress;
  const winResult = record(progress, {
    sessionId: "first-victory",
    modeId: "invaders",
    outcome: "won",
    score: 2_000,
    endedAt: "2026-07-02T12:00:00.000Z",
  });
  progress = winResult.progress;

  const cards = listAchievementCards(progress, {
    modeId: "slice-air",
    newlyUnlocked: sliceResult.achievementUnlocks,
  });
  assert.deepEqual(cards.map(({ id }) => id), [
    "first-session",
    "five-sessions",
    "first-win",
    "slice-air-score",
  ]);
  assert.equal(cards.find(({ id }) => id === "slice-air-score").isNew, true);
  assert.equal(cards.find(({ id }) => id === "first-win").unlockedAt, "2026-07-02T12:00:00.000Z");
  assert.equal(cards.find(({ id }) => id === "five-sessions").progressState.ratio, 0.4);

  const home = getHomeAchievementSummary(progress, { limit: 2 });
  assert.equal(home.unlockedCount, 3);
  assert.equal(home.totalCount, 9);
  assert.equal(home.completionPercent, 33);
  assert.equal(home.recent[0].id, "first-win");
  assert.equal(home.recent.length, 2);
  assert.equal(home.next.id, "five-sessions");

  const resultCards = getResultAchievementCards(progress, [
    { id: "slice-air-score" },
    "first-session",
    "unknown-achievement",
  ]);
  assert.deepEqual(resultCards.map(({ id }) => id), [
    "slice-air-score",
    "first-session",
  ]);
  assert.ok(resultCards.every((card) => card.unlocked && card.isNew));
});
