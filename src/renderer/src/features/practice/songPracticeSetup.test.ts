import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createSongPracticeSetupKey,
  loadSongPracticeSetupSnapshot,
  saveSongPracticeSetupSnapshot,
  updateSongPracticeSetupSnapshot,
} from "./songPracticeSetup";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

const STORAGE_KEY = "rexiano-song-practice-setup";

describe("createSongPracticeSetupKey", () => {
  test("creates stable keys for built-in and imported songs", () => {
    expect(createSongPracticeSetupKey({ builtinSongId: "scale-c" })).toBe(
      "builtin:scale-c",
    );
    expect(
      createSongPracticeSetupKey({
        sourcePath: " C:\\Users\\rex\\Music\\Lesson.mid ",
      }),
    ).toBe("file:C:/Users/rex/Music/Lesson.mid");
    expect(createSongPracticeSetupKey({ fileName: "lesson.mid" })).toBe(
      "name:lesson.mid",
    );
  });
});

describe("song practice setup persistence", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  test("saves and loads active tracks, hand assignments, and defaults", () => {
    saveSongPracticeSetupSnapshot(
      "builtin:scale-c",
      {
        activeTracks: [2, 0, 2],
        handAssignments: { 0: "right", 1: "left", 3: "background" },
        defaultMode: "wait",
        defaultSpeed: 0.75,
      },
      "2026-05-17T01:00:00.000Z",
    );

    expect(loadSongPracticeSetupSnapshot("builtin:scale-c")).toEqual({
      activeTracks: [0, 2],
      handAssignments: { 0: "right", 1: "left", 3: "background" },
      defaultMode: "wait",
      defaultSpeed: 0.75,
      updatedAt: "2026-05-17T01:00:00.000Z",
    });
  });

  test("updates one song setup without replacing other songs", () => {
    saveSongPracticeSetupSnapshot(
      "builtin:scale-c",
      {
        activeTracks: [0],
        handAssignments: { 0: "right" },
        defaultMode: "watch",
        defaultSpeed: 1,
      },
      "2026-05-17T01:00:00.000Z",
    );
    saveSongPracticeSetupSnapshot(
      "name:minuet.mid",
      {
        activeTracks: [1],
        handAssignments: { 1: "left" },
        defaultMode: "wait",
        defaultSpeed: 0.5,
      },
      "2026-05-17T01:01:00.000Z",
    );

    updateSongPracticeSetupSnapshot(
      "builtin:scale-c",
      { defaultSpeed: 0.8 },
      "2026-05-17T01:02:00.000Z",
    );

    expect(loadSongPracticeSetupSnapshot("builtin:scale-c")).toMatchObject({
      activeTracks: [0],
      handAssignments: { 0: "right" },
      defaultMode: "watch",
      defaultSpeed: 0.8,
      updatedAt: "2026-05-17T01:02:00.000Z",
    });
    expect(loadSongPracticeSetupSnapshot("name:minuet.mid")).toMatchObject({
      activeTracks: [1],
      defaultSpeed: 0.5,
    });
  });

  test("falls back safely when storage is corrupt", () => {
    storage.set(STORAGE_KEY, "not-json");

    expect(loadSongPracticeSetupSnapshot("builtin:scale-c")).toBeNull();

    saveSongPracticeSetupSnapshot(
      "builtin:scale-c",
      {
        activeTracks: [0],
        handAssignments: { 0: "both" },
        defaultMode: "free",
        defaultSpeed: 1.25,
      },
      "2026-05-17T01:03:00.000Z",
    );

    expect(loadSongPracticeSetupSnapshot("builtin:scale-c")).toMatchObject({
      activeTracks: [0],
      handAssignments: { 0: "both" },
      defaultMode: "free",
      defaultSpeed: 1.25,
    });
  });
});
