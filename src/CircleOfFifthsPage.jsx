import { useEffect, useMemo, useRef, useState } from "react";
import { detectHands, initHandTracking } from "./handTracking.js";
import { createScopedLogger } from "./logger.js";
import {
  CIRCLE_OF_FIFTHS_SEGMENTS,
  createCircleOfFifthsLayout,
  getChordFrequencies,
  getSegmentAngles,
  getSegmentAtPoint,
} from "./circleOfFifths.js";
import {
  DRUM_BEAT_PRESETS,
  DRUM_STEPS_PER_BAR,
  getDrumBeatPreset,
  getDrumBpmFromSliderPosition,
  getSliderRatioFromDrumBpm,
} from "./circleOfFifthsDrums.js";

const pageLog = createScopedLogger("circleOfFifthsPage");
const POINTER_SMOOTHING = 0.26;
const AUTOSTART_SESSION_KEY = "circle-of-fifths-autostart";
const DEFAULT_DRUM_BPM = 112;
const PINCH_START_THRESHOLD = 0.045;
const PINCH_END_THRESHOLD = 0.06;

export default function CircleOfFifthsPage() {
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(0);
  const processingFrameRef = useRef(false);
  const smoothedPointRef = useRef(null);
  const audioContextRef = useRef(null);
  const activeChordRef = useRef(null);
  const beatButtonRefs = useRef({});
  const bpmSliderTrackRef = useRef(null);
  const pinchActiveRef = useRef(false);
  const bpmDragActiveRef = useRef(false);
  const drumSchedulerIntervalRef = useRef(0);
  const drumTransportRef = useRef({
    nextNoteTime: 0,
    stepIndex: 0,
  });

  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 720 : window.innerHeight,
  }));
  const [sessionState, setSessionState] = useState("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Enable the camera and audio, then steer the wheel with one index finger.",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [fingerPoint, setFingerPoint] = useState(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState(null);
  const [detectedHand, setDetectedHand] = useState(null);
  const [lastChordTitle, setLastChordTitle] = useState("None yet");
  const [pinchActive, setPinchActive] = useState(false);
  const [hoveredBeatId, setHoveredBeatId] = useState(null);
  const [bpmSliderHovered, setBpmSliderHovered] = useState(false);
  const [selectedBeatId, setSelectedBeatId] = useState(DRUM_BEAT_PRESETS[0]?.id ?? "motorik");
  const [drumBpm, setDrumBpm] = useState(DEFAULT_DRUM_BPM);

  const wheelLayout = useMemo(
    () => createCircleOfFifthsLayout(viewport.width, viewport.height),
    [viewport.height, viewport.width],
  );
  const hoveredSegment = useMemo(
    () => CIRCLE_OF_FIFTHS_SEGMENTS.find((segment) => segment.id === hoveredSegmentId) ?? null,
    [hoveredSegmentId],
  );
  const selectedBeat = useMemo(() => getDrumBeatPreset(selectedBeatId), [selectedBeatId]);
  const sliderRatio = useMemo(() => getSliderRatioFromDrumBpm(drumBpm), [drumBpm]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      cleanupTrackingSession({
        activeChordRef,
        animationFrameRef,
        detectorRef,
        processingFrameRef,
        setFingerPoint,
        setHoveredSegmentId,
        setDetectedHand,
        setPinchActive,
        setHoveredBeatId,
        setBpmSliderHovered,
        smoothedPointRef,
        streamRef,
        videoRef,
      });
      stopDrumScheduler(drumSchedulerIntervalRef);
    };
  }, []);

  useEffect(() => {
    if (sessionState !== "active") {
      return undefined;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) {
        return;
      }

      if (processingFrameRef.current) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      processingFrameRef.current = true;

      try {
        const videoElement = videoRef.current;
        const detector = detectorRef.current;
        const hands = await detectHands(detector, videoElement);
        if (cancelled) {
          return;
        }

        const hand = hands[0] ?? null;
        if (!hand?.indexTip) {
          smoothedPointRef.current = null;
          pinchActiveRef.current = false;
          bpmDragActiveRef.current = false;
          releaseActiveChord(activeChordRef.current, audioContextRef.current?.currentTime);
          activeChordRef.current = null;
          setFingerPoint(null);
          setHoveredSegmentId(null);
          setDetectedHand(null);
          setPinchActive(false);
          setHoveredBeatId(null);
          setBpmSliderHovered(false);
          setStatusMessage("Hand not found. Bring one hand back into view.");
          return;
        }

        const rawPoint = {
          x: hand.indexTip.u * viewport.width,
          y: hand.indexTip.v * viewport.height,
        };
        const previousPoint = smoothedPointRef.current;
        const nextPoint = previousPoint
          ? {
              x: previousPoint.x + (rawPoint.x - previousPoint.x) * POINTER_SMOOTHING,
              y: previousPoint.y + (rawPoint.y - previousPoint.y) * POINTER_SMOOTHING,
            }
          : rawPoint;
        smoothedPointRef.current = nextPoint;

        const wasPinching = pinchActiveRef.current;
        const isPinching = getPinchState(hand.pinchDistance, wasPinching);
        pinchActiveRef.current = isPinching;

        const nextSegment = getSegmentAtPoint(nextPoint, wheelLayout);
        syncContinuousChord(audioContextRef.current, activeChordRef, nextSegment);

        const nextHoveredBeatId = getHoveredBeatId(nextPoint, beatButtonRefs.current);
        const nextSliderHovered = isPointInsideElement(nextPoint, bpmSliderTrackRef.current);

        if (isPinching && !wasPinching) {
          if (nextHoveredBeatId) {
            setSelectedBeatId(nextHoveredBeatId);
          }

          if (nextSliderHovered) {
            bpmDragActiveRef.current = true;
            setDrumBpm(
              getDrumBpmFromSliderPosition(nextPoint.x, getElementRect(bpmSliderTrackRef.current)),
            );
          }
        }

        if (bpmDragActiveRef.current && isPinching) {
          setDrumBpm(
            getDrumBpmFromSliderPosition(nextPoint.x, getElementRect(bpmSliderTrackRef.current)),
          );
        }

        if (!isPinching && wasPinching) {
          bpmDragActiveRef.current = false;
        }

        setFingerPoint(nextPoint);
        setHoveredSegmentId(nextSegment?.id ?? null);
        setDetectedHand(hand.handedness ?? "Unknown");
        setPinchActive(isPinching);
        setHoveredBeatId(nextHoveredBeatId);
        setBpmSliderHovered(nextSliderHovered || bpmDragActiveRef.current);
        setStatusMessage(
          nextSegment
            ? `Hovering ${nextSegment.title}. The chord sustains until you glide to another slice.`
            : bpmDragActiveRef.current
              ? "Pinch and slide left or right to change the drum machine BPM."
              : "Trace the wheel with your index finger to sustain major and minor chords.",
        );

        if (nextSegment) {
          setLastChordTitle(nextSegment.title);
        }
      } catch (error) {
        pageLog.error("Tracking frame failed", { error });
        setErrorMessage(error instanceof Error ? error.message : "Tracking failed.");
        setStatusMessage("Tracking paused because a frame failed.");
        setSessionState("error");
      } finally {
        processingFrameRef.current = false;
        if (!cancelled) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
        }
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      processingFrameRef.current = false;
    };
  }, [sessionState, viewport.height, viewport.width, wheelLayout]);

  useEffect(() => {
    const audioContext = audioContextRef.current;
    if (sessionState !== "active" || !audioContext || audioContext.state !== "running") {
      stopDrumScheduler(drumSchedulerIntervalRef);
      return undefined;
    }

    startDrumScheduler({
      audioContext,
      beatId: selectedBeatId,
      bpm: drumBpm,
      drumSchedulerIntervalRef,
      drumTransportRef,
    });

    return () => {
      stopDrumScheduler(drumSchedulerIntervalRef);
    };
  }, [drumBpm, selectedBeatId, sessionState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldAutostart = consumeAutostartIntent();
    if (!shouldAutostart) {
      return;
    }

    void handleStartSession({
      source: "autostart",
      preserveIntentOnFailure: false,
    });
  }, []);

  async function handleStartSession(options = {}) {
    return startSession(options);
  }

  async function startSession(options = {}) {
    const source = options.source ?? "manual";
    const preserveIntentOnFailure = options.preserveIntentOnFailure ?? false;
    setSessionState("starting");
    setErrorMessage("");
    setStatusMessage("Requesting camera access and warming up the hand tracker...");

    try {
      const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Web Audio is not available in this browser.");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }
      if (audioContextRef.current.state !== "running") {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error("Camera element is not ready.");
      }

      videoElement.srcObject = stream;
      await waitForVideoMetadata(videoElement);
      await videoElement.play();

      detectorRef.current = await initHandTracking({
        runtime: "mediapipe",
        maxHands: 1,
      });

      setSessionState("active");
      setStatusMessage("Circle ready. Move one index finger into the wheel to play.");
      pageLog.info("Circle of fifths session started", { source });
    } catch (error) {
      cleanupTrackingSession({
        activeChordRef,
        animationFrameRef,
        detectorRef,
        processingFrameRef,
        setFingerPoint,
        setHoveredSegmentId,
        setDetectedHand,
        setPinchActive,
        setHoveredBeatId,
        setBpmSliderHovered,
        smoothedPointRef,
        streamRef,
        videoRef,
      });
      stopDrumScheduler(drumSchedulerIntervalRef);
      const message =
        error instanceof Error ? error.message : "Unable to start the camera and audio session.";
      setErrorMessage(message);
      setStatusMessage(
        source === "autostart"
          ? "Auto-start could not finish. Use the button once and the page will continue normally."
          : "The session could not start.",
      );
      setSessionState("error");
      if (preserveIntentOnFailure) {
        persistAutostartIntent();
      }
      pageLog.warn("Circle of fifths session failed to start", { source, message });
    }
  }

  return (
    <main className="circle-fifths-page">
      <video ref={videoRef} className="circle-fifths-video" autoPlay muted playsInline />
      <div className="circle-fifths-vignette" />
      <div className="circle-fifths-grid" />

      <a className="circle-fifths-back-link" href="/">
        Back to main app
      </a>

      <section className="circle-fifths-panel circle-fifths-panel-left">
        <p className="circle-fifths-kicker">Standalone music page</p>
        <h1>Finger Circle of Fifths</h1>
        <p className="circle-fifths-copy">
          Track one hand, hover your index finger over the wheel, and each major or minor slice
          answers with a sustained synthesized chord.
        </p>
        <div className="circle-fifths-actions">
          <button type="button" onClick={() => void handleStartSession()} disabled={sessionState === "starting"}>
            {sessionState === "active"
              ? "Restart Camera + Audio"
              : sessionState === "starting"
                ? "Starting..."
                : "Enable Camera + Audio"}
          </button>
        </div>
        <div className="circle-fifths-stats">
          <div>
            <strong>Status</strong>
            <span>{statusMessage}</span>
          </div>
          <div>
            <strong>Hand</strong>
            <span>{detectedHand ?? "Waiting"}</span>
          </div>
          <div>
            <strong>Last chord</strong>
            <span>{lastChordTitle}</span>
          </div>
          <div>
            <strong>Pinch</strong>
            <span>{pinchActive ? "Active" : "Idle"}</span>
          </div>
        </div>
        {errorMessage ? <p className="circle-fifths-error">{errorMessage}</p> : null}
      </section>

      <section className="circle-fifths-panel circle-fifths-panel-right">
        <p className="circle-fifths-panel-label">Hover target</p>
        <p className="circle-fifths-current-chord">
          {hoveredSegment ? hoveredSegment.title : "Move into the wheel"}
        </p>
        <p className="circle-fifths-copy compact">
          Outer ring is major. Inner ring is minor. The center stays silent so you can reset your
          hand without retriggering a chord.
        </p>
      </section>

      <section className="circle-fifths-panel circle-fifths-panel-bottom-right">
        <p className="circle-fifths-panel-label">Drum machine</p>
        <p className="circle-fifths-current-chord">{selectedBeat.label}</p>
        <p className="circle-fifths-copy compact">
          Pinch a beat button to switch patterns, then pinch the BPM rail and slide to change the
          tempo.
        </p>
        <div className="circle-fifths-beat-buttons">
          {DRUM_BEAT_PRESETS.map((beat) => {
            const isActive = beat.id === selectedBeatId;
            const isHovered = beat.id === hoveredBeatId;
            return (
              <button
                key={beat.id}
                ref={(element) => {
                  if (element) {
                    beatButtonRefs.current[beat.id] = element;
                  } else {
                    delete beatButtonRefs.current[beat.id];
                  }
                }}
                type="button"
                className={`circle-fifths-beat-button ${isActive ? "selected" : ""} ${
                  isHovered ? "hovered" : ""
                }`}
                onClick={() => setSelectedBeatId(beat.id)}
              >
                <span>{beat.label}</span>
                <small>{beat.description}</small>
              </button>
            );
          })}
        </div>
        <div className="circle-fifths-bpm-block">
          <div className="circle-fifths-bpm-meta">
            <strong>BPM</strong>
            <span>{drumBpm}</span>
          </div>
          <div
            ref={bpmSliderTrackRef}
            className={`circle-fifths-bpm-slider ${bpmSliderHovered ? "hovered" : ""}`}
            onClick={(event) => {
              setDrumBpm(
                getDrumBpmFromSliderPosition(event.clientX, getElementRect(bpmSliderTrackRef.current)),
              );
            }}
          >
            <div className="circle-fifths-bpm-slider-fill" style={{ width: `${sliderRatio * 100}%` }} />
            <div
              className={`circle-fifths-bpm-slider-thumb ${bpmDragActiveRef.current ? "dragging" : ""}`}
              style={{ left: `${sliderRatio * 100}%` }}
            />
          </div>
        </div>
      </section>

      <svg
        className="circle-fifths-wheel"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        aria-label="Interactive circle of fifths"
        role="img"
      >
        <defs>
          <radialGradient id="circle-fifths-center-glow" cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="35%" stopColor="rgba(210,239,255,0.5)" />
            <stop offset="100%" stopColor="rgba(210,239,255,0)" />
          </radialGradient>
        </defs>
        <circle
          cx={wheelLayout.centerX}
          cy={wheelLayout.centerY}
          r={wheelLayout.outerRadius * 1.1}
          className="circle-fifths-wheel-shell"
        />
        {CIRCLE_OF_FIFTHS_SEGMENTS.map((segment) => {
          const ringGeometry =
            segment.ring === "outer"
              ? {
                  innerRadius: wheelLayout.outerRingInnerRadius,
                  outerRadius: wheelLayout.outerRadius,
                }
              : {
                  innerRadius: wheelLayout.innerRingInnerRadius,
                  outerRadius: wheelLayout.innerRingOuterRadius,
                };
          const { startAngle, endAngle, centerAngle } = getSegmentAngles(segment.index);
          const path = describeDonutSegment(
            wheelLayout.centerX,
            wheelLayout.centerY,
            ringGeometry.innerRadius,
            ringGeometry.outerRadius,
            startAngle,
            endAngle,
          );
          const labelRadius = (ringGeometry.innerRadius + ringGeometry.outerRadius) / 2;
          const labelPoint = polarToCartesian(
            wheelLayout.centerX,
            wheelLayout.centerY,
            labelRadius,
            centerAngle,
          );
          const isHovered = hoveredSegmentId === segment.id;

          return (
            <g key={segment.id}>
              <path
                className={`circle-fifths-segment ${segment.ring} ${isHovered ? "hovered" : ""}`}
                d={path}
                style={{ "--segment-hue": `${segment.index * 30}deg` }}
              />
              <text
                className={`circle-fifths-segment-label ${segment.ring} ${
                  isHovered ? "hovered" : ""
                }`}
                x={labelPoint.x}
                y={labelPoint.y}
              >
                {segment.label}
              </text>
            </g>
          );
        })}
        <circle
          cx={wheelLayout.centerX}
          cy={wheelLayout.centerY}
          r={wheelLayout.innerRingInnerRadius * 0.82}
          className="circle-fifths-center-core"
        />
        <circle
          cx={wheelLayout.centerX}
          cy={wheelLayout.centerY}
          r={wheelLayout.innerRingInnerRadius * 0.82}
          fill="url(#circle-fifths-center-glow)"
          opacity="0.9"
        />
        <text className="circle-fifths-center-title" x={wheelLayout.centerX} y={wheelLayout.centerY - 10}>
          Circle
        </text>
        <text className="circle-fifths-center-subtitle" x={wheelLayout.centerX} y={wheelLayout.centerY + 18}>
          of Fifths
        </text>
      </svg>

      {fingerPoint ? (
        <>
          <div
            className="circle-fifths-finger-glow"
            style={{
              left: `${fingerPoint.x}px`,
              top: `${fingerPoint.y}px`,
            }}
          />
          <div
            className={`circle-fifths-finger-dot ${hoveredSegment ? "active" : ""}`}
            style={{
              left: `${fingerPoint.x}px`,
              top: `${fingerPoint.y}px`,
            }}
          />
        </>
      ) : null}
    </main>
  );
}

