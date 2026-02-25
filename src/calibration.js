import { createScopedLogger } from "./logger";

export const CALIBRATION_STORAGE_KEY = "fingerWhack.calibration.v2";
const calibrationLog = createScopedLogger("calibration");
const ARC_MODEL_VERSION = 1;
const ARC_RANGE_QUANTILE_LOW = 0.02;
const ARC_RANGE_QUANTILE_HIGH = 0.98;
const ARC_MIN_SPAN = 1e-5;
const ARC_CAPTURE_FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"];
const ARC_CONF_MIN_VALID_FRAMES = 120;
const ARC_CONF_MIN_CONFIDENCE = 0.86;
const ARC_CONF_MIN_SPAN_U = 0.14;
const ARC_CONF_MIN_SPAN_V = 0.06;
const ARC_CONF_MIN_REVERSALS = 2;

export function createCalibrationTargets(width, height) {
  calibrationLog.debug("Creating calibration targets", { width, height });
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(320, height);
  const padX = Math.max(48, Math.min(120, safeWidth * 0.12));
  const padY = Math.max(48, Math.min(120, safeHeight * 0.12));

  const left = padX;
  const right = safeWidth - padX;
  const top = padY;
  const bottom = safeHeight - padY;
  const centerX = safeWidth / 2;
  const centerY = safeHeight / 2;

  const targets = [
    { x: centerX, y: centerY, label: "Center" },
    { x: left, y: top, label: "Top Left" },
    { x: right, y: top, label: "Top Right" },
    { x: right, y: bottom, label: "Bottom Right" },
    { x: left, y: bottom, label: "Bottom Left" },
    { x: centerX, y: top, label: "Top" },
    { x: right, y: centerY, label: "Right" },
    { x: centerX, y: bottom, label: "Bottom" },
    { x: left, y: centerY, label: "Left" },
  ];

  calibrationLog.debug("Created calibration targets", {
    count: targets.length,
    safeWidth,
    safeHeight,
    padX,
    padY,
  });
  return targets;
}

export function solveAffineFromPairs(pairs) {
  calibrationLog.info("Solving affine transform from calibration pairs", {
    pairCount: Array.isArray(pairs) ? pairs.length : null,
  });
  if (!Array.isArray(pairs) || pairs.length < 3) {
    calibrationLog.warn("Not enough calibration pairs to solve affine transform", {
      pairCount: Array.isArray(pairs) ? pairs.length : null,
    });
    return null;
  }

  let sumUU = 0;
  let sumUV = 0;
  let sumU = 0;
  let sumVV = 0;
  let sumV = 0;
  let sumUX = 0;
  let sumVX = 0;
  let sumX = 0;
  let sumUY = 0;
  let sumVY = 0;
  let sumY = 0;

  for (const pair of pairs) {
    const u = pair.cam.u;
    const v = pair.cam.v;
    const x = pair.screen.x;
    const y = pair.screen.y;

    sumUU += u * u;
    sumUV += u * v;
    sumU += u;
    sumVV += v * v;
    sumV += v;

    sumUX += u * x;
    sumVX += v * x;
    sumX += x;

    sumUY += u * y;
    sumVY += v * y;
    sumY += y;
  }

  const mtm = [
    [sumUU, sumUV, sumU],
    [sumUV, sumVV, sumV],
    [sumU, sumV, pairs.length],
  ];

  calibrationLog.debug("Computed normal equation matrix (M^T M)", { mtm });

  const inv = invert3x3(mtm);
  if (!inv) {
    calibrationLog.error("Failed to invert normal equation matrix");
    return null;
  }

  const paramsX = multiplyMat3Vec3(inv, [sumUX, sumVX, sumX]);
  const paramsY = multiplyMat3Vec3(inv, [sumUY, sumVY, sumY]);

  const transform = {
    a1: paramsX[0],
    a2: paramsX[1],
    a3: paramsX[2],
    b1: paramsY[0],
    b2: paramsY[1],
    b3: paramsY[2],
  };

  const valid = isValidTransform(transform);
  calibrationLog.info("Affine transform solve finished", {
    valid,
    transform,
  });
  return valid ? transform : null;
}

export function applyAffineTransform(transform, u, v) {
  const mapped = {
    x: transform.a1 * u + transform.a2 * v + transform.a3,
    y: transform.b1 * u + transform.b2 * v + transform.b3,
  };
  calibrationLog.debug("Applied affine transform", { u, v, mapped });
  return mapped;
}

