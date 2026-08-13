import { describe, expect, test } from "vitest";
import {
  configureTrustedRendererUrl,
  isAllowedMidiPermissionRequest,
  isAllowedBluetoothDevicePermission,
} from "./midiPermissionPolicy";

describe("midiPermissionPolicy", () => {
  test("allows MIDI and Bluetooth permissions from Rexiano renderer origins", () => {
    configureTrustedRendererUrl(
      "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
    );
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midi",
        url: "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
      }),
    ).toBe(true);
    configureTrustedRendererUrl("http://localhost:5173/");
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midiSysex",
        url: "http://localhost:5173/",
      }),
    ).toBe(true);
    configureTrustedRendererUrl("http://127.0.0.1:5173/");
    expect(
      isAllowedMidiPermissionRequest({
        permission: "bluetooth",
        url: "http://127.0.0.1:5173/",
      }),
    ).toBe(true);
  });

  test("rejects permissions from untrusted origins or unsupported permission names", () => {
    configureTrustedRendererUrl(
      "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
    );
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
    configureTrustedRendererUrl(
      "file:///Applications/Rexiano.app/Contents/Resources/app.asar/out/renderer/index.html",
    );
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

  test("uses the exact packaged entry and canonicalizes query and hash", () => {
    configureTrustedRendererUrl(
      "file:///Applications/Rexiano%20Studio.app/Contents/Resources/app.asar/out/renderer/index.html",
    );

    expect(
      isAllowedMidiPermissionRequest({
        permission: "midi",
        url: "file:///Applications/Rexiano%20Studio.app/Contents/Resources/app.asar/out/renderer/index.html?source=launch#library",
      }),
    ).toBe(true);
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midi",
        url: "file:///tmp/out/renderer/index.html",
      }),
    ).toBe(false);
  });

  test("uses only the configured development server origin", () => {
    configureTrustedRendererUrl("http://localhost:5173/");

    expect(
      isAllowedMidiPermissionRequest({
        permission: "midiSysex",
        url: "http://localhost:5173/song/1?debug=true",
      }),
    ).toBe(true);
    expect(
      isAllowedMidiPermissionRequest({
        permission: "midiSysex",
        url: "http://localhost:9999/",
      }),
    ).toBe(false);
  });
});