function waitForVideoMetadata(videoElement) {
  if (videoElement.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Camera metadata failed to load."));
    };
    const cleanup = () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("error", handleError);
    };

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    videoElement.addEventListener("error", handleError, { once: true });
  });
}

function cleanupTrackingSession({
  activeChordRef,
  animationFrameRef,
  detectorRef,
  processingFrameRef,
  setFingerPoint,
  setHoveredSegmentId,
  setDetectedHand,
  setPinchActive,
  setHoveredBeatId,
  setBpmSliderHovered,
  smoothedPointRef,
  streamRef,
  videoRef,
}) {
  if (animationFrameRef.current) {
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = 0;
  }

  releaseActiveChord(activeChordRef.current);
  activeChordRef.current = null;
  detectorRef.current?.dispose?.();
  detectorRef.current = null;
  processingFrameRef.current = false;
  smoothedPointRef.current = null;

  if (streamRef.current) {
    for (const track of streamRef.current.getTracks()) {
      track.stop();
    }
  }
  streamRef.current = null;

  if (videoRef.current) {
    videoRef.current.pause();
    videoRef.current.srcObject = null;
  }

  setFingerPoint(null);
  setHoveredSegmentId(null);
  setDetectedHand(null);
  setPinchActive(false);
  setHoveredBeatId(null);
  setBpmSliderHovered(false);
}

