import { ipcMain, dialog, BrowserWindow, app } from "electron";
import { readFile, writeFile } from "fs/promises";
import { basename, join, resolve, relative, isAbsolute } from "path";
import { existsSync } from "fs";
import {
  IpcChannels,
  type MidiFileResult,
  type MidiExportRequest,
  type MidiExportResult,
  type SoundFontResult,
  type BuiltinSongMeta,
} from "../../shared/types";
import { approveMidiFilePath, readApprovedMidiFile } from "./midiPathAccess";
import { readBoundedMidiFile } from "./midiFileReader";
import { requireTrustedMainFrame } from "./trustedIpc";

function resolveBundledResourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked", "resources")
    : join(app.getAppPath(), "resources");
}

export function registerFileHandlers(): void {
  ipcMain.handle(
    IpcChannels.OPEN_MIDI_FILE,
    async (event): Promise<MidiFileResult | null> => {
      requireTrustedMainFrame(event);
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return null;

      const result = await dialog.showOpenDialog(window, {
        title: "Open score or MIDI",
        filters: [
          {
            name: "Practice files",
            extensions: ["mid", "midi", "kar", "musicxml", "xml"],
          },
        ],
        properties: ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) return null;

      const filePath = result.filePaths[0];
      const canonicalPath = await approveMidiFilePath(filePath);
      if (!canonicalPath) return null;
      const approved = await readApprovedMidiFile(canonicalPath);
      if (!approved) return null;

      return {
        fileName: basename(approved.path),
        data: Array.from(approved.buffer),
        path: approved.path,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.LOAD_SOUNDFONT,
    async (_event, fileName?: string): Promise<SoundFontResult | null> => {
      requireTrustedMainFrame(_event);
      const sfName = fileName ?? "default.sf2";

      // Look in resources/ directory (packaged or dev)
      const resourcesDir = resolveBundledResourcesDir();

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
      requireTrustedMainFrame(_event);
      if (typeof filePath !== "string" || filePath.length === 0) return null;
      const approved = await readApprovedMidiFile(filePath);
      if (!approved) return null;

      return {
        fileName: basename(approved.path),
        data: Array.from(approved.buffer),
        path: approved.path,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.EXPORT_MIDI_FILE,
    async (_event, request: MidiExportRequest): Promise<MidiExportResult> => {
      requireTrustedMainFrame(_event);
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return { ok: false, reason: "cancelled" };

      const result = await dialog.showSaveDialog(window, {
        title: "Export MIDI File",
        defaultPath: request.suggestedName,
        filters: [{ name: "MIDI Files", extensions: ["mid", "midi"] }],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, reason: "cancelled" };
      }

      try {
        await writeFile(result.filePath, Buffer.from(request.data));
        await approveMidiFilePath(result.filePath);
        return { ok: true, path: result.filePath };
      } catch (error) {
        return {
          ok: false,
          reason: "write-failed",
          message:
            error instanceof Error
              ? error.message
              : "Could not write MIDI file.",
        };
      }
    },
  );

  // ─── Song Library ──────────────────────────────────────

  ipcMain.handle(
    IpcChannels.LIST_BUILTIN_SONGS,
    async (event): Promise<BuiltinSongMeta[]> => {
      requireTrustedMainFrame(event);
      const resourcesDir = resolveBundledResourcesDir();

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
      requireTrustedMainFrame(_event);
      const resourcesDir = resolveBundledResourcesDir();

      const midiDir = join(resourcesDir, "midi");
      const manifestPath = join(midiDir, "songs.json");

      if (!existsSync(manifestPath)) return null;

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

      const buffer = await readBoundedMidiFile(filePath);
      return {
        fileName: entry.title,
        data: Array.from(buffer),
      };
    },
  );
}
