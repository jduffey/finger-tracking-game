export const FULLSCREEN_HOLD_CONTROL_MS = 1000;

export function normalizeFullscreenHoldDurationMs(value) {
  if (!Number.isFinite(value)) {
    return FULLSCREEN_HOLD_CONTROL_MS;
  }
  return Math.min(10_000, Math.max(0, value));
}
