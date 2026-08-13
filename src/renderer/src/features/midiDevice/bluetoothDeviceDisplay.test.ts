import { describe, expect, test } from "vitest";
import {
  buildBluetoothDeviceDisplayItems,
  getBluetoothConnectedLabel,
} from "./bluetoothDeviceDisplay";

describe("buildBluetoothDeviceDisplayItems", () => {
  test("uses safe labels without exposing raw device IDs", () => {
    const items = buildBluetoothDeviceDisplayItems(
      [
        { deviceId: "secret-yamaha-1", deviceName: "Yamaha P-125" },
        { deviceId: "secret-yamaha-2", deviceName: "Yamaha P-125" },
        { deviceId: "private-unnamed", deviceName: "  " },
        { deviceId: "kawai-id", deviceName: "Kawai CA901" },
      ],
      "Unnamed Bluetooth device",
    );

    expect(items).toEqual([
      { deviceId: "secret-yamaha-1", label: "Yamaha P-125 (1)" },
      { deviceId: "secret-yamaha-2", label: "Yamaha P-125 (2)" },
      { deviceId: "private-unnamed", label: "Unnamed Bluetooth device" },
      { deviceId: "kawai-id", label: "Kawai CA901" },
    ]);
    expect(items.map((item) => item.label).join(" ")).not.toContain("secret-");
    expect(items.map((item) => item.label).join(" ")).not.toContain("private-");
    expect(items.map((item) => item.label).join(" ")).not.toContain("kawai-id");
  });
});

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
