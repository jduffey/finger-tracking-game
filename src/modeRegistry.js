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

export const PLAY_START_KINDS = Object.freeze({
  AUTOMATIC: "automatic",
  EXPLICIT: "explicit",
});

export const PLAY_FALLBACK_KINDS = Object.freeze({
  POINTER: "pointer",
});

export const PLAY_PERSISTENCE_KINDS = Object.freeze({
  PROGRESSION: "progression",
  RESUMABLE_RUN: "resumable-run",
});

export const PLAY_RELEASE_BAR = Object.freeze({
  maturities: Object.freeze([
    MODE_MATURITY.FLAGSHIP,
    MODE_MATURITY.SUPPORTED,
  ]),
  requiredBooleanCapabilities: Object.freeze([
    "pause",
    "results",
    "retry",
    "home",
  ]),
  startKinds: Object.freeze(Object.values(PLAY_START_KINDS)),
  fallbackKinds: Object.freeze(Object.values(PLAY_FALLBACK_KINDS)),
  persistenceKinds: Object.freeze(Object.values(PLAY_PERSISTENCE_KINDS)),
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

const sharedAutomaticPlayReleaseCapabilities = {
  start: PLAY_START_KINDS.AUTOMATIC,
  pause: true,
  results: true,
  retry: true,
  home: true,
  fallback: PLAY_FALLBACK_KINDS.POINTER,
  persistence: PLAY_PERSISTENCE_KINDS.PROGRESSION,
};

const sharedExplicitPlayReleaseCapabilities = {
  ...sharedAutomaticPlayReleaseCapabilities,
  start: PLAY_START_KINDS.EXPLICIT,
};

const sharedFullscreenGame = {
  phase: APP_PHASES.FULLSCREEN_CAMERA,
  entryKind: "fullscreen-mode",
  trackingProfile: TRACKING_PROFILES.ONE_HAND,
  seatedFriendly: true,
  supportsPointerFallback: true,
  supportsPause: true,
  supportsResults: true,
  releaseCapabilities: sharedAutomaticPlayReleaseCapabilities,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
    supportsPointerFallback: true,
    supportsPause: true,
    supportsResults: true,
    dailyChallenge: true,
    releaseCapabilities: {
      ...sharedExplicitPlayReleaseCapabilities,
      persistence: PLAY_PERSISTENCE_KINDS.RESUMABLE_RUN,
    },
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
    seatedFriendly: true,
    supportsPointerFallback: true,
    supportsPause: true,
    supportsResults: true,
    dailyChallenge: true,
    releaseCapabilities: sharedExplicitPlayReleaseCapabilities,
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
    seatedFriendly: true,
    featured: true,
    supportsPointerFallback: true,
    supportsPause: true,
    supportsResults: true,
    releaseCapabilities: sharedExplicitPlayReleaseCapabilities,
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
    maturity: MODE_MATURITY.SUPPORTED,
    summary: "Remix seven live motion effects with palettes, trails, and saved looks.",
    objective: "Shape a full-screen visual composition and export it as private artwork.",
    iconSrc: "/assets/launcher-icons/rings.png",
    phase: APP_PHASES.FULLSCREEN_CAMERA,
    entryKind: "fullscreen-mode",
    fullscreenMode: "rings",
    trackingProfile: TRACKING_PROFILES.MULTI_HAND,
    controlHint: "Move, point, or use arrow keys · Remix with the controls",
    typicalMinutes: 5,
    difficulty: "Open play",
    players: 4,
    seatedFriendly: true,
    featured: true,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
    supportsPointerFallback: false,
  },
  {
    id: "star-flight",
    label: "Star Flight",
    path: "/labs/star-flight",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.PREVIEW,
    summary: "Hand-steer through scored gate courses or roam in Free Flight.",
    objective: "Thread each gate, build a precision streak, and finish the course on time.",
    phase: APP_PHASES.FLIGHT,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.ONE_HAND,
    controlHint: "Move to steer · Pinch to boost",
    typicalMinutes: 5,
    players: 1,
    seatedFriendly: true,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
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
    seatedFriendly: true,
    supportsPointerFallback: true,
  },
  {
    id: "pose-quest",
    label: "Pose Quest",
    path: "/labs/pose-quest",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "Match and hold three playful body silhouettes, then inspect diagnostics.",
    phase: APP_PHASES.BODY_POSE,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.POSE,
    controlHint: "Match each framing clue · Hold steady",
    typicalMinutes: 5,
    players: 1,
    seatedFriendly: false,
    supportsPointerFallback: false,
  },
  {
    id: "forest-discovery",
    label: "Parallax Forest: Guardian Trail",
    path: "/labs/forest-discovery",
    area: PRODUCT_AREAS.LABS,
    maturity: MODE_MATURITY.EXPERIMENTAL,
    summary: "Follow three viewpoint clues to reveal hidden forest guardians.",
    phase: APP_PHASES.OFF_AXIS_LAB,
    entryKind: "phase",
    trackingProfile: TRACKING_PROFILES.POSE,
    controlHint: "Lean, point, or use arrow keys",
    typicalMinutes: 5,
    players: 1,
    seatedFriendly: true,
    supportsPointerFallback: true,
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
    seatedFriendly: true,
    supportsPointerFallback: false,
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
    seatedFriendly: true,
    supportsPointerFallback: false,
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
    seatedFriendly: true,
  },
];

function freezeMode(mode) {
  return Object.freeze({
    ...mode,
    variants: mode.variants ? Object.freeze([...mode.variants]) : undefined,
    releaseCapabilities: mode.releaseCapabilities
      ? Object.freeze({ ...mode.releaseCapabilities })
      : undefined,
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

export function isPlayReleaseCandidate(mode) {
  return Boolean(
    mode &&
      mode.area === PRODUCT_AREAS.PLAY &&
      PLAY_RELEASE_BAR.maturities.includes(mode.maturity),
  );
}

export function validateModeRegistry(modes = MODE_REGISTRY) {
  if (!Array.isArray(modes)) {
    return ["Mode registry must be an array."];
  }

  const errors = [];
  const idOwners = new Map();
  const routeOwners = new Map();
  const fullscreenOwners = new Map();
  const validAreas = new Set(Object.values(PRODUCT_AREAS));
  const validMaturities = new Set(Object.values(MODE_MATURITY));
  const validTrackingProfiles = new Set(Object.values(TRACKING_PROFILES));
  const validPhases = new Set(Object.values(APP_PHASES));
  const validEntryKinds = new Set([
    "fullscreen-mode",
    "home",
    "page",
    "phase",
  ]);
  const libraryAreas = new Set([
    PRODUCT_AREAS.PLAY,
    PRODUCT_AREAS.CREATE,
    PRODUCT_AREAS.LABS,
  ]);
  const booleanMetadataFields = [
    "dailyChallenge",
    "featured",
    "hiddenFromLibrary",
    "seatedFriendly",
    "supportsPause",
    "supportsPointerFallback",
    "supportsResults",
  ];

  const registerRoute = (route, kind, modeId, modeIndex) => {
    const previous = routeOwners.get(route);
    if (!previous) {
      routeOwners.set(route, { kind, modeId, modeIndex });
      return;
    }
    if (kind === "path" && previous.kind === "path") {
      errors.push(`Duplicate mode path: ${route}`);
      return;
    }
    if (kind === "href" && previous.kind === "href") {
      errors.push(`Duplicate mode href: ${route}`);
      return;
    }
    errors.push(
      `Route collision: ${route} is used as ${previous.kind} by ${previous.modeId} and as ${kind} by ${modeId}.`,
    );
  };

  modes.forEach((mode, modeIndex) => {
    if (!mode || typeof mode !== "object" || Array.isArray(mode)) {
      errors.push(`Mode at index ${modeIndex} must be an object.`);
      return;
    }

    const modeId = isNonEmptyString(mode.id) ? mode.id : "<unknown>";
    const requiredFields = [
      "id",
      "label",
      "path",
      "area",
      "maturity",
      "summary",
      "entryKind",
      "trackingProfile",
    ];
    const missingFields = requiredFields.filter(
      (field) => !isNonEmptyString(mode[field]),
    );
    if (missingFields.length > 0) {
      errors.push(
        `Mode ${modeId} is missing required metadata: ${missingFields.join(", ")}.`,
      );
    }

    if (isNonEmptyString(mode.id)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mode.id)) {
        errors.push(`Mode ${mode.id} has an invalid id.`);
      }
      if (idOwners.has(mode.id)) {
        errors.push(`Duplicate mode id: ${mode.id}`);
      } else {
        idOwners.set(mode.id, modeIndex);
      }
    }

    if (isNonEmptyString(mode.path)) {
      if (!isCanonicalProductRoute(mode.path)) {
        errors.push(`Mode ${modeId} has an invalid path: ${mode.path}`);
      }
      registerRoute(mode.path, "path", modeId, modeIndex);
    }
    if (mode.href !== undefined) {
      if (!isNonEmptyString(mode.href) || !isCanonicalProductRoute(mode.href, {
        allowFileExtension: true,
      })) {
        errors.push(`Mode ${modeId} has an invalid href.`);
      } else {
        registerRoute(mode.href, "href", modeId, modeIndex);
      }
    }

    if (isNonEmptyString(mode.area) && !validAreas.has(mode.area)) {
      errors.push(`Mode ${modeId} has an invalid area: ${mode.area}`);
    }
    if (
      isNonEmptyString(mode.maturity) &&
      !validMaturities.has(mode.maturity)
    ) {
      errors.push(`Mode ${modeId} has an invalid maturity: ${mode.maturity}`);
    }
    if (
      isNonEmptyString(mode.trackingProfile) &&
      !validTrackingProfiles.has(mode.trackingProfile)
    ) {
      errors.push(
        `Mode ${modeId} has an invalid tracking profile: ${mode.trackingProfile}`,
      );
    }
    if (
      isNonEmptyString(mode.entryKind) &&
      !validEntryKinds.has(mode.entryKind)
    ) {
      errors.push(`Mode ${modeId} has an invalid entry kind: ${mode.entryKind}`);
    }

    if (mode.entryKind === "page") {
      if (!isNonEmptyString(mode.href)) {
        errors.push(`Page mode ${modeId} must declare an href.`);
      }
    } else if (
      isNonEmptyString(mode.entryKind) &&
      (!isNonEmptyString(mode.phase) || !validPhases.has(mode.phase))
    ) {
      errors.push(`Mode ${modeId} must declare a valid app phase.`);
    }
    if (
      mode.entryKind === "fullscreen-mode" &&
      !isNonEmptyString(mode.fullscreenMode)
    ) {
      errors.push(`Fullscreen mode ${modeId} must declare fullscreenMode.`);
    }

    if (mode.variants !== undefined && !Array.isArray(mode.variants)) {
      errors.push(`Mode ${modeId} variants must be an array.`);
    }
    const seenVariants = new Set();
    for (const variant of Array.isArray(mode.variants) ? mode.variants : []) {
      if (!isNonEmptyString(variant)) {
        errors.push(`Mode ${modeId} has an invalid fullscreen variant.`);
        continue;
      }
      if (seenVariants.has(variant)) {
        errors.push(`Mode ${modeId} repeats fullscreen variant: ${variant}`);
        continue;
      }
      seenVariants.add(variant);
    }

    const fullscreenIds = [
      isNonEmptyString(mode.fullscreenMode) ? mode.fullscreenMode : null,
      ...(Array.isArray(mode.variants) ? mode.variants : []),
    ].filter(isNonEmptyString);
    for (const fullscreenId of fullscreenIds) {
      const previousOwner = fullscreenOwners.get(fullscreenId);
      if (previousOwner !== undefined && previousOwner !== modeIndex) {
        errors.push(`Duplicate fullscreen mode: ${fullscreenId}`);
      } else {
        fullscreenOwners.set(fullscreenId, modeIndex);
      }
    }

    for (const field of booleanMetadataFields) {
      if (mode[field] !== undefined && typeof mode[field] !== "boolean") {
        errors.push(`Mode ${modeId} metadata ${field} must be boolean.`);
      }
    }

    if (libraryAreas.has(mode.area)) {
      if (!isNonEmptyString(mode.controlHint)) {
        errors.push(`Library mode ${modeId} must declare a control hint.`);
      }
      if (!Number.isInteger(mode.players) || mode.players < 1) {
        errors.push(`Library mode ${modeId} must declare a positive player count.`);
      }
      if (!Number.isFinite(mode.typicalMinutes) || mode.typicalMinutes <= 0) {
        errors.push(`Library mode ${modeId} must declare a positive duration.`);
      }
      if (typeof mode.seatedFriendly !== "boolean") {
        errors.push(`Library mode ${modeId} must declare seated support.`);
      }
      if (
        mode.maturity !== MODE_MATURITY.INTERNAL &&
        typeof mode.supportsPointerFallback !== "boolean"
      ) {
        errors.push(`Public mode ${modeId} must declare pointer fallback support.`);
      }
      if (mode.difficulty !== undefined && !isNonEmptyString(mode.difficulty)) {
        errors.push(`Library mode ${modeId} has invalid difficulty metadata.`);
      }
    }

    if (mode.dailyChallenge === true && mode.area !== PRODUCT_AREAS.PLAY) {
      errors.push(`Daily challenge mode ${modeId} must belong to Play.`);
    }

    if (isPlayReleaseCandidate(mode)) {
      validatePlayReleaseCapabilities(mode, errors);
    }
  });

  return errors;
}

function validatePlayReleaseCapabilities(mode, errors) {
  const modeId = mode.id || "<unknown>";
  if (!isNonEmptyString(mode.objective)) {
    errors.push(`Play release mode ${modeId} must declare an objective.`);
  }

  const capabilities = mode.releaseCapabilities;
  if (
    !capabilities ||
    typeof capabilities !== "object" ||
    Array.isArray(capabilities)
  ) {
    errors.push(`Play release mode ${modeId} must declare releaseCapabilities.`);
    return;
  }

  if (!PLAY_RELEASE_BAR.startKinds.includes(capabilities.start)) {
    errors.push(`Play release mode ${modeId} must declare a valid start capability.`);
  }
  for (const capability of PLAY_RELEASE_BAR.requiredBooleanCapabilities) {
    if (capabilities[capability] !== true) {
      errors.push(
        `Play release mode ${modeId} must support ${capability}.`,
      );
    }
  }
  if (!PLAY_RELEASE_BAR.fallbackKinds.includes(capabilities.fallback)) {
    errors.push(`Play release mode ${modeId} must declare a valid fallback.`);
  }
  if (!PLAY_RELEASE_BAR.persistenceKinds.includes(capabilities.persistence)) {
    errors.push(`Play release mode ${modeId} must declare valid persistence.`);
  }
  if (mode.supportsPointerFallback !== true) {
    errors.push(`Play release mode ${modeId} must expose pointer fallback.`);
  }
  if (mode.supportsPause !== true) {
    errors.push(`Play release mode ${modeId} must expose pause support.`);
  }
  if (mode.supportsResults !== true) {
    errors.push(`Play release mode ${modeId} must expose result support.`);
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalProductRoute(route, { allowFileExtension = false } = {}) {
  if (
    !isNonEmptyString(route) ||
    !route.startsWith("/") ||
    route.includes("//") ||
    /[?#\s]/.test(route)
  ) {
    return false;
  }
  if (route !== "/" && route.endsWith("/")) {
    return false;
  }
  if (!allowFileExtension && route.split("/").at(-1)?.includes(".")) {
    return false;
  }
  return true;
}
