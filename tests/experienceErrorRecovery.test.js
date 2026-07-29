import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPERIENCE_ERROR_CATEGORIES,
  classifyExperienceError,
  createExperienceErrorRecovery,
} from "../src/experienceErrorRecovery.js";

test("classifies recoverable browser failures into player-relevant groups", () => {
  assert.equal(
    classifyExperienceError({ name: "NotAllowedError" }),
    EXPERIENCE_ERROR_CATEGORIES.CAMERA_PERMISSION,
  );
  assert.equal(
    classifyExperienceError({ name: "NotReadableError" }),
    EXPERIENCE_ERROR_CATEGORIES.CAMERA_DEVICE,
  );
  assert.equal(
    classifyExperienceError({ name: "GPUValidationError" }),
    EXPERIENCE_ERROR_CATEGORIES.GRAPHICS,
  );
  assert.equal(
    classifyExperienceError(new Error("Failed to fetch dynamically imported module")),
    EXPERIENCE_ERROR_CATEGORIES.NETWORK,
  );
  assert.equal(
    classifyExperienceError({ name: "QuotaExceededError" }),
    EXPERIENCE_ERROR_CATEGORIES.STORAGE,
  );
  assert.equal(
    classifyExperienceError(new Error("Something surprising")),
    EXPERIENCE_ERROR_CATEGORIES.UNEXPECTED,
  );
});

test("creates actionable recovery copy without leaking raw diagnostics", () => {
  const privateMessage = "secret-token=very-private-value";
  const recovery = createExperienceErrorRecovery(
    {
      message: privateMessage,
      name: "RenderExplosion",
      stack: `RenderExplosion: ${privateMessage}\n at PrivateComponent`,
    },
    { experienceName: "Sky Patrol" },
  );

  assert.match(recovery.title, /unexpected pause/i);
  assert.match(recovery.consequence, /round stopped/i);
  assert.match(recovery.nextStep, /retry/i);
  assert.match(recovery.report.text, /Sky Patrol/);
  assert.match(recovery.report.text, /Private details omitted/);
  assert.doesNotMatch(recovery.report.text, /secret-token|PrivateComponent|RenderExplosion/);
  assert.deepEqual(Object.keys(recovery.report).sort(), [
    "category",
    "experienceName",
    "reference",
    "text",
  ]);
  assert.equal(Object.isFrozen(recovery.report), true);
});

test("privacy-safe references use error classes without fingerprinting messages", () => {
  const first = createExperienceErrorRecovery(
    Object.assign(new Error("failure one"), { name: "RenderFailure" }),
    { experienceName: "Brick Dodger" },
  );
  const sameClass = createExperienceErrorRecovery(
    Object.assign(new Error("a private and different message"), {
      name: "RenderFailure",
    }),
    { experienceName: "Brick Dodger" },
  );
  const different = createExperienceErrorRecovery(
    Object.assign(new Error("failure one"), { name: "AssetFailure" }),
    { experienceName: "Brick Dodger" },
  );

  assert.match(first.reference, /^MA-[A-Z0-9]{7}$/);
  assert.equal(first.reference, sameClass.reference);
  assert.notEqual(first.reference, different.reference);
});

test("normalizes untrusted experience labels before presenting or reporting them", () => {
  const recovery = createExperienceErrorRecovery(new Error("boom"), {
    experienceName: "  World\u0000\n   Painter  ",
  });
  assert.equal(recovery.experienceName, "World Painter");
  assert.match(recovery.report.text, /Experience: World Painter/);

  const unnamed = createExperienceErrorRecovery(new Error("boom"));
  assert.equal(unnamed.experienceName, "This experience");
});