function getPinchState(pinchDistance, wasPinching) {
  if (!Number.isFinite(pinchDistance)) {
    return false;
  }

  if (wasPinching) {
    return pinchDistance <= PINCH_END_THRESHOLD;
  }

  return pinchDistance <= PINCH_START_THRESHOLD;
}

function getHoveredBeatId(point, beatButtonRefs) {
  if (!point) {
    return null;
  }

  for (const [beatId, element] of Object.entries(beatButtonRefs)) {
    if (isPointInsideElement(point, element)) {
      return beatId;
    }
  }

  return null;
}

function isPointInsideElement(point, element) {
  const rect = getElementRect(element);
  if (!rect || !point) {
    return false;
  }

  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function getElementRect(element) {
  return element?.getBoundingClientRect?.() ?? null;
}

function syncContinuousChord(audioContext, activeChordRef, segment) {
  if (!audioContext) {
    return;
  }

  const activeChord = activeChordRef.current;
  if (!segment) {
    releaseActiveChord(activeChord, audioContext.currentTime);
    activeChordRef.current = null;
    return;
  }

  if (activeChord?.segmentId === segment.id) {
    return;
  }

  releaseActiveChord(activeChord, audioContext.currentTime);
  activeChordRef.current = startContinuousChord(audioContext, segment);
}

function startContinuousChord(audioContext, segment) {
  if (!audioContext || !segment) {
    return null;
  }

  const frequencies = getChordFrequencies(segment);
  if (frequencies.length === 0) {
    return null;
  }

  const now = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.setValueAtTime(1800, now);
  lowPass.Q.setValueAtTime(0.9, now);

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);

  masterGain.connect(lowPass);
  lowPass.connect(audioContext.destination);

  const voices = frequencies.map((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const voiceGain = audioContext.createGain();
    oscillator.type =
      index === 0 ? "sine" : index === frequencies.length - 1 ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(index === 1 ? 4 : index === 2 ? -4 : 0, now);
    voiceGain.gain.setValueAtTime(
      index === 0 ? 0.42 : index === frequencies.length - 1 ? 0.1 : 0.16,
      now,
    );
    oscillator.connect(voiceGain);
    voiceGain.connect(masterGain);
    oscillator.start(now);
    return { oscillator, voiceGain };
  });

  return {
    segmentId: segment.id,
    masterGain,
    lowPass,
    voices,
  };
}

