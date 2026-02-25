import { useEffect, useMemo, useRef, useState } from "react";
import GestureDebugPanel from "./GestureDebugPanel";
import { GESTURE_IDS } from "../gestures/constants";

const DESKTOP_COUNT = 3;
const STAGE_DEFAULT_SIZE = { width: 960, height: 640 };
const OPEN_PALM_HOLD_MS = 1000;

const WINDOW_PRESETS = [
  {
    id: "win-editor",
    title: "Notes.txt",
    appType: "editor",
    desktopId: 0,
    x: 220,
    y: 160,
    width: 340,
    height: 240,
  },
  {
    id: "win-image",
    title: "Image Viewer",
    appType: "image",
    desktopId: 0,
    x: 540,
    y: 210,
    width: 320,
    height: 220,
  },
  {
    id: "win-terminal",
    title: "Terminal Mock",
    appType: "terminal",
    desktopId: 1,
    x: 250,
    y: 220,
    width: 420,
    height: 230,
  },
  {
    id: "win-inspector",
    title: "System Monitor",
    appType: "terminal",
    desktopId: 2,
    x: 340,
    y: 180,
    width: 380,
    height: 250,
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapAngle(value) {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function createWindows() {
  return WINDOW_PRESETS.map((windowPreset, index) => ({
    ...windowPreset,
    rotation: 0,
    scale: 1,
    state: "normal",
    zIndex: index + 1,
    throwingUntil: 0,
  }));
}

function getWindowBounds(windowItem) {
  return {
    left: windowItem.x,
    top: windowItem.y,
    right: windowItem.x + windowItem.width,
    bottom: windowItem.y + windowItem.height,
  };
}

function findTopWindowAtPoint(windows, desktopId, point) {
  const visible = windows
    .filter((windowItem) => windowItem.desktopId === desktopId && windowItem.state !== "closed" && windowItem.state !== "minimized")
    .sort((first, second) => second.zIndex - first.zIndex);

  return (
    visible.find((windowItem) => {
      const bounds = getWindowBounds(windowItem);
      return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
    }) ?? null
  );
}

function getMenuActions(windowItem) {
  if (!windowItem) {
    return [];
  }
  return [
    windowItem.state === "maximized" ? "Restore" : "Maximize",
    windowItem.state === "minimized" ? "Restore" : "Minimize",
    "Close",
  ];
}

function renderMockApp(windowItem) {
  if (windowItem.appType === "editor") {
    return (
      <div className="gc-app editor">
        <p>Gesture Control OS demo notes:</p>
        <ul>
          <li>Pinch to move windows.</li>
          <li>Two-hand expand/compress for size states.</li>
          <li>Use swipe to switch virtual desktops.</li>
        </ul>
      </div>
    );
  }

  if (windowItem.appType === "image") {
    return (
      <div className="gc-app image">
        <div className="gc-image-placeholder">
          <span>Mock Landscape</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-app terminal">
      <p>&gt; boot gesture-control-os --demo</p>
      <p>&gt; workspace: {windowItem.desktopId + 1}</p>
      <p>&gt; focus: {windowItem.title}</p>
      <p>&gt; status: ready</p>
    </div>
  );
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
  const dragRef = useRef(null);
  const palmHoldRef = useRef({ Left: null, Right: null });
  const [stageSize, setStageSize] = useState(STAGE_DEFAULT_SIZE);
  const [windows, setWindows] = useState(createWindows);
  const [workspaceRotation, setWorkspaceRotation] = useState(0);
  const [activeDesktopId, setActiveDesktopId] = useState(0);
  const [focusedWindowId, setFocusedWindowId] = useState("win-editor");
  const [zCounter, setZCounter] = useState(WINDOW_PRESETS.length + 4);
  const [windowMenu, setWindowMenu] = useState({ open: false, windowId: null, selectedIndex: 0 });

  const windowsRef = useRef(windows);
  const focusedWindowRef = useRef(focusedWindowId);
  const activeDesktopRef = useRef(activeDesktopId);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    focusedWindowRef.current = focusedWindowId;
  }, [focusedWindowId]);

  useEffect(() => {
    activeDesktopRef.current = activeDesktopId;
  }, [activeDesktopId]);

  const handsByLabel = useMemo(() => {
    const map = { Left: null, Right: null };
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
    const stage = stageRef.current;
    if (!stage) return undefined;

    const syncSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    syncSize();
    const observer = window.ResizeObserver ? new ResizeObserver(syncSize) : null;
    observer?.observe(stage);
    window.addEventListener("resize", syncSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, []);

  useEffect(() => {
    const frameId = engineOutput?.frameId;
    if (!Number.isFinite(frameId)) {
      return;
    }

    const now = performance.now();
    const hands = Array.isArray(engineOutput?.hands) ? engineOutput.hands : [];
    const events = Array.isArray(engineOutput?.events) ? engineOutput.events : [];

    for (const hand of hands) {
      const label = hand.label === "Left" ? "Left" : hand.label === "Right" ? "Right" : null;
      if (!label) continue;
      if ((hand.openness ?? 0) > 1.25) {
        if (!palmHoldRef.current[label]) {
          palmHoldRef.current[label] = { startedAt: now };
        } else if (now - palmHoldRef.current[label].startedAt >= OPEN_PALM_HOLD_MS && !windowMenu.open) {
          const focused = windowsRef.current.find((windowItem) => windowItem.id === focusedWindowRef.current);
          if (focused && focused.desktopId === activeDesktopRef.current && focused.state !== "closed") {
            setWindowMenu({ open: true, windowId: focused.id, selectedIndex: 0 });
          }
        }
      } else {
        palmHoldRef.current[label] = null;
      }
    }

    const focusWindow = (windowId) => {
      setFocusedWindowId(windowId);
      setZCounter((previous) => {
        const nextZ = previous + 1;
        setWindows((current) =>
          current.map((windowItem) =>
            windowItem.id === windowId
              ? {
                  ...windowItem,
                  zIndex: nextZ,
                }
              : windowItem,
          ),
        );
        return nextZ;
      });
    };

    const applyWindowAction = (windowId, action) => {
      if (!windowId || !action) return;
      setWindows((current) =>
        current.map((windowItem) => {
          if (windowItem.id !== windowId) return windowItem;
          if (action === "Maximize") {
            return { ...windowItem, state: "maximized", x: 18, y: 18, width: stageSize.width - 36, height: stageSize.height - 36 };
          }
          if (action === "Minimize") {
            return { ...windowItem, state: "minimized" };
          }
          if (action === "Restore") {
            const base = WINDOW_PRESETS.find((entry) => entry.id === windowItem.id);
            return {
              ...windowItem,
              state: "normal",
              width: base?.width ?? windowItem.width,
              height: base?.height ?? windowItem.height,
              x: clamp(windowItem.x, 18, Math.max(18, stageSize.width - (base?.width ?? windowItem.width) - 18)),
              y: clamp(windowItem.y, 18, Math.max(18, stageSize.height - (base?.height ?? windowItem.height) - 18)),
            };
          }
          if (action === "Close") {
            return { ...windowItem, state: "closed" };
          }
          return windowItem;
        }),
      );
    };

    for (const event of events) {
      if (event.gestureId === GESTURE_IDS.SWIPE_LEFT) {
        setActiveDesktopId((previous) => (previous - 1 + DESKTOP_COUNT) % DESKTOP_COUNT);
      } else if (event.gestureId === GESTURE_IDS.SWIPE_RIGHT) {
        setActiveDesktopId((previous) => (previous + 1) % DESKTOP_COUNT);
      } else if (event.gestureId === GESTURE_IDS.EXPAND) {
        applyWindowAction(focusedWindowRef.current, "Maximize");
      } else if (event.gestureId === GESTURE_IDS.COMPRESS) {
        applyWindowAction(focusedWindowRef.current, "Minimize");
      } else if (event.gestureId === GESTURE_IDS.ROTATE_TWIST) {
        setWindows((current) =>
          current.map((windowItem) =>
            windowItem.id === focusedWindowRef.current
              ? { ...windowItem, rotation: wrapAngle(windowItem.rotation + 0.25) }
              : windowItem,
          ),
        );
        if (windowMenu.open) {
          setWorkspaceRotation((previous) => wrapAngle(previous + 0.18));
        }
      } else if (event.gestureId === GESTURE_IDS.SYMMETRIC_SWIPE) {
        applyWindowAction(focusedWindowRef.current, "Close");
      } else if (event.gestureId === GESTURE_IDS.PUSH_FORWARD && windowMenu.open) {
        const win = windowsRef.current.find((windowItem) => windowItem.id === windowMenu.windowId);
        const actions = getMenuActions(win);
        const action = actions[windowMenu.selectedIndex] ?? actions[0];
        applyWindowAction(windowMenu.windowId, action);
        setWindowMenu({ open: false, windowId: null, selectedIndex: 0 });
      }

      if (
        dragRef.current &&
        (event.gestureId === GESTURE_IDS.SWIPE_LEFT || event.gestureId === GESTURE_IDS.SWIPE_RIGHT) &&
        event.handId === dragRef.current.handId
      ) {
        const direction = event.gestureId === GESTURE_IDS.SWIPE_LEFT ? -1 : 1;
        setWindows((current) =>
          current.map((windowItem) =>
            windowItem.id === dragRef.current.windowId
              ? {
                  ...windowItem,
                  x: clamp(windowItem.x + direction * 220, 10, stageSize.width - windowItem.width - 10),
                  y: clamp(windowItem.y - 80, 10, stageSize.height - windowItem.height - 10),
                  rotation: wrapAngle(windowItem.rotation + direction * 0.28),
                  throwingUntil: Date.now() + 520,
                }
              : windowItem,
          ),
        );
      }
    }

    const currentDrag = dragRef.current;
    if (currentDrag) {
      const hand = hands.find((candidate) => candidate.id === currentDrag.handId);
      if (!hand?.pinchActive) {
        dragRef.current = null;
      } else {
        setWindows((current) =>
          current.map((windowItem) => {
            if (windowItem.id !== currentDrag.windowId || !hand.pointer) return windowItem;
            return {
              ...windowItem,
              x: clamp(hand.pointer.x * stageSize.width - currentDrag.offsetX, 6, stageSize.width - windowItem.width - 6),
              y: clamp(hand.pointer.y * stageSize.height - currentDrag.offsetY, 6, stageSize.height - windowItem.height - 6),
              throwingUntil: 0,
            };
          }),
        );
      }
      return;
    }

    for (const hand of hands) {
      if (!hand.pinchActive || !hand.pointer) continue;
      const point = { x: hand.pointer.x * stageSize.width, y: hand.pointer.y * stageSize.height };
      const targetWindow = findTopWindowAtPoint(windowsRef.current, activeDesktopRef.current, point);
      if (!targetWindow) continue;
      dragRef.current = {
        handId: hand.id,
        windowId: targetWindow.id,
        offsetX: point.x - targetWindow.x,
        offsetY: point.y - targetWindow.y,
      };
      focusWindow(targetWindow.id);
      break;
    }
  }, [engineOutput, stageSize, windowMenu.open, windowMenu.selectedIndex, windowMenu.windowId]);

  const focusedWindow = windows.find((windowItem) => windowItem.id === focusedWindowId) ?? null;
  const menuActions = getMenuActions(focusedWindow);

  return (
    <section className="card panel minority-lab-panel">
      <h2>Gesture Control OS</h2>
      <p className="small-text">Demo mode: desktop-like interaction with gesture chaining and multi-window focus.</p>
      <p className="small-text">
        Desktop {activeDesktopId + 1}/{DESKTOP_COUNT} · Focus: <strong>{focusedWindow?.title ?? "None"}</strong>
      </p>

      <div className="minority-lab-layout">
        <div className="minority-stage-shell">
          <div className="gesture-desktop-stage" ref={stageRef}>
            <div className="gesture-desktop-transform" style={{ transform: `rotate(${workspaceRotation}rad)` }}>
              {windows
                .filter((windowItem) => windowItem.desktopId === activeDesktopId && windowItem.state !== "closed")
                .map((windowItem) => {
                  const isFocused = windowItem.id === focusedWindowId;
                  return (
                    <article
                      key={windowItem.id}
                      className={`gc-window ${isFocused ? "focused" : ""} ${windowItem.state === "minimized" ? "minimized" : ""}`}
                      style={{
                        left: `${windowItem.x}px`,
                        top: `${windowItem.y}px`,
                        width: `${windowItem.width}px`,
                        height: `${windowItem.height}px`,
                        zIndex: windowItem.zIndex,
                        transform: `rotate(${windowItem.rotation}rad) scale(${windowItem.scale})`,
                        transition:
                          windowItem.throwingUntil > Date.now()
                            ? "left 500ms cubic-bezier(.16,.73,.21,1), top 500ms cubic-bezier(.16,.73,.21,1), transform 500ms cubic-bezier(.16,.73,.21,1)"
                            : "left 120ms linear, top 120ms linear, transform 120ms linear",
                      }}
                      onMouseDown={() => {
                        setFocusedWindowId(windowItem.id);
                      }}
                    >
                      <header className="gc-window-header">
                        <strong>{windowItem.title}</strong>
                        <span>{windowItem.state}</span>
                      </header>
                      <div className="gc-window-body">{renderMockApp(windowItem)}</div>
                    </article>
                  );
                })}
            </div>

            {windowMenu.open && focusedWindow && (
              <div className="gc-window-menu">
                <h4>Window Menu</h4>
                {menuActions.map((action, index) => (
                  <button
                    type="button"
                    key={action}
                    className={index === windowMenu.selectedIndex ? "selected" : ""}
                    onClick={() => setWindowMenu((current) => ({ ...current, selectedIndex: index }))}
                  >
                    {action}
                  </button>
                ))}
                <small>Push forward to confirm selected action.</small>
              </div>
            )}

            {engineOutput?.hands?.map((hand) => (
              <div
                key={`cursor-${hand.id}`}
                className={`gc-cursor ${hand.label === "Left" ? "left" : hand.label === "Right" ? "right" : "generic"} ${hand.pinchActive ? "pinched" : ""}`}
                style={{ left: `${(hand.pointer?.x ?? 0) * 100}%`, top: `${(hand.pointer?.y ?? 0) * 100}%` }}
              >
                <span>{hand.label ?? hand.id}</span>
              </div>
            ))}

            <div className="gc-desktop-indicator-strip">
              {Array.from({ length: DESKTOP_COUNT }).map((_, index) => (
                <div key={`desktop-${index}`} className={`gc-desktop-pill ${index === activeDesktopId ? "active" : ""}`}>
                  D{index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="gc-side-stack">
          <div className="gesture-debug-section">
            <h3>Window State Inspector</h3>
            <div className="gc-inspector-list">
              {windows.map((windowItem) => (
                <div key={`inspect-${windowItem.id}`} className={`gc-inspector-row ${windowItem.id === focusedWindowId ? "focused" : ""}`}>
                  <strong>{windowItem.title}</strong>
                  <span>Desktop: {windowItem.desktopId + 1}</span>
                  <span>State: {windowItem.state}</span>
                  <span>
                    x:{windowItem.x.toFixed(0)} y:{windowItem.y.toFixed(0)} z:{windowItem.zIndex}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
      </div>
    </section>
  );
}
