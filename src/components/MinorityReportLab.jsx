import { useEffect, useMemo, useRef, useState } from "react";
import GestureDebugPanel from "./GestureDebugPanel.jsx";
import { GESTURE_IDS } from "../gestures/constants.js";
import {
  getMinorityReportAnchoredZoomTransform,
  getMinorityReportFocusTransform,
  getMinorityReportOverviewTransform,
  getMinorityReportPinchSequenceAction,
  normalizeMinorityReportStageTransform,
  shouldResetMinorityReportFocus,
  shouldUseMinorityReportZoom,
} from "../minorityReportLabInteractions.js";
import {
  clampMinorityReportPanelPosition,
  getMinorityReportPanelPlacement,
  getMinorityReportRandomPanelAssignments,
  getMinorityReportSuperSectorBoundsList,
  getMinorityReportTileBounds,
  getMinorityReportTileIndexAtPoint,
  getMinorityReportTileBoundsList,
  getMinorityReportWorkspaceBounds,
} from "../minorityReportLabLayout.js";

const STAGE_DEFAULT_SIZE = { width: 960, height: 640 };
const HAND_INFO_BOX_SIZE = { width: 170, height: 88 };
const HAND_INFO_BOX_MARGIN = 10;
const DOUBLE_PINCH_MAX_DELAY_MS = 320;
const SECTOR_FOCUS_ANIMATION_MS = 160;
const PANEL_IDLE_TRANSITION_MS = 80;
const PANEL_THROW_TRANSITION_MS = 520;

const SCENES = [
  {
    id: "analysis_wall",
    name: "Analysis Wall",
    description: "Scene for card sorting and direct panel manipulation.",
  },
  {
    id: "timeline_stack",
    name: "Timeline Stack",
    description: "Scene for horizontal timeline browsing.",
  },
  {
    id: "briefing_ring",
    name: "Briefing Ring",
    description: "Scene for circular panel arrangement.",
  },
];

const HAND_INFO_BOX_DEFAULTS = {
  Left: { x: 16, y: 16 },
  Right: {
    x: STAGE_DEFAULT_SIZE.width - HAND_INFO_BOX_SIZE.width - 16,
    y: 16,
  },
};

const PANEL_TITLES = [
  "Case Files",
  "Transit Feed",
  "Person of Interest",
  "Signal Spectra",
  "Evidence Locker",
  "Anomaly Report",
  "Predictive Map",
  "Ops Dispatch",
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDefaultStageTransform(stageSize) {
  return getMinorityReportOverviewTransform(
    stageSize,
    getMinorityReportWorkspaceBounds(stageSize),
  );
}

function formatPanelSubtitle(placement) {
  return `Super Sector ${placement.superSectorIndex + 1} · Sector ${placement.localTileIndex + 1} · Card ${placement.tileSlotIndex + 1}`;
}

function createPanels(sceneIndex, stageSize, panelAssignments) {
  return panelAssignments.map((panelAssignment, index) => {
    const scenePlacement = getMinorityReportPanelPlacement(sceneIndex, panelAssignment, stageSize);
    return {
      id: `panel-${index + 1}`,
      title: PANEL_TITLES[index % PANEL_TITLES.length],
      subtitle: formatPanelSubtitle(scenePlacement),
      tileIndex: scenePlacement.tileIndex,
      superSectorIndex: scenePlacement.superSectorIndex,
      localTileIndex: scenePlacement.localTileIndex,
      tileSlotIndex: scenePlacement.tileSlotIndex,
      tileSlotCount: scenePlacement.tileSlotCount,
      x: scenePlacement.x,
      y: scenePlacement.y,
      rotation: scenePlacement.rotation,
      scale: scenePlacement.scale,
      selected: false,
      throwingUntil: 0,
    };
  });
}

function applySceneLayout(existingPanels, sceneIndex, stageSize, panelAssignments) {
  return existingPanels.map((panel, index) => {
    const nextPlacement = getMinorityReportPanelPlacement(
      sceneIndex,
      panelAssignments[index] ?? {
        tileIndex: panel.tileIndex,
        tileSlotIndex: panel.tileSlotIndex,
        tileSlotCount: panel.tileSlotCount,
      },
      stageSize,
    );
    return {
      ...panel,
      tileIndex: nextPlacement.tileIndex,
      superSectorIndex: nextPlacement.superSectorIndex,
      localTileIndex: nextPlacement.localTileIndex,
      tileSlotIndex: nextPlacement.tileSlotIndex,
      tileSlotCount: nextPlacement.tileSlotCount,
      subtitle: formatPanelSubtitle(nextPlacement),
      x: nextPlacement.x,
      y: nextPlacement.y,
      rotation: nextPlacement.rotation,
      scale: nextPlacement.scale,
      selected: false,
      throwingUntil: 0,
    };
  });
}

function pointerToLocal(pointer, stageSize, transform) {
  if (!pointer) {
    return null;
  }
  const width = stageSize.width;
  const height = stageSize.height;
  const px = pointer.x * width;
  const py = pointer.y * height;

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const translatedX = px - centerX - (transform?.x ?? 0);
  const translatedY = py - centerY - (transform?.y ?? 0);

  return {
    x: translatedX / Math.max(0.001, transform.scale) + centerX,
    y: translatedY / Math.max(0.001, transform.scale) + centerY,
  };
}

function nearestPanel(panels, localPointer, maxDistance = 150) {
  if (!localPointer) {
    return null;
  }

  let winner = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const panel of panels) {
    const distance = Math.hypot(localPointer.x - panel.x, localPointer.y - panel.y);
    if (distance < bestDistance) {
      winner = panel;
      bestDistance = distance;
    }
  }

  if (!winner || bestDistance > maxDistance) {
    return null;
  }

  return {
    panel: winner,
    distance: bestDistance,
  };
}

