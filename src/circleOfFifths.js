const TAU = Math.PI * 2;
const SEGMENT_SWEEP = TAU / 12;
const OUTER_RING_RADIUS_RATIO = 0.38;
const OUTER_RING_INNER_RATIO = 0.62;
const INNER_RING_INNER_RATIO = 0.28;
const INNER_RING_OUTER_RATIO = 0.6;

const OUTER_RING_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const INNER_RING_KEYS = ["A", "E", "B", "F#", "C#", "G#", "D#", "Bb", "F", "C", "G", "D"];

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

export const CIRCLE_OF_FIFTHS_SEGMENTS = [
  ...OUTER_RING_KEYS.map((note, index) => createSegment(note, "major", "outer", index)),
  ...INNER_RING_KEYS.map((note, index) => createSegment(note, "minor", "inner", index)),
];

function createSegment(note, quality, ring, index) {
  return {
    id: `${ring}-${note}-${quality}`,
    index,
    note,
    label: quality === "major" ? note : `${note}m`,
    quality,
    ring,
    title: `${note} ${quality}`,
  };
}

export function createCircleOfFifthsLayout(width, height) {
  const safeWidth = Math.max(1, width || 0);
  const safeHeight = Math.max(1, height || 0);
  const radius = Math.min(safeWidth, safeHeight) * OUTER_RING_RADIUS_RATIO;

  return {
    width: safeWidth,
    height: safeHeight,
    centerX: safeWidth / 2,
    centerY: safeHeight / 2,
    outerRadius: radius,
    outerRingInnerRadius: radius * OUTER_RING_INNER_RATIO,
    innerRingInnerRadius: radius * INNER_RING_INNER_RATIO,
    innerRingOuterRadius: radius * INNER_RING_OUTER_RATIO,
    segmentSweep: SEGMENT_SWEEP,
  };
}

export function getSegmentAtPoint(point, layout) {
  if (
    !point ||
    !layout ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(layout.centerX) ||
    !Number.isFinite(layout.centerY)
  ) {
    return null;
  }

  const dx = point.x - layout.centerX;
  const dy = point.y - layout.centerY;
  const distance = Math.hypot(dx, dy);

  if (distance < layout.innerRingInnerRadius || distance > layout.outerRadius) {
    return null;
  }

  const ring =
    distance >= layout.outerRingInnerRadius && distance <= layout.outerRadius ? "outer" : "inner";
  const angleFromTop = (Math.atan2(dx, -dy) + TAU) % TAU;
  const index = Math.floor((angleFromTop + layout.segmentSweep / 2) / layout.segmentSweep) % 12;

  return CIRCLE_OF_FIFTHS_SEGMENTS.find(
    (segment) => segment.ring === ring && segment.index === index,
  );
}

export function getSegmentAngles(segmentIndex) {
  const startAngle = segmentIndex * SEGMENT_SWEEP - SEGMENT_SWEEP / 2;
  return {
    startAngle,
    endAngle: startAngle + SEGMENT_SWEEP,
    centerAngle: startAngle + SEGMENT_SWEEP / 2,
  };
}

export function getChordFrequencies(segment) {
  if (!segment) {
    return [];
  }

  const rootPitchClass = NOTE_TO_PITCH_CLASS[segment.note];
  if (!Number.isFinite(rootPitchClass)) {
    return [];
  }

  const rootMidi = pitchClassToComfortableMidi(rootPitchClass);
  const intervals = segment.quality === "minor" ? [0, 3, 7, 12] : [0, 4, 7, 12];
  return intervals.map((interval) => midiToFrequency(rootMidi + interval));
}

function pitchClassToComfortableMidi(pitchClass, preferredLow = 55, preferredHigh = 65) {
  let midi = 48 + pitchClass;
  while (midi < preferredLow) {
    midi += 12;
  }
  while (midi > preferredHigh) {
    midi -= 12;
  }
  return midi;
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
