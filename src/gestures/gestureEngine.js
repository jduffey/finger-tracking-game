import { createScopedLogger } from "../logger";
import {
  ALL_GESTURE_IDS,
  DISCRETE_GESTURE_HOLD_FRAMES,
  GESTURE_COOLDOWN_MS,
  GESTURE_IDS,
  PERSONALIZATION_MIN_SAMPLES,
  SINGLE_HAND_GESTURES,
  TWO_HAND_GESTURES,
  WINDOW_SIZE,
  createEmptyConfidenceMap,
} from "./constants";
import {
  extractSingleHandFeature,
  extractTwoHandFeature,
  flattenSingleHandWindow,
  flattenTwoHandWindow,
  wrapAngleDelta,
} from "./featureExtract";

const PINCH_START_THRESHOLD = 0.045;
const PINCH_END_THRESHOLD = 0.06;
const STALE_HAND_FRAME_LIMIT = 8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(value, min, max) {
  if (!Number.isFinite(value) || max <= min) {
    return 0;
  }
  return clamp((value - min) / (max - min), 0, 1);
}

function mean(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((accumulator, value) => accumulator + value, 0) / values.length;
}

function addWindowSample(window, sample, maxLength) {
  window.push(sample);
  if (window.length > maxLength) {
    window.splice(0, window.length - maxLength);
  }
}

function createHandState(id, label) {
  return {
    id,
    label,
    feature: null,
    pinchActive: false,
    pinchConfidence: 0,
    lastSeenFrame: 0,
    window: [],
  };
}

function computeSwipeConfidence(window, direction) {
  if (!Array.isArray(window) || window.length < 6) {
    return 0;
  }

  const first = window[0];
  const last = window[window.length - 1];
  const dx = last.pointer.x - first.pointer.x;
  const directionDistance = direction === "left" ? -dx : dx;
  const avgAbsVx = mean(window.map((feature) => Math.abs(feature.velocity.x)));
  const avgAbsVy = mean(window.map((feature) => Math.abs(feature.velocity.y)));
  const signSum = window.reduce((accumulator, feature) => {
    const sign = Math.sign(feature.velocity.x);
    if (direction === "left") {
      return accumulator + (sign < 0 ? 1 : -0.35);
    }
    return accumulator + (sign > 0 ? 1 : -0.35);
  }, 0);

  const consistency = clamp(signSum / window.length, 0, 1);
  const distanceScore = normalizeRange(directionDistance, 0.08, 0.32);
  const speedScore = normalizeRange(avgAbsVx, 0.45, 2.3);
  const axisScore = normalizeRange(avgAbsVx - avgAbsVy * 0.8, 0.08, 1.1);

  return clamp(distanceScore * speedScore * consistency * axisScore, 0, 1);
}

function computeOpenPalmConfidence(feature) {
  return clamp(normalizeRange(feature.openness, 1.02, 1.65), 0, 1);
}

function computePushForwardConfidence(window) {
  if (!Array.isArray(window) || window.length < 8) {
    return 0;
  }

  const first = window[0];
  const last = window[window.length - 1];
  const scaleDelta = last.handScale - first.handScale;
  const recentScaleVelocities = [];
  for (let index = 1; index < window.length; index += 1) {
    recentScaleVelocities.push(window[index].handScale - window[index - 1].handScale);
  }
  const avgScaleVelocity = mean(recentScaleVelocities);

  const deltaScore = normalizeRange(scaleDelta, 0.01, 0.09);
  const velocityScore = normalizeRange(avgScaleVelocity, 0.0015, 0.016);
  const stabilityPenalty = normalizeRange(Math.abs(last.velocity.x) + Math.abs(last.velocity.y), 0.9, 2.4);
  const stabilityScore = 1 - stabilityPenalty * 0.45;

  return clamp(deltaScore * velocityScore * stabilityScore, 0, 1);
}

