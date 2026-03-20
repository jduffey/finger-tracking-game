import { useRef } from "react";
import { GESTURE_DEFINITIONS } from "../gestures/constants.js";

function formatPercent(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Math.round(safe * 100)}%`;
}

function formatPointer(pointer) {
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
    return "n/a";
  }
  return `${pointer.x.toFixed(3)}, ${pointer.y.toFixed(3)}`;
}

function getHandControlLabel(hand, fallback = "Pinch") {
  return hand?.controlLabel ?? fallback;
}

function getHandControlActive(hand) {
  if (typeof hand?.controlActive === "boolean") {
    return hand.controlActive;
  }
  return Boolean(hand?.pinchActive);
}

export default function GestureDebugPanel(props) {
  const importInputRef = useRef(null);

  const {
    fps,
    detectionStatus,
    hands,
    confidences,
    heuristicConfidences,
    personalizedConfidences,
    threshold,
    onThresholdChange,
    showSkeleton,
    showTrails,
    personalizationEnabled,
    onToggleShowSkeleton,
    onToggleShowTrails,
    onTogglePersonalization,
    eventLog,
    onClearEventLog,
    trainingState,
    sampleCounts,
    onRecordGesture,
    onDeleteLastSample,
    onClearSamples,
    onExportSamples,
    onImportSamples,
  } = props;

  const handByLabel = {
    Left: null,
    Right: null,
  };
  const otherHands = [];
  if (Array.isArray(hands)) {
    for (const hand of hands) {
      if (hand?.label === "Left") {
        handByLabel.Left = hand;
      } else if (hand?.label === "Right") {
        handByLabel.Right = hand;
      } else if (hand) {
        otherHands.push(hand);
      }
    }
  }

  return (
    <aside className="gesture-debug-panel">
      <div className="gesture-debug-section detection-status">
        <h3>Detector Status</h3>
        <p>FPS: {Number.isFinite(fps) ? fps.toFixed(1) : "0.0"}</p>
        <p>Hands: {detectionStatus?.handsCount ?? 0}</p>
        <p>Inference: {detectionStatus?.inferenceBusy ? "busy" : "idle"}</p>
        <p>Tracking: {detectionStatus?.handDetected ? "visible" : "not detected"}</p>

        <div className="hand-status-list">
          {["Left", "Right"].map((label) => {
            const hand = handByLabel[label];
            const isDetected = Boolean(hand);
            return (
              <div
                className={`hand-status-item ${isDetected ? "detected" : "missing"}`}
                key={`status-${label}`}
              >
                <strong>{label} Hand</strong>
                <span>Status: {isDetected ? "detected" : "not detected"}</span>
                <span>{getHandControlLabel(hand)}: {isDetected ? (getHandControlActive(hand) ? "active" : "idle") : "n/a"}</span>
                <span>Pointer: {isDetected ? formatPointer(hand.pointer) : "n/a"}</span>
                <span>Velocity: {isDetected ? (hand.velocity?.speed ?? 0).toFixed(3) : "n/a"}</span>
              </div>
            );
          })}
          {otherHands.map((hand) => (
            <div className="hand-status-item" key={`other-${hand.id}`}>
              <strong>{hand.label ?? hand.id}</strong>
              <span>Status: detected</span>
              <span>{getHandControlLabel(hand)}: {getHandControlActive(hand) ? "active" : "idle"}</span>
              <span>Pointer: {formatPointer(hand.pointer)}</span>
              <span>Velocity: {(hand.velocity?.speed ?? 0).toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="gesture-debug-section">
        <h3>Controls</h3>
        <label className="slider-row">
          Confidence threshold: <strong>{threshold.toFixed(2)}</strong>
          <input
            type="range"
            min="0.35"
            max="0.95"
            step="0.01"
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
          />
        </label>

        <label className="debug-toggle-row">
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={(event) => onToggleShowSkeleton(event.target.checked)}
          />
          Show skeleton overlay
        </label>

        <label className="debug-toggle-row">
          <input
            type="checkbox"
            checked={showTrails}
            onChange={(event) => onToggleShowTrails(event.target.checked)}
          />
          Show pointer trails
        </label>

        <label className="debug-toggle-row">
          <input
            type="checkbox"
            checked={personalizationEnabled}
            onChange={(event) => onTogglePersonalization(event.target.checked)}
          />
          Enable personalization
        </label>
      </div>

      <div className="gesture-debug-section">
        <h3>Confidence Bars</h3>
        <div className="gesture-confidence-list">
          {GESTURE_DEFINITIONS.map((gesture) => {
            const confidence = confidences?.[gesture.id] ?? 0;
            const heuristic = heuristicConfidences?.[gesture.id] ?? 0;
            const personalized = personalizedConfidences?.[gesture.id] ?? 0;

            return (
              <div className="gesture-confidence-row" key={gesture.id}>
                <div className="gesture-confidence-header">
                  <span>{gesture.label}</span>
                  <span>{formatPercent(confidence)}</span>
                </div>
                <div className="gesture-confidence-bar-track">
                  <div
                    className="gesture-confidence-bar-fill"
                    style={{ width: `${Math.round(confidence * 100)}%` }}
                  />
                </div>
                <div className="gesture-confidence-meta">
                  <span>H: {formatPercent(heuristic)}</span>
                  <span>P: {formatPercent(personalized)}</span>
                  <span>Samples: {sampleCounts?.[gesture.id] ?? 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gesture-debug-section training-section">
        <h3>Personalization Training</h3>
        <p className="small-text">
          {trainingState?.message ?? "Record gesture windows to tune recognition."}
        </p>
        {trainingState?.active && (
          <p className="small-text">
            {trainingState.phase === "countdown"
              ? `Recording ${trainingState.gestureLabel} in ${trainingState.countdown}s...`
              : `Capturing ${trainingState.gestureLabel}: ${trainingState.capturedFrames}/${trainingState.targetFrames}`}
          </p>
        )}

        <div className="button-row compact">
          <button type="button" onClick={onExportSamples}>
            Export JSON
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={importInputRef}
            className="hidden-input"
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file) {
                onImportSamples(file);
              }
              event.target.value = "";
            }}
          />
        </div>

        <div className="training-gesture-list">
          {GESTURE_DEFINITIONS.map((gesture) => (
            <div className="training-gesture-row" key={`training-${gesture.id}`}>
              <div className="training-gesture-summary">
                <strong>{gesture.label}</strong>
                <span>Samples: {sampleCounts?.[gesture.id] ?? 0}</span>
              </div>
              <div className="button-row compact">
                <button
                  type="button"
                  onClick={() => onRecordGesture(gesture.id)}
                  disabled={Boolean(trainingState?.active)}
                >
                  Record sample
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onDeleteLastSample(gesture.id)}
                >
                  Delete last
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onClearSamples(gesture.id)}
                >
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gesture-debug-section event-log-section">
        <div className="event-log-header">
          <h3>Event Log</h3>
          <button type="button" className="secondary" onClick={onClearEventLog}>
            Clear
          </button>
        </div>

        <div className="event-log-list">
          {eventLog?.length ? (
            eventLog.map((entry) => (
              <div className="event-log-item" key={entry.id}>
                <span>{entry.timeLabel}</span>
                <strong>{entry.gestureLabel}</strong>
                <span>{formatPercent(entry.confidence)}</span>
                <span>{entry.handLabel ?? "n/a"}</span>
                {entry.metaSummary && <span>{entry.metaSummary}</span>}
              </div>
            ))
          ) : (
            <p className="muted">No events yet.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
