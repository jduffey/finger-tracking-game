import test from "node:test";
import assert from "node:assert/strict";
import {
  FULLSCREEN_BODY_SKELETON_MAX_PEOPLE,
  FULLSCREEN_HAND_SKELETON_MAX_HANDS,
  createFullscreenBodySkeletonOverlay,
  createFullscreenHandSkeletonOverlay,
} from "../src/fullscreenBodySkeletonOverlay.js";

function createPose(id, offset = 0) {
  return {
    id,
    score: 0.9,
    keypoints: [
      { name: "nose", u: 0.5 + offset, v: 0.1, score: 0.95 },
      { name: "left_shoulder", u: 0.35 + offset, v: 0.3, score: 0.8 },
      { name: "right_shoulder", u: 0.65 + offset, v: 0.3, score: 0.82 },
      { name: "left_elbow", u: 0.28 + offset, v: 0.48, score: 0.75 },
      { name: "left_wrist", u: 0.22 + offset, v: 0.64, score: 0.7 },
    ],
  };
}

test("createFullscreenBodySkeletonOverlay projects normalized pose points into viewport-local SVG geometry", () => {
  const overlay = createFullscreenBodySkeletonOverlay([createPose("person-1")], {
    width: 800,
    height: 600,
    style: { left: "100px", top: "50px", width: "800px", height: "600px" },
  });

  assert.equal(overlay.width, 800);
  assert.equal(overlay.height, 600);
  assert.equal(overlay.people.length, 1);
  assert.equal(overlay.people[0].id, "person-1");
  assert.deepEqual(
    overlay.people[0].keypoints.find((point) => point.name === "nose"),
    {
      name: "nose",
      score: 0.95,
      x: 400,
      y: 60,
      group: "head",
    },
  );
  assert.ok(
    overlay.people[0].bones.some(
      (bone) => bone.startName === "left_shoulder" && bone.endName === "right_shoulder",
    ),
  );
});

test("createFullscreenBodySkeletonOverlay limits fullscreen rendering to four people", () => {
  const poses = Array.from({ length: 6 }, (_value, index) =>
    createPose(`person-${index + 1}`, index * 0.01),
  );
  const overlay = createFullscreenBodySkeletonOverlay(poses, {
    width: 800,
    height: 600,
    style: {},
  });

  assert.equal(FULLSCREEN_BODY_SKELETON_MAX_PEOPLE, 4);
  assert.equal(overlay.people.length, 4);
  assert.deepEqual(
    overlay.people.map((person) => person.id),
    ["person-1", "person-2", "person-3", "person-4"],
  );
});

test("createFullscreenHandSkeletonOverlay projects full 21-point hand skeletons", () => {
  const hand = {
    id: "hand-1",
    landmarks: Array.from({ length: 21 }, (_value, index) => ({
      u: index / 20,
      v: 0.25 + index / 100,
    })),
  };

  const overlay = createFullscreenHandSkeletonOverlay([hand], {
    width: 800,
    height: 600,
    style: {},
  });

  assert.equal(overlay.hands.length, 1);
  assert.equal(overlay.hands[0].joints.length, 21);
  assert.ok(overlay.hands[0].bones.length >= 20);
  assert.deepEqual(
    overlay.hands[0].joints.find((joint) => joint.index === 8),
    {
      index: 8,
      x: 320,
      y: 198,
      isTip: true,
    },
  );
});

test("createFullscreenHandSkeletonOverlay limits fullscreen rendering to eight hands", () => {
  const hands = Array.from({ length: 10 }, (_value, handIndex) => ({
    id: `hand-${handIndex + 1}`,
    landmarks: [{ u: 0.5, v: 0.5 }],
  }));
  const overlay = createFullscreenHandSkeletonOverlay(hands, {
    width: 800,
    height: 600,
    style: {},
  });

  assert.equal(FULLSCREEN_HAND_SKELETON_MAX_HANDS, 8);
  assert.equal(overlay.hands.length, 8);
  assert.deepEqual(
    overlay.hands.map((hand) => hand.id),
    [
      "hand-1",
      "hand-2",
      "hand-3",
      "hand-4",
      "hand-5",
      "hand-6",
      "hand-7",
      "hand-8",
    ],
  );
});