function computeCircleConfidence(window) {
  if (!Array.isArray(window) || window.length < 12) {
    return 0;
  }

  const centroid = {
    x: mean(window.map((feature) => feature.pointer.x)),
    y: mean(window.map((feature) => feature.pointer.y)),
  };

  const angles = [];
  const radii = [];
  for (const feature of window) {
    const dx = feature.pointer.x - centroid.x;
    const dy = feature.pointer.y - centroid.y;
    radii.push(Math.hypot(dx, dy));
    angles.push(Math.atan2(dy, dx));
  }

  const radiusMean = mean(radii);
  if (radiusMean < 0.012) {
    return 0;
  }

  const radiusStd = Math.sqrt(mean(radii.map((radius) => {
    const delta = radius - radiusMean;
    return delta * delta;
  })));

  let angularTravel = 0;
  for (let index = 1; index < angles.length; index += 1) {
    angularTravel += wrapAngleDelta(angles[index] - angles[index - 1]);
  }

  const coverageScore = normalizeRange(Math.abs(angularTravel), Math.PI * 1.5, Math.PI * 2.75);
  const radiusStabilityScore = clamp(1 - radiusStd / Math.max(1e-4, radiusMean * 0.9), 0, 1);
  const motionScore = normalizeRange(radiusMean, 0.018, 0.09);
  const speedScore = normalizeRange(mean(window.map((feature) => feature.velocity.speed)), 0.25, 1.8);

  return clamp(coverageScore * radiusStabilityScore * motionScore * speedScore, 0, 1);
}

function computeExpandCompressConfidence(twoHandWindow) {
  if (!Array.isArray(twoHandWindow) || twoHandWindow.length < 8) {
    return { expand: 0, compress: 0 };
  }

  const first = twoHandWindow[0];
  const last = twoHandWindow[twoHandWindow.length - 1];
  const distanceDelta = last.distance - first.distance;
  const velocityScore = normalizeRange(Math.abs(mean(twoHandWindow.map((feature) => feature.dDistance))), 0.12, 2.3);

  return {
    expand: clamp(normalizeRange(distanceDelta, 0.02, 0.2) * velocityScore, 0, 1),
    compress: clamp(normalizeRange(-distanceDelta, 0.02, 0.2) * velocityScore, 0, 1),
  };
}

function computeRotateConfidence(twoHandWindow) {
  if (!Array.isArray(twoHandWindow) || twoHandWindow.length < 8) {
    return 0;
  }
  const first = twoHandWindow[0];
  const last = twoHandWindow[twoHandWindow.length - 1];
  const deltaAngle = wrapAngleDelta(last.angle - first.angle);
  const velocityScore = normalizeRange(
    mean(twoHandWindow.map((feature) => Math.abs(feature.dAngle))),
    0.8,
    6.5,
  );
  const angleScore = normalizeRange(Math.abs(deltaAngle), 0.24, 1.5);
  return clamp(angleScore * velocityScore, 0, 1);
}

function computeSymmetricSwipeConfidence(firstWindow, secondWindow) {
  if (!Array.isArray(firstWindow) || !Array.isArray(secondWindow) || firstWindow.length < 6 || secondWindow.length < 6) {
    return { confidence: 0, direction: "right", avgVelocity: { x: 0, y: 0 } };
  }

  const recentA = firstWindow.slice(-6);
  const recentB = secondWindow.slice(-6);
  const velocityA = {
    x: mean(recentA.map((feature) => feature.velocity.x)),
    y: mean(recentA.map((feature) => feature.velocity.y)),
  };
  const velocityB = {
    x: mean(recentB.map((feature) => feature.velocity.x)),
    y: mean(recentB.map((feature) => feature.velocity.y)),
  };

  const magnitudeA = Math.hypot(velocityA.x, velocityA.y);
  const magnitudeB = Math.hypot(velocityB.x, velocityB.y);
  const similarity =
    magnitudeA > 1e-6 && magnitudeB > 1e-6
      ? (velocityA.x * velocityB.x + velocityA.y * velocityB.y) / (magnitudeA * magnitudeB)
      : 0;
  const avgVelocity = {
    x: (velocityA.x + velocityB.x) * 0.5,
    y: (velocityA.y + velocityB.y) * 0.5,
  };

  const speedScore = normalizeRange(Math.min(magnitudeA, magnitudeB), 0.55, 2.2);
  const similarityScore = normalizeRange(similarity, 0.7, 0.98);
  const axisScore = normalizeRange(Math.abs(avgVelocity.x) - Math.abs(avgVelocity.y) * 0.8, 0.08, 1.15);
  const confidence = clamp(speedScore * similarityScore * axisScore, 0, 1);

  return {
    confidence,
    direction: avgVelocity.x >= 0 ? "right" : "left",
    avgVelocity,
  };
}

