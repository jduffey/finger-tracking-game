import test from "node:test";
import assert from "node:assert/strict";

import {
  STAR_FLIGHT_COURSE_IDS,
  advanceStarFlightCourseClock,
  createStarFlightCourseProgress,
  createStarFlightGate,
  didStarFlightGateCrossPassPlane,
  evaluateStarFlightGate,
  getStarFlightCourse,
  getStarFlightCourseResult,
  recordStarFlightGate,
  updateStarFlightGateDrift,
} from "../src/starFlightCourse.js";

test("Star Flight exposes distinct finite courses and an endless free flight", () => {
  const cadet = getStarFlightCourse(STAR_FLIGHT_COURSE_IDS.CADET);
  const comet = getStarFlightCourse(STAR_FLIGHT_COURSE_IDS.COMET);
  const nebula = getStarFlightCourse(STAR_FLIGHT_COURSE_IDS.NEBULA);
  const free = getStarFlightCourse(STAR_FLIGHT_COURSE_IDS.FREE);

  assert.equal(cadet.gateCount, 8);
  assert.ok(comet.forwardSpeed > cadet.forwardSpeed);
  assert.ok(nebula.turbulence > comet.turbulence);
  assert.equal(free.gateCount, null);
});

test("Star Flight gate generation is deterministic with a supplied random source", () => {
  const samples = [0.25, 0.75, 0.5, 0.125];
  let index = 0;
  const gate = createStarFlightGate(STAR_FLIGHT_COURSE_IDS.COMET, {
    id: "gate-4",
    z: 640,
    rng: () => samples[index++],
  });

  assert.equal(gate.id, "gate-4");
  assert.equal(gate.z, 640);
  assert.equal(gate.x, -89);
  assert.equal(gate.y, 56);
  assert.equal(gate.radius, 60);
  assert.equal(gate.driftPhase, Math.PI * 0.25);
});

test("Star Flight resolves a gate once when it crosses the ship plane", () => {
  assert.equal(didStarFlightGateCrossPassPlane(90, 65), true);
  assert.equal(didStarFlightGateCrossPassPlane(65, 40), false);
  assert.equal(didStarFlightGateCrossPassPlane(90, 75), false);
});

test("Star Flight distinguishes perfect, clean, edge, and missed gates", () => {
  const gate = { x: 0, y: 0, radius: 80 };
  const perfect = evaluateStarFlightGate({
    courseId: STAR_FLIGHT_COURSE_IDS.CADET,
    gate,
    shipX: 0,
    shipY: 0,
  });
  const clean = evaluateStarFlightGate({
    courseId: STAR_FLIGHT_COURSE_IDS.CADET,
    gate,
    shipX: 32,
    shipY: 0,
  });
  const edge = evaluateStarFlightGate({
    courseId: STAR_FLIGHT_COURSE_IDS.CADET,
    gate,
    shipX: 60,
    shipY: 0,
  });
  const missed = evaluateStarFlightGate({
    courseId: STAR_FLIGHT_COURSE_IDS.CADET,
    gate,
    shipX: 100,
    shipY: 0,
  });

  assert.equal(perfect.rating, "perfect");
  assert.equal(clean.rating, "clean");
  assert.equal(edge.rating, "edge");
  assert.equal(missed.rating, "missed");
  assert.equal(missed.hit, false);
});

test("Star Flight scores precision and streaks while resetting the streak on a miss", () => {
  let progress = createStarFlightCourseProgress(
    STAR_FLIGHT_COURSE_IDS.CADET,
    1_000,
  );
  progress = recordStarFlightGate(
    progress,
    { hit: true, rating: "perfect", precisionBonus: 150 },
    2_000,
  );
  const firstScore = progress.score;
  progress = recordStarFlightGate(
    progress,
    { hit: true, rating: "clean", precisionBonus: 85 },
    3_000,
  );

  assert.equal(progress.streak, 2);
  assert.ok(progress.score - firstScore > 185);

  progress = recordStarFlightGate(
    progress,
    { hit: false, rating: "missed", precisionBonus: 0 },
    4_000,
  );
  assert.equal(progress.streak, 0);
  assert.equal(progress.gatesMissed, 1);
  assert.match(progress.lastGateMessage, /Gate missed/);
});

test("Star Flight finite courses complete with accuracy, time, and a medal", () => {
  let progress = createStarFlightCourseProgress(
    STAR_FLIGHT_COURSE_IDS.CADET,
    5_000,
  );
  for (let gateIndex = 0; gateIndex < 8; gateIndex += 1) {
    progress = recordStarFlightGate(
      progress,
      { hit: true, rating: "perfect", precisionBonus: 150 },
      6_000 + gateIndex * 2_000,
    );
  }

  const result = getStarFlightCourseResult(progress);
  assert.equal(progress.status, "complete");
  assert.equal(progress.gatesAttempted, 8);
  assert.equal(result.accuracyPercent, 100);
  assert.equal(result.medal, "Gold");
});

test("Star Flight free flight never forces a result", () => {
  let progress = createStarFlightCourseProgress(
    STAR_FLIGHT_COURSE_IDS.FREE,
    0,
  );
  for (let gateIndex = 0; gateIndex < 30; gateIndex += 1) {
    progress = recordStarFlightGate(
      progress,
      { hit: gateIndex % 2 === 0, rating: "clean", precisionBonus: 85 },
      gateIndex * 1_000,
    );
  }
  assert.equal(progress.status, "active");
  assert.equal(progress.gatesAttempted, 30);
});

test("Star Flight advances only active course clocks", () => {
  const progress = createStarFlightCourseProgress(
    STAR_FLIGHT_COURSE_IDS.CADET,
    1_000,
  );
  const advanced = advanceStarFlightCourseClock(progress, 4_250);
  assert.equal(advanced.elapsedMs, 3_250);

  const complete = { ...advanced, status: "complete" };
  assert.equal(advanceStarFlightCourseClock(complete, 9_000), complete);
});

test("Star Flight turbulence is reproducible and leaves cadet gates still", () => {
  const gate = {
    x: 12,
    y: -8,
    baseX: 12,
    baseY: -8,
    driftPhase: 0.4,
  };
  const still = updateStarFlightGateDrift(
    gate,
    STAR_FLIGHT_COURSE_IDS.CADET,
    2_000,
  );
  const drifting = updateStarFlightGateDrift(
    gate,
    STAR_FLIGHT_COURSE_IDS.NEBULA,
    2_000,
  );
  assert.equal(still.x, 12);
  assert.equal(still.y, -8);
  assert.notEqual(drifting.x, 12);
  assert.notEqual(drifting.y, -8);
});
