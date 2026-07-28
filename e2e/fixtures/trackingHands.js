export const SYNTHETIC_HAND_MODEL_STATES = Object.freeze({
  OPEN: "open",
  PINCHED: "pinched",
  MISSING: "missing",
});

const OPEN_LANDMARKS = [
  [0.6, 0.72],
  [0.58, 0.64],
  [0.58, 0.6],
  [0.59, 0.56],
  [0.58, 0.54],
  [0.65, 0.58],
  [0.68, 0.54],
  [0.69, 0.51],
  [0.7, 0.48],
  [0.61, 0.56],
  [0.62, 0.48],
  [0.63, 0.4],
  [0.64, 0.32],
  [0.57, 0.57],
  [0.57, 0.49],
  [0.58, 0.41],
  [0.58, 0.34],
  [0.53, 0.59],
  [0.52, 0.52],
  [0.52, 0.45],
  [0.52, 0.38],
];

function createPoint([u, v]) {
  return { u, v, uRaw: u, vRaw: v, wasClamped: false };
}

export function createSyntheticTrackedHand({ pinched = false } = {}) {
  const coordinates = OPEN_LANDMARKS.map(([u, v]) => [u, v]);
  if (pinched) {
    coordinates[3] = [0.65, 0.51];
    coordinates[4] = [0.68, 0.49];
  }
  const landmarks = coordinates.map(createPoint);
  const fingerTips = {
    thumb: landmarks[4],
    index: landmarks[8],
    middle: landmarks[12],
    ring: landmarks[16],
    pinky: landmarks[20],
  };

  return {
    score: 0.99,
    handedness: "Right",
    indexTip: fingerTips.index,
    thumbTip: fingerTips.thumb,
    fingerTips,
    landmarks,
    pinchDistance: Math.hypot(
      fingerTips.thumb.u - fingerTips.index.u,
      fingerTips.thumb.v - fingerTips.index.v,
    ),
  };
}

export const SYNTHETIC_OPEN_HAND = Object.freeze(
  createSyntheticTrackedHand(),
);
export const SYNTHETIC_PINCHED_HAND = Object.freeze(
  createSyntheticTrackedHand({ pinched: true }),
);
