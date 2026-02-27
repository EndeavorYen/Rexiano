import { ipcMain, dialog, BrowserWindow, app } from "electron";
import { readFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { existsSync } from "fs";
import {
  IpcChannels,
  type MidiFileResult,
  type SoundFontResult,
  type BuiltinSongMeta,
} from "../../shared/types";

export function registerFileHandlers(): void {
  ipcMain.handle(
    IpcChannels.OPEN_MIDI_FILE,
    async (): Promise<MidiFileResult | null> => {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return null;

      const result = await dialog.showOpenDialog(window, {
        title: "Open MIDI File",
        filters: [{ name: "MIDI Files", extensions: ["mid", "midi"] }],
        properties: ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) return null;

      const filePath = result.filePaths[0];
      const buffer = await readFile(filePath);

      return {
        fileName: basename(filePath),
        data: Array.from(buffer),
        path: filePath,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.LOAD_SOUNDFONT,
    async (_event, fileName?: string): Promise<SoundFontResult | null> => {
      const sfName = fileName ?? "default.sf2";

      // Look in resources/ directory (packaged or dev)
      const resourcesDir = app.isPackaged
        ? join(process.resourcesPath, "resources")
        : join(app.getAppPath(), "resources");

      // Prevent path traversal: resolve and verify the path stays within resourcesDir
      const sfPath = resolve(resourcesDir, sfName);
      if (!sfPath.startsWith(resolve(resourcesDir))) {
        console.warn(`SoundFont path traversal blocked: ${sfName}`);
        return null;
      }

      if (!existsSync(sfPath)) {
        console.warn(`SoundFont not found: ${sfPath}`);
        return null;
      }

      const buffer = await readFile(sfPath);
      return {
        data: Array.from(buffer),
        fileName: sfName,
      };
    },
  );

  // ─── Direct MIDI path loading (for recent files) ─────────

  ipcMain.handle(
    IpcChannels.LOAD_MIDI_PATH,
    async (_event, filePath: string): Promise<MidiFileResult | null> => {
      if (typeof filePath !== "string" || filePath.length === 0) return null;
      if (!existsSync(filePath)) return null;

      // Only allow .mid/.midi files
      const lower = filePath.toLowerCase();
      if (!lower.endsWith(".mid") && !lower.endsWith(".midi")) return null;

      const buffer = await readFile(filePath);
      return {
        fileName: basename(filePath),
        data: Array.from(buffer),
        path: filePath,
      };
    },
  );

  // ─── Song Library ──────────────────────────────────────

  ipcMain.handle(
    IpcChannels.LIST_BUILTIN_SONGS,
    async (): Promise<BuiltinSongMeta[]> => {
      const resourcesDir = app.isPackaged
        ? join(process.resourcesPath, "resources")
        : join(app.getAppPath(), "resources");

      const manifestPath = join(resourcesDir, "midi", "songs.json");

      if (!existsSync(manifestPath)) {
        console.warn("Song library manifest not found:", manifestPath);
        return [];
      }

      const raw = await readFile(manifestPath, "utf-8");
      return JSON.parse(raw) as BuiltinSongMeta[];
    },
  );

  ipcMain.handle(
    IpcChannels.LOAD_BUILTIN_SONG,
    async (_event, songId: string): Promise<MidiFileResult | null> => {
      const resourcesDir = app.isPackaged
        ? join(process.resourcesPath, "resources")
        : join(app.getAppPath(), "resources");

      const midiDir = join(resourcesDir, "midi");
      const manifestPath = join(midiDir, "songs.json");

      if (!existsSync(manifestPath)) return null;

      const manifest: BuiltinSongMeta[] = JSON.parse(
        await readFile(manifestPath, "utf-8"),
      );
      const entry = manifest.find((s) => s.id === songId);
      if (!entry) return null;

      const filePath = resolve(midiDir, entry.file);
      // Path traversal guard
      if (!filePath.startsWith(resolve(midiDir))) return null;
      if (!existsSync(filePath)) return null;

      const buffer = await readFile(filePath);
      return {
        fileName: entry.title,
        data: Array.from(buffer),
      };
    },
  );
}
