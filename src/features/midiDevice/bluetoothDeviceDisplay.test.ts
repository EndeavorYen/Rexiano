import { describe, expect, test } from "vitest";
import { getBluetoothConnectedLabel } from "./bluetoothDeviceDisplay";

describe("getBluetoothConnectedLabel", () => {
  test("keeps Disconnect reachable when a connected device has no name", () => {
    expect(
      getBluetoothConnectedLabel(true, null, "Bluetooth MIDI device"),
    ).toBe("Bluetooth MIDI device");
    expect(
      getBluetoothConnectedLabel(true, "   ", "Bluetooth MIDI device"),
    ).toBe("Bluetooth MIDI device");
    expect(
      getBluetoothConnectedLabel(false, "Piano", "Bluetooth MIDI device"),
    ).toBeNull();
  });
});
