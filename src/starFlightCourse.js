export const STAR_FLIGHT_COURSE_IDS = Object.freeze({
  CADET: "cadet-circuit",
  COMET: "comet-slalom",
  NEBULA: "nebula-rush",
  FREE: "free-flight",
});

export const STAR_FLIGHT_COURSES = Object.freeze([
  Object.freeze({
    id: STAR_FLIGHT_COURSE_IDS.CADET,
    label: "Cadet Circuit",
    description: "Eight wide gates at a relaxed pace.",
    gateCount: 8,
    forwardSpeed: 270,
    radiusMin: 68,
    radiusMax: 84,
    horizontalRange: 126,
    verticalRange: 82,
    captureRatio: 0.86,
    turbulence: 0,
    parTimeMs: 38_000,
    scoreMultiplier: 1,
  }),
  Object.freeze({
    id: STAR_FLIGHT_COURSE_IDS.COMET,
    label: "Comet Slalom",
    description: "Twelve tighter gates with a gentle weave.",
    gateCount: 12,
    forwardSpeed: 325,
    radiusMin: 52,
    radiusMax: 68,
    horizontalRange: 178,
    verticalRange: 112,
    captureRatio: 0.8,
    turbulence: 8,
    parTimeMs: 47_000,
    scoreMultiplier: 1.25,
  }),
  Object.freeze({
    id: STAR_FLIGHT_COURSE_IDS.NEBULA,
    label: "Nebula Rush",
    description: "Fifteen small, drifting gates at full speed.",
    gateCount: 15,
    forwardSpeed: 380,
    radiusMin: 42,
    radiusMax: 58,
    horizontalRange: 205,
    verticalRange: 132,
    captureRatio: 0.75,
    turbulence: 18,
    parTimeMs: 50_000,
    scoreMultiplier: 1.55,
  }),
  Object.freeze({
    id: STAR_FLIGHT_COURSE_IDS.FREE,
    label: "Free Flight",
    description: "No finish line—chase gates for as long as you like.",
    gateCount: null,
    forwardSpeed: 300,
    radiusMin: 56,
    radiusMax: 78,
    horizontalRange: 172,
    verticalRange: 108,
    captureRatio: 0.82,
    turbulence: 5,
    parTimeMs: null,
    scoreMultiplier: 1,
  }),
]);

const COURSE_BY_ID = new Map(
  STAR_FLIGHT_COURSES.map((course) => [course.id, course]),
);

const DEFAULT_COURSE = STAR_FLIGHT_COURSES[0];
const STAR_FLIGHT_GATE_PASS_Z = 72;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function safeRandom(rng) {
  const value = typeof rng === "function" ? rng() : Math.random();
  return clamp(finiteNumber(value, 0.5), 0, 1);
}

function randomBetween(min, max, rng) {
  return min + safeRandom(rng) * Math.max(0, max - min);
}

export function getStarFlightCourse(courseId) {
  return COURSE_BY_ID.get(courseId) ?? DEFAULT_COURSE;
}

export function createStarFlightCourseProgress(
  courseId = STAR_FLIGHT_COURSE_IDS.CADET,
  startedAtMs = 0,
) {
  const course = getStarFlightCourse(courseId);
  const safeStartedAtMs = Math.max(0, finiteNumber(startedAtMs));
  return {
    courseId: course.id,
    status: "active",
    gatesAttempted: 0,
    gatesHit: 0,
    gatesMissed: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    startedAtMs: safeStartedAtMs,
    elapsedMs: 0,
    completedAtMs: null,
    lastGateRating: "",
    lastGateMessage: "Line up the first gate",
    lastGatePoints: 0,
  };
}

export function createStarFlightGate(
  courseId,
  {
    id = "gate",
    z = 800,
    rng = Math.random,
  } = {},
) {
  const course = getStarFlightCourse(courseId);
  const baseX = randomBetween(
    -course.horizontalRange,
    course.horizontalRange,
    rng,
  );
  const baseY = randomBetween(
    -course.verticalRange,
    course.verticalRange,
    rng,
  );
  return {
    id,
    x: baseX,
    y: baseY,
    baseX,
    baseY,
    z: Math.max(STAR_FLIGHT_GATE_PASS_Z + 1, finiteNumber(z, 800)),
    radius: randomBetween(course.radiusMin, course.radiusMax, rng),
    driftPhase: randomBetween(0, Math.PI * 2, rng),
    cycle: 0,
  };
}

export function updateStarFlightGateDrift(
  gate,
  courseId,
  elapsedMs,
) {
  if (!gate) {
    return gate;
  }
  const course = getStarFlightCourse(courseId);
  const turbulence = Math.max(0, course.turbulence);
  if (turbulence <= 0) {
    return {
      ...gate,
      x: finiteNumber(gate.baseX, finiteNumber(gate.x)),
      y: finiteNumber(gate.baseY, finiteNumber(gate.y)),
    };
  }
  const phase =
    finiteNumber(gate.driftPhase) +
    Math.max(0, finiteNumber(elapsedMs)) / 1_000;
  const baseX = finiteNumber(gate.baseX, finiteNumber(gate.x));
  const baseY = finiteNumber(gate.baseY, finiteNumber(gate.y));
  return {
    ...gate,
    x: baseX + Math.sin(phase * 0.78) * turbulence,
    y: baseY + Math.cos(phase * 0.63) * turbulence * 0.68,
  };
}

