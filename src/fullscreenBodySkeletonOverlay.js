export const FULLSCREEN_BODY_SKELETON_MAX_PEOPLE = 4;

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