export function solveArcCalibrationFromSamples(samples) {
  const extracted = extractArcSolvePoints(samples);
  const sourcePoints = extracted.points;
  calibrationLog.info("Solving lazy-arc calibration model", {
    sampleCount: Array.isArray(samples) ? samples.length : null,
    pointCount: sourcePoints.length,
    frameCount: extracted.frameCount,
  });
  if (!Array.isArray(samples) || sourcePoints.length < 120) {
    calibrationLog.warn("Not enough samples for lazy-arc calibration solve", {
      sampleCount: Array.isArray(samples) ? samples.length : null,
      pointCount: sourcePoints.length,
      requiredPointCount: 120,
    });
    return null;
  }

  const sanitized = sourcePoints.filter(
    (point) =>
      point &&
      Number.isFinite(point.u) &&
      Number.isFinite(point.v) &&
      point.u >= -0.5 &&
      point.u <= 1.5 &&
      point.v >= -0.5 &&
      point.v <= 1.5,
  );
  if (sanitized.length < 120) {
    calibrationLog.warn("Insufficient valid samples after sanitization", {
      originalCount: sourcePoints.length,
      sanitizedCount: sanitized.length,
      requiredPointCount: 120,
    });
    return null;
  }

  let sumU = 0;
  let sumV = 0;
  for (const point of sanitized) {
    sumU += point.u;
    sumV += point.v;
  }
  const centerU = sumU / sanitized.length;
  const centerV = sumV / sanitized.length;

  let covUU = 0;
  let covUV = 0;
  let covVV = 0;
  for (const point of sanitized) {
    const du = point.u - centerU;
    const dv = point.v - centerV;
    covUU += du * du;
    covUV += du * dv;
    covVV += dv * dv;
  }
  covUU /= sanitized.length;
  covUV /= sanitized.length;
  covVV /= sanitized.length;

  const theta = 0.5 * Math.atan2(2 * covUV, covUU - covVV);
  let cosTheta = Math.cos(theta);
  let sinTheta = Math.sin(theta);

  let covUP = 0;
  for (const point of sanitized) {
    const du = point.u - centerU;
    const dv = point.v - centerV;
    const p = cosTheta * du + sinTheta * dv;
    covUP += du * p;
  }
  covUP /= sanitized.length;
  if (covUP < 0) {
    cosTheta *= -1;
    sinTheta *= -1;
  }

  const axisSamples = sanitized.map((point) => {
    const du = point.u - centerU;
    const dv = point.v - centerV;
    return {
      p: cosTheta * du + sinTheta * dv,
      q: -sinTheta * du + cosTheta * dv,
      v: point.v,
    };
  });

  let sumP4 = 0;
  let sumP3 = 0;
  let sumP2 = 0;
  let sumP = 0;
  let sumQ = 0;
  let sumP2Q = 0;
  let sumPQ = 0;
  for (const sample of axisSamples) {
    const p2 = sample.p * sample.p;
    sumP4 += p2 * p2;
    sumP3 += p2 * sample.p;
    sumP2 += p2;
    sumP += sample.p;
    sumQ += sample.q;
    sumP2Q += p2 * sample.q;
    sumPQ += sample.p * sample.q;
  }

  const normalMatrix = [
    [sumP4, sumP3, sumP2],
    [sumP3, sumP2, sumP],
    [sumP2, sumP, axisSamples.length],
  ];
  const inverted = invert3x3(normalMatrix);
  if (!inverted) {
    calibrationLog.error("Failed to invert quadratic normal matrix for arc solve", {
      normalMatrix,
    });
    return null;
  }

  const [curveA, curveB, curveC] = multiplyMat3Vec3(inverted, [sumP2Q, sumPQ, sumQ]);
  const residuals = [];
  let covVR = 0;
  for (const sample of axisSamples) {
    const curveQ = curveA * sample.p * sample.p + curveB * sample.p + curveC;
    const residual = sample.q - curveQ;
    residuals.push(residual);
    covVR += (sample.v - centerV) * residual;
  }
  covVR /= axisSamples.length;
  const residualSign = covVR < 0 ? -1 : 1;

  const pValues = axisSamples.map((sample) => sample.p);
  const adjustedResiduals = residuals.map((value) => value * residualSign);
  const pMin = quantile(pValues, ARC_RANGE_QUANTILE_LOW);
  const pMax = quantile(pValues, ARC_RANGE_QUANTILE_HIGH);
  const rMin = quantile(adjustedResiduals, ARC_RANGE_QUANTILE_LOW);
  const rMax = quantile(adjustedResiduals, ARC_RANGE_QUANTILE_HIGH);

  if (
    !Number.isFinite(pMin) ||
    !Number.isFinite(pMax) ||
    !Number.isFinite(rMin) ||
    !Number.isFinite(rMax) ||
    pMax - pMin < ARC_MIN_SPAN ||
    rMax - rMin < ARC_MIN_SPAN
  ) {
    calibrationLog.error("Arc solve rejected because fitted ranges were degenerate", {
      pMin,
      pMax,
      rMin,
      rMax,
    });
    return null;
  }

  const model = {
    kind: "arc",
    version: ARC_MODEL_VERSION,
    centerU,
    centerV,
    cosTheta,
    sinTheta,
    curveA,
    curveB,
    curveC,
    residualSign,
    pMin,
    pMax,
    rMin,
    rMax,
    sampleCount: sanitized.length,
    createdAt: new Date().toISOString(),
  };

  const valid = isValidArcModel(model);
  calibrationLog.info("Lazy-arc calibration solve finished", {
    valid,
    model,
  });
  return valid ? model : null;
}

