// ─── Web platform: browser implementation of window.api ─────────────

import type {
  BuiltinSongMeta,
  MidiFileResult,
  RecentFile,
  SessionRecord,
  UserDataFileBackupPayload,
  UserDataFileBackupScope,
  UserDataFileMutationResult,
} from "../shared/types";
import {
  MAX_MIDI_FILE_BYTES,
  MIDI_FILE_TOO_LARGE_DIAGNOSTIC,
} from "../shared/midiFileLimits";
import {
  normalizeRecentFile,
  normalizeSessionRecord,
} from "../shared/persistenceValidators";
import {
  PRACTICE_IMPORT_EXTENSIONS,
  isPracticeImportPath,
} from "../shared/practiceImportFile";
import type { BrowserStore } from "./browserStore";
import type { RexianoApi } from "./types";

export const MAX_RECENTS = 10;
/** Imported files kept in browser storage; the least recently opened go first. */
export const MAX_STORED_FILES = 100;
export const LOCAL_FILE_PREFIX = "local:";

const SESSIONS_KEY = "progress";
const RECENTS_KEY = "recents";
const USER_DATA_FILE_SCOPES: UserDataFileBackupScope[] = [
  "progress",
  "recents",
];

interface StoredFile {
  fileName: string;
  data: Uint8Array;
  lastOpenedAt: number;
}

export interface WebApiDeps {
  store: BrowserStore;
  /** Base URL for static assets (Vite's BASE_URL) */
  assetBase: string;
  fetch: typeof fetch;
  now: () => number;
  /** Ask the user for a file; resolves null when they cancel */
  pickFile: (accept: string) => Promise<File | null>;
  /** Hand a file to the user as a download */
  download: (fileName: string, data: Uint8Array, mimeType: string) => void;
  isE2eTestMode: boolean;
}

/** `local:<content hash>/<file name>` — still ends with the real extension. */
export function isLocalFilePath(path: string): boolean {
  return path.startsWith(LOCAL_FILE_PREFIX);
}