function getPersonalizationTrust(sampleCount) {
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) {
    return 0;
  }
  if (sampleCount < PERSONALIZATION_MIN_SAMPLES) {
    return clamp(0.12 + (sampleCount / PERSONALIZATION_MIN_SAMPLES) * 0.33, 0, 0.45);
  }
  return clamp(0.6 + (sampleCount - PERSONALIZATION_MIN_SAMPLES) * 0.04, 0.6, 0.9);
}

export function createGestureEngine(options = {}) {
  const logger = options.logger ?? createScopedLogger("gestureEngine");
  const windowSize = Number.isFinite(options.windowSize) ? options.windowSize : WINDOW_SIZE;
  const cooldownMs = Number.isFinite(options.cooldownMs) ? options.cooldownMs : GESTURE_COOLDOWN_MS;

  const state = {
    frameId: 0,
    eventSeq: 0,
    lastTimestamp: 0,
    hands: new Map(),
    twoHandWindow: [],
    twoHandFeature: null,
    cooldownByKey: new Map(),
    holdByKey: new Map(),
  };

  function reset() {
    state.frameId = 0;
    state.eventSeq = 0;
    state.lastTimestamp = 0;
    state.hands.clear();
    state.twoHandWindow = [];
    state.twoHandFeature = null;
    state.cooldownByKey.clear();
    state.holdByKey.clear();
  }

  function canEmitEvent(key, timestamp) {
    const last = state.cooldownByKey.get(key) ?? 0;
    return timestamp - last >= cooldownMs;
  }

  function markEvent(key, timestamp) {
    state.cooldownByKey.set(key, timestamp);
  }

  function nextEventId() {
    state.eventSeq += 1;
    return `gesture-${state.eventSeq}`;
  }

  function advanceHoldCounter(key, aboveThreshold) {
    const previous = state.holdByKey.get(key) ?? 0;
    const next = aboveThreshold ? previous + 1 : 0;
    state.holdByKey.set(key, next);
    return next;
  }

  function clearHoldCountersForHand(handId) {
    const suffix = `:${handId}`;
    for (const key of state.holdByKey.keys()) {
      if (key.endsWith(suffix)) {
        state.holdByKey.delete(key);
      }
    }
  }

  function update(updateInput) {
    const timestamp = Number.isFinite(updateInput?.timestamp) ? updateInput.timestamp : performance.now();
    const dtSeconds = state.lastTimestamp > 0
      ? clamp((timestamp - state.lastTimestamp) / 1000, 1 / 120, 0.08)
      : 1 / 60;
    state.lastTimestamp = timestamp;
    state.frameId += 1;

    const confidenceThreshold = clamp(
      Number.isFinite(updateInput?.confidenceThreshold) ? updateInput.confidenceThreshold : 0.7,
      0.1,
      0.99,
    );

    const personalizer = updateInput?.personalizer ?? null;
    const personalizationEnabled = Boolean(updateInput?.personalizationEnabled);
    const inputHands = Array.isArray(updateInput?.hands) ? updateInput.hands : [];
    const events = [];

    const activeHandIds = new Set();
    const orderedHandStates = [];

    for (const hand of inputHands) {
      if (!hand?.id) {
        continue;
      }
      activeHandIds.add(hand.id);
      const current = state.hands.get(hand.id) ?? createHandState(hand.id, hand.label ?? hand.id);
      current.label = hand.label ?? current.label;

      const feature = extractSingleHandFeature(hand, current.feature, dtSeconds);
      if (!feature) {
        continue;
      }

      const previousPinch = current.pinchActive;
      const pinchDistance = feature.pinchDistance;
      const pinchStart = pinchDistance <= PINCH_START_THRESHOLD;
      const pinchEnd = pinchDistance >= PINCH_END_THRESHOLD;
      let pinchActive = previousPinch;
      if (!pinchActive && pinchStart) {
        pinchActive = true;
      } else if (pinchActive && pinchEnd) {
        pinchActive = false;
      }

      current.pinchActive = pinchActive;
      current.pinchConfidence = clamp(1 - normalizeRange(pinchDistance, PINCH_START_THRESHOLD, PINCH_END_THRESHOLD * 1.4), 0, 1);
      current.feature = {
        ...feature,
        pinchActive,
      };
      current.lastSeenFrame = state.frameId;
      addWindowSample(current.window, current.feature, windowSize);
      state.hands.set(hand.id, current);
      orderedHandStates.push(current);

      if (pinchActive !== previousPinch) {
        const eventGestureId = pinchActive ? GESTURE_IDS.PINCH_GRAB : GESTURE_IDS.PINCH_RELEASE;
        const eventKey = `${eventGestureId}:${current.id}`;
        const eventConfidence = pinchActive ? current.pinchConfidence : 1 - current.pinchConfidence;
        if (canEmitEvent(eventKey, timestamp)) {
          markEvent(eventKey, timestamp);
          events.push({
            id: nextEventId(),
            timestamp,
            frameId: state.frameId,
            gestureId: eventGestureId,
            confidence: clamp(eventConfidence, 0, 1),
            handId: current.id,
            handLabel: current.label,
            meta: {
              pinchDistance,
            },
          });
        }
      }
    }

    for (const [handId, handState] of state.hands.entries()) {
      if (activeHandIds.has(handId)) {
        continue;
      }
      if (state.frameId - handState.lastSeenFrame > STALE_HAND_FRAME_LIMIT) {
        clearHoldCountersForHand(handId);
        state.hands.delete(handId);
      }
    }

    const orderedHands = orderedHandStates
      .filter((handState) => handState?.feature)
      .sort((a, b) => {
        const rank = (label) => {
          if (label === "Left") {
            return 0;
          }
          if (label === "Right") {
            return 1;
          }
          return 2;
        };
        return rank(a.label) - rank(b.label);
      });

    const perHandHeuristic = {};
    for (const handState of orderedHands) {
      const window = handState.window;
      const feature = handState.feature;
      perHandHeuristic[handState.id] = {
        [GESTURE_IDS.PINCH_GRAB]: clamp(handState.pinchConfidence, 0, 1),
        [GESTURE_IDS.PINCH_RELEASE]: clamp(1 - handState.pinchConfidence, 0, 1),
        [GESTURE_IDS.OPEN_PALM]: computeOpenPalmConfidence(feature),
        [GESTURE_IDS.SWIPE_LEFT]: computeSwipeConfidence(window, "left"),
        [GESTURE_IDS.SWIPE_RIGHT]: computeSwipeConfidence(window, "right"),
        [GESTURE_IDS.PUSH_FORWARD]: computePushForwardConfidence(window),
        [GESTURE_IDS.CIRCLE]: computeCircleConfidence(window),
      };
    }

    let twoHandFeature = null;
    let expandConfidence = 0;
    let compressConfidence = 0;
    let rotateConfidence = 0;
    let symmetricSwipeConfidence = 0;
    let symmetricSwipeMeta = null;

    if (orderedHands.length >= 2) {
      const handA = orderedHands[0];
      const handB = orderedHands[1];
      twoHandFeature = extractTwoHandFeature(handA.feature, handB.feature, state.twoHandFeature, dtSeconds);
      if (twoHandFeature) {
        state.twoHandFeature = twoHandFeature;
        addWindowSample(state.twoHandWindow, twoHandFeature, windowSize);

        const pinchBoth = handA.pinchActive && handB.pinchActive ? 1 : 0.45;
        const expandCompress = computeExpandCompressConfidence(state.twoHandWindow);
        expandConfidence = expandCompress.expand * pinchBoth;
        compressConfidence = expandCompress.compress * pinchBoth;
        rotateConfidence = computeRotateConfidence(state.twoHandWindow) * pinchBoth;

        const symmetric = computeSymmetricSwipeConfidence(handA.window, handB.window);
        symmetricSwipeConfidence = symmetric.confidence;
        symmetricSwipeMeta = symmetric;
      }
    } else {
      state.twoHandFeature = null;
      state.twoHandWindow = [];
    }

    const heuristicConfidences = createEmptyConfidenceMap();
    for (const gestureId of SINGLE_HAND_GESTURES) {
      let best = 0;
      for (const handState of orderedHands) {
        best = Math.max(best, perHandHeuristic[handState.id]?.[gestureId] ?? 0);
      }
      heuristicConfidences[gestureId] = clamp(best, 0, 1);
    }

    heuristicConfidences[GESTURE_IDS.EXPAND] = clamp(expandConfidence, 0, 1);
    heuristicConfidences[GESTURE_IDS.COMPRESS] = clamp(compressConfidence, 0, 1);
    heuristicConfidences[GESTURE_IDS.ROTATE_TWIST] = clamp(rotateConfidence, 0, 1);
    heuristicConfidences[GESTURE_IDS.SYMMETRIC_SWIPE] = clamp(symmetricSwipeConfidence, 0, 1);

    const liveVectors = {};
    for (const gestureId of SINGLE_HAND_GESTURES) {
      let bestHand = null;
      let bestConfidence = -1;
      for (const handState of orderedHands) {
        const confidence = perHandHeuristic[handState.id]?.[gestureId] ?? 0;
        if (confidence > bestConfidence) {
          bestHand = handState;
          bestConfidence = confidence;
        }
      }
      liveVectors[gestureId] = bestHand ? flattenSingleHandWindow(bestHand.window, windowSize) : null;
    }

    const twoHandVector = flattenTwoHandWindow(state.twoHandWindow, windowSize);
    for (const gestureId of TWO_HAND_GESTURES) {
      liveVectors[gestureId] = twoHandVector;
    }

    const personalizedConfidences = personalizationEnabled && personalizer
      ? personalizer.classifyLiveVectors(liveVectors)
      : createEmptyConfidenceMap();

    const confidences = createEmptyConfidenceMap();
    for (const gestureId of ALL_GESTURE_IDS) {
      const heuristic = heuristicConfidences[gestureId] ?? 0;
      const personalized = personalizedConfidences[gestureId] ?? 0;
      const sampleCount = personalizationEnabled && personalizer
        ? personalizer.getSampleCount(gestureId)
        : 0;
      const trust = personalizationEnabled ? getPersonalizationTrust(sampleCount) : 0;
      const adjustedPersonalized = clamp(personalized * 1.45, 0, 1);
      confidences[gestureId] = clamp(heuristic * (1 - trust) + adjustedPersonalized * trust, 0, 1);
    }

    const perHandConfidences = {};
    for (const handState of orderedHands) {
      const perHandHeuristicMap = perHandHeuristic[handState.id] ?? {};
      const handVector = flattenSingleHandWindow(handState.window, windowSize);
      const perHandLiveVectors = SINGLE_HAND_GESTURES.reduce((accumulator, gestureId) => {
        accumulator[gestureId] = handVector;
        return accumulator;
      }, {});
      const perHandPersonalizedMap = personalizationEnabled && personalizer
        ? personalizer.classifyLiveVectors(perHandLiveVectors)
        : createEmptyConfidenceMap();

      const blended = {};
      for (const gestureId of SINGLE_HAND_GESTURES) {
        const heuristic = perHandHeuristicMap[gestureId] ?? 0;
        const personalized = perHandPersonalizedMap[gestureId] ?? 0;
        const sampleCount = personalizationEnabled && personalizer
          ? personalizer.getSampleCount(gestureId)
          : 0;
        const trust = personalizationEnabled ? getPersonalizationTrust(sampleCount) : 0;
        const adjustedPersonalized = clamp(personalized * 1.45, 0, 1);
        blended[gestureId] = clamp(heuristic * (1 - trust) + adjustedPersonalized * trust, 0, 1);
      }
      perHandConfidences[handState.id] = blended;
    }

    const singleDiscreteGestures = [
      GESTURE_IDS.OPEN_PALM,
      GESTURE_IDS.SWIPE_LEFT,
      GESTURE_IDS.SWIPE_RIGHT,
      GESTURE_IDS.PUSH_FORWARD,
      GESTURE_IDS.CIRCLE,
    ];
    for (const handState of orderedHands) {
      const perHandConfidenceMap = perHandConfidences[handState.id] ?? {};
      for (const gestureId of singleDiscreteGestures) {
        const handSpecificBlendedConfidence = clamp(perHandConfidenceMap[gestureId] ?? 0, 0, 1);
        const key = `${gestureId}:${handState.id}`;
        const above = handSpecificBlendedConfidence >= confidenceThreshold;
        const holdCount = advanceHoldCounter(key, above);
        if (!above || holdCount !== DISCRETE_GESTURE_HOLD_FRAMES) {
          continue;
        }
        if (!canEmitEvent(key, timestamp)) {
          continue;
        }

        markEvent(key, timestamp);
        events.push({
          id: nextEventId(),
          timestamp,
          frameId: state.frameId,
          gestureId,
          confidence: handSpecificBlendedConfidence,
          handId: handState.id,
          handLabel: handState.label,
          meta: {
            pointer: handState.feature.pointer,
            velocity: handState.feature.velocity,
          },
        });
      }
    }

    const twoHandDiscrete = [
      GESTURE_IDS.EXPAND,
      GESTURE_IDS.COMPRESS,
      GESTURE_IDS.ROTATE_TWIST,
      GESTURE_IDS.SYMMETRIC_SWIPE,
    ];
    for (const gestureId of twoHandDiscrete) {
      const confidence = confidences[gestureId] ?? 0;
      const key = `${gestureId}:global`;
      const above = confidence >= confidenceThreshold;
      const holdCount = advanceHoldCounter(key, above);
      if (!above || holdCount !== DISCRETE_GESTURE_HOLD_FRAMES) {
        continue;
      }
      if (!canEmitEvent(key, timestamp)) {
        continue;
      }

      markEvent(key, timestamp);
      events.push({
        id: nextEventId(),
        timestamp,
        frameId: state.frameId,
        gestureId,
        confidence,
        handId: null,
        handLabel: "Both",
        meta: gestureId === GESTURE_IDS.SYMMETRIC_SWIPE
          ? {
              direction: symmetricSwipeMeta?.direction ?? "right",
              avgVelocity: symmetricSwipeMeta?.avgVelocity ?? { x: 0, y: 0 },
            }
          : {
              twoHand: state.twoHandFeature,
            },
      });
    }

    if (events.length > 0) {
      logger.debug("Gesture events emitted", {
        frameId: state.frameId,
        count: events.length,
        eventNames: events.map((event) => event.gestureId),
      });
    }

    return {
      frameId: state.frameId,
      timestamp,
      dtSeconds,
      threshold: confidenceThreshold,
      hands: orderedHands.map((handState) => ({
        id: handState.id,
        label: handState.label,
        pointer: handState.feature.pointer,
        pinchDistance: handState.feature.pinchDistance,
        pinchActive: handState.pinchActive,
        pinchConfidence: handState.pinchConfidence,
        openness: handState.feature.openness,
        handScale: handState.feature.handScale,
        velocity: handState.feature.velocity,
      })),
      twoHand: twoHandFeature
        ? {
            present: true,
            ...twoHandFeature,
            pinchBothActive: orderedHands.length >= 2 && orderedHands[0].pinchActive && orderedHands[1].pinchActive,
          }
        : {
            present: false,
          },
      perHandHeuristic,
      heuristicConfidences,
      personalizedConfidences,
      confidences,
      liveVectors,
      events,
      continuous: {
        pinchActiveByHand: orderedHands.reduce((accumulator, handState) => {
          accumulator[handState.id] = handState.pinchActive;
          return accumulator;
        }, {}),
        twoHandManipulationActive:
          orderedHands.length >= 2 && orderedHands[0].pinchActive && orderedHands[1].pinchActive,
      },
    };
  }

  return {
    reset,
    update,
  };
}
