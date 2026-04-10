import { useEffect, useMemo, useRef, useState } from "react";
import GestureDebugPanel from "./GestureDebugPanel.jsx";
import { GESTURE_IDS } from "../gestures/constants.js";

const PANEL_WIDTH = 196;
const PANEL_HEIGHT = 124;
const PANEL_COUNT = 6;
const STAGE_DEFAULT_SIZE = { width: 960, height: 640 };
const HAND_INFO_BOX_SIZE = { width: 170, height: 88 };
const HAND_INFO_BOX_MARGIN = 10;
const DEFAULT_STAGE_TRANSFORM = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

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

function wrapAngle(value) {
  let angle = value;
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

function scenePoint(sceneIndex, cardIndex, width, height) {
  const safeWidth = Math.max(360, width);
  const safeHeight = Math.max(280, height);
  const centerX = safeWidth * 0.5;
  const centerY = safeHeight * 0.5;

  if (sceneIndex === 0) {
    const colCount = 3;
    const rowCount = Math.ceil(PANEL_COUNT / colCount);
    const col = cardIndex % colCount;
    const row = Math.floor(cardIndex / colCount);
    const spanX = Math.min(620, safeWidth * 0.72);
    const spanY = Math.min(340, safeHeight * 0.62);
    return {
      x: centerX + (col / Math.max(1, colCount - 1) - 0.5) * spanX,
      y: centerY + (row / Math.max(1, rowCount - 1) - 0.5) * spanY,
      rotation: (col - 1) * 0.06,
      scale: 1,
    };
  }

  if (sceneIndex === 1) {
    const bandY = centerY + (cardIndex % 2 === 0 ? -68 : 68);
    const minX = safeWidth * 0.12;
    const maxX = safeWidth * 0.88;
    const t = cardIndex / Math.max(1, PANEL_COUNT - 1);
    return {
      x: minX + t * (maxX - minX),
      y: bandY,
      rotation: (t - 0.5) * 0.22,
      scale: 0.95 + (cardIndex % 3) * 0.04,
    };
  }

  const radiusX = Math.min(290, safeWidth * 0.3);
  const radiusY = Math.min(190, safeHeight * 0.26);
  const angle = (-Math.PI * 0.5) + (cardIndex / PANEL_COUNT) * (Math.PI * 2);
  return {
    x: centerX + Math.cos(angle) * radiusX,
    y: centerY + Math.sin(angle) * radiusY,
    rotation: angle * 0.35,
    scale: 0.94 + Math.sin(angle * 2) * 0.06,
  };
}

function createPanels(sceneIndex, stageSize) {
  const width = stageSize?.width ?? STAGE_DEFAULT_SIZE.width;
  const height = stageSize?.height ?? STAGE_DEFAULT_SIZE.height;

  return Array.from({ length: PANEL_COUNT }, (_, index) => {
    const scenePlacement = scenePoint(sceneIndex, index, width, height);
    return {
      id: `panel-${index + 1}`,
      title: PANEL_TITLES[index % PANEL_TITLES.length],
      subtitle: `Node ${index + 1}`,
      x: scenePlacement.x,
      y: scenePlacement.y,
      rotation: scenePlacement.rotation,
      scale: scenePlacement.scale,
      selected: false,
      throwingUntil: 0,
    };
  });
}

function applySceneLayout(existingPanels, sceneIndex, stageSize) {
  const width = stageSize?.width ?? STAGE_DEFAULT_SIZE.width;
  const height = stageSize?.height ?? STAGE_DEFAULT_SIZE.height;
  return existingPanels.map((panel, index) => {
    const nextPlacement = scenePoint(sceneIndex, index, width, height);
    return {
      ...panel,
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
  const translatedX = px - centerX - transform.x;
  const translatedY = py - centerY - transform.y;

  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);
  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;

  return {
    x: rotatedX / Math.max(0.001, transform.scale) + centerX,
    y: rotatedY / Math.max(0.001, transform.scale) + centerY,
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

function clampPanelPosition(panel, stageSize) {
  const halfWidth = PANEL_WIDTH * 0.5;
  const halfHeight = PANEL_HEIGHT * 0.5;
  return {
    ...panel,
    x: clamp(panel.x, halfWidth, stageSize.width - halfWidth),
    y: clamp(panel.y, halfHeight, stageSize.height - halfHeight),
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
  } = props;

  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState(STAGE_DEFAULT_SIZE);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [stageTransform, setStageTransform] = useState(DEFAULT_STAGE_TRANSFORM);
  const [panels, setPanels] = useState(() => createPanels(0, STAGE_DEFAULT_SIZE));
  const [selectedPanelId, setSelectedPanelId] = useState(null);
  const [draggedPanelId, setDraggedPanelId] = useState(null);
  const [pointerTrails, setPointerTrails] = useState({});
  const [handInfoBoxPositions, setHandInfoBoxPositions] = useState(HAND_INFO_BOX_DEFAULTS);
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);

  const panelsRef = useRef(panels);
  const sceneIndexRef = useRef(sceneIndex);
  const stageTransformRef = useRef(stageTransform);
  const grabRef = useRef(null);
  const twoHandManipRef = useRef({ active: false, base: null });
  const pointerTrailsRef = useRef(pointerTrails);
  const handInfoBoxPositionsRef = useRef(handInfoBoxPositions);
  const processedEventsFrameRef = useRef(-1);
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
    pointerTrailsRef.current = pointerTrails;
  }, [pointerTrails]);

  useEffect(() => {
    handInfoBoxPositionsRef.current = handInfoBoxPositions;
  }, [handInfoBoxPositions]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }

    const syncSize = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
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
    observer.observe(stage);
    window.addEventListener("resize", syncSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, []);

  const dragBoundsStyle = useMemo(() => {
    const insetX = Math.min(PANEL_WIDTH * 0.5, stageSize.width * 0.5);
    const insetY = Math.min(PANEL_HEIGHT * 0.5, stageSize.height * 0.5);
    return {
      left: `${insetX}px`,
      top: `${insetY}px`,
      width: `${Math.max(0, stageSize.width - insetX * 2)}px`,
      height: `${Math.max(0, stageSize.height - insetY * 2)}px`,
    };
  }, [stageSize]);
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

  useEffect(() => {
    setPanels((previous) => {
      if (previous.length === 0) {
        return createPanels(sceneIndexRef.current, stageSize);
      }
      return previous.map((panel) => clampPanelPosition(panel, stageSize));
    });
    setHandInfoBoxPositions((previous) => ({
      Left: clampInfoBoxPosition(previous.Left ?? HAND_INFO_BOX_DEFAULTS.Left, stageSize),
      Right: clampInfoBoxPosition(previous.Right ?? HAND_INFO_BOX_DEFAULTS.Right, stageSize),
    }));
  }, [stageSize]);

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
          setPanels((currentPanels) => applySceneLayout(currentPanels, nextIndex, stageSize));
          if (hard) {
            setStageTransform(DEFAULT_STAGE_TRANSFORM);
            stageTransformRef.current = DEFAULT_STAGE_TRANSFORM;
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
          setStageTransform(DEFAULT_STAGE_TRANSFORM);
          stageTransformRef.current = DEFAULT_STAGE_TRANSFORM;
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
              return {
                ...panel,
                x: panel.x + throwDistanceX,
                y: panel.y + throwDistanceY,
                rotation: panel.rotation + throwDirection * 0.46,
                throwingUntil: Date.now() + 650,
              };
            }),
          );
        }
      }
    }

    if (twoHand.present && engineOutput?.continuous?.twoHandManipulationActive) {
      const currentTransform = stageTransformRef.current;
      if (!twoHandManipRef.current.active) {
        twoHandManipRef.current = {
          active: true,
          base: {
            distance: twoHand.distance,
            angle: twoHand.angle,
            midpoint: twoHand.midpoint,
            transform: currentTransform,
          },
        };
      }

      const base = twoHandManipRef.current.base;
      const distanceRatio = twoHand.distance / Math.max(0.02, base.distance);
      const deltaAngle = wrapAngle(twoHand.angle - base.angle);
      const moveX = (twoHand.midpoint.x - base.midpoint.x) * stageSize.width;
      const moveY = (twoHand.midpoint.y - base.midpoint.y) * stageSize.height;
      const nextTransform = {
        x: base.transform.x + moveX,
        y: base.transform.y + moveY,
        scale: clamp(base.transform.scale * distanceRatio, 0.45, 2.6),
        rotation: wrapAngle(base.transform.rotation + deltaAngle),
      };
      setStageTransform(nextTransform);
      stageTransformRef.current = nextTransform;
      grabRef.current = null;
      setDraggedPanelId(null);
    } else {
      twoHandManipRef.current = { active: false, base: null };
    }

    if (engineOutput?.continuous?.twoHandManipulationActive) {
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
              return clampPanelPosition(
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
            ? clampPanelPosition(
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
    <section className="card panel minority-lab-panel">
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

      <div className={`minority-lab-layout ${isDebugPanelVisible ? "" : "debug-collapsed"}`}>
        <div className="minority-stage-shell">
          <div className="minority-stage" ref={stageRef}>
            <div className="minority-stage-transform" style={{
              transform: `translate(${stageTransform.x}px, ${stageTransform.y}px) rotate(${stageTransform.rotation}rad) scale(${stageTransform.scale})`,
            }}>
              <div
                className="minority-stage-drag-bounds"
                style={dragBoundsStyle}
                aria-hidden="true"
              />
              {panels.map((panel) => (
                <article
                  key={panel.id}
                  className={`minority-panel-card ${panel.selected ? "selected" : ""} ${selectedPanelId === panel.id ? "focused" : ""}`}
                  style={{
                    left: `${panel.x}px`,
                    top: `${panel.y}px`,
                    transform: `translate(-50%, -50%) rotate(${panel.rotation}rad) scale(${panel.scale})`,
                    transition:
                      draggedPanelId === panel.id
                        ? "none"
                        : panel.throwingUntil > Date.now()
                        ? "left 620ms cubic-bezier(.09,.67,.22,.98), top 620ms cubic-bezier(.09,.67,.22,.98), transform 620ms cubic-bezier(.09,.67,.22,.98), box-shadow 220ms ease"
                        : "left 120ms linear, top 120ms linear, transform 120ms linear, box-shadow 150ms ease",
                  }}
                >
                  <h4>{panel.title}</h4>
                  <p>{panel.subtitle}</p>
                  <small>
                    x:{panel.x.toFixed(0)} y:{panel.y.toFixed(0)} r:{(panel.rotation * 57.2958).toFixed(0)}° s:{panel.scale.toFixed(2)}
                  </small>
                </article>
              ))}
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
          <div id="minority-report-debug-panel">
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
