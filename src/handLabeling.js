const DEFAULT_POSE_KEYPOINT_THRESHOLD = 0.2;
const HAND_LABEL_MEMORY_MS = 1400;
const HAND_LABEL_SINGLE_STATE_MS = 1200;
const HAND_LABEL_SINGLE_POSITION_MATCH_RADIUS = 0.18;
const HAND_LABEL_SINGLE_SWITCH_CONFIRM_MS = 420;
const HAND_LABEL_SINGLE_SWITCH_MARGIN = 0.01;
const HAND_LABEL_SINGLE_IMMEDIATE_SWITCH_MARGIN = 0.16;
const HAND_WRIST_INDEX = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function resolveHandLabelFromHint(labelHint) {
  const normalized = String(labelHint ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("left")) {
    return "Left";
  }
  if (normalized.includes("right")) {
    return "Right";
  }
  return null;
}

function getHandPointerX(hand) {
  return hand?.indexTip?.u ?? hand?.thumbTip?.u ?? 0.5;
}

function getHandAnchorPoint(hand) {
  const wrist = hand?.landmarks?.[HAND_WRIST_INDEX];
  if (wrist && Number.isFinite(wrist.u) && Number.isFinite(wrist.v)) {
    return { x: wrist.u, y: wrist.v };
  }

  if (
    Number.isFinite(hand?.indexTip?.u) &&
    Number.isFinite(hand?.indexTip?.v) &&
    Number.isFinite(hand?.thumbTip?.u) &&
    Number.isFinite(hand?.thumbTip?.v)
  ) {
    return {
      x: (hand.indexTip.u + hand.thumbTip.u) * 0.5,
      y: (hand.indexTip.v + hand.thumbTip.v) * 0.5,
    };
  }

  return {
    x: getHandPointerX(hand),
    y: hand?.indexTip?.v ?? hand?.thumbTip?.v ?? 0.5,
  };
}

function getVisiblePoseKeypoint(pose, name, minScore = DEFAULT_POSE_KEYPOINT_THRESHOLD) {
  const keypoints = Array.isArray(pose?.keypoints) ? pose.keypoints : [];
  for (const point of keypoints) {
    if (
      point?.name === name &&
      Number.isFinite(point.u) &&
      Number.isFinite(point.v) &&
      Number.isFinite(point.score) &&
      point.score >= minScore
    ) {
      return point;
    }
  }
  return null;
}

function extractPoseArmAnchors(pose, poseKeypointThreshold) {
  return {
    Left: {
      elbow: getVisiblePoseKeypoint(pose, "left_elbow", poseKeypointThreshold),
      wrist: getVisiblePoseKeypoint(pose, "left_wrist", poseKeypointThreshold),
    },
    Right: {
      elbow: getVisiblePoseKeypoint(pose, "right_elbow", poseKeypointThreshold),
      wrist: getVisiblePoseKeypoint(pose, "right_wrist", poseKeypointThreshold),
    },
  };
}

