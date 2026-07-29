import { CIRCLE_OF_FIFTHS_SEGMENTS } from "./circleOfFifths.js";

const NOTE_TO_PITCH_CLASS = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const SCALE_QUALITIES = {
  major: ["major", "minor", "minor", "major", "major", "minor", "diminished"],
  minor: ["minor", "diminished", "major", "minor", "minor", "major", "major"],
};

export const JAM_KEY_OPTIONS = [
  { id: "C", label: "C" },
  { id: "G", label: "G" },
  { id: "D", label: "D" },
  { id: "A", label: "A" },
  { id: "E", label: "E" },
  { id: "B", label: "B" },
  { id: "F#", label: "F♯" },
  { id: "Db", label: "D♭" },
  { id: "Ab", label: "A♭" },
  { id: "Eb", label: "E♭" },
  { id: "Bb", label: "B♭" },
  { id: "F", label: "F" },
];

export const JAM_SCALE_OPTIONS = [
  { id: "major", label: "Major" },
  { id: "minor", label: "Natural minor" },
];

export const JAM_CHORD_TIMBRES = [
  {
    id: "warm-pad",
    label: "Warm pad",
    description: "Soft attack with a rounded, blended tone.",
    oscillatorTypes: ["sine", "triangle", "sawtooth", "sine"],
    filterFrequency: 1800,
    filterQ: 0.9,
    attackSeconds: 0.08,
    releaseSeconds: 0.16,
    masterGain: 0.18,
  },
  {
    id: "glass-keys",
    label: "Glass keys",
    description: "Fast, bright notes with a lighter low end.",
    oscillatorTypes: ["triangle", "sine", "triangle", "sine"],
    filterFrequency: 4600,
    filterQ: 1.4,
    attackSeconds: 0.015,
    releaseSeconds: 0.1,
    masterGain: 0.145,
  },
  {
    id: "pulse-organ",
    label: "Pulse organ",
    description: "Compact pulse waves with an immediate response.",
    oscillatorTypes: ["square", "triangle", "square", "triangle"],
    filterFrequency: 2600,
    filterQ: 0.65,
    attackSeconds: 0.025,
    releaseSeconds: 0.09,
    masterGain: 0.12,
  },
];

export const JAM_ARPEGGIO_OPTIONS = [
  { id: "off", label: "Off", description: "Play every chord tone together." },
  { id: "up", label: "Up · 1/8", description: "Climb through the chord in eighth notes." },
  {
    id: "bounce",
    label: "Bounce · 1/8",
    description: "Climb and descend through the chord in eighth notes.",
  },
];

export const JAM_PROGRESSION_PRESETS = [
  {
    id: "pop-lift",
    label: "Pop lift",
    description: "I · V · vi · IV",
    scaleId: "major",
    degrees: [0, 4, 5, 3],
    roman: ["I", "V", "vi", "IV"],
  },
  {
    id: "open-road",
    label: "Open road",
    description: "I · iii · vi · IV",
    scaleId: "major",
    degrees: [0, 2, 5, 3],
    roman: ["I", "iii", "vi", "IV"],
  },
  {
    id: "afterglow",
    label: "Afterglow",
    description: "i · VI · III · VII",
    scaleId: "minor",
    degrees: [0, 5, 2, 6],
    roman: ["i", "VI", "III", "VII"],
  },
];

export function getJamChordTimbre(timbreId) {
  return (
    JAM_CHORD_TIMBRES.find((candidate) => candidate.id === timbreId) ??
    JAM_CHORD_TIMBRES[0]
  );
}

export function getJamArpeggioMode(modeId) {
  return (
    JAM_ARPEGGIO_OPTIONS.find((candidate) => candidate.id === modeId) ??
    JAM_ARPEGGIO_OPTIONS[0]
  );
}

export function getJamProgressionPreset(presetId) {
  return (
    JAM_PROGRESSION_PRESETS.find((candidate) => candidate.id === presetId) ??
    JAM_PROGRESSION_PRESETS[0]
  );
}

