import { useEffect, useMemo, useRef, useState } from "react";
import { detectHands, initHandTracking } from "./trackingRuntimeLoader.js";
import { createScopedLogger } from "./logger.js";
import {
  closeAudioContext,
  createMediaTrackingSessionController,
  isMediaTrackingSessionCancelledError,
} from "./mediaTrackingSession.js";
import {
  CIRCLE_OF_FIFTHS_SEGMENTS,
  createCircleOfFifthsLayout,
  getChordFrequencies,
  getSegmentAngles,
  getSegmentAtPoint,
} from "./circleOfFifths.js";
import {
  DRUM_BPM_MAX,
  DRUM_BPM_MIN,
  DRUM_BEAT_PRESETS,
  DRUM_STEPS_PER_BAR,
  getDrumBeatPreset,
  getDrumBpmFromSliderPosition,
  getSliderRatioFromDrumBpm,
} from "./circleOfFifthsDrums.js";
import {
  JAM_LOOP_DRUM_INSTRUMENTS,
  JAM_LOOP_MAX_DURATION_MS,
  JAM_LOOP_MAX_EVENTS,
  createJamLoop,
  exportJamLoopJson,
  getJamLoopSummary,
  loadSavedJamLoop,
  saveJamLoop,
} from "./circleOfFifthsLoops.js";
import {
  JAM_ARPEGGIO_OPTIONS,
  JAM_CHORD_TIMBRES,
  JAM_KEY_OPTIONS,
  JAM_PROGRESSION_PRESETS,
  JAM_SCALE_OPTIONS,
  createJamSoundSignature,
  getJamAllowedSegmentIds,
  getJamArpeggioMode,
  getJamArpeggioNoteIndex,
  getJamArpeggioStepDurationMs,
  getJamChordTimbre,
  getJamDrumMixScale,
  getJamProgression,
  getJamProgressionPreset,
  resolveJamKeyLockedSegment,
} from "./circleOfFifthsStudio.js";
import { loadUserPreferences } from "./userPreferences.js";
import {
  adaptHandsForCamera,
  expandPointerRangeForSeatedPlay,
  getCursorSmoothingAlpha,
  getPinchThresholds,
  selectPreferredHand,
} from "./inputPreferences.js";

const pageLog = createScopedLogger("circleOfFifthsPage");
const DEFAULT_POINTER_ALPHA = 0.26;
const DEFAULT_APP_POINTER_ALPHA = 0.35;
const AUTOSTART_SESSION_KEY = "circle-of-fifths-autostart";
const DEFAULT_DRUM_BPM = 112;
const LOOP_NAME_MAX_LENGTH = 48;
const STACKED_LAYOUT_MAX_WIDTH = 1080;
const WHEEL_VIEWBOX_SIZE = 1000;
const LOOP_DRUM_LABELS = {
  kick: "Kick",
  snare: "Snare",
  hat: "Hi-hat",
};

