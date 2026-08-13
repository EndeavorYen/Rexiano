import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { pathToFileURL } from "url";
import icon from "../../docs/figure/Rexiano_icon.png?asset";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerMidiDeviceHandlers } from "./ipc/midiDeviceHandlers";
import { registerProgressHandlers } from "./ipc/progressHandlers";
import { registerRecentFilesHandlers } from "./ipc/recentFilesHandlers";
import { registerAppInfoHandlers } from "./ipc/appInfoHandlers";
import { registerUserDataBackupHandlers } from "./ipc/userDataBackupHandlers";
import { registerWatchedFolderHandlers } from "./ipc/watchedFolderHandlers";
import { registerUpdateHandlers } from "./ipc/updateHandlers";
import { normalizeExternalUrl } from "./externalUrlPolicy";
import { bluetoothDeviceSelectionRegistry } from "./ipc/bluetoothDeviceSelection";
import { configureTrustedRendererUrl } from "./ipc/midiPermissionPolicy";

// WSL2 doesn't forward Windows display scaling to X11/Wayland,
// so Electron defaults to devicePixelRatio=1. Force the correct factor.
if (process.env.WSL_DISTRO_NAME) {
  app.commandLine.appendSwitch("force-device-scale-factor", "1.5");
}

if (process.env.REXIANO_USER_DATA_DIR) {
  app.setPath("userData", process.env.REXIANO_USER_DATA_DIR);
}

function createWindow(): void {
  const rendererEntryPath = join(__dirname, "../renderer/index.html");
  const developmentRendererUrl = process.env["ELECTRON_RENDERER_URL"];
  const rendererUrl =
    !app.isPackaged && developmentRendererUrl
      ? developmentRendererUrl
      : pathToFileURL(rendererEntryPath).href;
  configureTrustedRendererUrl(rendererUrl);

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
    const externalUrl = normalizeExternalUrl(details.url);
    if (externalUrl) {
      void shell.openExternal(externalUrl);
    }
    return { action: "deny" };
  });

  bluetoothDeviceSelectionRegistry.attachWindow(mainWindow);

  // HMR for renderer based on electron-vite cli
  if (!app.isPackaged && developmentRendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(rendererEntryPath);
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.rexiano");

  registerFileHandlers();
  registerMidiDeviceHandlers();
  registerProgressHandlers();
  registerRecentFilesHandlers();
  registerUserDataBackupHandlers();
  registerWatchedFolderHandlers();
  registerAppInfoHandlers();
  registerUpdateHandlers();

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
