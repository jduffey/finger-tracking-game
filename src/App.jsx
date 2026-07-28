import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "./calibration.js";
import {
  computeRunnerTrackGridLayout,
  getRunnerTrackIndexFromNormalized,
  getRunnerTrackOffsetFromIndex,
  pickDistinctRandomChoice,
  shouldCollectRunnerCoin,
} from "./gameLogic.js";
import {
  BRICK_DODGER_BONUS_SCORE,
  createBrickDodgerGame,
  stepBrickDodgerGame,
} from "./brickDodgerGame.js";
import {
  getBrickDodgerLaneTelegraphUi,
  getBrickDodgerMultiplierUi,
  getBrickDodgerPickupUi,
  getBrickDodgerResultUi,
  getBrickDodgerSlowTimeUi,
  getBrickDodgerStageRecapUi,
  getBrickDodgerStageUi,
} from "./brickDodgerUi.js";
import {
  BREAKOUT_BRICK_COLORS,
  BREAKOUT_BRICK_SCORE,
  BREAKOUT_CAPSULE_SCORE,
  BREAKOUT_COUNTDOWN_MS,
  FIND_YOUR_GRIND_BREAKOUT_MODE_ID,
  createBreakoutGame,
  createFindYourGrindBreakoutGame,
  restartBreakoutGame,
  stepBreakoutGame,
} from "./breakoutGame.js";
import {
  BREAKOUT_COOP_BRICK_SCORE,
  BREAKOUT_COOP_PRISM_BRICK_SCORE,
  BREAKOUT_COOP_SHIELD_COOLDOWN_MS,
  BREAKOUT_COOP_SHIELD_DURATION_MS,
  createBreakoutCoopGame,
  stepBreakoutCoopGame,
} from "./breakoutCoopGame.js";
import { selectBreakoutCoopSupportHand } from "./fullscreenBreakoutCoopInput.js";
import {
  FINGER_PONG_COUNTDOWN_MS,
  createFingerPongGame,
  stepFingerPongGame,
} from "./fingerPongGame.js";
import { getFingerPongMatchUi } from "./fingerPongUi.js";
import {
  createFullscreenHandBounceDailyGame,
  createFullscreenHandBounceGame,
  restartFullscreenHandBounceGame as restartFullscreenHandBounceCampaign,
  stepFullscreenHandBounceGame,
} from "./fullscreenHandBounceGame.js";
import {
  getFullscreenHandBounceCheckpointUi,
  getFullscreenHandBounceHudUi,
  getFullscreenHandBounceLegendUi,
  getFullscreenHandBouncePowerUi,
  getFullscreenHandBounceResultUi,
  getFullscreenHandBounceStageUi,
  getFullscreenHandBounceTargetUi,
} from "./fullscreenHandBounceUi.js";
import {
  WHACK_A_MOLE_ACTIONS,
  WHACK_A_MOLE_PHASES,
  createDailyWhackAMoleSeed,
  createWhackAMoleGame,
  getWhackAMoleSummary,
  reduceWhackAMoleGame,
} from "./whackAMoleGame.js";
import {
  createFlappyDailyChallengeGame,
  createFlappyGame,
  flapFlappyGame,
  stepFlappyGame,
} from "./flappyGame.js";
import {
  getFullscreenDetectorHandLimit,
  getFullscreenTrackedHandLimit,
  getFullscreenTrackedFingerNames,
  shouldShowFullscreenNeonHandOutline,
  shouldShowFullscreenHandSkeleton,
  shouldShowFullscreenInvadersBanner,
} from "./fullscreenGameUi.js";
import { getFullscreenRingLayersForHand } from "./fullscreenRings.js";
import {
  getTipRippleStrokeWidth,
  getTouchingTipRippleStrokeWidth,
} from "./tipRipples.js";
import { FULLSCREEN_HOLD_CONTROL_MS } from "./fullscreenHoldControl.js";
import { getVerifiedFullscreenHandPointerInput } from "./fullscreenHandPointer.js";
import {
  areFullscreenExitControlStatesEqual,
  createFullscreenExitControlState,
  stepFullscreenExitControl,
} from "./fullscreenExitControl.js";
import {
  createFullscreenRestartControlState,
  stepFullscreenRestartControl,
} from "./fullscreenRestartControl.js";
import { getFullscreenRestartControlLabel } from "./fullscreenRestartModes.js";
import { runFullscreenOverlayGameUpdates } from "./fullscreenOverlayGames.js";
import {
  MISSILE_COMMAND_COUNTDOWN_MS,
  MISSILE_COMMAND_THREAT_SCORE,
  createMissileCommandDailyGame,
  createMissileCommandGame,
  getMissileCommandExplosionRadius,
  launchMissileCommandInterceptor,
  stepMissileCommandGame,
} from "./missileCommandGame.js";
import {
  getMissileCommandCooldownUi,
  getMissileCommandCrosshairUi,
  getMissileCommandCountdownUi,
  getMissileCommandExplosionUi,
  getMissileCommandGameOverUi,
  getMissileCommandInterceptorUi,
  getMissileCommandLegendItems,
  getMissileCommandLaunchPreview,
  getMissileCommandIntermissionUi,
  getMissileCommandResourceUi,
  getMissileCommandSceneClassName,
  getMissileCommandStructureUi,
  getMissileCommandTargetWarnings,
  getMissileCommandThreatUi,
  getMissileCommandTacticalMetrics,
  getMissileCommandWaveUi,
} from "./missileCommandUi.js";
import {
  SPACE_INVADERS_ENEMY_SCORE,
  createSpaceInvadersGame,
  stepSpaceInvadersGame,
} from "./spaceInvadersGame.js";
import {
  SKY_PATROL_STARTING_LIVES,
  createSkyPatrolDailyGame,
  createSkyPatrolGame,
  restartSkyPatrolGame,
  stepSkyPatrolGame,
} from "./skyPatrolGame.js";
import {
  WFC_WORLD_MODE_ID,
  clearWfcWorld,
  createWfcWorldGame,
  createWfcWorldStepInput,
  getWfcWorldGoalModel,
  selectWfcWorldTile,
  startWfcWorldCollapse,
  stepWfcWorldGame,
} from "./wfc/wfcWorldGame.js";
import {
  areSkyPatrolHudStatesEqual,
  createSkyPatrolCanvasRenderer,
  getSkyPatrolHudState,
} from "./skyPatrolCanvas.js";
import { SKY_PATROL_SPRITE_ATLAS_URL } from "./skyPatrolSpriteAtlas.js";
import {
  SKY_PATROL_ACTIVE_HAND_CONNECTIONS,
  SKY_PATROL_ACTIVE_HAND_TIP_INDEXES,
  getSkyPatrolActiveHandTipStyle,
} from "./skyPatrolHandOverlay.js";
import {
  getSkyPatrolFireCooldownUi,
  getSkyPatrolCheckpointUi,
  getSkyPatrolComboUi,
  getSkyPatrolGameOverUi,
  getSkyPatrolGunCooldownUi,
  getSkyPatrolHudItems,
  getSkyPatrolLegendUi,
  getSkyPatrolLifeIcons,
  getSkyPatrolMissionUi,
  getSkyPatrolOnboardingUi,
  getSkyPatrolStartPromptUi,
} from "./skyPatrolUi.js";
import {
  TIC_TAC_TOE_AI_MARK,
  TIC_TAC_TOE_AI_PIECE_LIMIT,
  TIC_TAC_TOE_PLAYER_MARK,
  TIC_TAC_TOE_PLAYER_PIECE_LIMIT,
  TIC_TAC_TOE_RESET_HOLD_MS,
  createTicTacToeGame,
  getTicTacToeCellIndex,
  getTicTacToeCellRect,
  restartTicTacToeRound,
  stepTicTacToeGame,
} from "./ticTacToeGame.js";
import {
  getTicTacToeCellUi,
  getTicTacToeCursorUi,
  getTicTacToeHudUi,
  getTicTacToeMarkUi,
  getTicTacToeReservePips,
  getTicTacToeResetUi,
  getTicTacToeTurnUi,
  getTicTacToeWinningLineUi,
} from "./ticTacToeUi.js";
import {
  FRUIT_NINJA_BLADE_TRAIL_MS,
  createFruitNinjaDailyGame,
  createFruitNinjaGame,
  restartFruitNinjaGame,
  stepFruitNinjaGame,
} from "./fruitNinjaGame.js";
import {
  getFruitNinjaBombWarnings,
  getFruitNinjaComboUi,
  getFruitNinjaHud,
  getFruitNinjaLegendItems,
  getFruitNinjaPowerUi,
  getFruitNinjaPrecisionUi,
  getFruitNinjaRecapUi,
  getFruitNinjaRoundUi,
  getFruitNinjaSceneClassName,
  getFruitNinjaTargetUi,
} from "./fruitNinjaUi.js";
import {
  detectHands,
  getCurrentBackend,
  getCurrentRuntime,
  getLastDetectionMeta,
  initHandTracking,
} from "./trackingRuntimeLoader.js";
import { assignStableHandLabels } from "./handLabeling.js";
import { getHandOverlayStyle } from "./handOverlayStyles.js";
import {
  getPinchClickExcludeSelector,
  shouldAcceptPinchClick,
  shouldBypassGlobalPinchDebounce,
} from "./pinchInput.js";
import {
  shouldShowInlineCameraPreview,
  shouldUseContainedCameraFit,
  shouldUseImmersiveAppLayout,
} from "./cameraLayout.js";
import {
  CAMERA_INTERRUPTION_RETRY_DELAY_MS,
  attachCameraStreamToVideo,
  getCameraVideoKeepAliveAction,
  getStaleInferenceKeepAliveAction,
  observeCameraStreamInterruptions,
  releaseCameraStream,
  shouldRunTrackingKeepAlive,
} from "./trackingKeepAlive.js";
import {
  detectPose,
  detectPoses,
  getLastPoseMeta,
  getPoseRuntime,
  initPoseTracking,
} from "./trackingRuntimeLoader.js";
import {
  FULLSCREEN_BODY_SKELETON_MAX_PEOPLE,
  FULLSCREEN_HAND_SKELETON_MAX_HANDS,
  createFullscreenBodySkeletonOverlay,
  createFullscreenHandSkeletonOverlay,
} from "./fullscreenBodySkeletonOverlay.js";
import {
  createEmptyOffAxisState,
  createHeldOffAxisState,
  deriveOffAxisHeadState,
} from "./offAxisHeadTracking.js";
import { createScopedLogger } from "./logger.js";
import WebcamBackground from "./components/WebcamBackground.jsx";
import ProductHome from "./components/ProductHome.jsx";
import { createGestureEngine } from "./gestures/gestureEngine.js";
import {
  APP_PHASES,
  PRODUCT_AREAS,
  TRACKING_PROFILES,
  getModeByFullscreenId,
  getModeById,
  getModeByPhase,
  getModeByPath,
  listModes,
} from "./modeRegistry.js";
import {
  getProductHomeAreaFromPath,
  getProductHomePathForArea,
} from "./productHomeModel.js";
import {
  TRACKING_READINESS_STATES,
  createTrackingInteractionCheck,
  createTrackingReadinessState,
  reduceTrackingReadiness,
  updateTrackingInteractionCheck,
} from "./trackingReadiness.js";
import {
  TRACKING_RECOVERY_PHASES,
  advanceTrackingRecoveryGate,
  createTrackingRecoveryGate,
  getTrackingRecoveryStatus,
} from "./trackingRecoveryGate.js";
import {
  EXPERIENCE_LIFECYCLE_EVENTS,
  EXPERIENCE_PAUSE_REASONS,
  EXPERIENCE_PHASES,
  createExperienceLifecycle,
  transitionExperienceLifecycle,
} from "./experienceLifecycle.js";
import {
  applyPreferenceDocumentState,
  clearUserPreferences,
  loadUserPreferences,
  normalizeUserPreferences,
  recordRecentMode,
  saveUserPreferences,
  toggleFavoriteMode,
} from "./userPreferences.js";
import {
  adaptHandsForCamera,
  adaptPoseForCamera,
  adaptPosesForCamera,
  expandPointerRangeForSeatedPlay,
  getCursorSmoothingAlpha,
  getPinchThresholds,
  selectPreferredHand,
} from "./inputPreferences.js";
import { createAudioFeedback } from "./audioFeedback.js";
import { createGameProgressionStore } from "./gameProgressionStorage.js";
import { ACHIEVEMENT_DEFINITIONS } from "./achievementCatalog.js";
import {
  createFullscreenGameResult,
  createSpatialMemoryResult,
  createWhackAMoleResult,
} from "./gameResultAdapters.js";
import { formatExperienceDuration } from "./experienceResult.js";
import { clearCreativeAssets } from "./creativeAssetStorage.js";
import { clearLocalProductStorage } from "./localDataCleanup.js";
import {
  assessDeviceCapabilities,
  collectDeviceCapabilitySignals,
  getCapabilityLaunchRecommendation,
} from "./deviceCapabilities.js";
import {
  QUALITY_LEVELS,
  createDynamicQualityController,
  getDynamicQualityBudget,
  updateDynamicQuality,
} from "./dynamicQuality.js";
import {
  RESIZABLE_LEFT_PANE_HANDLE_WIDTH_PX,
  RESIZABLE_LEFT_PANE_MIN_WIDTH_PX,
  clampResizableLeftPaneWidth,
} from "./layoutSizing.js";
import { resizeFullscreenGameState } from "./viewportStateTransform.js";
import { createFixedStepSessionTiming } from "./sessionTiming.js";
import {
  MOTION_VISUALIZER_EFFECTS,
  applyMotionVisualizerPreset,
  createMotionVisualizerPreset,
  deleteMotionVisualizerPreset,
  getMotionVisualizerPalette,
  getMotionVisualizerPulseDurationMs,
  getMotionVisualizerTrailDurationMs,
  isMotionVisualizerEffect,
  loadMotionVisualizerState,
  normalizeMotionVisualizerState,
  saveMotionVisualizerState,
  toggleMotionVisualizerFavorite,
} from "./motionVisualizer.js";
import {
  ALL_GESTURE_IDS,
  GESTURE_DEFINITIONS,
  GESTURE_IDS,
  isTwoHandGesture,
} from "./gestures/constants.js";
import { createGesturePersonalization } from "./gestures/personalization.js";
import {
  SPATIAL_MEMORY_ACTIONS,
  SPATIAL_MEMORY_PHASES,
  createSpatialMemoryExperience,
  reduceSpatialMemoryExperience,
  toSpatialMemoryLegacyState,
} from "./spatialMemoryExperience.js";

const BodyPoseLab = lazy(() => import("./components/BodyPoseLab.jsx"));
const ExperienceOverlay = lazy(
  () => import("./components/ExperienceOverlay.jsx"),
);
const SettingsPanel = lazy(
  () => import("./components/SettingsPanel.jsx"),
);
const TrackingSetup = lazy(
  () => import("./components/TrackingSetup.jsx"),
);
const ConveyorSphereGame = lazy(
  () => import("./components/ConveyorSphereGame.jsx"),
);
const GestureAnalyticsLab = lazy(
  () => import("./components/GestureAnalyticsLab.jsx"),
);
const GestureArtLab = lazy(
  () => import("./components/GestureArtLab.jsx"),
);
const GestureControlOS = lazy(
  () => import("./components/GestureControlOS.jsx"),
);
const MinorityReportLab = lazy(
  () => import("./components/MinorityReportLab.jsx"),
);
const OffAxisChamberLab = lazy(
  () => import("./components/OffAxisChamberLab.jsx"),
);
const RouletteFingerGame = lazy(
  () => import("./components/RouletteFingerGame.jsx"),
);
const WhackAMoleExperience = lazy(
  () => import("./components/WhackAMoleExperience.jsx"),
);
const SpatialGestureMemory = lazy(
  () => import("./components/SpatialGestureMemory.jsx"),
);
const ArcadeRunExperience = lazy(
  () => import("./components/ArcadeRunExperience.jsx"),
);
const MotionVisualizerControls = lazy(() =>
  import("./components/MotionVisualizerControls.jsx").then((module) => ({
    default: module.MotionVisualizerControls,
  })),
);
const WfcWorldRenderer = lazy(() =>
  import("./wfc/WfcWorldRenderer.jsx").then((module) => ({
    default: module.WfcWorldRenderer,
  })),
);
const WfcWorldProjectPanel = lazy(() =>
  import("./wfc/WfcWorldProjectPanel.jsx").then((module) => ({
    default: module.WfcWorldProjectPanel,
  })),
);

function LazyExperienceFallback({ label = "Loading experience…" }) {
  return (
    <div className="lazy-experience-fallback" role="status">
      <span aria-hidden="true" className="lazy-experience-spinner" />
      <strong>{label}</strong>
    </div>
  );
}

const PHASES = APP_PHASES;
const ARCADE_RUN_STORAGE_KEY = "motionArcade.arcadeRun";

const PINCH_DEBOUNCE_MS = 250;
const CURSOR_TRAIL_DURATION_MS = 1000;
const CURSOR_TRAIL_SAMPLE_INTERVAL_MS = 34;
const CURSOR_TRAIL_MIN_DISTANCE_PX = 6;
const FULLSCREEN_GRID_SIZE_PX = 48;
const FULLSCREEN_HEX_RADIUS_PX = 28;
const FULLSCREEN_RING_TRAIL_DURATION_MS = 2000;
const FULLSCREEN_RING_TRAIL_SAMPLE_INTERVAL_MS = 34;
const FULLSCREEN_PULSE_RING_DURATION_MS = 1800;
const FULLSCREEN_PULSE_RING_INTERVAL_MS = 260;
const FULLSCREEN_RING_STEP_PX = 36;
const FULLSCREEN_STATIC_RING_STEP_PX = FULLSCREEN_RING_STEP_PX * 2;
const FULLSCREEN_TIP_RIPPLE_OUTER_DIAMETER_STEP_PX = FULLSCREEN_STATIC_RING_STEP_PX * 2;
const FULLSCREEN_TIP_RIPPLE_TOUCHING_STROKE_WIDTH_PX = getTouchingTipRippleStrokeWidth(
  FULLSCREEN_TIP_RIPPLE_OUTER_DIAMETER_STEP_PX,
);
const FULLSCREEN_RING_LAYERS = [
  { diameter: 44, color: "#ff0000" },
  { diameter: 80, color: "#ff8d00" },
  { diameter: 116, color: "#ffdb00" },
  { diameter: 152, color: "#00d619" },
  { diameter: 188, color: "#009fff" },
];
const FULLSCREEN_VORONOI_DOT_RADIUS = 4.5;
const CIRCLE_OF_FIFTHS_AUTOSTART_SESSION_KEY = "circle-of-fifths-autostart";
const DESKTOP_LAYOUT_BREAKPOINT_PX = 980;
const LEFT_PANE_RESIZE_KEYBOARD_STEP_PX = 24;
let fallbackProgressionSessionSequence = 0;

function createProgressionSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return `session-${globalThis.crypto.randomUUID()}`;
  }
  fallbackProgressionSessionSequence += 1;
  return `session-${Date.now()}-${fallbackProgressionSessionSequence}`;
}

function initializeOrResizeFullscreenGame(mode, currentState, templateState) {
  if (
    !currentState?.layout ||
    !templateState?.layout ||
    (currentState.variant &&
      templateState.variant &&
      currentState.variant !== templateState.variant)
  ) {
    return templateState;
  }
  return resizeFullscreenGameState(
    mode,
    currentState,
    templateState.layout,
  );
}

function clipPolygonToHalfPlane(polygon, normalX, normalY, offset) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return [];
  }

  const clipped = [];
  const isInside = (point) => normalX * point.x + normalY * point.y <= offset + 1e-6;
  const getIntersection = (start, end) => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const denominator = normalX * deltaX + normalY * deltaY;
    if (Math.abs(denominator) < 1e-6) {
      return end;
    }
    const t = (offset - normalX * start.x - normalY * start.y) / denominator;
    return {
      x: start.x + deltaX * t,
      y: start.y + deltaY * t,
    };
  };

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const startInside = isInside(start);
    const endInside = isInside(end);

    if (startInside && endInside) {
      clipped.push(end);
    } else if (startInside && !endInside) {
      clipped.push(getIntersection(start, end));
    } else if (!startInside && endInside) {
      clipped.push(getIntersection(start, end), end);
    }
  }

  return clipped;
}

function buildStaticRippleClipPolygon(point, points, viewport) {
  if (
    !viewport ||
    !Number.isFinite(point?.x) ||
    !Number.isFinite(point?.y) ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height)
  ) {
    return null;
  }

  const localPoint = {
    x: point.x - viewport.left,
    y: point.y - viewport.top,
  };
  let polygon = [
    { x: 0, y: 0 },
    { x: viewport.width, y: 0 },
    { x: viewport.width, y: viewport.height },
    { x: 0, y: viewport.height },
  ];

  for (const candidate of points) {
    if (
      candidate?.id === point.id ||
      !Number.isFinite(candidate?.x) ||
      !Number.isFinite(candidate?.y)
    ) {
      continue;
    }

    const candidateLocal = {
      x: candidate.x - viewport.left,
      y: candidate.y - viewport.top,
    };
    const normalX = candidateLocal.x - localPoint.x;
    const normalY = candidateLocal.y - localPoint.y;
    const offset =
      (candidateLocal.x * candidateLocal.x +
        candidateLocal.y * candidateLocal.y -
        localPoint.x * localPoint.x -
        localPoint.y * localPoint.y) /
      2;

    polygon = clipPolygonToHalfPlane(polygon, normalX, normalY, offset);
    if (polygon.length === 0) {
      return null;
    }
  }

  return polygon;
}

function getStaticRippleClipPath(point, points, viewport) {
  const polygon = buildStaticRippleClipPolygon(point, points, viewport);
  if (!polygon || polygon.length < 3) {
    return null;
  }

  return `polygon(${polygon
    .map(({ x, y }) => `${x.toFixed(2)}px ${y.toFixed(2)}px`)
    .join(", ")})`;
}

function getStaticRippleSeam(pointA, pointB, viewport) {
  if (
    !viewport ||
    !Number.isFinite(pointA?.x) ||
    !Number.isFinite(pointA?.y) ||
    !Number.isFinite(pointB?.x) ||
    !Number.isFinite(pointB?.y)
  ) {
    return null;
  }

  const a = {
    x: pointA.x - viewport.left,
    y: pointA.y - viewport.top,
  };
  const b = {
    x: pointB.x - viewport.left,
    y: pointB.y - viewport.top,
  };
  const normalX = b.x - a.x;
  const normalY = b.y - a.y;
  const offset = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
  const intersections = [];
  const registerPoint = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    if (x < -1e-6 || x > viewport.width + 1e-6 || y < -1e-6 || y > viewport.height + 1e-6) {
      return;
    }
    const roundedX = Math.min(viewport.width, Math.max(0, x));
    const roundedY = Math.min(viewport.height, Math.max(0, y));
    const alreadyRegistered = intersections.some(
      (point) =>
        Math.abs(point.x - roundedX) < 0.5 && Math.abs(point.y - roundedY) < 0.5,
    );
    if (!alreadyRegistered) {
      intersections.push({ x: roundedX, y: roundedY });
    }
  };

  if (Math.abs(normalY) >= 1e-6) {
    registerPoint(0, offset / normalY);
    registerPoint(viewport.width, (offset - normalX * viewport.width) / normalY);
  }
  if (Math.abs(normalX) >= 1e-6) {
    registerPoint(offset / normalX, 0);
    registerPoint((offset - normalY * viewport.height) / normalX, viewport.height);
  }

  if (intersections.length < 2) {
    return null;
  }

  let bestPair = null;
  let bestDistance = -1;
  for (let firstIndex = 0; firstIndex < intersections.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < intersections.length; secondIndex += 1) {
      const first = intersections[firstIndex];
      const second = intersections[secondIndex];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestPair = { x1: first.x, y1: first.y, x2: second.x, y2: second.y };
      }
    }
  }

  return bestPair;
}
const CALIBRATION_SAMPLE_FRAMES = 10;
const ARC_CALIBRATION_READY_CONFIDENCE = 0.86;
const ARC_CALIBRATION_MAX_CAPTURE_FRAMES = 2400;
const INVALID_LANDMARK_RECOVERY_THRESHOLD = 45;
const NO_HAND_KEEP_ALIVE_NOTICE_THRESHOLD = 300;
const NO_HAND_KEEP_ALIVE_LOG_INTERVAL = 1800;
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
const RUNNER_COIN_COUNT = 20;
const RUNNER_COIN_RESPAWN_MIN_Z = 860;
const RUNNER_COIN_RESPAWN_MAX_Z = 1880;
const RUNNER_HUD_UPDATE_MS = 90;
const RUNNER_LANE_SMOOTH_ALPHA = 0.19;
const RUNNER_COIN_COLOR_STEPS = [
  {
    maxDepthT: 0.2,
    fill: "#9aa3af",
    stroke: "#6d7784",
    glowInner: "rgba(233, 238, 245, 0.88)",
    glowOuter: "rgba(182, 192, 204, 0.07)",
  },
  {
    maxDepthT: 0.4,
    fill: "#73e48a",
    stroke: "#2d9c54",
    glowInner: "rgba(190, 255, 205, 0.9)",
    glowOuter: "rgba(91, 197, 116, 0.08)",
  },
  {
    maxDepthT: 0.6,
    fill: "#6bb9ff",
    stroke: "#2f74d6",
    glowInner: "rgba(184, 222, 255, 0.9)",
    glowOuter: "rgba(97, 154, 235, 0.08)",
  },
  {
    maxDepthT: 0.8,
    fill: "#b784ff",
    stroke: "#7a44d1",
    glowInner: "rgba(224, 193, 255, 0.9)",
    glowOuter: "rgba(152, 87, 232, 0.08)",
  },
  {
    maxDepthT: Number.POSITIVE_INFINITY,
    fill: "#ffd95f",
    stroke: "#f3a91f",
    glowInner: "rgba(255, 250, 170, 0.95)",
    glowOuter: "rgba(255, 204, 64, 0.08)",
  },
];
const TRACKING_DEFAULT_HAND_LIMIT = 2;
const TRACKING_DEFAULT_DETECTOR_MAX_HANDS = 4;
const FULLSCREEN_BODY_SKELETON_INTERVAL_MS = 33;
const FULLSCREEN_BODY_SKELETON_MODES = new Set(["voronoi"]);

function getTrackingDetectorMaxHandsForContext(phase, fullscreenMode) {
  if (phase !== PHASES.FULLSCREEN_CAMERA) {
    return TRACKING_DEFAULT_DETECTOR_MAX_HANDS;
  }

  return getFullscreenDetectorHandLimit(fullscreenMode, TRACKING_DEFAULT_DETECTOR_MAX_HANDS);
}

const LAB_DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const LAB_EVENT_LOG_LIMIT = 220;
const LAB_TRAIN_CAPTURE_FRAMES = 24;
const LAB_TRAIN_COUNTDOWN_SECONDS = 3;
const SGM_STORAGE_KEY = "spatial_gesture_memory_stats_v1";
const SGM_GESTURE_POOL_EARLY = [
  GESTURE_IDS.SWIPE_LEFT,
  GESTURE_IDS.SWIPE_RIGHT,
  GESTURE_IDS.PINCH_GRAB,
  GESTURE_IDS.OPEN_PALM,
  GESTURE_IDS.PUSH_FORWARD,
  GESTURE_IDS.CIRCLE,
];
const SGM_GESTURE_POOL_ADVANCED = [
  GESTURE_IDS.EXPAND,
  GESTURE_IDS.COMPRESS,
  GESTURE_IDS.ROTATE_TWIST,
  GESTURE_IDS.SYMMETRIC_SWIPE,
];
const POSE_KEYPOINT_THRESHOLD = 0.2;
const POSE_CONNECTIONS = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_eye", "right_eye"],
  ["nose", "left_eye"],
  ["nose", "right_eye"],
  ["left_eye", "left_ear"],
  ["right_eye", "right_ear"],
];
const POSE_KEYPOINT_GROUPS = {
  head: ["nose", "left_ear", "right_ear"],
  eyes: ["left_eye", "right_eye"],
  shoulders: ["left_shoulder", "right_shoulder"],
  arms: ["left_elbow", "right_elbow", "left_wrist", "right_wrist"],
  torso: ["left_hip", "right_hip", "left_shoulder", "right_shoulder"],
};
const HAND_ROOT_CONNECTIONS = [
  [0, 1],
  [0, 5],
  [0, 9],
  [0, 13],
  [0, 17],
];
const HAND_WRIST_INDEX = 0;
const HAND_PALM_LANDMARK_INDEXES = [0, 5, 9, 13, 17];
const HAND_INDEX_KNUCKLE_INDEX = 5;
const HAND_MIDDLE_KNUCKLE_INDEX = 9;
const HAND_PINKY_KNUCKLE_INDEX = 17;
const HAND_FINGER_CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
const HAND_FINGERTIP_INDEXES = [4, 8, 12, 16, 20];
const FINGERTIP_NAME_BY_INDEX = {
  4: "thumb",
  8: "index",
  12: "middle",
  16: "ring",
  20: "pinky",
};

const GESTURE_LABEL_BY_ID = GESTURE_DEFINITIONS.reduce((accumulator, definition) => {
  accumulator[definition.id] = definition.label;
  return accumulator;
}, {});

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

function getRunnerCoinPaletteByDepth(depthT) {
  for (const step of RUNNER_COIN_COLOR_STEPS) {
    if (depthT < step.maxDepthT) {
      return step;
    }
  }
  return RUNNER_COIN_COLOR_STEPS[RUNNER_COIN_COLOR_STEPS.length - 1];
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

function getCameraObjectFitForPhase(phase) {
  return shouldUseContainedCameraFit(phase) ? "contain" : "cover";
}

function pruneCursorTrail(
  trail,
  now,
  durationMs = FULLSCREEN_RING_TRAIL_DURATION_MS,
) {
  return trail.filter((point) => now - point.timestamp <= durationMs);
}

function pruneTrackedCursorTrail(trail, now) {
  return trail.filter((point) => now - point.timestamp <= CURSOR_TRAIL_DURATION_MS);
}

function prunePulseBursts(
  bursts,
  now,
  durationMs = FULLSCREEN_PULSE_RING_DURATION_MS,
) {
  return bursts.filter((burst) => now - burst.startTime <= durationMs);
}

function createFullscreenCameraViewport(stageWidth, stageHeight, aspectRatio) {
  let width = stageWidth;
  let height = width / aspectRatio;
  if (height > stageHeight) {
    height = stageHeight;
    width = height * aspectRatio;
  }

  const left = (stageWidth - width) / 2;
  const top = (stageHeight - height) / 2;

  return {
    left,
    top,
    width,
    height,
    style: {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    },
  };
}

function buildFullscreenHexCells(width, height, radius = FULLSCREEN_HEX_RADIUS_PX) {
  const hexWidth = Math.sqrt(3) * radius;
  const hexHeight = radius * 2;
  const verticalStep = radius * 1.5;
  const rows = Math.ceil(height / verticalStep) + 2;
  const cols = Math.ceil(width / hexWidth) + 2;
  const cells = [];
  const cellMap = new Map();

  for (let row = 0; row < rows; row += 1) {
    const centerY = radius + row * verticalStep;
    const rowOffsetX = (row % 2) * (hexWidth / 2);
    for (let col = 0; col < cols; col += 1) {
      const centerX = hexWidth / 2 + rowOffsetX + col * hexWidth;
      const left = centerX - hexWidth / 2;
      const top = centerY - radius;
      if (left >= width || top >= height || left + hexWidth <= 0 || top + hexHeight <= 0) {
        continue;
      }

      const q = col - ((row - (row & 1)) >> 1);
      const r = row;
      const key = `${q},${r}`;
      const cell = {
        key,
        q,
        r,
        centerX,
        centerY,
        style: {
          left: `${left}px`,
          top: `${top}px`,
          width: `${hexWidth}px`,
          height: `${hexHeight}px`,
        },
      };
      cells.push(cell);
      cellMap.set(key, cell);
    }
  }

  return {
    cells,
    cellMap,
  };
}

function createEmptyLabConfidenceMap() {
  return ALL_GESTURE_IDS.reduce((accumulator, gestureId) => {
    accumulator[gestureId] = 0;
    return accumulator;
  }, {});
}

function createEmptyLabEngineOutput() {
  return {
    frameId: 0,
    hands: [],
    events: [],
    confidences: createEmptyLabConfidenceMap(),
    heuristicConfidences: createEmptyLabConfidenceMap(),
    personalizedConfidences: createEmptyLabConfidenceMap(),
    liveVectors: {},
    continuous: {
      pinchActiveByHand: {},
      twoHandManipulationActive: false,
    },
    twoHand: { present: false },
  };
}

function randomChoice(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * values.length);
  return values[index] ?? values[0];
}

function createInitialSpatialMemoryStats() {
  return {
    highScore: 0,
    bestRound: 1,
    totalRounds: 0,
    completedRounds: 0,
  };
}

function createInitialSpatialMemoryState() {
  return {
    active: false,
    status: "idle",
    round: 1,
    sequence: [],
    currentStepIndex: 0,
    stepProgressIds: [],
    expectedStep: null,
    expectedLabel: "Press Start",
    stepDeadline: 0,
    roundStartAt: 0,
    elapsedSeconds: 0,
    message: "Watch the sequence, then reproduce it in order.",
    lastActionLabel: "—",
    accuracy: 1,
    smoothness: 0,
    score: 0,
    ...createInitialSpatialMemoryStats(),
    successRate: 0,
    difficultyLevel: 1,
    sequenceLength: 0,
    recentStepDurations: [],
  };
}

function loadSpatialMemoryStats() {
  try {
    const raw = window.localStorage.getItem(SGM_STORAGE_KEY);
    if (!raw) {
      return createInitialSpatialMemoryStats();
    }
    const parsed = JSON.parse(raw);
    return {
      highScore: Number.isFinite(parsed?.highScore) ? parsed.highScore : 0,
      bestRound: Number.isFinite(parsed?.bestRound) ? parsed.bestRound : 1,
      totalRounds: Number.isFinite(parsed?.totalRounds) ? parsed.totalRounds : 0,
      completedRounds: Number.isFinite(parsed?.completedRounds) ? parsed.completedRounds : 0,
    };
  } catch {
    return createInitialSpatialMemoryStats();
  }
}

function saveSpatialMemoryStats(stats) {
  try {
    window.localStorage.setItem(SGM_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore persistence errors
  }
}

function buildSpatialSequence(round, difficultyLevel) {
  const length = Math.max(2, round + 1);
  const sequence = [];
  for (let i = 0; i < length; i += 1) {
    const shouldUseCombo = difficultyLevel >= 4 && i > 0 && Math.random() < 0.25;
    if (shouldUseCombo) {
      const first = randomChoice(SGM_GESTURE_POOL_EARLY);
      const second = pickDistinctRandomChoice(
        [...SGM_GESTURE_POOL_EARLY, ...SGM_GESTURE_POOL_ADVANCED],
        first,
      );
      sequence.push([first, second]);
      continue;
    }
    const pool = difficultyLevel >= 3 && i >= 2
      ? [...SGM_GESTURE_POOL_EARLY, ...SGM_GESTURE_POOL_ADVANCED]
      : SGM_GESTURE_POOL_EARLY;
    sequence.push(randomChoice(pool));
  }
  return sequence;
}

function createInitialLabTrainingState() {
  return {
    active: false,
    phase: "idle",
    gestureId: null,
    gestureLabel: null,
    countdown: 0,
    capturedFrames: 0,
    targetFrames: LAB_TRAIN_CAPTURE_FRAMES,
    message: "Record samples to personalize gesture recognition.",
  };
}

function summarizeEventMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return "";
  }
  if (meta.direction) {
    return `dir=${meta.direction}`;
  }
  if (meta.pointer && Number.isFinite(meta.pointer.x) && Number.isFinite(meta.pointer.y)) {
    return `p=${meta.pointer.x.toFixed(2)},${meta.pointer.y.toFixed(2)}`;
  }
  if (meta.pinchDistance && Number.isFinite(meta.pinchDistance)) {
    return `d=${meta.pinchDistance.toFixed(3)}`;
  }
  return "";
}

function createEmptyPoseStatus() {
  return {
    detected: false,
    score: 0,
    keypointsCount: 0,
    handsCount: 0,
    fingerCount: 0,
    fingertipCount: 0,
    parts: {
      head: false,
      eyes: false,
      shoulders: false,
      arms: false,
      torso: false,
      fingers: false,
      fingertips: false,
    },
    offAxis: createEmptyOffAxisState(),
  };
}

function hasVisiblePoseKeypoints(map, names, minScore = POSE_KEYPOINT_THRESHOLD) {
  for (const name of names) {
    const point = map[name];
    if (point && Number.isFinite(point.score) && point.score >= minScore) {
      return true;
    }
  }
  return false;
}

function isValidHandLandmark(point) {
  return Boolean(point && Number.isFinite(point.u) && Number.isFinite(point.v));
}

function summarizeFingerVisibilityFromHands(hands) {
  const summary = {
    handsCount: Array.isArray(hands) ? hands.length : 0,
    fingerCount: 0,
    fingertipCount: 0,
    fingersVisible: false,
    fingertipsVisible: false,
  };
  if (!Array.isArray(hands) || hands.length === 0) {
    return summary;
  }

  for (const hand of hands) {
    const landmarks = Array.isArray(hand?.landmarks) ? hand.landmarks : [];
    for (const chain of HAND_FINGER_CHAINS) {
      const visibleSegments = chain.filter((index) => isValidHandLandmark(landmarks[index])).length;
      if (visibleSegments >= 3) {
        summary.fingerCount += 1;
      }
    }
    for (const tipIndex of HAND_FINGERTIP_INDEXES) {
      const tipFromLandmarks = landmarks[tipIndex];
      const tipName = FINGERTIP_NAME_BY_INDEX[tipIndex];
      const tipFromFingerTips = hand?.fingerTips?.[tipName];
      if (isValidHandLandmark(tipFromFingerTips) || isValidHandLandmark(tipFromLandmarks)) {
        summary.fingertipCount += 1;
      }
    }
  }

  summary.fingersVisible = summary.fingerCount > 0;
  summary.fingertipsVisible = summary.fingertipCount > 0;
  return summary;
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
    normalized,
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

function clickButtonAtPoint(point, options = {}) {
  const { excludeInsideSelector = null } = options;
  if (!point) {
    return false;
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  for (let index = buttons.length - 1; index >= 0; index -= 1) {
    const button = buttons[index];
    if (!button || button.disabled) {
      continue;
    }
    if (excludeInsideSelector && button.closest(excludeInsideSelector)) {
      continue;
    }

    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    if (isPointInsideClientRect(point, rect)) {
      button.click();
      return true;
    }
  }

  return false;
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
  const trackXIndex = pickRandomRunnerTrackIndex();
  const trackYIndex = pickRandomRunnerTrackIndex();
  return {
    id: Math.random().toString(36).slice(2),
    trackXIndex,
    trackYIndex,
    trackX: getRunnerTrackOffsetFromIndex(trackXIndex, RUNNER_TRACK_GRID_SIZE),
    trackY: getRunnerTrackOffsetFromIndex(trackYIndex, RUNNER_TRACK_GRID_SIZE),
    z: randomBetween(zMin, zMax),
    height: 0,
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
  const gestureEngineRef = useRef(null);
  const personalizationRef = useRef(null);
  const audioFeedbackRef = useRef(null);

  if (!gestureEngineRef.current) {
    gestureEngineRef.current = createGestureEngine({
      logger: createScopedLogger("gestureEngine"),
    });
  }
  if (!personalizationRef.current) {
    personalizationRef.current = createGesturePersonalization({
      logger: createScopedLogger("gesturePersonalization"),
    });
  }
  if (!audioFeedbackRef.current) {
    audioFeedbackRef.current = createAudioFeedback();
  }

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [phase, setPhase] = useState(PHASES.HOME);
  const [productHomeArea, setProductHomeArea] = useState(
    () => getProductHomeAreaFromPath(window.location.pathname) ?? "all",
  );
  const [trackingRequested, setTrackingRequested] = useState(false);
  const [pendingModeId, setPendingModeId] = useState(null);
  const [preferences, setPreferences] = useState(() => loadUserPreferences());
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [motionVisualizerState, setMotionVisualizerState] = useState(() =>
    loadMotionVisualizerState(),
  );
  const motionVisualizerStateRef = useRef(motionVisualizerState);
  motionVisualizerStateRef.current = motionVisualizerState;
  const [motionVisualizerControlsCollapsed, setMotionVisualizerControlsCollapsed] =
    useState(false);
  const [motionVisualizerStatus, setMotionVisualizerStatus] = useState(
    "Motion Visualizer ready.",
  );
  const [deviceCapabilities, setDeviceCapabilities] = useState(() =>
    assessDeviceCapabilities(collectDeviceCapabilitySignals()),
  );
  const dynamicQualityControllerRef = useRef(null);
  if (!dynamicQualityControllerRef.current) {
    dynamicQualityControllerRef.current = createDynamicQualityController({
      capabilities: deviceCapabilities,
    });
  }
  const [dynamicQualityLevel, setDynamicQualityLevel] = useState(
    dynamicQualityControllerRef.current.level,
  );
  const dynamicQualityBudget = useMemo(() => {
    const requestedLevel =
      preferences.performanceMode === "battery"
        ? QUALITY_LEVELS.LOW
        : preferences.performanceMode === "quality"
          ? QUALITY_LEVELS.HIGH
          : dynamicQualityLevel;
    return getDynamicQualityBudget(requestedLevel, {
      reducedMotion: preferences.reducedMotion,
      limitEffects: preferences.lowSensory,
    });
  }, [
    dynamicQualityLevel,
    preferences.lowSensory,
    preferences.performanceMode,
    preferences.reducedMotion,
  ]);
  const capabilityRecommendation = useMemo(
    () =>
      getCapabilityLaunchRecommendation(deviceCapabilities, {
        trackingRequired: true,
        pointerFallback: true,
      }),
    [deviceCapabilities],
  );
  const progressionStoreRef = useRef(null);
  if (!progressionStoreRef.current) {
    progressionStoreRef.current = createGameProgressionStore({
      achievementDefinitions: ACHIEVEMENT_DEFINITIONS,
    });
  }
  const [gameProgression, setGameProgression] = useState(() =>
    progressionStoreRef.current.getState(),
  );
  const [latestGameResult, setLatestGameResult] = useState(null);
  const [arcadeRunIncomingResult, setArcadeRunIncomingResult] =
    useState(null);
  const [experienceLifecycle, setExperienceLifecycle] = useState(null);
  const [experienceModeId, setExperienceModeId] = useState(null);
  const [trackingRecoveryGate, setTrackingRecoveryGate] = useState(() =>
    createTrackingRecoveryGate(),
  );
  const previousAudioLifecycleRef = useRef({
    attempt: null,
    modeId: null,
    phase: null,
  });
  const [trackingReadiness, setTrackingReadiness] = useState(() =>
    createTrackingReadinessState(),
  );
  const [trackingInteractionCheck, setTrackingInteractionCheck] = useState(() =>
    createTrackingInteractionCheck(),
  );
  const [cameraDevices, setCameraDevices] = useState([]);
  const [requestedCameraDeviceId, setRequestedCameraDeviceId] = useState("");
  const [leftPaneWidth, setLeftPaneWidth] = useState(null);
  const [isLeftPaneResizing, setIsLeftPaneResizing] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraAspectRatio, setCameraAspectRatio] = useState(4 / 3);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState("");
  const [modelRetryAttempt, setModelRetryAttempt] = useState(0);
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
  const [cursorTrail, setCursorTrail] = useState([]);
  const [cursorTrailNow, setCursorTrailNow] = useState(() => performance.now());
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [labConfidenceThreshold, setLabConfidenceThreshold] = useState(
    LAB_DEFAULT_CONFIDENCE_THRESHOLD,
  );
  const [labShowSkeleton, setLabShowSkeleton] = useState(true);
  const [labShowTrails, setLabShowTrails] = useState(true);
  const [labPersonalizationEnabled, setLabPersonalizationEnabled] = useState(true);
  const [labEngineOutput, setLabEngineOutput] = useState(createEmptyLabEngineOutput);
  const [labEventLog, setLabEventLog] = useState([]);
  const [labSampleCounts, setLabSampleCounts] = useState(() =>
    personalizationRef.current.getSampleCounts(),
  );
  const [labTrainingState, setLabTrainingState] = useState(createInitialLabTrainingState);
  const [spatialMemoryState, setSpatialMemoryState] = useState(() => {
    const base = createInitialSpatialMemoryState();
    const persisted = loadSpatialMemoryStats();
    return {
      ...base,
      ...persisted,
      successRate: persisted.totalRounds > 0 ? persisted.completedRounds / persisted.totalRounds : 0,
    };
  });
  const [spatialMemoryExperience, setSpatialMemoryExperience] = useState(() =>
    createSpatialMemoryExperience(),
  );
  const [analyticsHands, setAnalyticsHands] = useState([]);
  const [analyticsTimestamp, setAnalyticsTimestamp] = useState(0);
  const [gestureAnalyticsLabSessionKey, setGestureAnalyticsLabSessionKey] = useState(0);
  const [gestureArtHands, setGestureArtHands] = useState([]);
  const [gestureArtSessionKey, setGestureArtSessionKey] = useState(0);
  const [gestureControlOSSessionKey, setGestureControlOSSessionKey] = useState(0);
  const [fullscreenIndexPoints, setFullscreenIndexPoints] = useState([]);
  const [fullscreenTipPoints, setFullscreenTipPoints] = useState([]);
  const [fullscreenBodyPoses, setFullscreenBodyPoses] = useState([]);
  const [fullscreenSkeletonHands, setFullscreenSkeletonHands] = useState([]);
  const [fullscreenDetectedHandCount, setFullscreenDetectedHandCount] = useState(0);
  const [fullscreenGridMode, setFullscreenGridMode] = useState(
    () => motionVisualizerState.effect,
  );
  const [fullscreenExitControlState, setFullscreenExitControlState] = useState(null);
  const [fullscreenRestartControlState, setFullscreenRestartControlState] = useState(null);
  const [fullscreenRingTrail, setFullscreenRingTrail] = useState([]);
  const [fullscreenRingTrailNow, setFullscreenRingTrailNow] = useState(() => performance.now());
  const [fullscreenPulseBursts, setFullscreenPulseBursts] = useState([]);
  const [fullscreenPulseNow, setFullscreenPulseNow] = useState(() => performance.now());
  const [fullscreenTipRippleNow, setFullscreenTipRippleNow] = useState(() => performance.now());
  const [fullscreenHandBounceState, setFullscreenHandBounceState] = useState(null);
  const [fullscreenBrickDodgerState, setFullscreenBrickDodgerState] = useState(null);
  const [fullscreenBreakoutState, setFullscreenBreakoutState] = useState(null);
  const [fullscreenBreakoutCoopState, setFullscreenBreakoutCoopState] = useState(null);
  const [fullscreenFingerPongState, setFullscreenFingerPongState] = useState(null);
  const [fullscreenFruitNinjaState, setFullscreenFruitNinjaState] = useState(null);
  const [fullscreenSkyPatrolHud, setFullscreenSkyPatrolHud] = useState(null);
  const [fullscreenWfcWorldState, setFullscreenWfcWorldState] = useState(null);
  const [fullscreenWfcProjectOpen, setFullscreenWfcProjectOpen] = useState(false);
  const [fullscreenInvadersState, setFullscreenInvadersState] = useState(null);
  const [fullscreenFlappyState, setFullscreenFlappyState] = useState(null);
  const [fullscreenMissileCommandState, setFullscreenMissileCommandState] = useState(null);
  const [fullscreenTicTacToeState, setFullscreenTicTacToeState] = useState(null);
  const [poseModelReady, setPoseModelReady] = useState(false);
  const [poseModelError, setPoseModelError] = useState("");
  const [poseStatus, setPoseStatus] = useState(createEmptyPoseStatus);

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
  });

  const [whackAMoleState, setWhackAMoleState] = useState(() =>
    createWhackAMoleGame(),
  );

  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const cameraWrapRef = useRef(null);
  const contentGridRef = useRef(null);
  const cameraPaneRef = useRef(null);
  const inputTestStageRef = useRef(null);
  const sandboxStageRef = useRef(null);
  const flightStageRef = useRef(null);
  const flightCanvasRef = useRef(null);
  const runnerStageRef = useRef(null);
  const runnerCanvasRef = useRef(null);
  const fullscreenSkyPatrolCanvasRef = useRef(null);
  const inputTestCellRefs = useRef([]);
  const leftPaneResizeStateRef = useRef({
    startWidth: 0,
    startX: 0,
  });

  const detectorRef = useRef(null);
  const detectorMaxHandsRef = useRef(TRACKING_DEFAULT_DETECTOR_MAX_HANDS);
  const detectorModelTypeRef = useRef(dynamicQualityBudget.modelPreference);
  const detectorReconfigurationSeqRef = useRef(0);
  const poseDetectorRef = useRef(null);
  const poseInitPromiseRef = useRef(null);
  const fullscreenBodyPosesRef = useRef([]);
  const fullscreenBodyPoseDetectorRef = useRef(null);
  const fullscreenBodyPoseInitPromiseRef = useRef(null);
  const fullscreenBodyPoseInferenceBusyRef = useRef(false);
  const fullscreenBodyPoseLastInferenceAtRef = useRef(0);
  const streamRef = useRef(null);
  const attachedVideoElementRef = useRef(null);
  const cameraRetryRef = useRef(null);
  const routeInitializedRef = useRef(false);
  const pendingLaunchContextRef = useRef(null);
  const activeLaunchContextRef = useRef({});
  const arcadeRunLaunchRequestRef = useRef(null);
  const activeProgressionSessionRef = useRef(null);
  const experienceLifecycleRef = useRef(null);
  const experienceModeIdRef = useRef(null);
  const trackingRequestedRef = useRef(trackingRequested);
  const trackingInteractionCheckRef = useRef(trackingInteractionCheck);
  const simulationTimingRef = useRef(null);
  if (!simulationTimingRef.current) {
    simulationTimingRef.current = createFixedStepSessionTiming();
  }
  const simulationEpochRef = useRef(null);
  const lifecycleLastTickRef = useRef(0);
  const rafRef = useRef(0);
  const inferenceBusyRef = useRef(false);
  const dynamicQualityBudgetRef = useRef(dynamicQualityBudget);
  const activeInferenceTokenRef = useRef(0);
  const lastInferenceStartedAtRef = useRef(0);
  const lastInferenceCompletedAtRef = useRef(0);
  const lastTrackingKeepAliveAtRef = useRef(0);
  const mountedRef = useRef(true);

  const phaseRef = useRef(phase);
  const poseStatusRef = useRef(poseStatus);
  const spatialMemoryRef = useRef(spatialMemoryState);
  const spatialMemoryExperienceRef = useRef(spatialMemoryExperience);
  const viewportRef = useRef(viewport);
  const transformRef = useRef(transform);
  const cursorRef = useRef(cursor);
  const rawCursorRef = useRef(rawCursor);
  const fallbackPointerRef = useRef({
    active: false,
    justPressed: false,
    pointerType: "mouse",
    pressed: false,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const cursorTrailRef = useRef([]);
  const cursorTrailLastSampleAtRef = useRef(0);
  const fullscreenRingTrailRef = useRef([]);
  const fullscreenRingTrailLastSampleAtRef = useRef(0);
  const fullscreenPulseBurstsRef = useRef([]);
  const fullscreenPulseLastEmitByIdRef = useRef({});
  const fullscreenTipRippleStartedAtRef = useRef(0);
  const fullscreenGridModeRef = useRef(fullscreenGridMode);
  const fullscreenExitControlStateRef = useRef(null);
  const fullscreenExitControlViewportRef = useRef(null);
  const fullscreenExitControlLastTickRef = useRef(0);
  const fullscreenRestartControlStateRef = useRef(null);
  const fullscreenRestartControlViewportRef = useRef(null);
  const fullscreenRestartControlLastTickRef = useRef(0);
  const fullscreenHandsRef = useRef([]);
  const fullscreenPrimaryHandIdRef = useRef(null);
  const fullscreenHandBounceStateRef = useRef(null);
  const fullscreenHandBounceViewportRef = useRef(null);
  const fullscreenHandBounceLastTickRef = useRef(0);
  const fullscreenBrickDodgerStateRef = useRef(null);
  const fullscreenBrickDodgerViewportRef = useRef(null);
  const fullscreenBrickDodgerLastTickRef = useRef(0);
  const fullscreenBreakoutStateRef = useRef(null);
  const fullscreenBreakoutCoopStateRef = useRef(null);
  const fullscreenFingerPongStateRef = useRef(null);
  const fullscreenFruitNinjaStateRef = useRef(null);
  const fullscreenSkyPatrolHudRef = useRef(null);
  const fullscreenSkyPatrolStateRef = useRef(null);
  const fullscreenSkyPatrolRendererRef = useRef(null);
  const fullscreenSkyPatrolSpriteImageRef = useRef(null);
  const fullscreenWfcWorldStateRef = useRef(null);
  const fullscreenWfcWorldViewportRef = useRef(null);
  const fullscreenWfcWorldLastTickRef = useRef(0);
  const fullscreenWfcWorldMouseInputRef = useRef({
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    pinchActive: false,
    pinchStarted: false,
  });
  const fullscreenInvadersStateRef = useRef(null);
  const fullscreenBreakoutViewportRef = useRef(null);
  const fullscreenFingerPongViewportRef = useRef(null);
  const fullscreenBreakoutLastTickRef = useRef(0);
  const fullscreenBreakoutCoopViewportRef = useRef(null);
  const fullscreenBreakoutCoopLastTickRef = useRef(0);
  const fullscreenBreakoutCoopPrimaryPinchLatchRef = useRef(false);
  const fullscreenBreakoutCoopSecondaryPinchLatchRef = useRef(false);
  const fullscreenFingerPongLastTickRef = useRef(0);
  const fullscreenFruitNinjaLastTickRef = useRef(0);
  const fullscreenSkyPatrolViewportRef = useRef(null);
  const fullscreenSkyPatrolLastTickRef = useRef(0);
  const fullscreenInvadersLastTickRef = useRef(0);
  const fullscreenFlappyStateRef = useRef(null);
  const fullscreenFlappyViewportRef = useRef(null);
  const fullscreenFlappyLastTickRef = useRef(0);
  const fullscreenMissileCommandStateRef = useRef(null);
  const fullscreenMissileCommandViewportRef = useRef(null);
  const fullscreenMissileCommandLastTickRef = useRef(0);
  const fullscreenTicTacToeStateRef = useRef(null);
  const fullscreenTicTacToeViewportRef = useRef(null);
  const fullscreenTicTacToeLastTickRef = useRef(0);
  const debugRef = useRef(debugEnabled);
  const labConfidenceThresholdRef = useRef(labConfidenceThreshold);
  const labShowSkeletonRef = useRef(labShowSkeleton);
  const labPersonalizationEnabledRef = useRef(labPersonalizationEnabled);
  const labTrainingSessionRef = useRef(null);
  const handLabelMemoryRef = useRef({ byLabel: {} });

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
  const lastDetectorRecoveryAtRef = useRef(0);
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
    distance: 0,
    coinsCollected: 0,
    coins: [],
  });
  const runnerHudLastUpdateRef = useRef(0);
  const runnerGeometryLogKeyRef = useRef("");

  const whackAMoleStateRef = useRef(whackAMoleState);

  const currentTarget = useMemo(
    () => calibrationTargets[calibrationTargetIndex] ?? null,
    [calibrationTargets, calibrationTargetIndex],
  );
  const isFullscreenCameraPhase = phase === PHASES.FULLSCREEN_CAMERA;
  const isProductHomePhase = phase === PHASES.HOME;
  const isProductTrackingSetupPhase = phase === PHASES.TRACKING_SETUP;
  const isProductSettingsPhase = phase === PHASES.SETTINGS;
  const arcadeRunModes = useMemo(() => listModes(), []);
  const arcadeRunCapabilityOptions = useMemo(
    () => ({
      playerCount: 1,
      pointerAvailable: true,
      preferredInput: cameraReady && modelReady ? "tracking" : "pointer",
      availableTrackingProfiles:
        cameraReady && modelReady
          ? Object.values(TRACKING_PROFILES)
          : [],
      excludeModeIds: ["arcade-run"],
    }),
    [cameraReady, modelReady],
  );
  const productTrackingStatus =
    trackingReadiness.status === TRACKING_READINESS_STATES.READY
      ? "ready"
      : [
            TRACKING_READINESS_STATES.DENIED,
            TRACKING_READINESS_STATES.NO_DEVICE,
            TRACKING_READINESS_STATES.DEVICE_BUSY,
            TRACKING_READINESS_STATES.UNSUPPORTED,
            TRACKING_READINESS_STATES.INSECURE,
            TRACKING_READINESS_STATES.MODEL_ERROR,
            TRACKING_READINESS_STATES.ERROR,
            TRACKING_READINESS_STATES.INTERRUPTED,
          ].includes(trackingReadiness.status)
        ? "error"
        : trackingRequested
          ? "loading"
          : "idle";
  const trackingRecoveryRequired = Boolean(
    experienceModeId &&
      trackingRequested &&
      getModeById(experienceModeId)?.trackingProfile !==
        TRACKING_PROFILES.NONE,
  );
  const trackingRecoveryStatus = getTrackingRecoveryStatus(
    trackingRecoveryGate,
  );
  const isMinorityReportLabPhase = phase === PHASES.MINORITY_REPORT_LAB;
  const isImmersiveAppPhase = shouldUseImmersiveAppLayout(phase);
  const fullscreenExperienceMode = getModeByFullscreenId(fullscreenGridMode);
  const isMotionVisualizerMode =
    isFullscreenCameraPhase &&
    isMotionVisualizerEffect(fullscreenGridMode);
  const motionVisualizerPalette = getMotionVisualizerPalette(
    motionVisualizerState.palette,
  );
  const motionVisualizerRingLayers = useMemo(
    () =>
      FULLSCREEN_RING_LAYERS.map((layer, index) => ({
        ...layer,
        color:
          motionVisualizerPalette.colors[
            index % motionVisualizerPalette.colors.length
          ],
      })),
    [motionVisualizerPalette],
  );
  const motionVisualizerTrailDurationMs =
    getMotionVisualizerTrailDurationMs(motionVisualizerState);
  const motionVisualizerPulseDurationMs =
    getMotionVisualizerPulseDurationMs(motionVisualizerState);
  const motionVisualizerStageStyle = isMotionVisualizerMode
    ? {
        "--visualizer-background": motionVisualizerPalette.background,
        "--visualizer-line": motionVisualizerPalette.line,
        "--visualizer-color-1": motionVisualizerPalette.colors[0],
        "--visualizer-color-2": motionVisualizerPalette.colors[1],
        "--visualizer-color-3": motionVisualizerPalette.colors[2],
        "--visualizer-color-4": motionVisualizerPalette.colors[3],
        "--visualizer-color-5": motionVisualizerPalette.colors[4],
        "--visualizer-camera-opacity":
          motionVisualizerState.cameraOpacity / 100,
        "--visualizer-layer-opacity":
          0.28 + motionVisualizerState.intensity * 0.0072,
        "--visualizer-glow-strength": `${
          2 + motionVisualizerState.intensity * 0.13
        }px`,
      }
    : undefined;
  const isFullscreenBreakoutGridMode =
    fullscreenGridMode === "breakout" ||
    fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID;
  const isFullscreenHandBounceMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "hand-bounce" &&
    Boolean(fullscreenHandBounceState);
  const isFullscreenBrickDodgerMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "brick-dodger" &&
    Boolean(fullscreenBrickDodgerState);
  const isFullscreenBreakoutMode =
    isFullscreenCameraPhase && isFullscreenBreakoutGridMode && Boolean(fullscreenBreakoutState);
  const isFullscreenBreakoutCoopMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "breakout-coop" &&
    Boolean(fullscreenBreakoutCoopState);
  const isFullscreenFingerPongMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "finger-pong" &&
    Boolean(fullscreenFingerPongState);
  const fullscreenFingerPongMatchUi = getFingerPongMatchUi(
    fullscreenFingerPongState,
  );
  const isFullscreenFruitNinjaMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "fruit-ninja" &&
    Boolean(fullscreenFruitNinjaState);
  const isFullscreenSkyPatrolMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "sky-patrol" &&
    Boolean(fullscreenSkyPatrolHud);
  const isFullscreenWfcWorldMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === WFC_WORLD_MODE_ID &&
    Boolean(fullscreenWfcWorldState);
  const isFullscreenInvadersMode =
    isFullscreenCameraPhase && fullscreenGridMode === "invaders" && Boolean(fullscreenInvadersState);
  const isFullscreenFlappyMode =
    isFullscreenCameraPhase && fullscreenGridMode === "flappy" && Boolean(fullscreenFlappyState);
  const isFullscreenMissileCommandMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "missile-command" &&
    Boolean(fullscreenMissileCommandState);
  const isFullscreenTicTacToeMode =
    isFullscreenCameraPhase &&
    fullscreenGridMode === "tic-tac-toe" &&
    Boolean(fullscreenTicTacToeState);
  const fullscreenRestartControlLabel = getFullscreenRestartControlLabel(fullscreenGridMode, {
    handBounce: fullscreenHandBounceState,
    brickDodger: fullscreenBrickDodgerState,
    breakout: fullscreenBreakoutState,
    fingerPong: fullscreenFingerPongState,
    fruitNinja: fullscreenFruitNinjaState,
    skyPatrol: fullscreenSkyPatrolHud,
    missileCommand: fullscreenMissileCommandState,
  });
  const fullscreenTicTacToeLayout = fullscreenTicTacToeState?.layout ?? null;
  const fullscreenTicTacToeHasActiveBoard =
    fullscreenTicTacToeState?.board?.some(Boolean) ?? false;
  const fullscreenTicTacToePlayerCount =
    fullscreenTicTacToeState?.board?.filter((mark) => mark === TIC_TAC_TOE_PLAYER_MARK).length ?? 0;
  const fullscreenTicTacToeAiCount =
    fullscreenTicTacToeState?.board?.filter((mark) => mark === TIC_TAC_TOE_AI_MARK).length ?? 0;
  const fullscreenTicTacToePlayerReserveCount = Math.max(
    0,
    TIC_TAC_TOE_PLAYER_PIECE_LIMIT -
      fullscreenTicTacToePlayerCount -
      (fullscreenTicTacToeState?.draggingPiece ? 1 : 0),
  );
  const fullscreenTicTacToeAiReserveCount = Math.max(
    0,
    TIC_TAC_TOE_AI_PIECE_LIMIT - fullscreenTicTacToeAiCount,
  );
  const fullscreenTicTacToePlayerReservePips = getTicTacToeReservePips(
    fullscreenTicTacToePlayerReserveCount,
    TIC_TAC_TOE_PLAYER_PIECE_LIMIT,
  );
  const fullscreenTicTacToeAiReservePips = getTicTacToeReservePips(
    fullscreenTicTacToeAiReserveCount,
    TIC_TAC_TOE_AI_PIECE_LIMIT,
  );
  const fullscreenTicTacToeTurnUi = getTicTacToeTurnUi(fullscreenTicTacToeState);
  const fullscreenTicTacToeHudUi = getTicTacToeHudUi(fullscreenTicTacToeState, {
    playerWins: fullscreenTicTacToeState?.playerWins ?? 0,
    aiWins: fullscreenTicTacToeState?.aiWins ?? 0,
    draws: fullscreenTicTacToeState?.draws ?? 0,
    boardCount: fullscreenTicTacToePlayerCount + fullscreenTicTacToeAiCount,
  });
  const fullscreenTicTacToeResetUi = getTicTacToeResetUi(fullscreenTicTacToeState, {
    hasActiveBoard: fullscreenTicTacToeHasActiveBoard,
    totalMs: TIC_TAC_TOE_RESET_HOLD_MS,
  });
  const fullscreenTicTacToeWinningLineUi = getTicTacToeWinningLineUi(
    fullscreenTicTacToeLayout,
    fullscreenTicTacToeState?.winningLine,
  );
  const fullscreenTicTacToeDraggingCellIndex =
    fullscreenTicTacToeState?.draggingPiece && fullscreenTicTacToeLayout
      ? getTicTacToeCellIndex(
          fullscreenTicTacToeLayout,
          fullscreenTicTacToeState.draggingPiece.x,
          fullscreenTicTacToeState.draggingPiece.y,
        )
      : -1;
  const fullscreenTicTacToeCursorUi = getTicTacToeCursorUi(fullscreenTicTacToeState, {
    handDetected,
    pinchActive,
    draggingCellIndex: fullscreenTicTacToeDraggingCellIndex,
  });
  const fullscreenExitControlCountdown = (
    Math.max(
      0,
      FULLSCREEN_HOLD_CONTROL_MS - (fullscreenExitControlState?.holdMs ?? 0),
    ) / 1000
  ).toFixed(2);
  const fullscreenRestartControlCountdown = (
    Math.max(
      0,
      FULLSCREEN_HOLD_CONTROL_MS - (fullscreenRestartControlState?.holdMs ?? 0),
    ) / 1000
  ).toFixed(2);
  const isSandboxPhase = phase === PHASES.SANDBOX;
  const isCalibrationLayoutPhase =
    phase === PHASES.CALIBRATION ||
    phase === PHASES.FULLSCREEN_CAMERA ||
    isSandboxPhase ||
    phase === PHASES.FLIGHT ||
    phase === PHASES.RUNNER ||
    phase === PHASES.BODY_POSE ||
    phase === PHASES.OFF_AXIS_LAB ||
    phase === PHASES.MINORITY_REPORT_LAB ||
    phase === PHASES.CONVEYOR ||
    phase === PHASES.ROULETTE ||
    phase === PHASES.SPATIAL_GESTURE_MEMORY ||
    phase === PHASES.GESTURE_ANALYTICS_LAB ||
    phase === PHASES.GESTURE_ART_LAB ||
    phase === PHASES.GESTURE_CONTROL_OS;
  const cameraPanelTitle =
    phase === PHASES.FULLSCREEN_CAMERA
      ? "Fullscreen Camera"
      : phase === PHASES.FLIGHT
      ? "Camera + Flight Controls"
      : phase === PHASES.RUNNER
      ? "Camera + Runner Controls"
      : phase === PHASES.BODY_POSE
      ? "Camera + Body Pose Highlight"
      : phase === PHASES.OFF_AXIS_LAB
      ? "Camera + Off-Axis Forest Walk"
      : phase === PHASES.MINORITY_REPORT_LAB
      ? "Camera + Minority Report Controls"
      : phase === PHASES.CONVEYOR
      ? "Camera + Conveyor Toss Controls"
      : phase === PHASES.ROULETTE
      ? "Camera + Roulette Controls"
      : phase === PHASES.SPATIAL_GESTURE_MEMORY
      ? "Camera + Spatial Memory Controls"
      : phase === PHASES.GESTURE_ANALYTICS_LAB
      ? "Camera + Gesture Analytics"
      : phase === PHASES.GESTURE_ART_LAB
      ? "Camera + Gesture Art Controls"
      : phase === PHASES.GESTURE_CONTROL_OS
      ? "Camera + Gesture Control OS"
      : phase === PHASES.GAME
      ? "Camera + Tracking"
      : phase === PHASES.SANDBOX
      ? "Camera + Pinch Sandbox Controls"
      : "Camera + Calibration Controls";
  const showInlineCameraPreview = shouldShowInlineCameraPreview(phase);
  const inputTestPinchingCell =
    phase === PHASES.CALIBRATION && !isCalibrating && pinchActive
      ? inputTestHoveredCell
      : -1;
  const isBodyPosePhase = phase === PHASES.BODY_POSE || phase === PHASES.OFF_AXIS_LAB;
  const hideInactiveCameraPane =
    !trackingRequested &&
    phase !== PHASES.CALIBRATION &&
    Boolean(getModeByPhase(phase)?.supportsPointerFallback);
  const showLeftPaneResizer =
    !hideInactiveCameraPane &&
    !isBodyPosePhase &&
    viewport.width > DESKTOP_LAYOUT_BREAKPOINT_PX;

  const getContentGridWidth = () =>
    contentGridRef.current?.getBoundingClientRect().width ?? viewport.width;

  const getMeasuredLeftPaneWidth = () => {
    const measuredWidth = cameraPaneRef.current?.getBoundingClientRect().width;
    if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
      return measuredWidth;
    }
    if (Number.isFinite(leftPaneWidth) && leftPaneWidth > 0) {
      return leftPaneWidth;
    }
    return clampResizableLeftPaneWidth(viewport.width * 0.42, getContentGridWidth());
  };

  const getMaxLeftPaneWidth = () =>
    clampResizableLeftPaneWidth(Number.POSITIVE_INFINITY, getContentGridWidth());

  const setClampedLeftPaneWidth = (nextWidth) => {
    const clampedWidth = clampResizableLeftPaneWidth(nextWidth, getContentGridWidth());
    setLeftPaneWidth(clampedWidth);
    return clampedWidth;
  };

  const handleLeftPaneResizerPointerDown = (event) => {
    if (!showLeftPaneResizer) {
      return;
    }

    const startingWidth = getMeasuredLeftPaneWidth();
    if (!Number.isFinite(startingWidth) || startingWidth <= 0) {
      return;
    }

    leftPaneResizeStateRef.current = {
      startWidth: startingWidth,
      startX: event.clientX,
    };
    setIsLeftPaneResizing(true);
    event.preventDefault();
  };

  const handleLeftPaneResizerKeyDown = (event) => {
    if (!showLeftPaneResizer) {
      return;
    }

    const currentWidth = getMeasuredLeftPaneWidth();
    if (!Number.isFinite(currentWidth) || currentWidth <= 0) {
      return;
    }

    if (event.key === "ArrowLeft") {
      setClampedLeftPaneWidth(currentWidth - LEFT_PANE_RESIZE_KEYBOARD_STEP_PX);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight") {
      setClampedLeftPaneWidth(currentWidth + LEFT_PANE_RESIZE_KEYBOARD_STEP_PX);
      event.preventDefault();
      return;
    }

    if (event.key === "Home") {
      setClampedLeftPaneWidth(RESIZABLE_LEFT_PANE_MIN_WIDTH_PX);
      event.preventDefault();
      return;
    }

    if (event.key === "End") {
      setClampedLeftPaneWidth(getMaxLeftPaneWidth());
      event.preventDefault();
    }
  };

  const cameraObjectFit = getCameraObjectFitForPhase(phase);
  const fullscreenCameraViewport = useMemo(() => {
    if (!isFullscreenCameraPhase) {
      return null;
    }

    const stageWidth = viewport.width;
    const stageHeight = viewport.height;
    if (isMotionVisualizerMode) {
      return {
        left: 0,
        top: 0,
        width: stageWidth,
        height: stageHeight,
        style: {
          left: "0px",
          top: "0px",
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
        },
      };
    }
    const aspectRatio =
      Number.isFinite(cameraAspectRatio) && cameraAspectRatio > 0 ? cameraAspectRatio : 4 / 3;
    return createFullscreenCameraViewport(stageWidth, stageHeight, aspectRatio);
  }, [
    cameraAspectRatio,
    isFullscreenCameraPhase,
    isMotionVisualizerMode,
    viewport.height,
    viewport.width,
  ]);
  const fullscreenBrowserViewport = useMemo(() => {
    if (!isFullscreenCameraPhase) {
      return null;
    }

    return {
      left: 0,
      top: 0,
      width: viewport.width,
      height: viewport.height,
      style: {
        left: "0px",
        top: "0px",
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
      },
    };
  }, [isFullscreenCameraPhase, viewport.height, viewport.width]);
  const fullscreenBreakoutViewport =
    fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID
      ? fullscreenBrowserViewport
      : fullscreenCameraViewport;
  const fullscreenTicTacToeCursorPoint =
    isFullscreenTicTacToeMode &&
    fullscreenCameraViewport &&
    handDetected &&
    Number.isFinite(cursor.x) &&
    Number.isFinite(cursor.y)
      ? {
          x: clampValue(cursor.x - fullscreenCameraViewport.left, 0, fullscreenCameraViewport.width),
          y: clampValue(cursor.y - fullscreenCameraViewport.top, 0, fullscreenCameraViewport.height),
        }
      : null;

  const fullscreenCameraGridMetrics = useMemo(() => {
    if (!fullscreenCameraViewport) {
      return null;
    }

    const { left, top, width, height, style } = fullscreenCameraViewport;
    const colCount = Math.ceil(width / FULLSCREEN_GRID_SIZE_PX);
    const rowCount = Math.ceil(height / FULLSCREEN_GRID_SIZE_PX);
    const cellPriority = {
      outer: 1,
      neighbor: 2,
      highlight: 3,
    };
    const cellMap = new Map();
    const registerCell = (col, row, type) => {
      if (col < 0 || row < 0 || col >= colCount || row >= rowCount) {
        return;
      }
      const key = `${col}-${row}`;
      const existing = cellMap.get(key);
      if (existing && cellPriority[existing.type] >= cellPriority[type]) {
        return;
      }
      const cellLeft = col * FULLSCREEN_GRID_SIZE_PX;
      const cellTop = row * FULLSCREEN_GRID_SIZE_PX;
      cellMap.set(key, {
        key,
        type,
        style: {
          left: `${cellLeft}px`,
          top: `${cellTop}px`,
          width: `${Math.min(FULLSCREEN_GRID_SIZE_PX, width - cellLeft)}px`,
          height: `${Math.min(FULLSCREEN_GRID_SIZE_PX, height - cellTop)}px`,
        },
      });
    };

    for (const point of fullscreenIndexPoints) {
      const isPointInside =
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y) &&
        point.x >= left &&
        point.x <= left + width &&
        point.y >= top &&
        point.y <= top + height;
      if (!isPointInside) {
        continue;
      }

      const col = Math.min(Math.floor((point.x - left) / FULLSCREEN_GRID_SIZE_PX), colCount - 1);
      const row = Math.min(Math.floor((point.y - top) / FULLSCREEN_GRID_SIZE_PX), rowCount - 1);
      registerCell(col, row, "highlight");

      for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
        for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
          const distance = Math.max(Math.abs(rowOffset), Math.abs(colOffset));
          if (distance === 0) {
            continue;
          }
          if (distance === 1) {
            registerCell(col + colOffset, row + rowOffset, "neighbor");
          } else if (distance === 2) {
            registerCell(col + colOffset, row + rowOffset, "outer");
          }
        }
      }
    }

    const highlight = [];
    const neighbors = [];
    const outerRing = [];
    for (const cell of cellMap.values()) {
      if (cell.type === "highlight") {
        highlight.push(cell);
      } else if (cell.type === "neighbor") {
        neighbors.push(cell);
      } else {
        outerRing.push(cell);
      }
    }

    return {
      style,
      highlight,
      neighbors,
      outerRing,
    };
  }, [fullscreenCameraViewport, fullscreenIndexPoints]);

  const fullscreenMissileAimPoint = useMemo(() => {
    if (
      !isFullscreenMissileCommandMode ||
      !fullscreenCameraViewport ||
      !handDetected ||
      !Number.isFinite(cursor.x) ||
      !Number.isFinite(cursor.y)
    ) {
      return null;
    }

    return {
      x: clampValue(cursor.x - fullscreenCameraViewport.left, 0, fullscreenCameraViewport.width),
      y: clampValue(cursor.y - fullscreenCameraViewport.top, 0, fullscreenCameraViewport.height),
    };
  }, [cursor.x, cursor.y, fullscreenCameraViewport, handDetected, isFullscreenMissileCommandMode]);
  const fullscreenBrickDodgerStageUi = useMemo(
    () => getBrickDodgerStageUi(fullscreenBrickDodgerState),
    [fullscreenBrickDodgerState],
  );
  const fullscreenBrickDodgerTelegraphs = useMemo(
    () => getBrickDodgerLaneTelegraphUi(fullscreenBrickDodgerState),
    [fullscreenBrickDodgerState],
  );
  const fullscreenBrickDodgerMultiplierUi = useMemo(
    () => getBrickDodgerMultiplierUi(fullscreenBrickDodgerState),
    [fullscreenBrickDodgerState],
  );
  const fullscreenBrickDodgerSlowTimeUi = useMemo(
    () => getBrickDodgerSlowTimeUi(fullscreenBrickDodgerState),
    [fullscreenBrickDodgerState],
  );
  const fullscreenBrickDodgerStageRecapUi = useMemo(
    () => getBrickDodgerStageRecapUi(fullscreenBrickDodgerState),
    [fullscreenBrickDodgerState],
  );
  const fullscreenBrickDodgerResultUi = useMemo(
    () => getBrickDodgerResultUi(fullscreenBrickDodgerState),
    [fullscreenBrickDodgerState],
  );
  const fullscreenHandBounceHudUi = useMemo(
    () => getFullscreenHandBounceHudUi(fullscreenHandBounceState),
    [fullscreenHandBounceState],
  );
  const fullscreenHandBounceStageUi = useMemo(
    () => getFullscreenHandBounceStageUi(fullscreenHandBounceState),
    [fullscreenHandBounceState],
  );
  const fullscreenHandBounceTargetUi = useMemo(
    () => getFullscreenHandBounceTargetUi(fullscreenHandBounceState),
    [fullscreenHandBounceState],
  );
  const fullscreenHandBouncePowerUi = useMemo(
    () => getFullscreenHandBouncePowerUi(fullscreenHandBounceState),
    [fullscreenHandBounceState],
  );
  const fullscreenHandBounceCheckpointUi = useMemo(
    () => getFullscreenHandBounceCheckpointUi(fullscreenHandBounceState),
    [fullscreenHandBounceState],
  );
  const fullscreenHandBounceResultUi = useMemo(
    () => getFullscreenHandBounceResultUi(fullscreenHandBounceState),
    [fullscreenHandBounceState],
  );
  const fullscreenHandBounceLegendUi = useMemo(
    () => getFullscreenHandBounceLegendUi(),
    [],
  );
  const fullscreenWfcWorldGoalUi = useMemo(
    () => getWfcWorldGoalModel(fullscreenWfcWorldState),
    [fullscreenWfcWorldState],
  );
  const fullscreenMissileLaunchPreview = useMemo(
    () => getMissileCommandLaunchPreview(fullscreenMissileCommandState, fullscreenMissileAimPoint),
    [fullscreenMissileAimPoint, fullscreenMissileCommandState],
  );
  const fullscreenMissileCooldownUi = useMemo(
    () => getMissileCommandCooldownUi(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileCrosshairUi = useMemo(
    () =>
      getMissileCommandCrosshairUi(
        fullscreenMissileCommandState,
        fullscreenMissileAimPoint,
        handDetected,
      ),
    [fullscreenMissileAimPoint, fullscreenMissileCommandState, handDetected],
  );
  const fullscreenMissileTargetWarnings = useMemo(
    () => getMissileCommandTargetWarnings(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileLegendItems = useMemo(
    () => getMissileCommandLegendItems(MISSILE_COMMAND_THREAT_SCORE),
    [],
  );
  const fullscreenMissileTacticalMetrics = useMemo(
    () => getMissileCommandTacticalMetrics(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileResourceUi = useMemo(
    () => getMissileCommandResourceUi(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileWaveUi = useMemo(
    () => getMissileCommandWaveUi(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileIntermissionUi = useMemo(
    () => getMissileCommandIntermissionUi(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileCountdownUi = useMemo(
    () => getMissileCommandCountdownUi(fullscreenMissileCommandState),
    [fullscreenMissileCommandState],
  );
  const fullscreenMissileGameOverUi = useMemo(
    () => getMissileCommandGameOverUi(fullscreenMissileCommandState, "Restart Defense"),
    [fullscreenMissileCommandState],
  );
  const fullscreenSkyPatrolHudItems = useMemo(
    () => getSkyPatrolHudItems(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolFireCooldownUi = useMemo(
    () => getSkyPatrolFireCooldownUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolGunCooldownUi = useMemo(
    () => getSkyPatrolGunCooldownUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolLifeIcons = useMemo(
    () => getSkyPatrolLifeIcons(fullscreenSkyPatrolHud?.lives ?? 0, SKY_PATROL_STARTING_LIVES),
    [fullscreenSkyPatrolHud?.lives],
  );
  const fullscreenSkyPatrolGameOverUi = useMemo(
    () => getSkyPatrolGameOverUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolLegendUi = useMemo(
    () => getSkyPatrolLegendUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolStartPromptUi = useMemo(
    () => getSkyPatrolStartPromptUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolMissionUi = useMemo(
    () => getSkyPatrolMissionUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolCheckpointUi = useMemo(
    () => getSkyPatrolCheckpointUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolComboUi = useMemo(
    () => getSkyPatrolComboUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenSkyPatrolOnboardingUi = useMemo(
    () => getSkyPatrolOnboardingUi(fullscreenSkyPatrolHud),
    [fullscreenSkyPatrolHud],
  );
  const fullscreenFruitNinjaRoundUi = useMemo(
    () => getFruitNinjaRoundUi(fullscreenFruitNinjaState),
    [fullscreenFruitNinjaState],
  );
  const fullscreenFruitNinjaHudUi = useMemo(
    () =>
      getFruitNinjaHud(
        fullscreenFruitNinjaState,
        typeof performance === "undefined" ? 0 : performance.now(),
      ),
    [fullscreenFruitNinjaState],
  );
  const fullscreenFruitNinjaBombWarnings = useMemo(
    () => getFruitNinjaBombWarnings(fullscreenFruitNinjaState),
    [fullscreenFruitNinjaState],
  );
  const fullscreenFruitNinjaComboUi = useMemo(
    () =>
      getFruitNinjaComboUi(
        fullscreenFruitNinjaState,
        typeof performance === "undefined" ? 0 : performance.now(),
      ),
    [fullscreenFruitNinjaState],
  );
  const fullscreenFruitNinjaPrecisionUi = useMemo(
    () => getFruitNinjaPrecisionUi(fullscreenFruitNinjaState?.lastSlice),
    [fullscreenFruitNinjaState?.lastSlice],
  );
  const fullscreenFruitNinjaPowerUi = useMemo(
    () => getFruitNinjaPowerUi(fullscreenFruitNinjaState),
    [fullscreenFruitNinjaState],
  );
  const fullscreenFruitNinjaRecapUi = useMemo(
    () => getFruitNinjaRecapUi(fullscreenFruitNinjaState, "Restart Round"),
    [fullscreenFruitNinjaState],
  );
  const fullscreenFruitNinjaLegendItems = useMemo(
    () => getFruitNinjaLegendItems(),
    [],
  );

  const fullscreenHexGridMetrics = useMemo(() => {
    if (!fullscreenCameraViewport) {
      return null;
    }

    const { left, top, width, height, style } = fullscreenCameraViewport;
    const { cells, cellMap } = buildFullscreenHexCells(width, height);
    const cellPriority = {
      outer: 1,
      neighbor: 2,
      highlight: 3,
    };
    const highlightedCellMap = new Map();

    const registerCell = (cell, type) => {
      if (!cell) {
        return;
      }
      const existing = highlightedCellMap.get(cell.key);
      if (existing && cellPriority[existing.type] >= cellPriority[type]) {
        return;
      }
      highlightedCellMap.set(cell.key, {
        key: cell.key,
        type,
        style: cell.style,
      });
    };

    for (const point of fullscreenIndexPoints) {
      const isPointInside =
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y) &&
        point.x >= left &&
        point.x <= left + width &&
        point.y >= top &&
        point.y <= top + height;
      if (!isPointInside) {
        continue;
      }

      let nearestCell = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const cell of cells) {
        const dx = point.x - (left + cell.centerX);
        const dy = point.y - (top + cell.centerY);
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestCell = cell;
        }
      }
      if (!nearestCell) {
        continue;
      }

      registerCell(nearestCell, "highlight");

      for (const candidate of cells) {
        const dq = candidate.q - nearestCell.q;
        const dr = candidate.r - nearestCell.r;
        const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
        if (distance === 1) {
          registerCell(candidate, "neighbor");
        } else if (distance === 2) {
          registerCell(candidate, "outer");
        }
      }
    }

    const highlight = [];
    const neighbors = [];
    const outerRing = [];
    for (const cell of highlightedCellMap.values()) {
      if (cell.type === "highlight") {
        highlight.push(cell);
      } else if (cell.type === "neighbor") {
        neighbors.push(cell);
      } else {
        outerRing.push(cell);
      }
    }

    return {
      style,
      cells,
      highlight,
      neighbors,
      outerRing,
    };
  }, [fullscreenCameraViewport, fullscreenIndexPoints]);

  const fullscreenVoronoiMetrics = useMemo(() => {
    if (!fullscreenCameraViewport) {
      return null;
    }

    const { left, top, width, height, style } = fullscreenCameraViewport;
    const sites = fullscreenTipPoints.filter(
      (point) =>
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y) &&
        point.x >= left &&
        point.x <= left + width &&
        point.y >= top &&
        point.y <= top + height,
    );

    const cells = sites
      .map((point, index) => {
        const polygon = buildStaticRippleClipPolygon(point, sites, fullscreenCameraViewport);
        if (!polygon || polygon.length < 3) {
          return null;
        }
        return {
          key: point.id,
          color:
            motionVisualizerPalette.colors[
              index % motionVisualizerPalette.colors.length
            ],
          polygon,
        };
      })
      .filter(Boolean);

    return {
      style,
      cells,
      sites: sites.map((point) => ({
        id: point.id,
        x: point.x - left,
        y: point.y - top,
      })),
      width,
      height,
    };
  }, [
    fullscreenCameraViewport,
    fullscreenTipPoints,
    motionVisualizerPalette,
  ]);

  const fullscreenBodySkeletonOverlay = useMemo(
    () =>
      createFullscreenBodySkeletonOverlay(fullscreenBodyPoses, fullscreenCameraViewport, {
        keypointThreshold: POSE_KEYPOINT_THRESHOLD,
        maxPeople: FULLSCREEN_BODY_SKELETON_MAX_PEOPLE,
      }),
    [fullscreenBodyPoses, fullscreenCameraViewport],
  );
  const fullscreenHandSkeletonOverlay = useMemo(
    () =>
      createFullscreenHandSkeletonOverlay(fullscreenSkeletonHands, fullscreenCameraViewport, {
        maxHands: FULLSCREEN_HAND_SKELETON_MAX_HANDS,
      }),
    [fullscreenSkeletonHands, fullscreenCameraViewport],
  );
  const fullscreenDetectedBodyCount = fullscreenBodySkeletonOverlay?.people.length ?? 0;

  async function attachStreamToVideoElement(video, reason) {
    const stream = streamRef.current;
    if (!video || !stream) {
      return false;
    }

    const previousAttachedVideoElement = attachedVideoElementRef.current;

    try {
      await attachCameraStreamToVideo({ video, stream });
    } catch (error) {
      appLog.warn("Video playback could not be resumed for active camera element", {
        reason,
        error,
      });
      throw (
        error instanceof Error
          ? error
          : new Error("Camera video playback could not be started.")
      );
    }

    if (
      previousAttachedVideoElement &&
      previousAttachedVideoElement !== video &&
      previousAttachedVideoElement.srcObject === stream
    ) {
      previousAttachedVideoElement.srcObject = null;
    }
    attachedVideoElementRef.current = video;

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
      appLog.info("Camera stream attached to active video element", {
        reason,
        measuredWidth,
        measuredHeight,
        ratio: roundMetric(ratio, 6),
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    } else {
      appLog.warn("Camera stream attached but dimensions are not ready yet", {
        reason,
        measuredWidth,
        measuredHeight,
      });
    }

    return true;
  }

  function resetTrackingInteractionCheck() {
    const next = createTrackingInteractionCheck();
    trackingInteractionCheckRef.current = next;
    setTrackingInteractionCheck(next);
  }

  function publishTrackingInteractionSample(sample) {
    if (phaseRef.current !== PHASES.TRACKING_SETUP) {
      return;
    }
    const next = updateTrackingInteractionCheck(
      trackingInteractionCheckRef.current,
      sample,
    );
    trackingInteractionCheckRef.current = next;
    setTrackingInteractionCheck(next);
  }

  function clearCameraTrackingReadiness() {
    activeInferenceTokenRef.current += 1;
    inferenceBusyRef.current = false;
    inferenceBusySkipCounterRef.current = 0;
    lastInferenceStartedAtRef.current = 0;
    lastInferenceCompletedAtRef.current = 0;
    lastTrackingKeepAliveAtRef.current = 0;
    lastValidHandTimestampRef.current = 0;
    handGraceFrameCounterRef.current = 0;
    lastFrameTimeRef.current = 0;
    fpsRef.current = 0;
    handLabelMemoryRef.current = { byLabel: {} };
    fullscreenHandsRef.current = [];
    fullscreenPrimaryHandIdRef.current = null;
    fullscreenBodyPosesRef.current = [];
    handDetectedRef.current = false;
    pinchStateRef.current = false;
    resetTrackingInteractionCheck();
    poseStatusRef.current = createEmptyPoseStatus();
    setCameraReady(false);
    setHandDetected(false);
    setPinchActive(false);
    setFps(0);
    setFullscreenDetectedHandCount(0);
    setFullscreenIndexPoints([]);
    setFullscreenTipPoints([]);
    setFullscreenBodyPoses([]);
    setFullscreenSkeletonHands([]);
    setPoseStatus(createEmptyPoseStatus());
  }

  function retryCamera(reason = "manual_retry") {
    const retry = cameraRetryRef.current;
    if (typeof retry === "function") {
      retry(reason);
    }
  }

  function getTrackingTimestamp() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function beginTrackingInference(timestamp) {
    const inferenceToken = activeInferenceTokenRef.current + 1;
    activeInferenceTokenRef.current = inferenceToken;
    lastInferenceStartedAtRef.current = timestamp;
    inferenceBusyRef.current = true;
    return inferenceToken;
  }

  function completeTrackingInference(inferenceToken) {
    lastInferenceCompletedAtRef.current = getTrackingTimestamp();
    if (activeInferenceTokenRef.current === inferenceToken) {
      inferenceBusyRef.current = false;
    }
  }

  function isCurrentTrackingInference(inferenceToken) {
    return activeInferenceTokenRef.current === inferenceToken;
  }

  function publishFullscreenBodyPoses(poses) {
    const safePoses = adaptPosesForCamera(
      Array.isArray(poses)
        ? poses.slice(0, FULLSCREEN_BODY_SKELETON_MAX_PEOPLE)
        : [],
      preferencesRef.current.mirrorCamera,
    );
    fullscreenBodyPosesRef.current = safePoses;
    setFullscreenBodyPoses(safePoses);
  }

  async function ensureFullscreenBodyPoseDetectorInitialized(reason = "fullscreen_body_skeleton") {
    if (fullscreenBodyPoseDetectorRef.current) {
      return true;
    }

    if (fullscreenBodyPoseInitPromiseRef.current) {
      await fullscreenBodyPoseInitPromiseRef.current;
      return Boolean(fullscreenBodyPoseDetectorRef.current);
    }

    const requestedBackend = getCurrentBackend() === "cpu" ? "cpu" : "webgl";
    fullscreenBodyPoseInitPromiseRef.current = (async () => {
      let detector = null;
      try {
        appLog.info("Initializing fullscreen body skeleton detector", {
          reason,
          requestedBackend,
        });
        detector = await initPoseTracking({
          runtime: "tfjs",
          backend: requestedBackend,
          maxPoses: FULLSCREEN_BODY_SKELETON_MAX_PEOPLE,
        });
        if (
          phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
          !FULLSCREEN_BODY_SKELETON_MODES.has(fullscreenGridModeRef.current) ||
          !mountedRef.current
        ) {
          detector.dispose?.();
          detector = null;
          return;
        }
        fullscreenBodyPoseDetectorRef.current = detector;
        detector = null;
      } catch (error) {
        appLog.warn("Fullscreen body skeleton detector failed to initialize", { error });
      } finally {
        detector?.dispose?.();
        fullscreenBodyPoseInitPromiseRef.current = null;
      }
    })();

    await fullscreenBodyPoseInitPromiseRef.current;
    return Boolean(fullscreenBodyPoseDetectorRef.current);
  }

  function scheduleFullscreenBodyPoseDetection(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      !FULLSCREEN_BODY_SKELETON_MODES.has(fullscreenGridModeRef.current)
    ) {
      if (fullscreenBodyPosesRef.current.length > 0) {
        publishFullscreenBodyPoses([]);
      }
      if (fullscreenBodyPoseDetectorRef.current) {
        fullscreenBodyPoseDetectorRef.current.dispose?.();
        fullscreenBodyPoseDetectorRef.current = null;
      }
      fullscreenBodyPoseInferenceBusyRef.current = false;
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      return;
    }

    const detector = fullscreenBodyPoseDetectorRef.current;
    if (!detector) {
      if (!fullscreenBodyPoseInitPromiseRef.current) {
        void ensureFullscreenBodyPoseDetectorInitialized("fullscreen_body_skeleton_ready");
      }
      return;
    }

    if (
      fullscreenBodyPoseInferenceBusyRef.current ||
      timestamp - fullscreenBodyPoseLastInferenceAtRef.current <
        FULLSCREEN_BODY_SKELETON_INTERVAL_MS
    ) {
      return;
    }

    fullscreenBodyPoseInferenceBusyRef.current = true;
    fullscreenBodyPoseLastInferenceAtRef.current = timestamp;
    void detectPoses(detector, video, {
      maxPoses: FULLSCREEN_BODY_SKELETON_MAX_PEOPLE,
    })
      .then((poses) => {
        if (
          phaseRef.current === PHASES.FULLSCREEN_CAMERA &&
          FULLSCREEN_BODY_SKELETON_MODES.has(fullscreenGridModeRef.current) &&
          mountedRef.current
        ) {
          publishFullscreenBodyPoses(poses);
        }
      })
      .catch((error) => {
        appLog.warn("Fullscreen body skeleton pose detection failed", { error });
      })
      .finally(() => {
        fullscreenBodyPoseInferenceBusyRef.current = false;
      });
  }

  function releaseStaleTrackingInference(timestamp, staleAction) {
    const staleToken = activeInferenceTokenRef.current;
    activeInferenceTokenRef.current += 1;
    inferenceBusyRef.current = false;
    inferenceBusySkipCounterRef.current = 0;
    appLog.warn("Tracking keep-alive detected a stale hand inference; recycling detector", {
      staleToken,
      timestamp,
      inferenceStartedAt: lastInferenceStartedAtRef.current,
      inferenceAgeMs: roundMetric(staleAction.ageMs, 2),
      cooldownRemainingMs: roundMetric(staleAction.cooldownRemainingMs, 2),
      lastInferenceCompletedAt: lastInferenceCompletedAtRef.current,
    });
    void recoverDetectorFromInvalidLandmarks("stale_inference_keep_alive", {
      inferenceAgeMs: staleAction.ageMs,
      inferenceStartedAt: lastInferenceStartedAtRef.current,
      lastInferenceCompletedAt: lastInferenceCompletedAtRef.current,
    });
  }

  function runTrackingKeepAlive(timestamp, { allowDetectorRecovery = true } = {}) {
    if (
      !shouldRunTrackingKeepAlive({
        now: timestamp,
        lastRunAt: lastTrackingKeepAliveAtRef.current,
      })
    ) {
      return;
    }
    lastTrackingKeepAliveAtRef.current = timestamp;

    const video = videoRef.current;
    const videoAction = getCameraVideoKeepAliveAction({
      video,
      stream: streamRef.current,
      attachedVideoElement: attachedVideoElementRef.current,
    });

    if (videoAction.shouldRecover) {
      appLog.warn("Tracking keep-alive detected an interrupted camera stream", videoAction);
      clearCameraTrackingReadiness();
      setTrackingReadiness((current) =>
        reduceTrackingReadiness(current, {
          type: "TRACK_INTERRUPTED",
          error: new Error("Camera stream interrupted"),
        }),
      );
      setCameraError("Camera connection was interrupted. Reconnecting…");
      retryCamera(`keep_alive_${videoAction.reason}`);
      return;
    }

    if (videoAction.shouldAttach) {
      appLog.info("Tracking keep-alive refreshing camera playback", videoAction);
      void attachStreamToVideoElement(video, `keep_alive_${videoAction.reason}`).catch((error) => {
        appLog.warn("Tracking keep-alive could not refresh camera playback", {
          videoAction,
          error,
        });
        clearCameraTrackingReadiness();
        setCameraError("Camera playback was interrupted. Reconnecting…");
        retryCamera(`keep_alive_playback_${videoAction.reason}`);
      });
    } else if (videoAction.reason !== "healthy") {
      appLog.debug("Tracking keep-alive skipped camera refresh", videoAction);
    }

    if (!allowDetectorRecovery) {
      return;
    }

    const staleAction = getStaleInferenceKeepAliveAction({
      now: timestamp,
      inferenceBusy: inferenceBusyRef.current,
      inferenceStartedAt: lastInferenceStartedAtRef.current,
      recoveryInProgress: recoveringDetectorRef.current,
      lastRecoveryAt: lastDetectorRecoveryAtRef.current,
    });

    if (staleAction.shouldRecover) {
      releaseStaleTrackingInference(timestamp, staleAction);
    } else if (
      staleAction.reason !== "idle" &&
      staleAction.reason !== "within_stale_window"
    ) {
      appLog.debug("Tracking keep-alive skipped detector recovery", staleAction);
    }
  }

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
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
      });
    }
    if (phase !== PHASES.MINORITY_REPORT_LAB) {
      labTrainingSessionRef.current = null;
      gestureEngineRef.current.reset();
      setLabEngineOutput(createEmptyLabEngineOutput());
      setLabTrainingState((previous) =>
        previous.active
          ? {
              ...createInitialLabTrainingState(),
              message: "Minority Report Lab exited. Training session cancelled.",
            }
          : previous,
      );
    }
    if (phase !== PHASES.BODY_POSE && phase !== PHASES.OFF_AXIS_LAB) {
      setPoseStatus(createEmptyPoseStatus());
    }
    if (
      phase !== PHASES.SPATIAL_GESTURE_MEMORY &&
      spatialMemoryExperienceRef.current?.active
    ) {
      const stoppedExperience = reduceSpatialMemoryExperience(
        spatialMemoryExperienceRef.current,
        {
          type: SPATIAL_MEMORY_ACTIONS.RESET,
          round: spatialMemoryExperienceRef.current.round,
        },
      );
      spatialMemoryExperienceRef.current = stoppedExperience;
      setSpatialMemoryExperience(stoppedExperience);
      const stoppedLegacy = toSpatialMemoryLegacyState(
        stoppedExperience,
        spatialMemoryRef.current,
      );
      spatialMemoryRef.current = stoppedLegacy;
      setSpatialMemoryState(stoppedLegacy);
    }
    if (phase !== PHASES.GESTURE_ART_LAB) {
      setGestureArtHands([]);
    }
    if (phase !== PHASES.FULLSCREEN_CAMERA) {
      setFullscreenIndexPoints([]);
      setFullscreenTipPoints([]);
      setFullscreenBodyPoses([]);
      setFullscreenSkeletonHands([]);
      setFullscreenDetectedHandCount(0);
      fullscreenBodyPosesRef.current = [];
      if (fullscreenBodyPoseDetectorRef.current) {
        fullscreenBodyPoseDetectorRef.current.dispose?.();
        fullscreenBodyPoseDetectorRef.current = null;
      }
      fullscreenBodyPoseInitPromiseRef.current = null;
      fullscreenBodyPoseInferenceBusyRef.current = false;
      fullscreenBodyPoseLastInferenceAtRef.current = 0;
      setFullscreenExitControlState(null);
      setFullscreenRestartControlState(null);
      setFullscreenRingTrail([]);
      setFullscreenPulseBursts([]);
      setFullscreenHandBounceState(null);
      setFullscreenBrickDodgerState(null);
      setFullscreenBreakoutState(null);
      setFullscreenBreakoutCoopState(null);
      setFullscreenFingerPongState(null);
      setFullscreenFruitNinjaState(null);
      setFullscreenWfcWorldState(null);
      setFullscreenInvadersState(null);
      setFullscreenFlappyState(null);
      setFullscreenMissileCommandState(null);
      setFullscreenTicTacToeState(null);
    }
  }, [phase]);

  useEffect(() => {
    fullscreenGridModeRef.current = fullscreenGridMode;
  }, [fullscreenGridMode]);

  useEffect(() => {
    if (
      !isMotionVisualizerEffect(fullscreenGridMode) ||
      motionVisualizerStateRef.current.effect === fullscreenGridMode
    ) {
      return;
    }
    const next = saveMotionVisualizerState({
      ...motionVisualizerStateRef.current,
      effect: fullscreenGridMode,
    });
    motionVisualizerStateRef.current = next;
    setMotionVisualizerState(next);
  }, [fullscreenGridMode]);

  useEffect(() => {
    fullscreenExitControlStateRef.current = fullscreenExitControlState;
  }, [fullscreenExitControlState]);

  useEffect(() => {
    fullscreenRestartControlStateRef.current = fullscreenRestartControlState;
  }, [fullscreenRestartControlState]);

  useEffect(() => {
    fullscreenExitControlViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenRestartControlViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenHandBounceStateRef.current = fullscreenHandBounceState;
  }, [fullscreenHandBounceState]);

  useEffect(() => {
    fullscreenHandBounceViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenBrickDodgerStateRef.current = fullscreenBrickDodgerState;
  }, [fullscreenBrickDodgerState]);

  useEffect(() => {
    fullscreenBrickDodgerViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenBreakoutStateRef.current = fullscreenBreakoutState;
  }, [fullscreenBreakoutState]);

  useEffect(() => {
    fullscreenBreakoutCoopStateRef.current = fullscreenBreakoutCoopState;
  }, [fullscreenBreakoutCoopState]);

  useEffect(() => {
    fullscreenFingerPongStateRef.current = fullscreenFingerPongState;
  }, [fullscreenFingerPongState]);

  useEffect(() => {
    fullscreenFruitNinjaStateRef.current = fullscreenFruitNinjaState;
  }, [fullscreenFruitNinjaState]);

  useEffect(() => {
    fullscreenInvadersStateRef.current = fullscreenInvadersState;
  }, [fullscreenInvadersState]);

  useEffect(() => {
    fullscreenBreakoutViewportRef.current = fullscreenBreakoutViewport;
  }, [fullscreenBreakoutViewport]);

  useEffect(() => {
    fullscreenBreakoutCoopViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenFingerPongViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenSkyPatrolViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenWfcWorldStateRef.current = fullscreenWfcWorldState;
  }, [fullscreenWfcWorldState]);

  useEffect(() => {
    fullscreenWfcWorldViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenFlappyStateRef.current = fullscreenFlappyState;
  }, [fullscreenFlappyState]);

  useEffect(() => {
    fullscreenFlappyViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenMissileCommandStateRef.current = fullscreenMissileCommandState;
  }, [fullscreenMissileCommandState]);

  useEffect(() => {
    fullscreenMissileCommandViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    fullscreenTicTacToeStateRef.current = fullscreenTicTacToeState;
  }, [fullscreenTicTacToeState]);

  useEffect(() => {
    fullscreenTicTacToeViewportRef.current = fullscreenCameraViewport;
  }, [fullscreenCameraViewport]);

  useEffect(() => {
    if (!isImmersiveAppPhase) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      const lifecycle = experienceLifecycleRef.current;
      if (
        lifecycle?.phase === EXPERIENCE_PHASES.RUNNING ||
        lifecycle?.phase === EXPERIENCE_PHASES.COUNTDOWN
      ) {
        event.preventDefault();
        dispatchExperienceLifecycle({
          type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
          reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
        });
      } else if (!lifecycle) {
        navigateToProductHome();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImmersiveAppPhase, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      !fullscreenCameraViewport
    ) {
      fullscreenExitControlLastTickRef.current = 0;
      if (fullscreenExitControlStateRef.current) {
        fullscreenExitControlStateRef.current = null;
        setFullscreenExitControlState(null);
      }
      return undefined;
    }

    const nextExitControlState = createFullscreenExitControlState(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    fullscreenExitControlLastTickRef.current = 0;
    fullscreenExitControlStateRef.current = nextExitControlState;
    setFullscreenExitControlState(nextExitControlState);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      !fullscreenRestartControlLabel ||
      !fullscreenCameraViewport
    ) {
      fullscreenRestartControlLastTickRef.current = 0;
      if (fullscreenRestartControlStateRef.current) {
        fullscreenRestartControlStateRef.current = null;
        setFullscreenRestartControlState(null);
      }
      return undefined;
    }

    const nextRestartControlState = createFullscreenRestartControlState(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    fullscreenRestartControlLastTickRef.current = 0;
    fullscreenRestartControlStateRef.current = nextRestartControlState;
    setFullscreenRestartControlState(nextRestartControlState);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenRestartControlLabel, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "hand-bounce" ||
      !fullscreenCameraViewport
    ) {
      fullscreenHandBounceLastTickRef.current = 0;
      if (fullscreenHandBounceStateRef.current) {
        fullscreenHandBounceStateRef.current = null;
        setFullscreenHandBounceState(null);
      }
      return undefined;
    }

    const templateGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createFullscreenHandBounceDailyGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
              date: activeLaunchContextRef.current.dayKey,
            },
          )
        : createFullscreenHandBounceGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
          );
    const nextGame = initializeOrResizeFullscreenGame(
      "hand-bounce",
      fullscreenHandBounceStateRef.current,
      templateGame,
    );
    fullscreenHandBounceLastTickRef.current = 0;
    fullscreenHandBounceStateRef.current = nextGame;
    setFullscreenHandBounceState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "brick-dodger" ||
      !fullscreenCameraViewport
    ) {
      fullscreenBrickDodgerLastTickRef.current = 0;
      if (fullscreenBrickDodgerStateRef.current) {
        fullscreenBrickDodgerStateRef.current = null;
        setFullscreenBrickDodgerState(null);
      }
      return undefined;
    }

    const templateGame = createBrickDodgerGame(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    const nextGame = initializeOrResizeFullscreenGame(
      "brick-dodger",
      fullscreenBrickDodgerStateRef.current,
      templateGame,
    );
    fullscreenBrickDodgerLastTickRef.current = 0;
    fullscreenBrickDodgerStateRef.current = nextGame;
    setFullscreenBrickDodgerState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      (fullscreenGridMode !== "breakout" &&
        fullscreenGridMode !== FIND_YOUR_GRIND_BREAKOUT_MODE_ID) ||
      !fullscreenBreakoutViewport
    ) {
      fullscreenBreakoutLastTickRef.current = 0;
      if (fullscreenBreakoutStateRef.current) {
        fullscreenBreakoutStateRef.current = null;
        setFullscreenBreakoutState(null);
      }
      return undefined;
    }

    const templateGame =
      fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID
        ? createFindYourGrindBreakoutGame(
            fullscreenBreakoutViewport.width,
            fullscreenBreakoutViewport.height,
          )
          : createBreakoutGame(
            fullscreenBreakoutViewport.width,
            fullscreenBreakoutViewport.height,
          );
    const nextGame = initializeOrResizeFullscreenGame(
      fullscreenGridMode,
      fullscreenBreakoutStateRef.current,
      templateGame,
    );
    fullscreenBreakoutLastTickRef.current = 0;
    fullscreenBreakoutStateRef.current = nextGame;
    setFullscreenBreakoutState(nextGame);
    return undefined;
  }, [fullscreenBreakoutViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "breakout-coop" ||
      !fullscreenCameraViewport
    ) {
      fullscreenBreakoutCoopLastTickRef.current = 0;
      fullscreenBreakoutCoopPrimaryPinchLatchRef.current = false;
      fullscreenBreakoutCoopSecondaryPinchLatchRef.current = false;
      fullscreenPrimaryHandIdRef.current = null;
      if (fullscreenBreakoutCoopStateRef.current) {
        fullscreenBreakoutCoopStateRef.current = null;
        setFullscreenBreakoutCoopState(null);
      }
      return undefined;
    }

    const templateGame = createBreakoutCoopGame(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    const nextGame = initializeOrResizeFullscreenGame(
      "breakout-coop",
      fullscreenBreakoutCoopStateRef.current,
      templateGame,
    );
    fullscreenBreakoutCoopLastTickRef.current = 0;
    fullscreenBreakoutCoopPrimaryPinchLatchRef.current = false;
    fullscreenBreakoutCoopSecondaryPinchLatchRef.current = false;
    fullscreenPrimaryHandIdRef.current = null;
    fullscreenBreakoutCoopStateRef.current = nextGame;
    setFullscreenBreakoutCoopState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "fruit-ninja" ||
      !fullscreenCameraViewport
    ) {
      fullscreenFruitNinjaLastTickRef.current = 0;
      if (fullscreenFruitNinjaStateRef.current) {
        fullscreenFruitNinjaStateRef.current = null;
        setFullscreenFruitNinjaState(null);
      }
      return undefined;
    }

    const templateGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createFruitNinjaDailyGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
            activeLaunchContextRef.current.dayKey,
          )
        : createFruitNinjaGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
          );
    const nextGame = initializeOrResizeFullscreenGame(
      "fruit-ninja",
      fullscreenFruitNinjaStateRef.current,
      templateGame,
    );
    fullscreenFruitNinjaLastTickRef.current = 0;
    fullscreenFruitNinjaStateRef.current = nextGame;
    setFullscreenFruitNinjaState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (typeof Image === "undefined") {
      return undefined;
    }

    const spriteImage = new Image();
    spriteImage.onload = () => {
      fullscreenSkyPatrolSpriteImageRef.current = spriteImage;
      const renderer = fullscreenSkyPatrolRendererRef.current;
      renderer?.setSpriteImage(spriteImage);
      if (fullscreenSkyPatrolStateRef.current) {
        renderer?.draw(fullscreenSkyPatrolStateRef.current);
      }
    };
    spriteImage.src = SKY_PATROL_SPRITE_ATLAS_URL;

    return () => {
      spriteImage.onload = null;
    };
  }, []);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "sky-patrol" ||
      !fullscreenCameraViewport
    ) {
      fullscreenSkyPatrolLastTickRef.current = 0;
      fullscreenSkyPatrolStateRef.current = null;
      fullscreenSkyPatrolHudRef.current = null;
      fullscreenSkyPatrolRendererRef.current?.clear();
      fullscreenSkyPatrolRendererRef.current = null;
      setFullscreenSkyPatrolHud(null);
      return undefined;
    }

    const templateGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createSkyPatrolDailyGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
            },
          )
        : createSkyPatrolGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
          );
    const nextGame = initializeOrResizeFullscreenGame(
      "sky-patrol",
      fullscreenSkyPatrolStateRef.current,
      templateGame,
    );
    fullscreenSkyPatrolLastTickRef.current = 0;
    publishFullscreenSkyPatrolState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== WFC_WORLD_MODE_ID ||
      !fullscreenCameraViewport
    ) {
      fullscreenWfcWorldLastTickRef.current = 0;
      fullscreenWfcWorldMouseInputRef.current = {
        pointerActive: false,
        pointerX: 0,
        pointerY: 0,
        pinchActive: false,
        pinchStarted: false,
      };
      if (fullscreenWfcWorldStateRef.current) {
        fullscreenWfcWorldStateRef.current = null;
        setFullscreenWfcWorldState(null);
      }
      setFullscreenWfcProjectOpen(false);
      return undefined;
    }

    const templateGame = createWfcWorldGame(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    const previousGame = fullscreenWfcWorldStateRef.current;
    const nextGame = previousGame
      ? {
          ...previousGame,
          layout: templateGame.layout,
          hoverCell: null,
          paintDragActive: false,
          lastPaintedCell: null,
        }
      : templateGame;
    fullscreenWfcWorldLastTickRef.current = 0;
    fullscreenWfcWorldMouseInputRef.current = {
      pointerActive: false,
      pointerX: 0,
      pointerY: 0,
      pinchActive: false,
      pinchStarted: false,
    };
    fullscreenWfcWorldStateRef.current = nextGame;
    setFullscreenWfcWorldState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "invaders" ||
      !fullscreenCameraViewport
    ) {
      fullscreenInvadersLastTickRef.current = 0;
      if (fullscreenInvadersStateRef.current) {
        fullscreenInvadersStateRef.current = null;
        setFullscreenInvadersState(null);
      }
      return undefined;
    }

    const templateGame = createSpaceInvadersGame(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    const nextGame = initializeOrResizeFullscreenGame(
      "invaders",
      fullscreenInvadersStateRef.current,
      templateGame,
    );
    fullscreenInvadersLastTickRef.current = 0;
    fullscreenInvadersStateRef.current = nextGame;
    setFullscreenInvadersState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "finger-pong" ||
      !fullscreenCameraViewport
    ) {
      fullscreenFingerPongLastTickRef.current = 0;
      if (fullscreenFingerPongStateRef.current) {
        fullscreenFingerPongStateRef.current = null;
        setFullscreenFingerPongState(null);
      }
      return undefined;
    }

    const templateGame = createFingerPongGame(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    const nextGame = initializeOrResizeFullscreenGame(
      "finger-pong",
      fullscreenFingerPongStateRef.current,
      templateGame,
    );
    fullscreenFingerPongLastTickRef.current = 0;
    fullscreenFingerPongStateRef.current = nextGame;
    setFullscreenFingerPongState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "flappy" ||
      !fullscreenCameraViewport
    ) {
      fullscreenFlappyLastTickRef.current = 0;
      if (fullscreenFlappyStateRef.current) {
        fullscreenFlappyStateRef.current = null;
        setFullscreenFlappyState(null);
      }
      return undefined;
    }

    const templateGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createFlappyDailyChallengeGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
            },
          )
        : createFlappyGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
          );
    const nextGame = initializeOrResizeFullscreenGame(
      "flappy",
      fullscreenFlappyStateRef.current,
      templateGame,
    );
    fullscreenFlappyLastTickRef.current = 0;
    fullscreenFlappyStateRef.current = nextGame;
    setFullscreenFlappyState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "missile-command" ||
      !fullscreenCameraViewport
    ) {
      fullscreenMissileCommandLastTickRef.current = 0;
      if (fullscreenMissileCommandStateRef.current) {
        fullscreenMissileCommandStateRef.current = null;
        setFullscreenMissileCommandState(null);
      }
      return undefined;
    }

    const templateGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createMissileCommandDailyGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
            },
          )
        : createMissileCommandGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
          );
    const nextGame = initializeOrResizeFullscreenGame(
      "missile-command",
      fullscreenMissileCommandStateRef.current,
      templateGame,
    );
    fullscreenMissileCommandLastTickRef.current = 0;
    fullscreenMissileCommandStateRef.current = nextGame;
    setFullscreenMissileCommandState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    if (
      phase !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridMode !== "tic-tac-toe" ||
      !fullscreenCameraViewport
    ) {
      fullscreenTicTacToeLastTickRef.current = 0;
      if (fullscreenTicTacToeStateRef.current) {
        fullscreenTicTacToeStateRef.current = null;
        setFullscreenTicTacToeState(null);
      }
      return undefined;
    }

    const templateGame = createTicTacToeGame(
      fullscreenCameraViewport.width,
      fullscreenCameraViewport.height,
    );
    const nextGame = initializeOrResizeFullscreenGame(
      "tic-tac-toe",
      fullscreenTicTacToeStateRef.current,
      templateGame,
    );
    fullscreenTicTacToeLastTickRef.current = 0;
    fullscreenTicTacToeStateRef.current = nextGame;
    setFullscreenTicTacToeState(nextGame);
    return undefined;
  }, [fullscreenCameraViewport, fullscreenGridMode, phase]);

  useEffect(() => {
    const now = performance.now();

    if (!handDetected) {
      const pruned = pruneTrackedCursorTrail(cursorTrailRef.current, now);
      if (pruned.length !== cursorTrailRef.current.length) {
        cursorTrailRef.current = pruned;
        setCursorTrail(pruned);
      }
      return undefined;
    }

    const previousPoint = cursorTrailRef.current[cursorTrailRef.current.length - 1] ?? null;
    const elapsed = now - cursorTrailLastSampleAtRef.current;
    const distance = previousPoint
      ? Math.hypot(cursor.x - previousPoint.x, cursor.y - previousPoint.y)
      : Number.POSITIVE_INFINITY;
    if (elapsed < CURSOR_TRAIL_SAMPLE_INTERVAL_MS && distance < CURSOR_TRAIL_MIN_DISTANCE_PX) {
      return undefined;
    }

    cursorTrailLastSampleAtRef.current = now;
    const nextTrail = pruneTrackedCursorTrail(
      [
        ...cursorTrailRef.current,
        {
          x: cursor.x,
          y: cursor.y,
          timestamp: now,
        },
      ],
      now,
    );
    cursorTrailRef.current = nextTrail;
    setCursorTrail(nextTrail);
    setCursorTrailNow(now);
    return undefined;
  }, [cursor, handDetected]);

  useEffect(() => {
    if (cursorTrail.length === 0) {
      return undefined;
    }

    let frameId = 0;
    const tick = () => {
      const now = performance.now();
      const pruned = pruneTrackedCursorTrail(cursorTrailRef.current, now);
      cursorTrailRef.current = pruned;
      setCursorTrailNow(now);
      setCursorTrail((previous) => (previous.length === pruned.length ? previous : pruned));
      if (pruned.length > 0) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [cursorTrail.length]);

  useEffect(() => {
    if (fullscreenGridMode !== "rings") {
      fullscreenRingTrailRef.current = [];
      fullscreenRingTrailLastSampleAtRef.current = 0;
      if (fullscreenRingTrail.length > 0) {
        setFullscreenRingTrail([]);
      }
      return undefined;
    }

    const now = performance.now();
    const normalizedPoints = fullscreenIndexPoints
      .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
      .map((point) => ({
        id: point.id,
        label: point.label,
        x: point.x,
        y: point.y,
      }));
    const pruned = pruneCursorTrail(
      fullscreenRingTrailRef.current,
      now,
      motionVisualizerTrailDurationMs,
    );
    const elapsed = now - fullscreenRingTrailLastSampleAtRef.current;

    if (normalizedPoints.length === 0) {
      if (pruned.length !== fullscreenRingTrailRef.current.length) {
        fullscreenRingTrailRef.current = pruned;
        setFullscreenRingTrail(pruned);
      }
      return undefined;
    }

    if (elapsed < FULLSCREEN_RING_TRAIL_SAMPLE_INTERVAL_MS) {
      return undefined;
    }

    fullscreenRingTrailLastSampleAtRef.current = now;
    const nextTrail = pruneCursorTrail(
      [
        ...pruned,
        {
          timestamp: now,
          points: normalizedPoints,
        },
      ],
      now,
      motionVisualizerTrailDurationMs,
    );
    fullscreenRingTrailRef.current = nextTrail;
    setFullscreenRingTrail(nextTrail);
    setFullscreenRingTrailNow(now);
    return undefined;
  }, [
    fullscreenGridMode,
    fullscreenIndexPoints,
    fullscreenRingTrail.length,
    motionVisualizerTrailDurationMs,
  ]);

  useEffect(() => {
    if (fullscreenGridMode !== "rings" || fullscreenRingTrail.length === 0) {
      return undefined;
    }

    let frameId = 0;
    const tick = () => {
      const now = performance.now();
      const pruned = pruneCursorTrail(
        fullscreenRingTrailRef.current,
        now,
        motionVisualizerTrailDurationMs,
      );
      fullscreenRingTrailRef.current = pruned;
      setFullscreenRingTrailNow(now);
      setFullscreenRingTrail((previous) => (previous.length === pruned.length ? previous : pruned));
      if (pruned.length > 0) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    fullscreenGridMode,
    fullscreenRingTrail.length,
    motionVisualizerTrailDurationMs,
  ]);

  useEffect(() => {
    if (fullscreenGridMode !== "pulse" || !fullscreenCameraViewport) {
      fullscreenPulseBurstsRef.current = [];
      fullscreenPulseLastEmitByIdRef.current = {};
      if (fullscreenPulseBursts.length > 0) {
        setFullscreenPulseBursts([]);
      }
      return undefined;
    }

    const now = performance.now();
    const pruned = prunePulseBursts(
      fullscreenPulseBurstsRef.current,
      now,
      motionVisualizerPulseDurationMs,
    );
    const nextBursts = [...pruned];
    const nextLastEmitById = { ...fullscreenPulseLastEmitByIdRef.current };
    const largestRingRadius =
      (FULLSCREEN_RING_LAYERS[FULLSCREEN_RING_LAYERS.length - 1]?.diameter ?? 0) / 2;

    for (const point of fullscreenIndexPoints) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        continue;
      }

      const lastEmitAt = nextLastEmitById[point.id] ?? 0;
      if (now - lastEmitAt < FULLSCREEN_PULSE_RING_INTERVAL_MS) {
        continue;
      }

      const localX = point.x - fullscreenCameraViewport.left;
      const localY = point.y - fullscreenCameraViewport.top;
      const maxRadius = Math.max(
        Math.hypot(localX, localY),
        Math.hypot(fullscreenCameraViewport.width - localX, localY),
        Math.hypot(localX, fullscreenCameraViewport.height - localY),
        Math.hypot(
          fullscreenCameraViewport.width - localX,
          fullscreenCameraViewport.height - localY,
        ),
      );

      nextLastEmitById[point.id] = now;
      nextBursts.push({
        id: `${point.id}-${now}`,
        pointId: point.id,
        x: point.x,
        y: point.y,
        startTime: now,
        startRadius: largestRingRadius,
        maxRadius,
      });
    }

    fullscreenPulseBurstsRef.current = nextBursts;
    fullscreenPulseLastEmitByIdRef.current = nextLastEmitById;
    setFullscreenPulseBursts(nextBursts);
    setFullscreenPulseNow(now);
    return undefined;
  }, [
    fullscreenCameraViewport,
    fullscreenGridMode,
    fullscreenIndexPoints,
    fullscreenPulseBursts.length,
    motionVisualizerPulseDurationMs,
  ]);

  useEffect(() => {
    if (fullscreenGridMode !== "pulse" || fullscreenPulseBursts.length === 0) {
      return undefined;
    }

    let frameId = 0;
    const tick = () => {
      const now = performance.now();
      const pruned = prunePulseBursts(
        fullscreenPulseBurstsRef.current,
        now,
        motionVisualizerPulseDurationMs,
      );
      fullscreenPulseBurstsRef.current = pruned;
      setFullscreenPulseNow(now);
      setFullscreenPulseBursts((previous) => (previous.length === pruned.length ? previous : pruned));
      if (pruned.length > 0) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    fullscreenGridMode,
    fullscreenPulseBursts.length,
    motionVisualizerPulseDurationMs,
  ]);

  useEffect(() => {
    if (fullscreenGridMode !== "tip-ripples") {
      fullscreenTipRippleStartedAtRef.current = 0;
      return undefined;
    }

    let frameId = 0;
    const startTime = performance.now();
    fullscreenTipRippleStartedAtRef.current = startTime;
    setFullscreenTipRippleNow(startTime);

    const tick = () => {
      setFullscreenTipRippleNow(performance.now());
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [fullscreenGridMode]);

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
    appLog.debug("Whack-a-Mole state changed", {
      phase: whackAMoleState.phase,
      score: whackAMoleState.score,
      timeLeft: Math.ceil((whackAMoleState.remainingMs ?? 0) / 1000),
      target: whackAMoleState.target?.holeIndex ?? null,
    });
  }, [appLog, whackAMoleState]);

  useEffect(() => {
    recordActiveProgressionResult();
  }, [
    whackAMoleState,
    spatialMemoryState,
    fullscreenBrickDodgerState,
    fullscreenBreakoutCoopState,
    fullscreenBreakoutState,
    fullscreenFingerPongState,
    fullscreenFlappyState,
    fullscreenFruitNinjaState,
    fullscreenHandBounceState,
    fullscreenInvadersState,
    fullscreenMissileCommandState,
    fullscreenSkyPatrolHud,
    fullscreenTicTacToeState,
  ]);

  useEffect(() => {
    appLog.debug("Debug overlay state changed", { debugEnabled });
  }, [appLog, debugEnabled]);

  useEffect(() => {
    spatialMemoryRef.current = spatialMemoryState;
  }, [spatialMemoryState]);

  useEffect(() => {
    spatialMemoryExperienceRef.current = spatialMemoryExperience;
  }, [spatialMemoryExperience]);

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
    const normalized = saveUserPreferences(preferences);
    applyPreferenceDocumentState(normalized);
    audioFeedbackRef.current.configure(normalized);
  }, [preferences]);

  useEffect(() => {
    const unlockAudio = () => {
      audioFeedbackRef.current.unlock();
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
    window.addEventListener("pointerdown", unlockAudio, true);
    window.addEventListener("keydown", unlockAudio, true);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, []);

  useEffect(() => {
    const isNativeControl = (target) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          "button, a, input, select, textarea, summary, [role='button'], [role='link']",
        ),
      );
    const publishMotionVisualizerFallbackPoint = (x, y) => {
      if (
        phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
        !isMotionVisualizerEffect(fullscreenGridModeRef.current)
      ) {
        return;
      }
      const point = {
        id: "pointer",
        handId: "pointer",
        fingerName: "index",
        label: "Pointer",
        x: clampValue(x, 0, viewportRef.current.width),
        y: clampValue(y, 0, viewportRef.current.height),
      };
      setFullscreenIndexPoints([point]);
      setFullscreenTipPoints([point]);
    };
    const updateFallbackPoint = (event) => {
      if (
        trackingRequestedRef.current ||
        !Number.isFinite(event.clientX) ||
        !Number.isFinite(event.clientY)
      ) {
        return false;
      }
      fallbackPointerRef.current = {
        ...fallbackPointerRef.current,
        active: true,
        pointerType: event.pointerType || "mouse",
        x: event.clientX,
        y: event.clientY,
      };
      cursorRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      publishMotionVisualizerFallbackPoint(event.clientX, event.clientY);
      return true;
    };
    const handleFallbackPointerMove = (event) => {
      updateFallbackPoint(event);
    };
    const handleFallbackPointerDown = (event) => {
      if (
        event.button !== 0 ||
        !updateFallbackPoint(event) ||
        isNativeControl(event.target)
      ) {
        return;
      }
      fallbackPointerRef.current = {
        ...fallbackPointerRef.current,
        justPressed:
          fallbackPointerRef.current.justPressed ||
          !fallbackPointerRef.current.pressed,
        pressed: true,
      };
    };
    const releaseFallbackPointer = (event) => {
      if (trackingRequestedRef.current) {
        return;
      }
      const pointerType =
        event?.pointerType || fallbackPointerRef.current.pointerType;
      fallbackPointerRef.current = {
        ...fallbackPointerRef.current,
        active:
          pointerType === "mouse" && fallbackPointerRef.current.active,
        pressed: false,
      };
    };
    const resetFallbackPointer = () => {
      fallbackPointerRef.current = {
        ...fallbackPointerRef.current,
        active: false,
        justPressed: false,
        pressed: false,
      };
    };
    const handleFallbackKeyDown = (event) => {
      const shortcutIndex = Number.parseInt(event.key, 10) - 1;
      if (
        phaseRef.current === PHASES.FULLSCREEN_CAMERA &&
        isMotionVisualizerEffect(fullscreenGridModeRef.current) &&
        !isNativeControl(event.target) &&
        shortcutIndex >= 0 &&
        shortcutIndex < MOTION_VISUALIZER_EFFECTS.length
      ) {
        event.preventDefault();
        const effect = MOTION_VISUALIZER_EFFECTS[shortcutIndex];
        const next = saveMotionVisualizerState({
          ...motionVisualizerStateRef.current,
          effect: effect.id,
        });
        motionVisualizerStateRef.current = next;
        setMotionVisualizerState(next);
        fullscreenGridModeRef.current = effect.id;
        setFullscreenGridMode(effect.id);
        setMotionVisualizerStatus(`${effect.label} effect selected.`);
        return;
      }
      if (
        trackingRequestedRef.current ||
        phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
        isNativeControl(event.target)
      ) {
        return;
      }
      const movementByKey = {
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
      };
      const movement = movementByKey[event.key];
      if (movement) {
        event.preventDefault();
        const step = event.shiftKey ? 72 : 28;
        const nextPoint = clampPoint(
          {
            x: fallbackPointerRef.current.x + movement[0] * step,
            y: fallbackPointerRef.current.y + movement[1] * step,
          },
          viewportRef.current.width,
          viewportRef.current.height,
        );
        fallbackPointerRef.current = {
          ...fallbackPointerRef.current,
          active: true,
          pointerType: "keyboard",
          x: nextPoint.x,
          y: nextPoint.y,
        };
        cursorRef.current = nextPoint;
        publishMotionVisualizerFallbackPoint(nextPoint.x, nextPoint.y);
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault();
        fallbackPointerRef.current = {
          ...fallbackPointerRef.current,
          active: true,
          justPressed: true,
          pointerType: "keyboard",
          pressed: true,
        };
      }
    };
    const handleFallbackKeyUp = (event) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }
      fallbackPointerRef.current = {
        ...fallbackPointerRef.current,
        pressed: false,
      };
    };

    window.addEventListener("pointermove", handleFallbackPointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handleFallbackPointerDown, true);
    window.addEventListener("pointerup", releaseFallbackPointer, true);
    window.addEventListener("pointercancel", releaseFallbackPointer, true);
    window.addEventListener("mousemove", handleFallbackPointerMove, {
      passive: true,
    });
    window.addEventListener("mousedown", handleFallbackPointerDown, true);
    window.addEventListener("mouseup", releaseFallbackPointer, true);
    window.addEventListener("blur", resetFallbackPointer);
    window.addEventListener("keydown", handleFallbackKeyDown);
    window.addEventListener("keyup", handleFallbackKeyUp);
    return () => {
      window.removeEventListener("pointermove", handleFallbackPointerMove);
      window.removeEventListener("pointerdown", handleFallbackPointerDown, true);
      window.removeEventListener("pointerup", releaseFallbackPointer, true);
      window.removeEventListener(
        "pointercancel",
        releaseFallbackPointer,
        true,
      );
      window.removeEventListener("mousemove", handleFallbackPointerMove);
      window.removeEventListener("mousedown", handleFallbackPointerDown, true);
      window.removeEventListener("mouseup", releaseFallbackPointer, true);
      window.removeEventListener("blur", resetFallbackPointer);
      window.removeEventListener("keydown", handleFallbackKeyDown);
      window.removeEventListener("keyup", handleFallbackKeyUp);
    };
  }, []);

  useEffect(
    () => () => {
      audioFeedbackRef.current.dispose();
    },
    [],
  );

  useEffect(() => {
    const current = {
      attempt: experienceLifecycle?.attempt ?? null,
      modeId: experienceModeId,
      phase: experienceLifecycle?.phase ?? null,
    };
    const previous = previousAudioLifecycleRef.current;
    let cue = null;

    if (
      current.phase === EXPERIENCE_PHASES.RESULTS &&
      previous.phase !== EXPERIENCE_PHASES.RESULTS
    ) {
      cue = "success";
    } else if (
      current.phase === EXPERIENCE_PHASES.PAUSED &&
      previous.phase !== EXPERIENCE_PHASES.PAUSED
    ) {
      cue = "pause";
    } else if (
      previous.phase === EXPERIENCE_PHASES.PAUSED &&
      (current.phase === EXPERIENCE_PHASES.COUNTDOWN ||
        current.phase === EXPERIENCE_PHASES.RUNNING)
    ) {
      cue = "resume";
    } else if (
      current.phase &&
      (previous.modeId !== current.modeId ||
        previous.attempt !== current.attempt) &&
      (current.phase === EXPERIENCE_PHASES.COUNTDOWN ||
        current.phase === EXPERIENCE_PHASES.RUNNING)
    ) {
      cue = "start";
    }

    previousAudioLifecycleRef.current = current;
    if (cue) {
      audioFeedbackRef.current.play(cue);
    }
  }, [
    experienceLifecycle?.attempt,
    experienceLifecycle?.phase,
    experienceModeId,
  ]);

  useEffect(() => {
    dynamicQualityBudgetRef.current = dynamicQualityBudget;
    const root = document.documentElement;
    root.dataset.qualityLevel = dynamicQualityBudget.level;
    root.style.setProperty(
      "--dynamic-effect-density",
      dynamicQualityBudget.effectDensity,
    );
    root.style.setProperty(
      "--dynamic-particle-limit",
      dynamicQualityBudget.particleLimit,
    );
  }, [dynamicQualityBudget]);

  useEffect(() => {
    setDeviceCapabilities(
      assessDeviceCapabilities(collectDeviceCapabilitySignals()),
    );
  }, [viewport.height, viewport.width]);

  useEffect(() => {
    trackingRequestedRef.current = trackingRequested;
  }, [trackingRequested]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === "hidden";
      if (
        hidden &&
        experienceModeIdRef.current === "whack-a-mole"
      ) {
        applyWhackAMoleAction({
          type: WHACK_A_MOLE_ACTIONS.PAUSE,
          now: performance.now(),
        });
      }
      const transition = dispatchExperienceLifecycle({
        type:
          hidden
            ? EXPERIENCE_LIFECYCLE_EVENTS.PAUSE
            : EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
        reason: EXPERIENCE_PAUSE_REASONS.VISIBILITY,
      });
      if (
        !hidden &&
        experienceModeIdRef.current === "whack-a-mole" &&
        transition?.state?.phase !== EXPERIENCE_PHASES.PAUSED
      ) {
        applyWhackAMoleAction({
          type: WHACK_A_MOLE_ACTIONS.RESUME,
          now: performance.now(),
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setTrackingRecoveryGate((current) =>
      advanceTrackingRecoveryGate(current, {
        required: trackingRecoveryRequired,
        detected: handDetected,
        now: globalThis.performance?.now?.() ?? Date.now(),
      }),
    );
  }, [handDetected, trackingRecoveryRequired]);

  useEffect(() => {
    if (
      ![
        TRACKING_RECOVERY_PHASES.LOSS_GRACE,
        TRACKING_RECOVERY_PHASES.REACQUIRING,
      ].includes(trackingRecoveryGate.phase)
    ) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setTrackingRecoveryGate((current) =>
        advanceTrackingRecoveryGate(current, {
          required: trackingRecoveryRequired,
          detected: handDetected,
          now: globalThis.performance?.now?.() ?? Date.now(),
        }),
      );
    }, 100);
    return () => window.clearInterval(interval);
  }, [
    handDetected,
    trackingRecoveryGate.phase,
    trackingRecoveryRequired,
  ]);

  useEffect(() => {
    if (!experienceModeId || !trackingRecoveryRequired) {
      const transition = dispatchExperienceLifecycle({
        type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
        reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
      });
      if (
        experienceModeId === "whack-a-mole" &&
        transition?.state?.phase !== EXPERIENCE_PHASES.PAUSED
      ) {
        applyWhackAMoleAction({
          type: WHACK_A_MOLE_ACTIONS.RESUME,
          now: performance.now(),
        });
      }
      return;
    }
    if (
      trackingRecoveryGate.phase ===
      TRACKING_RECOVERY_PHASES.LOSS_GRACE
    ) {
      return;
    }
    if (
      experienceModeId === "whack-a-mole" &&
      trackingRecoveryStatus.shouldPause
    ) {
      applyWhackAMoleAction({
        type: WHACK_A_MOLE_ACTIONS.PAUSE,
        now: performance.now(),
      });
    }
    const transition = dispatchExperienceLifecycle({
      type: trackingRecoveryStatus.shouldPause
        ? EXPERIENCE_LIFECYCLE_EVENTS.PAUSE
        : EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
      reason: EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS,
    });
    if (
      experienceModeId === "whack-a-mole" &&
      !trackingRecoveryStatus.shouldPause &&
      transition?.state?.phase !== EXPERIENCE_PHASES.PAUSED
    ) {
      applyWhackAMoleAction({
        type: WHACK_A_MOLE_ACTIONS.RESUME,
        now: performance.now(),
      });
    }
  }, [
    experienceLifecycle?.attempt,
    experienceModeId,
    trackingRecoveryGate.phase,
    trackingRecoveryRequired,
  ]);

  useEffect(
    () =>
      progressionStoreRef.current.subscribe((progress) => {
        setGameProgression(progress);
      }),
    [],
  );

  useEffect(() => {
    const navigateFromLocation = () => {
      const path = window.location.pathname;
      if (path === "/settings") {
        openProductSettings({ updateHistory: false });
        return;
      }
      const homeArea = getProductHomeAreaFromPath(path);
      if (homeArea) {
        navigateToProductHome({
          area: homeArea,
          updateHistory: false,
        });
        return;
      }
      const mode = getModeByPath(path);
      if (mode) {
        selectProductMode(mode, { updateHistory: false });
        return;
      }
      navigateToProductHome({ updateHistory: false });
    };

    if (!routeInitializedRef.current) {
      routeInitializedRef.current = true;
      navigateFromLocation();
    }
    window.addEventListener("popstate", navigateFromLocation);
    return () => {
      window.removeEventListener("popstate", navigateFromLocation);
    };
  }, [cameraReady, modelReady, trackingReadiness.status]);

  useEffect(() => {
    if (!trackingRequested) {
      setTrackingReadiness(createTrackingReadinessState());
      resetTrackingInteractionCheck();
      return;
    }
    if (!cameraReady || !modelReady) {
      return;
    }

    setTrackingReadiness((current) => {
      let next = reduceTrackingReadiness(current, {
        type: "HAND_DETECTED",
        detected: handDetected,
      });
      next = reduceTrackingReadiness(next, {
        type: "POINTER_READY",
        ready: trackingInteractionCheck.pointerReady,
      });
      return reduceTrackingReadiness(next, {
        type: "PINCH_READY",
        ready: trackingInteractionCheck.pinchReady,
      });
    });
  }, [
    cameraReady,
    handDetected,
    modelReady,
    trackingInteractionCheck.pinchReady,
    trackingInteractionCheck.pointerReady,
    trackingRequested,
  ]);

  useEffect(() => {
    poseStatusRef.current = poseStatus;
  }, [poseStatus]);

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
    cursorTrailRef.current = cursorTrail;
  }, [cursorTrail]);

  useEffect(() => {
    fullscreenRingTrailRef.current = fullscreenRingTrail;
  }, [fullscreenRingTrail]);

  useEffect(() => {
    fullscreenPulseBurstsRef.current = fullscreenPulseBursts;
  }, [fullscreenPulseBursts]);

  useEffect(() => {
    debugRef.current = debugEnabled;
  }, [debugEnabled]);

  useEffect(() => {
    labConfidenceThresholdRef.current = labConfidenceThreshold;
  }, [labConfidenceThreshold]);

  useEffect(() => {
    labShowSkeletonRef.current = labShowSkeleton;
  }, [labShowSkeleton]);

  useEffect(() => {
    labPersonalizationEnabledRef.current = labPersonalizationEnabled;
  }, [labPersonalizationEnabled]);

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
    whackAMoleStateRef.current = whackAMoleState;
  }, [whackAMoleState]);

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
    if (!showLeftPaneResizer && isLeftPaneResizing) {
      setIsLeftPaneResizing(false);
    }
  }, [isLeftPaneResizing, showLeftPaneResizer]);

  useEffect(() => {
    if (!showLeftPaneResizer || leftPaneWidth === null) {
      return;
    }

    const clampedWidth = clampResizableLeftPaneWidth(leftPaneWidth, getContentGridWidth());
    if (Math.abs(clampedWidth - leftPaneWidth) > 0.5) {
      setLeftPaneWidth(clampedWidth);
    }
  }, [leftPaneWidth, showLeftPaneResizer, viewport.width]);

  useEffect(() => {
    if (!isLeftPaneResizing) {
      return undefined;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isLeftPaneResizing]);

  useEffect(() => {
    if (!isLeftPaneResizing || !showLeftPaneResizer) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const { startWidth, startX } = leftPaneResizeStateRef.current;
      if (!Number.isFinite(startWidth) || startWidth <= 0) {
        return;
      }
      setClampedLeftPaneWidth(startWidth + event.clientX - startX);
    };

    const stopResizing = () => {
      setIsLeftPaneResizing(false);
      leftPaneResizeStateRef.current = {
        startWidth: 0,
        startX: 0,
      };
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isLeftPaneResizing, showLeftPaneResizer, viewport.width]);

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
    if (!trackingRequested) {
      cameraRetryRef.current = null;
      return () => {
        mountedRef.current = false;
      };
    }

    appLog.info("Camera initialization effect started");
    setTrackingReadiness((current) =>
      reduceTrackingReadiness(current, { type: "START_REQUEST" }),
    );

    let cancelled = false;
    let requestInFlight = false;
    let requestSequence = 0;
    let automaticRetryAttempts = 0;
    let retryTimerId = 0;
    let observedStream = null;
    let stopObservingCameraStream = () => {};

    const clearRetryTimer = () => {
      if (retryTimerId) {
        window.clearTimeout(retryTimerId);
        retryTimerId = 0;
      }
    };

    const releaseStream = (stream) => {
      if (!stream) {
        return;
      }

      if (observedStream === stream) {
        stopObservingCameraStream();
        stopObservingCameraStream = () => {};
        observedStream = null;
      }

      const releaseResult = releaseCameraStream({
        stream,
        videoElements: [videoRef.current, attachedVideoElementRef.current],
      });
      if (streamRef.current === stream) {
        streamRef.current = null;
      }
      if (
        !attachedVideoElementRef.current ||
        !streamRef.current ||
        attachedVideoElementRef.current.srcObject !== streamRef.current
      ) {
        attachedVideoElementRef.current = null;
      }
      appLog.info("Released camera stream", releaseResult);
    };

    const scheduleInterruptedRetry = (reason) => {
      clearRetryTimer();
      retryTimerId = window.setTimeout(() => {
        retryTimerId = 0;
        cameraRetryRef.current?.(`interrupted_${reason}`);
      }, CAMERA_INTERRUPTION_RETRY_DELAY_MS);
    };

    const handleStreamInterruption = (stream, reason) => {
      if (cancelled || streamRef.current !== stream) {
        return;
      }

      appLog.warn("Camera stream was interrupted", { reason });
      clearCameraTrackingReadiness();
      setTrackingReadiness((current) =>
        reduceTrackingReadiness(current, {
          type: "TRACK_INTERRUPTED",
          error: new Error(`Camera stream interrupted: ${reason}`),
        }),
      );
      releaseStream(stream);
      if (automaticRetryAttempts >= 1) {
        setCameraError(
          "Camera connection was interrupted and could not reconnect. Select Retry camera to try again.",
        );
        return;
      }

      setCameraError("Camera connection was interrupted. Reconnecting…");
      scheduleInterruptedRetry(reason);
    };

    const requestCamera = async (reason) => {
      if (cancelled || requestInFlight) {
        return false;
      }

      requestInFlight = true;
      const requestId = requestSequence + 1;
      requestSequence = requestId;
      let candidateStream = null;

      try {
        const captureResolution =
          dynamicQualityBudgetRef.current.captureResolution;
        appLog.info("Requesting webcam access", {
          reason,
          captureResolution,
          qualityLevel: dynamicQualityBudgetRef.current.level,
        });
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser does not support webcam access.");
        }

        candidateStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(requestedCameraDeviceId
              ? { deviceId: { exact: requestedCameraDeviceId } }
              : { facingMode: "user" }),
            width: { ideal: captureResolution.width },
            height: { ideal: captureResolution.height },
          },
        });

        if (cancelled || requestSequence !== requestId || !mountedRef.current) {
          appLog.warn("Camera stream obtained after lifecycle changed; closing tracks", {
            reason,
          });
          releaseCameraStream({ stream: candidateStream });
          return false;
        }

        streamRef.current = candidateStream;
        observedStream = candidateStream;
        stopObservingCameraStream = observeCameraStreamInterruptions(
          candidateStream,
          (interruptionReason) => {
            handleStreamInterruption(candidateStream, interruptionReason);
          },
        );

        const video = videoRef.current;
        if (!video) {
          throw new Error("Camera preview is unavailable.");
        }
        await attachStreamToVideoElement(video, reason);

        const readyAction = getCameraVideoKeepAliveAction({
          video,
          stream: candidateStream,
          attachedVideoElement: attachedVideoElementRef.current,
        });
        if (readyAction.shouldRecover || readyAction.shouldAttach) {
          throw new Error(
            readyAction.shouldRecover
              ? "Camera stream ended before playback became ready."
              : "Camera playback did not become ready.",
          );
        }
        if (cancelled || requestSequence !== requestId || streamRef.current !== candidateStream) {
          releaseStream(candidateStream);
          return false;
        }

        automaticRetryAttempts = 0;
        setCameraError("");
        setCameraReady(true);
        setTrackingReadiness((current) =>
          reduceTrackingReadiness(current, {
            type: "CAMERA_READY",
            deviceId: candidateStream.getVideoTracks?.()[0]?.getSettings?.().deviceId ?? "",
          }),
        );
        if (navigator.mediaDevices?.enumerateDevices) {
          void navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
              if (!cancelled) {
                setCameraDevices(devices.filter((device) => device.kind === "videoinput"));
              }
            })
            .catch(() => {});
        }
        appLog.info("Camera is ready", { reason });
        return true;
      } catch (error) {
        if (candidateStream) {
          releaseStream(candidateStream);
        }
        if (!cancelled && requestSequence === requestId) {
          clearCameraTrackingReadiness();
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Camera access failed. Check browser permissions.";
          appLog.error("Camera initialization failed", { reason, error });
          setTrackingReadiness((current) =>
            reduceTrackingReadiness(current, { type: "CAMERA_ERROR", error }),
          );
          setCameraError(
            reason === "camera_init"
              ? `${errorMessage} Select Retry camera to try again.`
              : `Camera reconnection failed: ${errorMessage} Select Retry camera to try again.`,
          );
        }
        return false;
      } finally {
        if (requestSequence === requestId) {
          requestInFlight = false;
        }
      }
    };

    cameraRetryRef.current = (reason = "manual_retry") => {
      if (cancelled) {
        return;
      }
      if (requestInFlight) {
        if (reason === "manual_retry") {
          setCameraError("A camera request is already in progress.");
        }
        return;
      }

      const isAutomaticRetry = reason !== "manual_retry";
      if (isAutomaticRetry && automaticRetryAttempts >= 1) {
        clearCameraTrackingReadiness();
        setCameraError(
          "Camera connection was interrupted and could not reconnect. Select Retry camera to try again.",
        );
        return;
      }

      if (isAutomaticRetry) {
        automaticRetryAttempts += 1;
      } else {
        automaticRetryAttempts = 0;
      }

      clearRetryTimer();
      releaseStream(streamRef.current);
      clearCameraTrackingReadiness();
      setTrackingReadiness((current) =>
        reduceTrackingReadiness(current, { type: "START_REQUEST" }),
      );
      setCameraError(
        isAutomaticRetry
          ? "Camera connection was interrupted. Reconnecting…"
          : "Retrying camera…",
      );
      void requestCamera(reason);
    };

    void requestCamera("camera_init");

    return () => {
      appLog.info("Camera initialization cleanup started");
      cancelled = true;
      requestSequence += 1;
      cameraRetryRef.current = null;
      clearRetryTimer();
      mountedRef.current = false;
      if (rafRef.current) {
        appLog.debug("Cancelling RAF during camera cleanup", { rafId: rafRef.current });
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        appLog.info("Stopping webcam tracks during cleanup", {
          trackCount: streamRef.current.getTracks().length,
        });
        releaseStream(streamRef.current);
      }
      attachedVideoElementRef.current = null;
    };
  }, [appLog, requestedCameraDeviceId, trackingRequested]);

  useEffect(() => {
    if (!trackingRequested) {
      setModelReady(false);
      setModelError("");
      return undefined;
    }

    let cancelled = false;
    appLog.info("Hand-tracking model initialization effect started");
    setModelReady(false);
    setModelError("");
    setTrackingReadiness((current) =>
      reduceTrackingReadiness(current, { type: "MODEL_LOADING" }),
    );

    const initModel = async () => {
      try {
        const initialMaxHands = getTrackingDetectorMaxHandsForContext(
          phaseRef.current,
          fullscreenGridModeRef.current,
        );
        const requestedModelType =
          dynamicQualityBudgetRef.current.modelPreference;
        const preferredConfig =
          INITIAL_TRACKING_RUNTIME === "mediapipe"
            ? {
                runtime: "mediapipe",
                modelType: requestedModelType,
                maxHands: initialMaxHands,
              }
            : {
                runtime: "tfjs",
                backend: "webgl",
                modelType: requestedModelType,
                maxHands: initialMaxHands,
              };

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
            modelType: requestedModelType,
            maxHands: initialMaxHands,
          });
        }

        if (cancelled) {
          appLog.warn("Model initialized after cancellation; disposing detector");
          detector?.dispose?.();
          return;
        }
        detectorRef.current = detector;
        detectorMaxHandsRef.current = preferredConfig.maxHands;
        detectorModelTypeRef.current = preferredConfig.modelType;
        const runtime = getCurrentRuntime() || preferredConfig.runtime;
        const backend =
          getCurrentBackend() || (runtime === "mediapipe" ? "n/a" : preferredConfig.backend || "webgl");
        setActiveRuntime(runtime);
        setActiveBackend(backend);
        appLog.info("Hand-tracking detector is ready");
        setModelReady(true);
        setTrackingReadiness((current) =>
          reduceTrackingReadiness(current, { type: "MODEL_READY" }),
        );
      } catch (error) {
        appLog.error("Failed to initialize hand-tracking detector", { error });
        setModelError(
          error instanceof Error
            ? error.message
            : "Failed to initialize hand tracking model.",
        );
        setTrackingReadiness((current) =>
          reduceTrackingReadiness(current, { type: "MODEL_ERROR", error }),
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
  }, [appLog, modelRetryAttempt, trackingRequested]);

  useEffect(() => {
    if (!modelReady || !detectorRef.current) {
      return;
    }

    const requestedMaxHands = getTrackingDetectorMaxHandsForContext(
      phase,
      fullscreenGridMode,
    );
    const requestedModelType =
      dynamicQualityBudget.modelPreference;
    if (
      detectorMaxHandsRef.current === requestedMaxHands &&
      detectorModelTypeRef.current === requestedModelType
    ) {
      return;
    }

    let cancelled = false;
    const requestId = detectorReconfigurationSeqRef.current + 1;
    detectorReconfigurationSeqRef.current = requestId;

    const reconfigureHandDetector = async () => {
      const currentRuntime = getCurrentRuntime() || activeRuntime || INITIAL_TRACKING_RUNTIME;
      const currentBackend = getCurrentBackend() || activeBackend || "webgl";
      const requestedConfig =
        currentRuntime === "mediapipe"
          ? {
              runtime: "mediapipe",
              modelType: requestedModelType,
              maxHands: requestedMaxHands,
            }
          : {
              runtime: "tfjs",
              backend: currentBackend === "cpu" ? "cpu" : "webgl",
              modelType: requestedModelType,
              maxHands: requestedMaxHands,
            };

      recoveringDetectorRef.current = true;
      appLog.info("Reconfiguring hand-tracking detector hand capacity", {
        requestedRuntime: requestedConfig.runtime,
        requestedBackend: requestedConfig.backend ?? "n/a",
        previousMaxHands: detectorMaxHandsRef.current,
        previousModelType: detectorModelTypeRef.current,
        requestedMaxHands,
        requestedModelType,
        fullscreenGridMode,
      });

      try {
        const previousDetector = detectorRef.current;
        const nextDetector = await initHandTracking(requestedConfig);

        if (cancelled || detectorReconfigurationSeqRef.current !== requestId) {
          nextDetector?.dispose?.();
          return;
        }

        detectorRef.current = nextDetector;
        detectorMaxHandsRef.current = requestedMaxHands;
        detectorModelTypeRef.current = requestedModelType;
        if (previousDetector && previousDetector !== nextDetector) {
          previousDetector.dispose?.();
        }
        setActiveRuntime(getCurrentRuntime() || requestedConfig.runtime);
        setActiveBackend(
          getCurrentBackend() ||
            requestedConfig.backend ||
            (requestedConfig.runtime === "mediapipe" ? "n/a" : "unknown"),
        );
        setModelError("");
        appLog.info("Hand-tracking detector capacity reconfigured", {
          activeRuntime: getCurrentRuntime(),
          activeBackend: getCurrentBackend(),
          activeMaxHands: requestedMaxHands,
          activeModelType: requestedModelType,
        });
      } catch (error) {
        if (!cancelled && detectorReconfigurationSeqRef.current === requestId) {
          appLog.error("Failed to reconfigure hand-tracking detector capacity", {
            requestedRuntime: requestedConfig.runtime,
            requestedBackend: requestedConfig.backend ?? "n/a",
            requestedMaxHands,
            error,
          });
          setModelError(
            error instanceof Error
              ? error.message
              : "Failed to reconfigure hand tracking model.",
          );
        }
      } finally {
        if (detectorReconfigurationSeqRef.current === requestId) {
          recoveringDetectorRef.current = false;
        }
      }
    };

    void reconfigureHandDetector();

    return () => {
      cancelled = true;
    };
  }, [
    activeBackend,
    activeRuntime,
    appLog,
    dynamicQualityBudget.modelPreference,
    fullscreenGridMode,
    modelReady,
    phase,
  ]);

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
  }, [appLog, phase]);

  useEffect(() => {
    const activeVideoElement = videoRef.current;
    if (!cameraReady || !activeVideoElement || !streamRef.current) {
      return;
    }

    if (
      attachedVideoElementRef.current === activeVideoElement &&
      activeVideoElement.srcObject === streamRef.current
    ) {
      return;
    }

    void attachStreamToVideoElement(activeVideoElement, "phase_video_swap").catch((error) => {
      appLog.error("Failed to attach camera stream after active video element changed", {
        phase,
        error,
      });
      clearCameraTrackingReadiness();
      setCameraError("Camera playback was interrupted. Reconnecting…");
      retryCamera("phase_video_swap_playback");
    });
  }, [cameraReady, phase]);

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

  useEffect(() => {
    if (
      phase === PHASES.BODY_POSE ||
      phase === PHASES.OFF_AXIS_LAB ||
      phase === PHASES.MINORITY_REPORT_LAB
    ) {
      void ensurePoseDetectorInitialized(
        phase === PHASES.BODY_POSE
          ? "enter_body_pose"
          : phase === PHASES.OFF_AXIS_LAB
            ? "enter_off_axis_lab"
            : "enter_minority_report_lab",
      );
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      if (poseDetectorRef.current) {
        poseDetectorRef.current.dispose?.();
        poseDetectorRef.current = null;
      }
      if (fullscreenBodyPoseDetectorRef.current) {
        fullscreenBodyPoseDetectorRef.current.dispose?.();
        fullscreenBodyPoseDetectorRef.current = null;
      }
    };
  }, []);

  async function ensurePoseDetectorInitialized(reason = "manual") {
    if (poseDetectorRef.current) {
      setPoseModelReady(true);
      return true;
    }

    if (poseInitPromiseRef.current) {
      await poseInitPromiseRef.current;
      return Boolean(poseDetectorRef.current);
    }

    const requestedBackend = getCurrentBackend() === "cpu" ? "cpu" : "webgl";
    setPoseModelReady(false);
    setPoseModelError("");
    poseInitPromiseRef.current = (async () => {
      try {
        appLog.info("Initializing pose detector", {
          reason,
          requestedBackend,
        });
        const detector = await initPoseTracking({
          runtime: "tfjs",
          backend: requestedBackend,
        });
        poseDetectorRef.current = detector;
        setPoseModelReady(true);
        setPoseModelError("");
        appLog.info("Pose detector ready", {
          reason,
          runtime: getPoseRuntime(),
        });
      } catch (error) {
        appLog.error("Pose detector initialization failed", { reason, error });
        setPoseModelError(
          error instanceof Error
            ? error.message
            : "Failed to initialize body pose detector.",
        );
      } finally {
        poseInitPromiseRef.current = null;
      }
    })();

    await poseInitPromiseRef.current;
    return Boolean(poseDetectorRef.current);
  }

  function getRecoveryConfig(attempt, reason) {
    const currentRuntime = getCurrentRuntime() || activeRuntime;
    const currentBackend = getCurrentBackend() || activeBackend;
    const requestedModelType =
      dynamicQualityBudgetRef.current.modelPreference;
    const requestedMaxHands = getTrackingDetectorMaxHandsForContext(
      phaseRef.current,
      fullscreenGridModeRef.current,
    );

    // Keep MediaPipe as the sticky runtime once it has been reached.
    if (currentRuntime === "mediapipe") {
      // Periodically probe TFJS in case a device/runtime combination recovers.
      if (attempt % 4 === 0) {
        return {
          runtime: "tfjs",
          backend: "webgl",
          modelType: requestedModelType,
          maxHands: requestedMaxHands,
        };
      }
      return {
        runtime: "mediapipe",
        modelType: requestedModelType,
        maxHands: requestedMaxHands,
      };
    }

    // TFJS invalid-keypoint corruption should switch straight to MediaPipe.
    if (reason === "continuous_invalid_landmarks") {
      return {
        runtime: "mediapipe",
        modelType: requestedModelType,
        maxHands: requestedMaxHands,
      };
    }

    if (attempt === 1) {
      return {
        runtime: "tfjs",
        backend: currentBackend === "cpu" ? "cpu" : "webgl",
        modelType: requestedModelType,
        maxHands: requestedMaxHands,
      };
    }

    if (attempt === 2) {
      return {
        runtime: "mediapipe",
        modelType: requestedModelType,
        maxHands: requestedMaxHands,
      };
    }

    return {
      runtime: "tfjs",
      backend: "cpu",
      modelType: requestedModelType,
      maxHands: requestedMaxHands,
    };
  }

  async function recoverDetectorFromInvalidLandmarks(reason, details) {
    if (recoveringDetectorRef.current) {
      return;
    }

    recoveringDetectorRef.current = true;
    detectorRecoveryAttemptsRef.current += 1;
    lastDetectorRecoveryAtRef.current = getTrackingTimestamp();
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
      detectorMaxHandsRef.current = requestedConfig.maxHands;
      detectorModelTypeRef.current = requestedConfig.modelType;
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
      setModelError("");
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

  function updateProductPath(path, { replace = false } = {}) {
    if (!path || window.location.pathname === path) {
      return;
    }

    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", path);
  }

  function replaceExperienceLifecycle(nextLifecycle, nextModeId = experienceModeIdRef.current) {
    experienceLifecycleRef.current = nextLifecycle;
    experienceModeIdRef.current = nextModeId;
    setExperienceLifecycle(nextLifecycle);
    setExperienceModeId(nextModeId);
  }

  function dispatchExperienceLifecycle(event) {
    const current = experienceLifecycleRef.current;
    if (!current) {
      return null;
    }
    const transition = transitionExperienceLifecycle(current, event);
    if (transition.state !== current) {
      replaceExperienceLifecycle(transition.state);
    }
    return transition;
  }

  function abandonActiveProgressionSession(reason = "left_experience") {
    const activeSession = activeProgressionSessionRef.current;
    if (!activeSession) {
      return null;
    }

    activeProgressionSessionRef.current = null;
    try {
      return progressionStoreRef.current.abandonSession({
        sessionId: activeSession.sessionId,
        endedAt: new Date().toISOString(),
        context: { reason },
      });
    } catch (error) {
      appLog.warn("Could not close local progression session", {
        error,
        modeId: activeSession.modeId,
        reason,
      });
      return null;
    }
  }

  function beginProgressionSession(mode, context = {}) {
    const canRecord =
      mode?.supportsResults &&
      (mode.entryKind === "fullscreen-mode" ||
        mode.id === "whack-a-mole" ||
        mode.id === "spatial-memory");
    if (!canRecord) {
      abandonActiveProgressionSession("opened_non_scored_experience");
      setLatestGameResult(null);
      replaceExperienceLifecycle(null, null);
      return null;
    }

    abandonActiveProgressionSession("started_another_experience");
    const startedAt = new Date().toISOString();
    const session = {
      sessionId: createProgressionSessionId(),
      modeId: mode.id,
      fullscreenMode: mode.fullscreenMode ?? null,
      startedAt,
      startedAtMs: performance.now(),
    };
    activeProgressionSessionRef.current = session;
    setLatestGameResult(null);
    replaceExperienceLifecycle(
      createExperienceLifecycle({
        autoStart: true,
        countdownMs: 0,
        resumeCountdownMs: 1_000,
      }),
      mode.id,
    );
    progressionStoreRef.current.beginSession({
      sessionId: session.sessionId,
      modeId: session.modeId,
      startedAt,
      context: {
        input: cameraReady && modelReady ? "tracking" : "pointer",
        ...context,
      },
    });
    return session;
  }

  function getActiveProgressionResult() {
    const session = activeProgressionSessionRef.current;
    if (!session) {
      return null;
    }

    const endedAt = new Date().toISOString();
    const durationMs = Math.max(0, performance.now() - session.startedAtMs);
    if (session.modeId === "whack-a-mole") {
      return createWhackAMoleResult({
        summary: getWhackAMoleSummary(whackAMoleStateRef.current),
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        endedAt,
        durationMs,
      });
    }
    if (session.modeId === "spatial-memory") {
      return createSpatialMemoryResult({
        state: spatialMemoryState,
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        endedAt,
        durationMs,
      });
    }

    const stateByFullscreenMode = {
      "sky-patrol": fullscreenSkyPatrolStateRef.current,
      "fruit-ninja": fullscreenFruitNinjaStateRef.current,
      "missile-command": fullscreenMissileCommandStateRef.current,
      "brick-dodger": fullscreenBrickDodgerStateRef.current,
      "hand-bounce": fullscreenHandBounceStateRef.current,
      breakout: fullscreenBreakoutStateRef.current,
      "find-your-grind-breakout": fullscreenBreakoutStateRef.current,
      "breakout-coop": fullscreenBreakoutCoopStateRef.current,
      "finger-pong": fullscreenFingerPongStateRef.current,
      "tic-tac-toe": fullscreenTicTacToeStateRef.current,
      invaders: fullscreenInvadersStateRef.current,
      flappy: fullscreenFlappyStateRef.current,
    };
    return createFullscreenGameResult({
      fullscreenMode: session.fullscreenMode,
      state: stateByFullscreenMode[session.fullscreenMode],
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      endedAt,
      durationMs,
    });
  }

  function recordActiveProgressionResult() {
    const result = getActiveProgressionResult();
    if (!result) {
      return null;
    }

    const recorded = progressionStoreRef.current.recordResult(result);
    const arcadeRunRequest =
      activeLaunchContextRef.current?.arcadeRunRequest ??
      arcadeRunLaunchRequestRef.current;
    if (arcadeRunRequest) {
      void import("./arcadeRunIntegration.js")
        .then(({ createArcadeRunResultEnvelope }) => {
          setArcadeRunIncomingResult(
            createArcadeRunResultEnvelope(
              arcadeRunRequest,
              recorded.result,
            ),
          );
        })
        .catch((error) => {
          appLog.warn("Could not attach this result to Arcade Run", {
            error,
            modeId: result.modeId,
          });
        });
    }
    activeProgressionSessionRef.current = null;
    setLatestGameResult(recorded.result);
    dispatchExperienceLifecycle({
      type: EXPERIENCE_LIFECYCLE_EVENTS.FINISH,
      result: {
        ...recorded.result,
        isPersonalBest: recorded.personalBests.some(
          ({ metricId, value }) => metricId === "score" && value > 0,
        ),
        personalBestMetricIds: recorded.personalBests.map(
          ({ metricId }) => metricId,
        ),
      },
    });
    return recorded;
  }

  function beginRestartedProgressionSession(mode, context = {}) {
    if (!recordActiveProgressionResult()) {
      abandonActiveProgressionSession("restarted");
    }
    return beginProgressionSession(mode, { restart: true, ...context });
  }

  function handleArcadeRunSessionChange(session, event = {}) {
    try {
      if (!session || session.status === "complete") {
        window.localStorage.removeItem(ARCADE_RUN_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          ARCADE_RUN_STORAGE_KEY,
          JSON.stringify(session),
        );
      }
    } catch (error) {
      appLog.warn("Could not save Arcade Run progress", { error });
    }

    if (
      event.type === "run-returned-from-game" ||
      event.type === "run-returned-without-result"
    ) {
      arcadeRunLaunchRequestRef.current = null;
    }
  }

  function handleArcadeRunLaunch(request) {
    const mode = getModeById(request?.modeId);
    if (!mode) {
      appLog.warn("Arcade Run requested an unknown mode", {
        modeId: request?.modeId,
      });
      return;
    }

    arcadeRunLaunchRequestRef.current = request;
    const launchContext = {
      arcadeRunRequest: request,
      ...(request.dailyChallenge && mode.dailyChallenge
        ? {
            challenge: "daily",
            dayKey: request.dailyChallenge.dayKey,
          }
        : {}),
    };
    selectProductMode(mode, {
      allowWithoutTracking: request.inputMethod !== "tracking",
      launchContext,
    });
  }

  function handleArcadeRunComplete({ session }) {
    void import("./arcadeRunIntegration.js")
      .then(({ createArcadeRunProgressionResult }) => {
        const result = createArcadeRunProgressionResult(session);
        if (!result) {
          return;
        }
        const recorded = progressionStoreRef.current.recordResult(result);
        setLatestGameResult(recorded.result);
        arcadeRunLaunchRequestRef.current = null;
        setArcadeRunIncomingResult(null);
      })
      .catch((error) => {
        appLog.warn("Could not record Arcade Run results", { error });
      });
  }

  function returnToArcadeRun({ updateHistory = true } = {}) {
    if (!recordActiveProgressionResult()) {
      abandonActiveProgressionSession("returned_to_arcade_run");
    }
    stopGameSession();
    replaceExperienceLifecycle(null, null);
    setPendingModeId(null);
    pendingLaunchContextRef.current = null;
    activeLaunchContextRef.current = {};
    setPhase(PHASES.ARCADE_RUN);
    phaseRef.current = PHASES.ARCADE_RUN;
    if (updateHistory) {
      updateProductPath("/play/arcade-run");
    }
  }

  function exitCurrentExperience() {
    if (
      activeLaunchContextRef.current?.arcadeRunRequest ||
      arcadeRunLaunchRequestRef.current
    ) {
      returnToArcadeRun();
      return;
    }
    navigateToProductHome();
  }

  function navigateToProductHome({
    updateHistory = true,
    area = "all",
  } = {}) {
    if (!recordActiveProgressionResult()) {
      abandonActiveProgressionSession("returned_home");
    }
    stopGameSession();
    replaceExperienceLifecycle(null, null);
    setPendingModeId(null);
    pendingLaunchContextRef.current = null;
    activeLaunchContextRef.current = {};
    arcadeRunLaunchRequestRef.current = null;
    setProductHomeArea(area);
    setPhase(PHASES.HOME);
    phaseRef.current = PHASES.HOME;
    if (updateHistory) {
      updateProductPath(getProductHomePathForArea(area));
    }
  }

  function openProductTrackingSetup({ updateHistory = true } = {}) {
    if (!recordActiveProgressionResult()) {
      abandonActiveProgressionSession("opened_tracking_setup");
    }
    replaceExperienceLifecycle(null, null);
    resetTrackingInteractionCheck();
    setTrackingReadiness((current) =>
      reduceTrackingReadiness(current, { type: "RESET_INTERACTION" }),
    );
    setPhase(PHASES.TRACKING_SETUP);
    phaseRef.current = PHASES.TRACKING_SETUP;
    if (updateHistory) {
      updateProductPath("/setup");
    }
  }

  function openProductSettings({ updateHistory = true } = {}) {
    if (!recordActiveProgressionResult()) {
      abandonActiveProgressionSession("opened_settings");
    }
    replaceExperienceLifecycle(null, null);
    setPhase(PHASES.SETTINGS);
    phaseRef.current = PHASES.SETTINGS;
    if (updateHistory) {
      updateProductPath("/settings");
    }
  }

  function launchRegisteredModeNow(
    mode,
    { updateHistory = true, launchContext = {} } = {},
  ) {
    if (!mode) {
      navigateToProductHome({ updateHistory });
      return;
    }

    setPendingModeId(null);
    pendingLaunchContextRef.current = null;
    activeLaunchContextRef.current =
      launchContext && typeof launchContext === "object"
        ? { ...launchContext }
        : {};
    if (
      !mode.hiddenFromLibrary &&
      [PRODUCT_AREAS.PLAY, PRODUCT_AREAS.CREATE, PRODUCT_AREAS.LABS].includes(mode.area)
    ) {
      setPreferences((current) => recordRecentMode(current, mode.id));
    }
    if (updateHistory) {
      updateProductPath(mode.path);
    }

    if (mode.entryKind === "page" && mode.href) {
      window.location.assign(mode.href);
      return;
    }

    if (mode.entryKind === "fullscreen-mode" && mode.fullscreenMode) {
      beginProgressionSession(mode, activeLaunchContextRef.current);
      openFullscreenCameraScreen();
      const fullscreenMode =
        mode.id === "visualizer"
          ? motionVisualizerStateRef.current.effect
          : mode.fullscreenMode;
      fullscreenGridModeRef.current = fullscreenMode;
      setFullscreenGridMode(fullscreenMode);
      return;
    }

    switch (mode.id) {
      case "home":
        navigateToProductHome({ updateHistory: false });
        break;
      case "tracking-setup":
        openProductTrackingSetup({ updateHistory: false });
        break;
      case "whack-a-mole":
        startGameSession();
        break;
      case "spatial-memory":
        startSpatialGestureMemorySession();
        break;
      case "track-runner":
        startRunnerSession();
        break;
      case "star-flight":
        startFlightSession();
        break;
      case "conveyor-toss":
        startConveyorSession();
        break;
      case "pinch-sandbox":
        openSandboxScreen();
        break;
      case "probability-table":
        startRouletteSession();
        break;
      case "pose-quest":
        startBodyPoseLab();
        break;
      case "forest-discovery":
        startOffAxisLab();
        break;
      case "spatial-desk":
        startGestureControlOS();
        break;
      case "spatial-investigation":
        startMinorityReportLab();
        break;
      case "gesture-analytics":
        startGestureAnalyticsLab();
        break;
      case "gesture-art":
        startGestureArtLab();
        break;
      default:
        if (mode.phase) {
          setPhase(mode.phase);
          phaseRef.current = mode.phase;
        } else {
          navigateToProductHome({ updateHistory: false });
        }
    }
  }

  function selectProductMode(
    modeOrId,
    {
      updateHistory = true,
      allowWithoutTracking = false,
      launchContext = {},
    } = {},
  ) {
    const mode =
      typeof modeOrId === "string" ? getModeById(modeOrId) : modeOrId;
    if (!mode) {
      return;
    }

    const needsTracking =
      mode.trackingProfile && mode.trackingProfile !== TRACKING_PROFILES.NONE;
    if (
      needsTracking &&
      !allowWithoutTracking &&
      (
        !cameraReady ||
        !modelReady ||
        trackingReadiness.status !== TRACKING_READINESS_STATES.READY
      )
    ) {
      setPendingModeId(mode.id);
      pendingLaunchContextRef.current =
        launchContext && typeof launchContext === "object"
          ? { ...launchContext }
          : {};
      if (updateHistory) {
        updateProductPath(mode.path);
      }
      openProductTrackingSetup({ updateHistory: false });
      return;
    }

    launchRegisteredModeNow(mode, { updateHistory, launchContext });
  }

  function beginProductTrackingSetup() {
    setCameraError("");
    setModelError("");
    resetTrackingInteractionCheck();
    setTrackingRequested(true);
  }

  function retryProductTrackingSetup() {
    setCameraError("");
    setModelError("");
    resetTrackingInteractionCheck();

    if (!trackingRequested) {
      setTrackingRequested(true);
      return;
    }

    if (
      trackingReadiness.status === TRACKING_READINESS_STATES.MODEL_ERROR
    ) {
      setModelReady(false);
      setModelRetryAttempt((attempt) => attempt + 1);
      return;
    }

    retryCamera("manual_retry");
  }

  function continueFromProductTrackingSetup() {
    if (trackingReadiness.status !== TRACKING_READINESS_STATES.READY) {
      return;
    }
    if (pendingModeId) {
      selectProductMode(pendingModeId, {
        updateHistory: false,
        allowWithoutTracking: false,
        launchContext: pendingLaunchContextRef.current ?? {},
      });
      return;
    }
    navigateToProductHome();
  }

  function continueWithoutProductTracking() {
    const pendingMode = pendingModeId ? getModeById(pendingModeId) : null;
    setTrackingRequested(false);
    if (pendingMode?.supportsPointerFallback) {
      launchRegisteredModeNow(pendingMode, {
        updateHistory: false,
        launchContext: pendingLaunchContextRef.current ?? {},
      });
      return;
    }
    navigateToProductHome({
      updateHistory: window.location.pathname !== "/",
    });
  }

  function stopProductCamera() {
    setTrackingRequested(false);
    setCameraError("");
    setModelError("");
    setCameraDevices([]);
    resetTrackingInteractionCheck();
    setTrackingReadiness((current) =>
      reduceTrackingReadiness(current, { type: "STOP" }),
    );
  }

  function updateProductPreferences(nextPreferences) {
    setPreferences(normalizeUserPreferences(nextPreferences));
  }

  function persistMotionVisualizerState(nextState) {
    const normalized = saveMotionVisualizerState(nextState);
    motionVisualizerStateRef.current = normalized;
    setMotionVisualizerState(normalized);
    if (
      phaseRef.current === PHASES.FULLSCREEN_CAMERA &&
      isMotionVisualizerEffect(fullscreenGridModeRef.current) &&
      fullscreenGridModeRef.current !== normalized.effect
    ) {
      fullscreenGridModeRef.current = normalized.effect;
      setFullscreenGridMode(normalized.effect);
    }
    return normalized;
  }

  function updateMotionVisualizerSettings(patch) {
    const next = persistMotionVisualizerState(
      normalizeMotionVisualizerState({
        ...motionVisualizerStateRef.current,
        ...patch,
      }),
    );
    if (patch?.effect) {
      const effect = MOTION_VISUALIZER_EFFECTS.find(
        (candidate) => candidate.id === next.effect,
      );
      setMotionVisualizerStatus(
        `${effect?.label ?? "Visualizer"} effect selected.`,
      );
    } else {
      setMotionVisualizerStatus("Remix controls updated.");
    }
  }

  function toggleCurrentMotionVisualizerFavorite() {
    const current = motionVisualizerStateRef.current;
    const wasFavorite = current.favoriteEffects.includes(current.effect);
    persistMotionVisualizerState(
      toggleMotionVisualizerFavorite(current, current.effect),
    );
    const effect = MOTION_VISUALIZER_EFFECTS.find(
      (candidate) => candidate.id === current.effect,
    );
    setMotionVisualizerStatus(
      wasFavorite
        ? `${effect?.label ?? "Effect"} removed from favorites.`
        : `${effect?.label ?? "Effect"} added to favorites.`,
    );
  }

  function applySelectedMotionVisualizerPreset(presetId) {
    const before = motionVisualizerStateRef.current;
    const next = applyMotionVisualizerPreset(before, presetId);
    persistMotionVisualizerState(next);
    setMotionVisualizerStatus(
      next === before ? "That saved look is unavailable." : "Look applied.",
    );
  }

  function saveCurrentMotionVisualizerPreset() {
    const next = createMotionVisualizerPreset(
      motionVisualizerStateRef.current,
    );
    persistMotionVisualizerState(next);
    setMotionVisualizerStatus(
      `${next.savedPresets.at(-1)?.label ?? "Look"} saved on this device.`,
    );
  }

  function deleteSelectedMotionVisualizerPreset(presetId) {
    const current = motionVisualizerStateRef.current;
    const exists = current.savedPresets.some(
      (preset) => preset.id === presetId,
    );
    persistMotionVisualizerState(
      deleteMotionVisualizerPreset(current, presetId),
    );
    setMotionVisualizerStatus(
      exists ? "Saved look deleted." : "That saved look is unavailable.",
    );
  }

  async function exportMotionVisualizerArtwork() {
    try {
      const {
        createMotionVisualizerSnapshotFilename,
        createMotionVisualizerSnapshotSvg,
      } = await import("./motionVisualizerSnapshot.js");
      const exportViewport = fullscreenCameraViewport ?? {
        width: viewportRef.current.width,
        height: viewportRef.current.height,
      };
      const svg = createMotionVisualizerSnapshotSvg({
        settings: motionVisualizerStateRef.current,
        width: exportViewport.width,
        height: exportViewport.height,
        indexPoints: fullscreenIndexPoints,
        tipPoints: fullscreenTipPoints,
      });
      const url = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = createMotionVisualizerSnapshotFilename(
        motionVisualizerStateRef.current.effect,
      );
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMotionVisualizerStatus(
        "Artwork exported without camera imagery.",
      );
    } catch (error) {
      appLog.warn("Could not export Motion Visualizer artwork", { error });
      setMotionVisualizerStatus(
        "Artwork export failed. Please try again.",
      );
    }
  }

  function deleteAllLocalProductData() {
    clearCalibration();
    clearUserPreferences();
    const localStorageCleanup = clearLocalProductStorage();
    if (localStorageCleanup.failed.length > 0) {
      appLog.warn("Could not remove every local product record", {
        failedKeyCount: localStorageCleanup.failed.length,
      });
    }
    void clearCreativeAssets();
    personalizationRef.current.clearSamples?.();
    setLabSampleCounts(personalizationRef.current.getSampleCounts());
    activeProgressionSessionRef.current = null;
    arcadeRunLaunchRequestRef.current = null;
    progressionStoreRef.current.clear();
    setArcadeRunIncomingResult(null);
    setLatestGameResult(null);
    setTransform(null);
    transformRef.current = null;
    setHasSavedCalibration(false);
    setSpatialMemoryState(createInitialSpatialMemoryState());
    setSpatialMemoryExperience(createSpatialMemoryExperience());
    setGestureAnalyticsLabSessionKey((current) => current + 1);
    setGestureArtSessionKey((current) => current + 1);
    setPreferences(normalizeUserPreferences());
    const resetVisualizer = normalizeMotionVisualizerState();
    motionVisualizerStateRef.current = resetVisualizer;
    setMotionVisualizerState(resetVisualizer);
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

  function openFullscreenCameraScreen() {
    appLog.info("Opening fullscreen camera screen");
    stopGameSession();
    resetArcCalibrationSession("open_fullscreen_camera");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPhase(PHASES.FULLSCREEN_CAMERA);
    phaseRef.current = PHASES.FULLSCREEN_CAMERA;
    setCalibrationMessage(
      "Fullscreen camera active. Webcam view fits the entire browser window without cropping.",
    );
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

  function returnFromFullscreenCameraScreen() {
    appLog.info("Returning from fullscreen camera to product home");
    navigateToProductHome();
  }

  function returnToFullscreenCameraMenu(reason = "manual_mode_select") {
    appLog.info("Returning from fullscreen experience to product home", {
      reason,
      previousMode: fullscreenGridModeRef.current,
    });
    navigateToProductHome();
  }

  function updateSandboxPhysics(timestamp, pointerPoint, hasHand, grabNow) {
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

    if (!grabNow || !hasHand || !pointerLocal) {
      releaseGrabbedBlock();
    }

    if (grabNow && hasHand && pointerLocal) {
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
    };
    setRunnerHud((previous) => {
      if (
        previous.coins === nextHud.coins &&
        previous.distance === nextHud.distance &&
        previous.trackCol === nextHud.trackCol &&
        previous.trackRow === nextHud.trackRow &&
        previous.trackSpacingPx === nextHud.trackSpacingPx
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
    });
    runnerGeometryLogKeyRef.current = "";
    setCalibrationMessage(
      "Runner mode active. Move hand to pick one of 4x4 converging tracks.",
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
      "Runner mode active. Move hand to pick one of 4x4 converging tracks.",
    );
    requestAnimationFrame(() => resetRunnerSession("start_runner"));
  }

  function startConveyorSession() {
    appLog.info("Conveyor sphere toss start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_conveyor");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationPairsRef.current = [];
    calibrationIndexRef.current = 0;
    setCalibrationTargetIndex(0);
    setCalibrationPairsCount(0);
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPhase(PHASES.CONVEYOR);
    phaseRef.current = PHASES.CONVEYOR;
    setCalibrationMessage(
      "Conveyor sphere toss active. Pinch to grab, then release to throw. Faster flicks add speed.",
    );
  }

  function returnFromRunnerSession() {
    appLog.info("Returning from runner mode to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function returnFromConveyorSession() {
    appLog.info("Returning from conveyor mode to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function returnFromRouletteSession() {
    appLog.info("Returning from roulette mode to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function startBodyPoseLab() {
    appLog.info("Body pose lab start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_body_pose_lab");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPoseStatus(createEmptyPoseStatus());
    setPhase(PHASES.BODY_POSE);
    phaseRef.current = PHASES.BODY_POSE;
    setCalibrationMessage(
      "Body Pose Highlight Lab active. Keep your head and upper body centered in frame.",
    );
    void ensurePoseDetectorInitialized("start_body_pose_lab");
  }

  function returnFromBodyPoseLab() {
    appLog.info("Returning from body pose lab to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function startOffAxisLab() {
    appLog.info("Off-axis chamber lab start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_off_axis_lab");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPoseStatus(createEmptyPoseStatus());
    setPhase(PHASES.OFF_AXIS_LAB);
    phaseRef.current = PHASES.OFF_AXIS_LAB;
    setCalibrationMessage(
      "Off-Axis Forest Walk active. Keep your face centered, then lean left and right to look past the trees.",
    );
    void ensurePoseDetectorInitialized("start_off_axis_lab");
  }

  function returnFromOffAxisLab() {
    appLog.info("Returning from off-axis chamber lab to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function startMinorityReportLab() {
    appLog.info("Minority Report Lab start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
      personalizationSamples: personalizationRef.current.getSampleCounts(),
    });
    stopGameSession();
    resetArcCalibrationSession("start_minority_report_lab");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    labTrainingSessionRef.current = null;
    gestureEngineRef.current.reset();
    setLabEngineOutput(createEmptyLabEngineOutput());
    setLabEventLog([]);
    setLabSampleCounts(personalizationRef.current.getSampleCounts());
    setLabTrainingState(createInitialLabTrainingState());
    setPhase(PHASES.MINORITY_REPORT_LAB);
    phaseRef.current = PHASES.MINORITY_REPORT_LAB;
    setCalibrationMessage(
      "Minority Report Lab active. Keep your forearm visible for steadier left/right hand labeling.",
    );
    void ensurePoseDetectorInitialized("start_minority_report_lab");
  }

  function startSpatialGestureMemorySession() {
    appLog.info("Spatial Gesture Memory start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_spatial_gesture_memory");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    labTrainingSessionRef.current = null;
    gestureEngineRef.current.reset();
    setLabEventLog([]);
    setPhase(PHASES.SPATIAL_GESTURE_MEMORY);
    phaseRef.current = PHASES.SPATIAL_GESTURE_MEMORY;
    setCalibrationMessage(
      "Spatial Gesture Memory active. Reproduce the sequence exactly under time pressure.",
    );
    startSpatialGestureMemoryRound();
  }

  function returnFromSpatialGestureMemorySession() {
    appLog.info("Returning from Spatial Gesture Memory to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function returnFromMinorityReportLab() {
    appLog.info("Returning from Minority Report Lab to product home");
    labTrainingSessionRef.current = null;
    setLabTrainingState((previous) =>
      previous.active
        ? {
            ...createInitialLabTrainingState(),
            message: "Training session cancelled.",
          }
        : previous,
    );
    navigateToProductHome();
  }

  function startGestureAnalyticsLab() {
    appLog.info("Gesture Analytics Lab start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_gesture_analytics_lab");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setAnalyticsHands([]);
    setAnalyticsTimestamp(0);
    setGestureAnalyticsLabSessionKey((value) => value + 1);
    setPhase(PHASES.GESTURE_ANALYTICS_LAB);
    phaseRef.current = PHASES.GESTURE_ANALYTICS_LAB;
    setCalibrationMessage(
      "Gesture Analytics Lab active. Movement is measured for behavioral instrumentation, not direct control.",
    );
  }

  function returnFromGestureAnalyticsLab() {
    appLog.info("Returning from Gesture Analytics Lab to calibration input test");
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function startGestureArtLab() {
    appLog.info("Gesture Art Lab start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_gesture_art_lab");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setGestureArtHands([]);
    setGestureArtSessionKey((value) => value + 1);
    setPhase(PHASES.GESTURE_ART_LAB);
    phaseRef.current = PHASES.GESTURE_ART_LAB;
    setCalibrationMessage(
      "Gesture Art Lab active. One hand draws particles, two hands warp the entire field.",
    );
  }

  function returnFromGestureArtLab() {
    appLog.info("Returning from Gesture Art Lab to calibration input test");
    setGestureArtHands([]);
    setPhase(PHASES.CALIBRATION);
    phaseRef.current = PHASES.CALIBRATION;
    setCalibrationMessage("Back on Calibration Input Test.");
  }

  function startGestureControlOS() {
    appLog.info("Gesture Control OS start requested", {
      currentPhase: phaseRef.current,
      cameraReady,
      modelReady,
    });
    stopGameSession();
    resetArcCalibrationSession("start_gesture_control_os");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    labTrainingSessionRef.current = null;
    gestureEngineRef.current.reset();
    setLabEngineOutput(createEmptyLabEngineOutput());
    setLabEventLog([]);
    setLabSampleCounts(personalizationRef.current.getSampleCounts());
    setLabTrainingState(createInitialLabTrainingState());
    setGestureControlOSSessionKey((value) => value + 1);
    setPhase(PHASES.GESTURE_CONTROL_OS);
    phaseRef.current = PHASES.GESTURE_CONTROL_OS;
    setCalibrationMessage(
      "Gesture Control OS active. Pinch to move windows and use gestures to manage the workspace.",
    );
  }

  function returnFromGestureControlOS() {
    appLog.info("Returning from Gesture Control OS to calibration input test");
    labTrainingSessionRef.current = null;
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
      const coinPalette = getRunnerCoinPaletteByDepth(depthT);
      const trackPoint = projectTrackPoint(coin.trackX, coin.trackY, depthT);
      const x = trackPoint.x;
      const y = trackPoint.y - coin.height * lerpValue(0.12, 0.66, depthT);
      const radius = lerpValue(4, 18, depthT);
      if (x < -60 || x > width + 60 || y < -60 || y > height + 60) {
        continue;
      }
      const glow = ctx.createRadialGradient(x, y, radius * 0.18, x, y, radius * 1.8);
      glow.addColorStop(0, coinPalette.glowInner);
      glow.addColorStop(1, coinPalette.glowOuter);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = coinPalette.fill;
      ctx.strokeStyle = coinPalette.stroke;
      ctx.lineWidth = Math.max(1, radius * 0.18);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const runnerTrackPoint = projectTrackPoint(state.trackXFloat, state.trackYFloat, 1);
    const runnerX = runnerTrackPoint.x;
    const runnerY = runnerTrackPoint.y;
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

    for (const coin of state.coins) {
      coin.z -= RUNNER_SPEED * dtSeconds;
      if (shouldCollectRunnerCoin(coin, state.trackXFloat, state.trackYFloat, 0)) {
        state.coinsCollected += coin.value ?? 1;
        appLog.info("Runner coin collected", {
          coinsCollected: state.coinsCollected,
          trackCol: state.trackXTargetIndex + 1,
          trackRow: state.trackYTargetIndex + 1,
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
    const summary = getWhackAMoleSummary(whackAMoleStateRef.current);
    appLog.info("Stopping game session", {
      wasRunning: summary.gameRunning,
      score: summary.score,
      timeLeft: summary.timeLeft,
    });
    const nextState = createWhackAMoleGame({
      seed: whackAMoleStateRef.current?.seed,
      config: whackAMoleStateRef.current?.config,
    });
    whackAMoleStateRef.current = nextState;
    setWhackAMoleState(nextState);
  }

  function applyWhackAMoleAction(action) {
    const nextState = reduceWhackAMoleGame(
      whackAMoleStateRef.current,
      action,
    );
    whackAMoleStateRef.current = nextState;
    setWhackAMoleState(nextState);
    return nextState;
  }

  function handleWhackAMoleAction(action) {
    const previousState = whackAMoleStateRef.current;
    if (
      action?.type === WHACK_A_MOLE_ACTIONS.START &&
      (previousState?.phase === WHACK_A_MOLE_PHASES.RESULT ||
        activeProgressionSessionRef.current?.modeId !== "whack-a-mole")
    ) {
      beginRestartedProgressionSession(
        getModeById("whack-a-mole"),
        activeLaunchContextRef.current,
      );
    }

    if (action?.type === WHACK_A_MOLE_ACTIONS.RESUME) {
      const transition = dispatchExperienceLifecycle({
        type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
        reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
      });
      if (transition?.state?.phase === EXPERIENCE_PHASES.PAUSED) {
        return previousState;
      }
    }

    const nextState = applyWhackAMoleAction(action);
    if (action?.type === WHACK_A_MOLE_ACTIONS.PAUSE) {
      dispatchExperienceLifecycle({
        type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
        reason: EXPERIENCE_PAUSE_REASONS.MANUAL,
      });
    }
    return nextState;
  }

  function startRouletteSession() {
    appLog.info("Roulette mode start requested");
    stopGameSession();
    resetArcCalibrationSession("open_roulette");
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    calibrationPairsRef.current = [];
    calibrationIndexRef.current = 0;
    setCalibrationTargetIndex(0);
    setCalibrationPairsCount(0);
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    setPhase(PHASES.ROULETTE);
    phaseRef.current = PHASES.ROULETTE;
    setCalibrationMessage("Roulette mode active. Pinch and hold to drag chips with your finger.");
  }

  function openCircleOfFifthsPage() {
    try {
      window.sessionStorage.setItem(
        CIRCLE_OF_FIFTHS_AUTOSTART_SESSION_KEY,
        JSON.stringify({
          issuedAt: Date.now(),
          from: "main-app",
        }),
      );
    } catch (error) {
      appLog.warn("Failed to persist circle of fifths launch intent", { error });
    }

    window.location.assign("/circle-of-fifths.html");
  }

  function startGameSession() {
    appLog.info("Starting game session requested", {
      currentPhase: phaseRef.current,
      launchContext: activeLaunchContextRef.current,
    });
    abandonActiveProgressionSession("opened_whack_briefing");
    setLatestGameResult(null);
    replaceExperienceLifecycle(null, null);

    setPhase(PHASES.GAME);
    phaseRef.current = PHASES.GAME;
    setIsCalibrating(false);
    isCalibratingRef.current = false;
    resetArcCalibrationSession("start_game");
    calibrationSampleRef.current = null;
    setCalibrationSampleFrames(0);
    const daily =
      activeLaunchContextRef.current?.challenge === "daily";
    const seed = daily
      ? createDailyWhackAMoleSeed(
          activeLaunchContextRef.current?.dayKey ?? new Date(),
          "standard",
        )
      : `whack-a-mole:practice:${Date.now()}`;
    const nextState = createWhackAMoleGame({ seed });
    whackAMoleStateRef.current = nextState;
    setWhackAMoleState(nextState);
    appLog.info("Game session started", {
      daily,
      seed,
      durationMs: nextState.config.roundDurationMs,
    });
  }

  function restartWhackAMoleSession() {
    beginRestartedProgressionSession(
      getModeById("whack-a-mole"),
      activeLaunchContextRef.current,
    );
    const currentState = whackAMoleStateRef.current;
    const idleState = createWhackAMoleGame({
      seed: currentState?.seed,
      config: currentState?.config,
    });
    const nextState = reduceWhackAMoleGame(idleState, {
      type: WHACK_A_MOLE_ACTIONS.START,
      now: performance.now(),
      seed: idleState.seed,
      config: idleState.config,
    });
    whackAMoleStateRef.current = nextState;
    setWhackAMoleState(nextState);
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

  function restartFullscreenMissileCommandGame() {
    const viewportMetrics = fullscreenMissileCommandViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(
      getModeByFullscreenId("missile-command"),
      activeLaunchContextRef.current,
    );
    const nextGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createMissileCommandDailyGame(
            viewportMetrics.width,
            viewportMetrics.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
            },
          )
        : createMissileCommandGame(
            viewportMetrics.width,
            viewportMetrics.height,
          );
    fullscreenMissileCommandLastTickRef.current = 0;
    fullscreenMissileCommandStateRef.current = nextGame;
    setFullscreenMissileCommandState(nextGame);
  }

  function restartFullscreenBrickDodgerGame() {
    const viewportMetrics = fullscreenBrickDodgerViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(getModeByFullscreenId("brick-dodger"));
    const nextGame = createBrickDodgerGame(viewportMetrics.width, viewportMetrics.height);
    fullscreenBrickDodgerLastTickRef.current = 0;
    fullscreenBrickDodgerStateRef.current = nextGame;
    setFullscreenBrickDodgerState(nextGame);
  }

  function restartFullscreenHandBounceGame() {
    const viewportMetrics = fullscreenHandBounceViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(
      getModeByFullscreenId("hand-bounce"),
      activeLaunchContextRef.current,
    );
    const currentGame = fullscreenHandBounceStateRef.current;
    const nextGame = currentGame?.layout
      ? restartFullscreenHandBounceCampaign(currentGame)
      : activeLaunchContextRef.current.challenge === "daily"
        ? createFullscreenHandBounceDailyGame(
            viewportMetrics.width,
            viewportMetrics.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
              date: activeLaunchContextRef.current.dayKey,
            },
          )
        : createFullscreenHandBounceGame(
            viewportMetrics.width,
            viewportMetrics.height,
          );
    fullscreenHandBounceLastTickRef.current = 0;
    fullscreenHandBounceStateRef.current = nextGame;
    setFullscreenHandBounceState(nextGame);
  }

  function restartFullscreenFingerPongGame() {
    const viewportMetrics = fullscreenFingerPongViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(getModeByFullscreenId("finger-pong"));
    const nextGame = createFingerPongGame(viewportMetrics.width, viewportMetrics.height);
    fullscreenFingerPongLastTickRef.current = 0;
    fullscreenFingerPongStateRef.current = nextGame;
    setFullscreenFingerPongState(nextGame);
  }

  function restartFullscreenBreakoutGame() {
    const current = fullscreenBreakoutStateRef.current;
    if (!current) {
      return;
    }
    beginRestartedProgressionSession(
      getModeByFullscreenId(fullscreenGridModeRef.current),
    );
    const nextGame = restartBreakoutGame(current);
    fullscreenBreakoutLastTickRef.current = 0;
    fullscreenBreakoutStateRef.current = nextGame;
    setFullscreenBreakoutState(nextGame);
  }

  function restartFullscreenBreakoutCoopGame() {
    const viewportMetrics = fullscreenBreakoutCoopViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(getModeByFullscreenId("breakout-coop"));
    const nextGame = createBreakoutCoopGame(
      viewportMetrics.width,
      viewportMetrics.height,
    );
    fullscreenBreakoutCoopLastTickRef.current = 0;
    fullscreenBreakoutCoopPrimaryPinchLatchRef.current = false;
    fullscreenBreakoutCoopSecondaryPinchLatchRef.current = false;
    fullscreenBreakoutCoopStateRef.current = nextGame;
    setFullscreenBreakoutCoopState(nextGame);
  }

  function restartFullscreenInvadersGame() {
    const viewportMetrics = fullscreenBreakoutViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(getModeByFullscreenId("invaders"));
    const nextGame = createSpaceInvadersGame(
      viewportMetrics.width,
      viewportMetrics.height,
    );
    fullscreenInvadersLastTickRef.current = 0;
    fullscreenInvadersStateRef.current = nextGame;
    setFullscreenInvadersState(nextGame);
  }

  function restartFullscreenFlappyGame() {
    const viewportMetrics = fullscreenFlappyViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(
      getModeByFullscreenId("flappy"),
      activeLaunchContextRef.current,
    );
    const nextGame =
      activeLaunchContextRef.current.challenge === "daily"
        ? createFlappyDailyChallengeGame(
            viewportMetrics.width,
            viewportMetrics.height,
            {
              dayKey: activeLaunchContextRef.current.dayKey,
            },
          )
        : createFlappyGame(
            viewportMetrics.width,
            viewportMetrics.height,
          );
    fullscreenFlappyLastTickRef.current = 0;
    fullscreenFlappyStateRef.current = nextGame;
    setFullscreenFlappyState(nextGame);
  }

  function restartFullscreenSkyPatrolGame() {
    const viewportMetrics = fullscreenSkyPatrolViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(
      getModeByFullscreenId("sky-patrol"),
      activeLaunchContextRef.current,
    );
    const nextGame = fullscreenSkyPatrolStateRef.current?.layout
      ? restartSkyPatrolGame(fullscreenSkyPatrolStateRef.current)
      : activeLaunchContextRef.current.challenge === "daily"
        ? createSkyPatrolDailyGame(
            viewportMetrics.width,
            viewportMetrics.height,
            { dayKey: activeLaunchContextRef.current.dayKey },
          )
        : createSkyPatrolGame(viewportMetrics.width, viewportMetrics.height);
    fullscreenSkyPatrolLastTickRef.current = 0;
    publishFullscreenSkyPatrolState(nextGame);
  }

  function restartCurrentExperience() {
    switch (experienceModeIdRef.current) {
      case "whack-a-mole":
        restartWhackAMoleSession();
        break;
      case "spatial-memory":
        startSpatialGestureMemoryRound();
        break;
      case "sky-patrol":
        restartFullscreenSkyPatrolGame();
        break;
      case "slice-air":
        restartFullscreenFruitNinjaGame();
        break;
      case "missile-command":
        restartFullscreenMissileCommandGame();
        break;
      case "brick-dodger":
        restartFullscreenBrickDodgerGame();
        break;
      case "hand-bounce":
        restartFullscreenHandBounceGame();
        break;
      case "breakout":
        restartFullscreenBreakoutGame();
        break;
      case "breakout-coop":
        restartFullscreenBreakoutCoopGame();
        break;
      case "finger-pong":
        restartFullscreenFingerPongGame();
        break;
      case "tic-tac-toe":
        restartFullscreenTicTacToeGame();
        break;
      case "invaders":
        restartFullscreenInvadersGame();
        break;
      case "flappy":
        restartFullscreenFlappyGame();
        break;
      default:
        navigateToProductHome();
    }
  }

  function getCurrentExperienceHud() {
    const item = (id, label, value, emphasis = "normal") => ({
      id,
      label,
      value,
      emphasis,
    });
    switch (experienceModeId) {
      case "whack-a-mole":
        {
          const summary = getWhackAMoleSummary(whackAMoleState);
        return {
          status:
            whackAMoleState.phase === WHACK_A_MOLE_PHASES.IDLE
              ? "Ready when you are"
              : whackAMoleState.announcement,
          items: [
            item("score", "Score", summary.score, "strong"),
            item("time", "Time", `${summary.timeLeft}s`),
            item(
              "streak",
              "Best streak",
              `×${summary.bestStreak}`,
            ),
          ],
        };
        }
      case "spatial-memory":
        return {
          status: spatialMemoryState.message,
          items: [
            item("round", "Round", spatialMemoryState.round, "strong"),
            item(
              "step",
              "Step",
              `${Math.min(
                spatialMemoryState.currentStepIndex + 1,
                spatialMemoryState.sequenceLength,
              )}/${spatialMemoryState.sequenceLength}`,
            ),
          ],
        };
      case "sky-patrol":
        return {
          status: fullscreenSkyPatrolHud?.message,
          items: [
            item("score", "Score", fullscreenSkyPatrolHud?.score ?? 0, "strong"),
            item(
              "mission",
              "Mission",
              `${fullscreenSkyPatrolHud?.mission ?? 1}/${
                fullscreenSkyPatrolHud?.totalMissions ?? 1
              }`,
            ),
            item("accuracy", "Accuracy", `${fullscreenSkyPatrolHud?.accuracy ?? 0}%`),
            item("combo", "Combo", fullscreenSkyPatrolHud?.comboCount ?? 0),
          ],
        };
      case "slice-air":
        return {
          status: fullscreenFruitNinjaHudUi.status,
          items: [
            ...fullscreenFruitNinjaHudUi.items.map((hudItem) =>
              item(
                hudItem.id,
                hudItem.label,
                hudItem.value,
                hudItem.id === "score" ? "strong" : "normal",
              ),
            ),
          ],
        };
      case "missile-command":
        return {
          status: fullscreenMissileCommandState?.message,
          items: [
            item("score", "Score", fullscreenMissileCommandState?.score ?? 0, "strong"),
            item(
              "cities",
              "Cities",
              fullscreenMissileCommandState?.structures?.filter(
                ({ kind, alive }) => kind === "city" && alive,
              ).length ?? 0,
            ),
          ],
        };
      case "brick-dodger":
        return {
          status: fullscreenBrickDodgerState?.message,
          items: [
            item("score", "Score", fullscreenBrickDodgerState?.score ?? 0, "strong"),
            item("lives", "Lives", fullscreenBrickDodgerState?.lives ?? 0),
          ],
        };
      case "breakout":
        return {
          status: fullscreenBreakoutState?.message,
          items: [
            item("score", "Score", fullscreenBreakoutState?.score ?? 0, "strong"),
            item("level", "Level", fullscreenBreakoutState?.level ?? 1),
            item("lives", "Lives", fullscreenBreakoutState?.lives ?? 0),
          ],
        };
      case "breakout-coop":
        return {
          status: fullscreenBreakoutCoopState?.message,
          items: [
            item("score", "Score", fullscreenBreakoutCoopState?.score ?? 0, "strong"),
            item("lives", "Lives", fullscreenBreakoutCoopState?.lives ?? 0),
          ],
        };
      case "finger-pong":
        return {
          status: fullscreenFingerPongState?.message,
          items: [
            item("player", "You", fullscreenFingerPongState?.score ?? 0, "strong"),
            item("opponent", "Opponent", fullscreenFingerPongState?.opponentScore ?? 0),
          ],
        };
      case "hand-bounce":
        return {
          status: fullscreenHandBounceState?.message,
          items: fullscreenHandBounceHudUi.items.map((hudItem, index) =>
            item(
              hudItem.id,
              hudItem.label,
              hudItem.value,
              index === 0 ? "strong" : "default",
            ),
          ),
        };
      case "invaders":
        return {
          status: fullscreenInvadersState?.message,
          items: [
            item("score", "Score", fullscreenInvadersState?.score ?? 0, "strong"),
            item("wave", "Wave", fullscreenInvadersState?.wave ?? 1),
            item("lives", "Lives", fullscreenInvadersState?.lives ?? 0),
            item(
              "remaining",
              "Remaining",
              fullscreenInvadersState?.enemies?.filter(({ alive }) => alive).length ?? 0,
            ),
          ],
        };
      case "flappy":
        return {
          status: fullscreenFlappyState?.message,
          items: [
            item("score", "Gates", fullscreenFlappyState?.score ?? 0, "strong"),
            item(
              "center",
              "Center streak",
              fullscreenFlappyState?.stats?.centerStreak ?? 0,
            ),
            item(
              "level",
              "Level",
              fullscreenFlappyState?.difficulty?.level ?? 1,
            ),
          ],
        };
      case "tic-tac-toe":
        return {
          status: fullscreenTicTacToeState?.message,
          items: [
            item("wins", "Wins", fullscreenTicTacToeState?.playerWins ?? 0, "strong"),
            item("draws", "Draws", fullscreenTicTacToeState?.draws ?? 0),
          ],
        };
      default:
        return { status: "", items: [] };
    }
  }

  function getFullscreenRestartControlStatesFromRefs() {
    return {
      handBounce: fullscreenHandBounceStateRef.current,
      brickDodger: fullscreenBrickDodgerStateRef.current,
      breakout: fullscreenBreakoutStateRef.current,
      fingerPong: fullscreenFingerPongStateRef.current,
      fruitNinja: fullscreenFruitNinjaStateRef.current,
      skyPatrol: fullscreenSkyPatrolHudRef.current,
      missileCommand: fullscreenMissileCommandStateRef.current,
    };
  }

  function runFullscreenRestartControlActionFromRefs() {
    const mode = fullscreenGridModeRef.current;
    const label = getFullscreenRestartControlLabel(
      mode,
      getFullscreenRestartControlStatesFromRefs(),
    );
    if (!label) {
      return false;
    }

    switch (mode) {
      case "hand-bounce":
        restartFullscreenHandBounceGame();
        return true;
      case "brick-dodger":
        restartFullscreenBrickDodgerGame();
        return true;
      case "breakout":
      case FIND_YOUR_GRIND_BREAKOUT_MODE_ID:
        restartFullscreenBreakoutGame();
        return true;
      case "finger-pong":
        restartFullscreenFingerPongGame();
        return true;
      case "fruit-ninja":
        restartFullscreenFruitNinjaGame();
        return true;
      case "sky-patrol":
        restartFullscreenSkyPatrolGame();
        return true;
      case "missile-command":
        restartFullscreenMissileCommandGame();
        return true;
      default:
        return false;
    }
  }

  function syncFullscreenSkyPatrolRenderer() {
    const canvas = fullscreenSkyPatrolCanvasRef.current;
    const viewportMetrics = fullscreenSkyPatrolViewportRef.current;
    if (!canvas || !viewportMetrics) {
      return null;
    }

    let renderer = fullscreenSkyPatrolRendererRef.current;
    if (!renderer || renderer.canvas !== canvas) {
      renderer = createSkyPatrolCanvasRenderer(canvas, {
        spriteImage: fullscreenSkyPatrolSpriteImageRef.current,
      });
      fullscreenSkyPatrolRendererRef.current = renderer;
    }

    renderer.setSpriteImage(fullscreenSkyPatrolSpriteImageRef.current);
    renderer.resize(viewportMetrics.width, viewportMetrics.height);
    return renderer;
  }

  function publishFullscreenSkyPatrolState(nextState) {
    fullscreenSkyPatrolStateRef.current = nextState;

    const nextHud = getSkyPatrolHudState(nextState);
    if (!areSkyPatrolHudStatesEqual(fullscreenSkyPatrolHudRef.current, nextHud)) {
      fullscreenSkyPatrolHudRef.current = nextHud;
      setFullscreenSkyPatrolHud(nextHud);
    }

    const renderer = syncFullscreenSkyPatrolRenderer();
    renderer?.draw(nextState);
  }

  function restartFullscreenTicTacToeGame() {
    const existingGame = fullscreenTicTacToeStateRef.current;
    if (existingGame?.layout) {
      beginRestartedProgressionSession(getModeByFullscreenId("tic-tac-toe"));
      const nextGame = restartTicTacToeRound(existingGame);
      fullscreenTicTacToeLastTickRef.current = 0;
      fullscreenTicTacToeStateRef.current = nextGame;
      setFullscreenTicTacToeState(nextGame);
      return;
    }

    const viewportMetrics = fullscreenTicTacToeViewportRef.current;
    if (!viewportMetrics) {
      return;
    }
    beginRestartedProgressionSession(getModeByFullscreenId("tic-tac-toe"));
    const nextGame = createTicTacToeGame(viewportMetrics.width, viewportMetrics.height);
    fullscreenTicTacToeLastTickRef.current = 0;
    fullscreenTicTacToeStateRef.current = nextGame;
    setFullscreenTicTacToeState(nextGame);
  }

  function handlePinchClick(timestamp) {
    appLog.debug("Pinch click detected", {
      timestamp,
      isCalibrating: isCalibratingRef.current,
      isArcCalibrating: isArcCalibratingRef.current,
      phase: phaseRef.current,
      whackPhase: whackAMoleStateRef.current?.phase,
    });
    const excludeInsideSelector = getPinchClickExcludeSelector({
      phase: phaseRef.current,
    });
    const clickedButton = clickButtonAtPoint(cursorRef.current, {
      excludeInsideSelector,
    });
    if (clickedButton) {
      appLog.info("Pinch click triggered button", {
        timestamp,
        phase: phaseRef.current,
        cursor: cursorRef.current,
      });
      return;
    }

    if (isArcCalibratingRef.current) {
      appLog.debug("Pinch click ignored because lazy-arc calibration is active");
      return;
    }

    if (
      phaseRef.current === PHASES.FULLSCREEN_CAMERA &&
      fullscreenGridModeRef.current === "missile-command"
    ) {
      const viewportMetrics = fullscreenMissileCommandViewportRef.current;
      const activeState = fullscreenMissileCommandStateRef.current;
      if (!viewportMetrics || !activeState) {
        return;
      }

      if (activeState.status === "game_over") {
        restartFullscreenMissileCommandGame();
        return;
      }

      const targetX = Math.min(
        viewportMetrics.width,
        Math.max(0, cursorRef.current.x - viewportMetrics.left),
      );
      const targetY = Math.min(
        viewportMetrics.height,
        Math.max(0, cursorRef.current.y - viewportMetrics.top),
      );
      const nextState = launchMissileCommandInterceptor(activeState, targetX, targetY);
      if (nextState !== activeState) {
        fullscreenMissileCommandStateRef.current = nextState;
        setFullscreenMissileCommandState(nextState);
      }
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
      appLog.debug("Pinch click ignored in runner mode because jumping is disabled", {
        timestamp,
      });
      return;
    }

    if (phaseRef.current === PHASES.FULLSCREEN_CAMERA && fullscreenGridModeRef.current === "flappy") {
      if (!fullscreenFlappyStateRef.current) {
        return;
      }
      const nextState = flapFlappyGame(fullscreenFlappyStateRef.current);
      fullscreenFlappyStateRef.current = nextState;
      fullscreenFlappyLastTickRef.current = timestamp;
      setFullscreenFlappyState(nextState);
      return;
    }

    appLog.debug("Pinch click did not resolve to an active control", {
      phase: phaseRef.current,
      timestamp,
    });
  }

  function computeCameraRenderMetrics(
    objectFit = getCameraObjectFitForPhase(phaseRef.current),
  ) {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight || !canvas.width || !canvas.height) {
      return null;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const scale =
      objectFit === "contain"
        ? Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight)
        : Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
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
    const directNormalized = {
      uMin: sourceNormalized.xMin,
      uMax: sourceNormalized.xMax,
      vMin: sourceNormalized.yMin,
      vMax: sourceNormalized.yMax,
    };
    const displayNormalized = preferencesRef.current.mirrorCamera
      ? mirroredNormalized
      : directNormalized;

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
        objectFit,
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
      displayNormalized,
    };
  }

  function projectCameraPointToCanvas(point, renderMetrics) {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !Number.isFinite(point?.u) || !Number.isFinite(point?.v)) {
      return null;
    }

    if (!renderMetrics) {
      return {
        x: point.u * canvas.width,
        y: point.v * canvas.height,
      };
    }

    return {
      x: renderMetrics.render.offsetX + point.u * renderMetrics.render.renderedWidth,
      y: renderMetrics.render.offsetY + point.v * renderMetrics.render.renderedHeight,
    };
  }

  function logTrackingExtentsSnapshot(reason) {
    const extentState = trackingExtentsRef.current;
    const renderMetrics = computeCameraRenderMetrics();
    const canvasWidth = renderMetrics?.canvas.width ?? 0;
    const canvasHeight = renderMetrics?.canvas.height ?? 0;

    const fingerExtents = EXTENT_FINGER_NAMES.reduce((accumulator, fingerName) => {
      accumulator[fingerName] = summarizeFingerExtentStats(
        extentState.fingers[fingerName],
        canvasWidth,
        canvasHeight,
      );
      return accumulator;
    }, {});

    const visibleDisplayBounds = renderMetrics
      ? {
          uMin: roundMetric(renderMetrics.displayNormalized.uMin),
          uMax: roundMetric(renderMetrics.displayNormalized.uMax),
          vMin: roundMetric(renderMetrics.displayNormalized.vMin),
          vMax: roundMetric(renderMetrics.displayNormalized.vMax),
          uSpan: roundMetric(
            renderMetrics.displayNormalized.uMax - renderMetrics.displayNormalized.uMin,
          ),
          vSpan: roundMetric(
            renderMetrics.displayNormalized.vMax - renderMetrics.displayNormalized.vMin,
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
      visibleDisplayBounds,
      lastVisibleBounds:
        extentState.lastVisibleBounds && Number.isFinite(extentState.lastVisibleBounds.uMin)
          ? {
              uMin: roundMetric(extentState.lastVisibleBounds.uMin),
              uMax: roundMetric(extentState.lastVisibleBounds.uMax),
              vMin: roundMetric(extentState.lastVisibleBounds.vMin),
              vMax: roundMetric(extentState.lastVisibleBounds.vMax),
            }
          : null,
      cameraCoverMetrics: renderMetrics
        ? {
            canvas: renderMetrics.canvas,
            video: renderMetrics.video,
            render: {
              objectFit: renderMetrics.render.objectFit,
              scale: roundMetric(renderMetrics.render.scale, 5),
              renderedWidth: roundMetric(renderMetrics.render.renderedWidth, 2),
              renderedHeight: roundMetric(renderMetrics.render.renderedHeight, 2),
              offsetX: roundMetric(renderMetrics.render.offsetX, 2),
              offsetY: roundMetric(renderMetrics.render.offsetY, 2),
            },
            visibleSourcePixels: {
              x: roundMetric(renderMetrics.visibleSourcePixels.x, 2),
              y: roundMetric(renderMetrics.visibleSourcePixels.y, 2),
              width: roundMetric(renderMetrics.visibleSourcePixels.width, 2),
              height: roundMetric(renderMetrics.visibleSourcePixels.height, 2),
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
    const renderMetrics = computeCameraRenderMetrics();

    if (hand?.fingerTips) {
      const fingertipEntries =
        phaseRef.current === PHASES.FULLSCREEN_CAMERA
          ? [["index", FINGERTIP_OVERLAY_STYLES.index]]
          : Object.entries(FINGERTIP_OVERLAY_STYLES);
      for (const [fingerName, style] of fingertipEntries) {
        const tip = hand.fingerTips[fingerName];
        const projectedTip = projectCameraPointToCanvas(tip, renderMetrics);
        if (!projectedTip) {
          continue;
        }
        const { x, y } = projectedTip;

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
    } else if (phaseRef.current === PHASES.FULLSCREEN_CAMERA ? hand?.indexTip : hand?.thumbTip) {
      const fallbackTip =
        phaseRef.current === PHASES.FULLSCREEN_CAMERA ? hand.indexTip : hand.thumbTip;
      const projectedFallbackTip = projectCameraPointToCanvas(fallbackTip, renderMetrics);
      if (!projectedFallbackTip) {
        return;
      }
      const fallbackStyle =
        phaseRef.current === PHASES.FULLSCREEN_CAMERA
          ? FINGERTIP_OVERLAY_STYLES.index
          : { fill: "rgba(255, 255, 255, 0.98)", radius: 6.2 };
      ctx.fillStyle = fallbackStyle.fill;
      ctx.beginPath();
      ctx.arc(projectedFallbackTip.x, projectedFallbackTip.y, fallbackStyle.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (debugRef.current && hand?.landmarks) {
      ctx.fillStyle = "rgba(111, 245, 164, 0.9)";
      for (const point of hand.landmarks) {
        const projectedPoint = projectCameraPointToCanvas(point, renderMetrics);
        if (!projectedPoint) {
          continue;
        }
        ctx.beginPath();
        ctx.arc(projectedPoint.x, projectedPoint.y, 2.8, 0, Math.PI * 2);
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

  function drawCameraOverlayHands(hands, options = {}) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!options.showSkeleton) {
      return;
    }
    const renderMetrics = computeCameraRenderMetrics(options.objectFit);

    const safeHands = Array.isArray(hands) ? hands : [];
    for (let handIndex = 0; handIndex < safeHands.length; handIndex += 1) {
      const hand = safeHands[handIndex];
      if (!hand) {
        continue;
      }
      const style = getHandOverlayStyle(hand, handIndex);
      const fingerTips = hand.fingerTips ?? {};
      const pointerTip = fingerTips.index ?? hand.indexTip ?? null;

      if (Array.isArray(hand.landmarks) && hand.landmarks.length > 0) {
        ctx.strokeStyle = style.line;
        ctx.lineWidth = options.boneLineWidth ?? 1.45;
        for (const [startIndex, endIndex] of HAND_ROOT_CONNECTIONS) {
          const projectedStart = projectCameraPointToCanvas(
            hand.landmarks[startIndex],
            renderMetrics,
          );
          const projectedEnd = projectCameraPointToCanvas(
            hand.landmarks[endIndex],
            renderMetrics,
          );
          if (!projectedStart || !projectedEnd) {
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(projectedStart.x, projectedStart.y);
          ctx.lineTo(projectedEnd.x, projectedEnd.y);
          ctx.stroke();
        }
        for (const chain of HAND_FINGER_CHAINS) {
          for (let index = 1; index < chain.length; index += 1) {
            const projectedStart = projectCameraPointToCanvas(
              hand.landmarks[chain[index - 1]],
              renderMetrics,
            );
            const projectedEnd = projectCameraPointToCanvas(
              hand.landmarks[chain[index]],
              renderMetrics,
            );
            if (!projectedStart || !projectedEnd) {
              continue;
            }
            ctx.beginPath();
            ctx.moveTo(projectedStart.x, projectedStart.y);
            ctx.lineTo(projectedEnd.x, projectedEnd.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = style.point;
        for (const point of hand.landmarks) {
          const projectedPoint = projectCameraPointToCanvas(point, renderMetrics);
          if (!projectedPoint) {
            continue;
          }
          ctx.beginPath();
          ctx.arc(projectedPoint.x, projectedPoint.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const highlightedFingerNames = options.highlightIndexOnly ? ["index"] : EXTENT_FINGER_NAMES;
      for (const fingerName of highlightedFingerNames) {
        const tip = fingerTips[fingerName];
        const projectedTip = projectCameraPointToCanvas(tip, renderMetrics);
        if (!projectedTip) {
          continue;
        }
        const { x, y } = projectedTip;
        ctx.fillStyle =
          options.highlightIndexOnly && fingerName === "index"
            ? (options.indexHighlightFill ?? "#22d3ee")
            : style.point;
        ctx.beginPath();
        ctx.arc(x, y, fingerName === "thumb" ? 6 : 5, 0, Math.PI * 2);
        ctx.fill();
      }

      const projectedPointerTip = projectCameraPointToCanvas(pointerTip, renderMetrics);
      if (projectedPointerTip && options.showPointerRing !== false) {
        const pointerX = projectedPointerTip.x;
        const pointerY = projectedPointerTip.y;
        ctx.strokeStyle = style.ring;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = style.line;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (options.showHandLabels !== false) {
        ctx.fillStyle = "#f5f9ff";
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(
          `${hand.label ?? `Hand ${handIndex + 1}`}`,
          18,
          24 + handIndex * 16,
        );
      }
    }

    if (debugRef.current) {
      ctx.fillStyle = "rgba(12, 16, 20, 0.68)";
      ctx.fillRect(10, canvas.height - 60, 210, 50);
      ctx.fillStyle = "#f2f6fb";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`hands: ${safeHands.length}`, 18, canvas.height - 38);
      ctx.fillText(`fps: ${fpsRef.current.toFixed(1)}`, 18, canvas.height - 22);
    }
  }

  function drawNeonActiveHandOutline(hands) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const activeHand = selectPreferredHand(
      hands,
      preferencesRef.current.dominantHand,
    );
    const landmarks = Array.isArray(activeHand?.landmarks) ? activeHand.landmarks : [];
    if (landmarks.length === 0) {
      return;
    }
    const renderMetrics = computeCameraRenderMetrics();

    const drawConnection = (startIndex, endIndex) => {
      const projectedStart = projectCameraPointToCanvas(landmarks[startIndex], renderMetrics);
      const projectedEnd = projectCameraPointToCanvas(landmarks[endIndex], renderMetrics);
      if (!projectedStart || !projectedEnd) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(projectedStart.x, projectedStart.y);
      ctx.lineTo(projectedEnd.x, projectedEnd.y);
      ctx.stroke();
    };

    const drawHandConnections = () => {
      for (const [startIndex, endIndex] of SKY_PATROL_ACTIVE_HAND_CONNECTIONS) {
        drawConnection(startIndex, endIndex);
      }
    };

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(80, 255, 230, 0.24)";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "rgba(64, 255, 225, 0.18)";
    ctx.lineWidth = 8;
    drawHandConnections();

    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(222, 255, 250, 0.24)";
    ctx.lineWidth = 2.4;
    drawHandConnections();

    const tipStyle = getSkyPatrolActiveHandTipStyle(pinchStateRef.current);
    for (const tipIndex of SKY_PATROL_ACTIVE_HAND_TIP_INDEXES) {
      const projectedTip = projectCameraPointToCanvas(landmarks[tipIndex], renderMetrics);
      if (!projectedTip) {
        continue;
      }
      ctx.fillStyle = tipStyle.fill;
      ctx.beginPath();
      ctx.arc(projectedTip.x, projectedTip.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tipStyle.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(projectedTip.x, projectedTip.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPoseOverlay(pose, hands = []) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const renderMetrics = computeCameraRenderMetrics();
    if (pose && Array.isArray(pose.keypoints) && pose.keypoints.length > 0) {
      const keypointMap = {};
      for (const keypoint of pose.keypoints) {
        if (!keypoint?.name || !Number.isFinite(keypoint.u) || !Number.isFinite(keypoint.v)) {
          continue;
        }
        keypointMap[keypoint.name] = keypoint;
      }

      ctx.lineWidth = 2.8;
      ctx.strokeStyle = "rgba(128, 202, 255, 0.72)";
      for (const [startName, endName] of POSE_CONNECTIONS) {
        const start = keypointMap[startName];
        const end = keypointMap[endName];
        const projectedStart = projectCameraPointToCanvas(start, renderMetrics);
        const projectedEnd = projectCameraPointToCanvas(end, renderMetrics);
        if (
          !start ||
          !end ||
          !projectedStart ||
          !projectedEnd ||
          (start.score ?? 0) < POSE_KEYPOINT_THRESHOLD ||
          (end.score ?? 0) < POSE_KEYPOINT_THRESHOLD
        ) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(projectedStart.x, projectedStart.y);
        ctx.lineTo(projectedEnd.x, projectedEnd.y);
        ctx.stroke();
      }

      const colorByGroup = {
        head: "rgba(255, 195, 92, 0.96)",
        eyes: "rgba(255, 120, 120, 0.96)",
        shoulders: "rgba(123, 237, 181, 0.96)",
        arms: "rgba(105, 188, 255, 0.96)",
        torso: "rgba(198, 153, 255, 0.96)",
        other: "rgba(223, 232, 248, 0.86)",
      };

      const resolveGroup = (name) => {
        if (POSE_KEYPOINT_GROUPS.head.includes(name)) {
          return "head";
        }
        if (POSE_KEYPOINT_GROUPS.eyes.includes(name)) {
          return "eyes";
        }
        if (POSE_KEYPOINT_GROUPS.shoulders.includes(name)) {
          return "shoulders";
        }
        if (POSE_KEYPOINT_GROUPS.arms.includes(name)) {
          return "arms";
        }
        if (POSE_KEYPOINT_GROUPS.torso.includes(name)) {
          return "torso";
        }
        return "other";
      };

      for (const keypoint of pose.keypoints) {
        const projectedKeypoint = projectCameraPointToCanvas(keypoint, renderMetrics);
        if (!keypoint?.name || !projectedKeypoint || (keypoint.score ?? 0) < POSE_KEYPOINT_THRESHOLD) {
          continue;
        }
        const group = resolveGroup(keypoint.name);
        const { x, y } = projectedKeypoint;
        ctx.fillStyle = colorByGroup[group];
        ctx.beginPath();
        ctx.arc(x, y, group === "eyes" ? 4.6 : 5.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(245, 250, 255, 0.9)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(keypoint.name.replace("left_", "L-").replace("right_", "R-"), x + 6, y - 6);
      }
    }

    const safeHands = Array.isArray(hands) ? hands : [];
    for (let handIndex = 0; handIndex < safeHands.length; handIndex += 1) {
      const hand = safeHands[handIndex];
      const landmarks = Array.isArray(hand?.landmarks) ? hand.landmarks : [];
      if (landmarks.length === 0) {
        continue;
      }
      const style = getHandOverlayStyle(hand, handIndex);
      const strokeColor = style.poseStroke;
      const fillColor = style.poseFill;

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      for (const [startIndex, endIndex] of HAND_ROOT_CONNECTIONS) {
        const start = landmarks[startIndex];
        const end = landmarks[endIndex];
        const projectedStart = projectCameraPointToCanvas(start, renderMetrics);
        const projectedEnd = projectCameraPointToCanvas(end, renderMetrics);
        if (!projectedStart || !projectedEnd) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(projectedStart.x, projectedStart.y);
        ctx.lineTo(projectedEnd.x, projectedEnd.y);
        ctx.stroke();
      }
      for (const chain of HAND_FINGER_CHAINS) {
        for (let index = 1; index < chain.length; index += 1) {
          const start = landmarks[chain[index - 1]];
          const end = landmarks[chain[index]];
          const projectedStart = projectCameraPointToCanvas(start, renderMetrics);
          const projectedEnd = projectCameraPointToCanvas(end, renderMetrics);
          if (!projectedStart || !projectedEnd) {
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(projectedStart.x, projectedStart.y);
          ctx.lineTo(projectedEnd.x, projectedEnd.y);
          ctx.stroke();
        }
      }

      for (const tipIndex of HAND_FINGERTIP_INDEXES) {
        const tip = landmarks[tipIndex];
        const projectedTip = projectCameraPointToCanvas(tip, renderMetrics);
        if (!projectedTip) {
          continue;
        }
        const tipX = projectedTip.x;
        const tipY = projectedTip.y;
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 5.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(8, 12, 18, 0.82)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 6.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(240, 247, 255, 0.92)";
        ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(FINGERTIP_NAME_BY_INDEX[tipIndex], tipX + 6, tipY - 4);
      }
    }
  }

  function getFullscreenIndexOverlayPoints(hands) {
    const renderMetrics = computeCameraRenderMetrics("contain");
    const safeHands = Array.isArray(hands) ? hands : [];
    return safeHands
      .map((hand, handIndex) => {
        const indexTip = hand?.fingerTips?.index ?? hand?.indexTip ?? null;
        const projectedPoint = projectCameraPointToCanvas(indexTip, renderMetrics);
        if (!projectedPoint) {
          return null;
        }
        return {
          id: hand?.id ?? hand?.label ?? `hand-${handIndex}`,
          label: hand?.label ?? `Hand ${handIndex + 1}`,
          x: projectedPoint.x,
          y: projectedPoint.y,
        };
      })
      .filter(Boolean);
  }

  function getFullscreenTipOverlayPoints(hands) {
    const renderMetrics = computeCameraRenderMetrics("contain");
    const safeHands = Array.isArray(hands) ? hands : [];
    const trackedFingerNames = getFullscreenTrackedFingerNames(
      fullscreenGridModeRef.current,
      EXTENT_FINGER_NAMES,
    );
    return safeHands.flatMap((hand, handIndex) => {
      const handId = hand?.id ?? hand?.label ?? `hand-${handIndex}`;
      return trackedFingerNames.map((fingerName) => {
        const tip = hand?.fingerTips?.[fingerName] ?? hand?.[`${fingerName}Tip`] ?? null;
        const projectedPoint = projectCameraPointToCanvas(tip, renderMetrics);
        if (!projectedPoint) {
          return null;
        }
        return {
          id: `${handId}-${fingerName}`,
          handId,
          fingerName,
          x: projectedPoint.x,
          y: projectedPoint.y,
        };
      }).filter(Boolean);
    });
  }

  function getFullscreenHandBouncePaddleInput() {
    const viewportMetrics = fullscreenHandBounceViewportRef.current;
    if (!viewportMetrics) {
      return null;
    }

    const activePointer = getActiveFullscreenPointer(viewportMetrics);
    if (activePointer.active && activePointer.source !== "tracking") {
      const ballRadius =
        fullscreenHandBounceStateRef.current?.layout?.ballRadius ?? 32;
      const width = clampValue(
        ballRadius * 3.35,
        ballRadius * 2.15,
        viewportMetrics.width * 0.34,
      );
      const height = clampValue(
        ballRadius * 1.08,
        ballRadius * 0.9,
        ballRadius * 1.55,
      );
      return {
        x: clampValue(
          activePointer.x,
          width / 2 + 6,
          viewportMetrics.width - width / 2 - 6,
        ),
        y: clampValue(
          activePointer.y,
          height / 2 + ballRadius * 0.42,
          viewportMetrics.height - height / 2 - ballRadius * 0.24,
        ),
        width,
        height,
      };
    }

    const renderMetrics = computeCameraRenderMetrics("contain");
    const primaryHand = Array.isArray(fullscreenHandsRef.current)
      ? selectPreferredHand(
          fullscreenHandsRef.current,
          preferencesRef.current.dominantHand,
        )
      : null;
    if (!renderMetrics || !primaryHand) {
      return null;
    }

    const pointByIndex = new Map();
    for (const landmarkIndex of HAND_PALM_LANDMARK_INDEXES) {
      const landmark = primaryHand.landmarks?.[landmarkIndex];
      const projectedPoint = projectCameraPointToCanvas(landmark, renderMetrics);
      if (!projectedPoint) {
        continue;
      }

      pointByIndex.set(landmarkIndex, {
        x: projectedPoint.x - viewportMetrics.left,
        y: projectedPoint.y - viewportMetrics.top,
      });
    }

    const knucklePoints = [
      pointByIndex.get(HAND_INDEX_KNUCKLE_INDEX),
      pointByIndex.get(HAND_MIDDLE_KNUCKLE_INDEX),
      pointByIndex.get(HAND_PINKY_KNUCKLE_INDEX),
    ].filter(Boolean);

    if (knucklePoints.length === 0) {
      return null;
    }

    const ballRadius = fullscreenHandBounceStateRef.current?.layout?.ballRadius ?? 32;
    const centerX =
      knucklePoints.reduce((sum, point) => sum + point.x, 0) / knucklePoints.length;
    const knuckleY =
      knucklePoints.reduce((sum, point) => sum + point.y, 0) / knucklePoints.length;
    const wristPoint = pointByIndex.get(HAND_WRIST_INDEX) ?? null;
    const wristY = wristPoint?.y ?? knuckleY + ballRadius * 0.92;
    const indexKnuckle = pointByIndex.get(HAND_INDEX_KNUCKLE_INDEX) ?? null;
    const pinkyKnuckle = pointByIndex.get(HAND_PINKY_KNUCKLE_INDEX) ?? null;
    const palmSpan =
      indexKnuckle && pinkyKnuckle
        ? Math.hypot(
            pinkyKnuckle.x - indexKnuckle.x,
            pinkyKnuckle.y - indexKnuckle.y,
          )
        : ballRadius * 1.95;
    const width = clampValue(
      palmSpan * 1.68,
      ballRadius * 2.15,
      viewportMetrics.width * 0.34,
    );
    const palmDepth = Math.abs(wristY - knuckleY);
    const height = clampValue(
      palmDepth * 1.45,
      ballRadius * 0.9,
      ballRadius * 1.55,
    );
    const x = clampValue(
      centerX,
      width / 2 + 6,
      viewportMetrics.width - width / 2 - 6,
    );
    const y = clampValue(
      knuckleY + (wristY - knuckleY) * 0.38,
      height / 2 + ballRadius * 0.42,
      viewportMetrics.height - height / 2 - ballRadius * 0.24,
    );

    return {
      x,
      y,
      width,
      height,
    };
  }

  function drawFullscreenOverlay(hands) {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return {
        indexPoints: [],
        tipPoints: [],
      };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        indexPoints: [],
        tipPoints: [],
      };
    }

    const indexPoints = getFullscreenIndexOverlayPoints(hands);
    const tipPoints = getFullscreenTipOverlayPoints(hands);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (shouldShowFullscreenNeonHandOutline(fullscreenGridModeRef.current)) {
      drawNeonActiveHandOutline(hands);
      return {
        indexPoints,
        tipPoints,
      };
    }

    if (
      fullscreenGridModeRef.current === "hand-bounce" ||
      fullscreenGridModeRef.current === "brick-dodger" ||
      fullscreenGridModeRef.current === "breakout-coop" ||
      fullscreenGridModeRef.current === "breakout" ||
      fullscreenGridModeRef.current === FIND_YOUR_GRIND_BREAKOUT_MODE_ID ||
      fullscreenGridModeRef.current === "fruit-ninja" ||
      fullscreenGridModeRef.current === "sky-patrol" ||
      fullscreenGridModeRef.current === "invaders" ||
      fullscreenGridModeRef.current === "flappy" ||
      fullscreenGridModeRef.current === "missile-command"
    ) {
      return {
        indexPoints,
        tipPoints,
      };
    }

    if (shouldShowFullscreenHandSkeleton(fullscreenGridModeRef.current)) {
      drawCameraOverlayHands(hands, {
        showSkeleton: true,
        showPointerRing: true,
        showHandLabels: true,
      });
      return {
        indexPoints,
        tipPoints,
      };
    }

    if (fullscreenGridModeRef.current === "voronoi") {
      for (const point of tipPoints) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
        ctx.beginPath();
        ctx.arc(point.x, point.y, FULLSCREEN_VORONOI_DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (const point of indexPoints) {
        ctx.fillStyle = FINGERTIP_OVERLAY_STYLES.index.fill;
        ctx.beginPath();
        ctx.arc(point.x, point.y, FINGERTIP_OVERLAY_STYLES.index.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(point.x, point.y, FINGERTIP_OVERLAY_STYLES.index.radius + 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    return {
      indexPoints,
      tipPoints,
    };
  }

  function getVerifiedFullscreenHoldControlInput(viewportMetrics) {
    const renderMetrics = computeCameraRenderMetrics("contain");
    return getVerifiedFullscreenHandPointerInput(
      fullscreenHandsRef.current,
      viewportMetrics,
      (point) => projectCameraPointToCanvas(point, renderMetrics),
    );
  }

  function getActiveFullscreenPointer(viewportMetrics) {
    if (!viewportMetrics) {
      return {
        active: false,
        actionActive: false,
        actionStarted: false,
        source: "none",
        x: 0,
        y: 0,
      };
    }

    if (
      handDetectedRef.current &&
      Number.isFinite(cursorRef.current?.x) &&
      Number.isFinite(cursorRef.current?.y)
    ) {
      return {
        active: true,
        actionActive: Boolean(pinchStateRef.current),
        actionStarted: false,
        source: "tracking",
        x: clampValue(
          cursorRef.current.x - viewportMetrics.left,
          0,
          viewportMetrics.width,
        ),
        y: clampValue(
          cursorRef.current.y - viewportMetrics.top,
          0,
          viewportMetrics.height,
        ),
      };
    }

    const fallback = fallbackPointerRef.current;
    const localX = fallback.x - viewportMetrics.left;
    const localY = fallback.y - viewportMetrics.top;
    const withinViewport =
      !trackingRequestedRef.current &&
      fallback.active &&
      localX >= 0 &&
      localX <= viewportMetrics.width &&
      localY >= 0 &&
      localY <= viewportMetrics.height;
    return {
      active: withinViewport,
      actionActive: withinViewport && fallback.pressed,
      actionStarted: withinViewport && fallback.justPressed,
      source: withinViewport ? fallback.pointerType || "pointer" : "none",
      x: withinViewport ? localX : 0,
      y: withinViewport ? localY : 0,
    };
  }

  function updateFullscreenExitControlSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      !fullscreenExitControlStateRef.current
    ) {
      fullscreenExitControlLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenExitControlViewportRef.current;
    if (!viewportMetrics) {
      fullscreenExitControlLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenExitControlLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenExitControlLastTickRef.current = timestamp;
    const holdInput = getVerifiedFullscreenHoldControlInput(viewportMetrics);
    const pointerActive = handDetectedRef.current && holdInput.pointerActive;

    const previousState = fullscreenExitControlStateRef.current;
    const nextState = stepFullscreenExitControl(previousState, deltaSeconds, {
      handVerified: holdInput.handVerified,
      pointerActive,
      pointerX: pointerActive ? holdInput.pointerX : 0,
      pointerY: pointerActive ? holdInput.pointerY : 0,
    });
    fullscreenExitControlStateRef.current = nextState;
    if (!areFullscreenExitControlStatesEqual(previousState, nextState)) {
      setFullscreenExitControlState(nextState);
    }

    if (nextState.shouldExit) {
      returnToFullscreenCameraMenu("exit_box_hold");
    }
  }

  function updateFullscreenRestartControlSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      !getFullscreenRestartControlLabel(
        fullscreenGridModeRef.current,
        getFullscreenRestartControlStatesFromRefs(),
      ) ||
      !fullscreenRestartControlStateRef.current
    ) {
      fullscreenRestartControlLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenRestartControlViewportRef.current;
    if (!viewportMetrics) {
      fullscreenRestartControlLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenRestartControlLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenRestartControlLastTickRef.current = timestamp;
    const holdInput = getVerifiedFullscreenHoldControlInput(viewportMetrics);
    const pointerActive = handDetectedRef.current && holdInput.pointerActive;

    const nextState = stepFullscreenRestartControl(
      fullscreenRestartControlStateRef.current,
      deltaSeconds,
      {
        handVerified: holdInput.handVerified,
        pointerActive,
        pointerX: pointerActive ? holdInput.pointerX : 0,
        pointerY: pointerActive ? holdInput.pointerY : 0,
      },
    );
    fullscreenRestartControlStateRef.current = nextState;
    setFullscreenRestartControlState(nextState);

    if (nextState.shouldRestart && runFullscreenRestartControlActionFromRefs()) {
      fullscreenRestartControlLastTickRef.current = timestamp;
      fullscreenRestartControlStateRef.current = null;
      setFullscreenRestartControlState(null);
    }
  }

  function updateFullscreenHandBounceSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "hand-bounce" ||
      !fullscreenHandBounceStateRef.current
    ) {
      fullscreenHandBounceLastTickRef.current = timestamp;
      return;
    }

    if (!fullscreenHandBounceViewportRef.current) {
      fullscreenHandBounceLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenHandBounceLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenHandBounceLastTickRef.current = timestamp;

    const nextState = stepFullscreenHandBounceGame(
      fullscreenHandBounceStateRef.current,
      deltaSeconds,
      getFullscreenHandBouncePaddleInput(),
    );
    fullscreenHandBounceStateRef.current = nextState;
    setFullscreenHandBounceState(nextState);
  }

  function updateFullscreenBreakoutSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      (fullscreenGridModeRef.current !== "breakout" &&
        fullscreenGridModeRef.current !== FIND_YOUR_GRIND_BREAKOUT_MODE_ID) ||
      !fullscreenBreakoutStateRef.current
    ) {
      fullscreenBreakoutLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenBreakoutViewportRef.current;
    if (!viewportMetrics) {
      fullscreenBreakoutLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenBreakoutLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenBreakoutLastTickRef.current = timestamp;

    const fallbackPaddleX =
      fullscreenBreakoutStateRef.current?.paddle?.x ?? viewportMetrics.width / 2;
    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const pointerX = pointer.active ? pointer.x : fallbackPaddleX;
    const nextState = stepBreakoutGame(
      fullscreenBreakoutStateRef.current,
      deltaSeconds,
      pointerX,
    );
    fullscreenBreakoutStateRef.current = nextState;
    setFullscreenBreakoutState(nextState);
  }

  function getFullscreenBreakoutCoopInput(primaryPointer) {
    const hands = Array.isArray(fullscreenHandsRef.current) ? fullscreenHandsRef.current : [];
    const secondaryHand = selectBreakoutCoopSupportHand(
      hands,
      fullscreenPrimaryHandIdRef.current,
    );
    const pinchThresholds = getPinchThresholds(
      preferencesRef.current.pinchThreshold,
    );
    const secondaryPinching =
      secondaryHand && Number.isFinite(secondaryHand.pinchDistance)
        ? secondaryHand.pinchDistance < pinchThresholds.start
        : false;

    let secondaryAbilityRequested = false;
    if (secondaryPinching && !fullscreenBreakoutCoopSecondaryPinchLatchRef.current) {
      secondaryAbilityRequested = true;
      fullscreenBreakoutCoopSecondaryPinchLatchRef.current = true;
    } else if (
      !secondaryHand ||
      !Number.isFinite(secondaryHand.pinchDistance) ||
      secondaryHand.pinchDistance > pinchThresholds.end
    ) {
      fullscreenBreakoutCoopSecondaryPinchLatchRef.current = false;
    }

    const primaryPinching = Boolean(primaryPointer?.actionActive);
    let primaryPinchRising = false;
    if (primaryPinching && !fullscreenBreakoutCoopPrimaryPinchLatchRef.current) {
      primaryPinchRising = true;
      fullscreenBreakoutCoopPrimaryPinchLatchRef.current = true;
    } else if (!primaryPinching) {
      fullscreenBreakoutCoopPrimaryPinchLatchRef.current = false;
    }

    return {
      abilityRequested: secondaryAbilityRequested || (!secondaryHand && primaryPinchRising),
      restartRequested: primaryPinchRising || secondaryAbilityRequested,
    };
  }

  function updateFullscreenBreakoutCoopSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "breakout-coop" ||
      !fullscreenBreakoutCoopStateRef.current
    ) {
      fullscreenBreakoutCoopLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenBreakoutCoopViewportRef.current;
    if (!viewportMetrics) {
      fullscreenBreakoutCoopLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenBreakoutCoopLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenBreakoutCoopLastTickRef.current = timestamp;

    const fallbackPaddleX =
      fullscreenBreakoutCoopStateRef.current?.paddle?.x ?? viewportMetrics.width / 2;
    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const pointerX = pointer.active ? pointer.x : fallbackPaddleX;
    const coopInput = getFullscreenBreakoutCoopInput(pointer);
    const nextState = stepBreakoutCoopGame(
      fullscreenBreakoutCoopStateRef.current,
      deltaSeconds,
      pointerX,
      coopInput.abilityRequested,
      coopInput.restartRequested,
    );
    fullscreenBreakoutCoopStateRef.current = nextState;
    setFullscreenBreakoutCoopState(nextState);
  }

  function updateFullscreenBrickDodgerSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "brick-dodger" ||
      !fullscreenBrickDodgerStateRef.current
    ) {
      fullscreenBrickDodgerLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenBrickDodgerViewportRef.current;
    if (!viewportMetrics) {
      fullscreenBrickDodgerLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenBrickDodgerLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenBrickDodgerLastTickRef.current = timestamp;

    const fallbackPlayerX =
      fullscreenBrickDodgerStateRef.current?.player?.x ?? viewportMetrics.width / 2;
    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const pointerX = pointer.active ? pointer.x : fallbackPlayerX;
    const nextState = stepBrickDodgerGame(
      fullscreenBrickDodgerStateRef.current,
      deltaSeconds,
      pointerX,
    );
    fullscreenBrickDodgerStateRef.current = nextState;
    setFullscreenBrickDodgerState(nextState);
  }

  function updateFullscreenFingerPongSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "finger-pong" ||
      !fullscreenFingerPongStateRef.current
    ) {
      fullscreenFingerPongLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenFingerPongViewportRef.current;
    if (!viewportMetrics) {
      fullscreenFingerPongLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenFingerPongLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenFingerPongLastTickRef.current = timestamp;

    const fallbackPaddleX =
      fullscreenFingerPongStateRef.current?.player?.x ?? viewportMetrics.width / 2;
    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const pointerX = pointer.active ? pointer.x : fallbackPaddleX;
    const nextState = stepFingerPongGame(
      fullscreenFingerPongStateRef.current,
      deltaSeconds,
      pointerX,
    );
    fullscreenFingerPongStateRef.current = nextState;
    setFullscreenFingerPongState(nextState);
  }

  function updateFullscreenFruitNinjaSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "fruit-ninja" ||
      !fullscreenFruitNinjaStateRef.current
    ) {
      fullscreenFruitNinjaLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenBreakoutViewportRef.current;
    if (!viewportMetrics) {
      fullscreenFruitNinjaLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenFruitNinjaLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenFruitNinjaLastTickRef.current = timestamp;

    const activePointer = getActiveFullscreenPointer(viewportMetrics);
    const pointer = activePointer.active
      ? {
          active: true,
          x: activePointer.x,
          y: activePointer.y,
        }
      : { active: false };
    const nextState = stepFruitNinjaGame(
      fullscreenFruitNinjaStateRef.current,
      deltaSeconds,
      pointer,
      timestamp,
    );
    fullscreenFruitNinjaStateRef.current = nextState;
    setFullscreenFruitNinjaState(nextState);
  }

  function updateFullscreenSkyPatrolSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "sky-patrol" ||
      !fullscreenSkyPatrolStateRef.current
    ) {
      fullscreenSkyPatrolLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenSkyPatrolViewportRef.current;
    if (!viewportMetrics) {
      fullscreenSkyPatrolLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenSkyPatrolLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenSkyPatrolLastTickRef.current = timestamp;

    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const nextState = stepSkyPatrolGame(
      fullscreenSkyPatrolStateRef.current,
      deltaSeconds,
      {
        pointerActive: pointer.active,
        pointerX: pointer.active
          ? pointer.x
          : fullscreenSkyPatrolStateRef.current.ship.x,
        pointerY: pointer.active
          ? pointer.y
          : fullscreenSkyPatrolStateRef.current.ship.y,
        fireRequested: pointer.actionActive,
      },
    );
    publishFullscreenSkyPatrolState(nextState);
  }

  function publishFullscreenWfcWorldState(nextState) {
    if (!nextState) {
      return;
    }
    fullscreenWfcWorldStateRef.current = nextState;
    setFullscreenWfcWorldState(nextState);
  }

  function handleFullscreenWfcWorldSelectTile(tileId) {
    publishFullscreenWfcWorldState(
      selectWfcWorldTile(fullscreenWfcWorldStateRef.current, tileId),
    );
  }

  function handleFullscreenWfcWorldGenerate() {
    publishFullscreenWfcWorldState(
      startWfcWorldCollapse(fullscreenWfcWorldStateRef.current),
    );
  }

  function handleFullscreenWfcWorldClear() {
    publishFullscreenWfcWorldState(
      clearWfcWorld(fullscreenWfcWorldStateRef.current),
    );
  }

  function handleFullscreenWfcWorldSave(snapshot) {
    const current = fullscreenWfcWorldStateRef.current;
    if (!current || !snapshot) {
      return;
    }
    publishFullscreenWfcWorldState({
      ...current,
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        revision: snapshot.revision,
      },
      message: `${snapshot.name}, revision ${snapshot.revision}, saved locally.`,
    });
  }

  function handleFullscreenWfcWorldRestore(restoredGame) {
    if (!restoredGame) {
      return;
    }
    fullscreenWfcWorldLastTickRef.current = 0;
    publishFullscreenWfcWorldState(restoredGame);
    setFullscreenWfcProjectOpen(false);
  }

  function handleFullscreenWfcWorldDelete(snapshot) {
    const current = fullscreenWfcWorldStateRef.current;
    if (!current || current.snapshot?.id !== snapshot?.id) {
      return;
    }
    publishFullscreenWfcWorldState({
      ...current,
      snapshot: null,
      message: `${snapshot.name} was removed from saved projects. Your open canvas is unchanged.`,
    });
  }

  function getFullscreenWfcWorldMousePoint(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handleFullscreenWfcWorldMouseDown(event) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const point = getFullscreenWfcWorldMousePoint(event);
    fullscreenWfcWorldMouseInputRef.current = {
      pointerActive: true,
      pointerX: point.x,
      pointerY: point.y,
      pinchActive: true,
      pinchStarted: true,
    };
  }

  function handleFullscreenWfcWorldMouseMove(event) {
    const currentMouseInput = fullscreenWfcWorldMouseInputRef.current;
    if (!currentMouseInput.pinchActive) {
      return;
    }
    const point = getFullscreenWfcWorldMousePoint(event);
    fullscreenWfcWorldMouseInputRef.current = {
      ...currentMouseInput,
      pointerActive: true,
      pointerX: point.x,
      pointerY: point.y,
      pinchActive: true,
    };
  }

  function stopFullscreenWfcWorldMouseInput(event) {
    const currentMouseInput = fullscreenWfcWorldMouseInputRef.current;
    if (!currentMouseInput.pinchActive && !currentMouseInput.pinchStarted) {
      return;
    }
    const point = getFullscreenWfcWorldMousePoint(event);
    fullscreenWfcWorldMouseInputRef.current = {
      pointerActive: Boolean(currentMouseInput.pinchStarted),
      pointerX: point.x,
      pointerY: point.y,
      pinchActive: false,
      pinchStarted: Boolean(currentMouseInput.pinchStarted),
    };
  }

  function updateFullscreenWfcWorldSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== WFC_WORLD_MODE_ID ||
      !fullscreenWfcWorldStateRef.current
    ) {
      fullscreenWfcWorldLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenWfcWorldViewportRef.current;
    if (!viewportMetrics) {
      fullscreenWfcWorldLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenWfcWorldLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenWfcWorldLastTickRef.current = timestamp;

    const mouseInput = fullscreenWfcWorldMouseInputRef.current;
    const nextState = stepWfcWorldGame(
      fullscreenWfcWorldStateRef.current,
      deltaSeconds,
      createWfcWorldStepInput({
        viewport: viewportMetrics,
        handDetected: handDetectedRef.current,
        cursor: cursorRef.current,
        pinchActive: pinchStateRef.current,
        mouseInput,
      }),
    );
    if (mouseInput.pinchStarted) {
      fullscreenWfcWorldMouseInputRef.current = {
        ...mouseInput,
        pointerActive: Boolean(mouseInput.pinchActive),
        pinchStarted: false,
      };
    }
    publishFullscreenWfcWorldState(nextState);
  }

  function updateFullscreenInvadersSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "invaders" ||
      !fullscreenInvadersStateRef.current
    ) {
      fullscreenInvadersLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenBreakoutViewportRef.current;
    if (!viewportMetrics) {
      fullscreenInvadersLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenInvadersLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenInvadersLastTickRef.current = timestamp;

    const fallbackShipX =
      fullscreenInvadersStateRef.current?.ship?.x ?? viewportMetrics.width / 2;
    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const pointerX = pointer.active ? pointer.x : fallbackShipX;
    const nextState = stepSpaceInvadersGame(
      fullscreenInvadersStateRef.current,
      deltaSeconds,
      pointerX,
      pointer.actionActive,
    );
    fullscreenInvadersStateRef.current = nextState;
    setFullscreenInvadersState(nextState);
  }

  function updateFullscreenFlappySimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "flappy" ||
      !fullscreenFlappyStateRef.current
    ) {
      fullscreenFlappyLastTickRef.current = timestamp;
      return;
    }

    if (!fullscreenFlappyViewportRef.current) {
      fullscreenFlappyLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenFlappyLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenFlappyLastTickRef.current = timestamp;

    const nextState = stepFlappyGame(
      fullscreenFlappyStateRef.current,
      deltaSeconds,
    );
    fullscreenFlappyStateRef.current = nextState;
    setFullscreenFlappyState(nextState);
  }

  function updateFullscreenMissileCommandSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "missile-command" ||
      !fullscreenMissileCommandStateRef.current
    ) {
      fullscreenMissileCommandLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenMissileCommandViewportRef.current;
    if (!viewportMetrics) {
      fullscreenMissileCommandLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenMissileCommandLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenMissileCommandLastTickRef.current = timestamp;

    const nextState = stepMissileCommandGame(
      fullscreenMissileCommandStateRef.current,
      deltaSeconds,
    );
    fullscreenMissileCommandStateRef.current = nextState;
    setFullscreenMissileCommandState(nextState);
  }

  function updateFullscreenTicTacToeSimulation(timestamp) {
    if (
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA ||
      fullscreenGridModeRef.current !== "tic-tac-toe" ||
      !fullscreenTicTacToeStateRef.current
    ) {
      fullscreenTicTacToeLastTickRef.current = timestamp;
      return;
    }

    const viewportMetrics = fullscreenTicTacToeViewportRef.current;
    if (!viewportMetrics) {
      fullscreenTicTacToeLastTickRef.current = timestamp;
      return;
    }

    const previousTimestamp = fullscreenTicTacToeLastTickRef.current || timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1000));
    fullscreenTicTacToeLastTickRef.current = timestamp;

    const pointer = getActiveFullscreenPointer(viewportMetrics);
    const nextState = stepTicTacToeGame(fullscreenTicTacToeStateRef.current, deltaSeconds, {
      pointerActive: pointer.active,
      pointerX: pointer.active ? pointer.x : 0,
      pointerY: pointer.active ? pointer.y : 0,
      pinchActive: pointer.actionActive,
    });
    fullscreenTicTacToeStateRef.current = nextState;
    setFullscreenTicTacToeState(nextState);
  }

  function updateFullscreenOverlayGames(timestamp) {
    runFullscreenOverlayGameUpdates(timestamp, {
      updateFullscreenExitControlSimulation,
      updateFullscreenRestartControlSimulation,
      updateFullscreenHandBounceSimulation,
      updateFullscreenBrickDodgerSimulation,
      updateFullscreenBreakoutSimulation,
      updateFullscreenBreakoutCoopSimulation,
      updateFullscreenFingerPongSimulation,
      updateFullscreenSkyPatrolSimulation,
      updateFullscreenWfcWorldSimulation,
      updateFullscreenInvadersSimulation,
      updateFullscreenFlappySimulation,
      updateFullscreenMissileCommandSimulation,
      updateFullscreenTicTacToeSimulation,
    });
    updateFullscreenFruitNinjaSimulation(timestamp);
  }

  function runAppSimulationFrame(timestamp) {
    const currentLifecycle = experienceLifecycleRef.current;
    const previousLifecycleTimestamp =
      lifecycleLastTickRef.current || timestamp;
    const lifecycleDeltaMs = Math.max(
      0,
      timestamp - previousLifecycleTimestamp,
    );
    lifecycleLastTickRef.current = timestamp;

    if (
      currentLifecycle?.phase === EXPERIENCE_PHASES.COUNTDOWN &&
      document.visibilityState !== "hidden"
    ) {
      dispatchExperienceLifecycle({
        type: EXPERIENCE_LIFECYCLE_EVENTS.TICK,
        deltaMs: lifecycleDeltaMs,
      });
    }

    const latestLifecycle = experienceLifecycleRef.current;
    const simulationBlocked =
      document.visibilityState === "hidden" ||
      (latestLifecycle &&
        latestLifecycle.phase !== EXPERIENCE_PHASES.RUNNING);
    if (simulationBlocked) {
      if (fallbackPointerRef.current.justPressed) {
        fallbackPointerRef.current = {
          ...fallbackPointerRef.current,
          justPressed: false,
        };
      }
      simulationTimingRef.current.pause(timestamp);
      return;
    }

    simulationTimingRef.current.resume(timestamp);
    if (simulationEpochRef.current === null) {
      simulationEpochRef.current = timestamp;
    }
    simulationTimingRef.current.advance(
      timestamp,
      (_stepSeconds, step) => {
        const stepTimestamp =
          simulationEpochRef.current + step.simulatedElapsedMs;
        updateSandboxPhysics(
          stepTimestamp,
          cursorRef.current,
          handDetectedRef.current,
          pinchStateRef.current,
        );
        updateFlightSimulation(stepTimestamp);
        updateRunnerSimulation(stepTimestamp);
        updateFullscreenOverlayGames(stepTimestamp);
      },
    );

    if (
      !trackingRequestedRef.current &&
      fallbackPointerRef.current.justPressed
    ) {
      handlePinchClick(timestamp);
      fallbackPointerRef.current = {
        ...fallbackPointerRef.current,
        justPressed: false,
      };
    }

  }

  function updateFrameTiming(timestamp) {
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
    return frameId;
  }

  function processPoseFrame(pose, timestamp, hands = []) {
    const frameId = updateFrameTiming(timestamp);
    const poseMeta = getLastPoseMeta();
    const fingerSummary = summarizeFingerVisibilityFromHands(hands);

    if (!pose) {
      if (handDetectedRef.current) {
        handDetectedRef.current = false;
        setHandDetected(false);
      }
      setPinchActive(false);
      const emptyPoseStatus = createEmptyPoseStatus();
      const previousOffAxis = poseStatusRef.current?.offAxis ?? emptyPoseStatus.offAxis;
      const nextStatus = {
        ...emptyPoseStatus,
        handsCount: fingerSummary.handsCount,
        fingerCount: fingerSummary.fingerCount,
        fingertipCount: fingerSummary.fingertipCount,
        offAxis:
          phaseRef.current === PHASES.OFF_AXIS_LAB
            ? createHeldOffAxisState(previousOffAxis)
            : emptyPoseStatus.offAxis,
        parts: {
          ...emptyPoseStatus.parts,
          fingers: fingerSummary.fingersVisible,
          fingertips: fingerSummary.fingertipsVisible,
        },
      };
      setPoseStatus((previous) => {
        if (
          previous.detected === nextStatus.detected &&
          previous.handsCount === nextStatus.handsCount &&
          previous.fingerCount === nextStatus.fingerCount &&
          previous.fingertipCount === nextStatus.fingertipCount &&
          previous.parts.fingers === nextStatus.parts.fingers &&
          previous.parts.fingertips === nextStatus.parts.fingertips
        ) {
          return previous;
        }
        return nextStatus;
      });
      drawPoseOverlay(null, hands);
      if (frameId % 45 === 0) {
        appLog.debug("Body pose frame without detection", {
          frameId,
          poseMeta,
        });
      }
      return;
    }

    if (!handDetectedRef.current) {
      handDetectedRef.current = true;
      setHandDetected(true);
    }
    setPinchActive(false);

    const keypointMap = {};
    for (const point of pose.keypoints) {
      if (point?.name) {
        keypointMap[point.name] = point;
      }
    }

    const previousOffAxis = poseStatusRef.current?.offAxis ?? createEmptyOffAxisState();
    const nextPoseStatus = {
      detected: true,
      score: Number.isFinite(pose.score) ? pose.score : 0,
      keypointsCount: pose.keypoints.length,
      handsCount: fingerSummary.handsCount,
      fingerCount: fingerSummary.fingerCount,
      fingertipCount: fingerSummary.fingertipCount,
      parts: {
        head: hasVisiblePoseKeypoints(keypointMap, POSE_KEYPOINT_GROUPS.head),
        eyes: hasVisiblePoseKeypoints(keypointMap, POSE_KEYPOINT_GROUPS.eyes),
        shoulders: hasVisiblePoseKeypoints(keypointMap, POSE_KEYPOINT_GROUPS.shoulders),
        arms: hasVisiblePoseKeypoints(keypointMap, POSE_KEYPOINT_GROUPS.arms),
        torso: hasVisiblePoseKeypoints(keypointMap, POSE_KEYPOINT_GROUPS.torso),
        fingers: fingerSummary.fingersVisible,
        fingertips: fingerSummary.fingertipsVisible,
      },
      offAxis: deriveOffAxisHeadState(pose, previousOffAxis),
    };
    setPoseStatus(nextPoseStatus);
    drawPoseOverlay(pose, hands);

    if (frameId % 45 === 0) {
      appLog.debug("Body pose frame processed", {
        frameId,
        poseMeta,
        score: nextPoseStatus.score,
        parts: nextPoseStatus.parts,
      });
    }
  }

  function processTrackingFrame(hand, timestamp) {
    const frameId = updateFrameTiming(timestamp);

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
      fullscreenPrimaryHandIdRef.current = null;
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
      publishTrackingInteractionSample({
        handDetected: false,
        pinchActive: false,
        timestamp,
      });
      updateCalibrationInputTestHoverState(cursorRef.current, false, frameId);
      drawCameraOverlay(null);
      updateFlightControlFromTips(null, timestamp, frameId);
      return;
    }

    if (!handDetectedRef.current) {
      handDetectedRef.current = true;
      setHandDetected(true);
      appLog.debug("Hand detection flag switched to true", { frameId });
    }
    lastValidHandTimestampRef.current = timestamp;
    handGraceFrameCounterRef.current = 0;

    const renderMetrics = computeCameraRenderMetrics();
    const visibleBounds = renderMetrics?.displayNormalized ?? null;
    const thumbTipRawU = Number.isFinite(hand.thumbTip?.uRaw) ? hand.thumbTip.uRaw : hand.thumbTip?.u;
    const thumbTipRawV = Number.isFinite(hand.thumbTip?.vRaw) ? hand.thumbTip.vRaw : hand.thumbTip?.v;
    const indexTipRawU = Number.isFinite(hand.indexTip?.uRaw) ? hand.indexTip.uRaw : hand.indexTip?.u;
    const indexTipRawV = Number.isFinite(hand.indexTip?.vRaw) ? hand.indexTip.vRaw : hand.indexTip?.v;
    const visibleThumbTip = normalizeTipToVisibleBounds(thumbTipRawU, thumbTipRawV, visibleBounds);
    const visibleIndexTip = normalizeTipToVisibleBounds(indexTipRawU, indexTipRawV, visibleBounds);
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
    const mappedIndexTip =
      mappedFingerTips.index && Number.isFinite(mappedFingerTips.index.u) && Number.isFinite(mappedFingerTips.index.v)
        ? mappedFingerTips.index
        : visibleIndexTip
          ? { u: visibleIndexTip.u, v: visibleIndexTip.v }
          : Number.isFinite(hand.indexTip?.u) && Number.isFinite(hand.indexTip?.v)
            ? { u: hand.indexTip.u, v: hand.indexTip.v }
            : null;
    const usesIndexPointer =
      phaseRef.current === PHASES.RUNNER ||
      phaseRef.current === PHASES.FULLSCREEN_CAMERA ||
      phaseRef.current === PHASES.TRACKING_SETUP;
    const baseMappedPointerTip =
      usesIndexPointer && mappedIndexTip
        ? mappedIndexTip
        : mappedThumbTip;
    const mappedPointerTip = expandPointerRangeForSeatedPlay(
      baseMappedPointerTip,
      preferencesRef.current.seatedMode &&
        phaseRef.current !== PHASES.CALIBRATION,
    );
    const pointerSource = usesIndexPointer && mappedIndexTip ? "index" : "thumb";
    const pointerRawU = pointerSource === "index" ? indexTipRawU : thumbTipRawU;
    const pointerRawV = pointerSource === "index" ? indexTipRawV : thumbTipRawV;
    const pointerClampedU = pointerSource === "index" ? hand.indexTip?.u : hand.thumbTip?.u;
    const pointerClampedV = pointerSource === "index" ? hand.indexTip?.v : hand.thumbTip?.v;
    const visiblePointerTip = pointerSource === "index" ? visibleIndexTip : visibleThumbTip;
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
      phaseRef.current !== PHASES.FULLSCREEN_CAMERA &&
      !isCalibratingRef.current &&
      !isArcCalibratingRef.current;
    const renderedPointerPoint = projectCameraPointToCanvas(mappedPointerTip, renderMetrics);
    let mappedPoint =
      phaseRef.current === PHASES.FULLSCREEN_CAMERA && renderedPointerPoint
        ? renderedPointerPoint
        : {
            x: mappedPointerTip.u * viewportRef.current.width,
            y: mappedPointerTip.v * viewportRef.current.height,
          };
    let transformMode =
      phaseRef.current === PHASES.FULLSCREEN_CAMERA && renderedPointerPoint
        ? "fullscreen_rendered_camera_space"
        : "none";
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
    const cursorAlpha = getCursorSmoothingAlpha(
      preferencesRef.current.cursorSmoothing,
    );
    const smoothed = clampPoint(
      {
        x: cursorAlpha * rawPoint.x + (1 - cursorAlpha) * prev.x,
        y: cursorAlpha * rawPoint.y + (1 - cursorAlpha) * prev.y,
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
        source: pointerSource,
        uRaw: roundMetric(pointerRawU),
        vRaw: roundMetric(pointerRawV),
        uClamped: roundMetric(pointerClampedU),
        vClamped: roundMetric(pointerClampedV),
      },
      mappedPointerTip,
      arcMappedPoint,
      visiblePointerTip,
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
        visiblePointerTip,
      });
      if (calibrationSampleRef.current.points.length >= CALIBRATION_SAMPLE_FRAMES) {
        finalizeCalibrationSample();
      }
    }

    const pinchThresholds = getPinchThresholds(
      preferencesRef.current.pinchThreshold,
    );
    let nextPinch = pinchStateRef.current;
    if (!nextPinch && hand.pinchDistance < pinchThresholds.start) {
      nextPinch = true;
    } else if (nextPinch && hand.pinchDistance > pinchThresholds.end) {
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

      const bypassGlobalPinchDebounce = shouldBypassGlobalPinchDebounce({
        phase: phaseRef.current,
        fullscreenGridMode: fullscreenGridModeRef.current,
      });

      if (
        shouldAcceptPinchClick({
          wasPinching,
          isPinching: nextPinch,
          timestamp,
          lastPinchClickAt: lastPinchClickRef.current,
          debounceMs: PINCH_DEBOUNCE_MS,
          bypassGlobalDebounce: bypassGlobalPinchDebounce,
        })
      ) {
        lastPinchClickRef.current = timestamp;
        appLog.info("Pinch click accepted", {
          frameId,
          timestamp,
          debounceMs: PINCH_DEBOUNCE_MS,
          bypassGlobalPinchDebounce,
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

    publishTrackingInteractionSample({
      handDetected: true,
      pinchActive: nextPinch,
      pointerU: smoothed.x / Math.max(1, viewportRef.current.width),
      pointerV: smoothed.y / Math.max(1, viewportRef.current.height),
      timestamp,
    });
    drawCameraOverlay(hand);
  }

  function appendLabEventsToLog(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }
    const entries = events.map((event) => {
      const eventDate = new Date();
      const timeLabel = eventDate.toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return {
        id: `${event.id}-${event.frameId}-${event.timestamp}`,
        timeLabel,
        timestamp: eventDate.toISOString(),
        gestureId: event.gestureId,
        gestureLabel: GESTURE_LABEL_BY_ID[event.gestureId] ?? event.gestureId,
        confidence: event.confidence ?? 0,
        handId: event.handId ?? null,
        handLabel: event.handLabel ?? null,
        metaSummary: summarizeEventMeta(event.meta),
      };
    });
    setLabEventLog((previous) => [...entries, ...previous].slice(0, LAB_EVENT_LOG_LIMIT));
  }

  function updateLabTrainingSession(timestamp, output) {
    const session = labTrainingSessionRef.current;
    if (!session) {
      return;
    }

    if (session.phase === "countdown") {
      const remainingMs = Math.max(0, session.countdownEndAt - timestamp);
      const nextCountdown = Math.ceil(remainingMs / 1000);
      if (nextCountdown !== session.lastCountdownValue) {
        session.lastCountdownValue = nextCountdown;
        setLabTrainingState({
          active: true,
          phase: "countdown",
          gestureId: session.gestureId,
          gestureLabel: GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId,
          countdown: nextCountdown,
          capturedFrames: 0,
          targetFrames: LAB_TRAIN_CAPTURE_FRAMES,
          message: `Prepare to perform ${GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId}.`,
        });
      }

      if (remainingMs <= 0) {
        session.phase = "capture";
        session.captureFrames = 0;
        session.bestVector = null;
        session.bestScore = -1;
        setLabTrainingState({
          active: true,
          phase: "capture",
          gestureId: session.gestureId,
          gestureLabel: GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId,
          countdown: 0,
          capturedFrames: 0,
          targetFrames: LAB_TRAIN_CAPTURE_FRAMES,
          message: `Capturing ${GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId} sample...`,
        });
      }
      return;
    }

    if (session.phase !== "capture") {
      return;
    }

    const requiresTwoHands = isTwoHandGesture(session.gestureId);
    const hasRequiredHands = requiresTwoHands
      ? Boolean(output?.twoHand?.present) && (output?.hands?.length ?? 0) >= 2
      : (output?.hands?.length ?? 0) >= 1;

    if (hasRequiredHands) {
      session.captureFrames += 1;
      const vector = output?.liveVectors?.[session.gestureId] ?? null;
      if (Array.isArray(vector) && vector.length > 0) {
        const score = output?.heuristicConfidences?.[session.gestureId] ?? output?.confidences?.[session.gestureId] ?? 0;
        if (score >= session.bestScore) {
          session.bestScore = score;
          session.bestVector = [...vector];
        }
      }

      setLabTrainingState({
        active: true,
        phase: "capture",
        gestureId: session.gestureId,
        gestureLabel: GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId,
        countdown: 0,
        capturedFrames: session.captureFrames,
        targetFrames: LAB_TRAIN_CAPTURE_FRAMES,
        message: `Capturing ${GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId} sample...`,
      });
    } else {
      setLabTrainingState({
        active: true,
        phase: "capture",
        gestureId: session.gestureId,
        gestureLabel: GESTURE_LABEL_BY_ID[session.gestureId] ?? session.gestureId,
        countdown: 0,
        capturedFrames: session.captureFrames,
        targetFrames: LAB_TRAIN_CAPTURE_FRAMES,
        message: requiresTwoHands
          ? "Capture paused: two hands required for this gesture."
          : "Capture paused: hand not detected.",
      });
    }

    if (session.captureFrames < LAB_TRAIN_CAPTURE_FRAMES) {
      return;
    }

    const vectorToStore = session.bestVector;
    const gestureId = session.gestureId;
    labTrainingSessionRef.current = null;
    if (!Array.isArray(vectorToStore) || vectorToStore.length === 0) {
      setLabTrainingState({
        ...createInitialLabTrainingState(),
        message: `No valid vector captured for ${GESTURE_LABEL_BY_ID[gestureId] ?? gestureId}. Try again.`,
      });
      return;
    }

    const saved = personalizationRef.current.addSample(gestureId, vectorToStore);
    if (!saved) {
      setLabTrainingState({
        ...createInitialLabTrainingState(),
        message: `Failed to save sample for ${GESTURE_LABEL_BY_ID[gestureId] ?? gestureId}.`,
      });
      return;
    }

    setLabSampleCounts(personalizationRef.current.getSampleCounts());
    const nextCount = personalizationRef.current.getSampleCount(gestureId);
    setLabTrainingState({
      ...createInitialLabTrainingState(),
      message: `Saved sample for ${GESTURE_LABEL_BY_ID[gestureId] ?? gestureId}. Total samples: ${nextCount}.`,
    });
  }

  function processMinorityReportFrame(hands, timestamp) {
    if (
      phaseRef.current !== PHASES.MINORITY_REPORT_LAB &&
      phaseRef.current !== PHASES.SPATIAL_GESTURE_MEMORY &&
      phaseRef.current !== PHASES.GESTURE_CONTROL_OS
    ) {
      return;
    }

    const output = gestureEngineRef.current.update({
      hands,
      timestamp,
      confidenceThreshold: labConfidenceThresholdRef.current,
      pinchThreshold: preferencesRef.current.pinchThreshold,
      personalizationEnabled: labPersonalizationEnabledRef.current,
      personalizer: personalizationRef.current,
    });
    setLabEngineOutput(output);

    if (Array.isArray(output?.events) && output.events.length > 0) {
      appendLabEventsToLog(output.events);
      if (phaseRef.current === PHASES.SPATIAL_GESTURE_MEMORY) {
        for (const event of output.events) {
          if (event?.confidence >= labConfidenceThresholdRef.current) {
            dispatchSpatialMemoryExperience({
              type: SPATIAL_MEMORY_ACTIONS.GESTURE_INPUT,
              gestureId: event.gestureId,
              confidence: event.confidence,
              source: "camera",
              now: timestamp,
              frameId: output.frameId,
            });
          }
        }
      }
    }
    updateLabTrainingSession(timestamp, output);
  }


  function dispatchSpatialMemoryExperience(action) {
    const previousExperience =
      spatialMemoryExperienceRef.current ??
      createSpatialMemoryExperience();
    const nextExperience = reduceSpatialMemoryExperience(
      previousExperience,
      action,
    );
    if (nextExperience === previousExperience) {
      return previousExperience;
    }

    spatialMemoryExperienceRef.current = nextExperience;
    setSpatialMemoryExperience(nextExperience);

    const previousLegacy =
      spatialMemoryRef.current ?? createInitialSpatialMemoryState();
    let nextLegacy = toSpatialMemoryLegacyState(
      nextExperience,
      previousLegacy,
    );
    const enteredResult =
      previousExperience.phase !== SPATIAL_MEMORY_PHASES.RESULT &&
      nextExperience.phase === SPATIAL_MEMORY_PHASES.RESULT;
    if (enteredResult) {
      const succeeded =
        nextExperience.result?.outcome === "success";
      const totalRounds = (previousLegacy.totalRounds ?? 0) + 1;
      const completedRounds =
        (previousLegacy.completedRounds ?? 0) + (succeeded ? 1 : 0);
      const score = nextExperience.scores?.combinedScore ?? 0;
      const highScore = Math.max(previousLegacy.highScore ?? 0, score);
      const bestRound = succeeded
        ? Math.max(previousLegacy.bestRound ?? 1, nextExperience.round)
        : previousLegacy.bestRound ?? 1;
      const elapsedMs =
        Number.isFinite(nextExperience.phaseStartedAt) &&
        Number.isFinite(nextExperience.observeStartedAt)
          ? Math.max(
              0,
              nextExperience.phaseStartedAt -
                nextExperience.observeStartedAt,
            )
          : 0;
      nextLegacy = {
        ...nextLegacy,
        totalRounds,
        completedRounds,
        highScore,
        bestRound,
        successRate: completedRounds / Math.max(1, totalRounds),
        elapsedSeconds: elapsedMs / 1000,
        smoothness:
          1 -
          Math.min(
            1,
            (nextExperience.mistakesUsed ?? 0) /
              Math.max(
                1,
                (nextExperience.mistakeAllowance ?? 0) + 1,
              ),
          ),
        difficultyLevel: previousLegacy.difficultyLevel ?? 1,
      };
      saveSpatialMemoryStats({
        highScore,
        bestRound,
        totalRounds,
        completedRounds,
      });
    }
    spatialMemoryRef.current = nextLegacy;
    setSpatialMemoryState(nextLegacy);
    return nextExperience;
  }

  function startSpatialGestureMemoryRound() {
    const previous = spatialMemoryRef.current ?? createInitialSpatialMemoryState();
    const nextRound = previous.status === "completed" ? previous.round + 1 : previous.round;
    const successRate = previous.totalRounds > 0 ? previous.completedRounds / previous.totalRounds : 0;
    const adaptiveBoost = successRate >= 0.75 ? 1 : 0;
    const adaptivePenalty = successRate < 0.45 ? -1 : 0;
    const difficultyLevel = Math.max(1, Math.min(6, nextRound + adaptiveBoost + adaptivePenalty));
    const sequence = buildSpatialSequence(nextRound, difficultyLevel);
    const now = performance.now();

    beginRestartedProgressionSession(getModeById("spatial-memory"), {
      round: nextRound,
      difficultyLevel,
    });
    const preparedLegacy = {
      ...previous,
      difficultyLevel,
    };
    spatialMemoryRef.current = preparedLegacy;
    setSpatialMemoryState(preparedLegacy);
    dispatchSpatialMemoryExperience({
      type: SPATIAL_MEMORY_ACTIONS.START_ROUND,
      sequence,
      round: nextRound,
      now,
      teachingStepDurationMs: 1_500,
      mistakeAllowance: difficultyLevel >= 5 ? 1 : 2,
      minimumConfidence: labConfidenceThresholdRef.current,
    });
  }

  function resetSpatialGestureMemory() {
    const nextStats = createInitialSpatialMemoryStats();
    saveSpatialMemoryStats(nextStats);
    const nextExperience = createSpatialMemoryExperience();
    const nextLegacy = {
      ...createInitialSpatialMemoryState(),
      ...nextStats,
    };
    spatialMemoryExperienceRef.current = nextExperience;
    spatialMemoryRef.current = nextLegacy;
    setSpatialMemoryExperience(nextExperience);
    setSpatialMemoryState(nextLegacy);
  }

  function startLabGestureRecording(gestureId) {
    const label = GESTURE_LABEL_BY_ID[gestureId] ?? gestureId;
    labTrainingSessionRef.current = {
      gestureId,
      phase: "countdown",
      countdownEndAt: performance.now() + LAB_TRAIN_COUNTDOWN_SECONDS * 1000,
      lastCountdownValue: LAB_TRAIN_COUNTDOWN_SECONDS,
      captureFrames: 0,
      bestVector: null,
      bestScore: -1,
    };
    setLabTrainingState({
      active: true,
      phase: "countdown",
      gestureId,
      gestureLabel: label,
      countdown: LAB_TRAIN_COUNTDOWN_SECONDS,
      capturedFrames: 0,
      targetFrames: LAB_TRAIN_CAPTURE_FRAMES,
      message: `Get ready: recording ${label} in ${LAB_TRAIN_COUNTDOWN_SECONDS} seconds.`,
    });
  }

  function deleteLastLabSample(gestureId) {
    personalizationRef.current.deleteLastSample(gestureId);
    setLabSampleCounts(personalizationRef.current.getSampleCounts());
    setLabTrainingState({
      ...createInitialLabTrainingState(),
      message: `Deleted last sample for ${GESTURE_LABEL_BY_ID[gestureId] ?? gestureId}.`,
    });
  }

  function clearLabSamples(gestureId) {
    personalizationRef.current.clearGesture(gestureId);
    setLabSampleCounts(personalizationRef.current.getSampleCounts());
    setLabTrainingState({
      ...createInitialLabTrainingState(),
      message: `Cleared all samples for ${GESTURE_LABEL_BY_ID[gestureId] ?? gestureId}.`,
    });
  }

  function clearLabEventLog() {
    setLabEventLog([]);
  }

  async function exportLabSamples() {
    const json = personalizationRef.current.exportJSON();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `minority-report-training-${stamp}.json`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      }
    } catch (error) {
      appLog.warn("Failed to copy training JSON to clipboard", { error });
    }

    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setLabTrainingState({
        ...createInitialLabTrainingState(),
        message: `Exported training JSON and copied to clipboard (${filename}).`,
      });
    } catch (error) {
      appLog.error("Failed to export training JSON", { error });
      setLabTrainingState({
        ...createInitialLabTrainingState(),
        message: "Export failed. Check browser download permissions.",
      });
    }
  }

  async function importLabSamples(file) {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const result = personalizationRef.current.importFromJSON(text, true);
      if (!result.ok) {
        setLabTrainingState({
          ...createInitialLabTrainingState(),
          message: "Import failed: invalid or incompatible JSON payload.",
        });
        return;
      }
      setLabSampleCounts(personalizationRef.current.getSampleCounts());
      setLabTrainingState({
        ...createInitialLabTrainingState(),
        message: `Imported training JSON (${file.name}).`,
      });
    } catch (error) {
      appLog.error("Failed to import training JSON", { error });
      setLabTrainingState({
        ...createInitialLabTrainingState(),
        message: "Import failed while reading the JSON file.",
      });
    }
  }

  useEffect(() => {
    let animationFrameId = 0;
    let cancelled = false;
    let previousRenderTimestamp = null;
    simulationTimingRef.current.reset();
    simulationEpochRef.current = null;
    lifecycleLastTickRef.current = 0;

    const simulate = (timestamp) => {
      if (cancelled || !mountedRef.current) {
        return;
      }
      if (previousRenderTimestamp !== null) {
        const qualityUpdate = updateDynamicQuality(
          dynamicQualityControllerRef.current,
          {
            frameTimeMs: timestamp - previousRenderTimestamp,
            timestampMs: timestamp,
          },
        );
        dynamicQualityControllerRef.current = qualityUpdate.state;
        if (qualityUpdate.changed) {
          setDynamicQualityLevel(qualityUpdate.level);
          appLog.info("Adaptive visual quality changed", {
            previousLevel: qualityUpdate.previousLevel,
            level: qualityUpdate.level,
            reason: qualityUpdate.reason,
          });
        }
      }
      previousRenderTimestamp = timestamp;
      runAppSimulationFrame(timestamp);
      animationFrameId = requestAnimationFrame(simulate);
    };
    animationFrameId = requestAnimationFrame(simulate);

    return () => {
      cancelled = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [appLog, phase]);

  useEffect(() => {
    const poseOnlyTrackingPhase =
      phase === PHASES.BODY_POSE || phase === PHASES.OFF_AXIS_LAB;
    const trackingReady = cameraReady && (poseOnlyTrackingPhase ? poseModelReady : modelReady);

    if (!trackingReady) {
      appLog.debug("Tracking loop not started because prerequisites are not ready", {
        phase,
        cameraReady,
        modelReady,
        poseModelReady,
        poseOnlyTrackingPhase,
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

      const poseOnlyFrame =
        phaseRef.current === PHASES.BODY_POSE || phaseRef.current === PHASES.OFF_AXIS_LAB;
      runTrackingKeepAlive(timestamp, { allowDetectorRecovery: !poseOnlyFrame });
      const inferenceIntervalMs =
        dynamicQualityBudgetRef.current.inferenceIntervalMs;
      if (
        lastInferenceStartedAtRef.current > 0 &&
        timestamp - lastInferenceStartedAtRef.current <
          inferenceIntervalMs
      ) {
        return;
      }

      if (poseOnlyFrame) {
        const video = videoRef.current;
        const poseDetector = poseDetectorRef.current;
        const handDetector = detectorRef.current;
        if (!poseDetector || !video || video.readyState < 2) {
          if (frameCounterRef.current % 30 === 0) {
            appLog.debug("Skipping pose-scene frame due to detector/video readiness", {
              hasPoseDetector: Boolean(poseDetector),
              hasVideo: Boolean(video),
              readyState: video?.readyState ?? null,
            });
          }
          setPoseStatus((previous) => (previous.detected ? createEmptyPoseStatus() : previous));
          if (handDetectedRef.current) {
            handDetectedRef.current = false;
            setHandDetected(false);
          }
          drawPoseOverlay(null, []);
          return;
        }

        if (inferenceBusyRef.current) {
          return;
        }

        const inferenceToken = beginTrackingInference(timestamp);
        try {
          const pose = await detectPose(poseDetector, video);
          const detectedHands = handDetector ? await detectHands(handDetector, video) : [];
          if (!isCurrentTrackingInference(inferenceToken)) {
            appLog.warn("Ignoring stale pose-scene inference result after keep-alive recovery", {
              inferenceToken,
              activeInferenceToken: activeInferenceTokenRef.current,
            });
            return;
          }
          const labeledHands = assignStableHandLabels(detectedHands, {
            memory: handLabelMemoryRef.current,
            timestamp,
            pose,
          }).slice(0, TRACKING_DEFAULT_HAND_LIMIT);
          const stableHands = adaptHandsForCamera(
            labeledHands,
            preferencesRef.current.mirrorCamera,
          );
          const displayPose = adaptPoseForCamera(
            pose,
            preferencesRef.current.mirrorCamera,
          );
          if (!cancelled && mountedRef.current) {
            processPoseFrame(displayPose, timestamp, stableHands);
          }
        } catch (error) {
          appLog.error("Pose frame inference failed", { error });
        } finally {
          completeTrackingInference(inferenceToken);
        }
        return;
      }

      if (inferenceBusyRef.current) {
        inferenceBusySkipCounterRef.current += 1;
        if (inferenceBusySkipCounterRef.current % 30 === 0) {
          appLog.debug("Skipping frame because previous inference is still running", {
            skipCount: inferenceBusySkipCounterRef.current,
            timestamp,
          });
        }
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        return;
      }
      inferenceBusySkipCounterRef.current = 0;

      if (recoveringDetectorRef.current) {
        fullscreenHandsRef.current = [];
        setFullscreenDetectedHandCount(0);
        fullscreenPrimaryHandIdRef.current = null;
        recoveryFrameSkipCounterRef.current += 1;
        if (recoveryFrameSkipCounterRef.current % 30 === 0) {
          appLog.debug("Skipping frame because detector recovery is in progress", {
            skipCount: recoveryFrameSkipCounterRef.current,
          });
        }
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        return;
      }
      recoveryFrameSkipCounterRef.current = 0;

      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) {
        fullscreenHandsRef.current = [];
        setFullscreenDetectedHandCount(0);
        fullscreenPrimaryHandIdRef.current = null;
        appLog.debug("Skipping frame due to missing detector/video readiness", {
          hasDetector: Boolean(detector),
          hasVideo: Boolean(video),
          readyState: video?.readyState ?? null,
        });
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
        return;
      }

      const inferenceToken = beginTrackingInference(timestamp);
      try {
        const detectedHands = await detectHands(detector, video);
        const minorityReportPose =
          phaseRef.current === PHASES.MINORITY_REPORT_LAB && poseDetectorRef.current
            ? await detectPose(poseDetectorRef.current, video)
            : null;
        if (!isCurrentTrackingInference(inferenceToken)) {
          appLog.warn("Ignoring stale hand inference result after keep-alive recovery", {
            inferenceToken,
            activeInferenceToken: activeInferenceTokenRef.current,
          });
          return;
        }
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
          if (
            noHandStreakRef.current === NO_HAND_KEEP_ALIVE_NOTICE_THRESHOLD ||
            noHandStreakRef.current % NO_HAND_KEEP_ALIVE_LOG_INTERVAL === 0
          ) {
            appLog.info("No hands detected; tracking keep-alive is continuing detection", {
              noHandStreak: noHandStreakRef.current,
              detectionMeta,
              millisSinceLastValidHand,
            });
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
          const fullscreenTrackedHandLimit =
            phaseRef.current === PHASES.FULLSCREEN_CAMERA
              ? getFullscreenTrackedHandLimit(
                  fullscreenGridModeRef.current,
                  TRACKING_DEFAULT_HAND_LIMIT,
                )
              : TRACKING_DEFAULT_HAND_LIMIT;
          const labeledHands = assignStableHandLabels(detectedHands, {
            memory: handLabelMemoryRef.current,
            timestamp,
            pose: minorityReportPose,
          }).slice(0, fullscreenTrackedHandLimit);
          const stableHands = adaptHandsForCamera(
            labeledHands,
            preferencesRef.current.mirrorCamera,
          );
          fullscreenHandsRef.current = stableHands;
          if (phaseRef.current === PHASES.FULLSCREEN_CAMERA) {
            setFullscreenDetectedHandCount(stableHands.length);
          }
          const primaryHand = selectPreferredHand(
            stableHands,
            preferencesRef.current.dominantHand,
          );
          fullscreenPrimaryHandIdRef.current = primaryHand?.id ?? primaryHand?.label ?? null;
          processTrackingFrame(primaryHand, timestamp);
          if (phaseRef.current === PHASES.FULLSCREEN_CAMERA) {
            const overlayPoints = drawFullscreenOverlay(stableHands);
            setFullscreenIndexPoints(overlayPoints.indexPoints);
            setFullscreenTipPoints(overlayPoints.tipPoints);
            setFullscreenSkeletonHands(
              FULLSCREEN_BODY_SKELETON_MODES.has(fullscreenGridModeRef.current)
                ? stableHands
                : [],
            );
            scheduleFullscreenBodyPoseDetection(timestamp);
          }
          processMinorityReportFrame(stableHands, timestamp);
          if (phaseRef.current === PHASES.GESTURE_ANALYTICS_LAB) {
            setAnalyticsHands(stableHands);
            setAnalyticsTimestamp(timestamp);
            drawCameraOverlayHands(stableHands, {
              showSkeleton: true,
            });
          } else if (phaseRef.current === PHASES.GESTURE_ART_LAB) {
            setGestureArtHands(stableHands);
          }
          if (
            phaseRef.current === PHASES.MINORITY_REPORT_LAB ||
            phaseRef.current === PHASES.GESTURE_CONTROL_OS
          ) {
            drawCameraOverlayHands(stableHands, {
              showSkeleton: labShowSkeletonRef.current,
            });
          }
        }
      } catch (error) {
        appLog.error("Frame inference failed", { error });
        updateFlightControlFromTips(null, timestamp, frameCounterRef.current);
      } finally {
        completeTrackingInference(inferenceToken);
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
  }, [appLog, cameraReady, modelReady, phase, poseModelReady]);

  function renderFullscreenRingGroup(point, opacity, keyPrefix) {
    if (!fullscreenCameraViewport || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      return null;
    }

    return (
      <div
        key={`${keyPrefix}-${point.id}`}
        className="fullscreen-camera-ring-group"
        style={{
          left: `${point.x - fullscreenCameraViewport.left}px`,
          top: `${point.y - fullscreenCameraViewport.top}px`,
          opacity,
        }}
      >
        {getFullscreenRingLayersForHand(
          motionVisualizerRingLayers,
          point.label,
        ).map((layer) => (
          <div
            key={`${keyPrefix}-${point.id}-${layer.color}`}
            className="fullscreen-camera-ring-layer"
            style={{
              width: `${layer.diameter}px`,
              height: `${layer.diameter}px`,
              backgroundColor: layer.color,
            }}
          />
        ))}
      </div>
    );
  }

  function renderFullscreenPulseBurst(burst, keyPrefix) {
    if (!fullscreenCameraViewport || !Number.isFinite(burst?.x) || !Number.isFinite(burst?.y)) {
      return null;
    }

    const elapsed = Math.max(0, fullscreenPulseNow - burst.startTime);
    const progress = Math.min(
      1,
      elapsed / motionVisualizerPulseDurationMs,
    );
    if (progress <= 0 || progress >= 1) {
      return null;
    }

    const radius = burst.startRadius + (burst.maxRadius - burst.startRadius) * progress;
    return (
      <div
        key={`${keyPrefix}-${burst.id}`}
        className="fullscreen-camera-pulse-ring"
        style={{
          left: `${burst.x - fullscreenCameraViewport.left}px`,
          top: `${burst.y - fullscreenCameraViewport.top}px`,
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
          opacity: (1 - progress) * 0.9,
        }}
      />
    );
  }

  function renderTrackedCursorLayer() {
    return (
      <>
        {cursorTrail.map((point, index) => {
          const age = Math.max(0, cursorTrailNow - point.timestamp);
          const progress = 1 - Math.min(1, age / CURSOR_TRAIL_DURATION_MS);
          if (progress <= 0) {
            return null;
          }
          return (
            <div
              key={`cursor-trail-${point.timestamp}-${index}`}
              className="tracked-cursor-trail"
              style={{
                left: `${point.x}px`,
                top: `${point.y}px`,
                opacity: progress * 0.75,
                transform: `translate(-50%, -50%) scale(${0.42 + progress * 0.5})`,
              }}
            />
          );
        })}
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
      </>
    );
  }

  function renderFullscreenStaticRingSet(point, keyPrefix) {
    if (!fullscreenCameraViewport || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      return null;
    }

    const localX = point.x - fullscreenCameraViewport.left;
    const localY = point.y - fullscreenCameraViewport.top;
    const viewportRadius = Math.max(
      Math.hypot(localX, localY),
      Math.hypot(fullscreenCameraViewport.width - localX, localY),
      Math.hypot(localX, fullscreenCameraViewport.height - localY),
      Math.hypot(
        fullscreenCameraViewport.width - localX,
        fullscreenCameraViewport.height - localY,
      ),
    );
    const maxDiameter = viewportRadius * 2;
    const startDiameter =
      (FULLSCREEN_RING_LAYERS[0]?.diameter ?? 0) + FULLSCREEN_STATIC_RING_STEP_PX;
    const diameters = [];
    const clipPath = getStaticRippleClipPath(
      point,
      fullscreenIndexPoints,
      fullscreenCameraViewport,
    );
    for (
      let diameter = startDiameter;
      diameter <= maxDiameter + FULLSCREEN_STATIC_RING_STEP_PX;
      diameter += FULLSCREEN_STATIC_RING_STEP_PX
    ) {
      diameters.push(diameter);
    }

    return (
      <div
        key={`${keyPrefix}-${point.id}`}
        className="fullscreen-camera-static-ripple-field"
        style={{
          clipPath,
        }}
      >
        {diameters.map((diameter) => (
          <div
            key={`${keyPrefix}-${point.id}-${diameter}`}
            className="fullscreen-camera-static-ring"
            style={{
              left: `${point.x - fullscreenCameraViewport.left}px`,
              top: `${point.y - fullscreenCameraViewport.top}px`,
              width: `${diameter}px`,
              height: `${diameter}px`,
            }}
          />
        ))}
      </div>
    );
  }

  function renderFullscreenTipRippleSet(point, keyPrefix, strokeWidth) {
    if (!fullscreenCameraViewport || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      return null;
    }

    const localX = point.x - fullscreenCameraViewport.left;
    const localY = point.y - fullscreenCameraViewport.top;
    const viewportRadius = Math.max(
      Math.hypot(localX, localY),
      Math.hypot(fullscreenCameraViewport.width - localX, localY),
      Math.hypot(localX, fullscreenCameraViewport.height - localY),
      Math.hypot(
        fullscreenCameraViewport.width - localX,
        fullscreenCameraViewport.height - localY,
      ),
    );
    const maxDiameter = viewportRadius * 2;
    const centerDiameter = FULLSCREEN_RING_LAYERS[0]?.diameter ?? 44;
    const clipPath = getStaticRippleClipPath(
      point,
      fullscreenTipPoints,
      fullscreenCameraViewport,
    );
    const bands = [];

    for (
      let bandIndex = 0, outerDiameter = centerDiameter + FULLSCREEN_TIP_RIPPLE_OUTER_DIAMETER_STEP_PX;
      outerDiameter < maxDiameter + FULLSCREEN_STATIC_RING_STEP_PX;
      bandIndex += 1, outerDiameter += FULLSCREEN_TIP_RIPPLE_OUTER_DIAMETER_STEP_PX
    ) {
      const borderWidth = Math.min(strokeWidth, outerDiameter / 2);
      const contentDiameter = Math.max(0, outerDiameter - borderWidth * 2);
      const color =
        motionVisualizerPalette.colors[
          bandIndex % motionVisualizerPalette.colors.length
        ];
      bands.push({
        contentDiameter,
        outerDiameter,
        borderWidth,
        color,
      });
    }

    return (
      <div
        key={`${keyPrefix}-${point.id}`}
        className="fullscreen-camera-static-ripple-field"
        style={{
          clipPath,
        }}
      >
        {bands.map((band) => (
          <div
            key={`${keyPrefix}-${point.id}-${band.outerDiameter}`}
            className="fullscreen-camera-tip-ripple-band"
            style={{
              left: `${point.x - fullscreenCameraViewport.left}px`,
              top: `${point.y - fullscreenCameraViewport.top}px`,
              width: `${band.contentDiameter}px`,
              height: `${band.contentDiameter}px`,
              borderWidth: `${band.borderWidth}px`,
              borderColor: band.color,
            }}
          />
        ))}
      </div>
    );
  }

  function renderFullscreenStaticCenter(point, keyPrefix) {
    if (!fullscreenCameraViewport || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      return null;
    }

    const centerDiameter = FULLSCREEN_RING_LAYERS[0]?.diameter ?? 44;
    return (
      <div
        key={`${keyPrefix}-${point.id}`}
        className="fullscreen-camera-static-center"
        style={{
          left: `${point.x - fullscreenCameraViewport.left}px`,
          top: `${point.y - fullscreenCameraViewport.top}px`,
          width: `${centerDiameter}px`,
          height: `${centerDiameter}px`,
        }}
      />
    );
  }

  function renderFullscreenStaticSeam(keyPrefix) {
    if (!fullscreenCameraViewport || fullscreenIndexPoints.length !== 2) {
      return null;
    }

    const seam = getStaticRippleSeam(
      fullscreenIndexPoints[0],
      fullscreenIndexPoints[1],
      fullscreenCameraViewport,
    );
    if (!seam) {
      return null;
    }

    return (
      <svg
        key={keyPrefix}
        className="fullscreen-camera-static-seam"
        viewBox={`0 0 ${fullscreenCameraViewport.width} ${fullscreenCameraViewport.height}`}
        preserveAspectRatio="none"
      >
        <line x1={seam.x1} y1={seam.y1} x2={seam.x2} y2={seam.y2} />
      </svg>
    );
  }

  function restartFullscreenFruitNinjaGame() {
    if (!fullscreenCameraViewport) {
      return;
    }
    beginRestartedProgressionSession(
      getModeByFullscreenId("fruit-ninja"),
      activeLaunchContextRef.current,
    );
    const nextGame = fullscreenFruitNinjaStateRef.current?.layout
      ? restartFruitNinjaGame(fullscreenFruitNinjaStateRef.current)
      : activeLaunchContextRef.current.challenge === "daily"
        ? createFruitNinjaDailyGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
            activeLaunchContextRef.current.dayKey,
          )
        : createFruitNinjaGame(
            fullscreenCameraViewport.width,
            fullscreenCameraViewport.height,
          );
    fullscreenFruitNinjaLastTickRef.current = 0;
    fullscreenFruitNinjaStateRef.current = nextGame;
    setFullscreenFruitNinjaState(nextGame);
  }

  function renderFullscreenFruitTarget(target) {
    const size = target.radius * 2;
    const targetUi = getFruitNinjaTargetUi(target);
    return (
      <div
        aria-label={targetUi.label}
        key={target.id}
        className={targetUi.className}
        role="img"
        style={{
          left: `${target.x - target.radius}px`,
          top: `${target.y - target.radius}px`,
          width: `${size}px`,
          height: `${size}px`,
          transform: `rotate(${target.rotation}rad)`,
          background: target.fill,
          boxShadow:
            target.kind === "bomb"
              ? "0 0 0 2px rgba(255, 123, 107, 0.72), 0 16px 40px rgba(0, 0, 0, 0.34)"
              : `0 0 0 2px ${target.accent}, 0 18px 36px rgba(0, 0, 0, 0.28)`,
        }}
      >
        <div
          className={`fullscreen-camera-fruit-core ${target.kind === "bomb" ? "bomb" : ""}`}
          style={{
            background: target.kind === "bomb" ? target.accent : target.accent,
          }}
        />
        {targetUi.kind === "bomb" ? (
          <span
            aria-hidden="true"
            className="fullscreen-camera-fruit-bomb-fuse"
            style={{ "--fruit-bomb-fuse": targetUi.fuseProgress }}
          />
        ) : targetUi.variant !== "standard" ? (
          <span className="fullscreen-camera-fruit-special-mark">
            {targetUi.variant === "golden"
              ? "★"
              : targetUi.variant === "frost"
                ? "❄"
                : "◆"}
          </span>
        ) : null}
      </div>
    );
  }

  function renderFullscreenFruitSplitPiece(piece) {
    const size = piece.radius * 2;
    return (
      <div
        key={piece.id}
        className={`fullscreen-camera-fruit-split ${piece.half}`}
        style={{
          left: `${piece.x - piece.radius}px`,
          top: `${piece.y - piece.radius}px`,
          width: `${size}px`,
          height: `${size}px`,
          transform: `rotate(${piece.rotation}rad)`,
          background: piece.fill,
        }}
      >
        <div
          className="fullscreen-camera-fruit-core"
          style={{
            background: piece.accent,
          }}
        />
      </div>
    );
  }

  const fullscreenTipRippleStrokeWidth = getTipRippleStrokeWidth(
    fullscreenTipRippleNow - fullscreenTipRippleStartedAtRef.current,
    {
      thickStrokeWidth: FULLSCREEN_TIP_RIPPLE_TOUCHING_STROKE_WIDTH_PX,
    },
  );
  const activeExperienceMode = experienceModeId
    ? getModeById(experienceModeId)
    : null;
  const isArcadeRunLeg = Boolean(
    activeLaunchContextRef.current?.arcadeRunRequest ||
      arcadeRunLaunchRequestRef.current,
  );
  const experienceOverlay = experienceLifecycle && activeExperienceMode ? (
    <Suspense fallback={null}>
      <ExperienceOverlay
        exitLabel={
          isArcadeRunLeg ? "Return to Arcade Run" : undefined
        }
        hud={getCurrentExperienceHud()}
        instructions={`${activeExperienceMode.objective ?? activeExperienceMode.summary} ${
          activeExperienceMode.controlHint ?? ""
        }`.trim()}
        lifecycle={experienceLifecycle}
        modeLabel={activeExperienceMode.label}
        onExit={exitCurrentExperience}
        onPause={(reason) => {
          if (experienceModeIdRef.current === "whack-a-mole") {
            applyWhackAMoleAction({
              type: WHACK_A_MOLE_ACTIONS.PAUSE,
              now: performance.now(),
            });
          }
          dispatchExperienceLifecycle({
            type: EXPERIENCE_LIFECYCLE_EVENTS.PAUSE,
            reason,
          });
        }}
        onRestart={restartCurrentExperience}
        onResume={(reason) => {
          if (
            reason === EXPERIENCE_PAUSE_REASONS.TRACKING_LOSS &&
            trackingRecoveryStatus.shouldPause
          ) {
            return;
          }
          const transition = dispatchExperienceLifecycle({
            type: EXPERIENCE_LIFECYCLE_EVENTS.RESUME,
            reason,
          });
          if (
            experienceModeIdRef.current === "whack-a-mole" &&
            transition?.state?.phase !== EXPERIENCE_PHASES.PAUSED
          ) {
            applyWhackAMoleAction({
              type: WHACK_A_MOLE_ACTIONS.RESUME,
              now: performance.now(),
            });
          }
        }}
        trackingRecovery={trackingRecoveryStatus}
        resultOptions={{
          allowRestart: !isArcadeRunLeg,
          exitLabel: isArcadeRunLeg
            ? "Continue Arcade Run"
            : undefined,
          metricDefinitions: {
            accuracyPercent: {
              label: "Accuracy",
              format: (value) => `${Math.round(value)}%`,
            },
            smoothnessPercent: {
              label: "Smoothness",
              format: (value) => `${Math.round(value)}%`,
            },
            clearTimeMs: {
              label: "Clear time",
              format: (value) => `${(value / 1000).toFixed(1)}s`,
            },
            survivalMs: {
              label: "Survival",
              format: formatExperienceDuration,
            },
            averageHitTimeMs: {
              label: "Average reaction",
              format: (value) => `${Math.round(value)} ms`,
            },
            fastestHitMs: {
              label: "Fastest hit",
              format: (value) => `${Math.round(value)} ms`,
            },
            bestStreak: {
              label: "Best streak",
              format: (value) => `×${Math.round(value)}`,
            },
            goldHits: {
              label: "Gold hits",
            },
            decoyHits: {
              label: "Decoys hit",
            },
            decoysAvoided: {
              label: "Decoys avoided",
            },
          },
        }}
      />
    </Suspense>
  ) : null;

  if (isProductHomePhase) {
    return (
      <ProductHome
        capabilities={deviceCapabilities}
        initialArea={productHomeArea}
        readiness={{ status: productTrackingStatus }}
        progression={gameProgression}
        latestResult={latestGameResult}
        recentModeIds={preferences.recentModeIds}
        favoriteModeIds={preferences.favoriteModeIds}
        onSelectMode={selectProductMode}
        onOpenSetup={() => openProductTrackingSetup()}
        onOpenSettings={() => openProductSettings()}
        onSelectArea={(area) => {
          setProductHomeArea(area);
          updateProductPath(getProductHomePathForArea(area));
        }}
        onToggleFavorite={(modeId) =>
          setPreferences((current) => toggleFavoriteMode(current, modeId))
        }
      />
    );
  }

  if (isProductTrackingSetupPhase) {
    return (
      <Suspense
        fallback={<LazyExperienceFallback label="Opening tracking setup…" />}
      >
        <TrackingSetup
          readiness={trackingReadiness}
          interactionCheck={trackingInteractionCheck}
          capabilities={deviceCapabilities}
          recommendation={capabilityRecommendation}
          qualityBudget={dynamicQualityBudget}
          mirrorCamera={preferences.mirrorCamera}
          videoRef={videoRef}
          devices={cameraDevices}
          onBack={() => navigateToProductHome()}
          onStart={beginProductTrackingSetup}
          onRetry={retryProductTrackingSetup}
          onStop={stopProductCamera}
          onDeviceChange={(deviceId) => {
            setRequestedCameraDeviceId(deviceId);
            setTrackingReadiness((current) => ({
              ...current,
              selectedDeviceId: deviceId,
            }));
          }}
          onContinueWithoutCamera={continueWithoutProductTracking}
          onContinue={continueFromProductTrackingSetup}
        />
      </Suspense>
    );
  }

  if (isProductSettingsPhase) {
    return (
      <Suspense
        fallback={<LazyExperienceFallback label="Opening settings…" />}
      >
        <SettingsPanel
          preferences={preferences}
          capabilities={deviceCapabilities}
          qualityBudget={dynamicQualityBudget}
          trackingFps={fps}
          cameraActive={cameraReady}
          onChange={updateProductPreferences}
          onBack={() => navigateToProductHome()}
          onReset={() => setPreferences(normalizeUserPreferences())}
          onDeleteLocalData={deleteAllLocalProductData}
          onStopCamera={stopProductCamera}
          onPreviewSound={(cue) => {
            audioFeedbackRef.current.unlock();
            audioFeedbackRef.current.play(cue);
          }}
        />
      </Suspense>
    );
  }

  if (phase === PHASES.ARCADE_RUN) {
    return (
      <Suspense
        fallback={<LazyExperienceFallback label="Building your Arcade Run…" />}
      >
        <ArcadeRunExperience
          capabilityOptions={arcadeRunCapabilityOptions}
          dailyDate={activeLaunchContextRef.current?.dayKey}
          incomingLegResult={arcadeRunIncomingResult}
          initialRunKind={
            activeLaunchContextRef.current?.challenge === "daily"
              ? "daily"
              : "mix"
          }
          modes={arcadeRunModes}
          onExit={() => navigateToProductHome()}
          onLaunchMode={handleArcadeRunLaunch}
          onLegResultConsumed={() => {
            setArcadeRunIncomingResult(null);
            arcadeRunLaunchRequestRef.current = null;
          }}
          onRunComplete={handleArcadeRunComplete}
          onSessionChange={handleArcadeRunSessionChange}
          returningLegRequest={arcadeRunLaunchRequestRef.current}
          storage={window.localStorage}
        />
      </Suspense>
    );
  }

  if (phase === PHASES.GESTURE_ART_LAB) {
    return (
      <Suspense
        fallback={<LazyExperienceFallback label="Opening Light Painting…" />}
      >
        <GestureArtLab
          key={gestureArtSessionKey}
          hands={gestureArtHands}
          handDetected={handDetected}
          onBack={navigateToProductHome}
          onOpenSetup={() => {
            setPendingModeId("gesture-art");
            openProductTrackingSetup();
          }}
        />
      </Suspense>
    );
  }

  if (isFullscreenCameraPhase) {
    return (
      <div className="app fullscreen-camera-app">
        <div
          className={`fullscreen-camera-stage ${
            isMotionVisualizerMode ? "motion-visualizer-active" : ""
          }`}
          ref={cameraWrapRef}
          style={motionVisualizerStageStyle}
        >
          <WebcamBackground
            videoRef={videoRef}
            overlayCanvasRef={overlayCanvasRef}
            cameraObjectFit={cameraObjectFit}
            videoClassName={
              fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID
                ? "find-your-grind-underlay"
                : ""
            }
          />
          {fullscreenGridMode === "hex" ? (
            <div
              className="fullscreen-camera-hex-grid motion-visualizer-layer"
              style={fullscreenHexGridMetrics?.style ?? undefined}
            >
              {fullscreenHexGridMetrics?.cells?.map((cell) => (
                <div
                  key={`fullscreen-hex-cell-${cell.key}`}
                  className="fullscreen-camera-hex-cell"
                  style={cell.style}
                />
              ))}
              {fullscreenHexGridMetrics?.outerRing?.map((cell) => (
                <div
                  key={`fullscreen-hex-outer-${cell.key}`}
                  className="fullscreen-camera-grid-outer-ring fullscreen-camera-hex-cell fullscreen-camera-hex-highlight"
                  style={cell.style}
                />
              ))}
              {fullscreenHexGridMetrics?.neighbors?.map((cell) => (
                <div
                  key={`fullscreen-hex-neighbor-${cell.key}`}
                  className="fullscreen-camera-grid-neighbor fullscreen-camera-hex-cell fullscreen-camera-hex-highlight"
                  style={cell.style}
                />
              ))}
              {fullscreenHexGridMetrics?.highlight?.map((cell) => (
                <div
                  key={`fullscreen-hex-highlight-${cell.key}`}
                  className="fullscreen-camera-grid-highlight fullscreen-camera-hex-cell fullscreen-camera-hex-highlight"
                  style={cell.style}
                />
              ))}
            </div>
          ) : fullscreenGridMode === "voronoi" ? (
            <svg
              className="fullscreen-camera-voronoi motion-visualizer-layer"
              style={fullscreenVoronoiMetrics?.style ?? undefined}
              viewBox={`0 0 ${fullscreenVoronoiMetrics?.width ?? 0} ${fullscreenVoronoiMetrics?.height ?? 0}`}
              preserveAspectRatio="none"
            >
              {fullscreenVoronoiMetrics?.cells.map((cell) => (
                <polygon
                  key={`fullscreen-voronoi-cell-${cell.key}`}
                  className="fullscreen-camera-voronoi-cell"
                  points={cell.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
                  style={{ fill: cell.color }}
                />
              ))}
            </svg>
          ) : fullscreenGridMode === "rings" ? (
            <div
              className="fullscreen-camera-rings motion-visualizer-layer"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenRingTrail.map((snapshot, snapshotIndex) => {
                const age = Math.max(0, fullscreenRingTrailNow - snapshot.timestamp);
                if (age < FULLSCREEN_RING_TRAIL_SAMPLE_INTERVAL_MS) {
                  return null;
                }
                const progress =
                  1 -
                  Math.min(
                    1,
                    age / motionVisualizerTrailDurationMs,
                  );
                if (progress <= 0) {
                  return null;
                }
                return snapshot.points.map((point) =>
                  renderFullscreenRingGroup(
                    point,
                    progress * 0.9,
                    `fullscreen-ring-trail-${snapshot.timestamp}-${snapshotIndex}`,
                  ),
                );
              })}
              {fullscreenIndexPoints.map((point) =>
                renderFullscreenRingGroup(point, 0.9, "fullscreen-ring-current"),
              )}
            </div>
          ) : fullscreenGridMode === "pulse" ? (
            <div
              className="fullscreen-camera-rings motion-visualizer-layer"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenPulseBursts.map((burst) =>
                renderFullscreenPulseBurst(burst, "fullscreen-pulse-burst"),
              )}
              {fullscreenIndexPoints.map((point) =>
                renderFullscreenRingGroup(point, 0.9, "fullscreen-pulse-current"),
              )}
            </div>
          ) : fullscreenGridMode === "tip-ripples" ? (
            <div
              className="fullscreen-camera-rings motion-visualizer-layer"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenTipPoints.map((point) =>
                renderFullscreenTipRippleSet(
                  point,
                  "fullscreen-tip-ripple-rings",
                  fullscreenTipRippleStrokeWidth,
                ),
              )}
              {fullscreenTipPoints.map((point) =>
                renderFullscreenStaticCenter(point, "fullscreen-tip-ripple-center"),
              )}
            </div>
          ) : fullscreenGridMode === "static" ? (
            <div
              className="fullscreen-camera-rings motion-visualizer-layer"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenIndexPoints.map((point) =>
                renderFullscreenStaticRingSet(point, "fullscreen-static-rings"),
              )}
              {renderFullscreenStaticSeam("fullscreen-static-seam")}
              {fullscreenIndexPoints.map((point) =>
                renderFullscreenStaticCenter(point, "fullscreen-static-center"),
              )}
            </div>
          ) : fullscreenGridMode === "brick-dodger" ? (
            <div
              className="fullscreen-camera-brick-dodger"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenBrickDodgerState?.layout?.laneCenters?.map((center, index) => (
                <div
                  key={`brick-dodger-lane-${index + 1}`}
                  className="fullscreen-camera-brick-dodger-lane"
                  style={{
                    left: `${center - fullscreenBrickDodgerState.layout.laneWidth / 2}px`,
                    width: `${fullscreenBrickDodgerState.layout.laneWidth}px`,
                  }}
                />
              ))}
              {fullscreenBrickDodgerTelegraphs.map((telegraph) => (
                <div
                  aria-label={telegraph.label || undefined}
                  className={`fullscreen-camera-brick-dodger-lane-signal ${telegraph.urgency}`}
                  key={`brick-dodger-telegraph-${telegraph.laneIndex}`}
                  style={{
                    left: `${
                      telegraph.centerX -
                      (fullscreenBrickDodgerState?.layout?.laneWidth ?? 0) / 2
                    }px`,
                    width: `${fullscreenBrickDodgerState?.layout?.laneWidth ?? 0}px`,
                  }}
                >
                  {telegraph.label ? <span>{telegraph.label}</span> : null}
                </div>
              ))}
              {fullscreenBrickDodgerState?.hazards?.map((hazard) => (
                <div
                  key={hazard.id}
                  className="fullscreen-camera-brick-dodger-hazard"
                  style={{
                    left: `${hazard.x - hazard.width / 2}px`,
                    top: `${hazard.y - hazard.height / 2}px`,
                    width: `${hazard.width}px`,
                    height: `${hazard.height}px`,
                  }}
                />
              ))}
              {fullscreenBrickDodgerState?.bonuses?.map((bonus) => {
                const pickupUi = getBrickDodgerPickupUi(bonus);
                return (
                  <div
                    aria-label={pickupUi.label}
                    key={bonus.id}
                    className={`fullscreen-camera-brick-dodger-bonus ${pickupUi.className}`}
                    style={{
                      left: `${bonus.x - bonus.size / 2}px`,
                      top: `${bonus.y - bonus.size / 2}px`,
                      width: `${bonus.size}px`,
                      height: `${bonus.size}px`,
                    }}
                  >
                    <span aria-hidden="true">{pickupUi.icon}</span>
                  </div>
                );
              })}
              {fullscreenBrickDodgerState?.player ? (
                <div
                  className={`fullscreen-camera-brick-dodger-player ${
                    fullscreenBrickDodgerState.invulnerabilityMs > 0 ? "invulnerable" : ""
                  }`}
                  style={{
                    left: `${fullscreenBrickDodgerState.player.x - fullscreenBrickDodgerState.layout.playerWidth / 2}px`,
                    top: `${fullscreenBrickDodgerState.layout.playerY - fullscreenBrickDodgerState.layout.playerHeight / 2}px`,
                    width: `${fullscreenBrickDodgerState.layout.playerWidth}px`,
                    height: `${fullscreenBrickDodgerState.layout.playerHeight}px`,
                  }}
                />
              ) : null}
              <div className="fullscreen-camera-brick-dodger-scoreboard">
                <span>Score {fullscreenBrickDodgerState?.score ?? 0}</span>
                <span>Shields {fullscreenBrickDodgerState?.lives ?? 0}</span>
                <span>
                  Stage {fullscreenBrickDodgerStageUi.stage}:{" "}
                  {fullscreenBrickDodgerStageUi.name}
                </span>
                <span>Threat {fullscreenBrickDodgerStageUi.threatLabel}</span>
                {fullscreenBrickDodgerMultiplierUi.visible ? (
                  <span className={fullscreenBrickDodgerMultiplierUi.className}>
                    {fullscreenBrickDodgerMultiplierUi.label}
                  </span>
                ) : null}
              </div>
              <div className="fullscreen-camera-brick-dodger-stage-meter">
                <span
                  style={{
                    width: `${Math.round(
                      fullscreenBrickDodgerStageUi.progress * 100,
                    )}%`,
                  }}
                />
              </div>
              {fullscreenBrickDodgerSlowTimeUi.active ? (
                <div className="fullscreen-camera-brick-dodger-slow-time">
                  <strong>Slow time</strong>
                  <span>
                    {Math.ceil(
                      fullscreenBrickDodgerSlowTimeUi.remainingMs / 1000,
                    )}
                    s
                  </span>
                </div>
              ) : null}
              <div className="fullscreen-camera-brick-dodger-legend">
                <span>Bonus +{BRICK_DODGER_BONUS_SCORE}</span>
                <span>Skim hazards to build a near-miss multiplier</span>
                <span>Collect shields and slow-time pickups</span>
              </div>
              {isFullscreenBrickDodgerMode &&
              fullscreenBrickDodgerState?.message &&
              !fullscreenBrickDodgerStageRecapUi.visible &&
              !fullscreenBrickDodgerResultUi.visible ? (
                <div
                  className={`fullscreen-camera-brick-dodger-banner ${
                    fullscreenBrickDodgerState.status === "gameover" ? "game-over" : ""
                  }`}
                >
                  {fullscreenBrickDodgerState.message}
                </div>
              ) : null}
              {fullscreenBrickDodgerStageRecapUi.visible ? (
                <div className="fullscreen-camera-brick-dodger-recap">
                  <strong>{fullscreenBrickDodgerStageRecapUi.title}</strong>
                  <span>{fullscreenBrickDodgerStageRecapUi.subtitle}</span>
                  <div>
                    {fullscreenBrickDodgerStageRecapUi.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {fullscreenBrickDodgerResultUi.visible ? (
                <div className="fullscreen-camera-brick-dodger-recap game-over">
                  <strong>{fullscreenBrickDodgerResultUi.title}</strong>
                  <div>
                    {fullscreenBrickDodgerResultUi.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "breakout-coop" ? (
            <div
              className="fullscreen-camera-breakout fullscreen-camera-breakout-coop"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenBreakoutCoopState?.bricks
                ?.filter((brick) => !brick.destroyed)
                .map((brick) => (
                  <div
                    key={brick.id}
                    className={`fullscreen-camera-breakout-brick fullscreen-camera-breakout-coop-brick ${brick.kind === "prism" ? "prism" : ""}`}
                    style={{
                      left: `${brick.x}px`,
                      top: `${brick.y}px`,
                      width: `${brick.width}px`,
                      height: `${brick.height}px`,
                      background: brick.color,
                    }}
                  />
                ))}
              {fullscreenBreakoutCoopState?.shield?.activeMs > 0 ? (
                <div
                  className="fullscreen-camera-breakout-coop-shield"
                  style={{
                    left: `${fullscreenBreakoutCoopState.paddle.x - fullscreenBreakoutCoopState.layout.shieldWidth / 2}px`,
                    top: `${fullscreenBreakoutCoopState.layout.shieldY - fullscreenBreakoutCoopState.layout.shieldHeight / 2}px`,
                    width: `${fullscreenBreakoutCoopState.layout.shieldWidth}px`,
                    height: `${fullscreenBreakoutCoopState.layout.shieldHeight}px`,
                  }}
                />
              ) : null}
              {fullscreenBreakoutCoopState?.balls?.map((ball) => (
                <div
                  key={ball.id}
                  className="fullscreen-camera-breakout-ball fullscreen-camera-breakout-coop-ball"
                  style={{
                    left: `${ball.x - ball.radius}px`,
                    top: `${ball.y - ball.radius}px`,
                    width: `${ball.radius * 2}px`,
                    height: `${ball.radius * 2}px`,
                  }}
                />
              ))}
              {fullscreenBreakoutCoopState?.paddle && (
                <div
                  className="fullscreen-camera-breakout-paddle fullscreen-camera-breakout-coop-paddle"
                  style={{
                    left: `${fullscreenBreakoutCoopState.paddle.x - fullscreenBreakoutCoopState.layout.paddleWidth / 2}px`,
                    top: `${fullscreenBreakoutCoopState.layout.paddleY - fullscreenBreakoutCoopState.layout.paddleHeight / 2}px`,
                    width: `${fullscreenBreakoutCoopState.layout.paddleWidth}px`,
                    height: `${fullscreenBreakoutCoopState.layout.paddleHeight}px`,
                  }}
                />
              )}
              <div className="fullscreen-camera-breakout-scoreboard fullscreen-camera-breakout-coop-scoreboard">
                <span>Score {fullscreenBreakoutCoopState?.score ?? 0}</span>
                <span>Lives {fullscreenBreakoutCoopState?.lives ?? 0}</span>
                <span>
                  Bricks{" "}
                  {fullscreenBreakoutCoopState?.bricks?.filter((brick) => !brick.destroyed).length ?? 0}
                </span>
                <span>Balls {fullscreenBreakoutCoopState?.balls?.length ?? 0}</span>
                <span>
                  Shield {Math.round((fullscreenBreakoutCoopState?.shield?.meter ?? 0) * 100)}%
                </span>
              </div>
              <div className="fullscreen-camera-breakout-legend fullscreen-camera-breakout-coop-legend">
                <span>Standard +{BREAKOUT_COOP_BRICK_SCORE}</span>
                <span>Prism +{BREAKOUT_COOP_PRISM_BRICK_SCORE} + split ball</span>
                <span>Support-hand pinch: energy shield</span>
              </div>
              <div className="fullscreen-camera-breakout-coop-status">
                {fullscreenBreakoutCoopState?.message ?? ""}
              </div>
              <div className="fullscreen-camera-breakout-coop-meter">
                <div
                  className="fullscreen-camera-breakout-coop-meter-fill"
                  style={{
                    width: `${Math.round((fullscreenBreakoutCoopState?.shield?.meter ?? 0) * 100)}%`,
                  }}
                />
              </div>
              {isFullscreenBreakoutCoopMode &&
              fullscreenBreakoutCoopState.status === "countdown" &&
              fullscreenBreakoutCoopState.countdownMs > 0 ? (
                <div className="fullscreen-camera-breakout-countdown">
                  {Math.max(1, Math.ceil(fullscreenBreakoutCoopState.countdownMs / 1000))}
                </div>
              ) : null}
              {isFullscreenBreakoutCoopMode &&
              (fullscreenBreakoutCoopState.status === "cleared" ||
                fullscreenBreakoutCoopState.status === "gameover") ? (
                <div className="fullscreen-camera-breakout-banner">
                  {fullscreenBreakoutCoopState.status === "cleared"
                    ? "Wave clear"
                    : "Round over"}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "breakout" ||
            fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID ? (
            <div
              className={`fullscreen-camera-breakout ${
                fullscreenGridMode === FIND_YOUR_GRIND_BREAKOUT_MODE_ID
                  ? "find-your-grind"
                  : ""
              }`}
              style={fullscreenBreakoutViewport?.style ?? undefined}
            >
              {fullscreenBreakoutState?.bricks
                ?.filter((brick) => !brick.destroyed)
                .map((brick) => (
                  <div
                    key={brick.id}
                    className="fullscreen-camera-breakout-brick"
                    style={{
                      left: `${brick.x}px`,
                      top: `${brick.y}px`,
                      width: `${brick.width}px`,
                      height: `${brick.height}px`,
                      background: brick.color,
                    }}
                  />
                ))}
              {fullscreenBreakoutState?.capsules?.map((capsule) => (
                <div
                  key={capsule.id}
                  className="fullscreen-camera-breakout-capsule"
                  style={{
                    left: `${capsule.x - capsule.width / 2}px`,
                    top: `${capsule.y - capsule.height / 2}px`,
                    width: `${capsule.width}px`,
                    height: `${capsule.height}px`,
                  }}
                />
              ))}
              {fullscreenBreakoutState?.balls?.map((ball) => (
                <div
                  key={ball.id}
                  className="fullscreen-camera-breakout-ball"
                  style={{
                    left: `${ball.x - ball.radius}px`,
                    top: `${ball.y - ball.radius}px`,
                    width: `${ball.radius * 2}px`,
                    height: `${ball.radius * 2}px`,
                  }}
                />
              ))}
              {fullscreenBreakoutState?.paddle && (
                <div
                  className="fullscreen-camera-breakout-paddle"
                  style={{
                    left: `${fullscreenBreakoutState.paddle.x - fullscreenBreakoutState.layout.paddleWidth / 2}px`,
                    top: `${fullscreenBreakoutState.layout.paddleY - fullscreenBreakoutState.layout.paddleHeight / 2}px`,
                    width: `${fullscreenBreakoutState.layout.paddleWidth}px`,
                    height: `${fullscreenBreakoutState.layout.paddleHeight}px`,
                  }}
                />
              )}
              <div className="fullscreen-camera-breakout-scoreboard">
                <span>Score {fullscreenBreakoutState?.score ?? 0}</span>
                <span>Level {fullscreenBreakoutState?.level ?? 1}</span>
                <span>Lives {fullscreenBreakoutState?.lives ?? 0}</span>
                <span>
                  Bricks {fullscreenBreakoutState?.bricks?.filter((brick) => !brick.destroyed).length ?? 0}
                </span>
                <span>Balls {fullscreenBreakoutState?.balls?.length ?? 0}</span>
              </div>
              <div className="fullscreen-camera-breakout-legend">
                <span>Brick +{BREAKOUT_BRICK_SCORE}</span>
                <span>Capsule +{BREAKOUT_CAPSULE_SCORE}</span>
              </div>
              {isFullscreenBreakoutMode &&
              fullscreenBreakoutState.status === "countdown" &&
              fullscreenBreakoutState.countdownMs > 0 ? (
                <div className="fullscreen-camera-breakout-countdown">
                  {Math.max(1, Math.ceil(fullscreenBreakoutState.countdownMs / 1000))}
                </div>
              ) : null}
              {isFullscreenBreakoutMode && fullscreenBreakoutState.status === "cleared" ? (
                <div className="fullscreen-camera-breakout-banner">
                  Level cleared · Choose Next Level
                </div>
              ) : null}
              {isFullscreenBreakoutMode && fullscreenBreakoutState.status === "gameover" ? (
                <div className="fullscreen-camera-breakout-banner">
                  Game over · Score {fullscreenBreakoutState.score}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "finger-pong" ? (
            <div
              className="fullscreen-camera-finger-pong"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              <div className="fullscreen-camera-finger-pong-midline" />
              <div
                className="fullscreen-camera-finger-pong-paddle opponent"
                style={{
                  left: `${(fullscreenFingerPongState?.opponent?.x ?? 0) - (fullscreenFingerPongState?.layout?.opponentPaddleWidth ?? 0) / 2}px`,
                  top: `${(fullscreenFingerPongState?.layout?.opponentPaddleY ?? 0) - (fullscreenFingerPongState?.layout?.paddleHeight ?? 0) / 2}px`,
                  width: `${fullscreenFingerPongState?.layout?.opponentPaddleWidth ?? 0}px`,
                  height: `${fullscreenFingerPongState?.layout?.paddleHeight ?? 0}px`,
                }}
              />
              <div
                className="fullscreen-camera-finger-pong-paddle player"
                style={{
                  left: `${(fullscreenFingerPongState?.player?.x ?? 0) - (fullscreenFingerPongState?.layout?.paddleWidth ?? 0) / 2}px`,
                  top: `${(fullscreenFingerPongState?.layout?.playerPaddleY ?? 0) - (fullscreenFingerPongState?.layout?.paddleHeight ?? 0) / 2}px`,
                  width: `${fullscreenFingerPongState?.layout?.paddleWidth ?? 0}px`,
                  height: `${fullscreenFingerPongState?.layout?.paddleHeight ?? 0}px`,
                }}
              />
              <div
                className="fullscreen-camera-finger-pong-ball"
                style={{
                  left: `${(fullscreenFingerPongState?.ball?.x ?? 0) - (fullscreenFingerPongState?.ball?.radius ?? 0)}px`,
                  top: `${(fullscreenFingerPongState?.ball?.y ?? 0) - (fullscreenFingerPongState?.ball?.radius ?? 0)}px`,
                  width: `${(fullscreenFingerPongState?.ball?.radius ?? 0) * 2}px`,
                  height: `${(fullscreenFingerPongState?.ball?.radius ?? 0) * 2}px`,
                }}
              />
              <div className="fullscreen-camera-finger-pong-scoreboard">
                <span>You {fullscreenFingerPongMatchUi.playerScore}</span>
                <span>
                  Opponent {fullscreenFingerPongMatchUi.opponentScore}
                </span>
                <span>Rally {fullscreenFingerPongMatchUi.rallyCount}</span>
                <span>Best {fullscreenFingerPongMatchUi.bestRally}</span>
                {fullscreenFingerPongMatchUi.pressureLabel ? (
                  <strong className="pressure">
                    {fullscreenFingerPongMatchUi.pressureLabel}
                  </strong>
                ) : null}
              </div>
              <div className="fullscreen-camera-finger-pong-legend">
                <span>{fullscreenFingerPongMatchUi.serverLabel}</span>
                <span>Move sideways to steer</span>
                <span>Edge hits bend returns</span>
                <span>{fullscreenFingerPongMatchUi.rulesLabel}</span>
              </div>
              {isFullscreenFingerPongMode &&
              fullscreenFingerPongState?.status === "countdown" &&
              fullscreenFingerPongState.countdownMs > 0 ? (
                <div className="fullscreen-camera-finger-pong-banner countdown">
                  {Math.max(1, Math.ceil(fullscreenFingerPongState.countdownMs / 1000))}
                </div>
              ) : null}
              {isFullscreenFingerPongMode &&
              ["won", "lost"].includes(fullscreenFingerPongState?.status) ? (
                <div className="fullscreen-camera-finger-pong-banner">
                  {fullscreenFingerPongState.message}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "tic-tac-toe" ? (
            <div
              className="fullscreen-camera-tic-tac-toe"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              <div
                className="fullscreen-camera-tic-tac-toe-board"
                style={{
                  left: `${fullscreenTicTacToeLayout?.boardLeft ?? 0}px`,
                  top: `${fullscreenTicTacToeLayout?.boardTop ?? 0}px`,
                  width: `${fullscreenTicTacToeLayout?.boardSize ?? 0}px`,
                  height: `${fullscreenTicTacToeLayout?.boardSize ?? 0}px`,
                }}
              />
              <div
                className={`fullscreen-camera-tic-tac-toe-rail player ${
                  fullscreenTicTacToeTurnUi.playerRailState
                } ${fullscreenTicTacToeLayout?.layoutMode ?? "landscape-rails"} ${
                  fullscreenTicTacToeState?.draggingPiece ? "dragging" : ""
                }`}
                style={{
                  left: `${fullscreenTicTacToeLayout?.playerRailLeft ?? 0}px`,
                  top: `${fullscreenTicTacToeLayout?.playerRailTop ?? 0}px`,
                  width: `${fullscreenTicTacToeLayout?.playerRailWidth ?? 0}px`,
                  height: `${fullscreenTicTacToeLayout?.playerRailHeight ?? 0}px`,
                }}
              >
                {[-1, 0, 1].map((offset, index) => (
                  <div
                    key={`tic-tac-toe-player-stack-${index}`}
                    className="fullscreen-camera-tic-tac-toe-reserve-piece player"
                    style={{
                      left:
                        fullscreenTicTacToeLayout?.reserveAxis === "x"
                          ? `${(fullscreenTicTacToeLayout?.playerRailWidth ?? 0) / 2 + offset * (fullscreenTicTacToeLayout?.reserveStepX ?? 0)}px`
                          : "50%",
                      top:
                        fullscreenTicTacToeLayout?.reserveAxis === "x"
                          ? "50%"
                          : `${(fullscreenTicTacToeLayout?.playerRailHeight ?? 0) / 2 + offset * (fullscreenTicTacToeLayout?.reserveStepY ?? 0)}px`,
                      width: `${fullscreenTicTacToeLayout?.reservePieceSize ?? 0}px`,
                      height: `${fullscreenTicTacToeLayout?.reservePieceSize ?? 0}px`,
                      opacity:
                        fullscreenTicTacToePlayerReserveCount <= 0
                          ? 0.08
                          : offset === 0
                          ? 0.34
                          : 0.18,
                    }}
                  >
                    <span className="fullscreen-camera-tic-tac-toe-piece-label">
                      {TIC_TAC_TOE_PLAYER_MARK}
                    </span>
                  </div>
                ))}
                <div
                  className={`fullscreen-camera-tic-tac-toe-active-piece player ${
                    fullscreenTicTacToeState?.draggingPiece ? "hidden" : ""
                  }`}
                  style={{
                    width: `${fullscreenTicTacToeLayout?.activePieceSize ?? 0}px`,
                    height: `${fullscreenTicTacToeLayout?.activePieceSize ?? 0}px`,
                  }}
                >
                  <span className="fullscreen-camera-tic-tac-toe-piece-label">
                    {TIC_TAC_TOE_PLAYER_MARK}
                  </span>
                </div>
                <div className="fullscreen-camera-tic-tac-toe-rail-label">X Rail</div>
                <div className="fullscreen-camera-tic-tac-toe-rail-pips player" aria-hidden="true">
                  {fullscreenTicTacToePlayerReservePips.map((pip) => (
                    <span
                      key={`player-reserve-pip-${pip.index}`}
                      className={`fullscreen-camera-tic-tac-toe-rail-pip ${pip.className}`}
                    />
                  ))}
                </div>
                <div className="fullscreen-camera-tic-tac-toe-rail-count">
                  {fullscreenTicTacToePlayerReserveCount} left
                </div>
              </div>
              <div
                className={`fullscreen-camera-tic-tac-toe-rail ai ${
                  fullscreenTicTacToeTurnUi.aiRailState
                } ${fullscreenTicTacToeLayout?.layoutMode ?? "landscape-rails"} ${
                  fullscreenTicTacToeState?.status === "ai-turn" ? "thinking" : ""
                }`}
                style={{
                  left: `${fullscreenTicTacToeLayout?.aiRailLeft ?? 0}px`,
                  top: `${fullscreenTicTacToeLayout?.aiRailTop ?? 0}px`,
                  width: `${fullscreenTicTacToeLayout?.aiRailWidth ?? 0}px`,
                  height: `${fullscreenTicTacToeLayout?.aiRailHeight ?? 0}px`,
                }}
              >
                {[-1, 0, 1].map((offset, index) => (
                  <div
                    key={`tic-tac-toe-ai-stack-${index}`}
                    className="fullscreen-camera-tic-tac-toe-reserve-piece ai"
                    style={{
                      left:
                        fullscreenTicTacToeLayout?.reserveAxis === "x"
                          ? `${(fullscreenTicTacToeLayout?.aiRailWidth ?? 0) / 2 + offset * (fullscreenTicTacToeLayout?.reserveStepX ?? 0)}px`
                          : "50%",
                      top:
                        fullscreenTicTacToeLayout?.reserveAxis === "x"
                          ? "50%"
                          : `${(fullscreenTicTacToeLayout?.aiRailHeight ?? 0) / 2 + offset * (fullscreenTicTacToeLayout?.reserveStepY ?? 0)}px`,
                      width: `${fullscreenTicTacToeLayout?.reservePieceSize ?? 0}px`,
                      height: `${fullscreenTicTacToeLayout?.reservePieceSize ?? 0}px`,
                      opacity:
                        fullscreenTicTacToeAiReserveCount <= 0
                          ? 0.08
                          : offset === 0
                          ? 0.34
                          : 0.18,
                    }}
                  >
                    <span className="fullscreen-camera-tic-tac-toe-piece-label">
                      {TIC_TAC_TOE_AI_MARK}
                    </span>
                  </div>
                ))}
                <div
                  className={`fullscreen-camera-tic-tac-toe-active-piece ai ${
                    fullscreenTicTacToeState?.status === "ai-turn" ? "thinking" : ""
                  }`}
                  style={{
                    width: `${fullscreenTicTacToeLayout?.activePieceSize ?? 0}px`,
                    height: `${fullscreenTicTacToeLayout?.activePieceSize ?? 0}px`,
                  }}
                >
                  <span className="fullscreen-camera-tic-tac-toe-piece-label">
                    {TIC_TAC_TOE_AI_MARK}
                  </span>
                </div>
                <div className="fullscreen-camera-tic-tac-toe-rail-label">O Rail</div>
                <div className="fullscreen-camera-tic-tac-toe-rail-pips ai" aria-hidden="true">
                  {fullscreenTicTacToeAiReservePips.map((pip) => (
                    <span
                      key={`ai-reserve-pip-${pip.index}`}
                      className={`fullscreen-camera-tic-tac-toe-rail-pip ${pip.className}`}
                    />
                  ))}
                </div>
                <div className="fullscreen-camera-tic-tac-toe-rail-count">
                  {fullscreenTicTacToeAiReserveCount} left
                </div>
              </div>
              <div
                className={`fullscreen-camera-tic-tac-toe-reset-box ${
                  fullscreenTicTacToeResetUi.isDisabled ? "disabled" : ""
                } ${
                  fullscreenTicTacToeResetUi.isActive ? "active" : ""
                }`}
                style={{
                  left: `${fullscreenTicTacToeLayout?.resetBoxLeft ?? 0}px`,
                  top: `${fullscreenTicTacToeLayout?.resetBoxTop ?? 0}px`,
                  width: `${fullscreenTicTacToeLayout?.resetBoxWidth ?? 0}px`,
                  height: `${fullscreenTicTacToeLayout?.resetBoxHeight ?? 0}px`,
                  "--tic-tac-toe-reset-progress": fullscreenTicTacToeResetUi.progressDegrees,
                }}
              >
                <span
                  className="fullscreen-camera-tic-tac-toe-reset-progress"
                  aria-hidden="true"
                />
                <span className="fullscreen-camera-tic-tac-toe-reset-title">
                  {fullscreenTicTacToeResetUi.label}
                </span>
                <span className="fullscreen-camera-tic-tac-toe-reset-countdown">
                  {fullscreenTicTacToeResetUi.countdownText}
                </span>
                <span className="fullscreen-camera-tic-tac-toe-reset-hint">
                  {fullscreenTicTacToeResetUi.hint}
                </span>
              </div>
              {Array.from({ length: 9 }, (_, index) => {
                const cellRect = getTicTacToeCellRect(fullscreenTicTacToeLayout, index);
                const mark = fullscreenTicTacToeState?.board?.[index] ?? null;
                if (!cellRect) {
                  return null;
                }

                const cellUi = getTicTacToeCellUi(fullscreenTicTacToeState, index, {
                  draggingCellIndex: fullscreenTicTacToeDraggingCellIndex,
                });
                const markUi = mark
                  ? getTicTacToeMarkUi(fullscreenTicTacToeState, index, mark, {
                      playerMark: TIC_TAC_TOE_PLAYER_MARK,
                      aiMark: TIC_TAC_TOE_AI_MARK,
                    })
                  : null;
                const cellClassName = [
                  "fullscreen-camera-tic-tac-toe-cell",
                  ...cellUi.classNames,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={`tic-tac-toe-cell-${index}`}
                    className={cellClassName}
                    style={{
                      left: `${cellRect.left}px`,
                      top: `${cellRect.top}px`,
                      width: `${cellRect.width}px`,
                      height: `${cellRect.height}px`,
                    }}
                  >
                    {mark ? (
                      <span
                        className={`fullscreen-camera-tic-tac-toe-mark ${
                          markUi?.classNames.join(" ") ?? ""
                        }`}
                      >
                        {mark}
                      </span>
                    ) : null}
                    {cellUi.showPreviewMark ? (
                      <span className="fullscreen-camera-tic-tac-toe-mark player preview">
                        {TIC_TAC_TOE_PLAYER_MARK}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {fullscreenTicTacToeWinningLineUi ? (
                <div
                  className="fullscreen-camera-tic-tac-toe-winning-line"
                  style={{
                    left: `${fullscreenTicTacToeWinningLineUi.left}px`,
                    top: `${fullscreenTicTacToeWinningLineUi.top}px`,
                    width: `${fullscreenTicTacToeWinningLineUi.width}px`,
                    height: `${fullscreenTicTacToeWinningLineUi.thickness}px`,
                    transform: `translateY(-50%) rotate(${fullscreenTicTacToeWinningLineUi.angleDegrees}deg)`,
                  }}
                />
              ) : null}
              {fullscreenTicTacToeState?.draggingPiece ? (
                <div
                  className="fullscreen-camera-tic-tac-toe-drag-piece player"
                  style={{
                    left: `${fullscreenTicTacToeState.draggingPiece.x - fullscreenTicTacToeState.draggingPiece.size / 2}px`,
                    top: `${fullscreenTicTacToeState.draggingPiece.y - fullscreenTicTacToeState.draggingPiece.size / 2}px`,
                    width: `${fullscreenTicTacToeState.draggingPiece.size}px`,
                    height: `${fullscreenTicTacToeState.draggingPiece.size}px`,
                  }}
                >
                  <span className="fullscreen-camera-tic-tac-toe-piece-label">
                    {TIC_TAC_TOE_PLAYER_MARK}
                  </span>
                </div>
              ) : null}
              {fullscreenTicTacToeCursorUi.show && fullscreenTicTacToeCursorPoint ? (
                <div
                  className={`fullscreen-camera-tic-tac-toe-cursor-indicator ${fullscreenTicTacToeCursorUi.tone}`}
                  style={{
                    left: `${fullscreenTicTacToeCursorPoint.x}px`,
                    top: `${fullscreenTicTacToeCursorPoint.y}px`,
                  }}
                >
                  {fullscreenTicTacToeCursorUi.label}
                </div>
              ) : null}
              <div className="fullscreen-camera-tic-tac-toe-topbar">
                <div className="fullscreen-camera-tic-tac-toe-scoreboard">
                  {fullscreenTicTacToeHudUi.scoreItems.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                {fullscreenTicTacToeHudUi.statusMessage ? (
                  <div
                    className={`fullscreen-camera-tic-tac-toe-status ${fullscreenTicTacToeHudUi.statusTone}`}
                  >
                    {fullscreenTicTacToeHudUi.statusMessage}
                  </div>
                ) : null}
              </div>
              {fullscreenTicTacToeHudUi.showLegend ? (
                <div className="fullscreen-camera-tic-tac-toe-legend">
                  <span>Pinch to grab</span>
                  <span>Release to place</span>
                  <span>Random opening, optimal after</span>
                </div>
              ) : null}
              <div
                className={`fullscreen-camera-tic-tac-toe-turn-badge ${fullscreenTicTacToeTurnUi.tone}`}
              >
                <span className="fullscreen-camera-tic-tac-toe-turn-label">
                  {fullscreenTicTacToeTurnUi.label}
                </span>
                <span className="fullscreen-camera-tic-tac-toe-turn-detail">
                  {fullscreenTicTacToeTurnUi.detail}
                </span>
              </div>
            </div>
          ) : fullscreenGridMode === "hand-bounce" ? (
            <div
              className="fullscreen-camera-hand-bounce"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              <div className="fullscreen-camera-hand-bounce-backdrop" />
              {fullscreenHandBounceTargetUi.visible ? (
                <div
                  className="fullscreen-camera-hand-bounce-target"
                  role={fullscreenHandBounceTargetUi.role}
                  aria-label={fullscreenHandBounceTargetUi.ariaLabel}
                  style={{
                    left: `${fullscreenHandBounceTargetUi.x}px`,
                    top: `${fullscreenHandBounceTargetUi.y}px`,
                    width: `${fullscreenHandBounceTargetUi.width}px`,
                    height: `${fullscreenHandBounceTargetUi.height}px`,
                  }}
                >
                  <span>{fullscreenHandBounceTargetUi.label}</span>
                </div>
              ) : null}
              {fullscreenHandBounceState?.ball ? (
                <div
                  className="fullscreen-camera-hand-bounce-ball-shadow"
                  style={{
                    left: `${fullscreenHandBounceState.ball.x - fullscreenHandBounceState.ball.radius * (0.62 + Math.min(0.5, (fullscreenHandBounceState.ball.y / Math.max(1, fullscreenHandBounceState.layout.height)) * 0.45))}px`,
                    top: `${(fullscreenHandBounceState.layout.height ?? 0) - fullscreenHandBounceState.ball.radius * 0.46}px`,
                    width: `${fullscreenHandBounceState.ball.radius * 2 * (0.62 + Math.min(0.5, (fullscreenHandBounceState.ball.y / Math.max(1, fullscreenHandBounceState.layout.height)) * 0.45))}px`,
                    height: `${fullscreenHandBounceState.ball.radius * 0.6}px`,
                    opacity: Math.min(
                      0.5,
                      0.16 +
                        (fullscreenHandBounceState.ball.y /
                          Math.max(1, fullscreenHandBounceState.layout.height)) *
                          0.28,
                    ),
                  }}
                />
              ) : null}
              {fullscreenHandBounceState?.paddle ? (
                <div
                  className="fullscreen-camera-hand-bounce-paddle"
                  style={{
                    left: `${fullscreenHandBounceState.paddle.x - fullscreenHandBounceState.paddle.width / 2}px`,
                    top: `${fullscreenHandBounceState.paddle.y - fullscreenHandBounceState.paddle.height / 2}px`,
                    width: `${fullscreenHandBounceState.paddle.width}px`,
                    height: `${fullscreenHandBounceState.paddle.height}px`,
                  }}
                />
              ) : null}
              {fullscreenHandBounceState?.ball ? (
                <div
                  className="fullscreen-camera-hand-bounce-ball"
                  style={{
                    left: `${fullscreenHandBounceState.ball.x - fullscreenHandBounceState.ball.radius}px`,
                    top: `${fullscreenHandBounceState.ball.y - fullscreenHandBounceState.ball.radius}px`,
                    width: `${fullscreenHandBounceState.ball.radius * 2}px`,
                    height: `${fullscreenHandBounceState.ball.radius * 2}px`,
                    transform: `rotate(${Math.atan2(
                      fullscreenHandBounceState.ball.vy ?? 0,
                      fullscreenHandBounceState.ball.vx ?? 0,
                    )}rad)`,
                  }}
                />
              ) : null}
              <section
                className={`fullscreen-camera-hand-bounce-stage ${
                  fullscreenHandBounceStageUi.urgent ? "urgent" : ""
                }`}
                aria-label={`Stage ${fullscreenHandBounceStageUi.stage}: ${fullscreenHandBounceStageUi.name}`}
              >
                <div className="fullscreen-camera-hand-bounce-stage-heading">
                  <span>
                    Stage {fullscreenHandBounceStageUi.stage}/
                    {fullscreenHandBounceStageUi.totalStages}
                  </span>
                  <strong>{fullscreenHandBounceStageUi.name}</strong>
                  <time>{fullscreenHandBounceStageUi.timeLabel}</time>
                </div>
                <p>{fullscreenHandBounceStageUi.goalText}</p>
                <div className="fullscreen-camera-hand-bounce-goals">
                  {fullscreenHandBounceStageUi.goals.map((goal) => (
                    <span className={goal.complete ? "complete" : ""} key={goal.id}>
                      {goal.label} {goal.text}
                    </span>
                  ))}
                </div>
                <div
                  className="fullscreen-camera-hand-bounce-stage-progress"
                  role="progressbar"
                  aria-label={`${fullscreenHandBounceStageUi.name} goal progress`}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(
                    fullscreenHandBounceStageUi.completionRatio * 100,
                  )}
                >
                  <span
                    style={{
                      width: `${fullscreenHandBounceStageUi.completionRatio * 100}%`,
                    }}
                  />
                </div>
              </section>
              <div
                className="fullscreen-camera-hand-bounce-scoreboard"
                aria-label={fullscreenHandBounceHudUi.ariaLabel}
              >
                {fullscreenHandBounceHudUi.items.map((hudItem) => (
                  <span key={hudItem.id}>
                    <small>{hudItem.label}</small>
                    <strong>{hudItem.value}</strong>
                  </span>
                ))}
              </div>
              <div
                className={`fullscreen-camera-hand-bounce-power ${
                  fullscreenHandBouncePowerUi.active ? "active" : ""
                }`}
                aria-label={fullscreenHandBouncePowerUi.ariaLabel}
              >
                <div>
                  <strong>{fullscreenHandBouncePowerUi.label}</strong>
                  <span>{fullscreenHandBouncePowerUi.detail}</span>
                </div>
                <div className="fullscreen-camera-hand-bounce-power-track">
                  <span
                    style={{
                      width: `${fullscreenHandBouncePowerUi.progress * 100}%`,
                    }}
                  />
                </div>
              </div>
              {(fullscreenHandBounceState?.stage ?? 1) === 1 &&
              (fullscreenHandBounceState?.saveCount ?? 0) < 2 ? (
                <div
                  className="fullscreen-camera-hand-bounce-legend"
                  aria-label={fullscreenHandBounceLegendUi.ariaLabel}
                >
                  {fullscreenHandBounceLegendUi.items.map((legendItem) => (
                    <span key={legendItem.id}>
                      <strong>{legendItem.label}</strong>
                      {legendItem.detail}
                    </span>
                  ))}
                </div>
              ) : null}
              {fullscreenHandBounceCheckpointUi.visible ? (
                <div
                  className="fullscreen-camera-hand-bounce-checkpoint"
                  role={fullscreenHandBounceCheckpointUi.liveRole}
                >
                  <strong>{fullscreenHandBounceCheckpointUi.title}</strong>
                  <div>
                    {fullscreenHandBounceCheckpointUi.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} <b>{stat.value}</b>
                      </span>
                    ))}
                  </div>
                  <small>{fullscreenHandBounceCheckpointUi.nextStageText}</small>
                </div>
              ) : null}
              {fullscreenHandBounceResultUi.visible ? (
                <div className="fullscreen-camera-hand-bounce-result" role="status">
                  <strong>{fullscreenHandBounceResultUi.title}</strong>
                  <p>{fullscreenHandBounceResultUi.summary}</p>
                  {fullscreenHandBounceResultUi.newPersonalBest ? (
                    <span className="personal-best">New personal best</span>
                  ) : null}
                  <div>
                    {fullscreenHandBounceResultUi.stats.map((stat) => (
                      <span key={stat.label}>
                        <small>{stat.label}</small>
                        <b>{stat.value}</b>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {fullscreenHandBounceState?.message ? (
                <div
                  className={`fullscreen-camera-hand-bounce-banner ${
                    fullscreenHandBounceState.status === "gameover" ? "game-over" : ""
                  }`}
                  aria-live="polite"
                >
                  {fullscreenHandBounceState.message}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "fruit-ninja" ? (
            <div
              className={getFruitNinjaSceneClassName(fullscreenFruitNinjaState)}
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              <div className="fullscreen-camera-fruit-blade-trail">
                {fullscreenFruitNinjaState?.bladeTrail?.map((point, index, trail) => {
                  const previous = trail[index - 1];
                  if (!previous) {
                    return null;
                  }
                  const dx = point.x - previous.x;
                  const dy = point.y - previous.y;
                  const length = Math.hypot(dx, dy);
                  if (length < 2) {
                    return null;
                  }
                  const age = Math.max(0, performance.now() - point.timestamp);
                  const opacity = Math.max(0, 1 - age / FRUIT_NINJA_BLADE_TRAIL_MS);
                  return (
                    <div
                      key={`blade-trail-${point.timestamp}-${index}`}
                      className="fullscreen-camera-fruit-blade-segment"
                      style={{
                        left: `${previous.x}px`,
                        top: `${previous.y}px`,
                        width: `${length}px`,
                        transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
                        opacity,
                      }}
                    />
                  );
                })}
              </div>
              {fullscreenFruitNinjaState?.splitPieces?.map((piece) =>
                renderFullscreenFruitSplitPiece(piece),
              )}
              {fullscreenFruitNinjaState?.targets?.map((target) =>
                renderFullscreenFruitTarget(target),
              )}
              {fullscreenFruitNinjaBombWarnings.map((warning) => (
                <div
                  aria-label={`${warning.label}${
                    warning.secondsUntilArmed
                      ? ` in ${warning.secondsUntilArmed} seconds`
                      : ""
                  }`}
                  className={warning.className}
                  key={`bomb-warning-${warning.id}`}
                  role="status"
                  style={{ left: `${warning.x}px` }}
                >
                  <span aria-hidden="true">!</span>
                </div>
              ))}
              {fullscreenFruitNinjaState?.particles?.map((particle) => (
                <div
                  key={particle.id}
                  className={`fullscreen-camera-fruit-particle ${particle.kind}`}
                  style={{
                    left: `${particle.x - particle.radius}px`,
                    top: `${particle.y - particle.radius}px`,
                    width: `${particle.radius * 2}px`,
                    height: `${particle.radius * 2}px`,
                    background: particle.fill,
                    opacity: Math.max(0, 1 - particle.ageMs / particle.ttlMs),
                  }}
                />
              ))}
              {fullscreenFruitNinjaState?.popups?.map((popup) => (
                <div
                  key={popup.id}
                  className={`fullscreen-camera-fruit-popup ${popup.kind}`}
                  style={{
                    left: `${popup.x}px`,
                    top: `${popup.y}px`,
                    opacity: Math.max(0, 1 - popup.ageMs / popup.ttlMs),
                  }}
                >
                  {popup.text}
                </div>
              ))}
              <div className="fullscreen-camera-fruit-scoreboard">
                {fullscreenFruitNinjaHudUi.items.map((item) => (
                  <span className={item.id} key={item.id}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <div className="fullscreen-camera-fruit-legend">
                {fullscreenFruitNinjaLegendItems.map((item) => (
                  <span className={item.id} key={item.id}>
                    {item.label}
                  </span>
                ))}
              </div>
              <div
                aria-label={`Round progress ${Math.round(
                  fullscreenFruitNinjaRoundUi.progress * 100,
                )}%`}
                className={`fullscreen-camera-fruit-round-meter ${fullscreenFruitNinjaRoundUi.urgency}`}
                role="progressbar"
                aria-valuemax="100"
                aria-valuemin="0"
                aria-valuenow={Math.round(
                  fullscreenFruitNinjaRoundUi.progress * 100,
                )}
              >
                <span
                  style={{
                    "--fruit-round-progress":
                      fullscreenFruitNinjaRoundUi.progress,
                  }}
                />
              </div>
              <div className="fullscreen-camera-fruit-powers">
                <span
                  className={`fever ${
                    fullscreenFruitNinjaPowerUi.fever.active ? "active" : ""
                  }`}
                  style={{
                    "--fruit-power-progress":
                      fullscreenFruitNinjaPowerUi.fever.active
                        ? fullscreenFruitNinjaPowerUi.fever.remaining
                        : fullscreenFruitNinjaPowerUi.fever.charge,
                  }}
                >
                  {fullscreenFruitNinjaPowerUi.fever.label}
                </span>
                <span
                  className={`slow-time ${
                    fullscreenFruitNinjaPowerUi.slowTime.active ? "active" : ""
                  }`}
                  style={{
                    "--fruit-power-progress":
                      fullscreenFruitNinjaPowerUi.slowTime.remaining,
                  }}
                >
                  {fullscreenFruitNinjaPowerUi.slowTime.label}
                </span>
                <span className="shields">
                  {fullscreenFruitNinjaPowerUi.shields.charges.map(
                    (charged, index) => (
                      <i
                        aria-hidden="true"
                        className={charged ? "charged" : ""}
                        key={`fruit-shield-${index}`}
                      />
                    ),
                  )}
                  <span className="sr-only">
                    {fullscreenFruitNinjaPowerUi.shields.label}
                  </span>
                </span>
              </div>
              {fullscreenFruitNinjaComboUi.active ? (
                <div
                  className={`fullscreen-camera-fruit-combo ${fullscreenFruitNinjaComboUi.tier}`}
                  style={{
                    "--fruit-combo-window":
                      fullscreenFruitNinjaComboUi.windowProgress,
                  }}
                >
                  <strong>{fullscreenFruitNinjaComboUi.label}</strong>
                  <small>Best {fullscreenFruitNinjaComboUi.bestCombo}</small>
                </div>
              ) : null}
              {fullscreenFruitNinjaPrecisionUi.visible ? (
                <div className={fullscreenFruitNinjaPrecisionUi.className}>
                  <strong>{fullscreenFruitNinjaPrecisionUi.label}</strong>
                  {fullscreenFruitNinjaPrecisionUi.bonus > 0 ? (
                    <span>+{fullscreenFruitNinjaPrecisionUi.bonus}</span>
                  ) : null}
                </div>
              ) : null}
              {fullscreenFruitNinjaRoundUi.announcementVisible ? (
                <div
                  aria-live="polite"
                  className="fullscreen-camera-fruit-wave-banner"
                  role="status"
                >
                  {fullscreenFruitNinjaRoundUi.announcement}
                </div>
              ) : (
                <div className="fullscreen-camera-fruit-banner">
                  {fullscreenFruitNinjaState?.message}
                </div>
              )}
              {isFullscreenFruitNinjaMode &&
              fullscreenFruitNinjaRecapUi.visible ? (
                <div className="fullscreen-camera-fruit-gameover">
                  <span>{fullscreenFruitNinjaRecapUi.title}</span>
                  <strong>{fullscreenFruitNinjaRecapUi.score}</strong>
                  <em>Grade {fullscreenFruitNinjaRecapUi.grade}</em>
                  <div>
                    {fullscreenFruitNinjaRecapUi.stats.map((stat) => (
                      <small key={stat.id}>
                        {stat.label} <b>{stat.value}</b>
                      </small>
                    ))}
                  </div>
                  {fullscreenFruitNinjaRecapUi.medals.length ? (
                    <p>
                      {fullscreenFruitNinjaRecapUi.medals
                        .map((medal) => medal.label)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <small>{fullscreenFruitNinjaRecapUi.restartText}</small>
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "sky-patrol" ? (
            <div
              className="fullscreen-camera-sky-patrol"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              <canvas
                ref={fullscreenSkyPatrolCanvasRef}
                className="fullscreen-camera-sky-patrol-canvas"
              />
              {fullscreenSkyPatrolHud?.incomingIndicators?.map((indicator) => (
                <div
                  key={indicator.id}
                  className={`fullscreen-camera-sky-patrol-incoming-indicator ${indicator.kind}`}
                  style={{ left: `${indicator.x}px` }}
                >
                  <span />
                </div>
              ))}
              <div className="fullscreen-camera-sky-patrol-scoreboard">
                {fullscreenSkyPatrolHudItems.map((item) => (
                  <span key={item.id} className={`fullscreen-camera-sky-patrol-hud-chip ${item.id}`}>
                    {item.id === "fire" ? (
                      <span
                        className={`fullscreen-camera-sky-patrol-fire-ring ${
                          fullscreenSkyPatrolFireCooldownUi.ready ? "ready" : "reloading"
                        }`}
                        style={{
                          "--sky-patrol-fire-progress": fullscreenSkyPatrolFireCooldownUi.progress,
                        }}
                      />
                    ) : null}
                    <span className="fullscreen-camera-sky-patrol-hud-label">{item.label}</span>
                    {item.id === "lives" ? (
                      <span className="fullscreen-camera-sky-patrol-life-icons">
                        {fullscreenSkyPatrolLifeIcons.map((iconState, index) => (
                          <span
                            key={`sky-patrol-life-${index}`}
                            className={`fullscreen-camera-sky-patrol-life-icon ${iconState}`}
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="fullscreen-camera-sky-patrol-hud-value">{item.value}</span>
                    )}
                  </span>
                ))}
              </div>
              <div
                className={`fullscreen-camera-sky-patrol-mission ${fullscreenSkyPatrolMissionUi.phase}`}
              >
                <span>
                  Mission {fullscreenSkyPatrolMissionUi.mission}/
                  {fullscreenSkyPatrolMissionUi.totalMissions}
                </span>
                <strong>{fullscreenSkyPatrolMissionUi.name}</strong>
                <small>{fullscreenSkyPatrolMissionUi.goalText}</small>
                <span
                  aria-label={`${fullscreenSkyPatrolMissionUi.progress} of ${fullscreenSkyPatrolMissionUi.goal}`}
                  className="fullscreen-camera-sky-patrol-mission-track"
                  role="progressbar"
                  aria-valuemax={fullscreenSkyPatrolMissionUi.goal || 1}
                  aria-valuemin="0"
                  aria-valuenow={fullscreenSkyPatrolMissionUi.progress}
                >
                  <i
                    style={{
                      "--sky-mission-progress":
                        fullscreenSkyPatrolMissionUi.progressRatio,
                    }}
                  />
                </span>
              </div>
              {fullscreenSkyPatrolComboUi.visible ? (
                <div className="fullscreen-camera-sky-patrol-combo">
                  <strong>{fullscreenSkyPatrolComboUi.label}</strong>
                  <span>{fullscreenSkyPatrolComboUi.multiplier}x score</span>
                </div>
              ) : null}
              <div
                aria-label="Sky Patrol power status"
                className="fullscreen-camera-sky-patrol-powers"
              >
                <span
                  className={
                    (fullscreenSkyPatrolHud?.shieldCharges ?? 0) > 0
                      ? "ready"
                      : ""
                  }
                >
                  Shield {fullscreenSkyPatrolHud?.shieldCharges ?? 0}
                </span>
                <span
                  className={
                    (fullscreenSkyPatrolHud?.wingmanActiveMs ?? 0) > 0
                      ? "active"
                      : (fullscreenSkyPatrolHud?.wingmanCharges ?? 0) > 0
                        ? "ready"
                        : ""
                  }
                >
                  {(fullscreenSkyPatrolHud?.wingmanActiveMs ?? 0) > 0
                    ? "Wingmen active"
                    : `Wingmen ${fullscreenSkyPatrolHud?.wingmanCharges ?? 0}`}
                </span>
              </div>
              <div
                className={`fullscreen-camera-sky-patrol-gun-meter ${fullscreenSkyPatrolGunCooldownUi.state}`}
                style={{
                  "--sky-patrol-gun-fill": fullscreenSkyPatrolGunCooldownUi.fill,
                }}
              >
                <span className="fullscreen-camera-sky-patrol-gun-meter-label">Guns</span>
                <span className="fullscreen-camera-sky-patrol-gun-meter-track">
                  <span className="fullscreen-camera-sky-patrol-gun-meter-fill" />
                </span>
                <span className="fullscreen-camera-sky-patrol-gun-meter-state">
                  {fullscreenSkyPatrolGunCooldownUi.stateLabel}
                </span>
                {fullscreenSkyPatrolGunCooldownUi.cooldownLabel ? (
                  <span className="fullscreen-camera-sky-patrol-gun-meter-timer">
                    {fullscreenSkyPatrolGunCooldownUi.cooldownLabel}
                  </span>
                ) : null}
              </div>
              {fullscreenSkyPatrolHud?.radarBlips?.length ? (
                <div className="fullscreen-camera-sky-patrol-radar" aria-hidden="true">
                  <span className="fullscreen-camera-sky-patrol-radar-sweep" />
                  {fullscreenSkyPatrolHud.radarBlips.map((blip) => (
                    <span
                      key={blip.id}
                      className={`fullscreen-camera-sky-patrol-radar-blip ${blip.role}`}
                      style={{
                        left: `${blip.xPct}%`,
                        top: `${blip.yPct}%`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {fullscreenSkyPatrolLegendUi.visible ? (
                <div
                  className={`fullscreen-camera-sky-patrol-legend ${
                    fullscreenSkyPatrolLegendUi.compact ? "compact" : ""
                  } ${fullscreenSkyPatrolLegendUi.faded ? "faded" : ""}`}
                >
                  {fullscreenSkyPatrolLegendUi.items.map((item) => (
                    <span
                      key={item.id}
                      className={`fullscreen-camera-sky-patrol-legend-chip ${item.role}`}
                    >
                      <span className="fullscreen-camera-sky-patrol-legend-symbol" />
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </span>
                  ))}
                </div>
              ) : null}
              {fullscreenSkyPatrolGameOverUi.visible ? (
                <div className="fullscreen-camera-sky-patrol-banner game-over">
                  <span className="fullscreen-camera-sky-patrol-game-over-title">
                    {fullscreenSkyPatrolGameOverUi.title}
                  </span>
                  <span className="fullscreen-camera-sky-patrol-game-over-stats">
                    {fullscreenSkyPatrolGameOverUi.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </span>
                  <span className="fullscreen-camera-sky-patrol-game-over-restart">
                    {fullscreenSkyPatrolGameOverUi.restartText}
                  </span>
                </div>
              ) : fullscreenSkyPatrolCheckpointUi.visible ? (
                <div
                  aria-live="polite"
                  className="fullscreen-camera-sky-patrol-banner checkpoint"
                  role="status"
                >
                  <span className="fullscreen-camera-sky-patrol-start-title">
                    {fullscreenSkyPatrolCheckpointUi.title}
                  </span>
                  <span className="fullscreen-camera-sky-patrol-checkpoint-stats">
                    {fullscreenSkyPatrolCheckpointUi.stats.map((stat) => (
                      <small key={stat.label}>
                        {stat.label} <strong>{stat.value}</strong>
                      </small>
                    ))}
                  </span>
                  <span>{fullscreenSkyPatrolCheckpointUi.nextMissionText}</span>
                </div>
              ) : fullscreenSkyPatrolOnboardingUi.visible ||
                fullscreenSkyPatrolStartPromptUi.visible ? (
                <div className="fullscreen-camera-sky-patrol-banner start-prompt">
                  <span className="fullscreen-camera-sky-patrol-start-title">
                    {fullscreenSkyPatrolOnboardingUi.visible
                      ? fullscreenSkyPatrolOnboardingUi.title
                      : fullscreenSkyPatrolStartPromptUi.title}
                  </span>
                  <span className="fullscreen-camera-sky-patrol-start-detail">
                    {fullscreenSkyPatrolOnboardingUi.visible
                      ? fullscreenSkyPatrolOnboardingUi.objective
                      : fullscreenSkyPatrolStartPromptUi.detail}
                  </span>
                  {fullscreenSkyPatrolOnboardingUi.safetyLabel ? (
                    <small>{fullscreenSkyPatrolOnboardingUi.safetyLabel}</small>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === WFC_WORLD_MODE_ID ? (
            <Suspense
              fallback={
                <LazyExperienceFallback label="Building World Painter…" />
              }
            >
              <>
                <WfcWorldRenderer
                  game={fullscreenWfcWorldState}
                  style={fullscreenCameraViewport?.style ?? undefined}
                  onMouseDown={handleFullscreenWfcWorldMouseDown}
                  onMouseMove={handleFullscreenWfcWorldMouseMove}
                  onMouseUp={stopFullscreenWfcWorldMouseInput}
                  onMouseLeave={stopFullscreenWfcWorldMouseInput}
                  onSelectTile={handleFullscreenWfcWorldSelectTile}
                  onGenerate={handleFullscreenWfcWorldGenerate}
                  onClear={handleFullscreenWfcWorldClear}
                />
                <div
                  className={`fullscreen-camera-wfc-project-dock ${
                    fullscreenWfcProjectOpen ? "open" : ""
                  }`}
                  style={fullscreenCameraViewport?.style ?? undefined}
                >
                  <button
                    aria-expanded={fullscreenWfcProjectOpen}
                    className="fullscreen-camera-wfc-project-trigger"
                    onClick={() =>
                      setFullscreenWfcProjectOpen((current) => !current)
                    }
                    type="button"
                  >
                    <span>
                      {fullscreenWfcProjectOpen ? "Close project" : "World project"}
                    </span>
                    <strong>
                      {fullscreenWfcWorldGoalUi.progress.overallPercent}%
                    </strong>
                  </button>
                  {fullscreenWfcProjectOpen ? (
                    <div
                      aria-label="Fingerprint Worlds project tools"
                      className="fullscreen-camera-wfc-project-surface"
                      role="dialog"
                    >
                      <Suspense
                        fallback={
                          <LazyExperienceFallback label="Opening project library…" />
                        }
                      >
                        <WfcWorldProjectPanel
                          game={fullscreenWfcWorldState}
                          onDelete={handleFullscreenWfcWorldDelete}
                          onRestore={handleFullscreenWfcWorldRestore}
                          onSave={handleFullscreenWfcWorldSave}
                        />
                      </Suspense>
                    </div>
                  ) : null}
                </div>
              </>
            </Suspense>
          ) : fullscreenGridMode === "invaders" ? (
            <div
              className="fullscreen-camera-invaders"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenInvadersState?.enemies
                ?.filter((enemy) => enemy.alive)
                .map((enemy) => (
                  <div
                    key={enemy.id}
                    className="fullscreen-camera-invaders-enemy"
                    style={{
                      left: `${enemy.x}px`,
                      top: `${enemy.y}px`,
                      width: `${enemy.width}px`,
                      height: `${enemy.height}px`,
                    }}
                  />
                ))}
              {fullscreenInvadersState?.playerShots?.map((shot) => (
                <div
                  key={shot.id}
                  className="fullscreen-camera-invaders-shot player"
                  style={{
                    left: `${shot.x}px`,
                    top: `${shot.y}px`,
                    width: `${shot.width}px`,
                    height: `${shot.height}px`,
                  }}
                />
              ))}
              {fullscreenInvadersState?.enemyShots?.map((shot) => (
                <div
                  key={shot.id}
                  className="fullscreen-camera-invaders-shot enemy"
                  style={{
                    left: `${shot.x}px`,
                    top: `${shot.y}px`,
                    width: `${shot.width}px`,
                    height: `${shot.height}px`,
                  }}
                />
              ))}
              {fullscreenInvadersState?.shields?.map((shield) => (
                <div
                  aria-hidden="true"
                  className="fullscreen-camera-invaders-shield"
                  key={shield.id}
                  style={{
                    "--shield-health": Math.max(
                      0,
                      Math.min(1, shield.hp / Math.max(1, shield.maxHp)),
                    ),
                    left: `${shield.x}px`,
                    top: `${shield.y}px`,
                    width: `${shield.width}px`,
                    height: `${shield.height}px`,
                  }}
                />
              ))}
              {fullscreenInvadersState?.ufo ? (
                <div
                  aria-hidden="true"
                  className="fullscreen-camera-invaders-ufo"
                  style={{
                    left: `${fullscreenInvadersState.ufo.x}px`,
                    top: `${fullscreenInvadersState.ufo.y}px`,
                    width: `${fullscreenInvadersState.ufo.width}px`,
                    height: `${fullscreenInvadersState.ufo.height}px`,
                  }}
                />
              ) : null}
              {fullscreenInvadersState?.powerUps?.map((powerUp) => (
                <div
                  aria-label={
                    powerUp.type === "shield-repair"
                      ? "Falling shield repair"
                      : "Falling rapid-fire power-up"
                  }
                  className={`fullscreen-camera-invaders-power-up ${powerUp.type}`}
                  key={powerUp.id}
                  style={{
                    left: `${powerUp.x}px`,
                    top: `${powerUp.y}px`,
                    width: `${powerUp.width}px`,
                    height: `${powerUp.height}px`,
                  }}
                >
                  {powerUp.type === "shield-repair" ? "＋" : "⚡"}
                </div>
              ))}
              {fullscreenInvadersState?.ship && (
                <div
                  className={`fullscreen-camera-invaders-ship ${
                    (fullscreenInvadersState.shipInvulnerableMs ?? 0) > 0
                      ? "invulnerable"
                      : ""
                  }`}
                  style={{
                    left: `${fullscreenInvadersState.ship.x - fullscreenInvadersState.ship.width / 2}px`,
                    top: `${fullscreenInvadersState.ship.y - fullscreenInvadersState.ship.height / 2}px`,
                    width: `${fullscreenInvadersState.ship.width}px`,
                    height: `${fullscreenInvadersState.ship.height}px`,
                  }}
                />
              )}
              <div className="fullscreen-camera-invaders-scoreboard">
                <span>Score {fullscreenInvadersState?.score ?? 0}</span>
                <span>Wave {fullscreenInvadersState?.wave ?? 1}</span>
                <span>Lives {fullscreenInvadersState?.lives ?? 0}</span>
                <span>
                  Enemies {fullscreenInvadersState?.enemies?.filter((enemy) => enemy.alive).length ?? 0}
                </span>
                <span>{fullscreenInvadersState?.formation?.name ?? "Classic Formation"}</span>
              </div>
              <div className="fullscreen-camera-invaders-legend">
                <span>Enemy +{SPACE_INVADERS_ENEMY_SCORE}</span>
                <span>Pinch fires · Shields absorb shots</span>
                {fullscreenInvadersState?.activePowerUp ? (
                  <span>Rapid fire active</span>
                ) : (
                  <span>Hit the UFO for a power-up</span>
                )}
              </div>
              {isFullscreenInvadersMode &&
              shouldShowFullscreenInvadersBanner(fullscreenInvadersState) ? (
                <div className="fullscreen-camera-invaders-banner">
                  {fullscreenInvadersState.message}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "flappy" ? (
            <div
              className="fullscreen-camera-flappy"
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              {fullscreenFlappyState?.pipes?.map((pipe) => (
                <div key={pipe.id}>
                  <div
                    className="fullscreen-camera-flappy-pipe"
                    style={{
                      left: `${pipe.x}px`,
                      top: "0px",
                      width: `${pipe.width}px`,
                      height: `${pipe.gapTop}px`,
                    }}
                  />
                  <div
                    className="fullscreen-camera-flappy-pipe"
                    style={{
                      left: `${pipe.x}px`,
                      top: `${pipe.gapTop + pipe.gapHeight}px`,
                      width: `${pipe.width}px`,
                      height: `${Math.max(
                        0,
                        (fullscreenFlappyState?.layout?.playfieldHeight ?? 0) -
                          (pipe.gapTop + pipe.gapHeight),
                      )}px`,
                    }}
                  />
                </div>
              ))}
              <div
                className={`fullscreen-camera-flappy-bird ${
                  fullscreenFlappyState?.inputFeedback?.active ? "pinch-pulse" : ""
                }`}
                key={`flappy-bird-${fullscreenFlappyState?.inputFeedback?.pulse ?? 0}`}
                style={{
                  left: `${(fullscreenFlappyState?.bird?.x ?? 0) - (fullscreenFlappyState?.bird?.radius ?? 0)}px`,
                  top: `${(fullscreenFlappyState?.bird?.y ?? 0) - (fullscreenFlappyState?.bird?.radius ?? 0)}px`,
                  width: `${(fullscreenFlappyState?.bird?.radius ?? 0) * 2}px`,
                  height: `${(fullscreenFlappyState?.bird?.radius ?? 0) * 2}px`,
                  transform: `rotate(${fullscreenFlappyState?.bird?.rotation ?? 0}deg)`,
                }}
              />
              <div
                className="fullscreen-camera-flappy-ground"
                style={{ height: `${fullscreenFlappyState?.layout?.groundHeight ?? 0}px` }}
              />
              <div className="fullscreen-camera-flappy-scoreboard">
                <span>Gates {fullscreenFlappyState?.score ?? 0}</span>
                <span>Level {fullscreenFlappyState?.difficulty?.level ?? 1}</span>
                <span>
                  Center streak {fullscreenFlappyState?.stats?.centerStreak ?? 0}
                </span>
                {fullscreenFlappyState?.challenge?.mode === "daily" ? (
                  <span>Daily {fullscreenFlappyState.challenge.dayKey}</span>
                ) : null}
              </div>
              <div className="fullscreen-camera-flappy-legend">
                <span>Pinch = flap</span>
                <span>Center the gap for a bonus</span>
              </div>
              {isFullscreenFlappyMode && fullscreenFlappyState?.message ? (
                <div className="fullscreen-camera-flappy-banner">
                  {fullscreenFlappyState.message}
                </div>
              ) : null}
            </div>
          ) : fullscreenGridMode === "missile-command" ? (
            <div
              className={getMissileCommandSceneClassName()}
              style={fullscreenCameraViewport?.style ?? undefined}
            >
              <div className="fullscreen-camera-missile-skyline" />
              <div
                className="fullscreen-camera-missile-ground"
                style={{ top: `${fullscreenMissileCommandState?.layout.groundY ?? 0}px` }}
              />
              {fullscreenMissileTargetWarnings.map((warning) => (
                <div
                  key={`missile-target-warning-${warning.structureId}`}
                  className={warning.className}
                  style={{
                    left: `${warning.x}px`,
                    top: `${warning.y}px`,
                    width: `${warning.width * 1.62}px`,
                    height: `${warning.height * 1.62}px`,
                  }}
                >
                  {warning.threatCount > 1 ? (
                    <span className="fullscreen-camera-missile-target-warning-count">
                      {warning.threatCount}
                    </span>
                  ) : null}
                </div>
              ))}
              {fullscreenMissileCommandState?.structures?.map((structure) => {
                const structureUi = getMissileCommandStructureUi(structure, {
                  selectedLaunchBaseId: fullscreenMissileLaunchPreview?.originStructureId,
                });
                return (
                  <div
                    key={structure.id}
                    className={structureUi.className}
                    style={{
                      left: `${structure.x - structure.width / 2}px`,
                      top: `${structure.y - structure.height}px`,
                      width: `${structure.width}px`,
                      height: `${structure.height}px`,
                    }}
                  >
                    {structureUi.showSmoke ? (
                      <span className="fullscreen-camera-missile-structure-smoke" />
                    ) : null}
                    {structureUi.fragments.map((fragment) => (
                      <span
                        key={fragment.id}
                        className={`fullscreen-camera-missile-rubble-fragment ${fragment.className}`}
                      />
                    ))}
                  </div>
                );
              })}
              {fullscreenMissileLaunchPreview ? (
                <div
                  className="fullscreen-camera-missile-launch-preview"
                  style={{
                    left: `${fullscreenMissileLaunchPreview.originX}px`,
                    top: `${fullscreenMissileLaunchPreview.originY}px`,
                    width: `${fullscreenMissileLaunchPreview.distance}px`,
                    transform: `rotate(${fullscreenMissileLaunchPreview.angleRad}rad)`,
                  }}
                />
              ) : null}
              {fullscreenMissileCommandState?.threats?.map((threat) => {
                const threatUi = getMissileCommandThreatUi(threat);
                return (
                  <div key={threat.id}>
                    <div
                      className={threatUi.trailClassName}
                      style={{
                        left: `${threat.startX}px`,
                        top: `${threat.startY}px`,
                        width: `${Math.hypot(threat.x - threat.startX, threat.y - threat.startY)}px`,
                        transform: `rotate(${Math.atan2(
                          threat.y - threat.startY,
                          threat.x - threat.startX,
                        )}rad)`,
                      }}
                    />
                    <div
                      className={threatUi.headClassName}
                      style={{
                        left: `${threat.x}px`,
                        top: `${threat.y}px`,
                      }}
                    />
                  </div>
                );
              })}
              {fullscreenMissileCommandState?.interceptors?.map((interceptor) => {
                const interceptorUi = getMissileCommandInterceptorUi();
                return (
                  <div key={interceptor.id}>
                    <div
                      className={interceptorUi.trailClassName}
                      style={{
                        left: `${interceptor.originX}px`,
                        top: `${interceptor.originY}px`,
                        width: `${Math.hypot(
                          interceptor.x - interceptor.originX,
                          interceptor.y - interceptor.originY,
                        )}px`,
                        transform: `rotate(${Math.atan2(
                          interceptor.y - interceptor.originY,
                          interceptor.x - interceptor.originX,
                        )}rad)`,
                      }}
                    />
                    <div
                      className={interceptorUi.headClassName}
                      style={{
                        left: `${interceptor.x}px`,
                        top: `${interceptor.y}px`,
                      }}
                    />
                  </div>
                );
              })}
              {fullscreenMissileCommandState?.explosions?.map((explosion) => {
                const radius = getMissileCommandExplosionRadius(explosion);
                const explosionUi = getMissileCommandExplosionUi(explosion);
                return (
                  <div
                    key={explosion.id}
                    className={explosionUi.className}
                    style={{
                      left: `${explosion.x - radius}px`,
                      top: `${explosion.y - radius}px`,
                      width: `${radius * 2}px`,
                      height: `${radius * 2}px`,
                      borderColor: explosion.color,
                      boxShadow: `0 0 ${Math.max(18, radius * 0.7)}px ${explosion.color}`,
                    }}
                  >
                    <span
                      className="fullscreen-camera-missile-explosion-core"
                      style={{ opacity: explosionUi.coreOpacity }}
                    />
                    <span
                      className="fullscreen-camera-missile-explosion-shockwave"
                      style={{
                        opacity: explosionUi.shockwaveOpacity,
                        transform: `scale(${explosionUi.shockwaveScale})`,
                      }}
                    />
                  </div>
                );
              })}
              {fullscreenMissileCommandState?.scoreBursts?.map((burst) => {
                const progress = Math.min(1, burst.ageMs / Math.max(1, burst.durationMs));
                return (
                  <div
                    key={burst.id}
                    className="fullscreen-camera-missile-score-popup"
                    style={{
                      left: `${burst.x}px`,
                      top: `${burst.y - progress * 34}px`,
                      opacity: 1 - progress,
                    }}
                  >
                    +{burst.value}
                  </div>
                );
              })}
              {fullscreenMissileCrosshairUi.point ? (
                <div
                  className={fullscreenMissileCrosshairUi.className}
                  style={{
                    left: `${fullscreenMissileCrosshairUi.point.x}px`,
                    top: `${fullscreenMissileCrosshairUi.point.y}px`,
                    "--missile-cooldown-progress": fullscreenMissileCooldownUi.reloadProgress,
                  }}
                >
                  <span className="fullscreen-camera-missile-cooldown-ring" />
                  <span className="fullscreen-camera-missile-crosshair-label">
                    {fullscreenMissileCrosshairUi.label}
                  </span>
                </div>
              ) : null}
              <div className="fullscreen-camera-missile-scoreboard">
                {fullscreenMissileTacticalMetrics.items.map((item) => (
                  <span
                    key={item.id}
                    className={`fullscreen-camera-missile-score-item ${
                      item.id === "pressure" ? `pressure-${item.value}` : ""
                    }`}
                  >
                    <span className="fullscreen-camera-missile-score-label">{item.label}</span>
                    <span className="fullscreen-camera-missile-score-value">{item.value}</span>
                  </span>
                ))}
              </div>
              <div className="fullscreen-camera-missile-wave-status">
                <span>
                  Wave {fullscreenMissileWaveUi.wave}/
                  {fullscreenMissileWaveUi.totalWaves}
                </span>
                <strong>{fullscreenMissileWaveUi.name}</strong>
                <span>
                  {fullscreenMissileWaveUi.threatsRemaining} threats left
                </span>
                <div aria-label="Wave progress">
                  <span
                    style={{
                      width: `${Math.round(
                        fullscreenMissileWaveUi.progress * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div
                className={`fullscreen-camera-missile-resources ${fullscreenMissileResourceUi.state}`}
              >
                <div>
                  <span>
                    Ammo {fullscreenMissileResourceUi.ammo}/
                    {fullscreenMissileResourceUi.maxAmmo}
                  </span>
                  <i>
                    <span
                      style={{
                        width: `${Math.round(
                          fullscreenMissileResourceUi.ammoRatio * 100,
                        )}%`,
                      }}
                    />
                  </i>
                </div>
                <div>
                  <span>Energy {fullscreenMissileResourceUi.energy}%</span>
                  <i>
                    <span
                      style={{
                        width: `${Math.round(
                          fullscreenMissileResourceUi.energyRatio * 100,
                        )}%`,
                      }}
                    />
                  </i>
                </div>
              </div>
              <div className="fullscreen-camera-missile-legend compact">
                {fullscreenMissileLegendItems.map((item) => (
                  <span key={item.id} className="fullscreen-camera-missile-legend-chip">
                    <span className="fullscreen-camera-missile-legend-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
              {isFullscreenMissileCommandMode &&
              fullscreenMissileCountdownUi.visible ? (
                <div className="fullscreen-camera-missile-banner countdown">
                  <span className="fullscreen-camera-missile-banner-title">
                    {fullscreenMissileCountdownUi.title}
                  </span>
                  <span className="fullscreen-camera-missile-banner-count">
                    {fullscreenMissileCountdownUi.seconds}
                  </span>
                  <span className="fullscreen-camera-missile-banner-structures">
                    {fullscreenMissileCountdownUi.structureIds.map((structureId) => (
                      <span key={structureId} />
                    ))}
                  </span>
                </div>
              ) : null}
              {isFullscreenMissileCommandMode &&
              fullscreenMissileIntermissionUi.visible ? (
                <div className="fullscreen-camera-missile-banner intermission">
                  <span className="fullscreen-camera-missile-banner-title">
                    {fullscreenMissileIntermissionUi.title}
                  </span>
                  <span>
                    Next: wave {fullscreenMissileIntermissionUi.nextWave}
                  </span>
                  <span className="fullscreen-camera-missile-game-over-stats">
                    {fullscreenMissileIntermissionUi.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </span>
                </div>
              ) : null}
              {isFullscreenMissileCommandMode && fullscreenMissileGameOverUi.visible ? (
                <div className="fullscreen-camera-missile-banner game-over">
                  <span className="fullscreen-camera-missile-game-over-title">
                    {fullscreenMissileGameOverUi.title}
                  </span>
                  <span className="fullscreen-camera-missile-game-over-stats">
                    {fullscreenMissileGameOverUi.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </span>
                  {fullscreenMissileGameOverUi.medals?.length ? (
                    <span className="fullscreen-camera-missile-medals">
                      {fullscreenMissileGameOverUi.medals.map((medal) => (
                        <span key={medal.id}>{medal.label}</span>
                      ))}
                    </span>
                  ) : null}
                  <span className="fullscreen-camera-missile-game-over-restart">
                    {fullscreenMissileGameOverUi.restartText}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className={`fullscreen-camera-grid ${
                isMotionVisualizerMode ? "motion-visualizer-layer" : ""
              }`}
              style={fullscreenCameraGridMetrics?.style ?? undefined}
            >
              {fullscreenCameraGridMetrics?.outerRing?.map((cell) => (
                <div
                  key={`fullscreen-grid-outer-${cell.key}`}
                  className="fullscreen-camera-grid-outer-ring"
                  style={cell.style}
                />
              ))}
              {fullscreenCameraGridMetrics?.neighbors?.map((cell) => (
                <div
                  key={`fullscreen-grid-neighbor-${cell.key}`}
                  className="fullscreen-camera-grid-neighbor"
                  style={cell.style}
                />
              ))}
              {fullscreenCameraGridMetrics?.highlight?.map((cell) => (
                <div
                  key={`fullscreen-grid-highlight-${cell.key}`}
                  className="fullscreen-camera-grid-highlight"
                  style={cell.style}
                />
              ))}
            </div>
          )}

          {isMotionVisualizerMode ? (
            <Suspense
              fallback={
                <div
                  className="motion-visualizer-controls-loading"
                  role="status"
                >
                  Opening remix controls…
                </div>
              }
            >
              <MotionVisualizerControls
                collapsed={motionVisualizerControlsCollapsed}
                onApplyPreset={applySelectedMotionVisualizerPreset}
                onChange={updateMotionVisualizerSettings}
                onCollapseChange={setMotionVisualizerControlsCollapsed}
                onDeletePreset={deleteSelectedMotionVisualizerPreset}
                onExport={exportMotionVisualizerArtwork}
                onSavePreset={saveCurrentMotionVisualizerPreset}
                onToggleFavorite={
                  toggleCurrentMotionVisualizerFavorite
                }
                settings={motionVisualizerState}
                statusMessage={motionVisualizerStatus}
              />
            </Suspense>
          ) : null}

          {FULLSCREEN_BODY_SKELETON_MODES.has(fullscreenGridMode) &&
          (fullscreenBodySkeletonOverlay?.people.length ||
            fullscreenHandSkeletonOverlay?.hands.length) ? (
            <svg
              className="fullscreen-body-skeleton-overlay"
              style={fullscreenCameraViewport?.style ?? undefined}
              viewBox={`0 0 ${fullscreenCameraViewport?.width ?? 0} ${fullscreenCameraViewport?.height ?? 0}`}
              preserveAspectRatio="none"
            >
              {fullscreenBodySkeletonOverlay?.people.map((person, personIndex) => (
                <g
                  key={person.id}
                  className={`fullscreen-body-skeleton-person person-${personIndex + 1}`}
                >
                  {person.bones.map((bone) => (
                    <line
                      key={`${person.id}-${bone.startName}-${bone.endName}`}
                      className="fullscreen-body-skeleton-bone"
                      x1={bone.x1}
                      y1={bone.y1}
                      x2={bone.x2}
                      y2={bone.y2}
                    />
                  ))}
                  {person.keypoints.map((point) => (
                    <circle
                      key={`${person.id}-${point.name}`}
                      className={`fullscreen-body-skeleton-joint ${point.group}`}
                      cx={point.x}
                      cy={point.y}
                      r={point.group === "eyes" ? 4 : 5}
                    />
                  ))}
                  {person.anchor ? (
                    <text
                      className="fullscreen-body-skeleton-label"
                      x={person.anchor.x + 9}
                      y={Math.max(16, person.anchor.y - 12)}
                    >
                      {person.label}
                    </text>
                  ) : null}
                </g>
              ))}
              {fullscreenHandSkeletonOverlay?.hands.map((hand, handIndex) => (
                <g
                  key={hand.id}
                  className={`fullscreen-hand-skeleton-hand hand-${handIndex + 1}`}
                >
                  {hand.bones.map((bone) => (
                    <line
                      key={`${hand.id}-${bone.startIndex}-${bone.endIndex}`}
                      className="fullscreen-hand-skeleton-bone"
                      x1={bone.x1}
                      y1={bone.y1}
                      x2={bone.x2}
                      y2={bone.y2}
                    />
                  ))}
                  {hand.joints.map((joint) => (
                    <circle
                      key={`${hand.id}-${joint.index}`}
                      className={`fullscreen-hand-skeleton-joint ${joint.isTip ? "tip" : ""}`}
                      cx={joint.x}
                      cy={joint.y}
                      r={joint.isTip ? 4.3 : 2.7}
                    />
                  ))}
                </g>
              ))}
            </svg>
          ) : null}

          {!experienceLifecycle &&
          fullscreenRestartControlLabel &&
          fullscreenRestartControlState?.layout ? (
            <button
              aria-label={fullscreenRestartControlLabel}
              className={`fullscreen-camera-restart-box ${
                fullscreenRestartControlState.handVerified ? "" : "disabled"
              } ${fullscreenRestartControlState.holdActive ? "active" : ""}`}
              onClick={() => {
                if (runFullscreenRestartControlActionFromRefs()) {
                  fullscreenRestartControlStateRef.current = null;
                  setFullscreenRestartControlState(null);
                }
              }}
              style={{
                left: `${
                  (fullscreenCameraViewport?.left ?? 0) + fullscreenRestartControlState.layout.left
                }px`,
                top: `${
                  (fullscreenCameraViewport?.top ?? 0) + fullscreenRestartControlState.layout.top
                }px`,
                width: `${fullscreenRestartControlState.layout.boxWidth}px`,
                height: `${fullscreenRestartControlState.layout.boxHeight}px`,
              }}
              type="button"
            >
              <span className="fullscreen-camera-restart-title">
                {fullscreenRestartControlLabel}
              </span>
              <span className="fullscreen-camera-restart-countdown">
                {fullscreenRestartControlState.handVerified &&
                fullscreenRestartControlState.holdActive
                  ? fullscreenRestartControlCountdown
                  : (FULLSCREEN_HOLD_CONTROL_MS / 1000).toFixed(2)}
              </span>
              <span className="fullscreen-camera-restart-hint">
                {!fullscreenRestartControlState.handVerified
                  ? "Show index finger or click"
                  : fullscreenRestartControlState.holdActive
                  ? "Keep holding"
                  : "Hold or click to restart"}
              </span>
            </button>
          ) : null}

          {!experienceLifecycle && fullscreenExitControlState?.layout ? (
            <button
              aria-label="Return Home"
              className={`fullscreen-camera-exit-box ${
                fullscreenExitControlState.handVerified ? "" : "disabled"
              } ${fullscreenExitControlState.holdActive ? "active" : ""}`}
              onClick={() => navigateToProductHome()}
              style={{
                left: `${
                  (fullscreenCameraViewport?.left ?? 0) + fullscreenExitControlState.layout.left
                }px`,
                top: `${
                  (fullscreenCameraViewport?.top ?? 0) + fullscreenExitControlState.layout.top
                }px`,
                width: `${fullscreenExitControlState.layout.boxWidth}px`,
                height: `${fullscreenExitControlState.layout.boxHeight}px`,
              }}
              type="button"
            >
              <span className="fullscreen-camera-exit-title">Home</span>
              <span className="fullscreen-camera-exit-countdown">
                {fullscreenExitControlState.handVerified && fullscreenExitControlState.holdActive
                  ? fullscreenExitControlCountdown
                  : (FULLSCREEN_HOLD_CONTROL_MS / 1000).toFixed(2)}
              </span>
              <span className="fullscreen-camera-exit-hint">
                {!fullscreenExitControlState.handVerified
                  ? "Show index finger or click"
                  : fullscreenExitControlState.holdActive
                  ? "Keep holding"
                  : "Hold or click"}
              </span>
            </button>
          ) : null}

          <div className="fullscreen-camera-hud">
            {!experienceLifecycle ? (
              <div className="fullscreen-camera-hud-bottom">
                <span
                  className={`tracking-indicator fullscreen-camera-status ${
                    fullscreenDetectedHandCount > 0 ||
                    (isMotionVisualizerMode && !trackingRequested)
                      ? "ok"
                      : "warn"
                  }`}
                >
                  {isMotionVisualizerMode && !trackingRequested
                    ? "Pointer ready"
                    : fullscreenDetectedHandCount > 0
                      ? "Tracking ready"
                      : "Show your hand"}
                  {debugEnabled
                    ? ` · Hands ${fullscreenDetectedHandCount} · Bodies ${fullscreenDetectedBodyCount} · Inference ${fps.toFixed(1)} FPS`
                    : ""}
                </span>
                <div className="fullscreen-camera-meta fullscreen-camera-actions">
                  <span className="fullscreen-camera-note">
                    {fullscreenExperienceMode?.controlHint ?? "Move to interact"} · Esc returns
                    home
                  </span>
                </div>
              </div>
            ) : null}
            {(cameraError || modelError) && (
              <div className="fullscreen-camera-errors">
                {cameraError && <p className="error-text">{cameraError}</p>}
                {cameraError && (
                  <button type="button" onClick={() => retryCamera()}>
                    Retry camera
                  </button>
                )}
                {modelError && <p className="error-text">{modelError}</p>}
              </div>
            )}
          </div>
        </div>
        {experienceOverlay}
      </div>
    );
  }

  if (isMinorityReportLabPhase) {
    return (
      <div className="app fullscreen-camera-app minority-report-app">
        <Suspense
          fallback={<LazyExperienceFallback label="Opening Gesture HUD…" />}
        >
          <MinorityReportLab
            immersive
            cameraAspectRatio={cameraAspectRatio}
            cameraObjectFit={cameraObjectFit}
            cameraOverlayRef={overlayCanvasRef}
            cameraStageRef={cameraWrapRef}
            cameraVideoRef={videoRef}
            cameraError={cameraError}
            modelError={modelError}
            fps={fps}
            engineOutput={labEngineOutput}
            eventLog={labEventLog}
            detectionStatus={{
              handsCount: labEngineOutput.hands.length,
              inferenceBusy: inferenceBusyRef.current,
              handDetected,
            }}
            confidenceThreshold={labConfidenceThreshold}
            showSkeleton={labShowSkeleton}
            showTrails={labShowTrails}
            personalizationEnabled={labPersonalizationEnabled}
            onConfidenceThresholdChange={setLabConfidenceThreshold}
            onShowSkeletonChange={setLabShowSkeleton}
            onShowTrailsChange={setLabShowTrails}
            onPersonalizationEnabledChange={setLabPersonalizationEnabled}
            trainingState={labTrainingState}
            sampleCounts={labSampleCounts}
            onRecordGesture={startLabGestureRecording}
            onDeleteLastSample={deleteLastLabSample}
            onClearSamples={clearLabSamples}
            onExportSamples={exportLabSamples}
            onImportSamples={importLabSamples}
            onClearEventLog={clearLabEventLog}
            onBack={returnFromMinorityReportLab}
            onReset={startMinorityReportLab}
          />
        </Suspense>
      </div>
    );
  }

  const contentGridClassName = `content-grid ${
    isCalibrationLayoutPhase && !isBodyPosePhase ? "calibration-layout" : ""
  } ${isBodyPosePhase ? "body-layout" : ""} ${
    hideInactiveCameraPane ? "single-pane-layout" : ""
  } ${showLeftPaneResizer ? "resizable-layout" : ""} ${
    preferences.cameraPreview === "expanded"
      ? "camera-preview-expanded"
      : ""
  }`;
  const contentGridStyle = showLeftPaneResizer
    ? {
        "--left-pane-resizer-width": `${RESIZABLE_LEFT_PANE_HANDLE_WIDTH_PX}px`,
        ...(leftPaneWidth !== null
          ? { "--left-pane-column": `${Math.round(leftPaneWidth)}px` }
          : {}),
      }
    : undefined;
  const leftPaneResizerValueNow = showLeftPaneResizer
    ? Math.round(getMeasuredLeftPaneWidth())
    : undefined;
  const leftPaneResizerValueMax = showLeftPaneResizer ? Math.round(getMaxLeftPaneWidth()) : undefined;
  const activeMode = getModeByPhase(phase);
  const activePhaseName =
    phase === PHASES.CALIBRATION ? "Advanced Input Test" : activeMode?.label ?? "Motion Arcade";
  const activePhaseSummary =
    phase === PHASES.CALIBRATION
      ? "Optional calibration and live input diagnostics."
      : activeMode?.objective ?? activeMode?.summary ?? "Move naturally and explore.";

  const currentModeActions =
    phase === PHASES.CALIBRATION
      ? [
          {
            label: "Home",
            onClick: navigateToProductHome,
          },
          {
            label: isCalibrating ? "Restart Calibration" : "Start Calibration",
            onClick: beginCalibration,
            disabled: !cameraReady || !modelReady || isArcCalibrating,
          },
          {
            label: isArcCalibrating
              ? "Restart Lazy Arc Calibration"
              : "Start Lazy Arc Calibration",
            onClick: beginArcCalibration,
            secondary: true,
            disabled: !cameraReady || !modelReady || isCalibrating,
          },
          {
            label: "Reset Input Test",
            onClick: () => resetCalibrationInputTests("manual_button"),
            secondary: true,
          },
        ]
      : isSandboxPhase
      ? [
          { label: "Home", onClick: navigateToProductHome },
          {
            label: "Reset Blocks",
            onClick: () => resetSandboxBlocks("manual_button"),
            secondary: true,
          },
        ]
      : phase === PHASES.FLIGHT
      ? [
          { label: "Home", onClick: navigateToProductHome },
          {
            label: "Re-center Hand Pose",
            onClick: () => resetFlightNeutral("manual_button"),
            secondary: true,
          },
          {
            label: "Reset Flight Scene",
            onClick: () => resetFlightSession("manual_button"),
            secondary: true,
          },
        ]
      : phase === PHASES.RUNNER
      ? [
          { label: "Home", onClick: navigateToProductHome },
          {
            label: "Reset Runner",
            onClick: () => resetRunnerSession("manual_button"),
            secondary: true,
          },
        ]
      : phase === PHASES.BODY_POSE
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Restart Body Pose Lab", onClick: startBodyPoseLab, secondary: true },
        ]
      : phase === PHASES.OFF_AXIS_LAB
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Restart Forest Walk", onClick: startOffAxisLab, secondary: true },
        ]
      : phase === PHASES.CONVEYOR
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Restart Conveyor Toss", onClick: startConveyorSession, secondary: true },
        ]
      : phase === PHASES.ROULETTE
      ? [{ label: "Home", onClick: navigateToProductHome }]
      : phase === PHASES.MINORITY_REPORT_LAB
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Reset Lab Session", onClick: startMinorityReportLab, secondary: true },
        ]
      : phase === PHASES.SPATIAL_GESTURE_MEMORY
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Next Round", onClick: startSpatialGestureMemoryRound, secondary: true },
          { label: "Reset Spatial Memory", onClick: resetSpatialGestureMemory, secondary: true },
        ]
      : phase === PHASES.GESTURE_ANALYTICS_LAB
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Reset Analytics Lab", onClick: startGestureAnalyticsLab, secondary: true },
        ]
      : phase === PHASES.GESTURE_ART_LAB
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Restart Gesture Art Lab", onClick: startGestureArtLab, secondary: true },
        ]
      : phase === PHASES.GESTURE_CONTROL_OS
      ? [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Restart Gesture Control OS", onClick: startGestureControlOS, secondary: true },
        ]
      : phase === PHASES.GAME
      ? [{ label: "Home", onClick: navigateToProductHome }]
      : [
          { label: "Home", onClick: navigateToProductHome },
          { label: "Recalibrate", onClick: handleRecalibrate, secondary: true },
        ];

  return (
    <div className="app">
      {experienceOverlay}
      <header className="top-bar">
        <button className="app-brand-button" onClick={navigateToProductHome} type="button">
          <span aria-hidden="true" className="app-brand-mark">
            M
          </span>
          <span>
            <strong>Motion Arcade</strong>
            <small>Home</small>
          </span>
        </button>
        <div className="phase-pill" aria-label={`Current experience: ${activePhaseName}`}>
          {activePhaseName}
        </div>
        <div className="top-bar-actions">
          <button
            className={`tracking-indicator tracking-status-button ${
              handDetected ? "ok" : "warn"
            }`}
            onClick={openProductTrackingSetup}
            type="button"
          >
            {phase === PHASES.BODY_POSE || phase === PHASES.OFF_AXIS_LAB
              ? handDetected
                ? "Pose ready"
                : "Show your face"
              : handDetected
              ? "Tracking ready"
              : "Show your hand"}
          </button>
          <button className="top-bar-settings" onClick={openProductSettings} type="button">
            Settings
          </button>
        </div>
      </header>

      <div className={contentGridClassName} ref={contentGridRef} style={contentGridStyle}>
        {!hideInactiveCameraPane ? (
          <section className="card camera-card" ref={cameraPaneRef}>
          <div
            className={`camera-preview-panel preview-${preferences.cameraPreview}`}
          >
            <h2>{cameraPanelTitle}</h2>
            {showInlineCameraPreview ? (
              <div
                className="camera-wrap"
                ref={cameraWrapRef}
                style={{ aspectRatio: String(cameraAspectRatio) }}
              >
                <video
                  ref={videoRef}
                  className="camera-video"
                  style={{ objectFit: cameraObjectFit }}
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={overlayCanvasRef} className="camera-overlay" />
              </div>
            ) : null}
          </div>

          <div className="camera-support-panel">
            <div className="experience-brief">
              <p>{activePhaseSummary}</p>
              <strong>
                {activeMode?.controlHint ??
                  (phase === PHASES.CALIBRATION
                    ? "Point at a target, then pinch to select it."
                    : "Move naturally to interact.")}
              </strong>
            </div>

            <div className="status-row" aria-live="polite">
              <span>Camera {cameraReady ? "ready" : "waiting"}</span>
              <span>Tracking {modelReady ? "ready" : "loading"}</span>
              {(phase === PHASES.BODY_POSE || phase === PHASES.OFF_AXIS_LAB) && (
                <span>Pose {poseModelReady ? "ready" : "loading"}</span>
              )}
            </div>

            {cameraError && (
              <>
                <p className="error-text">{cameraError}</p>
                <button type="button" onClick={() => retryCamera()}>
                  Retry camera
                </button>
              </>
            )}
            {modelError && <p className="error-text">{modelError}</p>}
            {(phase === PHASES.BODY_POSE || phase === PHASES.OFF_AXIS_LAB) && poseModelError && (
              <p className="error-text">{poseModelError}</p>
            )}

            {phase === PHASES.CALIBRATION && calibrationMessage ? (
              <p className="small-text" aria-live="polite">
                {calibrationMessage}
              </p>
            ) : null}

            <nav className="experience-actions" aria-label={`${activePhaseName} actions`}>
              {currentModeActions.map((action) => (
                <button
                  key={action.label}
                  className={action.secondary ? "secondary" : ""}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              ))}
            </nav>

            <details className="advanced-controls">
              <summary>Advanced tracking details</summary>
              <dl className="tracking-details">
                <div>
                  <dt>Runtime</dt>
                  <dd>{activeRuntime}</dd>
                </div>
                <div>
                  <dt>Backend</dt>
                  <dd>{activeBackend}</dd>
                </div>
                <div>
                  <dt>Inference</dt>
                  <dd>{fps.toFixed(1)} FPS</dd>
                </div>
                <div>
                  <dt>Pinch</dt>
                  <dd>{pinchActive ? "active" : "idle"}</dd>
                </div>
              </dl>
              <label className="debug-toggle">
                <input
                  type="checkbox"
                  checked={debugEnabled}
                  onChange={(event) => setDebugEnabled(event.target.checked)}
                />
                Show debug overlay
              </label>
              <button
                className="secondary"
                type="button"
                disabled={!modelReady}
                onClick={() => logTrackingExtentsSnapshot("manual_button")}
              >
                Log tracking extents
              </button>
            </details>
          </div>
          </section>
        ) : null}

        {showLeftPaneResizer && (
          <div
            aria-label="Resize camera pane"
            aria-orientation="vertical"
            aria-valuemax={leftPaneResizerValueMax}
            aria-valuemin={RESIZABLE_LEFT_PANE_MIN_WIDTH_PX}
            aria-valuenow={leftPaneResizerValueNow}
            className={`content-grid-resizer ${isLeftPaneResizing ? "active" : ""}`}
            onKeyDown={handleLeftPaneResizerKeyDown}
            onPointerDown={handleLeftPaneResizerPointerDown}
            role="separator"
            tabIndex={0}
            title="Drag to resize the camera pane"
          />
        )}

        <Suspense fallback={<LazyExperienceFallback />}>
          {phase === PHASES.CALIBRATION ? (
          <section className="card panel calibration-panel">
            <h2>Calibration Input Test</h2>
            <p className="small-text">
              Primary target area: hover any box, then pinch while hovering to verify gesture
              input behavior.
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
                hovering and pinch to switch to the red pinch color.
              </p>
              <p className="small-text">
                Hovered cell: {inputTestHoveredCell >= 0 ? inputTestHoveredCell + 1 : "none"} |
                Pinch: {pinchActive ? "active" : "idle"}
              </p>
            </div>
          </section>
        ) : isSandboxPhase ? (
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

          </section>
        ) : phase === PHASES.RUNNER ? (
          <section className="card panel runner-panel">
            <h2>Track Runner</h2>
            <p className="small-text">
              4x4 converging-track runner: move hand to switch tracks in both directions.
            </p>
            <p className="small-text">
              Collect coins on your selected track.
            </p>

            <div className="runner-stage" ref={runnerStageRef}>
              <canvas className="runner-canvas" ref={runnerCanvasRef} />
              <div className="runner-hud">
                <span>Coins: {runnerHud.coins}</span>
                <span>Distance: {runnerHud.distance.toFixed(0)} u</span>
                <span>Track: C{runnerHud.trackCol}/R{runnerHud.trackRow}</span>
                <span>Node gap: {runnerHud.trackSpacingPx.toFixed(1)} px</span>
              </div>
            </div>

          </section>
        ) : phase === PHASES.CONVEYOR ? (
          <ConveyorSphereGame
            cursor={cursor}
            pinchActive={pinchActive}
            onBack={navigateToProductHome}
          />
        ) : phase === PHASES.ROULETTE ? (
          <RouletteFingerGame
            cursor={cursor}
            pinchActive={pinchActive}
            onBack={navigateToProductHome}
          />
        ) : phase === PHASES.BODY_POSE ? (
          <BodyPoseLab poseStatus={poseStatus} />
        ) : phase === PHASES.OFF_AXIS_LAB ? (
          <OffAxisChamberLab poseStatus={poseStatus} />
        ) : phase === PHASES.MINORITY_REPORT_LAB ? (
          <MinorityReportLab
            cameraAspectRatio={cameraAspectRatio}
            cameraObjectFit={cameraObjectFit}
            cameraOverlayRef={overlayCanvasRef}
            cameraStageRef={cameraWrapRef}
            cameraVideoRef={videoRef}
            fps={fps}
            engineOutput={labEngineOutput}
            eventLog={labEventLog}
            detectionStatus={{
              handsCount: labEngineOutput.hands.length,
              inferenceBusy: inferenceBusyRef.current,
              handDetected,
            }}
            confidenceThreshold={labConfidenceThreshold}
            showSkeleton={labShowSkeleton}
            showTrails={labShowTrails}
            personalizationEnabled={labPersonalizationEnabled}
            onConfidenceThresholdChange={setLabConfidenceThreshold}
            onShowSkeletonChange={setLabShowSkeleton}
            onShowTrailsChange={setLabShowTrails}
            onPersonalizationEnabledChange={setLabPersonalizationEnabled}
            trainingState={labTrainingState}
            sampleCounts={labSampleCounts}
            onRecordGesture={startLabGestureRecording}
            onDeleteLastSample={deleteLastLabSample}
            onClearSamples={clearLabSamples}
            onExportSamples={exportLabSamples}
            onImportSamples={importLabSamples}
            onClearEventLog={clearLabEventLog}
          />
        ) : phase === PHASES.SPATIAL_GESTURE_MEMORY ? (
          <SpatialGestureMemory
            state={spatialMemoryState}
            experienceState={spatialMemoryExperience}
            onExperienceAction={dispatchSpatialMemoryExperience}
            onStart={startSpatialGestureMemoryRound}
            onReset={resetSpatialGestureMemory}
          />
        ) : phase === PHASES.GESTURE_ANALYTICS_LAB ? (
          <GestureAnalyticsLab
            key={gestureAnalyticsLabSessionKey}
            liveHands={analyticsHands}
            liveTimestamp={analyticsTimestamp}
            fps={fps}
          />
        ) : phase === PHASES.GESTURE_CONTROL_OS ? (
          <GestureControlOS
            key={gestureControlOSSessionKey}
            fps={fps}
            engineOutput={labEngineOutput}
            eventLog={labEventLog}
            detectionStatus={{
              handsCount: labEngineOutput.hands.length,
              inferenceBusy: inferenceBusyRef.current,
              handDetected,
            }}
            confidenceThreshold={labConfidenceThreshold}
            showSkeleton={labShowSkeleton}
            showTrails={labShowTrails}
            personalizationEnabled={labPersonalizationEnabled}
            onConfidenceThresholdChange={setLabConfidenceThreshold}
            onShowSkeletonChange={setLabShowSkeleton}
            onShowTrailsChange={setLabShowTrails}
            onPersonalizationEnabledChange={setLabPersonalizationEnabled}
            trainingState={labTrainingState}
            sampleCounts={labSampleCounts}
            onRecordGesture={startLabGestureRecording}
            onDeleteLastSample={deleteLastLabSample}
            onClearSamples={clearLabSamples}
            onExportSamples={exportLabSamples}
            onImportSamples={importLabSamples}
            onClearEventLog={clearLabEventLog}
          />
        ) : (
          <WhackAMoleExperience
            daily={activeLaunchContextRef.current?.challenge === "daily"}
            dailyDate={activeLaunchContextRef.current?.dayKey}
            exitLabel={
              isArcadeRunLeg ? "Return to Arcade Run" : "Exit"
            }
            onAction={handleWhackAMoleAction}
            onExit={exitCurrentExperience}
            resultExitLabel={
              isArcadeRunLeg ? "Continue Arcade Run" : "Back to games"
            }
            seed={whackAMoleState.seed}
            state={whackAMoleState}
          />
          )}
        </Suspense>
      </div>

      {phase !== PHASES.MINORITY_REPORT_LAB &&
        phase !== PHASES.GESTURE_ANALYTICS_LAB &&
        phase !== PHASES.BODY_POSE &&
        phase !== PHASES.SPATIAL_GESTURE_MEMORY &&
        phase !== PHASES.GESTURE_ART_LAB &&
        phase !== PHASES.GESTURE_CONTROL_OS &&
        renderTrackedCursorLayer()}

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
