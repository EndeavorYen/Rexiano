import { describe, expect, test, vi } from "vitest";
import { createMemoryStore } from "./browserStore";
import type { RexianoApi } from "./types";
import {
  MAX_RECENTS,
  MAX_STORED_FILES,
  createWebApi,
  type WebApiDeps,
} from "./webApi";
import type { SessionRecord } from "../shared/types";
import { MIDI_FILE_TOO_LARGE_DIAGNOSTIC } from "../shared/midiFileLimits";

const manifest = [
  {
    id: "hot-cross-buns",
    file: "hot-cross-buns.mid",
    title: "Hot Cross Buns",
    composer: "Traditional",
    difficulty: "beginner",
    durationSeconds: 12,
    tags: [],
  },
];

function fakeFile(name: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name);
}

function makeApi(overrides: Partial<WebApiDeps> = {}): {
  api: RexianoApi;
  deps: WebApiDeps;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  let clock = 1_000;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("midi/songs.json")) {
      return new Response(JSON.stringify(manifest));
    }
    if (url.endsWith("midi/hot-cross-buns.mid")) {
      return new Response(new Uint8Array([77, 84, 104, 100]));
    }
    if (url.endsWith("piano.sf2")) {
      return new Response(new Uint8Array([1, 2, 3]));
    }
    return new Response("missing", { status: 404 });
  });
  const deps: WebApiDeps = {
    store: createMemoryStore(),
    assetBase: "/",
    fetch: fetchMock as unknown as typeof fetch,
    now: () => ++clock,
    pickFile: vi.fn(async () => null),
    download: vi.fn(),
    isE2eTestMode: false,
    ...overrides,
  };
  return { api: createWebApi(deps), deps, fetchMock };
}

function session(id: string): SessionRecord {
  return {
    id,
    songId: "hot-cross-buns",
    songTitle: "Hot Cross Buns",
    timestamp: 1,
    mode: "wait",
    speed: 1,
    score: {
      totalNotes: 4,
      hitNotes: 4,
      missedNotes: 0,
      accuracy: 100,
      currentStreak: 4,
      bestStreak: 4,
    },
    durationSeconds: 10,
    tracksPlayed: [0],
  };
}

