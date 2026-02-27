import { ipcMain, session } from "electron";
import { IpcChannels, type MidiDeviceInfo } from "../../shared/types";

export function registerMidiDeviceHandlers(): void {
  // Auto-approve MIDI permission requests from Chromium.
  // When the renderer calls navigator.requestMIDIAccess(), Chromium fires a
  // permission request through the session — we grant it here so no
  // user-facing prompt appears.
  // Allowed permissions: MIDI (wired) + Bluetooth (BLE MIDI).
  // Chromium sends "bluetooth" at runtime but Electron's TS types don't
  // include it in the permission union, so we cast to string for the check.
  const allowedPermissions: string[] = ["midi", "midiSysex", "bluetooth"];

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(allowedPermissions.includes(permission));
    },
  );

  // Confirm MIDI access is available. The renderer calls this before
  // navigator.requestMIDIAccess() to ensure the main process has already
  // configured permission approval.
  ipcMain.handle(
    IpcChannels.MIDI_REQUEST_ACCESS,
    async (): Promise<boolean> => {
      return true;
    },
  );

  // Device enumeration happens entirely in the renderer via the Web MIDI API.
  // This handler exists so the IPC channel contract is fulfilled; it returns
  // an empty array because the renderer's MidiDeviceManager is the real source
  // of truth for connected devices.
  ipcMain.handle(
    IpcChannels.MIDI_DEVICE_LIST,
    async (): Promise<MidiDeviceInfo[]> => {
      return [];
    },
  );
}
