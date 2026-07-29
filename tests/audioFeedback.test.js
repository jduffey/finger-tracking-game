import test from "node:test";
import assert from "node:assert/strict";

import {
  createAudioFeedback,
  getAudioCuePlan,
} from "../src/audioFeedback.js";

function createAudioParam() {
  return {
    value: 0,
    events: [],
    setValueAtTime(value, time) {
      this.value = value;
      this.events.push(["set", value, time]);
    },
    linearRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push(["linear", value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push(["exponential", value, time]);
    },
  };
}

function createFakeAudioContext() {
  const oscillators = [];
  const gains = [];
  const context = {
    currentTime: 2,
    destination: { kind: "destination" },
    state: "suspended",
    resumed: false,
    closed: false,
    createGain() {
      const node = {
        gain: createAudioParam(),
        connections: [],
        connect(target) {
          this.connections.push(target);
        },
        disconnect() {},
      };
      gains.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        frequency: createAudioParam(),
        type: "sine",
        connections: [],
        connect(target) {
          this.connections.push(target);
        },
        disconnect() {},
        start(time) {
          this.startedAt = time;
        },
        stop(time) {
          this.stoppedAt = time;
        },
      };
      oscillators.push(node);
      return node;
    },
    resume() {
      this.state = "running";
      this.resumed = true;
      return Promise.resolve();
    },
    close() {
      this.state = "closed";
      this.closed = true;
      return Promise.resolve();
    },
    gains,
    oscillators,
  };
  return context;
}

test("cue plans expose distinct effects and a dedicated music bus", () => {
  assert.equal(getAudioCuePlan("success").length, 3);
  assert.equal(getAudioCuePlan("music-preview")[0].bus, "music");
  assert.deepEqual(getAudioCuePlan("unknown"), []);
});

test("low-sensory plans soften and simplify layered cues", () => {
  const standard = getAudioCuePlan("success");
  const gentle = getAudioCuePlan("success", { lowSensory: true });

  assert.equal(gentle.length, 1);
  assert.ok(gentle[0].gain < standard[0].gain);
  assert.equal(gentle[0].type, "sine");
});

test("the audio context is only created on explicit unlock", () => {
  let factoryCalls = 0;
  const context = createFakeAudioContext();
  const audio = createAudioFeedback({
    audioContextFactory: () => {
      factoryCalls += 1;
      return context;
    },
  });

  assert.equal(audio.play("select"), false);
  assert.equal(factoryCalls, 0);
  assert.equal(audio.unlock(), true);
  assert.equal(factoryCalls, 1);
  assert.equal(context.resumed, true);
});

test("preferences govern master, music, and effects buses", () => {
  const context = createFakeAudioContext();
  const audio = createAudioFeedback({
    audioContextFactory: () => context,
  });
  audio.configure({
    masterVolume: 0.5,
    musicVolume: 0.25,
    effectsVolume: 0.75,
  });
  audio.unlock();

  assert.equal(context.gains[0].gain.value, 0.5);
  assert.equal(context.gains[1].gain.value, 0.75);
  assert.equal(context.gains[2].gain.value, 0.25);
  assert.equal(audio.play("pickup"), true);
  assert.equal(audio.play("music-preview"), true);
  assert.equal(context.oscillators.length, 4);

  audio.configure({
    muted: true,
    masterVolume: 1,
    musicVolume: 1,
    effectsVolume: 1,
  });
  assert.equal(context.gains[0].gain.value, 0);
  assert.equal(audio.play("success"), false);
});

test("dispose is idempotent and prevents future playback", () => {
  const context = createFakeAudioContext();
  const audio = createAudioFeedback({
    audioContextFactory: () => context,
  });
  audio.unlock();
  audio.dispose();
  audio.dispose();

  assert.equal(context.closed, true);
  assert.equal(audio.getState().disposed, true);
  assert.equal(audio.play("select"), false);
  assert.equal(audio.unlock(), false);
});

