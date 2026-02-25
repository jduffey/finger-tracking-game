import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAffineTransform,
  clampPoint,
  clearCalibration,
  createCalibrationTargets,
  loadCalibration,
  saveCalibration,
  solveAffineFromPairs,
} from "./calibration";
import {
  buildGridHoles,
  GAME_DURATION_MS,
  isPointInCircle,
  MOLE_VISIBLE_MS,
  pickRandomHole,
  randomSpawnDelay,
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
  GAME: "GAME",
};

const PINCH_START_THRESHOLD = 0.045;
const PINCH_END_THRESHOLD = 0.06;
const PINCH_DEBOUNCE_MS = 250;
const CURSOR_ALPHA = 0.35;
const CALIBRATION_SAMPLE_FRAMES = 10;
const INVALID_LANDMARK_RECOVERY_THRESHOLD = 45;
const NO_HAND_RECOVERY_THRESHOLD = 300;
const HAND_DETECTION_GRACE_MS = 1600;
const INITIAL_TRACKING_RUNTIME = "mediapipe";
const FINGERTIP_OVERLAY_STYLES = {
  thumb: { fill: "rgba(255, 122, 89, 0.95)", radius: 4.8 },
  index: { fill: "rgba(255, 255, 255, 0.98)", radius: 6.2 },
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

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  const [inputTestHoveredCell, setInputTestHoveredCell] = useState(-1);
  const [inputTestGridSize, setInputTestGridSize] = useState({
    width: 0,
    height: 0,
    cellSize: 0,
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
  const inputTestHoveredCellRef = useRef(inputTestHoveredCell);

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
    if (inputTestHoveredCellRef.current !== -1) {
      inputTestHoveredCellRef.current = -1;
      setInputTestHoveredCell(-1);
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
      calibrationTargetIndex,
      calibrationPairsCount,
      calibrationSampleFrames,
      calibrationMessage,
    });
  }, [
    appLog,
    isCalibrating,
    calibrationTargetIndex,
    calibrationPairsCount,
    calibrationSampleFrames,
    calibrationMessage,
  ]);

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
    inputTestHoveredCellRef.current = inputTestHoveredCell;
  }, [inputTestHoveredCell]);

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
        "Saved calibration loaded. Start game or recalibrate anytime.",
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
      setCalibrationMessage("Calibration complete. Launching game.");
      appLog.info("Calibration solved successfully", {
        transform: solved,
      });
      startGameSession();
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
      phase: phaseRef.current,
      gameRunning: gameRunningRef.current,
    });

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

        if (fingerName === "index") {
          ctx.strokeStyle = "rgba(12, 16, 20, 0.75)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(x, y, style.radius + 1.8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (hand?.indexTip) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(hand.indexTip.u * canvas.width, hand.indexTip.v * canvas.height, 6.2, 0, Math.PI * 2);
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
      updateCalibrationInputTestHoverState(cursorRef.current, false, frameId);
      drawCameraOverlay(null);
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
    const indexTipRawU = Number.isFinite(hand.indexTip?.uRaw) ? hand.indexTip.uRaw : hand.indexTip.u;
    const indexTipRawV = Number.isFinite(hand.indexTip?.vRaw) ? hand.indexTip.vRaw : hand.indexTip.v;
    const visibleIndexTip = normalizeTipToVisibleBounds(indexTipRawU, indexTipRawV, visibleBounds);
    const mappedIndexTip = visibleIndexTip
      ? { u: visibleIndexTip.u, v: visibleIndexTip.v }
      : { u: hand.indexTip.u, v: hand.indexTip.v };
    updateTrackingExtentsWithHand(hand, frameId, timestamp, visibleBounds);

    const shouldUseTransform = Boolean(transformRef.current) && !isCalibratingRef.current;
    const mappedPoint = shouldUseTransform
      ? applyAffineTransform(transformRef.current, mappedIndexTip.u, mappedIndexTip.v)
      : {
          x: mappedIndexTip.u * viewportRef.current.width,
          y: mappedIndexTip.v * viewportRef.current.height,
        };

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

    appLog.debug("Updated raw and smoothed cursor", {
      frameId,
      rawPoint,
      previous: prev,
      smoothed,
      usedTransform: shouldUseTransform,
      indexTip: {
        uRaw: roundMetric(indexTipRawU),
        vRaw: roundMetric(indexTipRawV),
        uClamped: roundMetric(hand.indexTip.u),
        vClamped: roundMetric(hand.indexTip.v),
      },
      mappedIndexTip,
      visibleIndexTip,
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
      calibrationSampleRef.current.points.push({ u: mappedIndexTip.u, v: mappedIndexTip.v });
      setCalibrationSampleFrames(calibrationSampleRef.current.points.length);
      appLog.debug("Captured calibration sample frame", {
        frameId,
        targetIndex: calibrationSampleRef.current.targetIndex,
        sampleCount: calibrationSampleRef.current.points.length,
        mappedIndexTip,
        visibleIndexTip,
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

    drawCameraOverlay(hand);
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

      <div className={`content-grid ${phase === PHASES.CALIBRATION ? "calibration-layout" : ""}`}>
        <section className="card camera-card">
          <h2>{phase === PHASES.CALIBRATION ? "Camera + Calibration Controls" : "Camera + Tracking"}</h2>
          <div
            className="camera-wrap"
            ref={cameraWrapRef}
            style={{ aspectRatio: String(cameraAspectRatio) }}
          >
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            <canvas ref={overlayCanvasRef} className="camera-overlay" />
          </div>

          <p className="help-text">Hold one hand up.</p>
          <p className="help-text">Use your INDEX fingertip as the pointer.</p>
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

          {phase === PHASES.CALIBRATION && (
            <>
              <p className="small-text">{calibrationMessage}</p>
              <p className="small-text">
                Captured points: {calibrationPairsCount}/{calibrationTargets.length}
                {isCalibrating
                  ? ` | Sampling: ${calibrationSampleFrames}/${CALIBRATION_SAMPLE_FRAMES}`
                  : ""}
              </p>

              <div className="button-row">
                <button onClick={beginCalibration} disabled={!cameraReady || !modelReady}>
                  {isCalibrating ? "Restart Calibration" : "Start Calibration"}
                </button>
                {hasSavedCalibration && !isCalibrating && (
                  <button className="secondary" onClick={startGameSession}>
                    Use Saved Calibration
                  </button>
                )}
                <button
                  className="secondary"
                  type="button"
                  onClick={() => resetCalibrationInputTests("manual_button")}
                >
                  Reset Input Test
                </button>
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
              Primary target area: hover any box, then pinch while hovering to verify input behavior.
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
                Move over any of the {INPUT_TEST_CELL_COUNT} cells to see hover color. Keep hovering and pinch to switch to pinch color.
              </p>
              <p className="small-text">
                Hovered cell: {inputTestHoveredCell >= 0 ? inputTestHoveredCell + 1 : "none"} | Pinch:{" "}
                {pinchActive ? "active" : "idle"}
              </p>
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
              <button onClick={startGameSession}>{gameRunning ? "Restart Game" : "Start Game"}</button>
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
