const AUDIO_CUES = Object.freeze({
  select: Object.freeze([
    { frequency: 520, durationMs: 55, gain: 0.08, type: "sine" },
  ]),
  start: Object.freeze([
    { frequency: 330, frequencyEnd: 440, durationMs: 110, gain: 0.12, type: "sine" },
    { frequency: 440, frequencyEnd: 660, delayMs: 90, durationMs: 150, gain: 0.1, type: "sine" },
  ]),
  pause: Object.freeze([
    { frequency: 360, frequencyEnd: 250, durationMs: 150, gain: 0.1, type: "triangle" },
  ]),
  resume: Object.freeze([
    { frequency: 280, frequencyEnd: 440, durationMs: 150, gain: 0.1, type: "triangle" },
  ]),
  success: Object.freeze([
    { frequency: 523.25, durationMs: 180, gain: 0.11, type: "sine" },
    { frequency: 659.25, delayMs: 110, durationMs: 220, gain: 0.1, type: "sine" },
    { frequency: 783.99, delayMs: 220, durationMs: 260, gain: 0.09, type: "sine" },
  ]),
  error: Object.freeze([
    { frequency: 220, frequencyEnd: 150, durationMs: 210, gain: 0.1, type: "triangle" },
  ]),
  pickup: Object.freeze([
    { frequency: 660, frequencyEnd: 880, durationMs: 90, gain: 0.09, type: "sine" },
  ]),
  "music-preview": Object.freeze([
    { bus: "music", frequency: 261.63, durationMs: 620, gain: 0.055, type: "sine" },
    { bus: "music", frequency: 329.63, delayMs: 80, durationMs: 560, gain: 0.045, type: "sine" },
    { bus: "music", frequency: 392, delayMs: 160, durationMs: 500, gain: 0.04, type: "sine" },
  ]),
});

const DEFAULT_CONFIGURATION = Object.freeze({
  muted: false,
  masterVolume: 0.8,
  musicVolume: 0.65,
  effectsVolume: 0.8,
  lowSensory: false,
});

function clampUnit(value, fallback) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function normalizeConfiguration(value = {}) {
  return {
    muted: Boolean(value.muted),
    masterVolume: clampUnit(value.masterVolume, DEFAULT_CONFIGURATION.masterVolume),
    musicVolume: clampUnit(value.musicVolume, DEFAULT_CONFIGURATION.musicVolume),
    effectsVolume: clampUnit(value.effectsVolume, DEFAULT_CONFIGURATION.effectsVolume),
    lowSensory: Boolean(value.lowSensory),
  };
}

export function getAudioCuePlan(cue, { lowSensory = false } = {}) {
  const plan = AUDIO_CUES[cue];
  if (!plan) {
    return [];
  }

  const tones = lowSensory && plan.length > 1 ? [plan[0]] : plan;
  return tones.map((tone) => ({
    bus: tone.bus ?? "effects",
    delayMs: tone.delayMs ?? 0,
    durationMs: Math.round(tone.durationMs * (lowSensory ? 0.82 : 1)),
    frequency: tone.frequency,
    frequencyEnd: tone.frequencyEnd ?? tone.frequency,
    gain: tone.gain * (lowSensory ? 0.52 : 1),
    type: lowSensory ? "sine" : tone.type,
  }));
}

function setAudioParam(param, value, time) {
  if (typeof param?.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
  } else if (param) {
    param.value = value;
  }
}

/**
 * A tiny preference-aware Web Audio layer. It creates no AudioContext until
 * unlock() is called from a user interaction, keeping autoplay and privacy
 * behavior predictable.
 */
export function createAudioFeedback({
  audioContextFactory = () => {
    const AudioContextClass =
      globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return AudioContextClass ? new AudioContextClass() : null;
  },
} = {}) {
  let configuration = normalizeConfiguration();
  let context = null;
  let masterBus = null;
  let effectsBus = null;
  let musicBus = null;
  let disposed = false;

  function applyConfiguration() {
    if (!context) {
      return;
    }
    const now = context.currentTime ?? 0;
    setAudioParam(
      masterBus?.gain,
      configuration.muted ? 0 : configuration.masterVolume,
      now,
    );
    setAudioParam(effectsBus?.gain, configuration.effectsVolume, now);
    setAudioParam(musicBus?.gain, configuration.musicVolume, now);
  }

  function unlock() {
    if (disposed) {
      return false;
    }
    if (!context) {
      try {
        context = audioContextFactory?.() ?? null;
        if (!context) {
          return false;
        }
        masterBus = context.createGain();
        effectsBus = context.createGain();
        musicBus = context.createGain();
        effectsBus.connect(masterBus);
        musicBus.connect(masterBus);
        masterBus.connect(context.destination);
        applyConfiguration();
      } catch {
        context = null;
        masterBus = null;
        effectsBus = null;
        musicBus = null;
        return false;
      }
    }
    if (context.state === "suspended") {
      try {
        const resume = context.resume?.();
        resume?.catch?.(() => {});
      } catch {
        return false;
      }
    }
    return true;
  }

  function configure(nextConfiguration) {
    configuration = normalizeConfiguration(nextConfiguration);
    applyConfiguration();
    return { ...configuration };
  }

  function play(cue) {
    if (
      disposed ||
      !context ||
      context.state === "closed" ||
      configuration.muted ||
      configuration.masterVolume <= 0
    ) {
      return false;
    }

    const tones = getAudioCuePlan(cue, configuration).filter((tone) =>
      tone.bus === "music"
        ? configuration.musicVolume > 0
        : configuration.effectsVolume > 0,
    );
    if (tones.length === 0) {
      return false;
    }

    const now = context.currentTime ?? 0;
    for (const tone of tones) {
      try {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const startAt = now + tone.delayMs / 1000;
        const stopAt = startAt + tone.durationMs / 1000;
        const attackAt = Math.min(stopAt, startAt + 0.018);
        oscillator.type = tone.type;
        setAudioParam(oscillator.frequency, tone.frequency, startAt);
        if (
          tone.frequencyEnd !== tone.frequency &&
          typeof oscillator.frequency?.exponentialRampToValueAtTime ===
            "function"
        ) {
          oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(1, tone.frequencyEnd),
            stopAt,
          );
        }
        setAudioParam(envelope.gain, 0.0001, startAt);
        envelope.gain?.linearRampToValueAtTime?.(tone.gain, attackAt);
        envelope.gain?.exponentialRampToValueAtTime?.(0.0001, stopAt);
        oscillator.connect(envelope);
        envelope.connect(tone.bus === "music" ? musicBus : effectsBus);
        oscillator.onended = () => {
          oscillator.disconnect?.();
          envelope.disconnect?.();
        };
        oscillator.start(startAt);
        oscillator.stop(stopAt + 0.01);
      } catch {
        // Audio feedback is enhancement-only; one unsupported node must not
        // interrupt the game loop or its input handlers.
      }
    }
    return true;
  }

  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    try {
      const closing = context?.close?.();
      closing?.catch?.(() => {});
    } catch {
      // Ignore platform shutdown errors.
    }
    context = null;
    masterBus = null;
    effectsBus = null;
    musicBus = null;
  }

  return Object.freeze({
    configure,
    dispose,
    play,
    unlock,
    getState: () => ({
      configuration: { ...configuration },
      disposed,
      unlocked: Boolean(context),
    }),
  });
}