async function hashBytes(data: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      data as Uint8Array<ArrayBuffer>,
    );
    return Array.from(new Uint8Array(digest).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // FNV-1a fallback for non-secure contexts.
  let hash = 0x811c9dc5;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, "0")}${data.length.toString(16)}`;
}

function cleanFileName(name: string): string {
  return name.replace(/[\\/]/g, "_").trim() || "untitled.mid";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createWebApi(deps: WebApiDeps): RexianoApi {
  const { store } = deps;
  const assetUrl = (path: string): string =>
    `${deps.assetBase.replace(/\/?$/, "/")}${path}`;

  let manifestPromise: Promise<BuiltinSongMeta[]> | null = null;
  const loadManifest = (): Promise<BuiltinSongMeta[]> => {
    manifestPromise ??= (async () => {
      const response = await deps.fetch(assetUrl("midi/songs.json"));
      if (!response.ok) throw new Error(`songs.json: HTTP ${response.status}`);
      return (await response.json()) as BuiltinSongMeta[];
    })().catch((error) => {
      manifestPromise = null;
      throw error;
    });
    return manifestPromise;
  };

  async function readSessions(): Promise<SessionRecord[]> {
    const raw = await store.get<unknown>("records", SESSIONS_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r) => {
      const normalized = normalizeSessionRecord(r);
      return normalized ? [normalized] : [];
    });
  }

  async function readRecents(): Promise<RecentFile[]> {
    const raw = await store.get<unknown>("records", RECENTS_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r) => {
      const normalized = normalizeRecentFile(r);
      return normalized ? [normalized] : [];
    });
  }

  async function pruneStoredFiles(): Promise<void> {
    const keys = await store.keys("files");
    if (keys.length <= MAX_STORED_FILES) return;
    const entries = await Promise.all(
      keys.map(async (key) => ({
        key,
        lastOpenedAt:
          (await store.get<StoredFile>("files", key))?.lastOpenedAt ?? 0,
      })),
    );
    entries.sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);
    for (const { key } of entries.slice(0, keys.length - MAX_STORED_FILES)) {
      await store.delete("files", key);
    }
  }

  async function rememberFile(file: File): Promise<MidiFileResult> {
    if (file.size > MAX_MIDI_FILE_BYTES) {
      throw new Error(MIDI_FILE_TOO_LARGE_DIAGNOSTIC);
    }
    const data = new Uint8Array(await file.arrayBuffer());
    if (data.byteLength > MAX_MIDI_FILE_BYTES) {
      throw new Error(MIDI_FILE_TOO_LARGE_DIAGNOSTIC);
    }
    const fileName = cleanFileName(file.name);
    const path = `${LOCAL_FILE_PREFIX}${await hashBytes(data)}/${fileName}`;

    // Storage failure must not block practice: the song still opens.
    try {
      await store.set<StoredFile>("files", path, {
        fileName,
        data,
        lastOpenedAt: deps.now(),
      });
      await pruneStoredFiles();
      return { fileName, data: Array.from(data), path };
    } catch (error) {
      console.warn("Could not keep imported file in browser storage:", error);
      return { fileName, data: Array.from(data) };
    }
  }

  // Installed-PWA file handling (launchQueue): the launched file is stored,
  // then announced through the same pending-path flow the desktop app used.
  let pendingAssociatedPath: string | null = null;
  const pendingListeners = new Set<() => void>();
  const launchQueue = (
    globalThis as {
      launchQueue?: {
        setConsumer(
          consumer: (params: { files: { getFile(): Promise<File> }[] }) => void,
        ): void;
      };
    }
  ).launchQueue;
  launchQueue?.setConsumer(async ({ files }) => {
    const handle = files[0];
    if (!handle) return;
    try {
      const result = await rememberFile(await handle.getFile());
      if (!result.path) return;
      pendingAssociatedPath = result.path;
      for (const listener of pendingListeners) listener();
    } catch (error) {
      console.error("Failed to open launched file:", error);
    }
  });

  async function writeScopes(
    payload: Partial<Record<UserDataFileBackupScope, unknown[]>>,
  ): Promise<void> {
    if (payload.progress) {
      await store.set("records", SESSIONS_KEY, payload.progress);
    }
    if (payload.recents) {
      await store.set("records", RECENTS_KEY, payload.recents);
    }
  }

  function resolveScopes(scopes?: string[]): {
    scopes: UserDataFileBackupScope[];
    errors: string[];
  } {
    const requested = scopes ?? USER_DATA_FILE_SCOPES;
    const errors = requested
      .filter(
        (s) => !USER_DATA_FILE_SCOPES.includes(s as UserDataFileBackupScope),
      )
      .map((s) => `User data file scope is not supported: ${s}.`);
    return {
      scopes: USER_DATA_FILE_SCOPES.filter((s) => requested.includes(s)),
      errors,
    };
  }

  return {
    isE2eTestMode: deps.isE2eTestMode,

    openMidiFile: async () => {
      const file = await deps.pickFile(PRACTICE_IMPORT_EXTENSIONS.join(","));
      if (!file) return null;
      return rememberFile(file);
    },

    importMidiFile: rememberFile,

    loadSoundFont: async (fileName = "piano.sf2") => {
      if (!/^[\w.-]+\.sf2$/i.test(fileName)) return null;
      try {
        const response = await deps.fetch(assetUrl(fileName));
        if (!response.ok) return null;
        const buffer = new Uint8Array(await response.arrayBuffer());
        return { fileName, data: Array.from(buffer) };
      } catch (error) {
        console.warn(`SoundFont not loaded: ${errorMessage(error)}`);
        return null;
      }
    },

    listBuiltinSongs: () => loadManifest(),

    loadBuiltinSong: async (songId) => {
      const manifest = await loadManifest();
      const entry = manifest.find((song) => song.id === songId);
      if (!entry || !/^[\w.-]+\.midi?$/i.test(entry.file)) return null;
      const response = await deps.fetch(assetUrl(`midi/${entry.file}`));
      if (!response.ok) return null;
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.byteLength > MAX_MIDI_FILE_BYTES) return null;
      return { fileName: entry.title, data: Array.from(data) };
    },

    loadSessions: readSessions,

    saveSession: async (record) => {
      const normalized = normalizeSessionRecord(record);
      if (!normalized) return;
      const sessions = await readSessions();
      sessions.push(normalized);
      await store.set("records", SESSIONS_KEY, sessions);
    },

    loadRecentFiles: readRecents,

    saveRecentFile: async (file) => {
      const normalized = normalizeRecentFile(file);
      if (!normalized) return;
      const recents = (await readRecents()).filter(
        (recent) => recent.path !== normalized.path,
      );
      recents.unshift(normalized);
      await store.set("records", RECENTS_KEY, recents.slice(0, MAX_RECENTS));
    },

    removeRecentFile: async (filePath) => {
      if (typeof filePath !== "string" || filePath.trim().length === 0) {
        return false;
      }
      const recents = await readRecents();
      await store.set(
        "records",
        RECENTS_KEY,
        recents.filter((recent) => recent.path !== filePath),
      );
      return true;
    },

    exportUserDataFiles: async (scopes) => {
      const resolved = resolveScopes(scopes);
      if (resolved.errors.length > 0)
        return { ok: false, errors: resolved.errors };
      try {
        const data: UserDataFileBackupPayload = {};
        if (resolved.scopes.includes("progress"))
          data.progress = await readSessions();
        if (resolved.scopes.includes("recents"))
          data.recents = await readRecents();
        return { ok: true, scopes: resolved.scopes, data };
      } catch (error) {
        return { ok: false, errors: [errorMessage(error)] };
      }
    },

    importUserDataFiles: async (payload, scopes) => {
      const resolved = resolveScopes(scopes);
      if (resolved.errors.length > 0)
        return { ok: false, errors: resolved.errors };
      const normalized: Partial<Record<UserDataFileBackupScope, unknown[]>> =
        {};
      for (const scope of resolved.scopes) {
        if (!(scope in payload)) continue;
        const records = payload[scope];
        if (!Array.isArray(records)) {
          return {
            ok: false,
            errors: [`Cannot import ${scope}: expected a list.`],
          };
        }
        const normalize =
          scope === "progress" ? normalizeSessionRecord : normalizeRecentFile;
        const values: unknown[] = [];
        for (const [index, record] of records.entries()) {
          const value = normalize(record);
          if (!value) {
            return {
              ok: false,
              errors: [
                `Cannot import ${scope}: record at index ${index} is invalid.`,
              ],
            };
          }
          values.push(value);
        }
        normalized[scope] =
          scope === "recents" ? values.slice(0, MAX_RECENTS) : values;
      }
      try {
        await writeScopes(normalized);
        return {
          ok: true,
          scopes: resolved.scopes.filter((s) => s in normalized),
        } satisfies UserDataFileMutationResult;
      } catch (error) {
        return { ok: false, errors: [errorMessage(error)] };
      }
    },

    resetUserDataFiles: async (scopes) => {
      const resolved = resolveScopes(scopes);
      if (resolved.errors.length > 0)
        return { ok: false, errors: resolved.errors };
      try {
        await writeScopes(
          Object.fromEntries(resolved.scopes.map((s) => [s, []])),
        );
        return { ok: true, scopes: resolved.scopes };
      } catch (error) {
        return { ok: false, errors: [errorMessage(error)] };
      }
    },

    listStoredMidiFiles: async () => {
      const keys = await store.keys("files");
      return keys.filter(
        (key) => isLocalFilePath(key) && isPracticeImportPath(key),
      );
    },

    removeStoredMidiFile: async (filePath) => {
      if (!isLocalFilePath(filePath)) return false;
      await store.delete("files", filePath);
      return true;
    },

    loadMidiPath: async (filePath) => {
      if (!isLocalFilePath(filePath)) return null;
      const stored = await store.get<StoredFile>("files", filePath);
      if (!stored) return null;
      try {
        await store.set<StoredFile>("files", filePath, {
          ...stored,
          lastOpenedAt: deps.now(),
        });
      } catch {
        // Recency bookkeeping only.
      }
      return {
        fileName: stored.fileName,
        data: Array.from(stored.data),
        path: filePath,
      };
    },

    takePendingAssociatedMidiFile: async () => {
      const path = pendingAssociatedPath;
      pendingAssociatedPath = null;
      return path;
    },

    onAssociatedMidiFilePending: (callback) => {
      pendingListeners.add(callback);
      return () => pendingListeners.delete(callback);
    },

    exportMidiFile: async (request) => {
      try {
        const name = cleanFileName(request.suggestedName);
        const fileName = /\.midi?$/i.test(name) ? name : `${name}.mid`;
        deps.download(fileName, new Uint8Array(request.data), "audio/midi");
        return { ok: true, path: fileName };
      } catch (error) {
        return {
          ok: false,
          reason: "write-failed",
          message: errorMessage(error),
        };
      }
    },
  };
}