describe("web platform: static assets", () => {
  test("lists and loads built-in songs from public/midi", async () => {
    const { api } = makeApi();

    expect(await api.listBuiltinSongs()).toEqual(manifest);
    expect(await api.loadBuiltinSong("hot-cross-buns")).toEqual({
      fileName: "Hot Cross Buns",
      data: [77, 84, 104, 100],
    });
    expect(await api.loadBuiltinSong("nope")).toBeNull();
  });

  test("loads the SoundFont and refuses path-like names", async () => {
    const { api, fetchMock } = makeApi();

    expect(await api.loadSoundFont("piano.sf2")).toEqual({
      fileName: "piano.sf2",
      data: [1, 2, 3],
    });
    expect(await api.loadSoundFont("../secret.sf2")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("respects a non-root deployment base", async () => {
    const { api, fetchMock } = makeApi({ assetBase: "/rexiano" });
    await api.listBuiltinSongs();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/rexiano/midi/songs.json");
  });
});

describe("web platform: imported files", () => {
  test("keeps a picked file so it can be reopened by path", async () => {
    const file = fakeFile("Etude.mid", [1, 2, 3]);
    const { api } = makeApi({ pickFile: vi.fn(async () => file) });

    const opened = await api.openMidiFile();
    expect(opened?.fileName).toBe("Etude.mid");
    expect(opened?.path).toMatch(/^local:[0-9a-f]+\/Etude\.mid$/);

    expect(await api.listStoredMidiFiles()).toEqual([opened!.path]);
    expect(await api.loadMidiPath(opened!.path!)).toEqual({
      fileName: "Etude.mid",
      data: [1, 2, 3],
      path: opened!.path,
    });
  });

  test("returns null when the picker is cancelled", async () => {
    const { api } = makeApi();
    expect(await api.openMidiFile()).toBeNull();
  });

  test("the same bytes map to the same path", async () => {
    const { api } = makeApi();
    const a = await api.importMidiFile(fakeFile("Song.mid", [9, 9]));
    const b = await api.importMidiFile(fakeFile("Song.mid", [9, 9]));
    expect(a.path).toBe(b.path);
    expect(await api.listStoredMidiFiles()).toHaveLength(1);
  });

  test("rejects oversized files with the shared diagnostic", async () => {
    const { api } = makeApi();
    const huge = { name: "big.mid", size: 9 * 1024 * 1024 } as File;
    await expect(api.importMidiFile(huge)).rejects.toThrow(
      MIDI_FILE_TOO_LARGE_DIAGNOSTIC,
    );
  });

  test("evicts the least recently opened files past the cap", async () => {
    const { api } = makeApi();
    const first = await api.importMidiFile(fakeFile("first.mid", [0]));
    for (let i = 1; i <= MAX_STORED_FILES; i++) {
      await api.importMidiFile(fakeFile(`song-${i}.mid`, [i % 256, i >> 8]));
    }
    const paths = await api.listStoredMidiFiles();
    expect(paths).toHaveLength(MAX_STORED_FILES);
    expect(paths).not.toContain(first.path);
  });

  test("still opens a file when storage fails", async () => {
    const store = createMemoryStore();
    store.set = vi.fn(async () => {
      throw new Error("quota");
    });
    const { api } = makeApi({ store });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await api.importMidiFile(fakeFile("x.mid", [5]));
    expect(result).toEqual({ fileName: "x.mid", data: [5] });
    warn.mockRestore();
  });

  test("unknown or desktop-era paths are reported missing", async () => {
    const { api } = makeApi();
    expect(await api.loadMidiPath("local:00/gone.mid")).toBeNull();
    expect(await api.loadMidiPath("C:/Users/rex/song.mid")).toBeNull();
  });

  test("removes a stored file", async () => {
    const { api } = makeApi();
    const { path } = await api.importMidiFile(fakeFile("a.mid", [1]));
    expect(await api.removeStoredMidiFile(path!)).toBe(true);
    expect(await api.listStoredMidiFiles()).toEqual([]);
  });

  test("exports MIDI as a download with a .mid name", async () => {
    const { api, deps } = makeApi();
    const result = await api.exportMidiFile({
      suggestedName: "my/edit",
      data: [1, 2],
    });
    expect(result).toEqual({ ok: true, path: "my_edit.mid" });
    expect(deps.download).toHaveBeenCalledWith(
      "my_edit.mid",
      new Uint8Array([1, 2]),
      "audio/midi",
    );
  });
});

describe("web platform: progress, recents and backup", () => {
  test("appends valid sessions and ignores invalid ones", async () => {
    const { api } = makeApi();
    await api.saveSession(session("a"));
    await api.saveSession({ id: "bad" } as SessionRecord);
    expect(await api.loadSessions()).toEqual([session("a")]);
  });

  test("keeps the newest recents first, deduplicated and capped", async () => {
    const { api } = makeApi();
    for (let i = 0; i < MAX_RECENTS + 2; i++) {
      await api.saveRecentFile({
        path: `builtin:song-${i}`,
        name: `Song ${i}`,
        timestamp: i,
      });
    }
    await api.saveRecentFile({
      path: "builtin:song-5",
      name: "Song 5",
      timestamp: 99,
    });
    const recents = await api.loadRecentFiles();
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents[0].path).toBe("builtin:song-5");
    expect(new Set(recents.map((r) => r.path)).size).toBe(MAX_RECENTS);

    expect(await api.removeRecentFile("builtin:song-5")).toBe(true);
    expect((await api.loadRecentFiles())[0].path).not.toBe("builtin:song-5");
  });

  test("round-trips progress and recents through backup", async () => {
    const source = makeApi().api;
    await source.saveSession(session("a"));
    await source.saveRecentFile({
      path: "builtin:x",
      name: "X",
      timestamp: 1,
    });
    const exported = await source.exportUserDataFiles();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const target = makeApi().api;
    expect(await target.importUserDataFiles(exported.data)).toEqual({
      ok: true,
      scopes: ["progress", "recents"],
    });
    expect(await target.loadSessions()).toEqual([session("a")]);
    expect(await target.loadRecentFiles()).toHaveLength(1);
  });

  test("rejects a backup with an invalid record without writing", async () => {
    const { api } = makeApi();
    await api.saveSession(session("keep"));
    const result = await api.importUserDataFiles({
      progress: [session("new"), { id: "broken" }],
    });
    expect(result.ok).toBe(false);
    expect(await api.loadSessions()).toEqual([session("keep")]);
  });

  test("rejects unknown scopes and resets known ones", async () => {
    const { api } = makeApi();
    await api.saveSession(session("a"));
    expect((await api.resetUserDataFiles(["nope"])).ok).toBe(false);
    expect(await api.resetUserDataFiles(["progress"])).toEqual({
      ok: true,
      scopes: ["progress"],
    });
    expect(await api.loadSessions()).toEqual([]);
  });
});

describe("web platform: launched files (installed PWA)", () => {
  test("stores the launched file and announces it once", async () => {
    let consumer:
      | ((params: { files: { getFile(): Promise<File> }[] }) => void)
      | undefined;
    vi.stubGlobal("launchQueue", {
      setConsumer: (fn: typeof consumer) => {
        consumer = fn;
      },
    });
    try {
      const { api } = makeApi();
      const notified = vi.fn();
      api.onAssociatedMidiFilePending(notified);

      consumer?.({
        files: [{ getFile: async () => fakeFile("Opened.mid", [3, 1]) }],
      });
      await vi.waitFor(() => expect(notified).toHaveBeenCalledTimes(1));

      const path = await api.takePendingAssociatedMidiFile();
      expect(path).toMatch(/Opened\.mid$/);
      expect(await api.takePendingAssociatedMidiFile()).toBeNull();
      expect((await api.loadMidiPath(path!))?.data).toEqual([3, 1]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
