import { ipcMain, dialog, BrowserWindow, app } from "electron";
import { readFile } from "fs/promises";
import { basename, join, resolve, relative, isAbsolute } from "path";
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

      // Prevent path traversal: resolve and verify the path stays within resourcesDir.
      // Use path.relative() instead of startsWith() to avoid false matches on
      // paths sharing a common prefix (e.g. /resources vs /resourcesEvil).
      const resolvedResourcesDir = resolve(resourcesDir);
      const sfPath = resolve(resourcesDir, sfName);
      const sfRel = relative(resolvedResourcesDir, sfPath);
      if (sfRel.startsWith("..") || isAbsolute(sfRel)) {
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

      // Path must be absolute to avoid CWD-relative tricks
      if (!isAbsolute(filePath)) return null;

      // Only allow .mid/.midi files
      const lower = filePath.toLowerCase();
      if (!lower.endsWith(".mid") && !lower.endsWith(".midi")) return null;

      if (!existsSync(filePath)) return null;

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

      try {
        const raw = await readFile(manifestPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed as BuiltinSongMeta[];
      } catch (err) {
        console.warn("Failed to parse song library manifest:", err);
        return [];
      }
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

      try {
        const manifest: BuiltinSongMeta[] = JSON.parse(
          await readFile(manifestPath, "utf-8"),
        );
        const entry = manifest.find((s) => s.id === songId);
        if (!entry) return null;

        const filePath = resolve(midiDir, entry.file);
        // Path traversal guard: use relative() so /midi-evil paths can't sneak through.
        const midiRel = relative(resolve(midiDir), filePath);
        if (midiRel.startsWith("..") || isAbsolute(midiRel)) return null;
        if (!existsSync(filePath)) return null;

        const buffer = await readFile(filePath);
        return {
          fileName: basename(filePath),
          data: Array.from(buffer),
        };
      } catch (err) {
        console.warn("Failed to load builtin song:", err);
        return null;
      }
    },
  );
}
