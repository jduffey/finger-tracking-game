export const PINCH_GLOVE_DEVICE_NAME_PREFIX = "PinchGlove";
export const PINCH_GLOVE_SERVICE_UUID = "7e57a000-3d8a-4f9b-9a5d-5b6f4d2a0001";
export const PINCH_GLOVE_TOUCH_CHARACTERISTIC_UUID =
  "7e57a001-3d8a-4f9b-9a5d-5b6f4d2a0001";

export const PINCH_GLOVE_D5_BIT_INDEX = 0;
export const PINCH_GLOVE_D5_BIT_MASK = 1 << PINCH_GLOVE_D5_BIT_INDEX;

export function isPinchGloveBluetoothAvailable(globalNavigator = globalThis.navigator) {
  return Boolean(globalNavigator?.bluetooth?.requestDevice);
}

export function createPinchGloveD5State() {
  return {
    isSupported: isPinchGloveBluetoothAvailable(),
    isConnecting: false,
    isConnected: false,
    deviceName: "",
    d5Active: false,
    bitmask: 0,
    rawBytes: [],
    rawHex: "0x000000",
    lastEventAt: "",
    error: "",
  };
}

export function parsePinchGloveD5Value(value) {
  const bytes = coerceBytes(value);
  if (bytes.length === 0) {
    throw new Error("PinchGlove touch characteristic returned an empty value.");
  }

  const bitmask = bytes.slice(0, 3).reduce((mask, byte, index) => {
    return mask | (byte << (index * 8));
  }, 0);

  return {
    bitmask,
    bytes,
    d5Active: (bitmask & PINCH_GLOVE_D5_BIT_MASK) !== 0,
    rawHex: formatBitmaskHex(bitmask),
  };
}

export function formatBitmaskHex(bitmask) {
  const normalized = Number.isFinite(bitmask) ? bitmask >>> 0 : 0;
  return `0x${normalized.toString(16).toUpperCase().padStart(6, "0")}`;
}

export function formatRawBytes(bytes) {
  return bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

function coerceBytes(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("PinchGlove touch characteristic returned a non-finite number.");
    }
    return [value & 0xff];
  }

  if (value instanceof DataView) {
    return Array.from({ length: value.byteLength }, (_, index) => value.getUint8(index));
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }

  throw new Error("PinchGlove touch characteristic returned an unsupported value type.");
}
