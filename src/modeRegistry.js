export const PRODUCT_AREAS = Object.freeze({
  PLAY: "play",
  CREATE: "create",
  LABS: "labs",
  SETUP: "setup",
});

export const MODE_MATURITY = Object.freeze({
  FLAGSHIP: "flagship",
  SUPPORTED: "supported",
  PREVIEW: "preview",
  EXPERIMENTAL: "experimental",
  INTERNAL: "internal",
});

export const TRACKING_PROFILES = Object.freeze({
  NONE: "none",
  ONE_HAND: "one-hand",
  TWO_HANDS: "two-hands",
  MULTI_HAND: "multi-hand",
  POSE: "pose",
  HANDS_AND_POSE: "hands-and-pose",
});

export const APP_PHASES = Object.freeze({
  HOME: "HOME",
  TRACKING_SETUP: "TRACKING_SETUP",
  SETTINGS: "SETTINGS",
  ARCADE_RUN: "ARCADE_RUN",
  CALIBRATION: "CALIBRATION",
  FULLSCREEN_CAMERA: "FULLSCREEN_CAMERA",
  SANDBOX: "SANDBOX",
  FLIGHT: "FLIGHT",
  RUNNER: "RUNNER",
  BODY_POSE: "BODY_POSE",
  OFF_AXIS_LAB: "OFF_AXIS_LAB",
  MINORITY_REPORT_LAB: "MINORITY_REPORT_LAB",
  CONVEYOR: "CONVEYOR",
  ROULETTE: "ROULETTE",
  SPATIAL_GESTURE_MEMORY: "SPATIAL_GESTURE_MEMORY",
  GESTURE_ANALYTICS_LAB: "GESTURE_ANALYTICS_LAB",
  GESTURE_ART_LAB: "GESTURE_ART_LAB",
  GESTURE_CONTROL_OS: "GESTURE_CONTROL_OS",
  GAME: "GAME",
});

const sharedFullscreenGame = {
  phase: APP_PHASES.FULLSCREEN_CAMERA,
  entryKind: "fullscreen-mode",
  trackingProfile: TRACKING_PROFILES.ONE_HAND,
  supportsPointerFallback: true,
  supportsPause: true,
  supportsResults: true,
};