export function applyArcCalibration(model, u, v) {
  if (!isValidArcModel(model) || !Number.isFinite(u) || !Number.isFinite(v)) {
    calibrationLog.debug("Skipping arc calibration apply due to invalid input", {
      hasValidModel: isValidArcModel(model),
      u,
      v,
    });
    return null;
  }

  const du = u - model.centerU;
  const dv = v - model.centerV;
  const p = model.cosTheta * du + model.sinTheta * dv;
  const q = -model.sinTheta * du + model.cosTheta * dv;
  const curveQ = model.curveA * p * p + model.curveB * p + model.curveC;
  const adjustedResidual = (q - curveQ) * model.residualSign;

  const pSpan = Math.max(ARC_MIN_SPAN, model.pMax - model.pMin);
  const rSpan = Math.max(ARC_MIN_SPAN, model.rMax - model.rMin);
  const uNormalized = clamp((p - model.pMin) / pSpan, 0, 1);
  const vNormalized = clamp((adjustedResidual - model.rMin) / rSpan, 0, 1);
  const mapped = {
    u: uNormalized,
    v: vNormalized,
    p,
    adjustedResidual,
  };
  calibrationLog.debug("Applied lazy-arc calibration mapping", {
    u,
    v,
    mapped,
  });
  return mapped;
}

