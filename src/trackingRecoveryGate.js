export const TRACKING_LOSS_GRACE_MS = 500;
export const TRACKING_REACQUIRE_STABLE_MS = 3_000;

export const TRACKING_RECOVERY_PHASES = Object.freeze({
  CLEAR: "clear",
  LOSS_GRACE: "loss-grace",
  LOST: "lost",
  REACQUIRING: "reacquiring",
});

function normalizeNow(value, fallback = 0) {
  const resolved = Number.isFinite(value) ? value : fallback;
  return Math.max(fallback, resolved);
}

export function createTrackingRecoveryGate() {
  return {
    phase: TRACKING_RECOVERY_PHASES.CLEAR,
    missingSince: null,
    stableSince: null,
    updatedAt: 0,
  };
}

export function advanceTrackingRecoveryGate(
  state,
  {
    required = false,
    detected = false,
    now = 0,
    lossGraceMs = TRACKING_LOSS_GRACE_MS,
    stableMs = TRACKING_REACQUIRE_STABLE_MS,
  } = {},
) {
  const current = state?.phase ? state : createTrackingRecoveryGate();
  const timestamp = normalizeNow(now, current.updatedAt);
  const safeLossGraceMs = Math.max(
    0,
    Number.isFinite(lossGraceMs) ? lossGraceMs : TRACKING_LOSS_GRACE_MS,
  );
  const safeStableMs = Math.max(
    0,
    Number.isFinite(stableMs) ? stableMs : TRACKING_REACQUIRE_STABLE_MS,
  );

  if (!required) {
    return {
      ...createTrackingRecoveryGate(),
      updatedAt: timestamp,
    };
  }

  if (detected) {
    if (
      current.phase === TRACKING_RECOVERY_PHASES.CLEAR ||
      current.phase === TRACKING_RECOVERY_PHASES.LOSS_GRACE
    ) {
      return {
        ...createTrackingRecoveryGate(),
        updatedAt: timestamp,
      };
    }

    const stableSince =
      current.phase === TRACKING_RECOVERY_PHASES.REACQUIRING &&
      Number.isFinite(current.stableSince)
        ? current.stableSince
        : timestamp;
    if (timestamp - stableSince >= safeStableMs) {
      return {
        ...createTrackingRecoveryGate(),
        updatedAt: timestamp,
      };
    }
    return {
      phase: TRACKING_RECOVERY_PHASES.REACQUIRING,
      missingSince: null,
      stableSince,
      updatedAt: timestamp,
    };
  }

  if (
    current.phase === TRACKING_RECOVERY_PHASES.LOST ||
    current.phase === TRACKING_RECOVERY_PHASES.REACQUIRING
  ) {
    return {
      phase: TRACKING_RECOVERY_PHASES.LOST,
      missingSince:
        Number.isFinite(current.missingSince) ? current.missingSince : timestamp,
      stableSince: null,
      updatedAt: timestamp,
    };
  }

  const missingSince =
    current.phase === TRACKING_RECOVERY_PHASES.LOSS_GRACE &&
    Number.isFinite(current.missingSince)
      ? current.missingSince
      : timestamp;
  if (timestamp - missingSince >= safeLossGraceMs) {
    return {
      phase: TRACKING_RECOVERY_PHASES.LOST,
      missingSince,
      stableSince: null,
      updatedAt: timestamp,
    };
  }
  return {
    phase: TRACKING_RECOVERY_PHASES.LOSS_GRACE,
    missingSince,
    stableSince: null,
    updatedAt: timestamp,
  };
}

export function getTrackingRecoveryStatus(
  state,
  {
    now = state?.updatedAt ?? 0,
    stableMs = TRACKING_REACQUIRE_STABLE_MS,
  } = {},
) {
  const current = state?.phase ? state : createTrackingRecoveryGate();
  const timestamp = normalizeNow(now, current.updatedAt);
  const safeStableMs = Math.max(
    1,
    Number.isFinite(stableMs) ? stableMs : TRACKING_REACQUIRE_STABLE_MS,
  );
  const isReacquiring =
    current.phase === TRACKING_RECOVERY_PHASES.REACQUIRING;
  const stableElapsedMs =
    isReacquiring && Number.isFinite(current.stableSince)
      ? Math.max(0, timestamp - current.stableSince)
      : 0;
  const remainingMs = isReacquiring
    ? Math.max(0, safeStableMs - stableElapsedMs)
    : 0;

  return {
    phase: current.phase,
    shouldPause:
      current.phase === TRACKING_RECOVERY_PHASES.LOST || isReacquiring,
    isReacquiring,
    stableElapsedMs,
    remainingMs,
    progress: isReacquiring
      ? Math.min(1, stableElapsedMs / safeStableMs)
      : 0,
  };
}
