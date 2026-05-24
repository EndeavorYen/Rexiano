import { describe, expect, test } from "vitest";
import {
  isAllowedMidiPermissionRequest,
  isAllowedBluetoothDevicePermission,
} from "./midiPermissionPolicy";

describe("midiPermissionPolicy", () => {
  test("allows MIDI and Bluetooth permissions from Rexiano renderer origins", () => {
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midi",
        url: "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
      }),
    ).toBe(true);
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midiSysex",
        url: "http://localhost:5173/",
      }),
    ).toBe(true);
    expect(
      isAllowedMidiPermissionRequest({
        permission: "bluetooth",
        url: "http://127.0.0.1:5173/",
      }),
    ).toBe(true);
  });

  test("rejects permissions from untrusted origins or unsupported permission names", () => {
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midi",
        url: "https://example.com/",
      }),
    ).toBe(false);
    expect(
      isAllowedMidiPermissionRequest({
        permission: "media",
        url: "file:///Applications/Rexiano.app/index.html",
      }),
    ).toBe(false);
  });

  test("allows Bluetooth device permissions only for trusted origins", () => {
    expect(
      isAllowedBluetoothDevicePermission({
        deviceType: "bluetooth",
        origin: "file://",
      }),
    ).toBe(true);
    expect(
      isAllowedBluetoothDevicePermission({
        deviceType: "bluetooth",
        origin: "https://example.com",
      }),
    ).toBe(false);
    expect(
      isAllowedBluetoothDevicePermission({
        deviceType: "hid",
        origin: "file://",
      }),
    ).toBe(false);
  });
});
