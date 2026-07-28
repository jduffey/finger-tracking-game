import { useEffect, useMemo, useRef, useState } from "react";
import {
  FOREST_DISCOVERIES,
  createManualForestOffAxis,
  getForestDiscoveryReveal,
  getForestTrailState,
  isForestDiscoveryFound,
  moveManualForestView,
  normalizeForestView,
} from "../offAxisForestDiscovery.js";
import "./OffAxisChamberLab.css";

const FIREFLIES = [
  { x: 14, y: 18, size: 7, delay: 0.2, duration: 5.6 },
  { x: 22, y: 54, size: 6, delay: 1.4, duration: 6.8 },
  { x: 35, y: 26, size: 9, delay: 0.8, duration: 7.1 },
  { x: 52, y: 20, size: 8, delay: 1.7, duration: 6.2 },
  { x: 66, y: 46, size: 7, delay: 0.5, duration: 7.6 },
  { x: 81, y: 24, size: 8, delay: 2.1, duration: 5.9 },
  { x: 88, y: 58, size: 6, delay: 1.1, duration: 6.7 },
];

const INPUT_MODES = Object.freeze({
  HEAD: "head",
  MANUAL: "manual",
});

const TRAIL_PHASES = Object.freeze({
  INTRO: "intro",
  PLAYING: "playing",
  COMPLETE: "complete",
});

