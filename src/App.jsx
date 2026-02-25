import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyArcCalibration,
  applyAffineTransform,
  clampPoint,
  clearCalibration,
  createCalibrationTargets,
  evaluateArcCaptureConfidence,
  loadCalibration,
  saveCalibration,
  solveArcCalibrationFromSamples,
  solveAffineFromPairs,
} from "./calibration";
import {
  buildGridHoles,
  canRunnerStartJump,
  computeRunnerTrackGridLayout,
  GAME_DURATION_MS,
  getRunnerTrackIndexFromNormalized,
  getRunnerTrackOffsetFromIndex,
  isPointInCircle,
  MOLE_VISIBLE_MS,
  pickRandomHole,
  randomSpawnDelay,
  shouldCollectRunnerCoin,
} from "./gameLogic";
import {
  detectPrimaryHand,
  getCurrentBackend,
  getCurrentRuntime,
  getLastDetectionMeta,
  initHandTracking,
} from "./handTracking";
import { createScopedLogger } from "./logger";

const PHASES = {
  CALIBRATION: "CALIBRATION",
  SANDBOX: "SANDBOX",
  FLIGHT: "FLIGHT",
  RUNNER: "RUNNER",
  GAME: "GAME",
};

const PINCH_START_THRESHOLD = 0.045;
const PINCH_END_THRESHOLD = 0.06;
const PINCH_DEBOUNCE_MS = 250;
const CURSOR_ALPHA = 0.35;
const CALIBRATION_SAMPLE_FRAMES = 10;
const ARC_CALIBRATION_READY_CONFIDENCE = 0.86;
const ARC_CALIBRATION_MAX_CAPTURE_FRAMES = 2400;
const INVALID_LANDMARK_RECOVERY_THRESHOLD = 45;
const NO_HAND_RECOVERY_THRESHOLD = 300;
const HAND_DETECTION_GRACE_MS = 1600;
const INITIAL_TRACKING_RUNTIME = "mediapipe";
const FINGERTIP_OVERLAY_STYLES = {
  thumb: { fill: "rgba(255, 255, 255, 0.98)", radius: 6.2 },
  index: { fill: "rgba(255, 122, 89, 0.95)", radius: 4.8 },
  middle: { fill: "rgba(111, 245, 164, 0.95)", radius: 4.8 },
  ring: { fill: "rgba(128, 183, 255, 0.95)", radius: 4.8 },
  pinky: { fill: "rgba(226, 153, 255, 0.95)", radius: 4.8 },
};
const EXTENT_FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"];
const EXTENT_LOG_SAMPLE_INTERVAL = 180;
const MIN_VISIBLE_SPAN = 1e-6;
const INPUT_TEST_GRID_ROWS = 6;
const INPUT_TEST_GRID_COLS = 10;
const INPUT_TEST_CELL_COUNT = INPUT_TEST_GRID_ROWS * INPUT_TEST_GRID_COLS;
const INPUT_TEST_CELL_GAP = 8;
const SANDBOX_BLOCK_COUNT = 4;
const SANDBOX_BLOCK_GAP = 14;
const SANDBOX_GRAVITY = 2050;
const SANDBOX_REST_VELOCITY = 28;
const SANDBOX_MAX_STEP_SECONDS = 0.05;
const SANDBOX_MAX_FLING_SPEED = 2200;
const SANDBOX_COLLISION_ITERATIONS = 4;
const SANDBOX_COLLISION_FRICTION = 0.2;
const SANDBOX_FLOOR_FRICTION = 0.86;
const SANDBOX_TOP_SPAWN_BAND_RATIO = 0.24;
const SANDBOX_SUPPORT_EPSILON = 8;
const SANDBOX_OVERHANG_ACCEL = 2100;
const SANDBOX_MATERIAL_SEQUENCE = ["steel", "steel", "rubber", "rubber"];
const SANDBOX_MATERIAL_PROPS = {
  steel: { restitution: 0.16, mass: 1.75, airDrag: 0.996 },
  rubber: { restitution: 0.62, mass: 1.05, airDrag: 0.992 },
};
const SANDBOX_MATERIAL_COLORS = {
  steel: ["#91a2b8", "#7d8fa8"],
  rubber: ["#ef4444", "#f97316"],
};
const FLIGHT_FINGER_ORDER = ["thumb", "index", "middle", "ring", "pinky"];
const FLIGHT_BASELINE_SAMPLE_TARGET = 34;
const FLIGHT_FORWARD_SPEED = 310;
const FLIGHT_STEER_ACCEL = 560;
const FLIGHT_DRAG_PER_60FPS = 0.9;
const FLIGHT_MAX_SHIP_OFFSET_X = 170;
const FLIGHT_MAX_SHIP_OFFSET_Y = 120;
const FLIGHT_STAR_COUNT = 170;
const FLIGHT_RING_COUNT = 7;
const FLIGHT_NEAR_Z = 26;
const FLIGHT_FAR_Z = 1480;
const FLIGHT_WORLD_HALF_WIDTH = 520;
const FLIGHT_WORLD_HALF_HEIGHT = 320;
const FLIGHT_HUD_UPDATE_MS = 90;
const FLIGHT_ROLL_WEIGHTS = [-2, -1, 0, 1, 2];
const RUNNER_TRACK_GRID_SIZE = 4;
const RUNNER_DEFAULT_TRACK_INDEX = Math.floor((RUNNER_TRACK_GRID_SIZE - 1) / 2);
const RUNNER_SPEED = 360;
const RUNNER_MAX_Z = 1480;
const RUNNER_NEAR_Z = 24;
const RUNNER_GRAVITY = 1740;
const RUNNER_JUMP_VELOCITY = 790;
const RUNNER_MAX_JUMP_HEIGHT = 190;
const RUNNER_COIN_COUNT = 20;
const RUNNER_COIN_RESPAWN_MIN_Z = 860;
const RUNNER_COIN_RESPAWN_MAX_Z = 1880;
const RUNNER_HUD_UPDATE_MS = 90;
const RUNNER_LANE_SMOOTH_ALPHA = 0.19;

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerpValue(start, end, alpha) {
  return start + (end - start) * alpha;
}

function wrapAngleDelta(value) {
  let next = value;
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  while (next < -Math.PI) {
    next += Math.PI * 2;
  }
  return next;
}

function roundMetric(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(digits));
}

function createEmptyExtent() {
  return {
    count: 0,
    minU: 1,
    maxU: 0,
    minV: 1,
    maxV: 0,
  };
}

function createFingerExtentStats() {
  return {
    raw: createEmptyExtent(),
    clamped: createEmptyExtent(),
    visible: createEmptyExtent(),
    totalSamples: 0,
    clampedSamples: 0,
    outsideVisibleCount: 0,
  };
}

function createTrackingExtentState() {
  const fingers = EXTENT_FINGER_NAMES.reduce((accumulator, fingerName) => {
    accumulator[fingerName] = createFingerExtentStats();
    return accumulator;
  }, {});
  return {
    sampleFrames: 0,
    lastFrameId: 0,
    lastTimestamp: 0,
    rawOverall: createEmptyExtent(),
    clampedOverall: createEmptyExtent(),
    visibleOverall: createEmptyExtent(),
    totalTipSamples: 0,
    clampedTipSamples: 0,
    outsideVisibleTipSamples: 0,
    lastVisibleBounds: null,
    fingers,
  };
}

function updateExtentAccumulator(extent, u, v) {
  if (!extent || !Number.isFinite(u) || !Number.isFinite(v)) {
    return false;
  }
  extent.count += 1;
  extent.minU = Math.min(extent.minU, u);
  extent.maxU = Math.max(extent.maxU, u);
  extent.minV = Math.min(extent.minV, v);
  extent.maxV = Math.max(extent.maxV, v);
  return true;
}

function safeRatio(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return part / total;
}

function normalizeTipToVisibleBounds(uRaw, vRaw, visibleBounds) {
  if (!visibleBounds || !Number.isFinite(uRaw) || !Number.isFinite(vRaw)) {
    return null;
  }
  const uSpan = Math.max(MIN_VISIBLE_SPAN, visibleBounds.uMax - visibleBounds.uMin);
  const vSpan = Math.max(MIN_VISIBLE_SPAN, visibleBounds.vMax - visibleBounds.vMin);
  const uVisibleRaw = (uRaw - visibleBounds.uMin) / uSpan;
  const vVisibleRaw = (vRaw - visibleBounds.vMin) / vSpan;
  const uVisible = clampValue(uVisibleRaw, 0, 1);
  const vVisible = clampValue(vVisibleRaw, 0, 1);

  return {
    u: uVisible,
    v: vVisible,
    uRaw: uVisibleRaw,
    vRaw: vVisibleRaw,
    inBounds:
      uRaw >= visibleBounds.uMin &&
      uRaw <= visibleBounds.uMax &&
      vRaw >= visibleBounds.vMin &&
      vRaw <= visibleBounds.vMax,
    wasClamped: uVisible !== uVisibleRaw || vVisible !== vVisibleRaw,
  };
}

function summarizeExtentForLog(extent, canvasWidth, canvasHeight) {
  if (!extent || extent.count === 0) {
    return null;
  }

  const normalized = {
    uMin: roundMetric(extent.minU),
    uMax: roundMetric(extent.maxU),
    vMin: roundMetric(extent.minV),
    vMax: roundMetric(extent.maxV),
    uSpan: roundMetric(extent.maxU - extent.minU),
    vSpan: roundMetric(extent.maxV - extent.minV),
  };

  const hasCanvas = Number.isFinite(canvasWidth) && canvasWidth > 0 && Number.isFinite(canvasHeight) && canvasHeight > 0;
  const pixels = hasCanvas
    ? {
        xMin: roundMetric(extent.minU * canvasWidth, 2),
        xMax: roundMetric(extent.maxU * canvasWidth, 2),
        yMin: roundMetric(extent.minV * canvasHeight, 2),
        yMax: roundMetric(extent.maxV * canvasHeight, 2),
        xSpan: roundMetric((extent.maxU - extent.minU) * canvasWidth, 2),
        ySpan: roundMetric((extent.maxV - extent.minV) * canvasHeight, 2),
      }
    : null;

  return {
    samples: extent.count,
    mirroredNormalized: normalized,
    canvasPixels: pixels,
  };
}

function summarizeFingerExtentStats(fingerStats, canvasWidth, canvasHeight) {
  if (!fingerStats || fingerStats.totalSamples === 0) {
    return null;
  }

  return {
    samples: fingerStats.totalSamples,
    clampedSamples: fingerStats.clampedSamples,
    clampedRatio: roundMetric(safeRatio(fingerStats.clampedSamples, fingerStats.totalSamples), 6),
    outsideVisibleSamples: fingerStats.outsideVisibleCount,
    outsideVisibleRatio: roundMetric(
      safeRatio(fingerStats.outsideVisibleCount, fingerStats.totalSamples),
      6,
    ),
    raw: summarizeExtentForLog(fingerStats.raw, canvasWidth, canvasHeight),
    clamped: summarizeExtentForLog(fingerStats.clamped, canvasWidth, canvasHeight),
    visibleNormalized: summarizeExtentForLog(fingerStats.visible, canvasWidth, canvasHeight),
  };
}

function isPointInsideClientRect(point, rect) {
  if (!point || !rect) {
    return false;
  }
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function isArcCalibrationModel(model) {
  return Boolean(model && typeof model === "object" && model.kind === "arc");
}

function computeFittedGridSize(containerWidth, containerHeight, columns, rows, gap) {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return { width: 0, height: 0, cellSize: 0 };
  }

  const horizontalGapTotal = Math.max(0, columns - 1) * gap;
  const verticalGapTotal = Math.max(0, rows - 1) * gap;
  const maxCellFromWidth = (containerWidth - horizontalGapTotal) / columns;
  const maxCellFromHeight = (containerHeight - verticalGapTotal) / rows;
  const fittedCellSize = Math.floor(Math.max(0, Math.min(maxCellFromWidth, maxCellFromHeight)));

  if (!Number.isFinite(fittedCellSize) || fittedCellSize <= 0) {
    return { width: 0, height: 0, cellSize: 0 };
  }

  return {
    width: fittedCellSize * columns + horizontalGapTotal,
    height: fittedCellSize * rows + verticalGapTotal,
    cellSize: fittedCellSize,
  };
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const next = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = next;
  }
  return copy;
}

function randomBetween(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}

function doBlocksOverlap(a, b, padding = 0) {
  return (
    a.x < b.x + b.size + padding &&
    a.x + a.size + padding > b.x &&
    a.y < b.y + b.size + padding &&
    a.y + a.size + padding > b.y
  );
}

function createEmptyFlightBaseline() {
  return {
    ready: false,
    sampleCount: 0,
    centroid: { u: 0.5, v: 0.5 },
    principalAngle: 0,
    openness: 0.2,
    tips: FLIGHT_FINGER_ORDER.map(() => ({ u: 0.5, v: 0.5 })),
  };
}

function computeFiveFingerPose(fingerTips) {
  if (!fingerTips || typeof fingerTips !== "object") {
    return null;
  }

  const points = [];
  for (const fingerName of FLIGHT_FINGER_ORDER) {
    const tip = fingerTips[fingerName];
    if (!tip || !Number.isFinite(tip.u) || !Number.isFinite(tip.v)) {
      return null;
    }
    points.push({ u: tip.u, v: tip.v });
  }

  const centroid = points.reduce(
    (accumulator, point) => {
      accumulator.u += point.u;
      accumulator.v += point.v;
      return accumulator;
    },
    { u: 0, v: 0 },
  );
  centroid.u /= points.length;
  centroid.v /= points.length;

  let covarianceXX = 0;
  let covarianceYY = 0;
  let covarianceXY = 0;
  let openness = 0;
  for (const point of points) {
    const du = point.u - centroid.u;
    const dv = point.v - centroid.v;
    covarianceXX += du * du;
    covarianceYY += dv * dv;
    covarianceXY += du * dv;
    openness += Math.hypot(du, dv);
  }

  covarianceXX /= points.length;
  covarianceYY /= points.length;
  covarianceXY /= points.length;
  openness /= points.length;
  const principalAngle = 0.5 * Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY);

  return {
    points,
    centroid,
    openness,
    principalAngle,
  };
}

function createFlightStars() {
  const stars = [];
  for (let index = 0; index < FLIGHT_STAR_COUNT; index += 1) {
    stars.push({
      x: randomBetween(-FLIGHT_WORLD_HALF_WIDTH, FLIGHT_WORLD_HALF_WIDTH),
      y: randomBetween(-FLIGHT_WORLD_HALF_HEIGHT, FLIGHT_WORLD_HALF_HEIGHT),
      z: randomBetween(FLIGHT_NEAR_Z * 2.4, FLIGHT_FAR_Z),
    });
  }
  return stars;
}

function createFlightRings() {
  const rings = [];
  const spacing = (FLIGHT_FAR_Z - 280) / Math.max(1, FLIGHT_RING_COUNT);
  for (let index = 0; index < FLIGHT_RING_COUNT; index += 1) {
    rings.push({
      x: randomBetween(-170, 170),
      y: randomBetween(-108, 108),
      z: 280 + index * spacing + randomBetween(-90, 90),
      radius: randomBetween(34, 66),
    });
  }
  return rings;
}

function pickRandomRunnerTrackIndex() {
  return Math.floor(Math.random() * RUNNER_TRACK_GRID_SIZE);
}

function createRunnerCoin(zMin = RUNNER_COIN_RESPAWN_MIN_Z, zMax = RUNNER_COIN_RESPAWN_MAX_Z) {
  const airborne = Math.random() < 0.4;
  const trackXIndex = pickRandomRunnerTrackIndex();
  const trackYIndex = pickRandomRunnerTrackIndex();
  return {
    id: Math.random().toString(36).slice(2),
    trackXIndex,
    trackYIndex,
    trackX: getRunnerTrackOffsetFromIndex(trackXIndex, RUNNER_TRACK_GRID_SIZE),
    trackY: getRunnerTrackOffsetFromIndex(trackYIndex, RUNNER_TRACK_GRID_SIZE),
    z: randomBetween(zMin, zMax),
    height: airborne ? randomBetween(74, 138) : randomBetween(0, 28),
    value: 1,
  };
}

function createRunnerCoins() {
  const coins = [];
  for (let index = 0; index < RUNNER_COIN_COUNT; index += 1) {
    const baseZ =
      RUNNER_COIN_RESPAWN_MIN_Z +
      (index / Math.max(1, RUNNER_COIN_COUNT - 1)) *
        (RUNNER_COIN_RESPAWN_MAX_Z - RUNNER_COIN_RESPAWN_MIN_Z);
    coins.push(createRunnerCoin(baseZ, baseZ + randomBetween(90, 240)));
  }
  return coins;
}

function createSandboxBlocks(stageWidth, stageHeight) {
  const safeWidth = Math.max(320, stageWidth);
  const safeHeight = Math.max(240, stageHeight);
  const horizontalPadding = Math.max(14, safeWidth * 0.04);
  const topPadding = Math.max(8, safeHeight * 0.03);
  const spawnBandHeight = Math.max(68, safeHeight * SANDBOX_TOP_SPAWN_BAND_RATIO);
  const maxSizeFromWidth =
    (safeWidth - horizontalPadding * 2 - SANDBOX_BLOCK_GAP * (SANDBOX_BLOCK_COUNT - 1)) /
    SANDBOX_BLOCK_COUNT;
  const desiredSize = Math.min(safeWidth * 0.2, safeHeight * 0.24);
  const blockSize = Math.floor(clampValue(Math.min(desiredSize, maxSizeFromWidth), 42, 132));
  const xMin = horizontalPadding;
  const xMax = safeWidth - horizontalPadding - blockSize;
  const yMin = topPadding;
  const yMax = topPadding + Math.max(0, spawnBandHeight - blockSize);
  const placementPadding = Math.max(4, SANDBOX_BLOCK_GAP * 0.35);

  const shuffledMaterials = shuffleArray(SANDBOX_MATERIAL_SEQUENCE);
  const colorDeckByMaterial = {
    steel: shuffleArray(SANDBOX_MATERIAL_COLORS.steel),
    rubber: shuffleArray(SANDBOX_MATERIAL_COLORS.rubber),
  };
  const colorIndexByMaterial = {
    steel: 0,
    rubber: 0,
  };

  const blocks = [];
  for (let blockIndex = 0; blockIndex < SANDBOX_BLOCK_COUNT; blockIndex += 1) {
    const material = shuffledMaterials[blockIndex] ?? "steel";
    const palette = colorDeckByMaterial[material] ?? SANDBOX_MATERIAL_COLORS.steel;
    const color = palette[colorIndexByMaterial[material] % palette.length];
    colorIndexByMaterial[material] += 1;

    let placed = null;
    for (let attempt = 0; attempt < 220; attempt += 1) {
      const candidate = {
        x: randomBetween(xMin, xMax),
        y: randomBetween(yMin, yMax),
        size: blockSize,
      };
      const collides = blocks.some((other) =>
        doBlocksOverlap(other, candidate, placementPadding),
      );
      if (!collides) {
        placed = candidate;
        break;
      }
    }

    if (!placed) {
      const slotStride = (safeWidth - horizontalPadding * 2 - blockSize) / Math.max(1, SANDBOX_BLOCK_COUNT - 1);
      const fallbackX = clampValue(
        horizontalPadding + blockIndex * slotStride,
        xMin,
        xMax,
      );
      const fallbackY = yMin + (blockIndex % 2) * Math.min(blockSize * 0.36, spawnBandHeight * 0.44);
      placed = { x: fallbackX, y: fallbackY, size: blockSize };
    }

    const materialProps = SANDBOX_MATERIAL_PROPS[material] ?? SANDBOX_MATERIAL_PROPS.steel;
    blocks.push({
      id: blockIndex + 1,
      x: placed.x,
      y: placed.y,
      size: blockSize,
      vx: 0,
      vy: 0,
      material,
      restitution: materialProps.restitution,
      mass: materialProps.mass,
      airDrag: materialProps.airDrag,
      color,
    });
  }

  return blocks;
}

