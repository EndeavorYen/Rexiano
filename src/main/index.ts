/**
 * Main process entry point — creates the BrowserWindow, registers IPC handlers,
 * and manages Bluetooth device auto-selection for MIDI piano input.
 */
import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import icon from "../../docs/figure/Rexiano_icon.png?asset";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerMidiDeviceHandlers } from "./ipc/midiDeviceHandlers";
import { registerProgressHandlers } from "./ipc/progressHandlers";
import { registerRecentFilesHandlers } from "./ipc/recentFilesHandlers";
import { registerAppInfoHandlers } from "./ipc/appInfoHandlers";

// WSL2 doesn't forward Windows display scaling to X11/Wayland,
// so Electron defaults to devicePixelRatio=1. Force the correct factor.
if (process.env.WSL_DISTRO_NAME) {
  app.commandLine.appendSwitch("force-device-scale-factor", "1.5");
}

// Enable Chrome DevTools Protocol for external debugging tools (e.g. CDP CLI).
// Only in dev mode to avoid exposing debug port in production.
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      // sandbox: false required because electron-vite preload bundling
      // uses Node.js module resolution within the preload script.
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
      // Cancel stale callback from a previous scan to prevent Chromium resource leak
      if (pendingBluetoothCallback && pendingBluetoothCallback !== callback) {
        pendingBluetoothCallback("");
      }
      pendingBluetoothCallback = callback;

      if (devices.length === 0) return; // Keep waiting

      // Only auto-select devices with a recognizable name.
      // Skip unnamed devices — they're likely nearby phones or peripherals.
      const keywords = ["roland", "hp-", "hp7", "fp-", "piano", "midi"];
      const preferred = devices.find(
        (d) =>
          d.deviceName &&
          keywords.some((k) => d.deviceName!.toLowerCase().includes(k)),
      );

      if (preferred) {
        callback(preferred.deviceId);
        pendingBluetoothCallback = null;
        return;
      }

      // No preferred device yet — keep waiting for a piano to appear
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
  registerAppInfoHandlers();

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
