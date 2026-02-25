export const GESTURE_IDS = {
  PINCH_GRAB: "pinch_grab",
  PINCH_RELEASE: "pinch_release",
  OPEN_PALM: "open_palm",
  SWIPE_LEFT: "swipe_left",
  SWIPE_RIGHT: "swipe_right",
  PUSH_FORWARD: "push_forward",
  CIRCLE: "circle",
  EXPAND: "expand",
  COMPRESS: "compress",
  ROTATE_TWIST: "rotate_twist",
  SYMMETRIC_SWIPE: "symmetric_swipe",
};

export const SINGLE_HAND_GESTURES = [
  GESTURE_IDS.PINCH_GRAB,
  GESTURE_IDS.PINCH_RELEASE,
  GESTURE_IDS.OPEN_PALM,
  GESTURE_IDS.SWIPE_LEFT,
  GESTURE_IDS.SWIPE_RIGHT,
  GESTURE_IDS.PUSH_FORWARD,
  GESTURE_IDS.CIRCLE,
];

export const TWO_HAND_GESTURES = [
  GESTURE_IDS.EXPAND,
  GESTURE_IDS.COMPRESS,
  GESTURE_IDS.ROTATE_TWIST,
  GESTURE_IDS.SYMMETRIC_SWIPE,
];

export const GESTURE_DEFINITIONS = [
  {
    id: GESTURE_IDS.PINCH_GRAB,
    label: "Pinch Grab",
    group: "single",
    description: "Pinch closes to grab/manipulate",
    discrete: true,
  },
  {
    id: GESTURE_IDS.PINCH_RELEASE,
    label: "Pinch Release",
    group: "single",
    description: "Pinch opens to release",
    discrete: true,
  },
  {
    id: GESTURE_IDS.OPEN_PALM,
    label: "Open Palm",
    group: "single",
    description: "Open hand idle/reset pose",
    discrete: true,
  },
  {
    id: GESTURE_IDS.SWIPE_LEFT,
    label: "Swipe Left",
    group: "single",
    description: "Fast leftward pointer motion",
    discrete: true,
  },
  {
    id: GESTURE_IDS.SWIPE_RIGHT,
    label: "Swipe Right",
    group: "single",
    description: "Fast rightward pointer motion",
    discrete: true,
  },
  {
    id: GESTURE_IDS.PUSH_FORWARD,
    label: "Push Forward",
    group: "single",
    description: "Quick depth-inferred forward push",
    discrete: true,
  },
  {
    id: GESTURE_IDS.CIRCLE,
    label: "Circle Motion",
    group: "single",
    description: "Pointer draws circle arc",
    discrete: true,
  },
  {
    id: GESTURE_IDS.EXPAND,
    label: "Expand",
    group: "double",
    description: "Two hands move apart",
    discrete: true,
  },
  {
    id: GESTURE_IDS.COMPRESS,
    label: "Compress",
    group: "double",
    description: "Two hands move together",
    discrete: true,
  },
  {
    id: GESTURE_IDS.ROTATE_TWIST,
    label: "Rotate/Twist",
    group: "double",
    description: "Relative hand angle change",
    discrete: true,
  },
  {
    id: GESTURE_IDS.SYMMETRIC_SWIPE,
    label: "Symmetric Swipe",
    group: "double",
    description: "Both hands swipe rapidly in same direction",
    discrete: true,
  },
];

export const ALL_GESTURE_IDS = GESTURE_DEFINITIONS.map((entry) => entry.id);

export const PERSONALIZATION_MIN_SAMPLES = 5;
export const PERSONALIZATION_STORAGE_KEY = "minority_report_personalization_v1";
export const PERSONALIZATION_VERSION = 1;

export const WINDOW_SIZE = 24;
export const DISCRETE_GESTURE_HOLD_FRAMES = 2;
export const GESTURE_COOLDOWN_MS = 600;

export function createEmptyConfidenceMap() {
  return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
    accumulator[gestureId] = 0;
    return accumulator;
  }, {});
}

export function isTwoHandGesture(gestureId) {
  return TWO_HAND_GESTURES.includes(gestureId);
}

export function isSingleHandGesture(gestureId) {
  return SINGLE_HAND_GESTURES.includes(gestureId);
}
