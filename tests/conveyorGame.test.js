import test from "node:test";
import assert from "node:assert/strict";
import {
  computeConveyorBackLaunchSpeed,
  CONVEYOR_AUTO_THROW_BACK_SPEED,
  CONVEYOR_MAX_RELEASE_SPEED_BONUS,
  CONVEYOR_RELEASE_SPEED_TO_THROW_RATIO,
} from "../src/conveyorGame.js";

test("computeConveyorBackLaunchSpeed returns the base throw speed for a stationary release", () => {
  assert.equal(computeConveyorBackLaunchSpeed(0, 0), CONVEYOR_AUTO_THROW_BACK_SPEED);
  assert.equal(
    computeConveyorBackLaunchSpeed(Number.NaN, Number.POSITIVE_INFINITY),
    CONVEYOR_AUTO_THROW_BACK_SPEED,
  );
});

test("computeConveyorBackLaunchSpeed adds a flick bonus from release velocity", () => {
  const vx = 400;
  const vy = 300;
  const expected = Math.round(
    CONVEYOR_AUTO_THROW_BACK_SPEED +
      Math.hypot(vx, vy) * CONVEYOR_RELEASE_SPEED_TO_THROW_RATIO,
  );

  assert.equal(computeConveyorBackLaunchSpeed(vx, vy), expected);
});

test("computeConveyorBackLaunchSpeed caps the flick bonus", () => {
  assert.equal(
    computeConveyorBackLaunchSpeed(10_000, 10_000),
    CONVEYOR_AUTO_THROW_BACK_SPEED + CONVEYOR_MAX_RELEASE_SPEED_BONUS,
  );
});
