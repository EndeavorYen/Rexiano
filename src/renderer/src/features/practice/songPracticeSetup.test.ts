import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ParsedSong, ParsedTrack } from "@renderer/engines/midi/types";
import {
  createSongPracticeSetupKey,
  getSongPracticeSetupFixPrompt,
  loadSongPracticeSetupSnapshot,
  resolveSongPracticeSetupForSong,
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

function note(midi: number): ParsedTrack["notes"][number] {
  return {
    midi,
    name: `N${midi}`,
    time: 0,
    duration: 0.5,
    velocity: 80,
  };
}

function track(
  name: string,
  midiNotes: number[],
  overrides: Partial<ParsedTrack> = {},
): ParsedTrack {
  return {
    name,
    instrument: "Acoustic Grand Piano",
    channel: 0,
    notes: midiNotes.map(note),
    ...overrides,
  };
}

function song(tracks: ParsedTrack[], fileName = "lesson.mid"): ParsedSong {
  return {
    fileName,
    duration: 12,
    tracks,
    tempos: [{ time: 0, bpm: 100 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    noteCount: tracks.reduce((sum, item) => sum + item.notes.length, 0),
  };
}

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
        trackPreferences: {
          0: { color: "  #ffcc00 ", muted: false },
          2: { color: "", muted: true, backgroundVisible: false },
          [-1]: { color: "#000000", muted: true },
        },
        defaultMode: "wait",
        defaultSpeed: 0.75,
      },
      "2026-05-17T01:00:00.000Z",
    );

    expect(loadSongPracticeSetupSnapshot("builtin:scale-c")).toEqual({
      activeTracks: [0, 2],
      handAssignments: { 0: "right", 1: "left", 3: "background" },
      trackPreferences: {
        0: { color: "#ffcc00", muted: false },
        2: { muted: true, backgroundVisible: false },
      },
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
    updateSongPracticeSetupSnapshot(
      "builtin:scale-c",
      { trackPreferences: { 0: { muted: true } } },
      "2026-05-17T01:03:00.000Z",
    );

    expect(loadSongPracticeSetupSnapshot("builtin:scale-c")).toMatchObject({
      activeTracks: [0],
      handAssignments: { 0: "right" },
      defaultMode: "watch",
      defaultSpeed: 0.8,
      trackPreferences: { 0: { muted: true } },
      updatedAt: "2026-05-17T01:03:00.000Z",
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

describe("resolveSongPracticeSetupForSong", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  test("restores a saved setup for a loaded song", () => {
    saveSongPracticeSetupSnapshot(
      "name:lesson.mid",
      {
        activeTracks: [1],
        handAssignments: { 0: "right", 1: "left" },
        defaultMode: "wait",
        defaultSpeed: 0.6,
      },
      "2026-05-17T02:00:00.000Z",
    );

    expect(
      resolveSongPracticeSetupForSong(
        song([track("Right Hand", [72, 76]), track("Left Hand", [36, 43])]),
        { defaultMode: "watch", defaultSpeed: 1 },
      ),
    ).toEqual({
      activeTracks: [1],
      handAssignments: { 0: "right", 1: "left" },
      defaultMode: "wait",
      defaultSpeed: 0.6,
      updatedAt: "2026-05-17T02:00:00.000Z",
    });
  });

  test("falls back to inferred non-background tracks and app defaults", () => {
    const resolved = resolveSongPracticeSetupForSong(
      song(
        [
          track("Piano RH", [72, 76]),
          track("Drums", [36, 38], {
            instrument: "Standard Drum Kit",
            channel: 9,
          }),
        ],
        "new-song.mid",
      ),
      { defaultMode: "free", defaultSpeed: 0.8 },
      "2026-05-17T02:01:00.000Z",
    );

    expect(resolved).toEqual({
      activeTracks: [0],
      handAssignments: { 0: "right", 1: "background" },
      defaultMode: "free",
      defaultSpeed: 0.8,
      updatedAt: "2026-05-17T02:01:00.000Z",
    });
  });
});

describe("getSongPracticeSetupFixPrompt", () => {
  test("requests setup when piano tracks have low-confidence hand inference", () => {
    expect(
      getSongPracticeSetupFixPrompt(
        song([
          track("Piano 1", [60, 64]),
          track("Piano 2", [62, 65]),
          track("Piano 3", [67, 69]),
        ]),
      ),
    ).toEqual({
      needed: true,
      reasons: ["low-confidence-hands"],
      activeTrackCount: 3,
      lowConfidenceTrackIndices: [0, 1, 2],
    });
  });

  test("requests setup when every discovered track is background-only", () => {
    expect(
      getSongPracticeSetupFixPrompt(
        song([
          track("Drums", [36, 38], {
            instrument: "Standard Drum Kit",
            channel: 9,
          }),
          track("Strings", [60, 64], { instrument: "Violin" }),
        ]),
      ),
    ).toEqual({
      needed: true,
      reasons: ["background-only"],
      activeTrackCount: 0,
      lowConfidenceTrackIndices: [],
    });
  });

  test("requests setup when too many tracks would be active by default", () => {
    expect(
      getSongPracticeSetupFixPrompt(
        song([
          track("Right Hand 1", [72]),
          track("Right Hand 2", [74]),
          track("Right Hand 3", [76]),
          track("Right Hand 4", [77]),
          track("Right Hand 5", [79]),
        ]),
      ),
    ).toEqual({
      needed: true,
      reasons: ["too-many-active-tracks"],
      activeTrackCount: 5,
      lowConfidenceTrackIndices: [],
    });
  });

  test("does not request setup for explicit right and left hand tracks", () => {
    expect(
      getSongPracticeSetupFixPrompt(
        song([track("Right Hand", [72, 76]), track("Left Hand", [36, 43])]),
      ),
    ).toEqual({
      needed: false,
      reasons: [],
      activeTrackCount: 2,
      lowConfidenceTrackIndices: [],
    });
  });
});
