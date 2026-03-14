import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldAcceptPinchClick,
  shouldBypassGlobalPinchDebounce,
} from "../src/pinchInput.js";

test("shouldBypassGlobalPinchDebounce only bypasses debounce for fullscreen flappy", () => {
  assert.equal(
    shouldBypassGlobalPinchDebounce({
      phase: "FULLSCREEN_CAMERA",
      fullscreenGridMode: "flappy",
    }),
    true,
  );

  assert.equal(
    shouldBypassGlobalPinchDebounce({
      phase: "FULLSCREEN_CAMERA",
      fullscreenGridMode: "breakout",
    }),
    false,
  );

  assert.equal(
    shouldBypassGlobalPinchDebounce({
      phase: "GAME",
      fullscreenGridMode: "flappy",
    }),
    false,
  );
});

test("shouldAcceptPinchClick keeps debounce for non-flappy rising edges", () => {
  assert.equal(
    shouldAcceptPinchClick({
      wasPinching: false,
      isPinching: true,
      timestamp: 1000,
      lastPinchClickAt: 900,
      debounceMs: 250,
    }),
    false,
  );

  assert.equal(
    shouldAcceptPinchClick({
      wasPinching: false,
      isPinching: true,
      timestamp: 1200,
      lastPinchClickAt: 900,
      debounceMs: 250,
    }),
    true,
  );
});

test("shouldAcceptPinchClick bypasses debounce for fullscreen flappy rising edges", () => {
  assert.equal(
    shouldAcceptPinchClick({
      wasPinching: false,
      isPinching: true,
      timestamp: 1000,
      lastPinchClickAt: 950,
      debounceMs: 250,
      bypassGlobalDebounce: true,
    }),
    true,
  );

  assert.equal(
    shouldAcceptPinchClick({
      wasPinching: true,
      isPinching: true,
      timestamp: 1000,
      lastPinchClickAt: 950,
      debounceMs: 250,
      bypassGlobalDebounce: true,
    }),
    false,
  );
});
