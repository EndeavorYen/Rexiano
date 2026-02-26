import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import icon from "../../resources/icon.png?asset";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerMidiDeviceHandlers } from "./ipc/midiDeviceHandlers";

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