const catalog = [
  {
    id: "home",
    label: "Home",
    path: "/",
    area: PRODUCT_AREAS.SETUP,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Featured games, creative tools, recent activity, and setup.",
    phase: APP_PHASES.HOME,
    entryKind: "home",
    trackingProfile: TRACKING_PROFILES.NONE,
    hiddenFromLibrary: true,
  },
  {
    id: "tracking-setup",
    label: "Camera & Tracking Setup",
    path: "/setup",
    area: PRODUCT_AREAS.SETUP,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Check camera framing, lighting, gesture readiness, and calibration.",
    phase: APP_PHASES.TRACKING_SETUP,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    typicalMinutes: 1,
    supportsPointerFallback: true,
  },
  {
    id: "arcade-run",
    label: "Arcade Run",
    path: "/play/arcade-run",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Turn one time choice into a varied, scored motion-game playlist.",
    objective: "Complete a three, five, or ten-minute route and earn a circuit medal.",
    phase: APP_PHASES.ARCADE_RUN,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.NONE,
    controlHint: "Pick a route · Play each game · Finish the circuit",
    typicalMinutes: 5,
    difficulty: "Adaptive",
    players: 1,
    supportsPointerFallback: true,
    supportsResults: true,
    dailyChallenge: true,
  },
  {
    id: "whack-a-mole",
    label: "Ready, Set, Whack!",
    path: "/play/whack-a-mole",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "A fast reflex round that doubles as a playful tracking warm-up.",
    objective: "Hit as many targets as you can before time runs out.",
    phase: APP_PHASES.GAME,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Point to hit",
    typicalMinutes: 1,
    difficulty: "Easy",
    players: 1,
    supportsPointerFallback: true,
    supportsPause: true,
    supportsResults: true,
    dailyChallenge: true,
  },
  {
    id: "sky-patrol",
    label: "Sky Patrol",
    path: "/play/sky-patrol",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Fly a coastal defense mission using your fingertip and pinch cannons.",
    objective: "Survive the sortie, defeat threats, and protect the coastline.",
    iconSrc: "/assets/launcher-icons/sky-patrol.png",
    fullscreenMode: "sky-patrol",
    controlHint: "Point to steer · Pinch to fire",
    typicalMinutes: 4,
    difficulty: "Medium",
    players: 1,
    featured: true,
    dailyChallenge: true,
    ...sharedFullscreenGame,
  },
  {
    id: "slice-air",
    label: "Slice Air",
    path: "/play/slice-air",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Build slicing combos with quick, accurate fingertip swipes.",
    objective: "Slice fruit, avoid bombs, and build the longest combo.",
    iconSrc: "/assets/launcher-icons/slice-air.png",
    fullscreenMode: "fruit-ninja",
    controlHint: "Swipe to slice",
    typicalMinutes: 2,
    difficulty: "Easy",
    players: 1,
    featured: true,
    dailyChallenge: true,
    ...sharedFullscreenGame,
  },
  {
    id: "missile-command",
    label: "Missile Command",
    path: "/play/missile-command",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Aim and launch interceptors to protect the remaining cities.",
    objective: "Defend every surviving city through escalating attack waves.",
    iconSrc: "/assets/launcher-icons/missile-command.png",
    fullscreenMode: "missile-command",
    controlHint: "Point to aim · Pinch to launch",
    typicalMinutes: 4,
    difficulty: "Medium",
    players: 1,
    featured: true,
    dailyChallenge: true,
    ...sharedFullscreenGame,
  },
  {
    id: "brick-dodger",
    label: "Brick Dodger",
    path: "/play/brick-dodger",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Thread through falling hazards and collect risky bonuses.",
    objective: "Survive the longest and build a near-miss streak.",
    iconSrc: "/assets/launcher-icons/brick-dodger.png",
    fullscreenMode: "brick-dodger",
    controlHint: "Move left and right",
    typicalMinutes: 3,
    difficulty: "Medium",
    players: 1,
    featured: true,
    ...sharedFullscreenGame,
  },
  {
    id: "spatial-memory",
    label: "Gesture Memory",
    path: "/play/gesture-memory",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Watch a gesture sequence, then reproduce it from memory.",
    objective: "Repeat increasingly long gesture sequences without a mistake.",
    phase: APP_PHASES.SPATIAL_GESTURE_MEMORY,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.TWO_HANDS,
    controlHint: "Watch · Remember · Repeat",
    typicalMinutes: 3,
    difficulty: "Adaptive",
    players: 1,
    featured: true,
    supportsPointerFallback: true,
    supportsPause: true,
    supportsResults: true,
  },
  {
    id: "hand-bounce",
    label: "Hand Bounce",
    path: "/play/hand-bounce",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Volley through a three-stage circuit of targets and trick shots.",
    objective: "Clear each timed rally, aim through targets, and charge a power volley.",
    iconSrc: "/assets/launcher-icons/hand-bounce.png",
    fullscreenMode: "hand-bounce",
    controlHint: "Move your palm",
    typicalMinutes: 2,
    difficulty: "Easy",
    players: 1,
    dailyChallenge: true,
    ...sharedFullscreenGame,
  },
  {
    id: "breakout",
    label: "Breakout",
    path: "/play/breakout",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Steer the paddle, clear layouts, and catch multiball capsules.",
    objective: "Clear every brick before running out of lives.",
    iconSrc: "/assets/launcher-icons/breakout.png",
    fullscreenMode: "breakout",
    controlHint: "Move to steer",
    typicalMinutes: 4,
    difficulty: "Medium",
    players: 1,
    variants: ["classic", "find-your-grind-breakout"],
    ...sharedFullscreenGame,
  },
  {
    id: "breakout-coop",
    label: "Two-Hand Breakout",
    path: "/play/breakout-coop",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Control one paddle and a timed shield with two different hands.",
    objective: "Clear prism layouts by coordinating your primary and support hands.",
    iconSrc: "/assets/launcher-icons/breakout-coop.png",
    fullscreenMode: "breakout-coop",
    controlHint: "Point to steer · Support pinch shields",
    typicalMinutes: 4,
    difficulty: "Medium",
    players: 1,
    ...sharedFullscreenGame,
    trackingProfile: TRACKING_PROFILES.TWO_HANDS,
  },
  {
    id: "finger-pong",
    label: "Finger Pong",
    path: "/play/finger-pong",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Return increasingly fast shots with precise paddle placement.",
    objective: "Win the match and set a new best rally.",
    iconSrc: "/assets/launcher-icons/finger-pong.png",
    fullscreenMode: "finger-pong",
    controlHint: "Move left and right",
    typicalMinutes: 3,
    difficulty: "Medium",
    players: 1,
    ...sharedFullscreenGame,
  },
  {
    id: "tic-tac-toe",
    label: "Tic Tac Toe",
    path: "/play/tic-tac-toe",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Drag marks from the rail and outthink the computer opponent.",
    objective: "Complete one tactile three-in-a-row round against the computer.",
    iconSrc: "/assets/launcher-icons/tic-tac-toe.png",
    fullscreenMode: "tic-tac-toe",
    controlHint: "Point and drag",
    typicalMinutes: 3,
    difficulty: "Medium",
    players: 1,
    ...sharedFullscreenGame,
  },
  {
    id: "invaders",
    label: "Invaders",
    path: "/play/invaders",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Sweep across the formation and repel descending waves.",
    objective: "Clear every wave before the invaders reach your line.",
    iconSrc: "/assets/launcher-icons/invaders.png",
    fullscreenMode: "invaders",
    controlHint: "Point to steer · Pinch to fire",
    typicalMinutes: 3,
    difficulty: "Medium",
    players: 1,
    ...sharedFullscreenGame,
  },
  {
    id: "flappy",
    label: "Flappy",
    path: "/play/flappy",
    area: PRODUCT_AREAS.PLAY,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Use distinct pinches to navigate an endless obstacle course.",
    objective: "Pass as many gates as possible without crashing.",
    iconSrc: "/assets/launcher-icons/flappy.png",
    fullscreenMode: "flappy",
    controlHint: "Pinch to flap",
    typicalMinutes: 2,
    difficulty: "Hard",
    players: 1,
    dailyChallenge: true,
    ...sharedFullscreenGame,
  },
  {
    id: "visualizer",
    label: "Motion Visualizer",
    path: "/create/visualizer",
    area: PRODUCT_AREAS.CREATE,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "Explore a live Rings visualization and its hidden effect variants.",
    objective: "Move through one responsive visual study while preset controls are developed.",
    iconSrc: "/assets/launcher-icons/rings.png",
    phase: APP_PHASES.FULLSCREEN_CAMERA,
    entryKind: "fullscreen-mode",
    fullscreenMode: "rings",
    trackingProfile: TRACKING_PROFILES.MULTI_HAND,
    controlHint: "Move to shape the Rings study",
    typicalMinutes: 5,
    difficulty: "Open play",
    players: 4,
    supportsPointerFallback: true,
    variants: ["square", "hex", "voronoi", "rings", "pulse", "tip-ripples", "static"],
  },
  {
    id: "gesture-art",
    label: "Light Painting",
    path: "/create/light-painting",
    area: PRODUCT_AREAS.CREATE,
    maturity: MODE_MATURITY.FLAGSHIP,
    summary: "Paint with motion, freeze compositions, and replay gesture loops.",
    objective: "Create and save a motion-powered artwork.",
    phase: APP_PHASES.GESTURE_ART_LAB,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.TWO_HANDS,
    controlHint: "Move to paint · Pinch for tools",
    typicalMinutes: 8,
    difficulty: "Open play",
    players: 1,
    featured: true,
    supportsPointerFallback: true,
  },
  {
    id: "jam-studio",
    label: "Jam Studio",
    path: "/create/jam-studio",
    area: PRODUCT_AREAS.CREATE,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Play accessible chords over selectable drum grooves.",
    objective: "Perform chord changes with pointer, keyboard, touch, or hand tracking.",
    entryKind: "page",
    href: "/circle-of-fifths.html",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Point, tap, or use the keyboard to play",
    typicalMinutes: 8,
    difficulty: "Open play",
    players: 1,
    featured: true,
    supportsPointerFallback: true,
  },
  {
    id: "world-painter",
    label: "World Painter",
    path: "/create/world-painter",
    area: PRODUCT_AREAS.CREATE,
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Shape, save, revise, and share rule-grown fantasy landscapes.",
    objective: "Paint terrain rules, grow a complete world, then save or share its history.",
    iconSrc: "/assets/launcher-icons/fingerprint-worlds.png",
    phase: APP_PHASES.FULLSCREEN_CAMERA,
    entryKind: "fullscreen-mode",
    fullscreenMode: "fingerprint-worlds",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Point to paint · Pinch to place",
    typicalMinutes: 8,
    difficulty: "Open play",
    players: 1,
    supportsPointerFallback: true,
  },
  {
    id: "track-runner",
    label: "Track Runner",
    path: "/labs/track-runner",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "An early lane-steering and motion-range prototype.",
    phase: APP_PHASES.RUNNER,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Move between lanes",
    typicalMinutes: 3,
    players: 1,
    supportsPointerFallback: false,
  },
  {
    id: "star-flight",
    label: "Star Flight",
    path: "/labs/star-flight",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "A free-flight steering and depth-control prototype.",
    phase: APP_PHASES.FLIGHT,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Move to steer",
    typicalMinutes: 5,
    players: 1,
    supportsPointerFallback: false,
  },
  {
    id: "conveyor-toss",
    label: "Conveyor Toss",
    path: "/labs/conveyor-toss",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "A depth-aware grab and throwing physics experiment.",
    phase: APP_PHASES.CONVEYOR,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Pinch to grab · Move to throw",
    typicalMinutes: 5,
    players: 1,
    supportsPointerFallback: false,
  },
  {
    id: "pinch-sandbox",
    label: "Pinch Sandbox",
    path: "/labs/pinch-sandbox",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "A direct-manipulation playground for testing grab behavior.",
    phase: APP_PHASES.SANDBOX,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Pinch and drag",
    typicalMinutes: 5,
    players: 1,
    supportsPointerFallback: false,
  },
  {
    id: "probability-table",
    label: "Probability Table",
    path: "/labs/probability-table",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "Predict finite wheel experiments and compare observed versus expected outcomes.",
    phase: APP_PHASES.ROULETTE,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.NONE,
    controlHint: "Choose an event · Predict · Run trials",
    typicalMinutes: 5,
    players: 1,
    supportsPointerFallback: true,
  },
  {
    id: "pose-quest",
    label: "Pose Diagnostics",
    path: "/labs/pose-quest",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "An experimental whole-body keypoint and readiness diagnostic.",
    phase: APP_PHASES.BODY_POSE,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.POSE,
    controlHint: "Move to inspect pose landmarks",
    typicalMinutes: 5,
    players: 1,
  },
  {
    id: "forest-discovery",
    label: "Parallax Forest",
    path: "/labs/forest-discovery",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "An atmospheric head-tracked parallax showcase without game objectives.",
    phase: APP_PHASES.OFF_AXIS_LAB,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.POSE,
    controlHint: "Lean to inspect the depth effect",
    typicalMinutes: 5,
    players: 1,
  },
  {
    id: "spatial-desk",
    label: "Spatial Desk",
    path: "/labs/spatial-desk",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "A gesture-driven window-management concept prototype.",
    phase: APP_PHASES.GESTURE_CONTROL_OS,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.TWO_HANDS,
    controlHint: "Point, pinch, and move",
    typicalMinutes: 5,
    players: 1,
  },
  {
    id: "spatial-investigation",
    label: "Spatial Investigation",
    path: "/labs/spatial-investigation",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "A multi-hand spatial-interface and gesture-training experiment.",
    phase: APP_PHASES.MINORITY_REPORT_LAB,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.MULTI_HAND,
    controlHint: "Point and pinch",
    typicalMinutes: 5,
    players: 1,
  },
  {
    id: "gesture-analytics",
    label: "Gesture Analytics",
    path: "/labs/gesture-analytics",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.INTERNAL,
    summary: "Capture, compare, and export tracking diagnostics.",
    phase: APP_PHASES.GESTURE_ANALYTICS_LAB,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.TWO_HANDS,
    controlHint: "Developer instrumentation",
    typicalMinutes: 10,
    players: 1,
  },
];

