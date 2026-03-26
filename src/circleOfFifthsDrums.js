export const DRUM_BPM_MIN = 70;
export const DRUM_BPM_MAX = 160;
export const DRUM_STEPS_PER_BAR = 16;

export const DRUM_BEAT_PRESETS = [
  {
    id: "motorik",
    label: "Motorik",
    description: "Steady four-on-the-floor with bright hats.",
    steps: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
  },
  {
    id: "shuffle",
    label: "Shuffle",
    description: "Loose backbeat with syncopated kicks.",
    steps: {
      kick: [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
    },
  },
  {
    id: "night-drive",
    label: "Night Drive",
    description: "Sparse kick with off-beat hats and a wider pocket.",
    steps: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1],
    },
  },
];

export function clampDrumBpm(value) {
  if (!Number.isFinite(value)) {
    return DRUM_BPM_MIN;
  }

  return Math.min(DRUM_BPM_MAX, Math.max(DRUM_BPM_MIN, Math.round(value)));
}

export function getDrumBpmFromSliderPosition(clientX, rect) {
  if (!rect || !Number.isFinite(clientX) || rect.width <= 0) {
    return DRUM_BPM_MIN;
  }

  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return clampDrumBpm(DRUM_BPM_MIN + ratio * (DRUM_BPM_MAX - DRUM_BPM_MIN));
}

export function getSliderRatioFromDrumBpm(bpm) {
  const clamped = clampDrumBpm(bpm);
  return (clamped - DRUM_BPM_MIN) / (DRUM_BPM_MAX - DRUM_BPM_MIN);
}

export function getDrumBeatPreset(beatId) {
  return DRUM_BEAT_PRESETS.find((preset) => preset.id === beatId) ?? DRUM_BEAT_PRESETS[0];
}