function pointToSegmentDistance(point, start, end) {
  if (!point || !start || !end) {
    return Number.POSITIVE_INFINITY;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSquared = dx * dx + dy * dy;
  if (segmentLengthSquared <= 1e-9) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared;
  const t = clamp(projection, 0, 1);
  const projectedX = start.x + dx * t;
  const projectedY = start.y + dy * t;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function pruneHandLabelMemory(memory, timestamp) {
  if (!memory?.byLabel || typeof memory.byLabel !== "object") {
    return;
  }

  for (const [label, entry] of Object.entries(memory.byLabel)) {
    if (!entry || !Number.isFinite(entry.x)) {
      delete memory.byLabel[label];
      continue;
    }
    if (
      Number.isFinite(timestamp) &&
      Number.isFinite(entry.timestamp) &&
      timestamp - entry.timestamp > HAND_LABEL_MEMORY_MS
    ) {
      delete memory.byLabel[label];
    }
  }

  if (
    memory.singleHandState &&
    (!Number.isFinite(memory.singleHandState.timestamp) ||
      (Number.isFinite(timestamp) &&
        timestamp - memory.singleHandState.timestamp > HAND_LABEL_SINGLE_STATE_MS))
  ) {
    memory.singleHandState = null;
  }
}

function computePoseArmLabelCost(label, hand, poseArmAnchors) {
  if (label !== "Left" && label !== "Right") {
    return null;
  }

  const arm = poseArmAnchors?.[label];
  if (!arm?.wrist) {
    return null;
  }

  const handPoint = getHandAnchorPoint(hand);
  const wristPoint = { x: arm.wrist.u, y: arm.wrist.v };
  const elbowPoint =
    arm.elbow && Number.isFinite(arm.elbow.u) && Number.isFinite(arm.elbow.v)
      ? { x: arm.elbow.u, y: arm.elbow.v }
      : null;

  const wristDistance = Math.hypot(handPoint.x - wristPoint.x, handPoint.y - wristPoint.y);
  const forearmDistance = elbowPoint
    ? pointToSegmentDistance(handPoint, elbowPoint, wristPoint)
    : wristDistance;
  const xAlignment = Math.abs(getHandPointerX(hand) - wristPoint.x);

  return forearmDistance * 0.7 + wristDistance * 0.2 + xAlignment * 0.1;
}

function computeFallbackLabelCost(label, hand, memoryByLabel, poseArmAnchors) {
  const handPoint = getHandAnchorPoint(hand);
  const handX = getHandPointerX(hand);
  const memoryEntry = memoryByLabel?.[label];
  let cost;

  if (
    memoryEntry &&
    Number.isFinite(memoryEntry.x) &&
    Number.isFinite(memoryEntry.y)
  ) {
    cost =
      Math.abs(handPoint.x - memoryEntry.x) * 0.7 +
      Math.abs(handPoint.y - memoryEntry.y) * 0.3;
  } else if (memoryEntry && Number.isFinite(memoryEntry.x)) {
    cost = Math.abs(handX - memoryEntry.x);
  } else if (label === "Left") {
    cost = Math.abs(handX - 0.25) + 0.12;
  } else if (label === "Right") {
    cost = Math.abs(handX - 0.75) + 0.12;
  } else {
    cost = 0.65;
  }

  const poseCost = computePoseArmLabelCost(label, hand, poseArmAnchors);
  if (Number.isFinite(poseCost)) {
    cost = cost * 0.2 + poseCost * 0.8;
  }

  const handednessHint = resolveHandLabelFromHint(hand?.handedness);
  if (handednessHint === label) {
    cost = Math.max(0, cost - 0.035);
  } else if (handednessHint && (label === "Left" || label === "Right")) {
    cost += 0.08;
  }

  return cost;
}

function chooseSingleHandLabel(hand, memory, timestamp, memoryByLabel, poseArmAnchors) {
  const candidateLabels = ["Left", "Right"];
  const costs = {};
  let bestLabel = "Right";
  let bestCost = Number.POSITIVE_INFINITY;

  for (const label of candidateLabels) {
    const cost = computeFallbackLabelCost(label, hand, memoryByLabel, poseArmAnchors);
    costs[label] = cost;
    if (cost < bestCost) {
      bestCost = cost;
      bestLabel = label;
    }
  }

  const state = memory?.singleHandState ?? null;
  const handPoint = getHandAnchorPoint(hand);
  let chosenLabel = bestLabel;

  if (
    state &&
    (state.label === "Left" || state.label === "Right") &&
    Number.isFinite(state.timestamp) &&
    timestamp - state.timestamp <= HAND_LABEL_SINGLE_STATE_MS &&
    state.label !== bestLabel
  ) {
    const previousCost = costs[state.label];
    const pointDistance =
      Number.isFinite(state.x) && Number.isFinite(state.y)
        ? Math.hypot(handPoint.x - state.x, handPoint.y - state.y)
        : Math.abs(getHandPointerX(hand) - (state.x ?? getHandPointerX(hand)));

    const immediateSwitch =
      bestCost + HAND_LABEL_SINGLE_IMMEDIATE_SWITCH_MARGIN < previousCost &&
      pointDistance >= HAND_LABEL_SINGLE_POSITION_MATCH_RADIUS;

    const confirmedSwitch =
      state.pendingLabel === bestLabel &&
      Number.isFinite(state.pendingSince) &&
      timestamp - state.pendingSince >= HAND_LABEL_SINGLE_SWITCH_CONFIRM_MS &&
      bestCost + HAND_LABEL_SINGLE_SWITCH_MARGIN < previousCost;

    if (!immediateSwitch && !confirmedSwitch) {
      chosenLabel = state.label;
      if (memory) {
        memory.singleHandState = {
          ...state,
          x: handPoint.x,
          y: handPoint.y,
          timestamp,
          pendingLabel: state.pendingLabel === bestLabel ? bestLabel : bestLabel,
          pendingSince:
            state.pendingLabel === bestLabel && Number.isFinite(state.pendingSince)
              ? state.pendingSince
              : timestamp,
        };
      }
      return chosenLabel;
    }
  }

  if (memory) {
    memory.singleHandState = {
      label: chosenLabel,
      x: handPoint.x,
      y: handPoint.y,
      timestamp,
      pendingLabel: null,
      pendingSince: null,
    };
  }

  return chosenLabel;
}

export function assignStableHandLabels(hands, options = {}) {
  const memory = options?.memory && typeof options.memory === "object" ? options.memory : null;
  const timestamp = Number.isFinite(options?.timestamp) ? options.timestamp : Date.now();
  const poseKeypointThreshold = Number.isFinite(options?.poseKeypointThreshold)
    ? options.poseKeypointThreshold
    : DEFAULT_POSE_KEYPOINT_THRESHOLD;
  const poseArmAnchors = extractPoseArmAnchors(options?.pose, poseKeypointThreshold);

  if (memory && (!memory.byLabel || typeof memory.byLabel !== "object")) {
    memory.byLabel = {};
  }
  if (memory) {
    pruneHandLabelMemory(memory, timestamp);
  }
  if (!Array.isArray(hands) || hands.length === 0) {
    return [];
  }

  const sortedByScore = [...hands].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
  const labeled = [];
  const unlabeled = [...sortedByScore];
  const takenLabels = new Set();

  unlabeled.sort((first, second) => {
    const firstX = getHandPointerX(first);
    const secondX = getHandPointerX(second);
    return firstX - secondX;
  });

  const fallbackLabelPool = [];
  if (!takenLabels.has("Left")) {
    fallbackLabelPool.push("Left");
  }
  if (!takenLabels.has("Right")) {
    fallbackLabelPool.push("Right");
  }
  let genericIndex = 0;
  while (fallbackLabelPool.length < unlabeled.length) {
    const candidate = `Hand ${String.fromCharCode(65 + genericIndex)}`;
    genericIndex += 1;
    if (!takenLabels.has(candidate) && !fallbackLabelPool.includes(candidate)) {
      fallbackLabelPool.push(candidate);
    }
  }

  const assignedLabels = new Array(unlabeled.length).fill(null);
  const memoryByLabel = memory?.byLabel ?? null;

  if (unlabeled.length === 1) {
    assignedLabels[0] = chooseSingleHandLabel(
      unlabeled[0],
      memory,
      timestamp,
      memoryByLabel,
      poseArmAnchors,
    );
  } else if (unlabeled.length === 2 && fallbackLabelPool.length >= 2) {
    let best = null;
    for (let firstIndex = 0; firstIndex < fallbackLabelPool.length; firstIndex += 1) {
      for (let secondIndex = 0; secondIndex < fallbackLabelPool.length; secondIndex += 1) {
        if (firstIndex === secondIndex) {
          continue;
        }
        const firstLabel = fallbackLabelPool[firstIndex];
        const secondLabel = fallbackLabelPool[secondIndex];
        const totalCost =
          computeFallbackLabelCost(firstLabel, unlabeled[0], memoryByLabel, poseArmAnchors) +
          computeFallbackLabelCost(secondLabel, unlabeled[1], memoryByLabel, poseArmAnchors);
        if (!best || totalCost < best.cost) {
          best = {
            cost: totalCost,
            firstLabel,
            secondLabel,
          };
        }
      }
    }
    if (best) {
      assignedLabels[0] = best.firstLabel;
      assignedLabels[1] = best.secondLabel;
    }
  }

  const consumedFallbackLabels = new Set(assignedLabels.filter(Boolean));
  for (let index = 0; index < unlabeled.length; index += 1) {
    if (assignedLabels[index]) {
      continue;
    }
    let chosenLabel = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidateLabel of fallbackLabelPool) {
      if (consumedFallbackLabels.has(candidateLabel)) {
        continue;
      }
      const cost = computeFallbackLabelCost(
        candidateLabel,
        unlabeled[index],
        memoryByLabel,
        poseArmAnchors,
      );
      if (cost < bestCost) {
        bestCost = cost;
        chosenLabel = candidateLabel;
      }
    }
    if (!chosenLabel) {
      chosenLabel = `Hand ${String.fromCharCode(65 + index)}`;
    }
    consumedFallbackLabels.add(chosenLabel);
    assignedLabels[index] = chosenLabel;
  }

  for (let index = 0; index < unlabeled.length; index += 1) {
    const hand = unlabeled[index];
    const label = assignedLabels[index] ?? `Hand ${String.fromCharCode(65 + index)}`;
    takenLabels.add(label);
    labeled.push({
      ...hand,
      label,
      id: label,
    });
  }

  if (memory) {
    if (labeled.length !== 1) {
      memory.singleHandState = null;
    }
    const freezeSingleHandLabelMemory =
      labeled.length === 1 &&
      memory.singleHandState &&
      memory.singleHandState.label === labeled[0]?.label &&
      memory.singleHandState.pendingLabel &&
      memory.singleHandState.pendingLabel !== labeled[0]?.label;
    for (const hand of labeled) {
      if (freezeSingleHandLabelMemory && hand.label === labeled[0]?.label) {
        continue;
      }
      const anchor = getHandAnchorPoint(hand);
      memory.byLabel[hand.label] = {
        x: anchor.x,
        y: anchor.y,
        timestamp,
      };
    }
    pruneHandLabelMemory(memory, timestamp);
  }

  return labeled.sort((first, second) => {
    const rank = (label) => {
      if (label === "Left") {
        return 0;
      }
      if (label === "Right") {
        return 1;
      }
      return 2;
    };
    return rank(first.label) - rank(second.label);
  });
}