export default function App() {
  const appLog = useMemo(() => createScopedLogger("app"), []);

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [phase, setPhase] = useState(PHASES.CALIBRATION);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraAspectRatio, setCameraAspectRatio] = useState(4 / 3);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState("");
  const [activeBackend, setActiveBackend] = useState("n/a");
  const [activeRuntime, setActiveRuntime] = useState(INITIAL_TRACKING_RUNTIME);

  const [handDetected, setHandDetected] = useState(false);
  const [pinchActive, setPinchActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [cursor, setCursor] = useState(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));
  const [rawCursor, setRawCursor] = useState(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));
  const [debugEnabled, setDebugEnabled] = useState(false);

  const [transform, setTransform] = useState(null);
  const [hasSavedCalibration, setHasSavedCalibration] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationTargets, setCalibrationTargets] = useState(() =>
    createCalibrationTargets(window.innerWidth, window.innerHeight),
  );
  const [calibrationTargetIndex, setCalibrationTargetIndex] = useState(0);
  const [calibrationPairsCount, setCalibrationPairsCount] = useState(0);
  const [calibrationSampleFrames, setCalibrationSampleFrames] = useState(0);
  const [calibrationMessage, setCalibrationMessage] = useState(
    "Press Start Calibration to begin.",
  );
  const [isArcCalibrating, setIsArcCalibrating] = useState(false);
  const [arcCalibrationProgress, setArcCalibrationProgress] = useState(0);
  const [arcCalibrationSamples, setArcCalibrationSamples] = useState(0);
  const [inputTestHoveredCell, setInputTestHoveredCell] = useState(-1);
  const [inputTestGridSize, setInputTestGridSize] = useState({
    width: 0,
    height: 0,
    cellSize: 0,
  });
  const [sandboxBlocks, setSandboxBlocks] = useState([]);
  const [sandboxGrabbedBlockId, setSandboxGrabbedBlockId] = useState(null);
  const [flightHud, setFlightHud] = useState({
    yaw: 0,
    pitch: 0,
    roll: 0,
    confidence: 0,
    baselineReady: false,
    baselineSamples: 0,
    distance: 0,
  });
  const [runnerHud, setRunnerHud] = useState({
    coins: 0,
    distance: 0,
    trackCol: RUNNER_DEFAULT_TRACK_INDEX + 1,
    trackRow: RUNNER_DEFAULT_TRACK_INDEX + 1,
    trackSpacingPx: 0,
    jumping: false,
    jumpHeight: 0,
  });

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(GAME_DURATION_MS / 1000));
  const [gameRunning, setGameRunning] = useState(false);
  const [activeMoleIndex, setActiveMoleIndex] = useState(null);
  const [holes, setHoles] = useState([]);

  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const cameraWrapRef = useRef(null);
  const boardRef = useRef(null);
  const inputTestStageRef = useRef(null);
  const sandboxStageRef = useRef(null);
  const flightStageRef = useRef(null);
  const flightCanvasRef = useRef(null);
  const runnerStageRef = useRef(null);
  const runnerCanvasRef = useRef(null);
  const inputTestCellRefs = useRef([]);

  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const inferenceBusyRef = useRef(false);
  const mountedRef = useRef(true);

  const phaseRef = useRef(phase);
  const viewportRef = useRef(viewport);
  const transformRef = useRef(transform);
  const cursorRef = useRef(cursor);
  const rawCursorRef = useRef(rawCursor);
  const debugRef = useRef(debugEnabled);

  const handDetectedRef = useRef(false);
  const lastValidHandTimestampRef = useRef(0);
  const handGraceFrameCounterRef = useRef(0);
  const pinchStateRef = useRef(false);
  const lastPinchClickRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const fpsRef = useRef(0);
  const frameCounterRef = useRef(0);
  const inferenceBusySkipCounterRef = useRef(0);
  const recoveryFrameSkipCounterRef = useRef(0);
  const invalidLandmarkStreakRef = useRef(0);
  const noHandStreakRef = useRef(0);
  const trackingExtentsRef = useRef(createTrackingExtentState());
  const detectorRecoveryAttemptsRef = useRef(0);
  const recoveringDetectorRef = useRef(false);

  const calibrationTargetsRef = useRef(calibrationTargets);
  const calibrationIndexRef = useRef(calibrationTargetIndex);
  const calibrationPairsRef = useRef([]);
  const calibrationSampleRef = useRef(null);
  const isCalibratingRef = useRef(isCalibrating);
  const isArcCalibratingRef = useRef(isArcCalibrating);
  const arcCalibrationStartRef = useRef(0);
  const arcCalibrationSamplesRef = useRef([]);
  const inputTestHoveredCellRef = useRef(inputTestHoveredCell);
  const sandboxBlocksRef = useRef(sandboxBlocks);
  const sandboxGrabbedBlockIdRef = useRef(sandboxGrabbedBlockId);
  const sandboxGrabOffsetRef = useRef({ x: 0, y: 0 });
  const sandboxGrabVelocityRef = useRef({ vx: 0, vy: 0 });
  const sandboxGrabLastPositionRef = useRef({ x: 0, y: 0, timestamp: 0 });
  const sandboxLastTickRef = useRef(0);
  const flightStateRef = useRef({
    initialized: false,
    lastTimestamp: 0,
    shipX: 0,
    shipY: 0,
    shipVx: 0,
    shipVy: 0,
    roll: 0,
    pitch: 0,
    yaw: 0,
    distance: 0,
    stars: [],
    rings: [],
  });
  const flightControlRef = useRef({
    yaw: 0,
    pitch: 0,
    roll: 0,
    confidence: 0,
    hasControl: false,
    lastUpdate: 0,
  });
  const flightBaselineRef = useRef(createEmptyFlightBaseline());
  const flightBaselineSamplesRef = useRef([]);
  const flightHudLastUpdateRef = useRef(0);
  const runnerStateRef = useRef({
    initialized: false,
    lastTimestamp: 0,
    trackXTargetIndex: RUNNER_DEFAULT_TRACK_INDEX,
    trackYTargetIndex: RUNNER_DEFAULT_TRACK_INDEX,
    trackXTarget: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
    trackYTarget: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
    trackXFloat: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
    trackYFloat: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
    trackSpacing: 0,
    runnerY: 0,
    runnerVy: 0,
    distance: 0,
    coinsCollected: 0,
    coins: [],
  });
  const runnerHudLastUpdateRef = useRef(0);
  const runnerGeometryLogKeyRef = useRef("");

  const holesRef = useRef(holes);
  const hitZonesRef = useRef([]);
  const lastHoleIndexRef = useRef(-1);

  const gameRunningRef = useRef(gameRunning);
  const gameStartTimeRef = useRef(0);
  const nextSpawnAtRef = useRef(Number.POSITIVE_INFINITY);
  const activeMoleRef = useRef(null);
  const timeLeftRef = useRef(timeLeft);

  const currentTarget = useMemo(
    () => calibrationTargets[calibrationTargetIndex] ?? null,
    [calibrationTargets, calibrationTargetIndex],
  );
  const isCalibrationLayoutPhase =
    phase === PHASES.CALIBRATION ||
    phase === PHASES.SANDBOX ||
    phase === PHASES.FLIGHT ||
    phase === PHASES.RUNNER;
  const cameraPanelTitle =
    phase === PHASES.FLIGHT
      ? "Camera + Flight Controls"
      : phase === PHASES.RUNNER
      ? "Camera + Runner Controls"
      : phase === PHASES.GAME
      ? "Camera + Tracking"
      : phase === PHASES.SANDBOX
        ? "Camera + Sandbox Controls"
        : "Camera + Calibration Controls";
  const inputTestPinchingCell =
    phase === PHASES.CALIBRATION && !isCalibrating && pinchActive
      ? inputTestHoveredCell
      : -1;

  useEffect(() => {
    appLog.info("App mounted", {
      initialViewport: viewportRef.current,
      initialPhase: phaseRef.current,
    });
    return () => {
      appLog.info("App unmounted");
    };
  }, [appLog]);

  useEffect(() => {
    appLog.info("Phase changed", { phase });
  }, [appLog, phase]);

  useEffect(() => {
    if (phase === PHASES.CALIBRATION) {
      return;
    }
    if (isArcCalibratingRef.current) {
      isArcCalibratingRef.current = false;
      arcCalibrationStartRef.current = 0;
      arcCalibrationSamplesRef.current = [];
      setIsArcCalibrating(false);
      setArcCalibrationProgress(0);
      setArcCalibrationSamples(0);
    }
    if (inputTestHoveredCellRef.current !== -1) {
      inputTestHoveredCellRef.current = -1;
      setInputTestHoveredCell(-1);
    }
    if (sandboxGrabbedBlockIdRef.current !== null) {
      sandboxGrabbedBlockIdRef.current = null;
      setSandboxGrabbedBlockId(null);
    }
    sandboxGrabOffsetRef.current = { x: 0, y: 0 };
    sandboxGrabVelocityRef.current = { vx: 0, vy: 0 };
    sandboxGrabLastPositionRef.current = { x: 0, y: 0, timestamp: 0 };
    if (phase !== PHASES.FLIGHT) {
      flightControlRef.current = {
        yaw: 0,
        pitch: 0,
        roll: 0,
        confidence: 0,
        hasControl: false,
        lastUpdate: 0,
      };
      flightBaselineRef.current = createEmptyFlightBaseline();
      flightBaselineSamplesRef.current = [];
      flightHudLastUpdateRef.current = 0;
      setFlightHud({
        yaw: 0,
        pitch: 0,
        roll: 0,
        confidence: 0,
        baselineReady: false,
        baselineSamples: 0,
        distance: 0,
      });
    }
    if (phase !== PHASES.RUNNER) {
      runnerStateRef.current = {
        initialized: false,
        lastTimestamp: 0,
        trackXTargetIndex: RUNNER_DEFAULT_TRACK_INDEX,
        trackYTargetIndex: RUNNER_DEFAULT_TRACK_INDEX,
        trackXTarget: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
        trackYTarget: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
        trackXFloat: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
        trackYFloat: getRunnerTrackOffsetFromIndex(RUNNER_DEFAULT_TRACK_INDEX, RUNNER_TRACK_GRID_SIZE),
        trackSpacing: 0,
        runnerY: 0,
        runnerVy: 0,
        distance: 0,
        coinsCollected: 0,
        coins: [],
      };
      runnerHudLastUpdateRef.current = 0;
      setRunnerHud({
        coins: 0,
        distance: 0,
        trackCol: RUNNER_DEFAULT_TRACK_INDEX + 1,
        trackRow: RUNNER_DEFAULT_TRACK_INDEX + 1,
        trackSpacingPx: 0,
        jumping: false,
        jumpHeight: 0,
      });
    }
  }, [phase]);

  useEffect(() => {
    appLog.debug("Viewport changed", viewport);
  }, [appLog, viewport]);

  useEffect(() => {
    appLog.info("Camera ready state changed", { cameraReady });
  }, [appLog, cameraReady]);

  useEffect(() => {
    appLog.info("Camera aspect ratio changed", { cameraAspectRatio });
  }, [appLog, cameraAspectRatio]);

  useEffect(() => {
    appLog.info("Model ready state changed", { modelReady });
  }, [appLog, modelReady]);

  useEffect(() => {
    appLog.info("Tracking backend changed", { activeBackend });
  }, [activeBackend, appLog]);

  useEffect(() => {
    appLog.info("Tracking runtime changed", { activeRuntime });
  }, [activeRuntime, appLog]);

  useEffect(() => {
    appLog.debug("Hand detection state changed", { handDetected });
  }, [appLog, handDetected]);

  useEffect(() => {
    appLog.debug("Pinch active state changed", { pinchActive });
  }, [appLog, pinchActive]);

  useEffect(() => {
    appLog.debug("Calibration progress changed", {
      isCalibrating,
      isArcCalibrating,
      calibrationTargetIndex,
      calibrationPairsCount,
      calibrationSampleFrames,
      arcCalibrationProgress,
      arcCalibrationSamples,
      calibrationMessage,
    });
  }, [
    appLog,
    isCalibrating,
    isArcCalibrating,
    calibrationTargetIndex,
    calibrationPairsCount,
    calibrationSampleFrames,
    arcCalibrationProgress,
    arcCalibrationSamples,
    calibrationMessage,
  ]);

  useEffect(() => {
    appLog.debug("Sandbox state changed", {
      phase,
      blockCount: sandboxBlocks.length,
      grabbedBlockId: sandboxGrabbedBlockId,
    });
  }, [appLog, phase, sandboxBlocks.length, sandboxGrabbedBlockId]);

  useEffect(() => {
    appLog.debug("Flight HUD state changed", {
      phase,
      flightHud,
    });
  }, [appLog, phase, flightHud]);

  useEffect(() => {
    appLog.debug("Runner HUD state changed", {
      phase,
      runnerHud,
    });
  }, [appLog, phase, runnerHud]);

  useEffect(() => {
    appLog.debug("Calibration input test state changed", {
      hoveredCellIndex: inputTestHoveredCell,
      totalCells: INPUT_TEST_CELL_COUNT,
      pinchActive,
      pinchingHoverCell:
        phase === PHASES.CALIBRATION && !isCalibrating && pinchActive
          ? inputTestHoveredCell
          : -1,
      phase,
      isCalibrating,
    });
  }, [
    appLog,
    inputTestHoveredCell,
    pinchActive,
    phase,
    isCalibrating,
  ]);

  useEffect(() => {
    appLog.debug("Game scoreboard state changed", {
      score,
      timeLeft,
      gameRunning,
      activeMoleIndex,
    });
  }, [appLog, score, timeLeft, gameRunning, activeMoleIndex]);

  useEffect(() => {
    appLog.debug("Debug overlay state changed", { debugEnabled });
  }, [appLog, debugEnabled]);

  useEffect(() => {
    appLog.debug("Calibration transform state changed", {
      hasTransform: Boolean(transform),
      hasSavedCalibration,
      transform,
    });
  }, [appLog, transform, hasSavedCalibration]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    rawCursorRef.current = rawCursor;
  }, [rawCursor]);

  useEffect(() => {
    debugRef.current = debugEnabled;
  }, [debugEnabled]);

  useEffect(() => {
    calibrationTargetsRef.current = calibrationTargets;
  }, [calibrationTargets]);

  useEffect(() => {
    calibrationIndexRef.current = calibrationTargetIndex;
  }, [calibrationTargetIndex]);

  useEffect(() => {
    isCalibratingRef.current = isCalibrating;
  }, [isCalibrating]);

  useEffect(() => {
    isArcCalibratingRef.current = isArcCalibrating;
  }, [isArcCalibrating]);

  useEffect(() => {
    inputTestHoveredCellRef.current = inputTestHoveredCell;
  }, [inputTestHoveredCell]);

  useEffect(() => {
    sandboxBlocksRef.current = sandboxBlocks;
  }, [sandboxBlocks]);

  useEffect(() => {
    sandboxGrabbedBlockIdRef.current = sandboxGrabbedBlockId;
  }, [sandboxGrabbedBlockId]);

  useEffect(() => {
    holesRef.current = holes;
  }, [holes]);

  useEffect(() => {
    gameRunningRef.current = gameRunning;
  }, [gameRunning]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    appLog.info("Attempting to load saved calibration on startup");
    const stored = loadCalibration();
    if (stored) {
      setTransform(stored);
      transformRef.current = stored;
      setHasSavedCalibration(true);
      setCalibrationMessage(
        isArcCalibrationModel(stored)
          ? "Saved lazy-arc calibration loaded. Start game or recalibrate anytime."
          : "Saved calibration loaded. Start game or recalibrate anytime.",
      );
      appLog.info("Loaded saved calibration", { stored });
    } else {
      appLog.info("No saved calibration found on startup");
    }
  }, [appLog]);

  useEffect(() => {
    appLog.debug("Registering window resize listener");
    const onResize = () => {
      appLog.debug("Window resize event received", {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);
    return () => {
      appLog.debug("Removing window resize listener");
      window.removeEventListener("resize", onResize);
    };
  }, [appLog]);

  useEffect(() => {
    appLog.debug("Viewport effect started for targets/cursor refresh", viewport);
    const targets = createCalibrationTargets(viewport.width, viewport.height);
    setCalibrationTargets(targets);
    calibrationTargetsRef.current = targets;

    if (isCalibratingRef.current) {
      const nextIndex = Math.min(calibrationIndexRef.current, targets.length - 1);
      calibrationIndexRef.current = nextIndex;
      setCalibrationTargetIndex(nextIndex);
    }

    const clampedCursor = clampPoint(cursorRef.current, viewport.width, viewport.height);
    const clampedRaw = clampPoint(rawCursorRef.current, viewport.width, viewport.height);
    cursorRef.current = clampedCursor;
    rawCursorRef.current = clampedRaw;
    setCursor(clampedCursor);
    setRawCursor(clampedRaw);
    appLog.debug("Viewport effect completed", {
      targets: targets.length,
      clampedCursor,
      clampedRaw,
    });
  }, [appLog, viewport]);

  useEffect(() => {
    mountedRef.current = true;
    appLog.info("Camera initialization effect started");

    const initCamera = async () => {
      try {
        appLog.info("Requesting webcam access");
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser does not support webcam access.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!mountedRef.current) {
          appLog.warn("Camera stream obtained but component was unmounted; closing tracks");
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          const primaryTrack = stream.getVideoTracks()[0];
          const trackSettings = primaryTrack?.getSettings?.() ?? {};
          const measuredWidth = video.videoWidth || trackSettings.width;
          const measuredHeight = video.videoHeight || trackSettings.height;
          if (
            Number.isFinite(measuredWidth) &&
            Number.isFinite(measuredHeight) &&
            measuredWidth > 0 &&
            measuredHeight > 0
          ) {
            const ratio = measuredWidth / measuredHeight;
            setCameraAspectRatio(ratio);
            appLog.info("Updated camera display ratio from stream dimensions", {
              measuredWidth,
              measuredHeight,
              ratio: roundMetric(ratio, 6),
            });
          } else {
            appLog.warn("Could not derive camera ratio from metadata; using existing fallback", {
              measuredWidth,
              measuredHeight,
            });
          }
          appLog.info("Webcam stream attached and playback started", {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            trackWidth: trackSettings.width ?? null,
            trackHeight: trackSettings.height ?? null,
          });
        } else {
          appLog.warn("Video ref was unavailable after webcam stream setup");
        }
        setCameraReady(true);
      } catch (error) {
        appLog.error("Camera initialization failed", { error });
        setCameraError(
          error instanceof Error
            ? error.message
            : "Camera access failed. Check browser permissions.",
        );
      }
    };

    initCamera();

    return () => {
      appLog.info("Camera initialization cleanup started");
      mountedRef.current = false;
      if (rafRef.current) {
        appLog.debug("Cancelling RAF during camera cleanup", { rafId: rafRef.current });
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        appLog.info("Stopping webcam tracks during cleanup", {
          trackCount: streamRef.current.getTracks().length,
        });
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [appLog]);

  useEffect(() => {
    let cancelled = false;
    appLog.info("Hand-tracking model initialization effect started");

    const initModel = async () => {
      try {
        const preferredConfig =
          INITIAL_TRACKING_RUNTIME === "mediapipe"
            ? { runtime: "mediapipe", modelType: "full", maxHands: 1 }
            : { runtime: "tfjs", backend: "webgl", modelType: "full", maxHands: 1 };

        appLog.info("Initializing hand-tracking detector", {
          requestedRuntime: preferredConfig.runtime,
          requestedBackend: preferredConfig.backend ?? "n/a",
          requestedModelType: preferredConfig.modelType,
          requestedMaxHands: preferredConfig.maxHands,
        });

        let detector = null;
        try {
          detector = await initHandTracking(preferredConfig);
        } catch (error) {
          if (preferredConfig.runtime !== "mediapipe") {
            throw error;
          }

          appLog.warn("Preferred MediaPipe init failed; retrying TFJS WebGL", { error });
          detector = await initHandTracking({
            runtime: "tfjs",
            backend: "webgl",
            modelType: "full",
            maxHands: 1,
          });
        }

        if (cancelled) {
          appLog.warn("Model initialized after cancellation; disposing detector");
          detector?.dispose?.();
          return;
        }
        detectorRef.current = detector;
        const runtime = getCurrentRuntime() || preferredConfig.runtime;
        const backend =
          getCurrentBackend() || (runtime === "mediapipe" ? "n/a" : preferredConfig.backend || "webgl");
        setActiveRuntime(runtime);
        setActiveBackend(backend);
        appLog.info("Hand-tracking detector is ready");
        setModelReady(true);
      } catch (error) {
        appLog.error("Failed to initialize hand-tracking detector", { error });
        setModelError(
          error instanceof Error
            ? error.message
            : "Failed to initialize hand tracking model.",
        );
      }
    };

    initModel();

    return () => {
      cancelled = true;
      appLog.info("Model initialization cleanup started");
      if (detectorRef.current) {
        appLog.info("Disposing hand-tracking detector");
        detectorRef.current.dispose?.();
        detectorRef.current = null;
      }
    };
  }, [appLog]);

  useEffect(() => {
    appLog.debug("Starting camera overlay canvas sync effect");
    const syncCanvasSize = () => {
      const wrapper = cameraWrapRef.current;
      const canvas = overlayCanvasRef.current;
      if (!wrapper || !canvas) {
        appLog.debug("Skipped canvas sync due to missing wrapper/canvas", {
          hasWrapper: Boolean(wrapper),
          hasCanvas: Boolean(canvas),
        });
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      appLog.debug("Synced overlay canvas size", {
        width: canvas.width,
        height: canvas.height,
      });
    };

    syncCanvasSize();

    const wrapper = cameraWrapRef.current;
    if (!wrapper || !window.ResizeObserver) {
      appLog.warn("ResizeObserver unavailable for canvas sync; using window resize fallback");
      window.addEventListener("resize", syncCanvasSize);
      return () => {
        appLog.debug("Cleaning up fallback canvas resize listener");
        window.removeEventListener("resize", syncCanvasSize);
      };
    }

    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(wrapper);
    window.addEventListener("resize", syncCanvasSize);

    return () => {
      appLog.debug("Cleaning up canvas sync ResizeObserver and listeners");
      observer.disconnect();
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, [appLog]);

  useEffect(() => {
    if (phase !== PHASES.GAME) {
      appLog.debug("Skipping board layout effect because phase is not GAME", { phase });
      return undefined;
    }
    appLog.debug("Starting board layout effect");

    const updateBoardLayout = () => {
      const board = boardRef.current;
      if (!board) {
        appLog.debug("Skipped board layout update due to missing board ref");
        return;
      }
      const rect = board.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        appLog.debug("Skipped board layout update due to zero-sized board rect", {
          width: rect.width,
          height: rect.height,
        });
        return;
      }

      const localHoles = buildGridHoles(rect.width, rect.height, 3, 3);
      setHoles(localHoles);
      holesRef.current = localHoles;
      hitZonesRef.current = localHoles.map((hole) => ({
        x: rect.left + hole.x,
        y: rect.top + hole.y,
        r: hole.r * 0.9,
      }));
      appLog.debug("Board layout updated", {
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        holeCount: localHoles.length,
      });
    };

    updateBoardLayout();

    const board = boardRef.current;
    if (!board || !window.ResizeObserver) {
      appLog.warn("ResizeObserver unavailable for board layout; using window resize fallback");
      window.addEventListener("resize", updateBoardLayout);
      return () => {
        appLog.debug("Cleaning up board layout fallback listener");
        window.removeEventListener("resize", updateBoardLayout);
      };
    }

    const observer = new ResizeObserver(updateBoardLayout);
    observer.observe(board);
    window.addEventListener("resize", updateBoardLayout);
    window.addEventListener("scroll", updateBoardLayout, true);

    return () => {
      appLog.debug("Cleaning up board layout observers/listeners");
      observer.disconnect();
      window.removeEventListener("resize", updateBoardLayout);
      window.removeEventListener("scroll", updateBoardLayout, true);
    };
  }, [appLog, phase]);

  useEffect(() => {
    if (phase !== PHASES.CALIBRATION) {
      setInputTestGridSize((previous) =>
        previous.width === 0 && previous.height === 0 && previous.cellSize === 0
          ? previous
          : { width: 0, height: 0, cellSize: 0 },
      );
      return undefined;
    }

    const stage = inputTestStageRef.current;
    if (!stage) {
      appLog.debug("Skipping input-test grid sizing because stage ref is unavailable");
      return undefined;
    }

    let rafId = 0;
    const updateGridSize = () => {
      const rect = stage.getBoundingClientRect();
      const nextSize = computeFittedGridSize(
        rect.width,
        rect.height,
        INPUT_TEST_GRID_COLS,
        INPUT_TEST_GRID_ROWS,
        INPUT_TEST_CELL_GAP,
      );
      setInputTestGridSize((previous) => {
        if (
          previous.width === nextSize.width &&
          previous.height === nextSize.height &&
          previous.cellSize === nextSize.cellSize
        ) {
          return previous;
        }
        appLog.debug("Updated calibration input-test grid fit size", {
          stageWidth: roundMetric(rect.width, 1),
          stageHeight: roundMetric(rect.height, 1),
          nextSize,
        });
        return nextSize;
      });
    };

    const scheduleGridSizeUpdate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateGridSize();
      });
    };

    scheduleGridSizeUpdate();

    if (!window.ResizeObserver) {
      appLog.warn("ResizeObserver unavailable for input-test stage sizing; using window resize fallback");
      window.addEventListener("resize", scheduleGridSizeUpdate);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        window.removeEventListener("resize", scheduleGridSizeUpdate);
      };
    }

    const observer = new ResizeObserver(scheduleGridSizeUpdate);
    observer.observe(stage);
    window.addEventListener("resize", scheduleGridSizeUpdate);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleGridSizeUpdate);
    };
  }, [appLog, phase]);

  useEffect(() => {
    if (phase !== PHASES.SANDBOX) {
      return undefined;
    }
    const stage = sandboxStageRef.current;
    if (!stage) {
      appLog.debug("Skipping sandbox stage observer because stage ref is unavailable");
      return undefined;
    }

    let rafId = 0;
    const scheduleReset = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        resetSandboxBlocks("stage_resize_or_open");
      });
    };

    scheduleReset();

    if (!window.ResizeObserver) {
      window.addEventListener("resize", scheduleReset);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        window.removeEventListener("resize", scheduleReset);
      };
    }

    const observer = new ResizeObserver(scheduleReset);
    observer.observe(stage);
    window.addEventListener("resize", scheduleReset);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleReset);
    };
  }, [appLog, phase]);

  useEffect(() => {
    if (phase !== PHASES.FLIGHT) {
      return undefined;
    }
    const stage = flightStageRef.current;
    const canvas = flightCanvasRef.current;
    if (!stage || !canvas) {
      appLog.debug("Skipping flight stage observer because stage/canvas ref is unavailable", {
        hasStage: Boolean(stage),
        hasCanvas: Boolean(canvas),
      });
      return undefined;
    }

    let rafId = 0;
    const syncCanvasSizeAndReset = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        appLog.info("Synced flight canvas dimensions", { width, height });
      }
      resetFlightSession("flight_stage_resize_or_open");
    };
    const scheduleSync = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        syncCanvasSizeAndReset();
      });
    };

    scheduleSync();

    if (!window.ResizeObserver) {
      window.addEventListener("resize", scheduleSync);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        window.removeEventListener("resize", scheduleSync);
      };
    }

    const observer = new ResizeObserver(scheduleSync);
    observer.observe(stage);
    window.addEventListener("resize", scheduleSync);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
    };
  }, [appLog, phase]);

  useEffect(() => {
    if (phase !== PHASES.RUNNER) {
      return undefined;
    }
    const stage = runnerStageRef.current;
    const canvas = runnerCanvasRef.current;
    if (!stage || !canvas) {
      appLog.debug("Skipping runner stage observer because stage/canvas ref is unavailable", {
        hasStage: Boolean(stage),
        hasCanvas: Boolean(canvas),
      });
      return undefined;
    }

    let rafId = 0;
    const syncCanvasSize = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      let resized = false;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        resized = true;
        appLog.info("Synced runner canvas dimensions", { width, height });
      }
      if (resized) {
        drawRunnerScene();
      }
    };
    const scheduleSync = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        syncCanvasSize();
      });
    };

    scheduleSync();

    if (!window.ResizeObserver) {
      window.addEventListener("resize", scheduleSync);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        window.removeEventListener("resize", scheduleSync);
      };
    }

    const observer = new ResizeObserver(scheduleSync);
    observer.observe(stage);
    window.addEventListener("resize", scheduleSync);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
    };
  }, [appLog, phase]);

  function getRecoveryConfig(attempt, reason) {
    const currentRuntime = getCurrentRuntime() || activeRuntime;
    const currentBackend = getCurrentBackend() || activeBackend;

    // Keep MediaPipe as the sticky runtime once it has been reached.
    if (currentRuntime === "mediapipe") {
      // Periodically probe TFJS in case a device/runtime combination recovers.
      if (attempt % 4 === 0) {
        return { runtime: "tfjs", backend: "webgl", modelType: "full", maxHands: 1 };
      }
      return { runtime: "mediapipe", modelType: "full", maxHands: 1 };
    }

    // TFJS invalid-keypoint corruption should switch straight to MediaPipe.
    if (reason === "continuous_invalid_landmarks") {
      return { runtime: "mediapipe", modelType: "full", maxHands: 1 };
    }

    if (attempt === 1) {
      return {
        runtime: "tfjs",
        backend: currentBackend === "cpu" ? "cpu" : "webgl",
        modelType: "full",
        maxHands: 1,
      };
    }

    if (attempt === 2) {
      return { runtime: "mediapipe", modelType: "full", maxHands: 1 };
    }

    return { runtime: "tfjs", backend: "cpu", modelType: "full", maxHands: 1 };
  }

  async function recoverDetectorFromInvalidLandmarks(reason, details) {
    if (recoveringDetectorRef.current) {
      return;
    }

    recoveringDetectorRef.current = true;
    detectorRecoveryAttemptsRef.current += 1;
    const attempt = detectorRecoveryAttemptsRef.current;
    const requestedConfig = getRecoveryConfig(attempt, reason);
    logTrackingExtentsSnapshot(`pre_recovery_${reason}`);

    appLog.warn("Attempting detector recovery", {
      attempt,
      reason,
      requestedRuntime: requestedConfig.runtime,
      requestedBackend: requestedConfig.backend ?? "n/a",
      requestedModelType: requestedConfig.modelType,
      details,
      invalidLandmarkStreak: invalidLandmarkStreakRef.current,
      noHandStreak: noHandStreakRef.current,
    });

    try {
      const previousDetector = detectorRef.current;
      const nextDetector = await initHandTracking(requestedConfig);
      detectorRef.current = nextDetector;
      if (previousDetector && previousDetector !== nextDetector) {
        previousDetector.dispose?.();
      }
      invalidLandmarkStreakRef.current = 0;
      noHandStreakRef.current = 0;
      setActiveBackend(
        getCurrentBackend() ||
          requestedConfig.backend ||
          (requestedConfig.runtime === "mediapipe" ? "n/a" : "unknown"),
      );
      setActiveRuntime(getCurrentRuntime() || requestedConfig.runtime);
      appLog.info("Detector recovery succeeded", {
        attempt,
        activeRuntime: getCurrentRuntime(),
        activeBackend: getCurrentBackend(),
      });
    } catch (error) {
      appLog.error("Detector recovery failed", {
        attempt,
        requestedRuntime: requestedConfig.runtime,
        requestedBackend: requestedConfig.backend ?? "n/a",
        error,
      });
      setModelError(
        error instanceof Error
          ? `Tracking recovery failed: ${error.message}`
          : "Tracking recovery failed.",
      );
    } finally {
      recoveringDetectorRef.current = false;
    }
  }

  function resetCalibrationInputTests(reason = "manual_reset") {
    inputTestHoveredCellRef.current = -1;
    setInputTestHoveredCell(-1);
    appLog.info("Calibration input tests reset", { reason });
  }

  function resetArcCalibrationSession(reason = "manual_reset") {
    arcCalibrationStartRef.current = 0;
    arcCalibrationSamplesRef.current = [];
    isArcCalibratingRef.current = false;
    setIsArcCalibrating(false);
    setArcCalibrationProgress(0);
    setArcCalibrationSamples(0);
    appLog.info("Lazy-arc calibration session reset", { reason });
  }

  function resetSandboxBlocks(reason = "manual_reset") {
    const stage = sandboxStageRef.current;
    if (!stage) {
      appLog.debug("Skipping sandbox block reset because stage ref is unavailable", { reason });
      return;
    }
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      appLog.debug("Skipping sandbox block reset because stage size is not ready", {
        reason,
        width: rect.width,
        height: rect.height,
      });
      return;
    }
    const nextBlocks = createSandboxBlocks(rect.width, rect.height);
    sandboxBlocksRef.current = nextBlocks;
    setSandboxBlocks(nextBlocks);
    sandboxLastTickRef.current = performance.now();
    sandboxGrabbedBlockIdRef.current = null;
    setSandboxGrabbedBlockId(null);
    sandboxGrabOffsetRef.current = { x: 0, y: 0 };
    sandboxGrabVelocityRef.current = { vx: 0, vy: 0 };
    sandboxGrabLastPositionRef.current = { x: 0, y: 0, timestamp: 0 };
    appLog.info("Sandbox blocks reset", {
      reason,
      width: rect.width,
      height: rect.height,
      blockCount: nextBlocks.length,
      blockSize: nextBlocks[0]?.size ?? null,
    });
  }

  function openSandboxScreen() {
    appLog.info("Opening pinch drag sandbox screen");
    stopGameSession();
    resetArcCalibrationSession("open_sandbox");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPhase(PHASES.SANDBOX);
    phaseRef.current = PHASES.SANDBOX;
    setCalibrationMessage("Pinch Drag Sandbox active.");
    requestAnimationFrame(() => resetSandboxBlocks("open_sandbox"));
  }

  function returnToCalibrationInputTest() {
    appLog.info("Returning from sandbox to calibration input test");
    sandboxGrabbedBlockIdRef.current = null;
    sandboxGrabOffsetRef.current = { x: 0, y: 0 };
    sandboxGrabVelocityRef.current = { vx: 0, vy: 0 };
    sandboxGrabLastPositionRef.current = { x: 0, y: 0, timestamp: 0 };
    setSandboxGrabbedBlockId(null);
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function updateSandboxPhysics(timestamp, pointerPoint, hasHand, pinchNow) {
    if (phaseRef.current !== PHASES.SANDBOX) {
      return;
    }
    const stage = sandboxStageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    if (!Array.isArray(sandboxBlocksRef.current) || sandboxBlocksRef.current.length === 0) {
      const seededBlocks = createSandboxBlocks(rect.width, rect.height);
      sandboxBlocksRef.current = seededBlocks;
      setSandboxBlocks(seededBlocks);
      sandboxLastTickRef.current = timestamp;
      return;
    }

    const dtSeconds = clampValue(
      (timestamp - (sandboxLastTickRef.current || timestamp)) / 1000,
      0,
      SANDBOX_MAX_STEP_SECONDS,
    );
    sandboxLastTickRef.current = timestamp;

    const pointerLocal = pointerPoint
      ? {
          x: pointerPoint.x - rect.left,
          y: pointerPoint.y - rect.top,
        }
      : null;

    let blocks = sandboxBlocksRef.current.map((block) => ({ ...block }));
    let grabbedId = sandboxGrabbedBlockIdRef.current;
    const clampVelocity = (value) =>
      clampValue(value, -SANDBOX_MAX_FLING_SPEED, SANDBOX_MAX_FLING_SPEED);

    const releaseGrabbedBlock = () => {
      if (grabbedId === null) {
        return;
      }
      const releaseIndex = blocks.findIndex((block) => block.id === grabbedId);
      if (releaseIndex >= 0) {
        const releaseVelocity = sandboxGrabVelocityRef.current;
        blocks[releaseIndex].vx = clampVelocity(releaseVelocity.vx);
        blocks[releaseIndex].vy = clampVelocity(releaseVelocity.vy);
        appLog.info("Sandbox block released with fling velocity", {
          blockId: grabbedId,
          vx: roundMetric(blocks[releaseIndex].vx, 2),
          vy: roundMetric(blocks[releaseIndex].vy, 2),
        });
      }
      grabbedId = null;
      sandboxGrabbedBlockIdRef.current = null;
      setSandboxGrabbedBlockId(null);
      sandboxGrabOffsetRef.current = { x: 0, y: 0 };
      sandboxGrabVelocityRef.current = { vx: 0, vy: 0 };
      sandboxGrabLastPositionRef.current = { x: 0, y: 0, timestamp: 0 };
    };

    if (!pinchNow || !hasHand || !pointerLocal) {
      releaseGrabbedBlock();
    }

    if (pinchNow && hasHand && pointerLocal) {
      if (grabbedId === null) {
        for (let index = blocks.length - 1; index >= 0; index -= 1) {
          const block = blocks[index];
          if (
            pointerLocal.x >= block.x &&
            pointerLocal.x <= block.x + block.size &&
            pointerLocal.y >= block.y &&
            pointerLocal.y <= block.y + block.size
          ) {
            grabbedId = block.id;
            sandboxGrabbedBlockIdRef.current = grabbedId;
            setSandboxGrabbedBlockId(grabbedId);
            sandboxGrabOffsetRef.current = {
              x: pointerLocal.x - block.x,
              y: pointerLocal.y - block.y,
            };
            sandboxGrabVelocityRef.current = {
              vx: block.vx,
              vy: block.vy,
            };
            sandboxGrabLastPositionRef.current = {
              x: block.x,
              y: block.y,
              timestamp,
            };
            const grabbedBlock = blocks.splice(index, 1)[0];
            blocks.push(grabbedBlock);
            break;
          }
        }
      }

      if (grabbedId !== null) {
        const grabbedIndex = blocks.findIndex((block) => block.id === grabbedId);
        if (grabbedIndex >= 0) {
          const grabbedBlock = blocks[grabbedIndex];
          const previousX = grabbedBlock.x;
          const previousY = grabbedBlock.y;
          grabbedBlock.x = clampValue(
            pointerLocal.x - sandboxGrabOffsetRef.current.x,
            0,
            rect.width - grabbedBlock.size,
          );
          grabbedBlock.y = clampValue(
            pointerLocal.y - sandboxGrabOffsetRef.current.y,
            0,
            rect.height - grabbedBlock.size,
          );

          const previousMove = sandboxGrabLastPositionRef.current;
          const elapsedSeconds = Math.max(
            1 / 120,
            (timestamp - (previousMove.timestamp || timestamp)) / 1000,
          );
          const instantVx = (grabbedBlock.x - previousX) / elapsedSeconds;
          const instantVy = (grabbedBlock.y - previousY) / elapsedSeconds;
          const smoothedVx =
            sandboxGrabVelocityRef.current.vx * 0.58 + instantVx * 0.42;
          const smoothedVy =
            sandboxGrabVelocityRef.current.vy * 0.58 + instantVy * 0.42;
          sandboxGrabVelocityRef.current = {
            vx: clampVelocity(smoothedVx),
            vy: clampVelocity(smoothedVy),
          };
          sandboxGrabLastPositionRef.current = {
            x: grabbedBlock.x,
            y: grabbedBlock.y,
            timestamp,
          };
          grabbedBlock.vx = 0;
          grabbedBlock.vy = 0;
        }
      }
    }

    for (const block of blocks) {
      if (grabbedId !== null && block.id === grabbedId) {
        continue;
      }

      block.vy += SANDBOX_GRAVITY * dtSeconds;
      const drag = Number.isFinite(block.airDrag) ? block.airDrag : 0.994;
      block.vx *= drag;
      block.vy *= drag;
      block.x += block.vx * dtSeconds;
      block.y += block.vy * dtSeconds;

      const restitution = Number.isFinite(block.restitution) ? block.restitution : 0.2;
      if (block.x < 0) {
        block.x = 0;
        if (block.vx < 0) {
          block.vx = -block.vx * restitution;
          block.vy *= SANDBOX_FLOOR_FRICTION;
        }
      } else if (block.x + block.size > rect.width) {
        block.x = rect.width - block.size;
        if (block.vx > 0) {
          block.vx = -block.vx * restitution;
          block.vy *= SANDBOX_FLOOR_FRICTION;
        }
      }

      if (block.y < 0) {
        block.y = 0;
        if (block.vy < 0) {
          block.vy = -block.vy * restitution;
          block.vx *= SANDBOX_FLOOR_FRICTION;
        }
      } else if (block.y + block.size > rect.height) {
        block.y = rect.height - block.size;
        if (block.vy > 0) {
          block.vy = -Math.abs(block.vy) * restitution;
          block.vx *= SANDBOX_FLOOR_FRICTION;
        }
        if (Math.abs(block.vy) < SANDBOX_REST_VELOCITY) {
          block.vy = 0;
        }
      }
    }

    for (let iteration = 0; iteration < SANDBOX_COLLISION_ITERATIONS; iteration += 1) {
      for (let first = 0; first < blocks.length; first += 1) {
        for (let second = first + 1; second < blocks.length; second += 1) {
          const blockA = blocks[first];
          const blockB = blocks[second];
          const overlapX =
            Math.min(blockA.x + blockA.size, blockB.x + blockB.size) -
            Math.max(blockA.x, blockB.x);
          const overlapY =
            Math.min(blockA.y + blockA.size, blockB.y + blockB.size) -
            Math.max(blockA.y, blockB.y);
          if (overlapX <= 0 || overlapY <= 0) {
            continue;
          }

          const centerAx = blockA.x + blockA.size / 2;
          const centerAy = blockA.y + blockA.size / 2;
          const centerBx = blockB.x + blockB.size / 2;
          const centerBy = blockB.y + blockB.size / 2;
          const blockAGrabbed = grabbedId === blockA.id;
          const blockBGrabbed = grabbedId === blockB.id;
          const moveShareA = blockAGrabbed ? 0 : blockBGrabbed ? 1 : 0.5;
          const moveShareB = blockBGrabbed ? 0 : blockAGrabbed ? 1 : 0.5;
          const invMassA = blockAGrabbed ? 0 : 1 / Math.max(0.001, blockA.mass || 1);
          const invMassB = blockBGrabbed ? 0 : 1 / Math.max(0.001, blockB.mass || 1);
          const invMassSum = invMassA + invMassB;
          const restitution = Math.max(
            blockA.restitution ?? 0.2,
            blockB.restitution ?? 0.2,
          );

          if (overlapX < overlapY) {
            const direction = centerAx < centerBx ? -1 : 1;
            const separation = overlapX + 0.01;
            blockA.x = clampValue(
              blockA.x + direction * separation * moveShareA,
              0,
              rect.width - blockA.size,
            );
            blockB.x = clampValue(
              blockB.x - direction * separation * moveShareB,
              0,
              rect.width - blockB.size,
            );

            if (invMassSum > 0) {
              const normal = centerAx < centerBx ? 1 : -1;
              const relativeNormalVelocity = (blockB.vx - blockA.vx) * normal;
              if (relativeNormalVelocity < 0) {
                const impulseMagnitude =
                  (-(1 + restitution) * relativeNormalVelocity) / invMassSum;
                blockA.vx -= impulseMagnitude * invMassA * normal;
                blockB.vx += impulseMagnitude * invMassB * normal;
              }
              const tangentVelocity = blockB.vy - blockA.vy;
              const frictionImpulse = tangentVelocity * SANDBOX_COLLISION_FRICTION;
              blockA.vy += frictionImpulse * invMassA * 0.5;
              blockB.vy -= frictionImpulse * invMassB * 0.5;
            }
          } else {
            const direction = centerAy < centerBy ? -1 : 1;
            const separation = overlapY + 0.01;
            blockA.y = clampValue(
              blockA.y + direction * separation * moveShareA,
              0,
              rect.height - blockA.size,
            );
            blockB.y = clampValue(
              blockB.y - direction * separation * moveShareB,
              0,
              rect.height - blockB.size,
            );

            if (invMassSum > 0) {
              const normal = centerAy < centerBy ? 1 : -1;
              const relativeNormalVelocity = (blockB.vy - blockA.vy) * normal;
              if (relativeNormalVelocity < 0) {
                const impulseMagnitude =
                  (-(1 + restitution) * relativeNormalVelocity) / invMassSum;
                blockA.vy -= impulseMagnitude * invMassA * normal;
                blockB.vy += impulseMagnitude * invMassB * normal;
              }
              const tangentVelocity = blockB.vx - blockA.vx;
              const frictionImpulse = tangentVelocity * SANDBOX_COLLISION_FRICTION;
              blockA.vx += frictionImpulse * invMassA * 0.5;
              blockB.vx -= frictionImpulse * invMassB * 0.5;
            }
          }
        }
      }
    }

    for (const block of blocks) {
      if (grabbedId !== null && block.id === grabbedId) {
        continue;
      }

      const isOnFloor = Math.abs(block.y + block.size - rect.height) <= 1.2;
      if (isOnFloor && Math.abs(block.vx) < 1.2) {
        block.vx = 0;
      }

      if (!isOnFloor) {
        let supportMin = Number.POSITIVE_INFINITY;
        let supportMax = Number.NEGATIVE_INFINITY;

        for (const other of blocks) {
          if (other.id === block.id) {
            continue;
          }
          const verticalGap = Math.abs(block.y + block.size - other.y);
          if (verticalGap > SANDBOX_SUPPORT_EPSILON) {
            continue;
          }
          const overlapLeft = Math.max(block.x, other.x);
          const overlapRight = Math.min(block.x + block.size, other.x + other.size);
          const overlapWidth = overlapRight - overlapLeft;
          if (overlapWidth <= 1) {
            continue;
          }
          supportMin = Math.min(supportMin, overlapLeft);
          supportMax = Math.max(supportMax, overlapRight);
        }

        if (Number.isFinite(supportMin) && Number.isFinite(supportMax)) {
          const centerX = block.x + block.size / 2;
          let overhangDistance = 0;
          if (centerX < supportMin) {
            overhangDistance = centerX - supportMin;
          } else if (centerX > supportMax) {
            overhangDistance = centerX - supportMax;
          }

          if (overhangDistance !== 0) {
            const direction = Math.sign(overhangDistance);
            const overhangRatio = clampValue(
              Math.abs(overhangDistance) / Math.max(1, block.size * 0.5),
              0.08,
              1.4,
            );
            block.vx += direction * SANDBOX_OVERHANG_ACCEL * overhangRatio * dtSeconds;
            block.vy += SANDBOX_GRAVITY * 0.08 * dtSeconds;
          }
        }
      }

      block.x = clampValue(block.x, 0, rect.width - block.size);
      block.y = clampValue(block.y, 0, rect.height - block.size);
      block.vx = clampVelocity(block.vx);
      block.vy = clampVelocity(block.vy);
      if (Math.abs(block.vx) < 0.18) {
        block.vx = 0;
      }
      if (Math.abs(block.vy) < 0.18 && block.y + block.size >= rect.height - 0.6) {
        block.vy = 0;
      }
    }

    sandboxBlocksRef.current = blocks;
    setSandboxBlocks(blocks);
  }

  function publishFlightHud(timestamp) {
    if (timestamp - flightHudLastUpdateRef.current < FLIGHT_HUD_UPDATE_MS) {
      return;
    }
    flightHudLastUpdateRef.current = timestamp;
    const baseline = flightBaselineRef.current;
    const control = flightControlRef.current;
    const state = flightStateRef.current;
    const nextHud = {
      yaw: roundMetric(control.yaw, 3) ?? 0,
      pitch: roundMetric(control.pitch, 3) ?? 0,
      roll: roundMetric(control.roll, 3) ?? 0,
      confidence: roundMetric(control.confidence, 3) ?? 0,
      baselineReady: baseline.ready,
      baselineSamples: baseline.sampleCount,
      distance: roundMetric(state.distance, 1) ?? 0,
    };
    setFlightHud((previous) => {
      if (
        previous.yaw === nextHud.yaw &&
        previous.pitch === nextHud.pitch &&
        previous.roll === nextHud.roll &&
        previous.confidence === nextHud.confidence &&
        previous.baselineReady === nextHud.baselineReady &&
        previous.baselineSamples === nextHud.baselineSamples &&
        previous.distance === nextHud.distance
      ) {
        return previous;
      }
      return nextHud;
    });
  }

  function resetFlightSession(reason = "manual_reset") {
    flightStateRef.current = {
      initialized: true,
      lastTimestamp: 0,
      shipX: 0,
      shipY: 0,
      shipVx: 0,
      shipVy: 0,
      roll: 0,
      pitch: 0,
      yaw: 0,
      distance: 0,
      stars: createFlightStars(),
      rings: createFlightRings(),
    };
    flightControlRef.current = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      confidence: 0,
      hasControl: false,
      lastUpdate: 0,
    };
    flightBaselineRef.current = createEmptyFlightBaseline();
    flightBaselineSamplesRef.current = [];
    flightHudLastUpdateRef.current = 0;
    setFlightHud({
      yaw: 0,
      pitch: 0,
      roll: 0,
      confidence: 0,
      baselineReady: false,
      baselineSamples: 0,
      distance: 0,
    });
    appLog.info("Flight session reset", {
      reason,
      starCount: flightStateRef.current.stars.length,
      ringCount: flightStateRef.current.rings.length,
    });
  }

  function resetFlightNeutral(reason = "manual_reset") {
    flightControlRef.current = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      confidence: 0,
      hasControl: false,
      lastUpdate: 0,
    };
    flightBaselineRef.current = createEmptyFlightBaseline();
    flightBaselineSamplesRef.current = [];
    flightHudLastUpdateRef.current = 0;
    setCalibrationMessage(
      "Flight neutral reset. Hold all five fingertips visible to recapture your center pose.",
    );
    appLog.info("Flight neutral reset", { reason });
  }

  function startFlightSession() {
    appLog.info("Flight session start requested", {
      hasTransform: Boolean(transformRef.current),
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_flight");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPhase(PHASES.FLIGHT);
    phaseRef.current = PHASES.FLIGHT;
    setCalibrationMessage(
      "Flight mode active. Hold all five fingertips visible to capture neutral orientation.",
    );
    requestAnimationFrame(() => resetFlightSession("start_flight"));
  }

  function returnFromFlightSession() {
    appLog.info("Returning from flight mode to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function updateFlightControlFromTips(mappedFingerTips, timestamp, frameId) {
    if (phaseRef.current !== PHASES.FLIGHT) {
      return;
    }

    const control = flightControlRef.current;
    const baseline = flightBaselineRef.current;
    const pose = computeFiveFingerPose(mappedFingerTips);
    if (!pose) {
      control.yaw = lerpValue(control.yaw, 0, 0.08);
      control.pitch = lerpValue(control.pitch, 0, 0.08);
      control.roll = lerpValue(control.roll, 0, 0.08);
      control.confidence = lerpValue(control.confidence, 0, 0.12);
      control.hasControl = false;
      control.lastUpdate = timestamp;
      publishFlightHud(timestamp);
      if (!baseline.ready && frameId % 45 === 0) {
        setCalibrationMessage(
          "Flight neutral capture paused: keep all five fingertips visible in frame.",
        );
      }
      return;
    }

    if (!baseline.ready) {
      flightBaselineSamplesRef.current.push(pose);
      if (flightBaselineSamplesRef.current.length > FLIGHT_BASELINE_SAMPLE_TARGET) {
        flightBaselineSamplesRef.current.shift();
      }
      baseline.sampleCount = flightBaselineSamplesRef.current.length;
      flightBaselineRef.current = { ...baseline };

      const progress = Math.round(
        (flightBaselineSamplesRef.current.length / FLIGHT_BASELINE_SAMPLE_TARGET) * 100,
      );
      if (frameId % 8 === 0) {
        setCalibrationMessage(
          `Capturing flight neutral pose: ${progress}% (${flightBaselineSamplesRef.current.length}/${FLIGHT_BASELINE_SAMPLE_TARGET}). Keep fingertips visible and steady.`,
        );
      }

      if (flightBaselineSamplesRef.current.length >= FLIGHT_BASELINE_SAMPLE_TARGET) {
        const samples = flightBaselineSamplesRef.current;
        const tipSums = FLIGHT_FINGER_ORDER.map(() => ({ u: 0, v: 0 }));
        let centroidUSum = 0;
        let centroidVSum = 0;
        let opennessSum = 0;
        let angleSinSum = 0;
        let angleCosSum = 0;
        for (const sample of samples) {
          centroidUSum += sample.centroid.u;
          centroidVSum += sample.centroid.v;
          opennessSum += sample.openness;
          angleSinSum += Math.sin(sample.principalAngle);
          angleCosSum += Math.cos(sample.principalAngle);
          sample.points.forEach((point, pointIndex) => {
            tipSums[pointIndex].u += point.u;
            tipSums[pointIndex].v += point.v;
          });
        }
        const nextBaseline = {
          ready: true,
          sampleCount: samples.length,
          centroid: {
            u: centroidUSum / samples.length,
            v: centroidVSum / samples.length,
          },
          principalAngle: Math.atan2(angleSinSum / samples.length, angleCosSum / samples.length),
          openness: opennessSum / samples.length,
          tips: tipSums.map((sum) => ({
            u: sum.u / samples.length,
            v: sum.v / samples.length,
          })),
        };
        flightBaselineRef.current = nextBaseline;
        flightBaselineSamplesRef.current = [];
        setCalibrationMessage(
          "Flight neutral captured. Move your hand to steer the ship using all five fingertips.",
        );
        appLog.info("Flight baseline captured", {
          frameId,
          baseline: nextBaseline,
        });
      }

      control.yaw = lerpValue(control.yaw, 0, 0.18);
      control.pitch = lerpValue(control.pitch, 0, 0.18);
      control.roll = lerpValue(control.roll, 0, 0.18);
      control.confidence = lerpValue(control.confidence, 0.2, 0.2);
      control.hasControl = false;
      control.lastUpdate = timestamp;
      publishFlightHud(timestamp);
      return;
    }

    const baselineAngleDelta = wrapAngleDelta(pose.principalAngle - baseline.principalAngle);
    const rollFromAngle = clampValue((-baselineAngleDelta) / 0.75, -1, 1);
    const fingerRollNumerator = pose.points.reduce((accumulator, point, pointIndex) => {
      const baselinePoint = baseline.tips[pointIndex];
      const weight = FLIGHT_ROLL_WEIGHTS[pointIndex] ?? 0;
      return accumulator + weight * (baselinePoint.v - point.v);
    }, 0);
    const rollFromFingers = clampValue(fingerRollNumerator / 1.44, -1, 1);
    const opennessRatio = pose.openness / Math.max(0.0001, baseline.openness);
    const opennessGain = clampValue((opennessRatio - 0.52) / 0.52, 0.45, 1.22);

    const yawTarget = clampValue(
      ((pose.centroid.u - baseline.centroid.u) / 0.2) * opennessGain,
      -1,
      1,
    );
    const pitchTarget = clampValue(
      ((baseline.centroid.v - pose.centroid.v) / 0.2) * opennessGain,
      -1,
      1,
    );
    const rollTarget = clampValue(rollFromAngle * 0.66 + rollFromFingers * 0.34, -1, 1);

    control.yaw = lerpValue(control.yaw, yawTarget, 0.24);
    control.pitch = lerpValue(control.pitch, pitchTarget, 0.24);
    control.roll = lerpValue(control.roll, rollTarget, 0.24);
    const opennessConfidence = clampValue(
      1 - Math.abs(opennessRatio - 1) * 0.42,
      0.25,
      1,
    );
    control.confidence = lerpValue(control.confidence, opennessConfidence, 0.22);
    control.hasControl = true;
    control.lastUpdate = timestamp;
    if (frameId % 18 === 0) {
      appLog.debug("Flight control update from five fingertips", {
        frameId,
        yawTarget: roundMetric(yawTarget, 4),
        pitchTarget: roundMetric(pitchTarget, 4),
        rollTarget: roundMetric(rollTarget, 4),
        rollFromAngle: roundMetric(rollFromAngle, 4),
        rollFromFingers: roundMetric(rollFromFingers, 4),
        opennessRatio: roundMetric(opennessRatio, 4),
        centroid: {
          u: roundMetric(pose.centroid.u, 4),
          v: roundMetric(pose.centroid.v, 4),
        },
      });
    }
    publishFlightHud(timestamp);
  }

  function drawFlightScene() {
    const stage = flightStageRef.current;
    const canvas = flightCanvasRef.current;
    if (!stage || !canvas) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const state = flightStateRef.current;
    const control = flightControlRef.current;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#050a16");
    sky.addColorStop(0.52, "#081327");
    sky.addColorStop(1, "#0f1f2f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#3161ff";
    ctx.beginPath();
    ctx.arc(width * 0.24, height * 0.16, Math.max(40, width * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4ad8ff";
    ctx.beginPath();
    ctx.arc(width * 0.78, height * 0.26, Math.max(34, width * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const fov = Math.min(width, height) * 1.06;
    const cameraX = state.shipX * 0.66;
    const cameraY = state.shipY * 0.6;

    ctx.strokeStyle = "rgba(74, 126, 220, 0.24)";
    ctx.lineWidth = 1.2;
    for (let lane = -3; lane <= 3; lane += 1) {
      const farDepth = FLIGHT_FAR_Z;
      const nearDepth = 260;
      const xNear = centerX + ((lane * 112 - cameraX) * fov) / nearDepth;
      const yNear = centerY + ((136 - cameraY) * fov) / nearDepth;
      const xFar = centerX + ((lane * 420 - cameraX) * fov) / farDepth;
      const yFar = centerY + ((-210 - cameraY) * fov) / farDepth;
      ctx.beginPath();
      ctx.moveTo(xNear, yNear);
      ctx.lineTo(xFar, yFar);
      ctx.stroke();
    }

    for (const star of state.stars) {
      const depth = Math.max(FLIGHT_NEAR_Z, star.z);
      const projectedX = centerX + ((star.x - cameraX) * fov) / depth;
      const projectedY = centerY + ((star.y - cameraY) * fov) / depth;
      if (
        projectedX < -12 ||
        projectedX > width + 12 ||
        projectedY < -12 ||
        projectedY > height + 12
      ) {
        continue;
      }
      const size = clampValue(0.8 + 200 / depth, 0.8, 3.4);
      const alpha = clampValue(1.1 - depth / FLIGHT_FAR_Z, 0.16, 0.95);
      ctx.fillStyle = `rgba(214, 231, 255, ${alpha})`;
      ctx.fillRect(projectedX - size * 0.5, projectedY - size * 0.5, size, size);
    }

    const sortedRings = [...state.rings].sort((a, b) => b.z - a.z);
    for (const ring of sortedRings) {
      const depth = Math.max(FLIGHT_NEAR_Z, ring.z);
      const projectedX = centerX + ((ring.x - state.shipX * 0.92) * fov) / depth;
      const projectedY = centerY + ((ring.y - state.shipY * 0.92) * fov) / depth;
      const projectedRadius = (ring.radius * fov) / depth;
      if (projectedRadius < 2) {
        continue;
      }
      const alpha = clampValue(1 - depth / FLIGHT_FAR_Z, 0.18, 0.84);
      ctx.lineWidth = clampValue((ring.radius / depth) * 150, 1.2, 5.4);
      ctx.strokeStyle = `rgba(80, 221, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(projectedX, projectedY, projectedRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(170, 225, 255, 0.48)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(centerX - 16, centerY);
    ctx.lineTo(centerX + 16, centerY);
    ctx.moveTo(centerX, centerY - 12);
    ctx.lineTo(centerX, centerY + 12);
    ctx.stroke();

    const shipX = width * 0.5 + state.shipX * 0.38;
    const shipY = height * 0.5 + state.shipY * 0.3;
    const shipScale = clampValue(Math.min(width, height) / 420, 0.72, 1.34);
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(state.roll * 0.9);
    ctx.scale(shipScale, shipScale);

    const thrusterLength = 22 + Math.abs(control.pitch) * 16;
    ctx.strokeStyle = "rgba(125, 219, 255, 0.74)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(-10, 16 + thrusterLength);
    ctx.moveTo(10, 16);
    ctx.lineTo(10, 16 + thrusterLength);
    ctx.stroke();

    ctx.fillStyle = "#cad8f0";
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(18, 2);
    ctx.lineTo(12, 24);
    ctx.lineTo(-12, 24);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#8ea2c2";
    ctx.beginPath();
    ctx.moveTo(-54, 10);
    ctx.lineTo(-14, -2);
    ctx.lineTo(-8, 20);
    ctx.lineTo(-50, 30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(54, 10);
    ctx.lineTo(14, -2);
    ctx.lineTo(8, 20);
    ctx.lineTo(50, 30);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#59ccff";
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(8, -10);
    ctx.lineTo(-8, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function updateFlightSimulation(timestamp) {
    if (phaseRef.current !== PHASES.FLIGHT) {
      return;
    }

    const state = flightStateRef.current;
    if (!state.initialized) {
      resetFlightSession("auto_init");
      return;
    }

    const dtSeconds = clampValue(
      (timestamp - (state.lastTimestamp || timestamp)) / 1000,
      0.001,
      SANDBOX_MAX_STEP_SECONDS,
    );
    state.lastTimestamp = timestamp;
    const control = flightControlRef.current;
    const drag = Math.pow(FLIGHT_DRAG_PER_60FPS, dtSeconds * 60);

    state.shipVx = (state.shipVx + control.yaw * FLIGHT_STEER_ACCEL * dtSeconds) * drag;
    state.shipVy = (state.shipVy + control.pitch * FLIGHT_STEER_ACCEL * dtSeconds) * drag;
    state.shipX = clampValue(
      state.shipX + state.shipVx * dtSeconds,
      -FLIGHT_MAX_SHIP_OFFSET_X,
      FLIGHT_MAX_SHIP_OFFSET_X,
    );
    state.shipY = clampValue(
      state.shipY + state.shipVy * dtSeconds,
      -FLIGHT_MAX_SHIP_OFFSET_Y,
      FLIGHT_MAX_SHIP_OFFSET_Y,
    );
    const targetRoll = control.roll * 0.92 + control.yaw * 0.36;
    const targetPitch = control.pitch * 0.6;
    const targetYaw = control.yaw * 0.62;
    state.roll = lerpValue(state.roll, targetRoll, 0.13);
    state.pitch = lerpValue(state.pitch, targetPitch, 0.13);
    state.yaw = lerpValue(state.yaw, targetYaw, 0.13);
    state.distance += FLIGHT_FORWARD_SPEED * dtSeconds;

    for (const star of state.stars) {
      star.z -= FLIGHT_FORWARD_SPEED * dtSeconds * (1 + Math.abs(control.pitch) * 0.14);
      if (star.z < FLIGHT_NEAR_Z) {
        star.z = FLIGHT_FAR_Z;
        star.x = randomBetween(-FLIGHT_WORLD_HALF_WIDTH, FLIGHT_WORLD_HALF_WIDTH);
        star.y = randomBetween(-FLIGHT_WORLD_HALF_HEIGHT, FLIGHT_WORLD_HALF_HEIGHT);
      }
    }

    for (const ring of state.rings) {
      ring.z -= FLIGHT_FORWARD_SPEED * dtSeconds;
      if (ring.z < FLIGHT_NEAR_Z) {
        ring.z = FLIGHT_FAR_Z + randomBetween(120, 380);
        ring.x = randomBetween(-180, 180);
        ring.y = randomBetween(-116, 116);
        ring.radius = randomBetween(34, 66);
      }
    }

    drawFlightScene();
    publishFlightHud(timestamp);
  }

  function publishRunnerHud(timestamp) {
    if (timestamp - runnerHudLastUpdateRef.current < RUNNER_HUD_UPDATE_MS) {
      return;
    }
    runnerHudLastUpdateRef.current = timestamp;
    const state = runnerStateRef.current;
    const nextHud = {
      coins: state.coinsCollected,
      distance: roundMetric(state.distance, 1) ?? 0,
      trackCol: state.trackXTargetIndex + 1,
      trackRow: state.trackYTargetIndex + 1,
      trackSpacingPx: roundMetric(state.trackSpacing, 1) ?? 0,
      jumping: state.runnerY > 0.1,
      jumpHeight: roundMetric(state.runnerY, 1) ?? 0,
    };
    setRunnerHud((previous) => {
      if (
        previous.coins === nextHud.coins &&
        previous.distance === nextHud.distance &&
        previous.trackCol === nextHud.trackCol &&
        previous.trackRow === nextHud.trackRow &&
        previous.trackSpacingPx === nextHud.trackSpacingPx &&
        previous.jumping === nextHud.jumping &&
        previous.jumpHeight === nextHud.jumpHeight
      ) {
        return previous;
      }
      return nextHud;
    });
  }

  function resetRunnerSession(reason = "manual_reset") {
    const defaultTrackOffset = getRunnerTrackOffsetFromIndex(
      RUNNER_DEFAULT_TRACK_INDEX,
      RUNNER_TRACK_GRID_SIZE,
    );
    runnerStateRef.current = {
      initialized: true,
      lastTimestamp: 0,
      trackXTargetIndex: RUNNER_DEFAULT_TRACK_INDEX,
      trackYTargetIndex: RUNNER_DEFAULT_TRACK_INDEX,
      trackXTarget: defaultTrackOffset,
      trackYTarget: defaultTrackOffset,
      trackXFloat: defaultTrackOffset,
      trackYFloat: defaultTrackOffset,
      trackSpacing: 0,
      runnerY: 0,
      runnerVy: 0,
      distance: 0,
      coinsCollected: 0,
      coins: createRunnerCoins(),
    };
    runnerHudLastUpdateRef.current = 0;
    setRunnerHud({
      coins: 0,
      distance: 0,
      trackCol: RUNNER_DEFAULT_TRACK_INDEX + 1,
      trackRow: RUNNER_DEFAULT_TRACK_INDEX + 1,
      trackSpacingPx: 0,
      jumping: false,
      jumpHeight: 0,
    });
    runnerGeometryLogKeyRef.current = "";
    setCalibrationMessage(
      "Runner mode active. Move hand to pick one of 4x4 converging tracks. Pinch to jump.",
    );
    appLog.info("Runner session reset", {
      reason,
      coinCount: runnerStateRef.current.coins.length,
    });
  }

  function startRunnerSession() {
    appLog.info("Runner session start requested", {
      hasTransform: Boolean(transformRef.current),
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_runner");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPhase(PHASES.RUNNER);
    phaseRef.current = PHASES.RUNNER;
    setCalibrationMessage(
      "Runner mode active. Move hand to pick one of 4x4 converging tracks. Pinch to jump.",
    );
    requestAnimationFrame(() => resetRunnerSession("start_runner"));
  }

  function returnFromRunnerSession() {
    appLog.info("Returning from runner mode to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function setRunnerTrackFromNormalized(normalizedX, normalizedY, hasHand, frameId) {
    if (phaseRef.current !== PHASES.RUNNER) {
      return;
    }
    if (!hasHand || !Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
      return;
    }

    const nextTrackXIndex = getRunnerTrackIndexFromNormalized(normalizedX, RUNNER_TRACK_GRID_SIZE);
    const nextTrackYIndex = getRunnerTrackIndexFromNormalized(normalizedY, RUNNER_TRACK_GRID_SIZE);
    const nextTrackX = getRunnerTrackOffsetFromIndex(nextTrackXIndex, RUNNER_TRACK_GRID_SIZE);
    const nextTrackY = getRunnerTrackOffsetFromIndex(nextTrackYIndex, RUNNER_TRACK_GRID_SIZE);
    const state = runnerStateRef.current;
    if (state.trackXTargetIndex !== nextTrackXIndex || state.trackYTargetIndex !== nextTrackYIndex) {
      state.trackXTargetIndex = nextTrackXIndex;
      state.trackYTargetIndex = nextTrackYIndex;
      state.trackXTarget = nextTrackX;
      state.trackYTarget = nextTrackY;
      appLog.info("Runner track target changed from normalized tracking point", {
        frameId,
        trackXIndex: nextTrackXIndex,
        trackYIndex: nextTrackYIndex,
        trackX: roundMetric(nextTrackX, 4),
        trackY: roundMetric(nextTrackY, 4),
        normalizedX: roundMetric(normalizedX, 4),
        normalizedY: roundMetric(normalizedY, 4),
      });
    }
  }

  function triggerRunnerJump(timestamp, source = "pinch") {
    if (phaseRef.current !== PHASES.RUNNER) {
      return;
    }
    const state = runnerStateRef.current;
    if (!state.initialized) {
      return;
    }
    if (!canRunnerStartJump(state.runnerY, state.runnerVy)) {
      appLog.debug("Runner jump ignored because player is already airborne", {
        source,
        runnerY: state.runnerY,
        runnerVy: state.runnerVy,
      });
      return;
    }
    state.runnerVy = RUNNER_JUMP_VELOCITY;
    appLog.info("Runner jump triggered", {
      timestamp,
      source,
      trackCol: state.trackXTargetIndex + 1,
      trackRow: state.trackYTargetIndex + 1,
      jumpVelocity: RUNNER_JUMP_VELOCITY,
    });
  }

  function drawRunnerScene() {
    const stage = runnerStageRef.current;
    const canvas = runnerCanvasRef.current;
    if (!stage || !canvas) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const state = runnerStateRef.current;
    const layout = computeRunnerTrackGridLayout(width, height, RUNNER_TRACK_GRID_SIZE);
    const {
      focalPoint,
      horizonY,
      groundY,
      trackSpacing,
      trackOffsets,
      fieldEdgeOffset,
      rowYs,
      columnXs,
    } = layout;
    state.trackSpacing = trackSpacing;

    const geometryLogKey = `${width}x${height}|s:${trackSpacing.toFixed(2)}|fx:${focalPoint.x.toFixed(
      2,
    )}|fy:${focalPoint.y.toFixed(2)}`;
    if (geometryLogKey !== runnerGeometryLogKeyRef.current) {
      runnerGeometryLogKeyRef.current = geometryLogKey;
      appLog.info("Runner geometry updated", {
        width,
        height,
        focalPoint,
        trackSpacing: roundMetric(trackSpacing, 3),
        rowYs: rowYs.map((value) => roundMetric(value, 2)),
        columnXs: columnXs.map((value) => roundMetric(value, 2)),
      });
    }

    const projectTrackPoint = (trackX, trackY, depthT) => {
      const nearX = focalPoint.x + trackX * trackSpacing;
      const nearY = focalPoint.y + trackY * trackSpacing;
      return {
        x: lerpValue(focalPoint.x, nearX, depthT),
        y: lerpValue(focalPoint.y, nearY, depthT),
      };
    };
    const depthFromZ = (z) => clampValue(1 - z / RUNNER_MAX_Z, 0, 1);

    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, "#1d2738");
    sky.addColorStop(1, "#2f4468");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizonY);

    const city = ctx.createLinearGradient(0, horizonY * 0.45, 0, horizonY + 40);
    city.addColorStop(0, "rgba(23, 33, 52, 0.18)");
    city.addColorStop(1, "rgba(14, 21, 34, 0.85)");
    ctx.fillStyle = city;
    ctx.fillRect(0, horizonY * 0.45, width, horizonY);

    const groundGradient = ctx.createLinearGradient(0, horizonY, 0, height);
    groundGradient.addColorStop(0, "#2a3950");
    groundGradient.addColorStop(1, "#172232");
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    const nearTopLeft = projectTrackPoint(-fieldEdgeOffset, -fieldEdgeOffset, 1);
    const nearTopRight = projectTrackPoint(fieldEdgeOffset, -fieldEdgeOffset, 1);
    const nearBottomRight = projectTrackPoint(fieldEdgeOffset, fieldEdgeOffset, 1);
    const nearBottomLeft = projectTrackPoint(-fieldEdgeOffset, fieldEdgeOffset, 1);
    ctx.fillStyle = "rgba(80, 120, 170, 0.15)";
    ctx.beginPath();
    ctx.moveTo(focalPoint.x, focalPoint.y);
    ctx.lineTo(nearTopRight.x, nearTopRight.y);
    ctx.lineTo(nearBottomRight.x, nearBottomRight.y);
    ctx.lineTo(nearBottomLeft.x, nearBottomLeft.y);
    ctx.lineTo(nearTopLeft.x, nearTopLeft.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(177, 212, 255, 0.24)";
    ctx.lineWidth = 1.6;
    for (const trackX of trackOffsets) {
      for (const trackY of trackOffsets) {
        const nearPoint = projectTrackPoint(trackX, trackY, 1);
        ctx.beginPath();
        ctx.moveTo(focalPoint.x, focalPoint.y);
        ctx.lineTo(nearPoint.x, nearPoint.y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(137, 193, 255, 0.36)";
    ctx.lineWidth = 1.2;
    for (const trackY of trackOffsets) {
      ctx.beginPath();
      for (let index = 0; index < trackOffsets.length; index += 1) {
        const trackX = trackOffsets[index];
        const nearPoint = projectTrackPoint(trackX, trackY, 1);
        if (index === 0) {
          ctx.moveTo(nearPoint.x, nearPoint.y);
        } else {
          ctx.lineTo(nearPoint.x, nearPoint.y);
        }
      }
      ctx.stroke();
    }
    for (const trackX of trackOffsets) {
      ctx.beginPath();
      for (let index = 0; index < trackOffsets.length; index += 1) {
        const trackY = trackOffsets[index];
        const nearPoint = projectTrackPoint(trackX, trackY, 1);
        if (index === 0) {
          ctx.moveTo(nearPoint.x, nearPoint.y);
        } else {
          ctx.lineTo(nearPoint.x, nearPoint.y);
        }
      }
      ctx.stroke();
    }

    for (const coin of state.coins) {
      const depthT = depthFromZ(coin.z);
      if (depthT <= 0) {
        continue;
      }
      const trackPoint = projectTrackPoint(coin.trackX, coin.trackY, depthT);
      const x = trackPoint.x;
      const y = trackPoint.y - coin.height * lerpValue(0.12, 0.66, depthT);
      const radius = lerpValue(4, 18, depthT);
      if (x < -60 || x > width + 60 || y < -60 || y > height + 60) {
        continue;
      }
      const glow = ctx.createRadialGradient(x, y, radius * 0.18, x, y, radius * 1.8);
      glow.addColorStop(0, "rgba(255, 250, 170, 0.95)");
      glow.addColorStop(1, "rgba(255, 204, 64, 0.06)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd95f";
      ctx.strokeStyle = "#f3a91f";
      ctx.lineWidth = Math.max(1, radius * 0.18);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const runnerTrackPoint = projectTrackPoint(state.trackXFloat, state.trackYFloat, 1);
    const runnerX = runnerTrackPoint.x;
    const runnerY = runnerTrackPoint.y - state.runnerY * 0.66;
    const bodyHeight = 74;
    const bodyWidth = 38;
    ctx.fillStyle = "#6ee7ff";
    ctx.fillRect(runnerX - bodyWidth * 0.14, runnerY - bodyHeight * 0.96, bodyWidth * 0.28, bodyHeight * 0.44);
    ctx.fillStyle = "#ffefe0";
    ctx.beginPath();
    ctx.arc(runnerX, runnerY - bodyHeight * 0.92, bodyWidth * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2cc4ff";
    ctx.fillRect(runnerX - bodyWidth * 0.38, runnerY - bodyHeight * 0.74, bodyWidth * 0.76, bodyHeight * 0.56);
    ctx.fillStyle = "#122741";
    ctx.fillRect(runnerX - bodyWidth * 0.34, runnerY - bodyHeight * 0.2, bodyWidth * 0.24, bodyHeight * 0.35);
    ctx.fillRect(runnerX + bodyWidth * 0.1, runnerY - bodyHeight * 0.2, bodyWidth * 0.24, bodyHeight * 0.35);
    ctx.strokeStyle = "rgba(161, 232, 255, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(runnerX - 8, runnerY + 6);
    ctx.lineTo(runnerX + 8, runnerY + 6);
    ctx.stroke();
  }

  function updateRunnerSimulation(timestamp) {
    if (phaseRef.current !== PHASES.RUNNER) {
      return;
    }
    const state = runnerStateRef.current;
    if (!state.initialized) {
      resetRunnerSession("auto_init");
      return;
    }

    const dtSeconds = clampValue(
      (timestamp - (state.lastTimestamp || timestamp)) / 1000,
      0.001,
      SANDBOX_MAX_STEP_SECONDS,
    );
    state.lastTimestamp = timestamp;
    state.distance += RUNNER_SPEED * dtSeconds;

    state.trackXFloat = lerpValue(state.trackXFloat, state.trackXTarget, RUNNER_LANE_SMOOTH_ALPHA);
    state.trackYFloat = lerpValue(state.trackYFloat, state.trackYTarget, RUNNER_LANE_SMOOTH_ALPHA);
    if (Math.abs(state.trackXFloat - state.trackXTarget) < 0.001) {
      state.trackXFloat = state.trackXTarget;
    }
    if (Math.abs(state.trackYFloat - state.trackYTarget) < 0.001) {
      state.trackYFloat = state.trackYTarget;
    }

    state.runnerVy -= RUNNER_GRAVITY * dtSeconds;
    state.runnerY += state.runnerVy * dtSeconds;
    if (state.runnerY < 0) {
      state.runnerY = 0;
      if (state.runnerVy < 0) {
        state.runnerVy = 0;
      }
    }
    if (state.runnerY > RUNNER_MAX_JUMP_HEIGHT) {
      state.runnerY = RUNNER_MAX_JUMP_HEIGHT;
      state.runnerVy = Math.min(0, state.runnerVy);
    }

    for (const coin of state.coins) {
      coin.z -= RUNNER_SPEED * dtSeconds;
      if (shouldCollectRunnerCoin(coin, state.trackXFloat, state.trackYFloat, state.runnerY)) {
        state.coinsCollected += coin.value ?? 1;
        appLog.info("Runner coin collected", {
          coinsCollected: state.coinsCollected,
          trackCol: state.trackXTargetIndex + 1,
          trackRow: state.trackYTargetIndex + 1,
          jumpHeight: roundMetric(state.runnerY, 2),
        });
        Object.assign(coin, createRunnerCoin());
      }

      if (coin.z < RUNNER_NEAR_Z - 80) {
        Object.assign(
          coin,
          createRunnerCoin(RUNNER_COIN_RESPAWN_MIN_Z, RUNNER_COIN_RESPAWN_MAX_Z),
        );
      }
    }

    drawRunnerScene();
    publishRunnerHud(timestamp);
  }

  function getHoveredInputTestCellIndex(pointerPoint) {
    if (!pointerPoint) {
      return -1;
    }
    for (let cellIndex = 0; cellIndex < INPUT_TEST_CELL_COUNT; cellIndex += 1) {
      const cellElement = inputTestCellRefs.current[cellIndex];
      const cellRect = cellElement?.getBoundingClientRect() ?? null;
      if (isPointInsideClientRect(pointerPoint, cellRect)) {
        return cellIndex;
      }
    }
    return -1;
  }

  function updateCalibrationInputTestHoverState(pointerPoint, hasHand, frameId) {
    if (
      phaseRef.current !== PHASES.CALIBRATION ||
      isCalibratingRef.current ||
      !hasHand ||
      !pointerPoint
    ) {
      if (inputTestHoveredCellRef.current !== -1) {
        inputTestHoveredCellRef.current = -1;
        setInputTestHoveredCell(-1);
      }
      return;
    }

    const hoveredCellIndex = getHoveredInputTestCellIndex(pointerPoint);
    if (inputTestHoveredCellRef.current !== hoveredCellIndex) {
      inputTestHoveredCellRef.current = hoveredCellIndex;
      setInputTestHoveredCell(hoveredCellIndex);
      appLog.info("Calibration grid hover cell changed", {
        frameId,
        hoveredCellIndex,
        pointerPoint,
      });
    }
  }

  function stopGameSession() {
    appLog.info("Stopping game session", {
      wasRunning: gameRunningRef.current,
      activeMole: activeMoleRef.current,
      score,
      timeLeft: timeLeftRef.current,
    });
    gameRunningRef.current = false;
    setGameRunning(false);
    activeMoleRef.current = null;
    setActiveMoleIndex(null);
    nextSpawnAtRef.current = Number.POSITIVE_INFINITY;
  }

  function startGameSession() {
    appLog.info("Starting game session requested", {
      hasTransform: Boolean(transformRef.current),
      currentPhase: phaseRef.current,
    });
    if (!transformRef.current) {
      setPhase(PHASES.CALIBRATION);
      phaseRef.current = PHASES.CALIBRATION;
      setCalibrationMessage("Calibration is required before starting the game.");
      appLog.warn("Cannot start game session without calibration transform");
      return;
    }

    const now = performance.now();

    setPhase(PHASES.GAME);
    phaseRef.current = PHASES.GAME;
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    resetArcCalibrationSession("start_game");
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setScore(0);
    setTimeLeft(Math.ceil(GAME_DURATION_MS / 1000));
    timeLeftRef.current = Math.ceil(GAME_DURATION_MS / 1000);
    setActiveMoleIndex(null);
    activeMoleRef.current = null;
    lastHoleIndexRef.current = -1;

    gameStartTimeRef.current = now;
    nextSpawnAtRef.current = now + 350;
    gameRunningRef.current = true;
    setGameRunning(true);
    appLog.info("Game session started", {
      startAt: now,
      firstSpawnAt: nextSpawnAtRef.current,
      durationMs: GAME_DURATION_MS,
    });
  }

  function beginCalibration() {
    appLog.info("Calibration start requested");
    stopGameSession();
    resetArcCalibrationSession("begin_standard_calibration");

    const targets = createCalibrationTargets(viewportRef.current.width, viewportRef.current.height);
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationTargets(targets);
    calibrationTargetsRef.current = targets;
    calibrationPairsRef.current = [];
    calibrationSampleRef.current = null;
    calibrationIndexRef.current = 0;
    setCalibrationTargetIndex(0);
    setCalibrationPairsCount(0);
    setCalibrationSampleFrames(0);
    setCalibrationMessage(`Target 1/${targets.length}: point and pinch to confirm.`);
    setIsCalibrating(true);
    isCalibratingRef.current = true;
    appLog.info("Calibration session started", {
      targetCount: targets.length,
      viewport: viewportRef.current,
    });
  }

  function beginArcCalibration() {
    appLog.info("Lazy-arc calibration start requested");
    stopGameSession();
    resetArcCalibrationSession("begin_arc_calibration");
    resetCalibrationInputTests("begin_arc_calibration");

    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setCalibrationMessage(
      "Lazy arc capture started. Keep your elbow planted, sweep forearm in an arc, and move wrist/fingers up/down.",
    );

    setArcCalibrationProgress(0);
    setArcCalibrationSamples(0);
    setIsArcCalibrating(true);
    isArcCalibratingRef.current = true;
    appLog.info("Lazy-arc calibration session initialized", {
      confidenceTarget: ARC_CALIBRATION_READY_CONFIDENCE,
      maxCaptureFrames: ARC_CALIBRATION_MAX_CAPTURE_FRAMES,
    });
  }

  function finalizeArcCalibration(reason, timestamp) {
    const captured = arcCalibrationSamplesRef.current;
    const evaluation = evaluateArcCaptureConfidence(captured);
    resetArcCalibrationSession(`finalize_${reason}`);

    if (!evaluation.ready) {
      const confidencePercent = Math.round(evaluation.confidence * 100);
      setCalibrationMessage(
        `Lazy arc capture incomplete (${confidencePercent}% confidence). Keep elbow fixed, sweep wider, and move all fingers up/down, then retry.`,
      );
      appLog.warn("Lazy-arc calibration ended before reaching confidence target", {
        reason,
        sampleCount: captured?.length ?? 0,
        confidence: evaluation.confidence,
        metrics: evaluation.metrics,
        confidenceTarget: ARC_CALIBRATION_READY_CONFIDENCE,
        timestamp,
      });
      return;
    }

    const solved = solveArcCalibrationFromSamples(captured);
    if (!solved) {
      setCalibrationMessage(
        "Lazy arc calibration failed to solve. Try a wider arc plus more wrist up/down movement.",
      );
      appLog.error("Lazy-arc calibration solve returned null", {
        reason,
        sampleCount: captured.length,
        metrics: evaluation.metrics,
      });
      return;
    }

    setTransform(solved);
    transformRef.current = solved;
    saveCalibration(solved);
    setHasSavedCalibration(true);
    setCalibrationMessage("Lazy arc calibration complete. Launching runner mode.");
    appLog.info("Lazy-arc calibration solved successfully", {
      reason,
      sampleCount: captured.length,
      model: solved,
    });
    startRunnerSession();
  }

  function finalizeCalibrationSample() {
    appLog.debug("Finalizing calibration sample");
    const sample = calibrationSampleRef.current;
    if (!sample) {
      appLog.warn("No calibration sample found to finalize");
      return;
    }

    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);

    if (sample.points.length < Math.floor(CALIBRATION_SAMPLE_FRAMES * 0.6)) {
      appLog.warn("Calibration sample rejected due to too few points", {
        sampleCount: sample.points.length,
      });
      setCalibrationMessage("Sample lost. Keep your hand visible and pinch again.");
      return;
    }

    const average = sample.points.reduce(
      (acc, point) => {
        acc.u += point.u;
        acc.v += point.v;
        return acc;
      },
      { u: 0, v: 0 },
    );
    average.u /= sample.points.length;
    average.v /= sample.points.length;

    const target = calibrationTargetsRef.current[sample.targetIndex];
    if (!target) {
      appLog.error("Calibration target missing during sample finalization", {
        targetIndex: sample.targetIndex,
      });
      setCalibrationMessage("Calibration target was not found. Restart calibration.");
      return;
    }

    const nextPairs = [
      ...calibrationPairsRef.current,
      {
        cam: average,
        screen: { x: target.x, y: target.y },
      },
    ];

    calibrationPairsRef.current = nextPairs;
    setCalibrationPairsCount(nextPairs.length);
    appLog.info("Stored calibration sample pair", {
      targetIndex: sample.targetIndex,
      nextPairCount: nextPairs.length,
      average,
      target,
    });

    const nextIndex = sample.targetIndex + 1;
    if (nextIndex >= calibrationTargetsRef.current.length) {
      const solved = solveAffineFromPairs(nextPairs);
      if (!solved) {
        appLog.error("Calibration solve failed after collecting all points", {
          pairCount: nextPairs.length,
        });
        setCalibrationMessage(
          "Calibration failed (matrix inversion error). Please restart calibration.",
        );
        setIsCalibrating(false);
        isCalibratingRef.current = false;
        return;
      }

      setTransform(solved);
      transformRef.current = solved;
      saveCalibration(solved);
      setHasSavedCalibration(true);
      setIsCalibrating(false);
      isCalibratingRef.current = false;
      setCalibrationMessage("Calibration complete. Launching runner mode.");
      appLog.info("Calibration solved successfully", {
        transform: solved,
      });
      startRunnerSession();
      return;
    }

    calibrationIndexRef.current = nextIndex;
    setCalibrationTargetIndex(nextIndex);
    setCalibrationMessage(
      `Target ${nextIndex + 1}/${calibrationTargetsRef.current.length}: pinch to confirm.`,
    );
    appLog.debug("Advancing to next calibration target", {
      nextIndex,
      remaining: calibrationTargetsRef.current.length - nextIndex,
    });
  }

  function handleRecalibrate() {
    appLog.info("Recalibrate requested");
    clearCalibration();
    setTransform(null);
    transformRef.current = null;
    setHasSavedCalibration(false);
    resetCalibrationInputTests("recalibrate");
    setCalibrationMessage("Calibration cleared. Run calibration again.");
    beginCalibration();
  }

  function handlePinchClick(timestamp) {
    appLog.debug("Pinch click detected", {
      timestamp,
      isCalibrating: isCalibratingRef.current,
      isArcCalibrating: isArcCalibratingRef.current,
      phase: phaseRef.current,
      gameRunning: gameRunningRef.current,
    });
    if (isArcCalibratingRef.current) {
      appLog.debug("Pinch click ignored because lazy-arc calibration is active");
      return;
    }

    if (isCalibratingRef.current) {
      if (!handDetectedRef.current) {
        appLog.warn("Pinch click ignored during calibration because hand is missing");
        setCalibrationMessage("Hand not detected. Keep your hand in view and try again.");
        return;
      }

      if (calibrationSampleRef.current) {
        appLog.debug("Pinch click ignored because calibration sampling is already in progress");
        return;
      }

      calibrationSampleRef.current = {
        targetIndex: calibrationIndexRef.current,
        points: [],
      };
      setCalibrationSampleFrames(0);
      setCalibrationMessage("Sampling fingertip position...");
      appLog.info("Calibration sampling started for target", {
        targetIndex: calibrationIndexRef.current,
        sampleFrames: CALIBRATION_SAMPLE_FRAMES,
      });
      return;
    }

    if (phaseRef.current === PHASES.RUNNER) {
      triggerRunnerJump(timestamp, "pinch_click");
      return;
    }

    if (phaseRef.current !== PHASES.GAME || !gameRunningRef.current) {
      appLog.debug("Pinch click ignored because game is not actively running");
      return;
    }

    const activeMole = activeMoleRef.current;
    if (!activeMole) {
      appLog.debug("Pinch click ignored because there is no active mole");
      return;
    }

    const hitZone = hitZonesRef.current[activeMole.holeIndex];
    if (!hitZone) {
      appLog.warn("Pinch click ignored because hit zone was not found", {
        activeMole,
      });
      return;
    }

    if (isPointInCircle(cursorRef.current, hitZone)) {
      appLog.info("Mole hit registered", {
        holeIndex: activeMole.holeIndex,
        cursor: cursorRef.current,
        hitZone,
      });
      activeMoleRef.current = null;
      setActiveMoleIndex(null);
      setScore((value) => value + 1);
      nextSpawnAtRef.current = timestamp + 100;
    } else {
      appLog.debug("Pinch click missed active mole", {
        holeIndex: activeMole.holeIndex,
        cursor: cursorRef.current,
        hitZone,
      });
    }
  }

  function updateGame(timestamp) {
    if (!gameRunningRef.current) {
      return;
    }

    const elapsed = timestamp - gameStartTimeRef.current;
    const remainingMs = GAME_DURATION_MS - elapsed;
    const nextTimeLeft = Math.max(0, Math.ceil(remainingMs / 1000));

    if (nextTimeLeft !== timeLeftRef.current) {
      timeLeftRef.current = nextTimeLeft;
      setTimeLeft(nextTimeLeft);
      appLog.debug("Game timer tick", {
        timestamp,
        remainingMs,
        nextTimeLeft,
      });
    }

    if (remainingMs <= 0) {
      appLog.info("Game timer expired");
      stopGameSession();
      return;
    }

    if (activeMoleRef.current && timestamp >= activeMoleRef.current.expiresAt) {
      appLog.debug("Active mole expired", {
        activeMole: activeMoleRef.current,
        timestamp,
      });
      activeMoleRef.current = null;
      setActiveMoleIndex(null);
    }

    if (!activeMoleRef.current && timestamp >= nextSpawnAtRef.current) {
      const count = holesRef.current.length;
      if (count > 0) {
        const nextIndex = pickRandomHole(count, lastHoleIndexRef.current);
        if (nextIndex >= 0) {
          lastHoleIndexRef.current = nextIndex;
          activeMoleRef.current = {
            holeIndex: nextIndex,
            expiresAt: timestamp + MOLE_VISIBLE_MS,
          };
          setActiveMoleIndex(nextIndex);
          appLog.info("Spawned new mole", {
            holeIndex: nextIndex,
            expiresAt: timestamp + MOLE_VISIBLE_MS,
          });
        }
      }
      nextSpawnAtRef.current = timestamp + randomSpawnDelay();
      appLog.debug("Scheduled next mole spawn", {
        nextSpawnAt: nextSpawnAtRef.current,
      });
    }
  }

  function computeCameraCoverMetrics() {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight || !canvas.width || !canvas.height) {
      return null;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    const offsetX = (canvasWidth - renderedWidth) / 2;
    const offsetY = (canvasHeight - renderedHeight) / 2;

    // Convert from rendered-canvas crop back to source-video visible window.
    const sourceX = clampValue(-offsetX / scale, 0, videoWidth);
    const sourceY = clampValue(-offsetY / scale, 0, videoHeight);
    const sourceWidth = clampValue(canvasWidth / scale, 0, videoWidth);
    const sourceHeight = clampValue(canvasHeight / scale, 0, videoHeight);

    const sourceNormalized = {
      xMin: sourceX / videoWidth,
      xMax: (sourceX + sourceWidth) / videoWidth,
      yMin: sourceY / videoHeight,
      yMax: (sourceY + sourceHeight) / videoHeight,
    };

    // Tracking points are mirrored, so convert source-x bounds into mirrored-u bounds.
    const mirroredNormalized = {
      uMin: 1 - sourceNormalized.xMax,
      uMax: 1 - sourceNormalized.xMin,
      vMin: sourceNormalized.yMin,
      vMax: sourceNormalized.yMax,
    };

    return {
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
      },
      video: {
        width: videoWidth,
        height: videoHeight,
      },
      render: {
        scale,
        renderedWidth,
        renderedHeight,
        offsetX,
        offsetY,
      },
      visibleSourcePixels: {
        x: sourceX,
        y: sourceY,
        width: sourceWidth,
        height: sourceHeight,
      },
      sourceNormalized,
      mirroredNormalized,
    };
  }

  function logTrackingExtentsSnapshot(reason) {
    const extentState = trackingExtentsRef.current;
    const coverMetrics = computeCameraCoverMetrics();
    const canvasWidth = coverMetrics?.canvas.width ?? 0;
    const canvasHeight = coverMetrics?.canvas.height ?? 0;

    const fingerExtents = EXTENT_FINGER_NAMES.reduce((accumulator, fingerName) => {
      accumulator[fingerName] = summarizeFingerExtentStats(
        extentState.fingers[fingerName],
        canvasWidth,
        canvasHeight,
      );
      return accumulator;
    }, {});

    const visibleMirroredBounds = coverMetrics
      ? {
          uMin: roundMetric(coverMetrics.mirroredNormalized.uMin),
          uMax: roundMetric(coverMetrics.mirroredNormalized.uMax),
          vMin: roundMetric(coverMetrics.mirroredNormalized.vMin),
          vMax: roundMetric(coverMetrics.mirroredNormalized.vMax),
          uSpan: roundMetric(
            coverMetrics.mirroredNormalized.uMax - coverMetrics.mirroredNormalized.uMin,
          ),
          vSpan: roundMetric(
            coverMetrics.mirroredNormalized.vMax - coverMetrics.mirroredNormalized.vMin,
          ),
        }
      : null;

    appLog.info("Tracking extent snapshot", {
      reason,
      sampleFrames: extentState.sampleFrames,
      lastFrameId: extentState.lastFrameId,
      lastTimestamp: roundMetric(extentState.lastTimestamp, 1),
      overall: {
        raw: summarizeExtentForLog(extentState.rawOverall, canvasWidth, canvasHeight),
        clamped: summarizeExtentForLog(extentState.clampedOverall, canvasWidth, canvasHeight),
        visibleNormalized: summarizeExtentForLog(
          extentState.visibleOverall,
          canvasWidth,
          canvasHeight,
        ),
      },
      totals: {
        tipSamples: extentState.totalTipSamples,
        clampedSamples: extentState.clampedTipSamples,
        clampedRatio: roundMetric(
          safeRatio(extentState.clampedTipSamples, extentState.totalTipSamples),
          6,
        ),
        outsideVisibleSamples: extentState.outsideVisibleTipSamples,
        outsideVisibleRatio: roundMetric(
          safeRatio(extentState.outsideVisibleTipSamples, extentState.totalTipSamples),
          6,
        ),
      },
      fingerExtents,
      visibleMirroredBounds,
      lastVisibleBounds:
        extentState.lastVisibleBounds && Number.isFinite(extentState.lastVisibleBounds.uMin)
          ? {
              uMin: roundMetric(extentState.lastVisibleBounds.uMin),
              uMax: roundMetric(extentState.lastVisibleBounds.uMax),
              vMin: roundMetric(extentState.lastVisibleBounds.vMin),
              vMax: roundMetric(extentState.lastVisibleBounds.vMax),
            }
          : null,
      cameraCoverMetrics: coverMetrics
        ? {
            canvas: coverMetrics.canvas,
            video: coverMetrics.video,
            render: {
              scale: roundMetric(coverMetrics.render.scale, 5),
              renderedWidth: roundMetric(coverMetrics.render.renderedWidth, 2),
              renderedHeight: roundMetric(coverMetrics.render.renderedHeight, 2),
              offsetX: roundMetric(coverMetrics.render.offsetX, 2),
              offsetY: roundMetric(coverMetrics.render.offsetY, 2),
            },
            visibleSourcePixels: {
              x: roundMetric(coverMetrics.visibleSourcePixels.x, 2),
              y: roundMetric(coverMetrics.visibleSourcePixels.y, 2),
              width: roundMetric(coverMetrics.visibleSourcePixels.width, 2),
              height: roundMetric(coverMetrics.visibleSourcePixels.height, 2),
            },
          }
        : null,
    });
  }

  function updateTrackingExtentsWithHand(hand, frameId, timestamp, visibleBounds) {
    if (!hand) {
      return;
    }

    const extentState = trackingExtentsRef.current;
    extentState.lastVisibleBounds = visibleBounds
      ? {
          uMin: visibleBounds.uMin,
          uMax: visibleBounds.uMax,
          vMin: visibleBounds.vMin,
          vMax: visibleBounds.vMax,
        }
      : null;
    const tips = hand.fingerTips ?? {
      thumb: hand.thumbTip ?? null,
      index: hand.indexTip ?? null,
      middle: null,
      ring: null,
      pinky: null,
    };

    let updatedAny = false;
    for (const fingerName of EXTENT_FINGER_NAMES) {
      const tip = tips[fingerName];
      if (!tip || !Number.isFinite(tip.u) || !Number.isFinite(tip.v)) {
        continue;
      }

      const uClamped = tip.u;
      const vClamped = tip.v;
      const uRaw = Number.isFinite(tip.uRaw) ? tip.uRaw : uClamped;
      const vRaw = Number.isFinite(tip.vRaw) ? tip.vRaw : vClamped;
      const wasClamped = Boolean(
        tip.wasClamped || uRaw !== uClamped || vRaw !== vClamped,
      );

      const fingerStats = extentState.fingers[fingerName];
      if (fingerStats.totalSamples === 0) {
        appLog.info("First fingertip sample captured for extent tracking", {
          fingerName,
          frameId,
          uRaw,
          vRaw,
          uClamped,
          vClamped,
          wasClamped,
        });
      }

      fingerStats.totalSamples += 1;
      extentState.totalTipSamples += 1;

      const updatedRaw = updateExtentAccumulator(fingerStats.raw, uRaw, vRaw);
      const updatedClamped = updateExtentAccumulator(fingerStats.clamped, uClamped, vClamped);
      if (updatedRaw) {
        updateExtentAccumulator(extentState.rawOverall, uRaw, vRaw);
      }
      if (updatedClamped) {
        updateExtentAccumulator(extentState.clampedOverall, uClamped, vClamped);
      }

      if (wasClamped) {
        fingerStats.clampedSamples += 1;
        extentState.clampedTipSamples += 1;
      }

      const visibleTip = normalizeTipToVisibleBounds(uRaw, vRaw, visibleBounds);
      if (visibleTip) {
        updateExtentAccumulator(fingerStats.visible, visibleTip.u, visibleTip.v);
        updateExtentAccumulator(extentState.visibleOverall, visibleTip.u, visibleTip.v);
        if (!visibleTip.inBounds) {
          fingerStats.outsideVisibleCount += 1;
          extentState.outsideVisibleTipSamples += 1;
        }
      }

      updatedAny = true;
    }

    if (!updatedAny) {
      return;
    }

    extentState.sampleFrames += 1;
    extentState.lastFrameId = frameId;
    extentState.lastTimestamp = timestamp;
    if (extentState.sampleFrames % EXTENT_LOG_SAMPLE_INTERVAL === 0) {
      logTrackingExtentsSnapshot("periodic_extent_samples");
    }
  }

  function drawCameraOverlay(hand) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      appLog.debug("Skipped drawing overlay because canvas ref is missing");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      appLog.warn("Skipped drawing overlay because 2d context is unavailable");
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hand?.fingerTips) {
      for (const [fingerName, style] of Object.entries(FINGERTIP_OVERLAY_STYLES)) {
        const tip = hand.fingerTips[fingerName];
        if (!tip) {
          continue;
        }
        const x = tip.u * canvas.width;
        const y = tip.v * canvas.height;

        ctx.fillStyle = style.fill;
        ctx.beginPath();
        ctx.arc(x, y, style.radius, 0, Math.PI * 2);
        ctx.fill();

        if (fingerName === "thumb") {
          ctx.strokeStyle = "rgba(12, 16, 20, 0.75)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(x, y, style.radius + 1.8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (hand?.thumbTip) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(hand.thumbTip.u * canvas.width, hand.thumbTip.v * canvas.height, 6.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (debugRef.current && hand?.landmarks) {
      ctx.fillStyle = "rgba(111, 245, 164, 0.9)";
      for (const point of hand.landmarks) {
        ctx.beginPath();
        ctx.arc(point.u * canvas.width, point.v * canvas.height, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(12, 16, 20, 0.72)";
      ctx.fillRect(10, 10, 190, 64);
      ctx.fillStyle = "#f2f6fb";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`hand: ${hand ? "yes" : "no"}`, 18, 30);
      ctx.fillText(`pinch: ${pinchStateRef.current ? "on" : "off"}`, 18, 47);
      ctx.fillText(`fps: ${fpsRef.current.toFixed(1)}`, 18, 64);
    }
  }

  function processTrackingFrame(hand, timestamp) {
    frameCounterRef.current += 1;
    const frameId = frameCounterRef.current;

    if (lastFrameTimeRef.current > 0) {
      const delta = timestamp - lastFrameTimeRef.current;
      if (delta > 0) {
        const instantaneous = 1000 / delta;
        fpsRef.current =
          fpsRef.current === 0 ? instantaneous : fpsRef.current * 0.86 + instantaneous * 0.14;
        setFps(fpsRef.current);
      }
    }
    lastFrameTimeRef.current = timestamp;

    appLog.debug("Processing tracking frame", {
      frameId,
      timestamp,
      hasHand: Boolean(hand),
      phase: phaseRef.current,
      isCalibrating: isCalibratingRef.current,
      fps: fpsRef.current,
      pinchDistance: hand?.pinchDistance ?? null,
    });

    if (!hand) {
      const millisSinceLastValidHand =
        lastValidHandTimestampRef.current > 0
          ? timestamp - lastValidHandTimestampRef.current
          : Number.POSITIVE_INFINITY;
      const withinGraceWindow = millisSinceLastValidHand <= HAND_DETECTION_GRACE_MS;

      if (withinGraceWindow) {
        handGraceFrameCounterRef.current += 1;
        if (handGraceFrameCounterRef.current === 1 || handGraceFrameCounterRef.current % 30 === 0) {
          appLog.debug("Holding hand-detected state during brief no-hand gap", {
            frameId,
            graceFrames: handGraceFrameCounterRef.current,
            millisSinceLastValidHand,
          });
        }
        drawCameraOverlay(null);
        updateFlightControlFromTips(null, timestamp, frameId);
        updateSandboxPhysics(timestamp, cursorRef.current, false, false);
        updateFlightSimulation(timestamp);
        updateRunnerSimulation(timestamp);
        updateGame(timestamp);
        return;
      }

      handGraceFrameCounterRef.current = 0;
      if (isCalibratingRef.current && calibrationSampleRef.current) {
        calibrationSampleRef.current = null;
        setCalibrationSampleFrames(0);
        setCalibrationMessage("Hand lost while sampling. Pinch again on this target.");
        appLog.warn("Calibration sampling aborted because hand disappeared", {
          frameId,
        });
      }
      if (handDetectedRef.current) {
        logTrackingExtentsSnapshot("hand_detection_lost");
        handDetectedRef.current = false;
        setHandDetected(false);
        appLog.debug("Hand detection flag switched to false", { frameId });
      }
      if (pinchStateRef.current) {
        pinchStateRef.current = false;
        setPinchActive(false);
        appLog.debug("Pinch state reset because hand is missing", { frameId });
      }
      if (isArcCalibratingRef.current && frameId % 20 === 0) {
        setCalibrationMessage(
          "Lazy arc capture paused: all five fingertips are not visible. Return your hand to continue capture.",
        );
      }
      updateCalibrationInputTestHoverState(cursorRef.current, false, frameId);
      drawCameraOverlay(null);
      updateFlightControlFromTips(null, timestamp, frameId);
      updateSandboxPhysics(timestamp, cursorRef.current, false, false);
      updateFlightSimulation(timestamp);
      updateRunnerSimulation(timestamp);
      updateGame(timestamp);
      return;
    }

    if (!handDetectedRef.current) {
      handDetectedRef.current = true;
      setHandDetected(true);
      appLog.debug("Hand detection flag switched to true", { frameId });
    }
    lastValidHandTimestampRef.current = timestamp;
    handGraceFrameCounterRef.current = 0;

    const coverMetrics = computeCameraCoverMetrics();
    const visibleBounds = coverMetrics?.mirroredNormalized ?? null;
    const thumbTipRawU = Number.isFinite(hand.thumbTip?.uRaw) ? hand.thumbTip.uRaw : hand.thumbTip.u;
    const thumbTipRawV = Number.isFinite(hand.thumbTip?.vRaw) ? hand.thumbTip.vRaw : hand.thumbTip.v;
    const visibleThumbTip = normalizeTipToVisibleBounds(thumbTipRawU, thumbTipRawV, visibleBounds);
    const mappedFingerTips = {};
    for (const fingerName of EXTENT_FINGER_NAMES) {
      const tip = hand.fingerTips?.[fingerName];
      if (!tip || !Number.isFinite(tip.u) || !Number.isFinite(tip.v)) {
        mappedFingerTips[fingerName] = null;
        continue;
      }
      const tipRawU = Number.isFinite(tip.uRaw) ? tip.uRaw : tip.u;
      const tipRawV = Number.isFinite(tip.vRaw) ? tip.vRaw : tip.v;
      const normalizedTip = normalizeTipToVisibleBounds(tipRawU, tipRawV, visibleBounds);
      mappedFingerTips[fingerName] = normalizedTip
        ? { u: normalizedTip.u, v: normalizedTip.v }
        : { u: tip.u, v: tip.v };
    }
    const mappedThumbTip =
      mappedFingerTips.thumb && Number.isFinite(mappedFingerTips.thumb.u) && Number.isFinite(mappedFingerTips.thumb.v)
        ? mappedFingerTips.thumb
        : visibleThumbTip
          ? { u: visibleThumbTip.u, v: visibleThumbTip.v }
          : { u: hand.thumbTip.u, v: hand.thumbTip.v };
    const mappedPointerTip = mappedThumbTip;
    updateTrackingExtentsWithHand(hand, frameId, timestamp, visibleBounds);
    updateFlightControlFromTips(mappedFingerTips, timestamp, frameId);

    if (isArcCalibratingRef.current) {
      if (arcCalibrationStartRef.current === 0) {
        arcCalibrationStartRef.current = timestamp;
        appLog.info("Lazy-arc calibration capture timing started", {
          frameId,
          timestamp,
        });
      }

      const capturedFrames = arcCalibrationSamplesRef.current;
      if (capturedFrames.length < ARC_CALIBRATION_MAX_CAPTURE_FRAMES) {
        capturedFrames.push({
          frameId,
          timestamp,
          tips: mappedFingerTips,
        });
      }

      const evaluation = evaluateArcCaptureConfidence(capturedFrames);
      if (frameId % 2 === 0 || evaluation.ready) {
        setArcCalibrationProgress(evaluation.confidence);
        setArcCalibrationSamples(evaluation.metrics.validFrameCount);
      }
      if (frameId % 18 === 0) {
        const confidencePercent = Math.round(evaluation.confidence * 100);
        const fingerSummary = EXTENT_FINGER_NAMES.map((fingerName) => {
          const metric = evaluation.metrics.fingerMetrics?.[fingerName];
          return metric && metric.ready ? fingerName[0].toUpperCase() : "_";
        }).join("");
        setCalibrationMessage(
          `Lazy arc confidence: ${confidencePercent}% (${evaluation.metrics.validFrameCount} valid frames). Keep elbow fixed and sweep back/forth + up/down. [${fingerSummary}]`,
        );
      }

      if (evaluation.ready) {
        finalizeArcCalibration("confidence_target_reached", timestamp);
      } else if (capturedFrames.length >= ARC_CALIBRATION_MAX_CAPTURE_FRAMES) {
        finalizeArcCalibration("capture_frame_limit_reached", timestamp);
      }
    }

    const shouldUseTransform =
      Boolean(transformRef.current) &&
      !isCalibratingRef.current &&
      !isArcCalibratingRef.current;
    let mappedPoint = {
      x: mappedPointerTip.u * viewportRef.current.width,
      y: mappedPointerTip.v * viewportRef.current.height,
    };
    let transformMode = "none";
    let arcMappedPoint = null;
    if (shouldUseTransform) {
      if (isArcCalibrationModel(transformRef.current)) {
        arcMappedPoint = applyArcCalibration(
          transformRef.current,
          mappedPointerTip.u,
          mappedPointerTip.v,
        );
        if (arcMappedPoint) {
          mappedPoint = {
            x: arcMappedPoint.u * viewportRef.current.width,
            y: arcMappedPoint.v * viewportRef.current.height,
          };
          transformMode = "arc";
        } else {
          transformMode = "arc_fallback_identity";
        }
      } else {
        mappedPoint = applyAffineTransform(
          transformRef.current,
          mappedPointerTip.u,
          mappedPointerTip.v,
        );
        transformMode = "affine";
      }
    }

    const rawPoint = clampPoint(mappedPoint, viewportRef.current.width, viewportRef.current.height);
    rawCursorRef.current = rawPoint;
    setRawCursor(rawPoint);

    const prev = cursorRef.current;
    const smoothed = clampPoint(
      {
        x: CURSOR_ALPHA * rawPoint.x + (1 - CURSOR_ALPHA) * prev.x,
        y: CURSOR_ALPHA * rawPoint.y + (1 - CURSOR_ALPHA) * prev.y,
      },
      viewportRef.current.width,
      viewportRef.current.height,
    );
    cursorRef.current = smoothed;
    setCursor(smoothed);
    updateCalibrationInputTestHoverState(smoothed, true, frameId);
    setRunnerTrackFromNormalized(mappedPointerTip.u, mappedPointerTip.v, true, frameId);

    appLog.debug("Updated raw and smoothed cursor", {
      frameId,
      rawPoint,
      previous: prev,
      smoothed,
      usedTransform: shouldUseTransform,
      transformMode,
      pointerTip: {
        source: "thumb",
        uRaw: roundMetric(thumbTipRawU),
        vRaw: roundMetric(thumbTipRawV),
        uClamped: roundMetric(hand.thumbTip.u),
        vClamped: roundMetric(hand.thumbTip.v),
      },
      mappedPointerTip,
      arcMappedPoint,
      visiblePointerTip: visibleThumbTip,
      visibleBounds: visibleBounds
        ? {
            uMin: roundMetric(visibleBounds.uMin),
            uMax: roundMetric(visibleBounds.uMax),
            vMin: roundMetric(visibleBounds.vMin),
            vMax: roundMetric(visibleBounds.vMax),
          }
        : null,
    });

    if (isCalibratingRef.current && calibrationSampleRef.current) {
      calibrationSampleRef.current.points.push({ u: mappedPointerTip.u, v: mappedPointerTip.v });
      setCalibrationSampleFrames(calibrationSampleRef.current.points.length);
      appLog.debug("Captured calibration sample frame", {
        frameId,
        targetIndex: calibrationSampleRef.current.targetIndex,
        sampleCount: calibrationSampleRef.current.points.length,
        mappedPointerTip,
        visiblePointerTip: visibleThumbTip,
      });
      if (calibrationSampleRef.current.points.length >= CALIBRATION_SAMPLE_FRAMES) {
        finalizeCalibrationSample();
      }
    }

    let nextPinch = pinchStateRef.current;
    if (!nextPinch && hand.pinchDistance < PINCH_START_THRESHOLD) {
      nextPinch = true;
    } else if (nextPinch && hand.pinchDistance > PINCH_END_THRESHOLD) {
      nextPinch = false;
    }

    if (nextPinch !== pinchStateRef.current) {
      const wasPinching = pinchStateRef.current;
      pinchStateRef.current = nextPinch;
      setPinchActive(nextPinch);
      appLog.info("Pinch state transition", {
        frameId,
        wasPinching,
        nowPinching: nextPinch,
        pinchDistance: hand.pinchDistance,
      });

      if (
        phaseRef.current === PHASES.CALIBRATION &&
        !isCalibratingRef.current &&
        nextPinch &&
        inputTestHoveredCellRef.current >= 0
      ) {
        appLog.info("Calibration grid pinch-active over hovered cell", {
          frameId,
          hoveredCellIndex: inputTestHoveredCellRef.current,
        });
      }

      if (
        !wasPinching &&
        nextPinch &&
        timestamp - lastPinchClickRef.current >= PINCH_DEBOUNCE_MS
      ) {
        lastPinchClickRef.current = timestamp;
        appLog.info("Pinch click accepted after debounce", {
          frameId,
          timestamp,
          debounceMs: PINCH_DEBOUNCE_MS,
        });
        handlePinchClick(timestamp);
      } else if (!wasPinching && nextPinch) {
        appLog.debug("Pinch click suppressed by debounce", {
          frameId,
          timestamp,
          lastPinchClickAt: lastPinchClickRef.current,
        });
      }
    }

    updateSandboxPhysics(timestamp, smoothed, true, pinchStateRef.current);
    drawCameraOverlay(hand);
    updateFlightSimulation(timestamp);
    updateRunnerSimulation(timestamp);
    updateGame(timestamp);
  }

  useEffect(() => {
    if (!cameraReady || !modelReady) {
      appLog.debug("Tracking loop not started because prerequisites are not ready", {
        cameraReady,
        modelReady,
      });
      return undefined;
    }

    let cancelled = false;
    appLog.info("Starting tracking frame loop");

    const frameLoop = async (timestamp) => {
      if (cancelled || !mountedRef.current) {
        appLog.debug("Frame loop callback aborted due to cancellation/unmount", {
          cancelled,
          mounted: mountedRef.current,
        });
        return;
      }

      rafRef.current = requestAnimationFrame(frameLoop);

      if (inferenceBusyRef.current) {
        inferenceBusySkipCounterRef.current += 1;
        if (inferenceBusySkipCounterRef.current % 30 === 0) {
          appLog.debug("Skipping frame because previous inference is still running", {
            skipCount: inferenceBusySkipCounterRef.current,
            timestamp,
          });
        }
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        updateFlightSimulation(timestamp);
        updateRunnerSimulation(timestamp);
        updateGame(timestamp);
        return;
      }
      inferenceBusySkipCounterRef.current = 0;

      if (recoveringDetectorRef.current) {
        recoveryFrameSkipCounterRef.current += 1;
        if (recoveryFrameSkipCounterRef.current % 30 === 0) {
          appLog.debug("Skipping frame because detector recovery is in progress", {
            skipCount: recoveryFrameSkipCounterRef.current,
          });
        }
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        updateFlightSimulation(timestamp);
        updateRunnerSimulation(timestamp);
        updateGame(timestamp);
        return;
      }
      recoveryFrameSkipCounterRef.current = 0;

      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) {
        appLog.debug("Skipping frame due to missing detector/video readiness", {
          hasDetector: Boolean(detector),
          hasVideo: Boolean(video),
          readyState: video?.readyState ?? null,
        });
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        updateFlightSimulation(timestamp);
        updateRunnerSimulation(timestamp);
        updateGame(timestamp);
        return;
      }

      inferenceBusyRef.current = true;
      try {
        const hand = await detectPrimaryHand(detector, video);
        const detectionMeta = getLastDetectionMeta();

        if (detectionMeta.invalid) {
          invalidLandmarkStreakRef.current += 1;
          if (
            invalidLandmarkStreakRef.current <= 5 ||
            invalidLandmarkStreakRef.current % 30 === 0
          ) {
            appLog.warn("Invalid landmark frame detected", {
              invalidLandmarkStreak: invalidLandmarkStreakRef.current,
              detectionMeta,
            });
          }

          const shouldRecover =
            invalidLandmarkStreakRef.current % INVALID_LANDMARK_RECOVERY_THRESHOLD === 0;

          if (shouldRecover && !recoveringDetectorRef.current) {
            void recoverDetectorFromInvalidLandmarks(
              "continuous_invalid_landmarks",
              detectionMeta,
            );
          }
        } else if (invalidLandmarkStreakRef.current > 0) {
          appLog.info("Invalid landmark streak ended", {
            invalidLandmarkStreak: invalidLandmarkStreakRef.current,
            detectionMeta,
          });
          invalidLandmarkStreakRef.current = 0;
        }

        const millisSinceLastValidHand =
          lastValidHandTimestampRef.current > 0
            ? timestamp - lastValidHandTimestampRef.current
            : Number.POSITIVE_INFINITY;
        const withinHandGraceWindow = millisSinceLastValidHand <= HAND_DETECTION_GRACE_MS;

        if (detectionMeta.reason === "no_hands" && !withinHandGraceWindow) {
          noHandStreakRef.current += 1;
          if (noHandStreakRef.current === NO_HAND_RECOVERY_THRESHOLD) {
            appLog.warn("No hands detected for extended period; attempting recovery", {
              noHandStreak: noHandStreakRef.current,
              detectionMeta,
            });
            void recoverDetectorFromInvalidLandmarks("continuous_no_hands", detectionMeta);
          }
        } else if (noHandStreakRef.current > 0) {
          appLog.info("No-hand streak ended", {
            noHandStreak: noHandStreakRef.current,
            detectionMeta,
            withinHandGraceWindow,
          });
          noHandStreakRef.current = 0;
        }

        if (!cancelled && mountedRef.current) {
          processTrackingFrame(hand, timestamp);
        }
      } catch (error) {
        appLog.error("Frame inference failed", { error });
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        updateFlightSimulation(timestamp);
        updateRunnerSimulation(timestamp);
        updateGame(timestamp);
      } finally {
        inferenceBusyRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(frameLoop);

    return () => {
      cancelled = true;
      appLog.info("Stopping tracking frame loop", {
        rafId: rafRef.current,
      });
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [appLog, cameraReady, modelReady]);

  return (
    <div className="app">
      <header className="top-bar">
        <h1>Finger Whack</h1>
        <div className={`tracking-indicator ${handDetected ? "ok" : "warn"}`}>
          {handDetected ? "Hand detected" : "Hand not detected"} | FPS: {fps.toFixed(1)}
        </div>
      </header>

      <div className={`content-grid ${isCalibrationLayoutPhase ? "calibration-layout" : ""}`}>
        <section className="card camera-card">
          <h2>{cameraPanelTitle}</h2>
          <div
            className="camera-wrap"
            ref={cameraWrapRef}
            style={{ aspectRatio: String(cameraAspectRatio) }}
          >
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            <canvas ref={overlayCanvasRef} className="camera-overlay" />
          </div>

          <p className="help-text">Hold one hand up.</p>
          <p className="help-text">Use your THUMB tip as the pointer.</p>
          <p className="help-text">Pinch (thumb + index) to "click".</p>

          <div className="status-row">
            <span>Camera: {cameraReady ? "ready" : "waiting"}</span>
            <span>Model: {modelReady ? "ready" : "loading"}</span>
            <span>Runtime: {activeRuntime}</span>
            <span>Backend: {activeBackend}</span>
            <span>Pinch: {pinchActive ? "active" : "idle"}</span>
          </div>

          {cameraError && <p className="error-text">{cameraError}</p>}
          {modelError && <p className="error-text">{modelError}</p>}

          {(phase === PHASES.CALIBRATION ||
            phase === PHASES.SANDBOX ||
            phase === PHASES.FLIGHT ||
            phase === PHASES.RUNNER) && (
            <>
              <p className="small-text">{calibrationMessage}</p>
              {phase === PHASES.CALIBRATION ? (
                <p className="small-text">
                  {isArcCalibrating
                    ? `Lazy Arc Confidence: ${Math.round(arcCalibrationProgress * 100)}% (${arcCalibrationSamples} valid frames)`
                    : `Captured points: ${calibrationPairsCount}/${calibrationTargets.length}${
                        isCalibrating
                          ? ` | Sampling: ${calibrationSampleFrames}/${CALIBRATION_SAMPLE_FRAMES}`
                        : ""
                      }`}
                </p>
              ) : phase === PHASES.SANDBOX ? (
                <p className="small-text">
                  Pinch over a block to grab it. Keep pinching to drag, then release to fling.
                </p>
              ) : phase === PHASES.FLIGHT ? (
                <p className="small-text">
                  Steering uses all five fingertips. Neutral baseline:{" "}
                  {flightHud.baselineReady
                    ? "locked"
                    : `${flightHud.baselineSamples}/${FLIGHT_BASELINE_SAMPLE_TARGET}`}
                  .
                </p>
              ) : (
                <p className="small-text">
                  4x4 track control: move hand across the camera view to pick any converging track.
                  Pinch to jump for higher coins.
                </p>
              )}

              <div className="button-row">
                {phase === PHASES.CALIBRATION ? (
                  <>
                    <button
                      onClick={beginCalibration}
                      disabled={!cameraReady || !modelReady || isArcCalibrating}
                    >
                      {isCalibrating ? "Restart Calibration" : "Start Calibration"}
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={beginArcCalibration}
                      disabled={!cameraReady || !modelReady || isCalibrating}
                    >
                      {isArcCalibrating
                        ? "Restart Lazy Arc Calibration"
                        : "Start Lazy Arc Calibration"}
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={startRunnerSession}
                      disabled={!cameraReady || !modelReady || isCalibrating || isArcCalibrating}
                    >
                      Launch Runner Game
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={startFlightSession}
                      disabled={!cameraReady || !modelReady || isCalibrating || isArcCalibrating}
                    >
                      Launch Flight Game
                    </button>
                    {hasSavedCalibration && !isCalibrating && !isArcCalibrating && (
                      <button className="secondary" onClick={startGameSession}>
                        Start Whack-a-Mole
                      </button>
                    )}
                    <button
                      className="secondary"
                      type="button"
                      onClick={openSandboxScreen}
                      disabled={!cameraReady || !modelReady || isCalibrating || isArcCalibrating}
                    >
                      Open Pinch Sandbox
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => resetCalibrationInputTests("manual_button")}
                    >
                      Reset Input Test
                    </button>
                  </>
                ) : phase === PHASES.SANDBOX ? (
                  <>
                    <button onClick={returnToCalibrationInputTest}>Back to Input Test</button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => resetSandboxBlocks("manual_button")}
                    >
                      Reset Blocks
                    </button>
                    {hasSavedCalibration && (
                      <button className="secondary" onClick={startGameSession}>
                        Start Whack-a-Mole
                      </button>
                    )}
                    <button className="secondary" onClick={startRunnerSession}>
                      Launch Runner Game
                    </button>
                    <button className="secondary" onClick={startFlightSession}>
                      Launch Flight Game
                    </button>
                  </>
                ) : phase === PHASES.FLIGHT ? (
                  <>
                    <button onClick={returnFromFlightSession}>Back to Input Test</button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => resetFlightNeutral("manual_button")}
                    >
                      Re-center Hand Pose
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => resetFlightSession("manual_button")}
                    >
                      Reset Flight Scene
                    </button>
                    <button className="secondary" onClick={startRunnerSession}>
                      Switch to Runner
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={returnFromRunnerSession}>Back to Input Test</button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => resetRunnerSession("manual_button")}
                    >
                      Reset Runner
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => triggerRunnerJump(performance.now(), "manual_button")}
                    >
                      Jump (Test)
                    </button>
                    <button className="secondary" onClick={startFlightSession}>
                      Switch to Flight
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          <label className="debug-toggle">
            <input
              type="checkbox"
              checked={debugEnabled}
              onChange={(event) => setDebugEnabled(event.target.checked)}
            />
            Debug overlay
          </label>
          <div className="button-row">
            <button
              className="secondary"
              type="button"
              disabled={!modelReady}
              onClick={() => logTrackingExtentsSnapshot("manual_button")}
            >
              Log Tracking Extents
            </button>
          </div>
        </section>

        {phase === PHASES.CALIBRATION ? (
          <section className="card panel calibration-panel">
            <h2>Calibration Input Test</h2>
            <p className="small-text">
              Primary target area: hover any box, then pinch while hovering to verify input
              behavior.
            </p>

            <div className="input-test-panel input-test-primary">
              <div className="input-test-stage" ref={inputTestStageRef}>
                <div
                  className="input-test-grid"
                  style={{
                    width: `${inputTestGridSize.width}px`,
                    height: `${inputTestGridSize.height}px`,
                    "--input-test-grid-gap": `${INPUT_TEST_CELL_GAP}px`,
                    "--input-test-grid-cols": String(INPUT_TEST_GRID_COLS),
                    "--input-test-grid-rows": String(INPUT_TEST_GRID_ROWS),
                  }}
                >
                  {Array.from({ length: INPUT_TEST_CELL_COUNT }, (_, cellIndex) => {
                    const isHovered = inputTestHoveredCell === cellIndex;
                    const isPinching = inputTestPinchingCell === cellIndex;
                    return (
                      <div
                        key={cellIndex}
                        ref={(element) => {
                          inputTestCellRefs.current[cellIndex] = element;
                        }}
                        className={`input-test-cell ${
                          isPinching ? "pinching" : isHovered ? "hovered" : ""
                        }`}
                      >
                        <span>{cellIndex + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <h3>Input Test</h3>
              <p className="small-text">
                Move over any of the {INPUT_TEST_CELL_COUNT} cells to see hover color. Keep
                hovering and pinch to switch to pinch color.
              </p>
              <p className="small-text">
                Hovered cell: {inputTestHoveredCell >= 0 ? inputTestHoveredCell + 1 : "none"} |
                Pinch: {pinchActive ? "active" : "idle"}
              </p>
            </div>
          </section>
        ) : phase === PHASES.SANDBOX ? (
          <section className="card panel sandbox-panel">
            <h2>Pinch Drag Sandbox</h2>
            <p className="small-text">
              Hover over a block and pinch to grab it. Move while pinching, then release to fling.
            </p>
            <p className="small-text">
              Two steel blocks (lower bounce) and two rubber blocks (higher bounce).
            </p>

            <div className="sandbox-panel-body">
              <div className="sandbox-stage" ref={sandboxStageRef}>
                {sandboxBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`sandbox-block ${block.material} ${
                      sandboxGrabbedBlockId === block.id ? "grabbed" : ""
                    }`}
                    style={{
                      left: `${block.x}px`,
                      top: `${block.y}px`,
                      width: `${block.size}px`,
                      height: `${block.size}px`,
                      background: block.color,
                    }}
                  >
                    <span>{block.id}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="small-text">
              Blocks: {sandboxBlocks.length} | Grabbed:{" "}
              {sandboxGrabbedBlockId !== null ? sandboxGrabbedBlockId : "none"} | Pinch:{" "}
              {pinchActive ? "active" : "idle"}
            </p>
          </section>
        ) : phase === PHASES.FLIGHT ? (
          <section className="card panel flight-panel">
            <h2>Star Flight</h2>
            <p className="small-text">
              Third-person flight at constant speed. Move all five fingertips to steer.
            </p>
            <p className="small-text">
              Shift hand left/right for yaw, up/down for pitch, and rotate hand for roll.
            </p>

            <div className="flight-stage" ref={flightStageRef}>
              <canvas className="flight-canvas" ref={flightCanvasRef} />
              <div className="flight-hud">
                <span>Yaw: {(flightHud.yaw * 100).toFixed(0)}%</span>
                <span>Pitch: {(flightHud.pitch * 100).toFixed(0)}%</span>
                <span>Roll: {(flightHud.roll * 100).toFixed(0)}%</span>
                <span>Control: {(flightHud.confidence * 100).toFixed(0)}%</span>
                <span>
                  Neutral:{" "}
                  {flightHud.baselineReady
                    ? "locked"
                    : `${flightHud.baselineSamples}/${FLIGHT_BASELINE_SAMPLE_TARGET}`}
                </span>
                <span>Distance: {flightHud.distance.toFixed(0)} u</span>
              </div>
            </div>

            <div className="button-row">
              <button onClick={startFlightSession}>Restart Flight</button>
              <button className="secondary" onClick={startGameSession}>
                Switch to Whack-a-Mole
              </button>
            </div>
          </section>
        ) : phase === PHASES.RUNNER ? (
          <section className="card panel runner-panel">
            <h2>Track Runner</h2>
            <p className="small-text">
              4x4 converging-track runner: move hand to switch tracks in both directions and pinch
              to jump.
            </p>
            <p className="small-text">
              Collect coins on your selected track. Air coins require a jump.
            </p>

            <div className="runner-stage" ref={runnerStageRef}>
              <canvas className="runner-canvas" ref={runnerCanvasRef} />
              <div className="runner-hud">
                <span>Coins: {runnerHud.coins}</span>
                <span>Distance: {runnerHud.distance.toFixed(0)} u</span>
                <span>Track: C{runnerHud.trackCol}/R{runnerHud.trackRow}</span>
                <span>Node gap: {runnerHud.trackSpacingPx.toFixed(1)} px</span>
                <span>Jump: {runnerHud.jumping ? `${runnerHud.jumpHeight.toFixed(0)} px` : "grounded"}</span>
              </div>
            </div>

            <div className="button-row">
              <button onClick={startRunnerSession}>Restart Runner</button>
              <button className="secondary" onClick={startFlightSession}>
                Switch to Flight
              </button>
              <button className="secondary" onClick={startGameSession}>
                Switch to Whack-a-Mole
              </button>
            </div>
          </section>
        ) : (
          <section className="card panel">
            <h2>Whack-a-Mole</h2>
            <div className="stats-grid">
              <div>
                <strong>Score</strong>
                <span>{score}</span>
              </div>
              <div>
                <strong>Time</strong>
                <span>{timeLeft}s</span>
              </div>
              <div>
                <strong>Tracking</strong>
                <span>{handDetected ? "yes" : "no"}</span>
              </div>
            </div>

            <div className="button-row">
              <button onClick={startGameSession}>
                {gameRunning ? "Restart Game" : "Start Game"}
              </button>
              <button className="secondary" onClick={startFlightSession}>
                Launch Flight Game
              </button>
              <button className="secondary" onClick={startRunnerSession}>
                Launch Runner Game
              </button>
              <button className="secondary" onClick={handleRecalibrate}>
                Recalibrate
              </button>
            </div>

            <div className="game-board" ref={boardRef}>
              {holes.map((hole) => (
                <div
                  key={hole.index}
                  className="hole"
                  style={{
                    left: `${hole.x}px`,
                    top: `${hole.y}px`,
                    width: `${hole.r * 2.5}px`,
                    height: `${hole.r * 1.6}px`,
                  }}
                />
              ))}

              {activeMoleIndex !== null && holes[activeMoleIndex] && (
                <div
                  className="mole"
                  style={{
                    left: `${holes[activeMoleIndex].x}px`,
                    top: `${holes[activeMoleIndex].y - holes[activeMoleIndex].r * 0.45}px`,
                    width: `${holes[activeMoleIndex].r * 1.5}px`,
                    height: `${holes[activeMoleIndex].r * 1.5}px`,
                  }}
                />
              )}
            </div>
          </section>
        )}
      </div>

      <div
        className={`tracked-cursor ${handDetected ? "" : "paused"}`}
        style={{
          left: `${cursor.x}px`,
          top: `${cursor.y}px`,
        }}
      />
      {debugEnabled && (
        <div
          className="raw-cursor"
          style={{
            left: `${rawCursor.x}px`,
            top: `${rawCursor.y}px`,
          }}
        />
      )}

      {phase === PHASES.CALIBRATION && isCalibrating && currentTarget && (
        <div className="calibration-layer">
          <div
            className="target-ring"
            style={{
              left: `${currentTarget.x}px`,
              top: `${currentTarget.y}px`,
            }}
          />
          <div
            className="target-dot"
            style={{
              left: `${currentTarget.x}px`,
              top: `${currentTarget.y}px`,
            }}
          />
          <div className="target-caption">
            Target {calibrationTargetIndex + 1}/{calibrationTargets.length} ({currentTarget.label})
          </div>
        </div>
      )}
    </div>
  );
}
