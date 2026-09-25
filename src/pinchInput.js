const PINCH_CLICK_LEFT_PANE_EXCLUDE_SELECTOR = ".camera-card";

export function shouldBypassGlobalPinchDebounce({ phase, fullscreenGridMode }) {
  return phase === "FULLSCREEN_CAMERA" && fullscreenGridMode === "flappy";
}

export function getPinchClickExcludeSelector({ phase }) {
  if (phase === "ROULETTE") {
    return `${PINCH_CLICK_LEFT_PANE_EXCLUDE_SELECTOR}, .roulette-panel`;
  }

  return PINCH_CLICK_LEFT_PANE_EXCLUDE_SELECTOR;
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