function releaseActiveChord(activeChord, releaseAt = 0) {
  if (!activeChord) {
    return;
  }

  const now = Number.isFinite(releaseAt) ? releaseAt : 0;
  const safeReleaseAt = Math.max(now, 0);

  try {
    activeChord.masterGain.gain.cancelScheduledValues(safeReleaseAt);
    activeChord.masterGain.gain.setValueAtTime(
      Math.max(activeChord.masterGain.gain.value, 0.0001),
      safeReleaseAt,
    );
    activeChord.masterGain.gain.exponentialRampToValueAtTime(0.0001, safeReleaseAt + 0.12);
  } catch (error) {
    pageLog.warn("Failed to schedule chord release cleanly", { error });
  }

  activeChord.voices?.forEach(({ oscillator, voiceGain }) => {
    try {
      oscillator.stop(safeReleaseAt + 0.16);
      oscillator.addEventListener(
        "ended",
        () => {
          oscillator.disconnect();
          voiceGain.disconnect();
        },
        { once: true },
      );
    } catch (error) {
      pageLog.warn("Failed to stop chord voice cleanly", { error });
    }
  });

  window.setTimeout(() => {
    activeChord.masterGain.disconnect();
    activeChord.lowPass.disconnect();
  }, 320);
}

function persistAutostartIntent() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    AUTOSTART_SESSION_KEY,
    JSON.stringify({
      issuedAt: Date.now(),
    }),
  );
}