export function didStarFlightGateCrossPassPlane(
  previousZ,
  nextZ,
  passZ = STAR_FLIGHT_GATE_PASS_Z,
) {
  const safePassZ = Math.max(0, finiteNumber(passZ, STAR_FLIGHT_GATE_PASS_Z));
  return (
    finiteNumber(previousZ, safePassZ) > safePassZ &&
    finiteNumber(nextZ, safePassZ) <= safePassZ
  );
}

export function evaluateStarFlightGate({
  courseId,
  gate,
  shipX = 0,
  shipY = 0,
} = {}) {
  const course = getStarFlightCourse(courseId);
  const radius = Math.max(1, finiteNumber(gate?.radius, course.radiusMin));
  const dx = finiteNumber(gate?.x) - finiteNumber(shipX);
  const dy = finiteNumber(gate?.y) - finiteNumber(shipY);
  const distance = Math.hypot(dx, dy);
  const captureRadius = radius * course.captureRatio;
  const normalizedOffset = distance / Math.max(1, captureRadius);
  const hit = normalizedOffset <= 1;

  let rating = "missed";
  let precisionBonus = 0;
  if (hit && normalizedOffset <= 0.28) {
    rating = "perfect";
    precisionBonus = 150;
  } else if (hit && normalizedOffset <= 0.62) {
    rating = "clean";
    precisionBonus = 85;
  } else if (hit) {
    rating = "edge";
    precisionBonus = 35;
  }

  return {
    hit,
    rating,
    distance,
    normalizedOffset,
    precisionBonus,
  };
}

export function recordStarFlightGate(
  progress,
  evaluation,
  timestampMs,
) {
  if (!progress || progress.status === "complete") {
    return progress;
  }
  const course = getStarFlightCourse(progress.courseId);
  const hit = Boolean(evaluation?.hit);
  const gatesAttempted = progress.gatesAttempted + 1;
  const streak = hit ? progress.streak + 1 : 0;
  const streakBonus = hit ? Math.min(8, Math.max(0, streak - 1)) * 18 : 0;
  const gatePoints = hit
    ? Math.round(
        (100 + finiteNumber(evaluation?.precisionBonus) + streakBonus) *
          course.scoreMultiplier,
      )
    : 0;
  const isComplete =
    Number.isFinite(course.gateCount) &&
    gatesAttempted >= course.gateCount;
  const safeTimestampMs = Math.max(
    progress.startedAtMs,
    finiteNumber(timestampMs, progress.startedAtMs + progress.elapsedMs),
  );
  const elapsedMs = Math.max(0, safeTimestampMs - progress.startedAtMs);
  const rating = hit ? evaluation?.rating || "clean" : "missed";
  const ratingLabel =
    rating === "perfect"
      ? "Perfect gate"
      : rating === "clean"
        ? "Clean gate"
        : rating === "edge"
          ? "Edge catch"
          : "Gate missed";

  return {
    ...progress,
    status: isComplete ? "complete" : "active",
    gatesAttempted,
    gatesHit: progress.gatesHit + (hit ? 1 : 0),
    gatesMissed: progress.gatesMissed + (hit ? 0 : 1),
    score: progress.score + gatePoints,
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    elapsedMs,
    completedAtMs: isComplete ? safeTimestampMs : null,
    lastGateRating: rating,
    lastGateMessage: hit
      ? `${ratingLabel} · +${gatePoints}`
      : `${ratingLabel} · center the next ring`,
    lastGatePoints: gatePoints,
  };
}

export function advanceStarFlightCourseClock(progress, timestampMs) {
  if (!progress || progress.status === "complete") {
    return progress;
  }
  const safeTimestampMs = Math.max(
    progress.startedAtMs,
    finiteNumber(timestampMs, progress.startedAtMs),
  );
  const elapsedMs = safeTimestampMs - progress.startedAtMs;
  return elapsedMs === progress.elapsedMs
    ? progress
    : {
        ...progress,
        elapsedMs,
      };
}

export function getStarFlightCourseResult(progress) {
  if (!progress) {
    return null;
  }
  const course = getStarFlightCourse(progress.courseId);
  const accuracy =
    progress.gatesAttempted > 0
      ? progress.gatesHit / progress.gatesAttempted
      : 0;
  const withinGoldTime =
    Number.isFinite(course.parTimeMs) &&
    progress.elapsedMs <= course.parTimeMs;
  const withinSilverTime =
    Number.isFinite(course.parTimeMs) &&
    progress.elapsedMs <= course.parTimeMs * 1.25;

  let medal = "";
  if (progress.status === "complete") {
    if (accuracy >= 0.85 && withinGoldTime) {
      medal = "Gold";
    } else if (accuracy >= 0.65 && withinSilverTime) {
      medal = "Silver";
    } else if (progress.gatesHit > 0) {
      medal = "Bronze";
    } else {
      medal = "Course logged";
    }
  }

  return {
    course,
    accuracy,
    accuracyPercent: Math.round(accuracy * 100),
    medal,
    parTimeMs: course.parTimeMs,
    isComplete: progress.status === "complete",
  };
}
