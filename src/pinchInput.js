export function shouldBypassGlobalPinchDebounce({ phase, fullscreenGridMode }) {
  return phase === "FULLSCREEN_CAMERA" && fullscreenGridMode === "flappy";
}

export function shouldAcceptPinchClick({
  wasPinching,
  isPinching,
  timestamp,
  lastPinchClickAt,
  debounceMs,
  bypassGlobalDebounce = false,
}) {
  if (wasPinching || !isPinching) {
    return false;
  }

  return bypassGlobalDebounce || timestamp - lastPinchClickAt >= debounceMs;
}
