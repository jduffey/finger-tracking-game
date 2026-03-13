import test from "node:test";
import assert from "node:assert/strict";
import {
  CALIBRATION_STORAGE_KEY,
  clearCalibration,
  loadCalibration,
  saveCalibration,
} from "../src/calibration.js";

function withMockStorage(mockStorage, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: mockStorage,
  });

  try {
    return run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "localStorage", descriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
}

test("saveCalibration persists normalized affine models when storage is available", () => {
  let savedKey = null;
  let savedValue = null;

  withMockStorage(
    {
      getItem() {
        return null;
      },
      setItem(key, value) {
        savedKey = key;
        savedValue = value;
      },
      removeItem() {},
    },
    () => {
      saveCalibration({
        a1: 1,
        a2: 0,
        a3: 12,
        b1: 0,
        b2: 1,
        b3: 24,
      });
    },
  );

  assert.equal(savedKey, CALIBRATION_STORAGE_KEY);
  assert.deepEqual(JSON.parse(savedValue), {
    kind: "affine",
    a1: 1,
    a2: 0,
    a3: 12,
    b1: 0,
    b2: 1,
    b3: 24,
  });
});

test("saveCalibration swallows storage write failures", () => {
  withMockStorage(
    {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {},
    },
    () => {
      assert.doesNotThrow(() =>
        saveCalibration({
          a1: 1,
          a2: 0,
          a3: 12,
          b1: 0,
          b2: 1,
          b3: 24,
        }),
      );
    },
  );
});

test("clearCalibration swallows storage removal failures", () => {
  withMockStorage(
    {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {
        throw new Error("blocked");
      },
    },
    () => {
      assert.doesNotThrow(() => clearCalibration());
    },
  );
});

test("loadCalibration returns null when storage is unavailable", () => {
  withMockStorage(null, () => {
    assert.equal(loadCalibration(), null);
  });
});