function freezeMode(mode) {
  return Object.freeze({
    ...mode,
    variants: mode.variants ? Object.freeze([...mode.variants]) : undefined,
  });
}

export const MODE_REGISTRY = Object.freeze(catalog.map(freezeMode));

const modeById = new Map(MODE_REGISTRY.map((mode) => [mode.id, mode]));
const modeByPath = new Map(MODE_REGISTRY.map((mode) => [mode.path, mode]));
const modesByPhase = new Map();
for (const mode of MODE_REGISTRY) {
  const phaseModes = modesByPhase.get(mode.phase) ?? [];
  phaseModes.push(mode);
  modesByPhase.set(mode.phase, phaseModes);
}
const modeByFullscreenId = new Map(
  MODE_REGISTRY.filter((mode) => mode.fullscreenMode).map((mode) => [mode.fullscreenMode, mode]),
);

export function getModeById(id) {
  return modeById.get(id) ?? null;
}

export function getModeByPath(path) {
  return modeByPath.get(path) ?? null;
}

export function getModesByPhase(phase) {
  return modesByPhase.get(phase) ?? [];
}

export function getModeByPhase(phase) {
  return getModesByPhase(phase)[0] ?? null;
}

export function getModeByFullscreenId(fullscreenMode) {
  const directMode = modeByFullscreenId.get(fullscreenMode);
  if (directMode) {
    return directMode;
  }

  return (
    MODE_REGISTRY.find((mode) => mode.variants?.includes(fullscreenMode)) ??
    null
  );
}