export default function CircleOfFifthsPage() {
  const preferences = useMemo(() => loadUserPreferences(), []);
  const videoRef = useRef(null);
  const wheelRef = useRef(null);
  const detectorRef = useRef(null);
  const sessionControllerRef = useRef(null);
  const sessionOperationRef = useRef(0);
  const mountedRef = useRef(true);
  const animationFrameRef = useRef(0);
  const processingFrameRef = useRef(false);
  const smoothedPointRef = useRef(null);
  const audioContextRef = useRef(null);
  const activeChordRef = useRef(null);
  const beatButtonRefs = useRef({});
  const bpmSliderTrackRef = useRef(null);
  const pinchActiveRef = useRef(false);
  const bpmDragActiveRef = useRef(false);
  const directInputActiveRef = useRef(false);
  const directChordReleaseTimerRef = useRef(0);
  const drumSchedulerIntervalRef = useRef(0);
  const drumTransportRef = useRef({
    nextNoteTime: 0,
    stepIndex: 0,
  });
  const loopRecordingRef = useRef({
    active: false,
    startedAt: 0,
    events: [],
    bpm: DEFAULT_DRUM_BPM,
    beatId: DRUM_BEAT_PRESETS[0]?.id ?? "motorik",
  });
  const loopPlaybackRef = useRef({
    active: false,
    cycleStartedAt: 0,
    loop: null,
    timerIds: [],
  });
  const loopClockIntervalRef = useRef(0);
  const loopAutoStopTimerRef = useRef(0);
  const loopNameRef = useRef("Untitled loop");
  const studioControlsRef = useRef(null);

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
  const [mobilePanel, setMobilePanel] = useState("setup");
  const [setupExpanded, setSetupExpanded] = useState(true);
  const [loopDraft, setLoopDraft] = useState(null);
  const [savedLoop, setSavedLoop] = useState(() => loadSavedJamLoop().loop);
  const [loopName, setLoopName] = useState("Untitled loop");
  const [loopMode, setLoopMode] = useState("idle");
  const [loopElapsedMs, setLoopElapsedMs] = useState(0);
  const [recordedEventCount, setRecordedEventCount] = useState(0);
  const [loopStatus, setLoopStatus] = useState(
    "Record chord changes and drum-pad hits, then replay them as a repeating loop.",
  );
  const [chordTimbreId, setChordTimbreId] = useState("warm-pad");
  const [arpeggioMode, setArpeggioMode] = useState("off");
  const [jamKeyId, setJamKeyId] = useState("C");
  const [jamScaleId, setJamScaleId] = useState("major");
  const [keyLockEnabled, setKeyLockEnabled] = useState(false);
  const [progressionPresetId, setProgressionPresetId] = useState("pop-lift");
  const [progressionStep, setProgressionStep] = useState(0);
  const [drumsPlaying, setDrumsPlaying] = useState(true);
  const [drumVolume, setDrumVolume] = useState(72);
  const [drumMutes, setDrumMutes] = useState({
    kick: false,
    snare: false,
    hat: false,
  });

  const wheelLayout = useMemo(
    () => createCircleOfFifthsLayout(WHEEL_VIEWBOX_SIZE, WHEEL_VIEWBOX_SIZE),
    [],
  );
  const hoveredSegment = useMemo(
    () => CIRCLE_OF_FIFTHS_SEGMENTS.find((segment) => segment.id === hoveredSegmentId) ?? null,
    [hoveredSegmentId],
  );
  const selectedBeat = useMemo(() => getDrumBeatPreset(selectedBeatId), [selectedBeatId]);
  const sliderRatio = useMemo(() => getSliderRatioFromDrumBpm(drumBpm), [drumBpm]);
  const loopSummary = useMemo(() => getJamLoopSummary(loopDraft), [loopDraft]);
  const allowedSegmentIds = useMemo(
    () => new Set(getJamAllowedSegmentIds(jamKeyId, jamScaleId)),
    [jamKeyId, jamScaleId],
  );
  const progression = useMemo(
    () => getJamProgression(progressionPresetId, jamKeyId),
    [jamKeyId, progressionPresetId],
  );
  const selectedProgression = useMemo(
    () => getJamProgressionPreset(progressionPresetId),
    [progressionPresetId],
  );

  studioControlsRef.current = {
    chordTimbreId,
    arpeggioMode,
    jamKeyId,
    jamScaleId,
    keyLockEnabled,
    progression,
    drumBpm,
    drumVolume,
    drumMutes,
  };

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
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && viewport.width <= STACKED_LAYOUT_MAX_WIDTH) {
        setMobilePanel(null);
        if (sessionState === "active") {
          setSetupExpanded(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sessionState, viewport.width]);

  useEffect(() => {
    const handleDrumShortcut = (event) => {
      if (
        sessionState !== "active" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTextEntryElement(event.target)
      ) {
        return;
      }

      const instrument = {
        1: "kick",
        2: "snare",
        3: "hat",
      }[event.key];
      if (!instrument) {
        return;
      }

      event.preventDefault();
      triggerLoopDrum(instrument);
    };

    window.addEventListener("keydown", handleDrumShortcut);
    return () => {
      window.removeEventListener("keydown", handleDrumShortcut);
    };
  }, [sessionState]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      sessionOperationRef.current += 1;
      stopLoopPlayback({ updateUi: false });
      stopLoopRecording({ updateUi: false });
      resetTrackingInteraction({ updateUi: false });
      void sessionControllerRef.current?.stop();
      void closeAudioContextRef(audioContextRef);
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

      if (directInputActiveRef.current) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      processingFrameRef.current = true;

      try {
        const videoElement = videoRef.current;
        const detector = detectorRef.current;
        const detectedHands = await detectHands(detector, videoElement);
        if (cancelled || directInputActiveRef.current) {
          return;
        }

        const hands = adaptHandsForCamera(
          detectedHands,
          preferences.mirrorCamera,
        );
        const hand = selectPreferredHand(hands, preferences.dominantHand);
        if (!hand?.indexTip) {
          smoothedPointRef.current = null;
          pinchActiveRef.current = false;
          bpmDragActiveRef.current = false;
          syncInteractiveChord(null);
          setFingerPoint(null);
          setHoveredSegmentId(null);
          setDetectedHand(null);
          setPinchActive(false);
          setHoveredBeatId(null);
          setBpmSliderHovered(false);
          setStatusMessage("Hand not found. Bring one hand back into view.");
          return;
        }

        const pointerTip = expandPointerRangeForSeatedPlay(
          hand.indexTip,
          preferences.seatedMode,
        );
        const rawPoint = {
          x: pointerTip.u * viewport.width,
          y: pointerTip.v * viewport.height,
        };
        const pointerAlpha =
          getCursorSmoothingAlpha(preferences.cursorSmoothing) *
          (DEFAULT_POINTER_ALPHA / DEFAULT_APP_POINTER_ALPHA);
        const previousPoint = smoothedPointRef.current;
        const nextPoint = previousPoint
          ? {
              x: previousPoint.x + (rawPoint.x - previousPoint.x) * pointerAlpha,
              y: previousPoint.y + (rawPoint.y - previousPoint.y) * pointerAlpha,
            }
          : rawPoint;
        smoothedPointRef.current = nextPoint;

        const wasPinching = pinchActiveRef.current;
        const isPinching = getPinchState(
          hand.pinchDistance,
          wasPinching,
          preferences.pinchThreshold,
        );
        pinchActiveRef.current = isPinching;

        const wheelPoint = getWheelPointFromClientPoint(
          nextPoint,
          wheelRef.current,
          wheelLayout,
        );
        const nextSegment = getSegmentAtPoint(wheelPoint, wheelLayout);
        const playableSegment = syncInteractiveChord(nextSegment);
        const keyLockedOut = Boolean(nextSegment && !playableSegment);

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
          keyLockedOut
            ? `${nextSegment.title} is outside the ${jamKeyId} ${jamScaleId} key lock. Choose a lit chord.`
            : playableSegment
              ? `Hovering ${playableSegment.title}. The chord sustains until you glide to another slice.`
              : bpmDragActiveRef.current
                ? "Pinch and slide left or right to change the drum machine BPM."
                : "Trace the wheel with your index finger to sustain major and minor chords.",
        );

        if (playableSegment) {
          setLastChordTitle(playableSegment.title);
        }
      } catch (error) {
        cancelled = true;
        sessionOperationRef.current += 1;
        stopLoopPlayback();
        stopLoopRecording();
        resetTrackingInteraction();
        void getSessionController().stop();
        void closeAudioContextRef(audioContextRef);
        stopDrumScheduler(drumSchedulerIntervalRef);
        pageLog.error("Tracking frame failed", { error });
        setErrorMessage(error instanceof Error ? error.message : "Tracking failed.");
        setStatusMessage("Tracking paused because a frame failed.");
        setSessionState("error");
        setSetupExpanded(true);
        if (viewport.width <= STACKED_LAYOUT_MAX_WIDTH) {
          setMobilePanel("setup");
        }
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
  }, [
    jamKeyId,
    jamScaleId,
    preferences,
    sessionState,
    viewport.height,
    viewport.width,
    wheelLayout,
  ]);

  useEffect(() => {
    const audioContext = audioContextRef.current;
    if (
      sessionState !== "active" ||
      !drumsPlaying ||
      !audioContext ||
      audioContext.state !== "running"
    ) {
      stopDrumScheduler(drumSchedulerIntervalRef);
      return undefined;
    }

    startDrumScheduler({
      audioContext,
      beatId: selectedBeatId,
      bpm: drumBpm,
      getDrumMixOptions: () => ({
        mutedInstruments: studioControlsRef.current.drumMutes,
        volumePercent: studioControlsRef.current.drumVolume,
      }),
      drumSchedulerIntervalRef,
      drumTransportRef,
    });

    return () => {
      stopDrumScheduler(drumSchedulerIntervalRef);
    };
  }, [drumBpm, drumsPlaying, selectedBeatId, sessionState]);

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
    const operationId = sessionOperationRef.current + 1;
    sessionOperationRef.current = operationId;
    setSessionState("starting");
    setSetupExpanded(true);
    setErrorMessage("");
    setStatusMessage("Requesting camera access and warming up the hand tracker...");
    stopLoopPlayback();
    stopLoopRecording();
    resetTrackingInteraction();
    stopDrumScheduler(drumSchedulerIntervalRef);

    const sessionController = getSessionController();
    const stopPreviousSession = sessionController.stop();

    try {
      const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Web Audio is not available in this browser.");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }
      if (audioContextRef.current.state !== "running") {
        await Promise.all([stopPreviousSession, audioContextRef.current.resume()]);
      } else {
        await stopPreviousSession;
      }

      if (!mountedRef.current || operationId !== sessionOperationRef.current) {
        return;
      }

      await sessionController.start();

      if (!mountedRef.current || operationId !== sessionOperationRef.current) {
        await sessionController.stop();
        return;
      }

      setSessionState("active");
      setStatusMessage("Circle ready. Move one index finger into the wheel to play.");
      setSetupExpanded(false);
      if (viewport.width <= STACKED_LAYOUT_MAX_WIDTH) {
        setMobilePanel(null);
      }
      pageLog.info("Circle of fifths session started", { source });
    } catch (error) {
      await Promise.allSettled([stopPreviousSession, sessionController.stop()]);

      if (
        !mountedRef.current ||
        operationId !== sessionOperationRef.current ||
        isMediaTrackingSessionCancelledError(error)
      ) {
        return;
      }

      resetTrackingInteraction();
      await closeAudioContextRef(audioContextRef);
      stopDrumScheduler(drumSchedulerIntervalRef);
      if (!mountedRef.current || operationId !== sessionOperationRef.current) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unable to start the camera and audio session.";
      setErrorMessage(message);
      setStatusMessage(
        source === "autostart"
          ? "Auto-start could not finish. Use the button once and the page will continue normally."
          : "The session could not start.",
      );
      setSessionState("error");
      setSetupExpanded(true);
      if (viewport.width <= STACKED_LAYOUT_MAX_WIDTH) {
        setMobilePanel("setup");
      }
      if (preserveIntentOnFailure) {
        persistAutostartIntent();
      }
      pageLog.warn("Circle of fifths session failed to start", { source, message });
    }
  }

  function getSessionController() {
    if (!sessionControllerRef.current) {
      sessionControllerRef.current = createMediaTrackingSessionController({
        requestStream: () =>
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }),
        createDetector: () =>
          initHandTracking({
            runtime: "mediapipe",
            maxHands: 1,
          }),
        getVideoElement: () => videoRef.current,
        waitForVideoMetadata,
        onSessionChange: (session) => {
          detectorRef.current = session?.detector ?? null;
        },
        onCleanupError: (error, resourceType) => {
          pageLog.warn("Circle session resource cleanup failed", {
            error,
            resourceType,
          });
        },
      });
    }

    return sessionControllerRef.current;
  }

  function resetTrackingInteraction({ updateUi = true } = {}) {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    releaseActiveChord(activeChordRef.current, audioContextRef.current?.currentTime);
    activeChordRef.current = null;
    processingFrameRef.current = false;
    smoothedPointRef.current = null;
    pinchActiveRef.current = false;
    bpmDragActiveRef.current = false;
    directInputActiveRef.current = false;
    if (directChordReleaseTimerRef.current) {
      window.clearTimeout(directChordReleaseTimerRef.current);
      directChordReleaseTimerRef.current = 0;
    }

    if (updateUi) {
      setFingerPoint(null);
      setHoveredSegmentId(null);
      setDetectedHand(null);
      setPinchActive(false);
      setHoveredBeatId(null);
      setBpmSliderHovered(false);
    }
  }

  function syncInteractiveChord(
    segment,
    { record = true, respectKeyLock = true, advanceGuide = true } = {},
  ) {
    const studioControls = studioControlsRef.current;
    const playableSegment = respectKeyLock
      ? resolveJamKeyLockedSegment(segment, {
          enabled: studioControls.keyLockEnabled,
          keyId: studioControls.jamKeyId,
          scaleId: studioControls.jamScaleId,
        })
      : segment;
    const previousSegmentId = activeChordRef.current?.segmentId ?? null;
    syncContinuousChord(audioContextRef.current, activeChordRef, playableSegment, {
      timbreId: studioControls.chordTimbreId,
      arpeggioMode: studioControls.arpeggioMode,
      bpm: studioControls.drumBpm,
    });
    const nextSegmentId = activeChordRef.current?.segmentId ?? null;
    if (previousSegmentId === nextSegmentId) {
      return playableSegment;
    }

    if (advanceGuide && nextSegmentId) {
      setProgressionStep((currentStep) => {
        const currentProgression = studioControlsRef.current.progression;
        if (
          currentProgression.length === 0 ||
          currentProgression[currentStep]?.segment.id !== nextSegmentId
        ) {
          return currentStep;
        }
        return (currentStep + 1) % currentProgression.length;
      });
    }

    if (!record) {
      return playableSegment;
    }

    if (nextSegmentId) {
      recordLoopEvent({
        type: "chord-on",
        segmentId: nextSegmentId,
      });
      return playableSegment;
    }

    recordLoopEvent({
      type: "chord-off",
    });
    return playableSegment;
  }

  function recordLoopEvent(event) {
    const recording = loopRecordingRef.current;
    if (!recording.active) {
      return false;
    }
    if (recording.events.length >= JAM_LOOP_MAX_EVENTS - 1) {
      setLoopStatus(
        "This take reached the 256-event limit. Stop to keep it, or clear it and record again.",
      );
      return false;
    }

    const atMs = Math.min(
      JAM_LOOP_MAX_DURATION_MS,
      Math.max(0, Math.round(getClockTime() - recording.startedAt)),
    );
    const nextEvent = {
      ...event,
      atMs,
    };
    recording.events.push(nextEvent);
    setRecordedEventCount(recording.events.length);
    return true;
  }

  function startLoopRecording() {
    const audioContext = audioContextRef.current;
    if (sessionState !== "active" || !audioContext || audioContext.state !== "running") {
      setLoopStatus("Enable Camera + Audio before recording a loop.");
      openSetupPanel();
      return;
    }

    stopLoopPlayback({ updateUi: false });
    clearLoopClock();
    const startedAt = getClockTime();
    const initialEvents = activeChordRef.current?.segmentId
      ? [
          {
            type: "chord-on",
            atMs: 0,
            segmentId: activeChordRef.current.segmentId,
          },
        ]
      : [];
    loopRecordingRef.current = {
      active: true,
      startedAt,
      createdAt: Date.now(),
      events: initialEvents,
      bpm: drumBpm,
      beatId: selectedBeatId,
    };
    setLoopDraft(null);
    setRecordedEventCount(initialEvents.length);
    setLoopElapsedMs(0);
    setLoopMode("recording");
    setLoopStatus("Recording. Play chords or use the three drum pads; Stop closes the loop.");
    loopClockIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.min(
        JAM_LOOP_MAX_DURATION_MS,
        Math.max(0, getClockTime() - loopRecordingRef.current.startedAt),
      );
      setLoopElapsedMs(elapsed);
    }, 100);
    loopAutoStopTimerRef.current = window.setTimeout(() => {
      loopAutoStopTimerRef.current = 0;
      stopLoopRecording();
    }, JAM_LOOP_MAX_DURATION_MS);
  }

  function stopLoopRecording({ updateUi = true } = {}) {
    const recording = loopRecordingRef.current;
    if (!recording.active) {
      return null;
    }

    const durationMs = Math.min(
      JAM_LOOP_MAX_DURATION_MS,
      Math.max(0, Math.round(getClockTime() - recording.startedAt)),
    );
    if (activeChordRef.current?.segmentId) {
      if (recording.events.length < JAM_LOOP_MAX_EVENTS) {
        recording.events.push({
          type: "chord-off",
          atMs: durationMs,
        });
      }
    }
    recording.active = false;
    clearLoopClock();

    const loop = createJamLoop({
      name: loopNameRef.current,
      durationMs,
      bpm: recording.bpm,
      beatId: recording.beatId,
      events: recording.events,
      createdAt: recording.createdAt,
      updatedAt: Date.now(),
    });
    if (updateUi && loop) {
      const summary = getJamLoopSummary(loop);
      loopNameRef.current = loop.name;
      setLoopName(loop.name);
      setLoopDraft(loop);
      setRecordedEventCount(summary.eventCount);
      setLoopElapsedMs(loop.durationMs);
      setLoopMode("idle");
      setLoopStatus(
        summary.eventCount > 0
          ? `Captured ${summary.chordCount} chord changes and ${summary.drumHitCount} drum hits in ${summary.durationLabel}.`
          : "Nothing was captured. Record again and play a chord or drum pad before stopping.",
      );
    }
    return loop;
  }

  function clearLoopClock() {
    if (loopClockIntervalRef.current) {
      window.clearInterval(loopClockIntervalRef.current);
      loopClockIntervalRef.current = 0;
    }
    if (loopAutoStopTimerRef.current) {
      window.clearTimeout(loopAutoStopTimerRef.current);
      loopAutoStopTimerRef.current = 0;
    }
  }

  function startLoopPlayback() {
    const audioContext = audioContextRef.current;
    if (
      !loopDraft ||
      loopSummary.eventCount === 0 ||
      sessionState !== "active" ||
      !audioContext ||
      audioContext.state !== "running"
    ) {
      setLoopStatus(
        sessionState === "active"
          ? "Record or load a loop with at least one event before pressing Play."
          : "Enable Camera + Audio before playing a saved loop.",
      );
      return;
    }

    stopLoopRecording();
    stopLoopPlayback({ updateUi: false });
    releaseActiveChord(activeChordRef.current, audioContext.currentTime);
    activeChordRef.current = null;
    directInputActiveRef.current = true;
    loopPlaybackRef.current = {
      active: true,
      cycleStartedAt: getClockTime(),
      loop: loopDraft,
      timerIds: [],
    };
    setSelectedBeatId(loopDraft.beatId);
    setDrumBpm(loopDraft.bpm);
    setLoopMode("playing");
    setLoopElapsedMs(0);
    setLoopStatus(`Playing ${loopDraft.name} on repeat. Press Stop to return to live play.`);
    scheduleLoopPlaybackCycle();
    loopClockIntervalRef.current = window.setInterval(() => {
      const playback = loopPlaybackRef.current;
      if (!playback.active || !playback.loop) {
        return;
      }
      setLoopElapsedMs(
        Math.min(
          playback.loop.durationMs,
          Math.max(0, getClockTime() - playback.cycleStartedAt),
        ),
      );
    }, 100);
  }

  function scheduleLoopPlaybackCycle() {
    const playback = loopPlaybackRef.current;
    if (!playback.active || !playback.loop) {
      return;
    }

    releaseActiveChord(activeChordRef.current, audioContextRef.current?.currentTime);
    activeChordRef.current = null;
    setHoveredSegmentId(null);
    playback.timerIds = [];
    playback.cycleStartedAt = getClockTime();
    setLoopElapsedMs(0);

    playback.loop.events.forEach((event) => {
      const timerId = window.setTimeout(() => {
        if (loopPlaybackRef.current.active) {
          playLoopEvent(event);
        }
      }, event.atMs);
      playback.timerIds.push(timerId);
    });

    const nextCycleTimerId = window.setTimeout(() => {
      if (!loopPlaybackRef.current.active) {
        return;
      }
      scheduleLoopPlaybackCycle();
    }, playback.loop.durationMs);
    playback.timerIds.push(nextCycleTimerId);
  }

  function playLoopEvent(event) {
    if (event.type === "chord-on") {
      const segment =
        CIRCLE_OF_FIFTHS_SEGMENTS.find((candidate) => candidate.id === event.segmentId) ?? null;
      if (!segment) {
        return;
      }
      syncInteractiveChord(segment, {
        record: false,
        respectKeyLock: false,
        advanceGuide: false,
      });
      setHoveredSegmentId(segment.id);
      setLastChordTitle(segment.title);
      return;
    }

    if (event.type === "chord-off") {
      syncInteractiveChord(null, {
        record: false,
        respectKeyLock: false,
        advanceGuide: false,
      });
      setHoveredSegmentId(null);
      return;
    }

    if (event.type === "drum-hit") {
      playDrumInstrument(audioContextRef.current, event.instrument, undefined, {
        mutedInstruments: studioControlsRef.current.drumMutes,
        volumePercent: studioControlsRef.current.drumVolume,
      });
    }
  }

  function stopLoopPlayback({ updateUi = true } = {}) {
    const playback = loopPlaybackRef.current;
    if (!playback.active) {
      return;
    }

    playback.active = false;
    playback.timerIds.forEach((timerId) => window.clearTimeout(timerId));
    playback.timerIds = [];
    playback.loop = null;
    clearLoopClock();
    releaseActiveChord(activeChordRef.current, audioContextRef.current?.currentTime);
    activeChordRef.current = null;
    directInputActiveRef.current = false;

    if (updateUi) {
      setHoveredSegmentId(null);
      setLoopElapsedMs(0);
      setLoopMode("idle");
      setLoopStatus("Loop stopped. Live hand, pointer, and keyboard play are ready.");
    }
  }

  function clearLoopDraft() {
    stopLoopPlayback({ updateUi: false });
    stopLoopRecording({ updateUi: false });
    setLoopDraft(null);
    setHoveredSegmentId(null);
    setRecordedEventCount(0);
    setLoopElapsedMs(0);
    setLoopMode("idle");
    setLoopStatus("Loop cleared. Your locally saved loop is still available to load.");
  }

  function saveLoopDraft() {
    if (!loopDraft || loopSummary.eventCount === 0) {
      setLoopStatus("Record a chord or drum event before saving.");
      return;
    }

    const result = saveJamLoop({
      ...loopDraft,
      name: loopNameRef.current,
    });
    if (!result.ok) {
      setLoopStatus(
        result.status === "unavailable"
          ? "Local saving is unavailable in this browser."
          : "This loop could not be saved locally. You can still export its JSON file.",
      );
      return;
    }

    loopNameRef.current = result.loop.name;
    setLoopName(result.loop.name);
    setLoopDraft(result.loop);
    setSavedLoop(result.loop);
    setLoopStatus(`Saved ${result.loop.name} locally on this device.`);
  }

  function loadLoopDraft() {
    stopLoopPlayback({ updateUi: false });
    stopLoopRecording({ updateUi: false });
    const result = loadSavedJamLoop();
    setHoveredSegmentId(null);
    setLoopElapsedMs(0);
    setLoopMode("idle");
    if (!result.ok || !result.loop) {
      setSavedLoop(null);
      setLoopStatus(
        result.status === "empty"
          ? "There is no locally saved loop yet."
          : "The locally saved loop could not be read.",
      );
      return;
    }

    loopNameRef.current = result.loop.name;
    setLoopName(result.loop.name);
    setLoopDraft(result.loop);
    setSavedLoop(result.loop);
    setSelectedBeatId(result.loop.beatId);
    setDrumBpm(result.loop.bpm);
    setRecordedEventCount(result.loop.events.length);
    setLoopElapsedMs(result.loop.durationMs);
    setLoopMode("idle");
    setLoopStatus(`Loaded ${result.loop.name}. Press Play to hear it on repeat.`);
  }

  function exportLoopDraft() {
    if (!loopDraft || loopSummary.eventCount === 0) {
      setLoopStatus("Record or load a loop before exporting.");
      return;
    }

    const exported = exportJamLoopJson({
      ...loopDraft,
      name: loopNameRef.current,
    });
    if (!exported) {
      setLoopStatus("This loop could not be prepared for export.");
      return;
    }

    const downloaded = downloadTextFile(exported.json, exported.filename, "application/json");
    setLoopStatus(
      downloaded
        ? `Exported ${exported.filename}.`
        : "File downloads are unavailable here. Your loop remains ready to save locally.",
    );
  }

  function triggerLoopDrum(instrument) {
    const audioContext = audioContextRef.current;
    if (
      sessionState !== "active" ||
      !audioContext ||
      audioContext.state !== "running" ||
      !JAM_LOOP_DRUM_INSTRUMENTS.includes(instrument)
    ) {
      setLoopStatus("Enable Camera + Audio before playing the drum pads.");
      openSetupPanel();
      return;
    }

    if (loopPlaybackRef.current.active) {
      stopLoopPlayback();
    }
    const mixScale = getJamDrumMixScale(instrument, drumVolume, drumMutes);
    if (mixScale === 0) {
      setLoopStatus(`${LOOP_DRUM_LABELS[instrument]} is muted. Unmute it to play or record.`);
      return;
    }
    playDrumInstrument(audioContext, instrument, undefined, {
      mutedInstruments: drumMutes,
      volumePercent: drumVolume,
    });
    recordLoopEvent({
      type: "drum-hit",
      instrument,
    });
  }

  function beginDirectChord(segment) {
    const audioContext = audioContextRef.current;
    if (!segment || !audioContext || audioContext.state !== "running") {
      setStatusMessage("Enable the camera and audio before playing a chord.");
      openSetupPanel();
      return;
    }

    const playableSegment = resolveJamKeyLockedSegment(segment, {
      enabled: keyLockEnabled,
      keyId: jamKeyId,
      scaleId: jamScaleId,
    });
    if (!playableSegment) {
      setStatusMessage(
        `${segment.title} is outside the ${jamKeyId} ${jamScaleId} key lock. Choose a lit chord.`,
      );
      return;
    }

    if (loopPlaybackRef.current.active) {
      stopLoopPlayback();
    }
    if (directChordReleaseTimerRef.current) {
      window.clearTimeout(directChordReleaseTimerRef.current);
      directChordReleaseTimerRef.current = 0;
    }
    directInputActiveRef.current = true;
    syncInteractiveChord(playableSegment);
    setHoveredSegmentId(playableSegment.id);
    setLastChordTitle(playableSegment.title);
    setStatusMessage(`Playing ${playableSegment.title} with pointer or keyboard control.`);
  }

  function endDirectChord() {
    if (loopPlaybackRef.current.active) {
      return;
    }
    if (!directInputActiveRef.current) {
      return;
    }

    syncInteractiveChord(null);
    directInputActiveRef.current = false;
    setHoveredSegmentId(null);
    setStatusMessage("Chord released. Point, click, or use the keyboard to play another.");
  }

  function playDirectChordBriefly(segment) {
    beginDirectChord(segment);
    if (!directInputActiveRef.current) {
      return;
    }

    directChordReleaseTimerRef.current = window.setTimeout(() => {
      directChordReleaseTimerRef.current = 0;
      endDirectChord();
    }, 700);
  }

  function releaseChordForSoundChange() {
    if (!activeChordRef.current) {
      return;
    }
    syncInteractiveChord(null);
    directInputActiveRef.current = false;
    setHoveredSegmentId(null);
  }

  function selectProgression(presetId) {
    const preset = getJamProgressionPreset(presetId);
    releaseChordForSoundChange();
    setProgressionPresetId(preset.id);
    setJamScaleId(preset.scaleId);
    setKeyLockEnabled(true);
    setProgressionStep(0);
    setStatusMessage(
      `${preset.label} loaded in ${jamKeyId} ${preset.scaleId}. The highlighted chord is next.`,
    );
  }

  function selectJamScale(scaleId) {
    const nextPreset =
      JAM_PROGRESSION_PRESETS.find((preset) => preset.scaleId === scaleId) ??
      JAM_PROGRESSION_PRESETS[0];
    releaseChordForSoundChange();
    setJamScaleId(scaleId);
    setProgressionPresetId(nextPreset.id);
    setProgressionStep(0);
  }

  function toggleDrumMute(instrument) {
    setDrumMutes((current) => ({
      ...current,
      [instrument]: !current[instrument],
    }));
  }

  function openSetupPanel() {
    setSetupExpanded(true);
    if (viewport.width <= STACKED_LAYOUT_MAX_WIDTH) {
      setMobilePanel("setup");
    }
  }

  function closeSetupPanel() {
    if (sessionState === "active") {
      setSetupExpanded(false);
    }
    setMobilePanel(null);
  }

  function toggleSetupPanel() {
    if (setupExpanded && mobilePanel === "setup") {
      closeSetupPanel();
      return;
    }
    openSetupPanel();
  }

  const setupCollapsed = sessionState === "active" && !setupExpanded;
  const sessionAnnouncement =
    sessionState === "active"
      ? "Camera, hand tracking, and audio are ready."
      : sessionState === "starting"
        ? "Starting camera, hand tracking, and audio."
        : sessionState === "error"
          ? "The camera and audio session could not start."
          : "Camera and audio are off.";

  return (
    <main
      aria-busy={sessionState === "starting"}
      className="circle-fifths-page"
      data-session-state={sessionState}
      data-setup-collapsed={setupCollapsed}
    >
      <video
        aria-hidden="true"
        ref={videoRef}
        className="circle-fifths-video"
        autoPlay
        muted
        playsInline
      />
      <div aria-hidden="true" className="circle-fifths-vignette" />
      <div aria-hidden="true" className="circle-fifths-grid" />
      <p aria-live="polite" className="sr-only" role="status">
        {sessionAnnouncement}
      </p>

      <a className="circle-fifths-back-link" href="/">
        <span aria-hidden="true">←</span> Home
      </a>

      <section
        aria-labelledby={
          setupCollapsed ? "circle-fifths-summary-title" : "circle-fifths-title"
        }
        className="circle-fifths-panel circle-fifths-panel-left"
        data-collapsed={setupCollapsed}
        data-mobile-open={mobilePanel === "setup"}
        id="circle-fifths-setup-panel"
      >
        <div className="circle-fifths-session-summary" hidden={!setupCollapsed}>
          <span aria-hidden="true" className="circle-fifths-ready-dot" />
          <div>
            <p className="circle-fifths-kicker">Session ready</p>
            <h1 id="circle-fifths-summary-title">Jam Studio</h1>
            <p>
              {detectedHand
                ? `${detectedHand} hand in view`
                : "Camera + audio on · show one hand"}
            </p>
          </div>
          <button
            aria-controls="circle-fifths-setup-content"
            aria-expanded="false"
            className="secondary"
            onClick={openSetupPanel}
            type="button"
          >
            Setup
          </button>
        </div>

        <div id="circle-fifths-setup-content" hidden={setupCollapsed}>
          <button
            aria-label="Close setup panel"
            className="circle-fifths-mobile-close"
            onClick={closeSetupPanel}
            type="button"
          >
            ×
          </button>
          <div className="circle-fifths-setup-heading">
            <div>
              <p className="circle-fifths-kicker">Motion Arcade · Create</p>
              <h1 id="circle-fifths-title">Jam Studio</h1>
            </div>
            {sessionState === "active" ? (
              <button
                aria-controls="circle-fifths-setup-content"
                aria-expanded="true"
                className="circle-fifths-setup-collapse secondary"
                onClick={closeSetupPanel}
                type="button"
              >
                Done
              </button>
            ) : null}
          </div>
          <p className="circle-fifths-copy">
            Trace the circle with one hand, or play its major and minor chords with a pointer,
            keyboard, or touch. Record a short idea when one clicks.
          </p>
          <div className="circle-fifths-actions">
            <button
              aria-busy={sessionState === "starting"}
              type="button"
              onClick={() => void handleStartSession()}
              disabled={sessionState === "starting"}
            >
              {sessionState === "active"
                ? "Restart Camera + Audio"
                : sessionState === "starting"
                  ? "Starting..."
                  : "Enable Camera + Audio"}
            </button>
          </div>
          <details className="circle-fifths-session-diagnostics">
            <summary>Tracking details</summary>
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
          </details>
          {errorMessage ? (
            <p className="circle-fifths-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="circle-fifths-hover-title"
        className="circle-fifths-panel circle-fifths-panel-right"
      >
        <p className="circle-fifths-panel-label" id="circle-fifths-hover-title">
          Current chord
        </p>
        <p className="circle-fifths-current-chord">
          {hoveredSegment ? hoveredSegment.title : "Move into the wheel"}
        </p>
        <p className="circle-fifths-copy compact">
          Outer ring is major. Inner ring is minor. The center stays silent so you can reset your
          hand without retriggering a chord.
        </p>
      </section>

      <section
        aria-labelledby="circle-fifths-drums-title"
        className="circle-fifths-panel circle-fifths-panel-bottom-right circle-fifths-performance-tray"
        data-mobile-open={mobilePanel === "drums"}
        id="circle-fifths-drums-panel"
      >
        <button
          aria-label="Close drum machine panel"
          className="circle-fifths-mobile-close"
          onClick={() => setMobilePanel(null)}
          type="button"
        >
          ×
        </button>
        <p className="circle-fifths-panel-label" id="circle-fifths-drums-title">
          Jam controls
        </p>
        <section
          aria-labelledby="circle-fifths-sound-title"
          className="circle-fifths-sound-controls"
        >
          <div className="circle-fifths-section-heading">
            <div>
              <h2 id="circle-fifths-sound-title">Chord palette</h2>
              <p>Shape the wheel, then stay in key with an optional chord guide.</p>
            </div>
            <button
              aria-pressed={keyLockEnabled}
              className={keyLockEnabled ? "selected" : "secondary"}
              onClick={() => {
                releaseChordForSoundChange();
                setKeyLockEnabled((enabled) => !enabled);
              }}
              type="button"
            >
              Key lock {keyLockEnabled ? "on" : "off"}
            </button>
          </div>
          <div className="circle-fifths-select-grid">
            <label>
              <span>Timbre</span>
              <select
                onChange={(event) => {
                  releaseChordForSoundChange();
                  setChordTimbreId(event.target.value);
                }}
                value={chordTimbreId}
              >
                {JAM_CHORD_TIMBRES.map((timbre) => (
                  <option key={timbre.id} value={timbre.id}>
                    {timbre.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Arpeggio</span>
              <select
                onChange={(event) => {
                  releaseChordForSoundChange();
                  setArpeggioMode(event.target.value);
                }}
                value={arpeggioMode}
              >
                {JAM_ARPEGGIO_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Key</span>
              <select
                onChange={(event) => {
                  releaseChordForSoundChange();
                  setJamKeyId(event.target.value);
                  setProgressionStep(0);
                }}
                value={jamKeyId}
              >
                {JAM_KEY_OPTIONS.map((keyOption) => (
                  <option key={keyOption.id} value={keyOption.id}>
                    {keyOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Scale</span>
              <select
                onChange={(event) => selectJamScale(event.target.value)}
                value={jamScaleId}
              >
                {JAM_SCALE_OPTIONS.map((scale) => (
                  <option key={scale.id} value={scale.id}>
                    {scale.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="circle-fifths-control-hint">
            {getJamChordTimbre(chordTimbreId).description}{" "}
            {getJamArpeggioMode(arpeggioMode).description}
          </p>
          <div
            aria-label="Chord progression presets"
            className="circle-fifths-preset-tabs"
            role="group"
          >
            {JAM_PROGRESSION_PRESETS.map((preset) => (
              <button
                aria-pressed={progressionPresetId === preset.id}
                className={progressionPresetId === preset.id ? "selected" : "secondary"}
                key={preset.id}
                onClick={() => selectProgression(preset.id)}
                type="button"
              >
                <span>{preset.label}</span>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
          <div className="circle-fifths-progression-heading">
            <span>
              {jamKeyId} {selectedProgression.description}
            </span>
            <span aria-live="polite">
              Next: {progression[progressionStep]?.segment.label ?? "Choose a chord"}
            </span>
          </div>
          <ol aria-label={`${selectedProgression.label} chord guide`}>
            {progression.map((entry, index) => {
              const isNext = index === progressionStep;
              return (
                <li key={`${entry.roman}-${entry.segment.id}`}>
                  <button
                    aria-current={isNext ? "step" : undefined}
                    className={isNext ? "next" : ""}
                    disabled={sessionState !== "active"}
                    onClick={() => playDirectChordBriefly(entry.segment)}
                    type="button"
                  >
                    <span>{entry.segment.label}</span>
                    <small>{entry.roman}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="circle-fifths-drum-heading">
          <div>
            <p className="circle-fifths-panel-label">Drum machine</p>
            <p className="circle-fifths-current-chord">{selectedBeat.label}</p>
          </div>
          <button
            aria-pressed={drumsPlaying}
            disabled={sessionState !== "active"}
            onClick={() => setDrumsPlaying((playing) => !playing)}
            type="button"
          >
            {drumsPlaying ? "Pause groove" : "Start groove"}
          </button>
        </div>
        <p className="circle-fifths-copy compact">
          Pinch or press a beat to switch the backing groove. Pinch and slide the BPM rail, or use
          its keyboard controls, to change tempo.
        </p>
        <div className="circle-fifths-beat-buttons">
          {DRUM_BEAT_PRESETS.map((beat) => {
            const isActive = beat.id === selectedBeatId;
            const isHovered = beat.id === hoveredBeatId;
            return (
              <button
                aria-label={`${beat.label}: ${beat.description}`}
                aria-pressed={isActive}
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
        <div className="circle-fifths-drum-mix">
          <div aria-label="Drum mutes" className="circle-fifths-mute-buttons" role="group">
            {JAM_LOOP_DRUM_INSTRUMENTS.map((instrument) => (
              <button
                aria-pressed={drumMutes[instrument]}
                className={drumMutes[instrument] ? "muted" : "secondary"}
                key={instrument}
                onClick={() => toggleDrumMute(instrument)}
                type="button"
              >
                {LOOP_DRUM_LABELS[instrument]} {drumMutes[instrument] ? "muted" : "on"}
              </button>
            ))}
          </div>
          <label className="circle-fifths-volume-control">
            <span>
              <strong>Drum mix</strong>
              <output>{drumVolume}%</output>
            </span>
            <input
              aria-label={`Drum mix volume, ${drumVolume} percent`}
              max="100"
              min="0"
              onChange={(event) => setDrumVolume(Number(event.target.value))}
              step="5"
              type="range"
              value={drumVolume}
            />
          </label>
        </div>
        <div className="circle-fifths-bpm-block">
          <div className="circle-fifths-bpm-meta">
            <strong>BPM</strong>
            <span>{drumBpm}</span>
          </div>
          <input
            aria-label={`Drum tempo, ${drumBpm} beats per minute`}
            aria-valuetext={`${drumBpm} beats per minute`}
            ref={bpmSliderTrackRef}
            className={`circle-fifths-bpm-slider ${bpmSliderHovered ? "hovered" : ""}`}
            max={DRUM_BPM_MAX}
            min={DRUM_BPM_MIN}
            onChange={(event) => setDrumBpm(Number(event.target.value))}
            style={{ "--bpm-progress": `${sliderRatio * 100}%` }}
            type="range"
            value={drumBpm}
          />
        </div>
        <section
          aria-labelledby="circle-fifths-loop-title"
          className="circle-fifths-loop-studio"
        >
          <div className="circle-fifths-loop-heading">
            <div>
              <p className="circle-fifths-panel-label" id="circle-fifths-loop-title">
                Loop recorder
              </p>
              <p className="circle-fifths-loop-state" data-mode={loopMode}>
                {loopMode === "recording"
                  ? "Recording"
                  : loopMode === "playing"
                    ? "Playing"
                    : loopDraft
                      ? "Take ready"
                      : "Ready"}
              </p>
            </div>
            <span className="circle-fifths-loop-time">
              {(loopElapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <label className="circle-fifths-loop-name">
            <span>Loop name</span>
            <input
              maxLength={LOOP_NAME_MAX_LENGTH}
              onChange={(event) => {
                loopNameRef.current = event.target.value;
                setLoopName(event.target.value);
              }}
              placeholder="Untitled loop"
              type="text"
              value={loopName}
            />
          </label>
          <p className="circle-fifths-copy compact">
            Record up to 32 seconds of chord changes and live drum hits. Playback repeats the
            timing exactly over the saved groove and tempo.
          </p>
          <div aria-label="Live drum pads" className="circle-fifths-loop-pads" role="group">
            {JAM_LOOP_DRUM_INSTRUMENTS.map((instrument, index) => (
              <button
                aria-keyshortcuts={`${index + 1}`}
                disabled={sessionState !== "active" || drumMutes[instrument]}
                key={instrument}
                onClick={() => triggerLoopDrum(instrument)}
                type="button"
              >
                <span>{LOOP_DRUM_LABELS[instrument]}</span>
                <small>{drumMutes[instrument] ? "Muted" : `Key ${index + 1}`}</small>
              </button>
            ))}
          </div>
          <div aria-label="Loop transport" className="circle-fifths-loop-transport" role="group">
            <button
              disabled={sessionState !== "active" || loopMode !== "idle"}
              onClick={startLoopRecording}
              type="button"
            >
              <span aria-hidden="true">●</span> Record
            </button>
            <button
              className="secondary"
              disabled={loopMode === "idle"}
              onClick={() => {
                if (loopMode === "recording") {
                  stopLoopRecording();
                } else {
                  stopLoopPlayback();
                }
              }}
              type="button"
            >
              Stop
            </button>
            <button
              disabled={
                sessionState !== "active" ||
                loopMode !== "idle" ||
                loopSummary.eventCount === 0
              }
              onClick={startLoopPlayback}
              type="button"
            >
              Play loop
            </button>
            <button
              className="secondary"
              disabled={!loopDraft && recordedEventCount === 0}
              onClick={clearLoopDraft}
              type="button"
            >
              Clear
            </button>
          </div>
          <div
            aria-label={
              loopDraft
                ? `${loopSummary.chordCount} chord changes and ${loopSummary.drumHitCount} drum hits across ${loopSummary.durationLabel}`
                : "No recorded events yet"
            }
            className="circle-fifths-loop-timeline"
            role="img"
          >
            <span aria-hidden="true" className="circle-fifths-loop-timeline-line" />
            {loopDraft?.events.map((event, index) => (
              <span
                aria-hidden="true"
                className={`circle-fifths-loop-event ${event.type}`}
                key={`${event.type}-${event.atMs}-${index}`}
                style={{
                  left: `${Math.min(100, (event.atMs / loopDraft.durationMs) * 100)}%`,
                }}
              />
            ))}
          </div>
          <div className="circle-fifths-loop-summary">
            <span>
              {loopMode === "recording" ? recordedEventCount : loopSummary.eventCount} events
            </span>
            <span>
              {loopDraft
                ? `${loopSummary.chordCount} chords · ${loopSummary.drumHitCount} drums`
                : "Play something to fill the timeline"}
            </span>
          </div>
          <div aria-label="Loop file actions" className="circle-fifths-loop-files" role="group">
            <button
              disabled={loopSummary.eventCount === 0 || loopMode !== "idle"}
              onClick={saveLoopDraft}
              type="button"
            >
              Save local
            </button>
            <button
              className="secondary"
              disabled={!savedLoop || loopMode === "recording"}
              onClick={loadLoopDraft}
              type="button"
            >
              Load saved
            </button>
            <button
              className="secondary"
              disabled={loopSummary.eventCount === 0 || loopMode === "recording"}
              onClick={exportLoopDraft}
              type="button"
            >
              Export JSON
            </button>
          </div>
          <p aria-live="polite" className="circle-fifths-loop-status" role="status">
            {loopStatus}
          </p>
          <p className="circle-fifths-loop-privacy">
            Local save stores symbolic note timing only—never camera frames or recorded audio.
          </p>
        </section>
      </section>

      <nav aria-label="Circle controls" className="circle-fifths-mobile-toolbar">
        <button
          aria-controls="circle-fifths-setup-panel"
          aria-expanded={mobilePanel === "setup" && setupExpanded}
          className={mobilePanel === "setup" && setupExpanded ? "active" : ""}
          onClick={toggleSetupPanel}
          type="button"
        >
          Setup
        </button>
        <button
          aria-controls="circle-fifths-drums-panel"
          aria-expanded={mobilePanel === "drums"}
          className={mobilePanel === "drums" ? "active" : ""}
          onClick={() => setMobilePanel(mobilePanel === "drums" ? null : "drums")}
          type="button"
        >
          Jam
        </button>
      </nav>

      <svg
        className="circle-fifths-wheel"
        ref={wheelRef}
        viewBox={`0 0 ${WHEEL_VIEWBOX_SIZE} ${WHEEL_VIEWBOX_SIZE}`}
        aria-describedby="circle-fifths-wheel-description"
        aria-label="Interactive circle of fifths chord wheel"
        role="group"
      >
        <desc id="circle-fifths-wheel-description">
          Outer segments play major chords and inner segments play minor chords. After enabling
          audio, use a pointer or focus a segment and hold Enter or Space to play.
        </desc>
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
          const isKeyAllowed = !keyLockEnabled || allowedSegmentIds.has(segment.id);

          return (
            <g
              aria-disabled={sessionState !== "active" || !isKeyAllowed}
              aria-label={`Play ${segment.title} chord${
                isKeyAllowed ? "" : `, outside ${jamKeyId} ${jamScaleId}`
              }`}
              aria-pressed={isHovered}
              className={`circle-fifths-segment-control ${
                isKeyAllowed ? "" : "key-locked"
              }`}
              key={segment.id}
              onBlur={endDirectChord}
              onClick={(event) => {
                if (event.detail === 0) {
                  playDirectChordBriefly(segment);
                }
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
                  event.preventDefault();
                  beginDirectChord(segment);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  endDirectChord();
                }
              }}
              onPointerCancel={endDirectChord}
              onPointerDown={(event) => {
                event.preventDefault();
                if (!isKeyAllowed) {
                  setStatusMessage(
                    `${segment.title} is outside the ${jamKeyId} ${jamScaleId} key lock. Choose a lit chord.`,
                  );
                  return;
                }
                event.currentTarget.setPointerCapture?.(event.pointerId);
                beginDirectChord(segment);
              }}
              onPointerUp={endDirectChord}
              role="button"
              tabIndex={sessionState === "active" && isKeyAllowed ? 0 : -1}
            >
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

function waitForVideoMetadata(videoElement, signal) {
  if (signal?.aborted) {
    return Promise.reject(new Error("Camera startup was cancelled."));
  }

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
    const handleAbort = () => {
      cleanup();
      reject(new Error("Camera startup was cancelled."));
    };
    const cleanup = () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    videoElement.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

async function closeAudioContextRef(audioContextRef) {
  const audioContext = audioContextRef.current;
  audioContextRef.current = null;
  await closeAudioContext(audioContext, (error, resourceType) => {
    pageLog.warn("Circle session resource cleanup failed", {
      error,
      resourceType,
    });
  });
}

function getPinchState(pinchDistance, wasPinching, pinchThreshold) {
  if (!Number.isFinite(pinchDistance)) {
    return false;
  }

  const thresholds = getPinchThresholds(pinchThreshold);
  if (wasPinching) {
    return pinchDistance <= thresholds.end;
  }

  return pinchDistance <= thresholds.start;
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

function getWheelPointFromClientPoint(point, wheelElement, layout) {
  const rect = getElementRect(wheelElement);
  if (
    !point ||
    !rect ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return null;
  }

  const normalizedX = (point.x - rect.left) / rect.width;
  const normalizedY = (point.y - rect.top) / rect.height;
  if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
    return null;
  }

  return {
    x: normalizedX * layout.width,
    y: normalizedY * layout.height,
  };
}

function getClockTime() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function isTextEntryElement(element) {
  const tagName = element?.tagName?.toLowerCase?.();
  return tagName === "input" || tagName === "textarea" || Boolean(element?.isContentEditable);
}

function downloadTextFile(content, filename, type) {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }

  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

function syncContinuousChord(audioContext, activeChordRef, segment, soundOptions = {}) {
  if (!audioContext) {
    return;
  }

  const activeChord = activeChordRef.current;
  const soundSignature = createJamSoundSignature(soundOptions);
  if (!segment) {
    releaseActiveChord(activeChord, audioContext.currentTime);
    activeChordRef.current = null;
    return;
  }

  if (activeChord?.segmentId === segment.id && activeChord.soundSignature === soundSignature) {
    return;
  }

  releaseActiveChord(activeChord, audioContext.currentTime);
  activeChordRef.current = startContinuousChord(audioContext, segment, soundOptions);
}

function startContinuousChord(audioContext, segment, soundOptions = {}) {
  if (!audioContext || !segment) {
    return null;
  }

  const frequencies = getChordFrequencies(segment);
  if (frequencies.length === 0) {
    return null;
  }

  const now = audioContext.currentTime;
  const timbre = getJamChordTimbre(soundOptions.timbreId);
  const arpeggio = getJamArpeggioMode(soundOptions.arpeggioMode);
  const soundSignature = createJamSoundSignature(soundOptions);
  const masterGain = audioContext.createGain();
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.setValueAtTime(timbre.filterFrequency, now);
  lowPass.Q.setValueAtTime(timbre.filterQ, now);

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(
    timbre.masterGain,
    now + timbre.attackSeconds,
  );

  masterGain.connect(lowPass);
  lowPass.connect(audioContext.destination);

  const createSustainedVoice = (frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const voiceGain = audioContext.createGain();
    oscillator.type = timbre.oscillatorTypes[index % timbre.oscillatorTypes.length];
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
  };

  const voices = arpeggio.id === "off" ? frequencies.map(createSustainedVoice) : [];
  let arpeggioIntervalId = 0;
  if (arpeggio.id !== "off") {
    const stepDurationMs = getJamArpeggioStepDurationMs(soundOptions.bpm, arpeggio.id);
    let step = 0;
    const playArpeggioStep = () => {
      const noteIndex = getJamArpeggioNoteIndex(step, frequencies.length, arpeggio.id);
      const frequency = frequencies[noteIndex];
      const startAt = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      const gateSeconds = Math.max(0.06, (stepDurationMs / 1000) * 0.72);
      oscillator.type = timbre.oscillatorTypes[noteIndex % timbre.oscillatorTypes.length];
      oscillator.frequency.setValueAtTime(frequency, startAt);
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(0.82, startAt + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + gateSeconds);
      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(startAt + gateSeconds + 0.02);
      cleanupOneShotVoice(oscillator, noteGain);
      step += 1;
    };
    playArpeggioStep();
    arpeggioIntervalId = window.setInterval(playArpeggioStep, stepDurationMs);
  }

  return {
    segmentId: segment.id,
    soundSignature,
    releaseSeconds: timbre.releaseSeconds,
    masterGain,
    lowPass,
    voices,
    arpeggioIntervalId,
  };
}

function releaseActiveChord(activeChord, releaseAt = 0) {
  if (!activeChord) {
    return;
  }

  const now = Number.isFinite(releaseAt) ? releaseAt : 0;
  const safeReleaseAt = Math.max(now, 0);
  const releaseSeconds = Math.max(0.04, activeChord.releaseSeconds ?? 0.12);

  if (activeChord.arpeggioIntervalId) {
    window.clearInterval(activeChord.arpeggioIntervalId);
    activeChord.arpeggioIntervalId = 0;
  }

  try {
    activeChord.masterGain.gain.cancelScheduledValues(safeReleaseAt);
    activeChord.masterGain.gain.setValueAtTime(
      Math.max(activeChord.masterGain.gain.value, 0.0001),
      safeReleaseAt,
    );
    activeChord.masterGain.gain.exponentialRampToValueAtTime(
      0.0001,
      safeReleaseAt + releaseSeconds,
    );
  } catch (error) {
    pageLog.warn("Failed to schedule chord release cleanly", { error });
  }

  activeChord.voices?.forEach(({ oscillator, voiceGain }) => {
    try {
      oscillator.stop(safeReleaseAt + releaseSeconds + 0.04);
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
  }, Math.ceil((releaseSeconds + 0.2) * 1000));
}

function persistAutostartIntent() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      AUTOSTART_SESSION_KEY,
      JSON.stringify({
        issuedAt: Date.now(),
      }),
    );
  } catch (error) {
    pageLog.warn("Could not save Jam Studio restart intent", { error });
  }
}

function consumeAutostartIntent() {
  if (typeof window === "undefined") {
    return false;
  }

  let rawIntent;
  try {
    rawIntent = window.sessionStorage.getItem(AUTOSTART_SESSION_KEY);
    window.sessionStorage.removeItem(AUTOSTART_SESSION_KEY);
  } catch (error) {
    pageLog.warn("Could not read Jam Studio restart intent", { error });
    return false;
  }
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
  getDrumMixOptions,
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
      scheduleDrumStep(audioContext, beat, stepIndex, nextNoteTime, getDrumMixOptions());
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

function scheduleDrumStep(audioContext, beat, stepIndex, time, mixOptions) {
  if (beat.steps.kick[stepIndex]) {
    playDrumInstrument(audioContext, "kick", time, mixOptions);
  }
  if (beat.steps.snare[stepIndex]) {
    playDrumInstrument(audioContext, "snare", time, mixOptions);
  }
  if (beat.steps.hat[stepIndex]) {
    playDrumInstrument(audioContext, "hat", time, mixOptions);
  }
}

function playDrumInstrument(
  audioContext,
  instrument,
  time = audioContext?.currentTime,
  { mutedInstruments = {}, volumePercent = 72 } = {},
) {
  if (!audioContext || !Number.isFinite(time)) {
    return;
  }

  const mixScale = getJamDrumMixScale(instrument, volumePercent, mutedInstruments);
  if (mixScale <= 0) {
    return;
  }

  if (instrument === "kick") {
    playKick(audioContext, time, mixScale);
  } else if (instrument === "snare") {
    playSnare(audioContext, time, mixScale);
  } else if (instrument === "hat") {
    playHat(audioContext, time, mixScale);
  }
}

function playKick(audioContext, time, mixScale) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(150, time);
  oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.14);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.75 * mixScale, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.2);
  cleanupOneShotVoice(oscillator, gain);
}

function playSnare(audioContext, time, mixScale) {
  const noise = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  const oscillator = audioContext.createOscillator();
  const toneGain = audioContext.createGain();

  noise.buffer = createNoiseBuffer(audioContext);
  noiseFilter.type = "highpass";
  noiseFilter.frequency.setValueAtTime(1200, time);
  noiseGain.gain.setValueAtTime(0.0001, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.38 * mixScale, time + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(180, time);
  toneGain.gain.setValueAtTime(0.0001, time);
  toneGain.gain.exponentialRampToValueAtTime(0.22 * mixScale, time + 0.01);
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

function playHat(audioContext, time, mixScale) {
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
  gain.gain.exponentialRampToValueAtTime(0.14 * mixScale, time + 0.003);
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
