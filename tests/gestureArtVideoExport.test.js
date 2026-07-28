import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GESTURE_ART_VIDEO_DURATION_MS,
  getGestureArtVideoExportCapability,
  selectGestureArtWebmType,
  startGestureArtCanvasRecording,
} from "../src/gestureArtVideoExport.js";

function createRecorderHarness({
  chunk = new Blob(["artwork-video"], { type: "video/webm" }),
} = {}) {
  let recorderInstance = null;

  class FakeMediaRecorder {
    static isTypeSupported(mimeType) {
      return mimeType === "video/webm;codecs=vp8";
    }

    constructor(stream, options) {
      this.listeners = new Map();
      this.mimeType = options.mimeType;
      this.options = options;
      this.state = "inactive";
      this.stream = stream;
      recorderInstance = this;
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
      this.listeners.get(type)?.delete(listener);
    }

    emit(type, event = {}) {
      for (const listener of [...(this.listeners.get(type) ?? [])]) {
        listener(event);
      }
    }

    start(timeslice) {
      this.timeslice = timeslice;
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.emit("dataavailable", { data: chunk });
      this.emit("stop");
    }
  }

  return {
    FakeMediaRecorder,
    get recorder() {
      return recorderInstance;
    },
  };
}

function createCanvasHarness() {
  let requestedFrameRate = null;
  let stopCount = 0;
  const stream = {
    getTracks() {
      return [
        {
          stop() {
            stopCount += 1;
          },
        },
      ];
    },
  };
  return {
    canvas: {
      captureStream(frameRate) {
        requestedFrameRate = frameRate;
        return stream;
      },
    },
    get requestedFrameRate() {
      return requestedFrameRate;
    },
    get stopCount() {
      return stopCount;
    },
  };
}

test("WebM negotiation prefers a supported codec and reports honest gaps", () => {
  class Vp8Recorder {
    static isTypeSupported(mimeType) {
      return mimeType.includes("vp8") || mimeType === "video/webm";
    }
  }

  assert.equal(
    selectGestureArtWebmType(Vp8Recorder),
    "video/webm;codecs=vp8",
  );
  assert.deepEqual(
    getGestureArtVideoExportCapability({
      canvas: {},
      MediaRecorderCtor: Vp8Recorder,
    }),
    {
      supported: false,
      reason: "canvas-stream-unavailable",
      mimeType: null,
    },
  );
  assert.deepEqual(
    getGestureArtVideoExportCapability({
      canvas: { captureStream() {} },
      MediaRecorderCtor: undefined,
    }),
    {
      supported: false,
      reason: "media-recorder-unavailable",
      mimeType: null,
    },
  );
  assert.equal(
    getGestureArtVideoExportCapability({
      canvas: { captureStream() {} },
      MediaRecorderCtor: class {
        static isTypeSupported() {
          return false;
        }
      },
    }).reason,
    "webm-unavailable",
  );
});

test("canvas recording is time-bounded, chunked, artwork-only, and cleans up tracks", async () => {
  const media = createRecorderHarness();
  const capture = createCanvasHarness();
  let scheduled = null;
  const cancelledTimers = [];

  const recording = startGestureArtCanvasRecording({
    canvas: capture.canvas,
    durationMs: GESTURE_ART_VIDEO_DURATION_MS * 2,
    frameRate: 120,
    MediaRecorderCtor: media.FakeMediaRecorder,
    schedule(callback, delay) {
      scheduled = { callback, delay };
      return 41;
    },
    cancelSchedule(timerId) {
      cancelledTimers.push(timerId);
    },
  });

  assert.equal(recording.durationMs, GESTURE_ART_VIDEO_DURATION_MS);
  assert.equal(scheduled.delay, GESTURE_ART_VIDEO_DURATION_MS);
  assert.equal(capture.requestedFrameRate, 30);
  assert.equal(media.recorder.timeslice, 1_000);
  assert.equal(media.recorder.options.videoBitsPerSecond, 3_000_000);

  scheduled.callback();
  const result = await recording.promise;

  assert.equal(result.mimeType, "video/webm;codecs=vp8");
  assert.equal(result.blob.type, "video/webm;codecs=vp8");
  assert.equal(await result.blob.text(), "artwork-video");
  assert.equal(capture.stopCount, 1);
  assert.deepEqual(cancelledTimers, [41]);
  assert.equal(media.recorder.stream === undefined, false);
});

test("cancelling a canvas recording rejects safely and ends capture tracks", async () => {
  const media = createRecorderHarness();
  const capture = createCanvasHarness();
  let timerId = 0;
  const cancelledTimers = [];

  const recording = startGestureArtCanvasRecording({
    canvas: capture.canvas,
    MediaRecorderCtor: media.FakeMediaRecorder,
    schedule() {
      timerId += 1;
      return timerId;
    },
    cancelSchedule(id) {
      cancelledTimers.push(id);
    },
  });

  recording.cancel();
  await assert.rejects(recording.promise, { code: "cancelled" });
  assert.equal(capture.stopCount, 1);
  assert.deepEqual(cancelledTimers, [1]);
});

test("the safe byte ceiling rejects oversized recordings and still cleans up", async () => {
  const media = createRecorderHarness({
    chunk: new Blob(["too-large"]),
  });
  const capture = createCanvasHarness();
  let finish;

  const recording = startGestureArtCanvasRecording({
    canvas: capture.canvas,
    maxBytes: 2,
    MediaRecorderCtor: media.FakeMediaRecorder,
    schedule(callback) {
      finish = callback;
      return 7;
    },
    cancelSchedule() {},
  });

  finish();
  await assert.rejects(recording.promise, { code: "size-limit" });
  assert.equal(capture.stopCount, 1);
});

test("Light Painting exposes a native, capability-gated video export with privacy copy", () => {
  const source = readFileSync(
    new URL("../src/components/GestureArtLab.jsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../src/gestureArtStudio.css", import.meta.url),
    "utf8",
  );

  assert.match(source, />\s*\{exportingVideo \? "Exporting video…" : "Export loop video"\}/);
  assert.match(source, /!videoExportCapability\.supported/);
  assert.match(source, /aria-live="polite"[\s\S]*?gesture-art-loop-status/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
  assert.match(
    source,
    /captures ten seconds of this artwork canvas only—never[\s\S]*?camera frames or audio\./,
  );
  assert.match(
    styles,
    /\.gesture-art-loop-controls \.gesture-art-video-export,[\s\S]*?grid-column: 1 \/ -1;/,
  );
});