export function evaluateArcCaptureConfidence(samples) {
  const totalFrames = Array.isArray(samples) ? samples.length : 0;
  if (!Array.isArray(samples) || totalFrames === 0) {
    return {
      confidence: 0,
      ready: false,
      metrics: {
        totalFrames: 0,
        validFrameCount: 0,
        coverageRatio: 0,
        fingerMetrics: {},
      },
    };
  }

  const perFinger = ARC_CAPTURE_FINGER_NAMES.reduce((accumulator, fingerName) => {
    accumulator[fingerName] = { u: [], v: [] };
    return accumulator;
  }, {});

  let validFrameCount = 0;
  for (const sample of samples) {
    const tips = sample?.tips;
    if (!tips || typeof tips !== "object") {
      continue;
    }

    const hasAllFive = ARC_CAPTURE_FINGER_NAMES.every((fingerName) => {
      const tip = tips[fingerName];
      return tip && Number.isFinite(tip.u) && Number.isFinite(tip.v);
    });
    if (!hasAllFive) {
      continue;
    }

    validFrameCount += 1;
    for (const fingerName of ARC_CAPTURE_FINGER_NAMES) {
      perFinger[fingerName].u.push(tips[fingerName].u);
      perFinger[fingerName].v.push(tips[fingerName].v);
    }
  }

  const fingerMetrics = {};
  let scoreTotal = 0;
  let minFingerScore = 1;
  let allFingersReady = true;
  for (const fingerName of ARC_CAPTURE_FINGER_NAMES) {
    const uSamples = perFinger[fingerName].u;
    const vSamples = perFinger[fingerName].v;
    const spanU = computeSpan(uSamples);
    const spanV = computeSpan(vSamples);
    const reversals = countDirectionalReversals(uSamples, 0.0025);
    const sweepScore = clamp((spanU - 0.08) / 0.22, 0, 1);
    const verticalScore = clamp((spanV - 0.035) / 0.14, 0, 1);
    const reversalScore = clamp((reversals - 1) / 3, 0, 1);
    const fingerScore = 0.45 * sweepScore + 0.35 * verticalScore + 0.2 * reversalScore;
    const fingerReady =
      spanU >= ARC_CONF_MIN_SPAN_U &&
      spanV >= ARC_CONF_MIN_SPAN_V &&
      reversals >= ARC_CONF_MIN_REVERSALS;

    fingerMetrics[fingerName] = {
      sampleCount: uSamples.length,
      spanU,
      spanV,
      reversals,
      fingerScore,
      ready: fingerReady,
    };

    scoreTotal += fingerScore;
    minFingerScore = Math.min(minFingerScore, fingerScore);
    allFingersReady = allFingersReady && fingerReady;
  }

  const meanFingerScore = scoreTotal / ARC_CAPTURE_FINGER_NAMES.length;
  const coverageRatio = totalFrames > 0 ? validFrameCount / totalFrames : 0;
  const coverageScore = clamp((coverageRatio - 0.55) / 0.4, 0, 1);
  const frameCountScore = clamp(validFrameCount / ARC_CONF_MIN_VALID_FRAMES, 0, 1);
  const confidence = clamp(
    0.25 * coverageScore +
      0.25 * frameCountScore +
      0.3 * meanFingerScore +
      0.2 * minFingerScore,
    0,
    1,
  );

  const ready =
    validFrameCount >= ARC_CONF_MIN_VALID_FRAMES &&
    allFingersReady &&
    confidence >= ARC_CONF_MIN_CONFIDENCE;

  return {
    confidence,
    ready,
    metrics: {
      totalFrames,
      validFrameCount,
      coverageRatio,
      frameCountScore,
      meanFingerScore,
      minFingerScore,
      allFingersReady,
      fingerMetrics,
    },
  };
}

export function clampPoint(point, width, height) {
  const safeX = Number.isFinite(point?.x) ? point.x : width / 2;
  const safeY = Number.isFinite(point?.y) ? point.y : height / 2;
  const clamped = {
    x: clamp(safeX, 0, width),
    y: clamp(safeY, 0, height),
  };
  calibrationLog.debug("Clamped point to viewport", {
    point,
    safeX,
    safeY,
    width,
    height,
    clamped,
  });
  return clamped;
}

export function loadCalibration() {
  calibrationLog.info("Loading calibration from localStorage");
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) {
      calibrationLog.info("No calibration data in localStorage");
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeCalibrationModel(parsed);
    const valid = Boolean(normalized);
    calibrationLog.info("Loaded calibration payload", {
      valid,
      parsed,
      normalized,
    });
    return normalized;
  } catch (error) {
    calibrationLog.error("Failed to load calibration from localStorage", {
      error,
    });
    return null;
  }
}

export function saveCalibration(model) {
  calibrationLog.info("Saving calibration to localStorage", { model });
  const normalized = normalizeCalibrationModel(model);
  if (!normalized) {
    calibrationLog.warn("Skipped saving invalid calibration model", { model });
    return;
  }
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(normalized));
  calibrationLog.info("Calibration saved");
}

export function clearCalibration() {
  calibrationLog.info("Clearing calibration from localStorage");
  localStorage.removeItem(CALIBRATION_STORAGE_KEY);
}

export function isValidArcModel(model) {
  if (!model || typeof model !== "object") {
    calibrationLog.debug("Arc model validation failed: missing object", { model });
    return false;
  }
  const keys = [
    "centerU",
    "centerV",
    "cosTheta",
    "sinTheta",
    "curveA",
    "curveB",
    "curveC",
    "residualSign",
    "pMin",
    "pMax",
    "rMin",
    "rMax",
  ];
  const hasFiniteFields = keys.every((key) => Number.isFinite(model[key]));
  const valid =
    hasFiniteFields &&
    Math.abs(model.residualSign) === 1 &&
    model.pMax - model.pMin >= ARC_MIN_SPAN &&
    model.rMax - model.rMin >= ARC_MIN_SPAN;
  calibrationLog.debug("Arc model validation result", { valid, model });
  return valid;
}