function clampInfoBoxPosition(position, stageSize) {
  const maxX = Math.max(HAND_INFO_BOX_MARGIN, stageSize.width - HAND_INFO_BOX_SIZE.width - HAND_INFO_BOX_MARGIN);
  const maxY = Math.max(HAND_INFO_BOX_MARGIN, stageSize.height - HAND_INFO_BOX_SIZE.height - HAND_INFO_BOX_MARGIN);
  return {
    x: clamp(position.x, HAND_INFO_BOX_MARGIN, maxX),
    y: clamp(position.y, HAND_INFO_BOX_MARGIN, maxY),
  };
}

export default function MinorityReportLab(props) {
  const {
    cameraAspectRatio,
    cameraObjectFit,
    cameraOverlayRef,
    cameraStageRef,
    cameraVideoRef,
    cameraError,
    modelError,
    fps,
    engineOutput,
    eventLog,
    detectionStatus,
    confidenceThreshold,
    showSkeleton,
    showTrails,
    personalizationEnabled,
    onConfidenceThresholdChange,
    onShowSkeletonChange,
    onShowTrailsChange,
    onPersonalizationEnabledChange,
    trainingState,
    sampleCounts,
    onRecordGesture,
    onDeleteLastSample,
    onClearSamples,
    onExportSamples,
    onImportSamples,
    onClearEventLog,
    immersive = false,
    onBack,
    onReset,
  } = props;

  const stageShellRef = useRef(null);
  const stageRef = useRef(null);
  const [panelAssignments] = useState(() => getMinorityReportRandomPanelAssignments());
  const [stageSize, setStageSize] = useState(STAGE_DEFAULT_SIZE);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [stageTransform, setStageTransform] = useState(() => getDefaultStageTransform(STAGE_DEFAULT_SIZE));
  const [panels, setPanels] = useState(() =>
    createPanels(0, STAGE_DEFAULT_SIZE, panelAssignments),
  );
  const [selectedPanelId, setSelectedPanelId] = useState(null);
  const [draggedPanelId, setDraggedPanelId] = useState(null);
  const [pointerTrails, setPointerTrails] = useState({});
  const [handInfoBoxPositions, setHandInfoBoxPositions] = useState(HAND_INFO_BOX_DEFAULTS);
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);
  const [focusedTileIndex, setFocusedTileIndex] = useState(null);
  const [isStageTransformAnimating, setIsStageTransformAnimating] = useState(false);

  const panelsRef = useRef(panels);
  const sceneIndexRef = useRef(sceneIndex);
  const stageTransformRef = useRef(stageTransform);
  const focusedTileIndexRef = useRef(focusedTileIndex);
  const stageViewModeRef = useRef("overview");
  const grabRef = useRef(null);
  const twoHandManipRef = useRef({ active: false, base: null });
  const pointerTrailsRef = useRef(pointerTrails);
  const handInfoBoxPositionsRef = useRef(handInfoBoxPositions);
  const processedEventsFrameRef = useRef(-1);
  const pinchActiveByHandRef = useRef({});
  const lastPinchStartRef = useRef({});
  const stageTransformAnimationTimeoutRef = useRef(null);
  const handInfoBoxDragRef = useRef({
    Left: null,
    Right: null,
  });

  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  useEffect(() => {
    sceneIndexRef.current = sceneIndex;
  }, [sceneIndex]);

  useEffect(() => {
    stageTransformRef.current = stageTransform;
  }, [stageTransform]);

  useEffect(() => {
    focusedTileIndexRef.current = focusedTileIndex;
  }, [focusedTileIndex]);

  useEffect(() => {
    pointerTrailsRef.current = pointerTrails;
  }, [pointerTrails]);

  useEffect(() => {
    handInfoBoxPositionsRef.current = handInfoBoxPositions;
  }, [handInfoBoxPositions]);

  useEffect(() => {
    return () => {
      if (stageTransformAnimationTimeoutRef.current) {
        window.clearTimeout(stageTransformAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const stageShell = stageShellRef.current;
    if (!stageShell) {
      return undefined;
    }

    const syncSize = () => {
      const rect = stageShell.getBoundingClientRect();
      const shellWidth = Math.max(1, Math.round(rect.width));
      const shellHeight = Math.max(1, Math.round(rect.height));
      const aspectRatio =
        Number.isFinite(cameraAspectRatio) && cameraAspectRatio > 0 ? cameraAspectRatio : 4 / 3;
      let width = shellWidth;
      let height = Math.round(width / aspectRatio);
      if (height > shellHeight) {
        height = shellHeight;
        width = Math.round(height * aspectRatio);
      }
      setStageSize((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }
        return { width, height };
      });
    };

    syncSize();

    if (!window.ResizeObserver) {
      window.addEventListener("resize", syncSize);
      return () => {
        window.removeEventListener("resize", syncSize);
      };
    }

    const observer = new ResizeObserver(syncSize);
    observer.observe(stageShell);
    window.addEventListener("resize", syncSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, [cameraAspectRatio]);

  const tileBounds = useMemo(
    () => getMinorityReportTileBoundsList(stageSize),
    [stageSize],
  );
  const superSectorBounds = useMemo(
    () => getMinorityReportSuperSectorBoundsList(stageSize),
    [stageSize],
  );
  const panelClassName = immersive
    ? "minority-lab-panel minority-lab-panel-immersive"
    : "card panel minority-lab-panel";
  const layoutClassName = [
    "minority-lab-layout",
    !isDebugPanelVisible ? "debug-collapsed" : "",
    immersive ? "immersive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const stageShellClassName = ["minority-stage-shell", immersive ? "immersive" : ""]
    .filter(Boolean)
    .join(" ");
  const debugPanelClassName = [
    "minority-report-debug-panel",
    immersive ? "minority-report-debug-panel-immersive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const handsByLabel = useMemo(() => {
    const map = {
      Left: null,
      Right: null,
    };
    const hands = Array.isArray(engineOutput?.hands) ? engineOutput.hands : [];
    for (const hand of hands) {
      if (hand?.label === "Left") {
        map.Left = hand;
      } else if (hand?.label === "Right") {
        map.Right = hand;
      }
    }
    return map;
  }, [engineOutput?.hands]);
  const hoveredTileByHand = useMemo(() => {
    const hovered = {
      Left: null,
      Right: null,
    };
    const hands = Array.isArray(engineOutput?.hands) ? engineOutput.hands : [];
    for (const hand of hands) {
      if ((hand?.label !== "Left" && hand?.label !== "Right") || !hand?.pointer) {
        continue;
      }
      const localPointer = pointerToLocal(hand.pointer, stageSize, stageTransform);
      hovered[hand.label] = getMinorityReportTileIndexAtPoint(localPointer, stageSize);
    }
    return hovered;
  }, [engineOutput?.hands, stageSize, stageTransform]);
  const focusedSuperSectorIndex = Number.isInteger(focusedTileIndex)
    ? tileBounds[focusedTileIndex]?.superSectorIndex ?? null
    : null;
  const superSectorElements = useMemo(
    () =>
      superSectorBounds.map((superSector) => (
        <div
          key={`minority-super-sector-${superSector.index}`}
          className={`minority-stage-super-sector ${
            focusedSuperSectorIndex === superSector.index ? "focused" : ""
          }`}
          style={{
            left: `${superSector.left}px`,
            top: `${superSector.top}px`,
            width: `${superSector.width}px`,
            height: `${superSector.height}px`,
          }}
          aria-hidden="true"
        >
          <span className="minority-stage-super-sector-label">
            Super Sector {superSector.index + 1}
          </span>
        </div>
      )),
    [focusedSuperSectorIndex, superSectorBounds],
  );
  const tileElements = useMemo(
    () =>
      tileBounds.map((tile) => (
        <div
          key={`minority-tile-${tile.index}`}
          className={`minority-stage-drag-bounds ${focusedTileIndex === tile.index ? "focused" : ""} ${
            hoveredTileByHand.Left === tile.index && hoveredTileByHand.Right === tile.index
              ? "hovered-both"
              : hoveredTileByHand.Left === tile.index
              ? "hovered-left"
              : hoveredTileByHand.Right === tile.index
              ? "hovered-right"
              : ""
          }`}
          style={{
            left: `${tile.left}px`,
            top: `${tile.top}px`,
            width: `${tile.width}px`,
            height: `${tile.height}px`,
          }}
          aria-hidden="true"
        >
          <span className="minority-stage-sector-label">
            Sector {tile.localTileIndex + 1}
          </span>
        </div>
      )),
    [focusedTileIndex, hoveredTileByHand.Left, hoveredTileByHand.Right, tileBounds],
  );
  const panelElements = useMemo(
    () =>
      panels.map((panel) => {
        const isDragging = draggedPanelId === panel.id;
        const isThrowing = panel.throwingUntil > Date.now();
        const transition = isDragging
          ? "none"
          : isThrowing
          ? `left ${PANEL_THROW_TRANSITION_MS}ms cubic-bezier(.09,.67,.22,.98), top ${PANEL_THROW_TRANSITION_MS}ms cubic-bezier(.09,.67,.22,.98), transform ${PANEL_THROW_TRANSITION_MS}ms cubic-bezier(.09,.67,.22,.98), box-shadow 180ms ease`
          : `left ${PANEL_IDLE_TRANSITION_MS}ms linear, top ${PANEL_IDLE_TRANSITION_MS}ms linear, transform ${PANEL_IDLE_TRANSITION_MS}ms linear, box-shadow 120ms ease`;
        return (
          <article
            key={panel.id}
            className={`minority-panel-card ${panel.selected ? "selected" : ""} ${selectedPanelId === panel.id ? "focused" : ""}`}
            style={{
              left: `${panel.x}px`,
              top: `${panel.y}px`,
              transform: `translate(-50%, -50%) rotate(${panel.rotation}rad) scale(${panel.scale})`,
              transition,
            }}
          >
            <h4>{panel.title}</h4>
            <p>{panel.subtitle}</p>
            <small>Pinch-drag within this sector</small>
          </article>
        );
      }),
    [draggedPanelId, panels, selectedPanelId],
  );

  useEffect(() => {
    setPanels((previous) => {
      if (previous.length === 0) {
        return createPanels(sceneIndexRef.current, stageSize, panelAssignments);
      }
      return previous.map((panel) => clampMinorityReportPanelPosition(panel, stageSize));
    });
    if (stageViewModeRef.current === "overview") {
      const overviewTransform = getDefaultStageTransform(stageSize);
      setIsStageTransformAnimating(false);
      setStageTransform(overviewTransform);
      stageTransformRef.current = overviewTransform;
    } else if (
      stageViewModeRef.current === "focused" &&
      Number.isInteger(focusedTileIndexRef.current)
    ) {
      const focusedTile = getMinorityReportTileBounds(stageSize, focusedTileIndexRef.current);
      const nextFocusedTransform = getMinorityReportFocusTransform(stageSize, focusedTile);
      setIsStageTransformAnimating(false);
      setStageTransform(nextFocusedTransform);
      stageTransformRef.current = nextFocusedTransform;
    }
    setHandInfoBoxPositions((previous) => ({
      Left: clampInfoBoxPosition(previous.Left ?? HAND_INFO_BOX_DEFAULTS.Left, stageSize),
      Right: clampInfoBoxPosition(previous.Right ?? HAND_INFO_BOX_DEFAULTS.Right, stageSize),
    }));
  }, [panelAssignments, stageSize]);

  const animateStageTransform = (nextTransform) => {
    if (stageTransformAnimationTimeoutRef.current) {
      window.clearTimeout(stageTransformAnimationTimeoutRef.current);
    }
    setIsStageTransformAnimating(true);
    setStageTransform(nextTransform);
    stageTransformRef.current = nextTransform;
    stageTransformAnimationTimeoutRef.current = window.setTimeout(() => {
      setIsStageTransformAnimating(false);
      stageTransformAnimationTimeoutRef.current = null;
    }, SECTOR_FOCUS_ANIMATION_MS);
  };

  const focusTile = (tileIndex) => {
    const tile = getMinorityReportTileBounds(stageSize, tileIndex);
    const nextTransform = getMinorityReportFocusTransform(stageSize, tile);
    stageViewModeRef.current = "focused";
    focusedTileIndexRef.current = tileIndex;
    setFocusedTileIndex(tileIndex);
    animateStageTransform(nextTransform);
    grabRef.current = null;
    handInfoBoxDragRef.current = {
      Left: null,
      Right: null,
    };
    setDraggedPanelId(null);
  };

  const resetFocusedView = () => {
    stageViewModeRef.current = "overview";
    focusedTileIndexRef.current = null;
    setFocusedTileIndex(null);
    animateStageTransform(getDefaultStageTransform(stageSize));
  };

  const requestTileFocus = (tileIndex) => {
    if (!Number.isInteger(tileIndex)) {
      return;
    }
    if (shouldResetMinorityReportFocus(focusedTileIndexRef.current, tileIndex)) {
      resetFocusedView();
      return;
    }
    focusTile(tileIndex);
  };

  const handleStageDoubleClick = (event) => {
    const stageNode = stageRef.current;
    if (!stageNode) {
      return;
    }
    const rect = stageNode.getBoundingClientRect();
    const pointer = {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
    const localPointer = pointerToLocal(pointer, stageSize, stageTransformRef.current);
    const tileIndex = getMinorityReportTileIndexAtPoint(localPointer, stageSize);
    if (!Number.isInteger(tileIndex)) {
      return;
    }
    event.preventDefault();
    requestTileFocus(tileIndex);
  };

  useEffect(() => {
    const frameId = engineOutput?.frameId;
    if (!Number.isFinite(frameId)) {
      return;
    }
    const shouldProcessDiscreteEvents = processedEventsFrameRef.current !== frameId;
    if (shouldProcessDiscreteEvents) {
      processedEventsFrameRef.current = frameId;
    }

    const handStates = Array.isArray(engineOutput?.hands) ? engineOutput.hands : [];
    const twoHand = engineOutput?.twoHand ?? { present: false };
    const events = Array.isArray(engineOutput?.events) ? engineOutput.events : [];
    const zoomGestureActive = shouldUseMinorityReportZoom(twoHand, engineOutput?.continuous);
    const now = performance.now();
    let doublePinchTriggered = false;

    for (const hand of handStates) {
      const wasPinching = Boolean(pinchActiveByHandRef.current[hand.id]);
      if (!hand.pinchActive || wasPinching || !hand.pointer || zoomGestureActive) {
        continue;
      }
      const localPointer = pointerToLocal(hand.pointer, stageSize, stageTransformRef.current);
      const tileIndex = getMinorityReportTileIndexAtPoint(localPointer, stageSize);
      const previousPinch = lastPinchStartRef.current[hand.id];
      const pinchSequence = getMinorityReportPinchSequenceAction(
        previousPinch,
        tileIndex,
        now,
        DOUBLE_PINCH_MAX_DELAY_MS,
      );

      if (pinchSequence.action === "focus" && Number.isInteger(tileIndex)) {
        requestTileFocus(tileIndex);
        lastPinchStartRef.current[hand.id] = null;
        doublePinchTriggered = true;
        break;
      }

      if (pinchSequence.action === "overview") {
        resetFocusedView();
        lastPinchStartRef.current[hand.id] = null;
        doublePinchTriggered = true;
        break;
      }

      lastPinchStartRef.current[hand.id] = pinchSequence.state;
    }

    const nextPinchStateByHand = {};
    for (const hand of handStates) {
      nextPinchStateByHand[hand.id] = Boolean(hand.pinchActive);
    }
    pinchActiveByHandRef.current = nextPinchStateByHand;

    if (showTrails) {
      setPointerTrails((previous) => {
        const next = { ...previous };
        for (const hand of handStates) {
          if (!hand.pointer) {
            continue;
          }
          const current = Array.isArray(next[hand.id]) ? next[hand.id].slice(-22) : [];
          current.push({
            x: hand.pointer.x * stageSize.width,
            y: hand.pointer.y * stageSize.height,
          });
          next[hand.id] = current;
        }
        for (const handId of Object.keys(next)) {
          if (!handStates.find((hand) => hand.id === handId)) {
            delete next[handId];
          }
        }
        return next;
      });
    } else if (Object.keys(pointerTrailsRef.current).length > 0) {
      setPointerTrails({});
    }

    if (shouldProcessDiscreteEvents) {
      const hasSymmetricSwipe = events.some((event) => event.gestureId === GESTURE_IDS.SYMMETRIC_SWIPE);

      const cycleScene = (step, hard) => {
        setSceneIndex((previous) => {
          const nextIndex = (previous + step + SCENES.length) % SCENES.length;
          sceneIndexRef.current = nextIndex;
          setPanels((currentPanels) =>
            applySceneLayout(currentPanels, nextIndex, stageSize, panelAssignments),
          );
          if (hard) {
            const resetTransform = getDefaultStageTransform(stageSize);
            stageViewModeRef.current = "overview";
            focusedTileIndexRef.current = null;
            setFocusedTileIndex(null);
            animateStageTransform(resetTransform);
            grabRef.current = null;
            setDraggedPanelId(null);
            twoHandManipRef.current = { active: false, base: null };
          }
          return nextIndex;
        });
      };

      const toggleNearestPanelSelection = (handId) => {
        const hand = handStates.find((candidate) => candidate.id === handId) ?? handStates[0] ?? null;
        if (!hand?.pointer) {
          return;
        }
        const pointerLocal = pointerToLocal(hand.pointer, stageSize, stageTransformRef.current);
        const nearest = nearestPanel(panelsRef.current, pointerLocal, 240);
        if (!nearest?.panel) {
          return;
        }

        const targetPanelId = nearest.panel.id;
        setSelectedPanelId((previousSelected) => (previousSelected === targetPanelId ? null : targetPanelId));
        setPanels((currentPanels) =>
          currentPanels.map((panel) => ({
            ...panel,
            selected: panel.id === targetPanelId ? !panel.selected : false,
          })),
        );
      };

      for (const event of events) {
        if (hasSymmetricSwipe && (event.gestureId === GESTURE_IDS.SWIPE_LEFT || event.gestureId === GESTURE_IDS.SWIPE_RIGHT)) {
          continue;
        }

        if (event.gestureId === GESTURE_IDS.SWIPE_LEFT) {
          cycleScene(-1, false);
        } else if (event.gestureId === GESTURE_IDS.SWIPE_RIGHT) {
          cycleScene(1, false);
        } else if (event.gestureId === GESTURE_IDS.SYMMETRIC_SWIPE) {
          const direction = event.meta?.direction === "left" ? -1 : 1;
          cycleScene(direction, true);
        } else if (event.gestureId === GESTURE_IDS.PUSH_FORWARD) {
          toggleNearestPanelSelection(event.handId);
        } else if (event.gestureId === GESTURE_IDS.CIRCLE) {
          resetFocusedView();
        }

        if (
          grabRef.current &&
          (event.gestureId === GESTURE_IDS.SWIPE_LEFT || event.gestureId === GESTURE_IDS.SWIPE_RIGHT) &&
          event.handId &&
          event.handId !== grabRef.current.handId &&
          event.confidence >= Math.max(0.82, confidenceThreshold + 0.08)
        ) {
          const throwDirection = event.gestureId === GESTURE_IDS.SWIPE_LEFT ? -1 : 1;
          const throwDistanceX = throwDirection * Math.max(220, stageSize.width * 0.44);
          const throwDistanceY = (event.meta?.velocity?.y ?? 0) * 160;
          const grabbed = grabRef.current;
          grabRef.current = null;
          setDraggedPanelId(null);

          setPanels((currentPanels) =>
            currentPanels.map((panel) => {
              if (panel.id !== grabbed.panelId) {
                return panel;
              }
              return clampMinorityReportPanelPosition(
                {
                  ...panel,
                  x: panel.x + throwDistanceX,
                  y: panel.y + throwDistanceY,
                  rotation: panel.rotation + throwDirection * 0.46,
                  throwingUntil: Date.now() + 650,
                },
                stageSize,
              );
            }),
          );
        }
      }
    }

    if (doublePinchTriggered) {
      return;
    }

    if (zoomGestureActive) {
      if (isStageTransformAnimating) {
        setIsStageTransformAnimating(false);
      }
      const currentTransform = normalizeMinorityReportStageTransform(stageTransformRef.current);
      if (!twoHandManipRef.current.active) {
        const baseLocalAnchor = pointerToLocal(
          twoHand.midpoint ?? { x: 0.5, y: 0.5 },
          stageSize,
          currentTransform,
        );
        twoHandManipRef.current = {
          active: true,
          base: {
            distance: twoHand.distance,
            transform: currentTransform,
            localAnchor: baseLocalAnchor,
          },
        };
        stageViewModeRef.current = "manual";
        if (focusedTileIndexRef.current !== null) {
          focusedTileIndexRef.current = null;
          setFocusedTileIndex(null);
        }
      }

      const base = twoHandManipRef.current.base;
      const nextTransform = getMinorityReportAnchoredZoomTransform({
        baseTransform: base.transform,
        baseDistance: base.distance,
        currentDistance: twoHand.distance,
        stageSize,
        baseLocalAnchor: base.localAnchor,
        currentMidpoint: twoHand.midpoint,
      });
      setStageTransform(nextTransform);
      stageTransformRef.current = nextTransform;
      grabRef.current = null;
      handInfoBoxDragRef.current = {
        Left: null,
        Right: null,
      };
      setDraggedPanelId(null);
    } else {
      twoHandManipRef.current = { active: false, base: null };
    }

    if (zoomGestureActive) {
      return;
    }

    const currentGrab = grabRef.current;
    if (currentGrab) {
      const hand = handStates.find((candidate) => candidate.id === currentGrab.handId) ?? null;
      if (!hand || !hand.pinchActive) {
        grabRef.current = null;
        setDraggedPanelId(null);
      } else {
        const localPointer = pointerToLocal(hand.pointer, stageSize, stageTransformRef.current);
        if (localPointer) {
          setPanels((currentPanels) =>
            currentPanels.map((panel) => {
              if (panel.id !== currentGrab.panelId) {
                return panel;
              }
              return clampMinorityReportPanelPosition(
                {
                  ...panel,
                  x: localPointer.x - currentGrab.offsetX,
                  y: localPointer.y - currentGrab.offsetY,
                  throwingUntil: 0,
                },
                stageSize,
              );
            }),
          );
        }
      }
      return;
    }

    for (const hand of handStates) {
      if (!hand.pinchActive) {
        continue;
      }
      const localPointer = pointerToLocal(hand.pointer, stageSize, stageTransformRef.current);
      const nearest = nearestPanel(panelsRef.current, localPointer, 168);
      if (!nearest?.panel) {
        continue;
      }

      grabRef.current = {
        handId: hand.id,
        panelId: nearest.panel.id,
        offsetX: localPointer.x - nearest.panel.x,
        offsetY: localPointer.y - nearest.panel.y,
      };
      setDraggedPanelId(nearest.panel.id);
      setSelectedPanelId(nearest.panel.id);
      setPanels((currentPanels) =>
        currentPanels.map((panel) => ({
          ...(panel.id === nearest.panel.id
            ? clampMinorityReportPanelPosition(
                {
                  ...panel,
                  selected: true,
                  throwingUntil: 0,
                },
                stageSize,
              )
            : {
                ...panel,
                selected: false,
              }),
        })),
      );
      break;
    }

    const nextBoxPositions = {
      ...handInfoBoxPositionsRef.current,
    };
    let didUpdateBoxPosition = false;
    for (const label of ["Left", "Right"]) {
      const hand = handStates.find((candidate) => candidate.label === label) ?? null;
      const dragState = handInfoBoxDragRef.current[label];
      if (!hand || !hand.pointer) {
        handInfoBoxDragRef.current[label] = null;
        continue;
      }

      const pointer = {
        x: hand.pointer.x * stageSize.width,
        y: hand.pointer.y * stageSize.height,
      };
      const box = nextBoxPositions[label] ?? HAND_INFO_BOX_DEFAULTS[label];

      if (!hand.pinchActive) {
        handInfoBoxDragRef.current[label] = null;
        continue;
      }

      if (!dragState) {
        const inside =
          pointer.x >= box.x &&
          pointer.x <= box.x + HAND_INFO_BOX_SIZE.width &&
          pointer.y >= box.y &&
          pointer.y <= box.y + HAND_INFO_BOX_SIZE.height;
        if (inside) {
          handInfoBoxDragRef.current[label] = {
            offsetX: pointer.x - box.x,
            offsetY: pointer.y - box.y,
          };
        } else {
          continue;
        }
      }

      const activeDragState = handInfoBoxDragRef.current[label];
      if (!activeDragState) {
        continue;
      }
      const proposed = clampInfoBoxPosition(
        {
          x: pointer.x - activeDragState.offsetX,
          y: pointer.y - activeDragState.offsetY,
        },
        stageSize,
      );
      if (Math.abs(proposed.x - box.x) > 0.1 || Math.abs(proposed.y - box.y) > 0.1) {
        nextBoxPositions[label] = proposed;
        didUpdateBoxPosition = true;
      }
    }
    if (didUpdateBoxPosition) {
      handInfoBoxPositionsRef.current = nextBoxPositions;
      setHandInfoBoxPositions(nextBoxPositions);
    }
  }, [
    confidenceThreshold,
    engineOutput,
    showTrails,
    stageSize,
  ]);

  return (
    <section className={panelClassName}>
      {immersive ? (
        <div className="minority-lab-overlay-controls">
          <div className="button-row compact">
            {onBack ? (
              <button type="button" className="secondary" onClick={onBack}>
                Back to Input Test
              </button>
            ) : null}
            {onReset ? (
              <button type="button" className="secondary" onClick={onReset}>
                Reset Lab Session
              </button>
            ) : null}
            <button
              type="button"
              className="secondary"
              aria-controls="minority-report-debug-panel"
              aria-expanded={isDebugPanelVisible}
              onClick={() => setIsDebugPanelVisible((previous) => !previous)}
            >
              {isDebugPanelVisible ? "Hide Detector Panel" : "Show Detector Panel"}
            </button>
          </div>
          {cameraError || modelError ? (
            <div className="minority-lab-errors">
              {cameraError ? <p className="error-text minority-lab-error">{cameraError}</p> : null}
              {modelError ? <p className="error-text minority-lab-error">{modelError}</p> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="minority-lab-header">
          <h2>Minority Report Lab</h2>
          <button
            type="button"
            className="secondary"
            aria-controls="minority-report-debug-panel"
            aria-expanded={isDebugPanelVisible}
            onClick={() => setIsDebugPanelVisible((previous) => !previous)}
          >
            {isDebugPanelVisible ? "Hide Detector Panel" : "Show Detector Panel"}
          </button>
        </div>
      )}

      <div className={layoutClassName}>
        <div className={stageShellClassName} ref={stageShellRef}>
          <div
            className="minority-stage"
            ref={(node) => {
              stageRef.current = node;
              if (cameraStageRef && typeof cameraStageRef === "object") {
                cameraStageRef.current = node;
              }
            }}
            style={{
              width: `${stageSize.width}px`,
              height: `${stageSize.height}px`,
            }}
          >
            <video
              ref={cameraVideoRef}
              className="camera-video minority-stage-video"
              style={{ objectFit: cameraObjectFit }}
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={cameraOverlayRef}
              className="camera-overlay minority-stage-camera-overlay"
            />
            <div
              className="minority-stage-transform"
              onDoubleClick={handleStageDoubleClick}
              style={{
                transform: `translate(${stageTransform.x}px, ${stageTransform.y}px) scale(${stageTransform.scale})`,
                transition: isStageTransformAnimating
                  ? `transform ${SECTOR_FOCUS_ANIMATION_MS}ms cubic-bezier(.2,.72,.2,1)`
                  : "none",
              }}
            >
              {superSectorElements}
              {tileElements}
              {panelElements}
            </div>

            {showTrails && (
              <svg className="lab-pointer-trails" viewBox={`0 0 ${stageSize.width} ${stageSize.height}`} preserveAspectRatio="none">
                {Object.entries(pointerTrails).map(([handId, trail]) => {
                  if (!Array.isArray(trail) || trail.length < 2) {
                    return null;
                  }
                  return (
                    <polyline
                      key={`trail-${handId}`}
                      points={trail.map((point) => `${point.x},${point.y}`).join(" ")}
                      className="lab-pointer-trail"
                    />
                  );
                })}
              </svg>
            )}

            {engineOutput?.hands?.map((hand) => (
              <div
                key={`pointer-${hand.id}`}
                className={`lab-hand-pointer ${hand.label === "Left" ? "left" : hand.label === "Right" ? "right" : "generic"} ${hand.pinchActive ? "pinched" : ""}`}
                style={{
                  left: `${hand.pointer.x * 100}%`,
                  top: `${hand.pointer.y * 100}%`,
                }}
              >
                <span>{hand.label ?? hand.id}</span>
              </div>
            ))}

            {["Left", "Right"].map((label) => {
              const hand = handsByLabel[label];
              const isDetected = Boolean(hand);
              const isDragging = Boolean(handInfoBoxDragRef.current[label]);
              const boxPosition = handInfoBoxPositions[label] ?? HAND_INFO_BOX_DEFAULTS[label];
              return (
                <div
                  key={`info-${label}`}
                  className={`lab-hand-infobox ${label === "Left" ? "left" : "right"} ${
                    isDetected ? "detected" : "missing"
                  } ${isDragging ? "dragging" : ""}`}
                  style={{
                    left: `${boxPosition.x}px`,
                    top: `${boxPosition.y}px`,
                  }}
                >
                  <h5>{label} Hand</h5>
                  <p>Status: {isDetected ? "detected" : "not detected"}</p>
                  <p>Pinch: {isDetected ? (hand.pinchActive ? "active" : "idle") : "n/a"}</p>
                  <p>
                    Pointer:{" "}
                    {isDetected
                      ? `${(hand.pointer?.x ?? 0).toFixed(3)}, ${(hand.pointer?.y ?? 0).toFixed(3)}`
                      : "n/a"}
                  </p>
                  <p className="hint">Pinch inside this box to drag</p>
                </div>
              );
            })}
          </div>
        </div>

        {isDebugPanelVisible && (
          <div id="minority-report-debug-panel" className={debugPanelClassName}>
            <GestureDebugPanel
              fps={fps}
              detectionStatus={detectionStatus}
              hands={engineOutput?.hands ?? []}
              confidences={engineOutput?.confidences}
              heuristicConfidences={engineOutput?.heuristicConfidences}
              personalizedConfidences={engineOutput?.personalizedConfidences}
              threshold={confidenceThreshold}
              onThresholdChange={onConfidenceThresholdChange}
              showSkeleton={showSkeleton}
              showTrails={showTrails}
              personalizationEnabled={personalizationEnabled}
              onToggleShowSkeleton={onShowSkeletonChange}
              onToggleShowTrails={onShowTrailsChange}
              onTogglePersonalization={onPersonalizationEnabledChange}
              eventLog={eventLog}
              onClearEventLog={onClearEventLog}
              trainingState={trainingState}
              sampleCounts={sampleCounts}
              onRecordGesture={onRecordGesture}
              onDeleteLastSample={onDeleteLastSample}
              onClearSamples={onClearSamples}
              onExportSamples={onExportSamples}
              onImportSamples={onImportSamples}
            />
          </div>
        )}
      </div>
    </section>
  );
}