function consumeAutostartIntent() {
  if (typeof window === "undefined") {
    return false;
  }

  const rawIntent = window.sessionStorage.getItem(AUTOSTART_SESSION_KEY);
  window.sessionStorage.removeItem(AUTOSTART_SESSION_KEY);
  if (!rawIntent) {
    return false;
  }

  try {
    const parsed = JSON.parse(rawIntent);
    return Date.now() - Number(parsed?.issuedAt ?? 0) < 30000;
  } catch {
    return false;
  }
}

function startDrumScheduler({
  audioContext,
  beatId,
  bpm,
  drumSchedulerIntervalRef,
  drumTransportRef,
}) {
  stopDrumScheduler(drumSchedulerIntervalRef);

  const beat = getDrumBeatPreset(beatId);
  const lookAheadSeconds = 0.12;
  const schedulerIntervalMs = 25;
  const sixteenthNoteSeconds = 60 / bpm / 4;

  drumTransportRef.current = {
    nextNoteTime: audioContext.currentTime + 0.05,
    stepIndex: 0,
  };

  const schedule = () => {
    while (drumTransportRef.current.nextNoteTime < audioContext.currentTime + lookAheadSeconds) {
      const { stepIndex, nextNoteTime } = drumTransportRef.current;
      scheduleDrumStep(audioContext, beat, stepIndex, nextNoteTime);
      drumTransportRef.current.stepIndex = (stepIndex + 1) % DRUM_STEPS_PER_BAR;
      drumTransportRef.current.nextNoteTime += sixteenthNoteSeconds;
    }
  };

  schedule();
  drumSchedulerIntervalRef.current = window.setInterval(schedule, schedulerIntervalMs);
}

