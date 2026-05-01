import { useCallback, useEffect, useRef, useState } from "react";
import {
  PINCH_GLOVE_DEVICE_NAME_PREFIX,
  PINCH_GLOVE_SERVICE_UUID,
  PINCH_GLOVE_TOUCH_CHARACTERISTIC_UUID,
  createPinchGloveD5State,
  formatRawBytes,
  isPinchGloveBluetoothAvailable,
  parsePinchGloveD5Value,
} from "./pinchGloveD5Input.js";

export function usePinchGloveD5Bluetooth({ logger = null } = {}) {
  const [state, setState] = useState(createPinchGloveD5State);
  const deviceRef = useRef(null);
  const characteristicRef = useRef(null);
  const notificationHandlerRef = useRef(null);
  const disconnectedHandlerRef = useRef(null);
  const intentionalDisconnectRef = useRef(false);

  const removeEventListeners = useCallback(() => {
    if (characteristicRef.current && notificationHandlerRef.current) {
      characteristicRef.current.removeEventListener(
        "characteristicvaluechanged",
        notificationHandlerRef.current,
      );
    }
    if (deviceRef.current && disconnectedHandlerRef.current) {
      deviceRef.current.removeEventListener(
        "gattserverdisconnected",
        disconnectedHandlerRef.current,
      );
    }
    notificationHandlerRef.current = null;
    disconnectedHandlerRef.current = null;
  }, []);

  const stopNotifications = useCallback(async () => {
    const characteristic = characteristicRef.current;
    if (!characteristic) {
      return;
    }

    try {
      await characteristic.stopNotifications?.();
    } catch (error) {
      logger?.warn("PinchGlove D5 notifications could not be stopped cleanly", {
        error,
      });
    }
  }, [logger]);

  const setConnectionError = useCallback(
    (message, data = {}) => {
      setState((previous) => ({
        ...previous,
        isConnecting: false,
        isConnected: false,
        error: message,
      }));
      logger?.warn("PinchGlove D5 connection error", {
        message,
        ...data,
      });
    },
    [logger],
  );

  const updateValue = useCallback(
    (value, source) => {
      let parsed;
      try {
        parsed = parsePinchGloveD5Value(value);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "PinchGlove D5 value could not be parsed.";
        setState((previous) => ({
          ...previous,
          error: message,
        }));
        logger?.warn("PinchGlove D5 value parse failed", {
          source,
          error: message,
        });
        return;
      }

      const lastEventAt = new Date().toLocaleTimeString();
      setState((previous) => ({
        ...previous,
        d5Active: parsed.d5Active,
        bitmask: parsed.bitmask,
        rawBytes: parsed.bytes,
        rawHex: parsed.rawHex,
        lastEventAt,
        error: "",
      }));

      logger?.info("PinchGlove D5 value received", {
        source,
        d5Active: parsed.d5Active,
        bitmask: parsed.bitmask,
        rawHex: parsed.rawHex,
        rawBytes: formatRawBytes(parsed.bytes),
      });
    },
    [logger],
  );

  const handleDeviceDisconnected = useCallback(() => {
    const wasIntentional = intentionalDisconnectRef.current;
    const deviceName = deviceRef.current?.name ?? "";
    removeEventListeners();
    characteristicRef.current = null;
    deviceRef.current = null;
    intentionalDisconnectRef.current = false;

    setState((previous) => ({
      ...previous,
      isConnecting: false,
      isConnected: false,
      d5Active: false,
      deviceName: previous.deviceName || deviceName,
      error: wasIntentional ? "" : "PinchGlove disconnected. Click Connect D5 to reconnect.",
    }));

    logger?.info("PinchGlove D5 device disconnected", {
      deviceName,
      intentional: wasIntentional,
    });
  }, [logger, removeEventListeners]);

  const connect = useCallback(async () => {
    if (!isPinchGloveBluetoothAvailable()) {
      setConnectionError(
        "Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop for D5 input.",
      );
      return;
    }

    intentionalDisconnectRef.current = false;
    setState((previous) => ({
      ...previous,
      isSupported: true,
      isConnecting: true,
      error: "",
    }));

    let device;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: PINCH_GLOVE_DEVICE_NAME_PREFIX }],
        optionalServices: [PINCH_GLOVE_SERVICE_UUID],
      });
    } catch (error) {
      const message =
        error?.name === "NotFoundError"
          ? "Bluetooth device picker was cancelled. Click Connect D5 when you are ready to try again."
          : `Bluetooth device picker failed: ${error?.message ?? String(error)}`;
      setConnectionError(message, { error });
      return;
    }

    deviceRef.current = device;
    disconnectedHandlerRef.current = handleDeviceDisconnected;
    device.addEventListener("gattserverdisconnected", disconnectedHandlerRef.current);

    setState((previous) => ({
      ...previous,
      deviceName: device.name || "Unnamed PinchGlove",
    }));

    let server;
    try {
      server = await device.gatt?.connect();
    } catch (error) {
      removeEventListeners();
      deviceRef.current = null;
      setConnectionError(
        "Device was selected, but the GATT connection failed. Power-cycle the Feather or toggle Bluetooth, then try again.",
        { error },
      );
      return;
    }

    if (!server) {
      removeEventListeners();
      deviceRef.current = null;
      setConnectionError("Device was selected, but the browser did not return a GATT server.");
      return;
    }

    let service;
    try {
      service = await server.getPrimaryService(PINCH_GLOVE_SERVICE_UUID);
    } catch (error) {
      removeEventListeners();
      device.gatt?.disconnect();
      deviceRef.current = null;
      setConnectionError(
        `PinchGlove service not found (${PINCH_GLOVE_SERVICE_UUID}). Make sure the Feather is running the BLE firmware.`,
        { error },
      );
      return;
    }

    let characteristic;
    try {
      characteristic = await service.getCharacteristic(PINCH_GLOVE_TOUCH_CHARACTERISTIC_UUID);
    } catch (error) {
      removeEventListeners();
      device.gatt?.disconnect();
      deviceRef.current = null;
      setConnectionError(
        `Touch characteristic not found (${PINCH_GLOVE_TOUCH_CHARACTERISTIC_UUID}). Check the firmware characteristic UUID.`,
        { error },
      );
      return;
    }

    characteristicRef.current = characteristic;
    const canNotify = Boolean(characteristic.properties?.notify || characteristic.properties?.indicate);
    if (!canNotify || typeof characteristic.startNotifications !== "function") {
      removeEventListeners();
      device.gatt?.disconnect();
      deviceRef.current = null;
      characteristicRef.current = null;
      setConnectionError(
        "Touch characteristic is readable but does not support notifications. Rebuild the firmware with notify enabled.",
      );
      return;
    }

    try {
      const initialValue = await characteristic.readValue();
      updateValue(initialValue, "ble-initial-read");
    } catch (error) {
      logger?.warn("PinchGlove D5 initial read failed; continuing with notifications", {
        error,
      });
    }

    const handleNotification = (event) => {
      updateValue(event.target.value, "ble-notification");
    };
    notificationHandlerRef.current = handleNotification;
    characteristic.addEventListener("characteristicvaluechanged", handleNotification);

    try {
      await characteristic.startNotifications();
    } catch (error) {
      removeEventListeners();
      characteristicRef.current = null;
      device.gatt?.disconnect();
      deviceRef.current = null;
      setConnectionError(
        "Notifications are not available for the touch characteristic. Check that the firmware exposes notify on the characteristic.",
        { error },
      );
      return;
    }

    setState((previous) => ({
      ...previous,
      isConnecting: false,
      isConnected: true,
      deviceName: device.name || previous.deviceName || "Unnamed PinchGlove",
      error: "",
    }));

    logger?.info("PinchGlove D5 connected", {
      deviceName: device.name || "Unnamed PinchGlove",
      serviceUuid: PINCH_GLOVE_SERVICE_UUID,
      characteristicUuid: PINCH_GLOVE_TOUCH_CHARACTERISTIC_UUID,
    });
  }, [
    handleDeviceDisconnected,
    logger,
    removeEventListeners,
    setConnectionError,
    updateValue,
  ]);

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    await stopNotifications();
    removeEventListeners();
    const device = deviceRef.current;
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
    characteristicRef.current = null;
    deviceRef.current = null;
    intentionalDisconnectRef.current = false;
    setState((previous) => ({
      ...previous,
      isConnecting: false,
      isConnected: false,
      d5Active: false,
      error: "",
    }));
    logger?.info("PinchGlove D5 disconnected by user");
  }, [logger, removeEventListeners, stopNotifications]);

  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      void stopNotifications();
      removeEventListeners();
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
      characteristicRef.current = null;
      deviceRef.current = null;
    };
  }, [removeEventListeners, stopNotifications]);

  return {
    state,
    connect,
    disconnect,
  };
}