export function getJamScaleSegments(keyId = "C", scaleId = "major") {
  const rootPitchClass = NOTE_TO_PITCH_CLASS[keyId] ?? NOTE_TO_PITCH_CLASS.C;
  const intervals = SCALE_INTERVALS[scaleId] ?? SCALE_INTERVALS.major;
  const qualities = SCALE_QUALITIES[scaleId] ?? SCALE_QUALITIES.major;

  return intervals
    .map((interval, index) => {
      const quality = qualities[index];
      if (quality === "diminished") {
        return null;
      }
      const pitchClass = (rootPitchClass + interval) % 12;
      return (
        CIRCLE_OF_FIFTHS_SEGMENTS.find(
          (segment) =>
            segment.quality === quality && NOTE_TO_PITCH_CLASS[segment.note] === pitchClass,
        ) ?? null
      );
    })
    .filter(Boolean);
}

export function getJamAllowedSegmentIds(keyId = "C", scaleId = "major") {
  return getJamScaleSegments(keyId, scaleId).map((segment) => segment.id);
}

export function resolveJamKeyLockedSegment(
  segment,
  { enabled = false, keyId = "C", scaleId = "major" } = {},
) {
  if (!segment || !enabled) {
    return segment ?? null;
  }

  const allowedIds = new Set(getJamAllowedSegmentIds(keyId, scaleId));
  return allowedIds.has(segment.id) ? segment : null;
}

export function getJamProgression(presetId = "pop-lift", keyId = "C") {
  const preset = getJamProgressionPreset(presetId);
  const rootPitchClass = NOTE_TO_PITCH_CLASS[keyId] ?? NOTE_TO_PITCH_CLASS.C;
  const intervals = SCALE_INTERVALS[preset.scaleId];
  const qualities = SCALE_QUALITIES[preset.scaleId];

  return preset.degrees
    .map((degree, index) => {
      const pitchClass = (rootPitchClass + intervals[degree]) % 12;
      const quality = qualities[degree];
      const segment =
        CIRCLE_OF_FIFTHS_SEGMENTS.find(
          (candidate) =>
            candidate.quality === quality &&
            NOTE_TO_PITCH_CLASS[candidate.note] === pitchClass,
        ) ?? null;
      return segment
        ? {
            index,
            roman: preset.roman[index],
            segment,
          }
        : null;
    })
    .filter(Boolean);
}

export function getJamArpeggioStepDurationMs(bpm, modeId = "off") {
  if (getJamArpeggioMode(modeId).id === "off") {
    return 0;
  }
  const safeBpm = Math.min(240, Math.max(40, Number.isFinite(bpm) ? bpm : 120));
  return 60000 / safeBpm / 2;
}

export function getJamArpeggioNoteIndex(step, noteCount, modeId = "up") {
  const safeCount = Math.max(0, Math.floor(noteCount));
  if (safeCount === 0) {
    return -1;
  }
  const safeStep = Math.max(0, Math.floor(Number.isFinite(step) ? step : 0));
  if (modeId !== "bounce" || safeCount < 3) {
    return safeStep % safeCount;
  }

  const cycleLength = safeCount * 2 - 2;
  const cycleStep = safeStep % cycleLength;
  return cycleStep < safeCount ? cycleStep : cycleLength - cycleStep;
}

export function getJamDrumMixScale(
  instrument,
  volumePercent = 72,
  mutedInstruments = {},
) {
  if (!["kick", "snare", "hat"].includes(instrument) || mutedInstruments[instrument]) {
    return 0;
  }
  const safeVolume = Number.isFinite(volumePercent)
    ? Math.min(100, Math.max(0, volumePercent))
    : 72;
  return safeVolume / 100;
}

export function createJamSoundSignature({
  timbreId = "warm-pad",
  arpeggioMode = "off",
  bpm = 112,
} = {}) {
  return `${getJamChordTimbre(timbreId).id}:${getJamArpeggioMode(arpeggioMode).id}:${Math.round(
    Number.isFinite(bpm) ? bpm : 112,
  )}`;
}