function stopDrumScheduler(drumSchedulerIntervalRef) {
  if (drumSchedulerIntervalRef.current) {
    window.clearInterval(drumSchedulerIntervalRef.current);
    drumSchedulerIntervalRef.current = 0;
  }
}

function scheduleDrumStep(audioContext, beat, stepIndex, time) {
  if (beat.steps.kick[stepIndex]) {
    playKick(audioContext, time);
  }
  if (beat.steps.snare[stepIndex]) {
    playSnare(audioContext, time);
  }
  if (beat.steps.hat[stepIndex]) {
    playHat(audioContext, time);
  }
}

function playKick(audioContext, time) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(150, time);
  oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.14);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.75, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.2);
  cleanupOneShotVoice(oscillator, gain);
}

function playSnare(audioContext, time) {
  const noise = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  const oscillator = audioContext.createOscillator();
  const toneGain = audioContext.createGain();

  noise.buffer = createNoiseBuffer(audioContext);
  noiseFilter.type = "highpass";
  noiseFilter.frequency.setValueAtTime(1200, time);
  noiseGain.gain.setValueAtTime(0.0001, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.38, time + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(180, time);
  toneGain.gain.setValueAtTime(0.0001, time);
  toneGain.gain.exponentialRampToValueAtTime(0.22, time + 0.01);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioContext.destination);

  oscillator.connect(toneGain);
  toneGain.connect(audioContext.destination);

  noise.start(time);
  noise.stop(time + 0.13);
  oscillator.start(time);
  oscillator.stop(time + 0.12);

  cleanupOneShotVoice(noise, noiseFilter, noiseGain);
  cleanupOneShotVoice(oscillator, toneGain);
}

function playHat(audioContext, time) {
  const noise = audioContext.createBufferSource();
  const bandpass = audioContext.createBiquadFilter();
  const highpass = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  noise.buffer = createNoiseBuffer(audioContext);
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(9000, time);
  bandpass.Q.setValueAtTime(0.8, time);
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(7000, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.14, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  noise.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(gain);
  gain.connect(audioContext.destination);
  noise.start(time);
  noise.stop(time + 0.055);
  cleanupOneShotVoice(noise, bandpass, highpass, gain);
}

let sharedNoiseBuffer = null;

function createNoiseBuffer(audioContext) {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === audioContext.sampleRate) {
    return sharedNoiseBuffer;
  }

  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * 0.25, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

function cleanupOneShotVoice(source, ...nodes) {
  source.addEventListener(
    "ended",
    () => {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    },
    { once: true },
  );
}

function describeDonutSegment(centerX, centerY, innerRadius, outerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleFromTop) {
  const angleFromRight = angleFromTop - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angleFromRight),
    y: centerY + radius * Math.sin(angleFromRight),
  };
}
