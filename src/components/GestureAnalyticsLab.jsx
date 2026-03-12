import { useEffect, useMemo, useRef, useState } from "react";

const HEATMAP_COLS = 24;
const HEATMAP_ROWS = 16;
const TIMELINE_SECONDS = 60;
const GESTURE_COOLDOWN_MS = 350;
const ACTIVE_SPEED_THRESHOLD = 0.28;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function averagePoint(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return null;
  }
  let x = 0;
  let y = 0;
  let count = 0;
  for (const point of landmarks) {
    if (!Number.isFinite(point?.u) || !Number.isFinite(point?.v)) {
      continue;
    }
    x += point.u;
    y += point.v;
    count += 1;
  }
  if (count === 0) {
    return null;
  }
  return { x: x / count, y: y / count };
}

function classifyGesture(hands) {
  if (!Array.isArray(hands) || hands.length === 0) {
    return "idle";
  }

  const hasPinch = hands.some((hand) => (hand?.pinchDistance ?? 1) < 0.05);
  if (hasPinch) {
    return hands.length > 1 ? "two_hand_pinch" : "pinch";
  }

  if (hands.length > 1) {
    return "two_hand_motion";
  }

  const hand = hands[0];
  const index = hand?.fingerTips?.index;
  const middle = hand?.fingerTips?.middle;
  const ring = hand?.fingerTips?.ring;
  const pinky = hand?.fingerTips?.pinky;
  const thumb = hand?.fingerTips?.thumb;

  if (!index || !middle || !ring || !pinky || !thumb) {
    return "motion";
  }

  const spread =
    Math.abs(index.u - middle.u) +
    Math.abs(middle.u - ring.u) +
    Math.abs(ring.u - pinky.u) +
    Math.abs(thumb.u - index.u);

  if (spread > 0.22) {
    return "open_hand";
  }
  if (spread < 0.09) {
    return "closed_hand";
  }
  return "motion";
}

function createEmptyMetrics() {
  return {
    averageVelocity: 0,
    motionEntropy: 0,
    gesturesPerMinute: 0,
    idleVsActiveRatio: { idle: 1, active: 0 },
    dominantHandUsagePct: { left: 0, right: 0 },
    symmetryScore: 0,
    smoothnessScore: 0,
    heatmap: Array.from({ length: HEATMAP_ROWS }, () => Array.from({ length: HEATMAP_COLS }, () => 0)),
    timeline: Array.from({ length: TIMELINE_SECONDS }, () => 0),
    gestureHistogram: {},
    gestureCount: 0,
  };
}

