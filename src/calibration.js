import { createScopedLogger } from "./logger";

export const CALIBRATION_STORAGE_KEY = "fingerWhack.calibration.v1";
const calibrationLog = createScopedLogger("calibration");

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
    const valid = isValidTransform(parsed);
    calibrationLog.info("Loaded calibration payload", {
      valid,
      parsed,
    });
    return valid ? parsed : null;
  } catch (error) {
    calibrationLog.error("Failed to load calibration from localStorage", {
      error,
    });
    return null;
  }
}

export function saveCalibration(transform) {
  calibrationLog.info("Saving calibration to localStorage", { transform });
  if (!isValidTransform(transform)) {
    calibrationLog.warn("Skipped saving invalid calibration transform", { transform });
    return;
  }
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(transform));
  calibrationLog.info("Calibration saved");
}

export function clearCalibration() {
  calibrationLog.info("Clearing calibration from localStorage");
  localStorage.removeItem(CALIBRATION_STORAGE_KEY);
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
