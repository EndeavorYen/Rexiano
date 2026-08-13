import { app, shell, BrowserWindow, ipcMain } from "electron";
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
import { IpcChannels } from "../shared/types";
import { approveMidiFilePath } from "./ipc/midiPathAccess";
import {
  AssociatedMidiFileOpenQueue,
  findAssociatedMidiArgument,
} from "./associatedMidiFileOpen";
import {
  createSecureRendererPreferences,
  installRendererNavigationGuard,
} from "./rendererWindowSecurity";
import { requireTrustedMainFrame } from "./ipc/trustedIpc";

// WSL2 doesn't forward Windows display scaling to X11/Wayland,
// so Electron defaults to devicePixelRatio=1. Force the correct factor.
if (process.env.WSL_DISTRO_NAME) {
  app.commandLine.appendSwitch("force-device-scale-factor", "1.5");
}

if (process.env.REXIANO_USER_DATA_DIR) {
  app.setPath("userData", process.env.REXIANO_USER_DATA_DIR);
}

let mainWindow: BrowserWindow | null = null;

const associatedMidiFiles = new AssociatedMidiFileOpenQueue(
  async (candidate) => {
    await app.whenReady();
    return approveMidiFilePath(candidate);
  },
);

async function queueAssociatedMidiFile(candidate: string): Promise<void> {
  if (!(await associatedMidiFiles.enqueue(candidate))) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannels.ASSOCIATED_MIDI_FILE_PENDING);
  }
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow(): BrowserWindow {
  const rendererEntryPath = join(__dirname, "../renderer/index.html");
  const developmentRendererUrl = process.env["ELECTRON_RENDERER_URL"];
  const rendererUrl =
    !app.isPackaged && developmentRendererUrl
      ? developmentRendererUrl
      : pathToFileURL(rendererEntryPath).href;
  configureTrustedRendererUrl(rendererUrl);

  const createdWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: createSecureRendererPreferences(
      join(__dirname, "../preload/index.js"),
    ),
  });

  mainWindow = createdWindow;

  createdWindow.on("ready-to-show", () => {
    createdWindow.show();
  });

  createdWindow.on("closed", () => {
    if (mainWindow === createdWindow) mainWindow = null;
  });

  createdWindow.webContents.setWindowOpenHandler((details) => {
    const externalUrl = normalizeExternalUrl(details.url);
    if (externalUrl) {
      void shell.openExternal(externalUrl);
    }
    return { action: "deny" };
  });
  installRendererNavigationGuard(createdWindow.webContents);

  bluetoothDeviceSelectionRegistry.attachWindow(createdWindow);

  // HMR for renderer based on electron-vite cli
  if (!app.isPackaged && developmentRendererUrl) {
    void createdWindow.loadURL(rendererUrl);
  } else {
    void createdWindow.loadFile(rendererEntryPath);
  }
  return createdWindow;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    void queueAssociatedMidiFile(filePath);
  });

  app.on("second-instance", (_event, commandLine) => {
    focusMainWindow();
    const filePath = findAssociatedMidiArgument(commandLine);
    if (filePath) void queueAssociatedMidiFile(filePath);
  });

  void app.whenReady().then(() => {
    app.setAppUserModelId("com.rexiano");

    registerFileHandlers();
    registerMidiDeviceHandlers();
    registerProgressHandlers();
    registerRecentFilesHandlers();
    registerUserDataBackupHandlers();
    registerWatchedFolderHandlers();
    registerAppInfoHandlers();
    registerUpdateHandlers();
    ipcMain.handle(IpcChannels.TAKE_PENDING_ASSOCIATED_MIDI_FILE, (event) => {
      requireTrustedMainFrame(event);
      return associatedMidiFiles.take();
    });

    createWindow();
    const coldStartFilePath = findAssociatedMidiArgument(process.argv);
    if (coldStartFilePath) void queueAssociatedMidiFile(coldStartFilePath);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