function calculateMetrics(frames, elapsedMs) {
  if (!Array.isArray(frames) || frames.length < 2) {
    return createEmptyMetrics();
  }

  let velocitySum = 0;
  let velocityCount = 0;
  let idleDuration = 0;
  let activeDuration = 0;
  let leftActive = 0;
  let rightActive = 0;
  let gestureCount = 0;

  const directionBins = Array.from({ length: 8 }, () => 0);
  const accelerationSamples = [];
  const symmetrySamples = [];
  const heatmap = Array.from({ length: HEATMAP_ROWS }, () => Array.from({ length: HEATMAP_COLS }, () => 0));
  const timeline = Array.from({ length: TIMELINE_SECONDS }, () => 0);
  const gestureHistogram = {};

  let previousGesture = "idle";
  let lastGestureSwitchTs = -Infinity;
  let lastSpeed = null;

  for (let index = 1; index < frames.length; index += 1) {
    const current = frames[index];
    const previous = frames[index - 1];
    const dt = Math.max(1e-3, (current.t - previous.t) / 1000);
    const hands = current.hands ?? [];

    let totalSpeed = 0;
    let sampleHands = 0;
    const centers = {};

    for (const hand of hands) {
      const currentCenter = averagePoint(hand?.landmarks);
      const prevHand = (previous.hands ?? []).find((candidate) => candidate.label === hand.label);
      const previousCenter = averagePoint(prevHand?.landmarks);
      if (!currentCenter || !previousCenter) {
        continue;
      }

      const dx = currentCenter.x - previousCenter.x;
      const dy = currentCenter.y - previousCenter.y;
      const speed = Math.hypot(dx, dy) / dt;
      if (!Number.isFinite(speed)) {
        continue;
      }

      centers[hand.label] = currentCenter;
      velocitySum += speed;
      velocityCount += 1;
      totalSpeed += speed;
      sampleHands += 1;

      if (speed > ACTIVE_SPEED_THRESHOLD) {
        if (hand.label === "Left") {
          leftActive += dt;
        }
        if (hand.label === "Right") {
          rightActive += dt;
        }
      }

      if (speed > 0.02) {
        const angle = Math.atan2(dy, dx);
        const binIndex = Math.floor((((angle + Math.PI) / (Math.PI * 2)) * 8) % 8);
        directionBins[binIndex] += 1;
      }

      const col = clamp(Math.floor(currentCenter.x * HEATMAP_COLS), 0, HEATMAP_COLS - 1);
      const row = clamp(Math.floor(currentCenter.y * HEATMAP_ROWS), 0, HEATMAP_ROWS - 1);
      heatmap[row][col] += 1;
    }

    const avgSpeed = sampleHands > 0 ? totalSpeed / sampleHands : 0;
    if (avgSpeed > ACTIVE_SPEED_THRESHOLD) {
      activeDuration += dt;
    } else {
      idleDuration += dt;
    }

    if (lastSpeed !== null) {
      const accel = (avgSpeed - lastSpeed) / dt;
      if (Number.isFinite(accel)) {
        accelerationSamples.push(accel);
      }
    }
    lastSpeed = avgSpeed;

    const secondFromEnd = Math.floor((frames[frames.length - 1].t - current.t) / 1000);
    if (secondFromEnd >= 0 && secondFromEnd < TIMELINE_SECONDS) {
      timeline[TIMELINE_SECONDS - 1 - secondFromEnd] += avgSpeed;
    }

    const gesture = classifyGesture(hands);
    gestureHistogram[gesture] = (gestureHistogram[gesture] ?? 0) + 1;
    if (gesture !== previousGesture && gesture !== "idle" && current.t - lastGestureSwitchTs > GESTURE_COOLDOWN_MS) {
      gestureCount += 1;
      lastGestureSwitchTs = current.t;
    }
    previousGesture = gesture;

    if (centers.Left && centers.Right) {
      const mirroredXDelta = Math.abs((1 - centers.Left.x) - centers.Right.x);
      const yDelta = Math.abs(centers.Left.y - centers.Right.y);
      const sync = 1 - clamp((mirroredXDelta + yDelta) * 0.8, 0, 1);
      symmetrySamples.push(sync);
    }
  }

  const durationMinutes = Math.max(1e-6, elapsedMs / 60000);
  const averageVelocity = velocityCount > 0 ? velocitySum / velocityCount : 0;

  const totalDirections = directionBins.reduce((sum, count) => sum + count, 0);
  let entropy = 0;
  if (totalDirections > 0) {
    for (const count of directionBins) {
      if (count <= 0) {
        continue;
      }
      const probability = count / totalDirections;
      entropy += -probability * Math.log2(probability);
    }
  }

  const totalState = activeDuration + idleDuration;
  const totalHandActive = leftActive + rightActive;
  const leftPct = totalHandActive > 0 ? (leftActive / totalHandActive) * 100 : 0;
  const rightPct = totalHandActive > 0 ? (rightActive / totalHandActive) * 100 : 0;

  let accelStdDev = 0;
  if (accelerationSamples.length > 0) {
    const mean = accelerationSamples.reduce((sum, value) => sum + value, 0) / accelerationSamples.length;
    const variance =
      accelerationSamples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      accelerationSamples.length;
    accelStdDev = Math.sqrt(variance);
  }
  const smoothnessScore = clamp(100 - accelStdDev * 25, 0, 100);

  const maxTimeline = Math.max(1e-6, ...timeline);
  const normalizedTimeline = timeline.map((value) => value / maxTimeline);

  return {
    averageVelocity,
    motionEntropy: entropy,
    gesturesPerMinute: gestureCount / durationMinutes,
    idleVsActiveRatio: {
      idle: totalState > 0 ? idleDuration / totalState : 1,
      active: totalState > 0 ? activeDuration / totalState : 0,
    },
    dominantHandUsagePct: {
      left: leftPct,
      right: rightPct,
    },
    symmetryScore:
      symmetrySamples.length > 0
        ? (symmetrySamples.reduce((sum, value) => sum + value, 0) / symmetrySamples.length) * 100
        : 0,
    smoothnessScore,
    heatmap,
    timeline: normalizedTimeline,
    gestureHistogram,
    gestureCount,
  };
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function GestureAnalyticsLab({ liveHands, liveTimestamp, fps }) {
  const [frames, setFrames] = useState([]);
  const [recording, setRecording] = useState(false);
  const [sessionLibrary, setSessionLibrary] = useState([]);
  const [replaySessionId, setReplaySessionId] = useState("");
  const [compareSessionId, setCompareSessionId] = useState("");
  const [replayCursor, setReplayCursor] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  const replayRafRef = useRef(0);
  const replayStartRef = useRef(0);

  useEffect(() => {
    if (isReplaying || !recording || !Number.isFinite(liveTimestamp)) {
      return;
    }
    setFrames((previous) => {
      const next = [
        ...previous,
        {
          t: liveTimestamp,
          hands: (liveHands ?? []).map((hand, index) => ({
            label: hand?.stableHandedness ?? hand?.handedness ?? `Hand-${index + 1}`,
            pinchDistance: hand?.pinchDistance ?? null,
            fingerTips: hand?.fingerTips ?? null,
            landmarks: Array.isArray(hand?.landmarks)
              ? hand.landmarks.map((point) => ({ u: point.u, v: point.v }))
              : [],
          })),
        },
      ];
      const cutoff = liveTimestamp - 120000;
      return next.filter((frame) => frame.t >= cutoff);
    });
  }, [isReplaying, liveHands, liveTimestamp, recording]);

  const activeMetrics = useMemo(() => {
    if (frames.length < 2) {
      return createEmptyMetrics();
    }
    const elapsedMs = Math.max(1, frames[frames.length - 1].t - frames[0].t);
    return calculateMetrics(frames, elapsedMs);
  }, [frames]);

  const replaySession = useMemo(
    () => sessionLibrary.find((session) => session.id === replaySessionId) ?? null,
    [replaySessionId, sessionLibrary],
  );

  const compareSession = useMemo(
    () => sessionLibrary.find((session) => session.id === compareSessionId) ?? null,
    [compareSessionId, sessionLibrary],
  );

  const replayFrames = replaySession?.frames ?? [];
  const replayMetrics = useMemo(() => {
    if (!replaySession || replayFrames.length < 2) {
      return createEmptyMetrics();
    }
    const elapsedMs = Math.max(1, replayFrames[replayFrames.length - 1].t - replayFrames[0].t);
    return calculateMetrics(replayFrames, elapsedMs);
  }, [replayFrames, replaySession]);

  const visibleMetrics = isReplaying ? replayMetrics : activeMetrics;

  const replayDurationMs =
    replayFrames.length > 1 ? replayFrames[replayFrames.length - 1].t - replayFrames[0].t : 0;

  useEffect(() => {
    if (!isReplaying || replayFrames.length < 2) {
      return undefined;
    }

    const startT = replayFrames[0].t;
    const stopT = replayFrames[replayFrames.length - 1].t;
    replayStartRef.current = performance.now() - replayCursor;

    const tick = () => {
      const elapsed = performance.now() - replayStartRef.current;
      if (elapsed >= stopT - startT) {
        setReplayCursor(stopT - startT);
        setIsReplaying(false);
        return;
      }
      setReplayCursor(elapsed);
      replayRafRef.current = requestAnimationFrame(tick);
    };

    replayRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(replayRafRef.current);
  }, [isReplaying, replayCursor, replayFrames]);

  function saveSession() {
    if (frames.length < 5) {
      return;
    }
    const id = `session-${Date.now()}`;
    const elapsedMs = Math.max(1, frames[frames.length - 1].t - frames[0].t);
    const snapshot = {
      id,
      name: `Session ${sessionLibrary.length + 1}`,
      createdAt: new Date().toISOString(),
      frames,
      metrics: calculateMetrics(frames, elapsedMs),
    };
    setSessionLibrary((previous) => [snapshot, ...previous]);
    setReplaySessionId(id);
  }

  function exportMetricsJson() {
    const payload = {
      generatedAt: new Date().toISOString(),
      source: isReplaying ? "replay" : "live",
      metrics: visibleMetrics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gesture-analytics-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const replayProgress = replayDurationMs > 0 ? replayCursor / replayDurationMs : 0;

  function toggleReplayPlayback() {
    if (!replaySession) {
      return;
    }
    if (!isReplaying && replayCursor >= replayDurationMs) {
      setReplayCursor(0);
    }
    setIsReplaying((value) => !value);
  }

  return (
    <section className="card panel gesture-analytics-lab">
      <h2>Gesture Analytics Lab</h2>
      <p className="small-text">
        MediaPipe Hands behavioral instrumentation mode with real-time metrics, heatmap, rolling
        timeline, session recording, replay, and side-by-side session comparison.
      </p>

      <div className="button-row">
        <button
          type="button"
          onClick={() => {
            setRecording((value) => {
              const next = !value;
              if (next) {
                setFrames([]);
                setIsReplaying(false);
                setReplayCursor(0);
              }
              return next;
            });
          }}
        >
          {recording ? "Stop & Keep Buffer" : "Start Live Capture"}
        </button>
        <button type="button" className="secondary" onClick={saveSession} disabled={frames.length < 5}>
          Save Session
        </button>
        <button type="button" className="secondary" onClick={exportMetricsJson}>
          Export Metrics JSON
        </button>
      </div>

      <div className="analytics-grid">
        <div className="metric-tile"><strong>Average hand velocity</strong><span>{visibleMetrics.averageVelocity.toFixed(3)} u/s</span></div>
        <div className="metric-tile"><strong>Motion entropy</strong><span>{visibleMetrics.motionEntropy.toFixed(3)} bits</span></div>
        <div className="metric-tile"><strong>Gesture frequency</strong><span>{visibleMetrics.gesturesPerMinute.toFixed(2)} / min</span></div>
        <div className="metric-tile"><strong>Idle vs active</strong><span>{formatPct(visibleMetrics.idleVsActiveRatio.idle)} / {formatPct(visibleMetrics.idleVsActiveRatio.active)}</span></div>
        <div className="metric-tile"><strong>Dominant hand usage</strong><span>L {visibleMetrics.dominantHandUsagePct.left.toFixed(1)}% · R {visibleMetrics.dominantHandUsagePct.right.toFixed(1)}%</span></div>
        <div className="metric-tile"><strong>Symmetry score</strong><span>{visibleMetrics.symmetryScore.toFixed(1)} / 100</span></div>
        <div className="metric-tile"><strong>Smoothness score</strong><span>{visibleMetrics.smoothnessScore.toFixed(1)} / 100</span></div>
        <div className="metric-tile"><strong>FPS</strong><span>{fps.toFixed(1)}</span></div>
      </div>

      <HeatmapCanvas heatmap={visibleMetrics.heatmap} />
      <TimelineCanvas timeline={visibleMetrics.timeline} />
      <GestureHistogram histogram={visibleMetrics.gestureHistogram} />

      <div className="session-controls">
        <label>
          Replay session
          <select value={replaySessionId} onChange={(event) => setReplaySessionId(event.target.value)}>
            <option value="">None</option>
            {sessionLibrary.map((session) => (
              <option key={session.id} value={session.id}>{session.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" disabled={!replaySession} onClick={toggleReplayPlayback}>
          {isReplaying ? "Pause Replay" : "Play Replay"}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={replayProgress}
          disabled={!replaySession || isReplaying}
          onChange={(event) => {
            const ratio = Number.parseFloat(event.target.value);
            setReplayCursor(clamp(ratio, 0, 1) * replayDurationMs);
          }}
        />
      </div>

      <div className="session-controls">
        <label>
          Compare with
          <select value={compareSessionId} onChange={(event) => setCompareSessionId(event.target.value)}>
            <option value="">None</option>
            {sessionLibrary
              .filter((session) => session.id !== replaySessionId)
              .map((session) => (
                <option key={session.id} value={session.id}>{session.name}</option>
              ))}
          </select>
        </label>
      </div>

      {replaySession && compareSession && (
        <div className="comparison-grid">
          <ComparisonCard title={replaySession.name} metrics={replaySession.metrics} />
          <ComparisonCard title={compareSession.name} metrics={compareSession.metrics} />
        </div>
      )}
    </section>
  );
}

function HeatmapCanvas({ heatmap }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    let maxValue = 1;
    for (const row of heatmap) {
      for (const value of row) {
        maxValue = Math.max(maxValue, value);
      }
    }

    const cellW = width / HEATMAP_COLS;
    const cellH = height / HEATMAP_ROWS;
    for (let y = 0; y < HEATMAP_ROWS; y += 1) {
      for (let x = 0; x < HEATMAP_COLS; x += 1) {
        const intensity = (heatmap?.[y]?.[x] ?? 0) / maxValue;
        const hue = 220 - intensity * 200;
        const alpha = 0.1 + intensity * 0.88;
        ctx.fillStyle = `hsla(${hue}, 95%, 58%, ${alpha})`;
        ctx.fillRect(x * cellW, y * cellH, cellW - 1, cellH - 1);
      }
    }
  }, [heatmap]);

  return (
    <div className="chart-block">
      <h3>Spatial coverage heatmap</h3>
      <canvas ref={canvasRef} width={720} height={220} />
    </div>
  );
}

function TimelineCanvas({ timeline }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "#1f4f89";
    ctx.lineWidth = 2;
    ctx.beginPath();
    timeline.forEach((value, index) => {
      const x = (index / Math.max(1, timeline.length - 1)) * width;
      const y = height - clamp(value, 0, 1) * (height - 18) - 8;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = "#3c5f7f";
    ctx.font = "12px sans-serif";
    ctx.fillText("Rolling 60-second activity timeline", 8, 14);
  }, [timeline]);

  return (
    <div className="chart-block">
      <h3>Rolling 60-second timeline</h3>
      <canvas ref={canvasRef} width={720} height={160} />
    </div>
  );
}

function GestureHistogram({ histogram }) {
  const entries = Object.entries(histogram).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((entry) => entry[1]));
  return (
    <div className="chart-block">
      <h3>Gesture type histogram</h3>
      <div className="histogram-list">
        {entries.length === 0 && <div className="small-text">No gesture samples yet.</div>}
        {entries.map(([label, count]) => (
          <div className="histogram-row" key={label}>
            <span>{label}</span>
            <div className="histogram-bar-wrap">
              <div className="histogram-bar" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonCard({ title, metrics }) {
  return (
    <div className="comparison-card">
      <h4>{title}</h4>
      <div>Velocity: {metrics.averageVelocity.toFixed(3)} u/s</div>
      <div>Entropy: {metrics.motionEntropy.toFixed(3)} bits</div>
      <div>Gestures/min: {metrics.gesturesPerMinute.toFixed(2)}</div>
      <div>Symmetry: {metrics.symmetryScore.toFixed(1)}</div>
      <div>Smoothness: {metrics.smoothnessScore.toFixed(1)}</div>
      <div>Idle/Active: {formatPct(metrics.idleVsActiveRatio.idle)} / {formatPct(metrics.idleVsActiveRatio.active)}</div>
    </div>
  );
}
