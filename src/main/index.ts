import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import icon from "../../resources/icon.png?asset";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerMidiDeviceHandlers } from "./ipc/midiDeviceHandlers";
import { registerProgressHandlers } from "./ipc/progressHandlers";
import { registerRecentFilesHandlers } from "./ipc/recentFilesHandlers";

// WSL2 doesn't forward Windows display scaling to X11/Wayland,
// so Electron defaults to devicePixelRatio=1. Force the correct factor.
if (process.env.WSL_DISTRO_NAME) {
  app.commandLine.appendSwitch("force-device-scale-factor", "1.5");
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // ─── Web Bluetooth: auto-select first BLE MIDI device ──────────
  // When renderer calls navigator.bluetooth.requestDevice(), Electron fires
  // this event repeatedly as BLE scanning discovers devices. We store the
  // callback and auto-select the first matching device once discovered.
  // The renderer already filters by BLE MIDI service UUID so all devices
  // in the list are BLE MIDI devices.
  let pendingBluetoothCallback: ((deviceId: string) => void) | null = null;

  mainWindow.webContents.on(
    "select-bluetooth-device",
    (event, devices, callback) => {
      event.preventDefault();
      // Store the callback for later if no devices found yet
      pendingBluetoothCallback = callback;

      console.log(
        `[BLE] select-bluetooth-device: ${devices.length} device(s)`,
        devices.map((d) => `${d.deviceName} (${d.deviceId})`),
      );

      if (devices.length === 0) return; // Keep waiting

      // Prefer a device whose name contains "Roland", "HP", "FP", "Piano",
      // or "MIDI" — otherwise fall back to the first device with a name.
      const keywords = ["roland", "hp-", "fp-", "piano", "midi"];
      const preferred = devices.find((d) =>
        keywords.some((k) => d.deviceName?.toLowerCase().includes(k)),
      );
      const named = devices.find((d) => d.deviceName && d.deviceName !== "");
      const pick = preferred ?? named ?? devices[0];

      console.log(`[BLE] Auto-selecting: ${pick.deviceName} (${pick.deviceId})`);
      callback(pick.deviceId);
      pendingBluetoothCallback = null;
    },
  );

  // Cancel pending Bluetooth scan if the window is closed
  mainWindow.on("closed", () => {
    if (pendingBluetoothCallback) {
      pendingBluetoothCallback("");
      pendingBluetoothCallback = null;
    }
  });

  // HMR for renderer based on electron-vite cli
  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.rexiano");

  registerFileHandlers();
  registerMidiDeviceHandlers();
  registerProgressHandlers();
  registerRecentFilesHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
