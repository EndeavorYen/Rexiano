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
