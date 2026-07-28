import { useEffect, useRef, useState } from "react";

import {
  createArtEngineState,
  renderArtFrame,
} from "../gestureArt/artEngine.js";
import { extractHandFeatures } from "../gestureArt/featureExtraction.js";
import { mapFeaturesToArt } from "../gestureArt/gestureMapping.js";
import { createCreativeGalleryStore } from "../creativeGallery.js";
import {
  createCreativeAssetKey,
  deleteCreativeAsset,
  readCreativeAsset,
  saveCreativeAsset,
} from "../creativeAssetStorage.js";
import {
  GESTURE_ART_VIDEO_DURATION_MS,
  getGestureArtVideoExportCapability,
  startGestureArtCanvasRecording,
} from "../gestureArtVideoExport.js";
import "../gestureArtStudio.css";

const ART_MODES = Object.freeze([
  { id: "attractor", label: "Glow" },
  { id: "lissajous", label: "Ribbon" },
  { id: "flow", label: "Current" },
  { id: "swirl", label: "Orbit" },
]);
const LOOP_DURATION_MS = GESTURE_ART_VIDEO_DURATION_MS;
const RECORD_SAMPLE_MS = 66;
const MAX_UNDO_STEPS = 6;

const DEFAULT_CONTROLS = Object.freeze({
  brushThickness: 10,
  paletteMix: 0.55,
  hueRotation: 188,
  emissionRate: 18,
  zoom: 1,
  fieldRotation: 0,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas?.toBlob?.(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The artwork could not be rendered.")),
      "image/png",
    );
  });
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, x, 0]
      : section < 2
        ? [x, chroma, 0]
        : section < 3
          ? [0, chroma, x]
          : section < 4
            ? [0, x, chroma]
            : section < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const offset = l - chroma / 2;
  return `#${[red, green, blue]
    .map((value) =>
      Math.round((value + offset) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function getPalette(hue) {
  return [
    hslToHex(hue, 88, 68),
    hslToHex(hue + 62, 82, 62),
    hslToHex(hue + 154, 78, 58),
    "#050914",
  ];
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createManualMapping(pointer, controls) {
  return {
    ...controls,
    attractor: pointer.active ? { x: pointer.x, y: pointer.y } : null,
    clearRequested: false,
    freezeToggleRequested: false,
    handsCount: 0,
  };
}

export default function GestureArtLab({
  hands,
  handDetected,
  onBack,
  onOpenSetup,
}) {
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
  const handsRef = useRef(hands);
  const modeRef = useRef(ART_MODES[0].id);
  const controlsRef = useRef({ ...DEFAULT_CONTROLS });
  const frozenRef = useRef(false);
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false });
  const undoRef = useRef([]);
  const recordingRef = useRef(false);
  const recordingStartRef = useRef(0);
  const recordingFramesRef = useRef([]);
  const lastRecordingSampleRef = useRef(0);
  const recordedFramesRef = useRef([]);
  const replayingRef = useRef(false);
  const replayStartRef = useRef(0);
  const videoExportCancelRef = useRef(null);
  const mountedRef = useRef(true);
  const lastMetricsPublishRef = useRef(0);
  const galleryStoreRef = useRef(null);
  if (!galleryStoreRef.current) {
    galleryStoreRef.current = createCreativeGalleryStore();
  }

  const [mode, setMode] = useState(ART_MODES[0].id);
  const [controls, setControls] = useState({ ...DEFAULT_CONTROLS });
  const [frozen, setFrozen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [metrics, setMetrics] = useState({
    handsCount: 0,
    source: "pointer",
  });
  const [recording, setRecording] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState([]);
  const [replaying, setReplaying] = useState(false);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [videoExportCapability, setVideoExportCapability] = useState({
    supported: false,
    reason: "checking",
    mimeType: null,
  });
  const [videoExportStatus, setVideoExportStatus] = useState(
    "Checking whether this browser can export artwork video.",
  );
  const [galleryEntries, setGalleryEntries] = useState(() =>
    galleryStoreRef.current.list({ modeId: "gesture-art" }),
  );
  const [statusMessage, setStatusMessage] = useState(
    "Drag across the canvas, use touch, or move a tracked hand to paint.",
  );

  useEffect(() => {
    handsRef.current = hands;
  }, [hands]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);
  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);
  useEffect(() => {
    recordedFramesRef.current = recordedFrames;
  }, [recordedFrames]);
  useEffect(() => {
    replayingRef.current = replaying;
  }, [replaying]);

  useEffect(() => {
    mountedRef.current = true;
    const capability = getGestureArtVideoExportCapability({
      canvas: canvasRef.current,
    });
    setVideoExportCapability(capability);
    setVideoExportStatus(
      capability.supported
        ? "Record a movement loop to export a ten-second WebM."
        : "Video export is unavailable in this browser. PNG export and loop replay still work.",
    );

    return () => {
      mountedRef.current = false;
      videoExportCancelRef.current?.();
      videoExportCancelRef.current = null;
    };
  }, []);

  useEffect(
    () =>
      galleryStoreRef.current.subscribe((gallery) => {
        setGalleryEntries(
          gallery.entries.filter(({ modeId }) => modeId === "gesture-art"),
        );
      }),
    [],
  );

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) {
        return;
      }
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const previous =
        canvas.width > 1 && canvas.height > 1
          ? canvas.toDataURL("image/png")
          : null;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${Math.floor(rect.width)}px`;
      canvas.style.height = `${Math.floor(rect.height)}px`;
      const context = canvas.getContext("2d");
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (context) {
        context.fillStyle = "#030810";
        context.fillRect(0, 0, rect.width, rect.height);
      }
      if (previous) {
        const image = new Image();
        image.addEventListener(
          "load",
          () => context?.drawImage(image, 0, 0, rect.width, rect.height),
          { once: true },
        );
        image.src = previous;
      }
    };

    resize();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(resize)
        : null;
    observer?.observe(wrapRef.current);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const loop = (now) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      let mapped;
      const replayFrames = recordedFramesRef.current;
      if (replayingRef.current && replayFrames.length > 0) {
        const elapsed = (now - replayStartRef.current) % LOOP_DURATION_MS;
        mapped =
          replayFrames.findLast((entry) => entry.time <= elapsed)?.mapped ??
          replayFrames[0]?.mapped;
      } else {
        const history = featureHistoryRef.current;
        const extracted = extractHandFeatures(handsRef.current, now, history);
        const gestureMapped = mapFeaturesToArt(extracted, history);
        history.lastTimestamp = now;
        history.lastIndexTip = extracted.indexTip;
        history.lastPalmScale = extracted.palmScale;
        mapped =
          gestureMapped?.handsCount > 0
            ? gestureMapped
            : createManualMapping(pointerRef.current, controlsRef.current);

        if (recordingRef.current) {
          const elapsed = now - recordingStartRef.current;
          if (elapsed > LOOP_DURATION_MS) {
            recordingRef.current = false;
            setRecording(false);
            const finishedFrames = [...recordingFramesRef.current];
            recordedFramesRef.current = finishedFrames;
            setRecordedFrames(finishedFrames);
            setStatusMessage("Loop captured. Replay it, export video, or save a still frame.");
            setVideoExportStatus(
              "Loop ready. WebM export records the artwork canvas only.",
            );
          } else if (
            now - lastRecordingSampleRef.current >= RECORD_SAMPLE_MS
          ) {
            lastRecordingSampleRef.current = now;
            recordingFramesRef.current.push({
              time: elapsed,
              mapped: {
                ...mapped,
                attractor: mapped.attractor
                  ? { ...mapped.attractor }
                  : null,
              },
            });
          }
        }
      }

      if (mapped) {
        const history = featureHistoryRef.current;
        if (
          mapped.freezeToggleRequested &&
          now - history.lastFreezeToggleAt > 900
        ) {
          history.lastFreezeToggleAt = now;
          setFrozen((previous) => !previous);
        }
        if (now - lastMetricsPublishRef.current >= 125) {
          lastMetricsPublishRef.current = now;
          setMetrics({
            handsCount: mapped.handsCount ?? 0,
            source: (mapped.handsCount ?? 0) > 0 ? "tracking" : "pointer",
          });
        }
        renderArtFrame(context, engineStateRef.current, {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          parameters: mapped,
          mode: modeRef.current,
          now,
          dt: 1 / 60,
          frozen: frozenRef.current,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function updateControl(key, value) {
    setControls((current) => ({ ...current, [key]: value }));
  }

  function updatePointer(event, active = pointerRef.current.active) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) {
      return;
    }
    pointerRef.current = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      active,
    };
  }

  function captureUndoStep() {
    const canvas = canvasRef.current;
    if (!canvas?.width || !canvas?.height) {
      return;
    }
    try {
      undoRef.current = [
        ...undoRef.current.slice(-(MAX_UNDO_STEPS - 1)),
        canvas.toDataURL("image/png"),
      ];
    } catch {
      // A failed snapshot should never interrupt live painting.
    }
  }

  function undo() {
    const snapshot = undoRef.current.pop();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!snapshot || !canvas || !context) {
      setStatusMessage("Nothing to undo yet.");
      return;
    }
    const image = new Image();
    image.addEventListener(
      "load",
      () => {
        context.save();
        context.globalCompositeOperation = "source-over";
        context.fillStyle = "#030810";
        context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
        context.restore();
        engineStateRef.current = createArtEngineState();
        setFrozen(true);
        setStatusMessage("Restored the previous canvas.");
      },
      { once: true },
    );
    image.src = snapshot;
  }

  function clearCanvas() {
    captureUndoStep();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#030810";
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.restore();
    engineStateRef.current = createArtEngineState();
    setStatusMessage("Canvas cleared. Undo is available.");
  }

  async function exportArtwork() {
    try {
      const blob = await canvasToBlob(canvasRef.current);
      downloadBlob(blob, `motion-arcade-art-${Date.now()}.png`);
      setStatusMessage("PNG exported.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function saveArtwork() {
    try {
      const canvas = canvasRef.current;
      const blob = await canvasToBlob(canvas);
      const key = createCreativeAssetKey("gesture-art");
      const dataRef = await saveCreativeAsset({ key, blob });
      const palette = getPalette(controlsRef.current.hueRotation);
      const result = galleryStoreRef.current.save({
        modeId: "gesture-art",
        title: `Light Painting ${galleryEntries.length + 1}`,
        description: `${ART_MODES.find(({ id }) => id === mode)?.label ?? "Glow"} preset`,
        tags: [mode, recordedFramesRef.current.length ? "loop" : "still"],
        metadata: {
          mode,
          hue: Math.round(controlsRef.current.hueRotation),
          brush: Math.round(controlsRef.current.brushThickness),
        },
        thumbnail: {
          kind: "reference",
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          palette,
          dataRef,
        },
        dataRef,
      });
      if (!result.ok) {
        await deleteCreativeAsset(dataRef);
        throw new Error("The local gallery is full or unavailable.");
      }
      setStatusMessage(`Saved “${result.entry.title}” to this device.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  async function downloadGalleryEntry(entry) {
    const blob = await readCreativeAsset(entry.dataRef);
    if (!blob) {
      setStatusMessage("That saved image is not available in this browser.");
      return;
    }
    downloadBlob(blob, `${entry.title.replace(/[^a-z0-9]+/gi, "-").toLocaleLowerCase()}.png`);
    setStatusMessage(`Exported “${entry.title}”.`);
  }

  async function removeGalleryEntry(entry) {
    await deleteCreativeAsset(entry.dataRef);
    galleryStoreRef.current.delete(entry.id);
    setStatusMessage(`Deleted “${entry.title}” from this device.`);
  }

  function startRecording() {
    if (exportingVideo) {
      return;
    }
    recordingFramesRef.current = [];
    lastRecordingSampleRef.current = 0;
    recordedFramesRef.current = [];
    setRecordedFrames([]);
    setReplaying(false);
    setRecording(true);
    recordingStartRef.current = performance.now();
    setStatusMessage("Recording a ten-second movement loop.");
    setVideoExportStatus(
      "Finish recording before exporting the artwork video.",
    );
  }

  function toggleReplay() {
    if (recording || exportingVideo || recordedFrames.length === 0) {
      return;
    }
    setReplaying((current) => {
      const next = !current;
      if (next) {
        replayStartRef.current = performance.now();
      }
      setStatusMessage(next ? "Replaying the captured loop." : "Loop replay stopped.");
      return next;
    });
  }

  async function exportLoopVideo() {
    if (
      exportingVideo ||
      recording ||
      recordedFramesRef.current.length === 0
    ) {
      return;
    }
    const capability = getGestureArtVideoExportCapability({
      canvas: canvasRef.current,
    });
    if (!capability.supported) {
      setVideoExportCapability(capability);
      setVideoExportStatus(
        "Video export is unavailable in this browser. PNG export and loop replay still work.",
      );
      return;
    }

    const wasReplaying = replayingRef.current;
    replayStartRef.current = performance.now();
    replayingRef.current = true;
    setReplaying(true);
    setExportingVideo(true);
    setVideoExportStatus(
      "Exporting ten seconds of artwork video. Keep this tab open.",
    );
    setStatusMessage("Rendering the captured loop to WebM…");

    let recordingJob = null;
    try {
      recordingJob = startGestureArtCanvasRecording({
        canvas: canvasRef.current,
      });
      videoExportCancelRef.current = recordingJob.cancel;
      const { blob } = await recordingJob.promise;
      if (!mountedRef.current) {
        return;
      }
      downloadBlob(
        blob,
        `motion-arcade-light-painting-${Date.now()}.webm`,
      );
      setVideoExportStatus(
        "WebM exported. It contains the artwork canvas only—no camera imagery or audio.",
      );
      setStatusMessage("Artwork video exported.");
    } catch (error) {
      if (!mountedRef.current || error?.code === "cancelled") {
        return;
      }
      const message =
        error?.code === "size-limit"
          ? "Video export stopped at its safe size limit. Try a still PNG instead."
          : "This browser could not finish the artwork video. PNG export and loop replay still work.";
      setVideoExportStatus(message);
      setStatusMessage(message);
    } finally {
      if (videoExportCancelRef.current === recordingJob?.cancel) {
        videoExportCancelRef.current = null;
      }
      if (mountedRef.current) {
        replayingRef.current = wasReplaying;
        setReplaying(wasReplaying);
        setExportingVideo(false);
      }
    }
  }

  function handleCanvasKeyDown(event) {
    const step = event.shiftKey ? 0.08 : 0.025;
    const pointer = pointerRef.current;
    if (event.key === "ArrowLeft") {
      pointerRef.current = { ...pointer, x: clamp(pointer.x - step, 0, 1) };
    } else if (event.key === "ArrowRight") {
      pointerRef.current = { ...pointer, x: clamp(pointer.x + step, 0, 1) };
    } else if (event.key === "ArrowUp") {
      pointerRef.current = { ...pointer, y: clamp(pointer.y - step, 0, 1) };
    } else if (event.key === "ArrowDown") {
      pointerRef.current = { ...pointer, y: clamp(pointer.y + step, 0, 1) };
    } else if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      captureUndoStep();
      pointerRef.current = { ...pointer, active: true };
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <main className="gesture-art-studio">
      <header className="gesture-art-header">
        <button className="gesture-art-home" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> Home
        </button>
        <div>
          <span>Motion Arcade Create</span>
          <strong>Light Painting</strong>
        </div>
        <div className="gesture-art-header-actions">
          {!handDetected ? (
            <button className="secondary" onClick={onOpenSetup} type="button">
              Add camera
            </button>
          ) : null}
          <button
            aria-expanded={toolsOpen}
            aria-controls="gesture-art-tools"
            onClick={() => setToolsOpen((current) => !current)}
            type="button"
          >
            {toolsOpen ? "Hide tools" : "Show tools"}
          </button>
        </div>
      </header>

      <section
        aria-describedby="gesture-art-instructions"
        aria-label="Interactive light painting canvas"
        className="gesture-art-canvas-shell"
        onKeyDown={handleCanvasKeyDown}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            pointerRef.current = { ...pointerRef.current, active: false };
          }
        }}
        onPointerCancel={() => {
          pointerRef.current = { ...pointerRef.current, active: false };
        }}
        onPointerDown={(event) => {
          captureUndoStep();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          updatePointer(event, true);
        }}
        onPointerMove={(event) => updatePointer(event)}
        onPointerUp={(event) => {
          updatePointer(event, false);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        ref={wrapRef}
        role="application"
        tabIndex={0}
      >
        <canvas aria-hidden="true" className="gesture-art-canvas" ref={canvasRef} />
        <p className="gesture-art-canvas-hint" id="gesture-art-instructions">
          {metrics.source === "tracking"
            ? "Move your hand to paint. Open your palm and explore the canvas."
            : "Drag or touch to paint. Keyboard: arrows move; hold Space to draw."}
        </p>
        <p aria-live="polite" className="gesture-art-status" role="status">
          {statusMessage}
        </p>
      </section>

      <aside
        className="gesture-art-tools"
        data-open={toolsOpen}
        id="gesture-art-tools"
      >
        <div className="gesture-art-tools-heading">
          <div>
            <span>{metrics.source === "tracking" ? "Hand input" : "Pointer input"}</span>
            <strong>{frozen ? "Canvas frozen" : "Live canvas"}</strong>
          </div>
          <button
            aria-label="Close tools"
            className="gesture-art-tools-close"
            onClick={() => setToolsOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <fieldset className="gesture-art-presets">
          <legend>Motion style</legend>
          <div>
            {ART_MODES.map((entry) => (
              <button
                aria-pressed={entry.id === mode}
                className={entry.id === mode ? "selected" : "secondary"}
                key={entry.id}
                onClick={() => setMode(entry.id)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="gesture-art-ranges">
          <label>
            <span>Brush <output>{Math.round(controls.brushThickness)}</output></span>
            <input
              max="30"
              min="1"
              onChange={(event) => updateControl("brushThickness", Number(event.target.value))}
              type="range"
              value={controls.brushThickness}
            />
          </label>
          <label>
            <span>Color <output>{Math.round(controls.hueRotation)}°</output></span>
            <input
              max="360"
              min="0"
              onChange={(event) => updateControl("hueRotation", Number(event.target.value))}
              type="range"
              value={controls.hueRotation}
            />
          </label>
          <label>
            <span>Particles <output>{Math.round(controls.emissionRate)}</output></span>
            <input
              max="42"
              min="2"
              onChange={(event) => updateControl("emissionRate", Number(event.target.value))}
              type="range"
              value={controls.emissionRate}
            />
          </label>
        </div>

        <div
          aria-label="Current palette"
          className="gesture-art-palette"
          role="img"
        >
          {getPalette(controls.hueRotation).map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </div>

        <div className="gesture-art-action-grid">
          <button onClick={undo} type="button">Undo</button>
          <button onClick={clearCanvas} type="button">Clear</button>
          <button onClick={() => setFrozen((current) => !current)} type="button">
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button onClick={() => void exportArtwork()} type="button">Export PNG</button>
          <button className="primary" onClick={() => void saveArtwork()} type="button">
            Save to gallery
          </button>
        </div>

        <div className="gesture-art-loop-controls">
          <button
            disabled={recording || exportingVideo}
            onClick={startRecording}
            type="button"
          >
            {recording ? "Recording…" : "Record 10s loop"}
          </button>
          <button
            className="secondary"
            disabled={
              recording || exportingVideo || recordedFrames.length === 0
            }
            onClick={toggleReplay}
            type="button"
          >
            {replaying ? "Stop replay" : "Replay loop"}
          </button>
          <button
            aria-describedby="gesture-art-video-export-status"
            className="gesture-art-video-export"
            disabled={
              recording ||
              exportingVideo ||
              recordedFrames.length === 0 ||
              !videoExportCapability.supported
            }
            onClick={() => void exportLoopVideo()}
            type="button"
          >
            {exportingVideo ? "Exporting video…" : "Export loop video"}
          </button>
          <p
            aria-live="polite"
            className="gesture-art-loop-status"
            id="gesture-art-video-export-status"
            role="status"
          >
            {videoExportStatus}
          </p>
          <p className="gesture-art-loop-privacy">
            Video export captures ten seconds of this artwork canvas only—never
            camera frames or audio.
          </p>
        </div>

        <details className="gesture-art-gallery" open={galleryEntries.length > 0}>
          <summary>Saved on this device ({galleryEntries.length})</summary>
          {galleryEntries.length === 0 ? (
            <p>Save a still to begin your local gallery.</p>
          ) : (
            <ul>
              {galleryEntries.map((entry) => (
                <li key={entry.id}>
                  <span
                    aria-hidden="true"
                    className="gesture-art-gallery-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${
                        entry.thumbnail?.palette?.join(", ") || "#17233d, #78e8bd"
                      })`,
                    }}
                  />
                  <div>
                    <strong>{entry.title}</strong>
                    <small>{new Date(entry.updatedAt).toLocaleDateString()}</small>
                  </div>
                  <button onClick={() => void downloadGalleryEntry(entry)} type="button">
                    Export
                  </button>
                  <button
                    aria-label={`Delete ${entry.title}`}
                    className="danger"
                    onClick={() => void removeGalleryEntry(entry)}
                    type="button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
      </aside>
    </main>
  );
}