export function listModes({ area, maturity, includeHidden = false } = {}) {
  return MODE_REGISTRY.filter(
    (mode) =>
      (includeHidden || !mode.hiddenFromLibrary) &&
      (!area || mode.area === area) &&
      (!maturity || mode.maturity === maturity),
  );
}

export function getFeaturedModes() {
  return MODE_REGISTRY.filter((mode) => mode.featured);
}

export function validateModeRegistry(modes = MODE_REGISTRY) {
  const errors = [];
  const ids = new Set();
  const paths = new Set();
  const fullscreenIds = new Set();

  for (const mode of modes) {
    if (!mode.id || !mode.label || !mode.path || !mode.area || !mode.maturity) {
      errors.push(`Mode ${mode.id || "<unknown>"} is missing required metadata.`);
    }
    if (ids.has(mode.id)) {
      errors.push(`Duplicate mode id: ${mode.id}`);
    }
    if (paths.has(mode.path)) {
      errors.push(`Duplicate mode path: ${mode.path}`);
    }
    if (mode.fullscreenMode && fullscreenIds.has(mode.fullscreenMode)) {
      errors.push(`Duplicate fullscreen mode: ${mode.fullscreenMode}`);
    }
    ids.add(mode.id);
    paths.add(mode.path);
    if (mode.fullscreenMode) {
      fullscreenIds.add(mode.fullscreenMode);
    }
  }

  return errors;
}