function formatSigned(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export default function OffAxisChamberLab({ poseStatus }) {
  const offAxis = poseStatus?.offAxis;
  const tracked = Boolean(offAxis?.detected);
  const [inputMode, setInputMode] = useState(INPUT_MODES.HEAD);
  const [manualView, setManualView] = useState({ x: 0, y: 0 });
  const [trailPhase, setTrailPhase] = useState(TRAIL_PHASES.INTRO);
  const [foundIds, setFoundIds] = useState([]);
  const [armedDiscoveryId, setArmedDiscoveryId] = useState(null);
  const [announcement, setAnnouncement] = useState(
    "Three forest guardians are waiting along the trail.",
  );
  const stageRef = useRef(null);

  const usingHeadTracking = inputMode === INPUT_MODES.HEAD;
  const inputReady = usingHeadTracking ? tracked : true;
  const activeView = useMemo(
    () =>
      usingHeadTracking
        ? normalizeForestView({
            x: offAxis?.offsetX,
            y: offAxis?.offsetY,
          })
        : normalizeForestView(manualView),
    [manualView, offAxis?.offsetX, offAxis?.offsetY, usingHeadTracking],
  );
  const visualOffAxis = useMemo(
    () => (usingHeadTracking ? offAxis : createManualForestOffAxis(activeView)),
    [activeView, offAxis, usingHeadTracking],
  );
  const trailState = useMemo(() => getForestTrailState(foundIds), [foundIds]);
  const activeDiscovery = trailState.activeDiscovery;
  const activeReveal =
    trailPhase === TRAIL_PHASES.PLAYING
      ? getForestDiscoveryReveal(activeDiscovery, activeView)
      : 0;

  useEffect(() => {
    if (
      trailPhase !== TRAIL_PHASES.PLAYING ||
      !inputReady ||
      !activeDiscovery
    ) {
      return;
    }

    if (armedDiscoveryId !== activeDiscovery.id) {
      if (activeReveal <= 0.15) {
        setArmedDiscoveryId(activeDiscovery.id);
      }
      return;
    }

    if (!isForestDiscoveryFound(activeDiscovery, activeView)) {
      return;
    }

    const completingTrail =
      trailState.foundCount + 1 === trailState.totalCount;
    setFoundIds((currentFoundIds) =>
      currentFoundIds.includes(activeDiscovery.id)
        ? currentFoundIds
        : [...currentFoundIds, activeDiscovery.id],
    );
    setArmedDiscoveryId(null);
    setAnnouncement(
      completingTrail
        ? `${activeDiscovery.name} discovered. Trail survey complete.`
        : `${activeDiscovery.name} discovered. The next clue is ready.`,
    );
    if (completingTrail) {
      setTrailPhase(TRAIL_PHASES.COMPLETE);
    }
  }, [
    activeDiscovery,
    activeReveal,
    activeView,
    armedDiscoveryId,
    inputReady,
    trailPhase,
    trailState.foundCount,
    trailState.totalCount,
  ]);

  const sceneStyle = {
    "--offaxis-shift-x": `${visualOffAxis?.cameraShiftXPx ?? 0}px`,
    "--offaxis-shift-y": `${visualOffAxis?.cameraShiftYPx ?? 0}px`,
    "--offaxis-rotate-y": `${visualOffAxis?.chamberRotationDeg ?? 0}deg`,
    "--offaxis-rotate-x": `${visualOffAxis?.chamberPitchDeg ?? 0}deg`,
    "--offaxis-skew-x": `${visualOffAxis?.skewXDeg ?? 0}deg`,
    "--offaxis-skew-y": `${visualOffAxis?.skewYDeg ?? 0}deg`,
    "--offaxis-inset": `${Math.max(6, visualOffAxis?.viewportInset ?? 22)}px`,
    "--offaxis-depth-boost": `${((visualOffAxis?.depth ?? 0) * 20).toFixed(3)}px`,
  };

  function beginTrail() {
    setFoundIds([]);
    setArmedDiscoveryId(null);
    setTrailPhase(TRAIL_PHASES.PLAYING);
    setAnnouncement(
      `Trail survey started. First clue: ${FOREST_DISCOVERIES[0].instruction}`,
    );
    if (!usingHeadTracking) {
      stageRef.current?.focus();
    }
  }

  function replayTrail() {
    setManualView({ x: 0, y: 0 });
    setFoundIds([]);
    setArmedDiscoveryId(null);
    setTrailPhase(TRAIL_PHASES.PLAYING);
    setAnnouncement(
      `Trail reset. First clue: ${FOREST_DISCOVERIES[0].instruction}`,
    );
    if (!usingHeadTracking) {
      stageRef.current?.focus();
    }
  }

  function selectInputMode(nextMode) {
    setInputMode(nextMode);
    setArmedDiscoveryId(null);
    if (nextMode === INPUT_MODES.MANUAL) {
      setManualView({ x: 0, y: 0 });
      setAnnouncement(
        "Pointer and keyboard controls ready. Move across the forest or use the arrow keys.",
      );
    } else {
      setAnnouncement(
        tracked
          ? "Head tracking selected. Lean naturally to look around."
          : "Head tracking selected. Move your face into the camera frame.",
      );
    }
  }

  function updateManualViewFromPointer(event) {
    if (usingHeadTracking) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }
    setManualView(
      normalizeForestView({
        x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        y: (0.5 - (event.clientY - bounds.top) / bounds.height) * 2,
      }),
    );
  }

  function handlePointerDown(event) {
    if (usingHeadTracking) {
      return;
    }
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateManualViewFromPointer(event);
  }

  function handleStageKeyDown(event) {
    if (usingHeadTracking) {
      return;
    }
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
      ].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    setManualView((currentView) =>
      moveManualForestView(currentView, event.key, event.shiftKey ? 0.08 : 0.14),
    );
  }

  return (
    <section className="card panel offaxis-panel offaxis-discovery-panel">
      <header className="offaxis-discovery-header">
        <div>
          <p className="offaxis-discovery-eyebrow">
            Experimental tracking lab · On-device head pose
          </p>
          <h2>Parallax Forest: Guardian Trail</h2>
          <p className="small-text">
            Survey three hidden forest guardians by changing your viewpoint. Nearby
            trees move faster than distant hills, turning the original parallax
            demo into a short trail of discoveries.
          </p>
        </div>
        <div className="offaxis-lab-truth">
          <strong>A simulated window-depth effect</strong>
          <span>This is not room scanning or true 3D reconstruction.</span>
        </div>
      </header>

      <div className="offaxis-discovery-toolbar">
        <fieldset className="offaxis-input-picker">
          <legend>Look around with</legend>
          <div className="offaxis-input-options">
            <button
              aria-pressed={usingHeadTracking}
              className={usingHeadTracking ? "selected" : ""}
              onClick={() => selectInputMode(INPUT_MODES.HEAD)}
              type="button"
            >
              Head tracking
            </button>
            <button
              aria-pressed={!usingHeadTracking}
              className={!usingHeadTracking ? "selected" : ""}
              onClick={() => selectInputMode(INPUT_MODES.MANUAL)}
              type="button"
            >
              Pointer + keys
            </button>
          </div>
          <span className="offaxis-input-status">
            {usingHeadTracking
              ? tracked
                ? "Head detected"
                : offAxis?.status ?? "Waiting for a head"
              : "Move, drag, or use arrow keys"}
          </span>
        </fieldset>

        <div className="offaxis-trail-progress">
          <div>
            <span>Trail survey</span>
            <strong>
              {trailState.foundCount}/{trailState.totalCount}
            </strong>
          </div>
          <progress
            aria-label={`${trailState.foundCount} of ${trailState.totalCount} forest guardians discovered`}
            max={trailState.totalCount}
            value={trailState.foundCount}
          />
        </div>
      </div>

      {trailPhase === TRAIL_PHASES.INTRO ? (
        <div className="offaxis-mission-card">
          <div>
            <span className="offaxis-mission-label">Your objective</span>
            <strong>Find the owl, fox, and canopy moth in order.</strong>
            <p>
              Follow each movement clue. A guardian brightens as the parallax
              view reveals it; cross the reveal point to log the discovery.
            </p>
          </div>
          <button className="primary" onClick={beginTrail} type="button">
            Begin forest survey
          </button>
        </div>
      ) : trailPhase === TRAIL_PHASES.COMPLETE ? (
        <div className="offaxis-result-card" role="status">
          <div className="offaxis-result-mark" aria-hidden="true">
            ✓
          </div>
          <div>
            <span className="offaxis-mission-label">Trail surveyed</span>
            <strong>All three guardians discovered</strong>
            <p>
              You used foreground, midground, and canopy motion to read depth
              from a flat scene.
            </p>
          </div>
          <button className="primary" onClick={replayTrail} type="button">
            Walk the trail again
          </button>
        </div>
      ) : null}

      <div
        aria-describedby="offaxis-stage-instructions"
        aria-label={
          usingHeadTracking
            ? "Head-tracked parallax forest"
            : "Keyboard and pointer-controlled parallax forest"
        }
        className={`offaxis-chamber-stage ${
          inputReady ? "tracked" : "idle"
        } ${usingHeadTracking ? "head-input" : "manual-input"}`}
        onKeyDown={handleStageKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={updateManualViewFromPointer}
        ref={stageRef}
        role="group"
        style={sceneStyle}
        tabIndex={usingHeadTracking ? -1 : 0}
      >
        <div className="offaxis-screen-frame">
          <div className="offaxis-chamber-view offaxis-forest-view">
            <div className="offaxis-chamber-layer offaxis-forest-sky" />
            <div className="offaxis-chamber-layer offaxis-forest-far-hills" />
            <div className="offaxis-chamber-layer offaxis-forest-mid-trees">
              <span className="tree tree-a" />
              <span className="tree tree-b" />
              <span className="tree tree-c" />
              <span className="tree tree-d" />
              <span className="tree tree-e" />
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-path" />
            <div
              aria-hidden="true"
              className="offaxis-chamber-layer offaxis-forest-discoveries"
            >
              {FOREST_DISCOVERIES.map((discovery) => {
                const found = foundIds.includes(discovery.id);
                const active = activeDiscovery?.id === discovery.id;
                const reveal = found ? 1 : active ? activeReveal : 0;
                return (
                  <span
                    className={`forest-discovery-marker ${
                      found ? "found" : active ? "active" : "locked"
                    }`}
                    data-discovery-id={discovery.id}
                    key={discovery.id}
                    style={{
                      "--forest-marker-blur": `${((1 - reveal) * 3).toFixed(2)}px`,
                      "--forest-marker-opacity": (reveal * 0.96).toFixed(3),
                      "--forest-marker-saturation": (
                        0.65 +
                        reveal * 0.65
                      ).toFixed(3),
                      "--forest-marker-scale": (
                        0.66 +
                        reveal * 0.34
                      ).toFixed(3),
                      "--forest-reveal": reveal.toFixed(3),
                      left: `${discovery.position.x}%`,
                      top: `${discovery.position.y}%`,
                    }}
                  >
                    <span className="forest-discovery-glyph">
                      {discovery.glyph}
                    </span>
                    <span className="forest-discovery-name">
                      {discovery.name}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-near-trees">
              <span className="tree tree-left" />
              <span className="tree tree-right" />
              <span className="tree tree-center-left" />
              <span className="tree tree-center-right" />
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-foreground">
              <span className="fern fern-left" />
              <span className="fern fern-center" />
              <span className="fern fern-right" />
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-fireflies">
              {FIREFLIES.map((firefly, index) => (
                <span
                  className="firefly"
                  key={`${firefly.x}-${firefly.y}-${index}`}
                  style={{
                    animationDelay: `${firefly.delay}s`,
                    animationDuration: `${firefly.duration}s`,
                    height: `${firefly.size}px`,
                    left: `${firefly.x}%`,
                    top: `${firefly.y}%`,
                    width: `${firefly.size}px`,
                  }}
                />
              ))}
            </div>
            {usingHeadTracking && !tracked && (
              <div className="offaxis-empty-state">
                <strong>Bring your face into frame</strong>
                <span>
                  Show your nose and both eyes, or choose Pointer + keys above.
                </span>
              </div>
            )}
          </div>
        </div>

        {trailPhase === TRAIL_PHASES.PLAYING && activeDiscovery ? (
          <div className="offaxis-active-clue">
            <span>
              Clue {trailState.activeIndex + 1} of {trailState.totalCount}
            </span>
            <strong>{activeDiscovery.name}</strong>
            <p>
              {armedDiscoveryId !== activeDiscovery.id && activeReveal > 0.15
                ? "Return toward the center to reset your viewpoint, then follow the clue."
                : activeDiscovery.instruction}
            </p>
            <div
              aria-hidden="true"
              className="offaxis-reveal-meter"
              style={{ "--forest-reveal": activeReveal.toFixed(3) }}
            >
              <span />
            </div>
          </div>
        ) : null}
      </div>

      <p className="offaxis-stage-instructions" id="offaxis-stage-instructions">
        {usingHeadTracking
          ? "Sit about an arm’s length away and make small, comfortable leans. No large movement is needed."
          : "Move or drag across the scene. With the scene focused, use arrow keys to look and Home to recenter; hold Shift for smaller steps."}
      </p>

      <details className="offaxis-readout">
        <summary>Open tracking lab readout</summary>
        <div className="offaxis-status-grid">
          <div>
            <strong>Input</strong>
            <span>{usingHeadTracking ? "Head pose" : "Pointer / keys"}</span>
          </div>
          <div>
            <strong>Tracking</strong>
            <span>
              {usingHeadTracking
                ? offAxis?.status ?? "Head not detected"
                : "Manual fallback active"}
            </span>
          </div>
          <div>
            <strong>Confidence</strong>
            <span>
              {usingHeadTracking && Number.isFinite(offAxis?.confidence)
                ? offAxis.confidence.toFixed(3)
                : "—"}
            </span>
          </div>
          <div>
            <strong>View X</strong>
            <span>{formatSigned(activeView.x)}</span>
          </div>
          <div>
            <strong>View Y</strong>
            <span>{formatSigned(activeView.y)}</span>
          </div>
          <div>
            <strong>Depth estimate</strong>
            <span>
              {usingHeadTracking
                ? formatSigned(offAxis?.depth ?? 0)
                : "Not used"}
            </span>
          </div>
        </div>
      </details>

      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