export function isValidCalibrationModel(model) {
  const normalized = normalizeCalibrationModel(model);
  const valid = Boolean(normalized);
  calibrationLog.debug("Calibration model validation result", {
    valid,
    model,
    normalized,
  });
  return valid;
}

export function isValidTransform(transform) {
  if (!transform || typeof transform !== "object") {
    calibrationLog.debug("Transform validation failed: missing object", { transform });
    return false;
  }
  const keys = ["a1", "a2", "a3", "b1", "b2", "b3"];
  const valid = keys.every((key) => Number.isFinite(transform[key]));
  calibrationLog.debug("Transform validation result", { valid, transform });
  return valid;
}

function normalizeCalibrationModel(model) {
  if (!model || typeof model !== "object") {
    return null;
  }

  if (model.kind === "arc" && isValidArcModel(model)) {
    return {
      ...model,
      kind: "arc",
      version: Number.isFinite(model.version) ? model.version : ARC_MODEL_VERSION,
    };
  }

  if (model.kind === "affine" && isValidTransform(model)) {
    return {
      kind: "affine",
      ...pickAffineFields(model),
    };
  }

  if (isValidTransform(model)) {
    return {
      kind: "affine",
      ...pickAffineFields(model),
    };
  }

  return null;
}

function pickAffineFields(model) {
  return {
    a1: model.a1,
    a2: model.a2,
    a3: model.a3,
    b1: model.b1,
    b2: model.b2,
    b3: model.b3,
  };
}

function multiplyMat3Vec3(mat, vec) {
  return [
    mat[0][0] * vec[0] + mat[0][1] * vec[1] + mat[0][2] * vec[2],
    mat[1][0] * vec[0] + mat[1][1] * vec[1] + mat[1][2] * vec[2],
    mat[2][0] * vec[0] + mat[2][1] * vec[1] + mat[2][2] * vec[2],
  ];
}

function invert3x3(mat) {
  calibrationLog.debug("Attempting 3x3 matrix inversion", { mat });
  const [a, b, c] = mat[0];
  const [d, e, f] = mat[1];
  const [g, h, i] = mat[2];

  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) {
    calibrationLog.warn("3x3 inversion aborted because determinant is too small", {
      det,
    });
    return null;
  }

  const invDet = 1 / det;
  const inverted = [
    [A * invDet, D * invDet, G * invDet],
    [B * invDet, E * invDet, H * invDet],
    [C * invDet, F * invDet, I * invDet],
  ];
  calibrationLog.debug("3x3 matrix inversion succeeded", { det, inverted });
  return inverted;
}

function extractArcSolvePoints(samples) {
  if (!Array.isArray(samples)) {
    return { points: [], frameCount: 0 };
  }

  const points = [];
  let frameCount = 0;
  for (const sample of samples) {
    if (sample?.tips && typeof sample.tips === "object") {
      let frameHasPoint = false;
      for (const fingerName of ARC_CAPTURE_FINGER_NAMES) {
        const tipPoint = normalizeArcPoint(sample.tips[fingerName]);
        if (!tipPoint) {
          continue;
        }
        points.push(tipPoint);
        frameHasPoint = true;
      }
      if (frameHasPoint) {
        frameCount += 1;
      }
      continue;
    }

    const fallbackPoint = normalizeArcPoint(sample);
    if (fallbackPoint) {
      points.push(fallbackPoint);
      frameCount += 1;
    }
  }

  return { points, frameCount };
}

function normalizeArcPoint(point) {
  if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v)) {
    return null;
  }
  return {
    u: point.u,
    v: point.v,
  };
}

function computeSpan(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  return Math.max(0, max - min);
}

function countDirectionalReversals(values, deadband = 0.0025) {
  if (!Array.isArray(values) || values.length < 3) {
    return 0;
  }
  let previousDirection = 0;
  let reversals = 0;
  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    const previous = values[index - 1];
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      continue;
    }
    const delta = current - previous;
    if (Math.abs(delta) < deadband) {
      continue;
    }
    const direction = delta > 0 ? 1 : -1;
    if (previousDirection !== 0 && direction !== previousDirection) {
      reversals += 1;
    }
    previousDirection = direction;
  }
  return reversals;
}

function quantile(values, q) {
  if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(q)) {
    return NaN;
  }
  if (values.length === 1) {
    return values[0];
  }
  const sorted = [...values].sort((a, b) => a - b);
  const normalizedQ = clamp(q, 0, 1);
  const position = normalizedQ * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
