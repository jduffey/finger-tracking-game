import { useEffect, useMemo, useRef, useState } from "react";
import { createArtEngineState, renderArtFrame } from "../gestureArt/artEngine";
import { extractHandFeatures } from "../gestureArt/featureExtraction";
import { mapFeaturesToArt } from "../gestureArt/gestureMapping";

const MODES = ["attractor", "lissajous", "flow", "swirl"];
const LOOP_DURATION_MS = 10_000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function GestureArtLab({ hands, fps, handDetected }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const engineStateRef = useRef(createArtEngineState());
  const featureHistoryRef = useRef({
    lastTimestamp: 0,
    lastIndexTip: null,
    lastPalmScale: 0,
    indexPath: [],
    lastFreezeToggleAt: 0,
  });

  const [mode, setMode] = useState(MODES[0]);
  const handsRef = useRef(hands);
  const fpsRef = useRef(fps);
  const modeRef = useRef(mode);
  const [frozen, setFrozen] = useState(false);
  const [metrics, setMetrics] = useState({
    brushThickness: 1,
    paletteMix: 0,
    hueRotation: 0,
    emissionRate: 0,
    zoom: 1,
    fieldRotation: 0,
    handsCount: 0,
  });
  const [recording, setRecording] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState([]);
  const [replaying, setReplaying] = useState(false);
  const recordingRef = useRef(recording);
  const recordedFramesRef = useRef(recordedFrames);
  const replayingRef = useRef(replaying);
  const recordingStartRef = useRef(0);
  const replayStartRef = useRef(0);


  useEffect(() => { handsRef.current = hands; }, [hands]);
  useEffect(() => { fpsRef.current = fps; }, [fps]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { recordedFramesRef.current = recordedFrames; }, [recordedFrames]);
  useEffect(() => { replayingRef.current = replaying; }, [replaying]);

  const sliderRows = useMemo(
    () => [
      { label: "Brush", value: metrics.brushThickness, min: 1, max: 30 },
      { label: "Palette", value: metrics.paletteMix, min: 0, max: 1 },
      { label: "Hue", value: metrics.hueRotation, min: 0, max: 360 },
      { label: "Emission", value: metrics.emissionRate, min: 0, max: 50 },
      { label: "Zoom", value: metrics.zoom, min: 0.6, max: 2.6 },
      { label: "Field rot", value: metrics.fieldRotation, min: -Math.PI, max: Math.PI },
    ],
    [metrics],
  );

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) {
        return;
      }
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${Math.floor(rect.width)}px`;
      canvas.style.height = `${Math.floor(rect.height)}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "rgba(3, 8, 16, 1)";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const loop = (now) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const history = featureHistoryRef.current;
      let mapped;

      const activeRecordedFrames = recordedFramesRef.current;
      if (replayingRef.current && activeRecordedFrames.length > 0) {
        const elapsed = (now - replayStartRef.current) % LOOP_DURATION_MS;
        const frame = activeRecordedFrames.findLast((entry) => entry.time <= elapsed) ?? activeRecordedFrames[0];
        mapped = frame?.mapped;
      } else {
        const extracted = extractHandFeatures(handsRef.current, now, history);
        mapped = mapFeaturesToArt(extracted, history);

        history.lastTimestamp = now;
        history.lastIndexTip = extracted.indexTip;
        history.lastPalmScale = extracted.palmScale;

        if (recordingRef.current) {
          const elapsed = now - recordingStartRef.current;
          if (elapsed <= LOOP_DURATION_MS) {
            setRecordedFrames((previous) => [...previous, { time: elapsed, mapped }]);
          } else {
            setRecording(false);
          }
        }
      }

      if (mapped) {
        const toggleReady = now - history.lastFreezeToggleAt > 900;
        if (mapped.freezeToggleRequested && toggleReady) {
          history.lastFreezeToggleAt = now;
          setFrozen((previous) => !previous);
        }

        setMetrics((previous) => ({
          ...previous,
          brushThickness: mapped.brushThickness,
          paletteMix: mapped.paletteMix,
          hueRotation: mapped.hueRotation,
          emissionRate: mapped.emissionRate,
          zoom: mapped.zoom,
          fieldRotation: mapped.fieldRotation,
          handsCount: mapped.handsCount,
        }));

        renderArtFrame(ctx, engineStateRef.current, {
          width,
          height,
          parameters: mapped,
          mode: modeRef.current,
          now,
          dt: 1 / Math.max(15, fpsRef.current || 60),
          frozen,
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [frozen]);

  const startRecording = () => {
    setRecordedFrames([]);
    setReplaying(false);
    setRecording(true);
    recordingStartRef.current = performance.now();
  };

  const toggleReplay = () => {
    if (recordedFrames.length === 0) {
      return;
    }
    setReplaying((previous) => {
      const next = !previous;
      if (next) {
        replayStartRef.current = performance.now();
      }
      return next;
    });
  };

  return (
    <section className="card panel" style={{ padding: 0, position: "relative" }}>
      <div ref={wrapRef} style={{ position: "absolute", inset: 0, background: "#030810" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          width: 280,
          background: "rgba(10, 17, 28, 0.72)",
          border: "1px solid rgba(132, 166, 212, 0.36)",
          borderRadius: 10,
          padding: "10px 11px",
          color: "#dce9ff",
          backdropFilter: "blur(4px)",
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong>Gesture Art Lab</strong>
          <span>{frozen ? "frozen" : "live"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <span>FPS: {fps.toFixed(1)}</span>
          <span>Hands: {metrics.handsCount}</span>
          <span>Tracking: {handDetected ? "yes" : "no"}</span>
          <span>Replay: {replaying ? "on" : "off"}</span>
        </div>

        {sliderRows.map((row) => {
          const normalized = clamp((row.value - row.min) / Math.max(1e-6, row.max - row.min), 0, 1) * 100;
          return (
            <div key={row.label} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{row.label}</span>
                <span>{row.value.toFixed(2)}</span>
              </div>
              <div style={{ height: 6, background: "rgba(91, 120, 163, 0.28)", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${normalized.toFixed(1)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #75a7ff, #c98cff)",
                  }}
                />
              </div>
            </div>
          );
        })}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6, marginTop: 8 }}>
          {MODES.map((entry) => (
            <button key={entry} className={entry === mode ? "" : "secondary"} onClick={() => setMode(entry)}>
              {entry}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
          <button onClick={startRecording} disabled={recording}>
            {recording ? "Recording..." : "Record 10s"}
          </button>
          <button className="secondary" onClick={toggleReplay} disabled={recordedFrames.length === 0}>
            {replaying ? "Stop Replay" : "Replay Loop"}
          </button>
        </div>
      </div>
    </section>
  );
}
