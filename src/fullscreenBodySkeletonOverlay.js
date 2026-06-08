export const FULLSCREEN_BODY_SKELETON_MAX_PEOPLE = 4;
export const FULLSCREEN_HAND_SKELETON_MAX_HANDS = 8;

const DEFAULT_KEYPOINT_THRESHOLD = 0.2;

const BODY_CONNECTIONS = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_eye", "right_eye"],
  ["nose", "left_eye"],
  ["nose", "right_eye"],
  ["left_eye", "left_ear"],
  ["right_eye", "right_ear"],
];

const KEYPOINT_GROUPS = {
  head: ["nose", "left_ear", "right_ear"],
  eyes: ["left_eye", "right_eye"],
  shoulders: ["left_shoulder", "right_shoulder"],
  arms: ["left_elbow", "right_elbow", "left_wrist", "right_wrist"],
  torso: ["left_hip", "right_hip", "left_shoulder", "right_shoulder"],
  legs: ["left_knee", "right_knee", "left_ankle", "right_ankle"],
};

const HAND_ROOT_CONNECTIONS = [
  [0, 1],
  [0, 5],
  [0, 9],
  [0, 13],
  [0, 17],
];

const HAND_FINGER_CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

const HAND_CONNECTIONS = [
  ...HAND_ROOT_CONNECTIONS,
  ...HAND_FINGER_CHAINS.flatMap((chain) =>
    chain.slice(1).map((landmarkIndex, index) => [chain[index], landmarkIndex]),
  ),
];

const HAND_TIP_INDEXES = new Set([4, 8, 12, 16, 20]);

function getPointGroup(name) {
  for (const [group, names] of Object.entries(KEYPOINT_GROUPS)) {
    if (names.includes(name)) {
      return group;
    }
  }
  return "other";
}

function isVisiblePoint(point, threshold) {
  return (
    point &&
    typeof point.name === "string" &&
    Number.isFinite(point.u) &&
    Number.isFinite(point.v) &&
    (point.score ?? 0) >= threshold
  );
}

function projectPosePoint(point, viewport) {
  return {
    name: point.name,
    score: Number.isFinite(point.score) ? point.score : 0,
    x: point.u * viewport.width,
    y: point.v * viewport.height,
    group: getPointGroup(point.name),
  };
}

export function createFullscreenBodySkeletonOverlay(poses, viewport, options = {}) {
  if (
    !viewport ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return null;
  }

  const keypointThreshold = Number.isFinite(options.keypointThreshold)
    ? options.keypointThreshold
    : DEFAULT_KEYPOINT_THRESHOLD;
  const maxPeople =
    Number.isFinite(options.maxPeople) && options.maxPeople > 0
      ? Math.floor(options.maxPeople)
      : FULLSCREEN_BODY_SKELETON_MAX_PEOPLE;
  const safePoses = Array.isArray(poses) ? poses.slice(0, maxPeople) : [];

  const people = safePoses
    .map((pose, personIndex) => {
      const sourceKeypoints = Array.isArray(pose?.keypoints) ? pose.keypoints : [];
      const keypoints = sourceKeypoints
        .filter((point) => isVisiblePoint(point, keypointThreshold))
        .map((point) => projectPosePoint(point, viewport));
      const keypointByName = new Map(keypoints.map((point) => [point.name, point]));

      const bones = BODY_CONNECTIONS.map(([startName, endName]) => {
        const start = keypointByName.get(startName);
        const end = keypointByName.get(endName);
        return start && end
          ? {
              startName,
              endName,
              x1: start.x,
              y1: start.y,
              x2: end.x,
              y2: end.y,
            }
          : null;
      }).filter(Boolean);

      const anchor =
        keypointByName.get("nose") ||
        keypointByName.get("left_shoulder") ||
        keypointByName.get("right_shoulder") ||
        keypoints[0] ||
        null;

      if (keypoints.length === 0 && bones.length === 0) {
        return null;
      }

      return {
        id: pose?.id ?? `person-${personIndex + 1}`,
        label: `Person ${personIndex + 1}`,
        score: Number.isFinite(pose?.score) ? pose.score : 0,
        keypoints,
        bones,
        anchor,
      };
    })
    .filter(Boolean);

  return {
    width: viewport.width,
    height: viewport.height,
    style: viewport.style,
    people,
  };
}

function projectHandLandmark(point, viewport, index) {
  if (!Number.isFinite(point?.u) || !Number.isFinite(point?.v)) {
    return null;
  }

  return {
    index,
    x: point.u * viewport.width,
    y: point.v * viewport.height,
    isTip: HAND_TIP_INDEXES.has(index),
  };
}

export function createFullscreenHandSkeletonOverlay(hands, viewport, options = {}) {
  if (
    !viewport ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return null;
  }

  const maxHands =
    Number.isFinite(options.maxHands) && options.maxHands > 0
      ? Math.floor(options.maxHands)
      : FULLSCREEN_HAND_SKELETON_MAX_HANDS;
  const safeHands = Array.isArray(hands) ? hands.slice(0, maxHands) : [];

  const projectedHands = safeHands
    .map((hand, handIndex) => {
      const landmarks = Array.isArray(hand?.landmarks) ? hand.landmarks : [];
      if (landmarks.length === 0) {
        return null;
      }

      const joints = landmarks
        .map((landmark, index) => projectHandLandmark(landmark, viewport, index))
        .filter(Boolean);
      const jointByIndex = new Map(joints.map((joint) => [joint.index, joint]));
      const bones = HAND_CONNECTIONS.map(([startIndex, endIndex]) => {
        const start = jointByIndex.get(startIndex);
        const end = jointByIndex.get(endIndex);
        return start && end
          ? {
              startIndex,
              endIndex,
              x1: start.x,
              y1: start.y,
              x2: end.x,
              y2: end.y,
            }
          : null;
      }).filter(Boolean);

      if (joints.length === 0 && bones.length === 0) {
        return null;
      }

      return {
        id: hand?.id ?? hand?.label ?? `hand-${handIndex + 1}`,
        label: hand?.label ?? `Hand ${handIndex + 1}`,
        joints,
        bones,
      };
    })
    .filter(Boolean);

  return {
    width: viewport.width,
    height: viewport.height,
    style: viewport.style,
    hands: projectedHands,
  };
}
