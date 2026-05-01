import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBitmaskHex,
  formatRawBytes,
  parsePinchGloveD5Value,
} from "../src/pinchGloveD5Input.js";

test("parsePinchGloveD5Value treats byte 0 bit 0 as the D5 contact", () => {
  assert.deepEqual(parsePinchGloveD5Value(0), {
    bitmask: 0,
    bytes: [0],
    d5Active: false,
    rawHex: "0x000000",
  });

  assert.deepEqual(parsePinchGloveD5Value(1), {
    bitmask: 1,
    bytes: [1],
    d5Active: true,
    rawHex: "0x000001",
  });
});

test("parsePinchGloveD5Value ignores other active pins for D5", () => {
  const parsed = parsePinchGloveD5Value(new Uint8Array([0b00000110, 0, 0]));

  assert.equal(parsed.bitmask, 6);
  assert.equal(parsed.d5Active, false);
});

test("parsePinchGloveD5Value accepts the three-byte little-endian bitmask from the Feather", () => {
  const parsed = parsePinchGloveD5Value(new DataView(new Uint8Array([1, 2, 4]).buffer));

  assert.equal(parsed.bitmask, 0x040201);
  assert.equal(parsed.d5Active, true);
  assert.equal(parsed.rawHex, "0x040201");
});

test("parsePinchGloveD5Value rejects empty values", () => {
  assert.throws(() => parsePinchGloveD5Value(new Uint8Array([])), /empty value/);
});

test("format helpers keep BLE diagnostics compact", () => {
  assert.equal(formatBitmaskHex(15), "0x00000F");
  assert.equal(formatRawBytes([0, 1, 255]), "00 01 FF");
});
