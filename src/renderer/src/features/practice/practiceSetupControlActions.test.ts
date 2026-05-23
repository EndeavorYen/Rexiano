import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ParsedSong, ParsedTrack } from "@renderer/engines/midi/types";
import { loadSongPracticeSetupSnapshot } from "./songPracticeSetup";
import {
  applyTrackHandAssignmentChangeForSong,
  applyTrackPreferenceChangeForSong,
  applyPracticeModeChangeForSong,
  applyPracticeSpeedChangeForSong,
} from "./practiceSetupControlActions";

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

function note(midi: number): ParsedTrack["notes"][number] {
  return {
    midi,
    name: `N${midi}`,
    time: 0,
    duration: 0.5,
    velocity: 80,
  };
}

function track(name: string, midiNotes: number[]): ParsedTrack {
  return {
    name,
    instrument: "Acoustic Grand Piano",
    channel: 0,
    notes: midiNotes.map(note),
  };
}

function song(): ParsedSong {
  return {
    fileName: "duet.mid",
    duration: 12,
    tracks: [track("Right Hand", [72, 76]), track("Left Hand", [36, 43])],
    tempos: [{ time: 0, bpm: 100 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    noteCount: 4,
  };
}

describe("practice setup control actions", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  test("changing practice mode persists it as the song default", () => {
    const setMode = vi.fn();

    applyPracticeModeChangeForSong(
      {
        song: song(),
        activeTracks: new Set([1]),
        currentSpeed: 0.75,
        setMode,
      },
      "wait",
    );

    expect(setMode).toHaveBeenCalledWith("wait");
    expect(loadSongPracticeSetupSnapshot("name:duet.mid")).toMatchObject({
      activeTracks: [1],
      defaultMode: "wait",
      defaultSpeed: 0.75,
      handAssignments: { 0: "right", 1: "left" },
    });
  });

  test("changing speed persists it as the song default", () => {
    const setSpeed = vi.fn();

    applyPracticeSpeedChangeForSong(
      {
        song: song(),
        activeTracks: new Set([0, 1]),
        currentMode: "free",
        setSpeed,
      },
      0.5,
    );

    expect(setSpeed).toHaveBeenCalledWith(0.5);
    expect(loadSongPracticeSetupSnapshot("name:duet.mid")).toMatchObject({
      activeTracks: [0, 1],
      defaultMode: "free",
      defaultSpeed: 0.5,
      handAssignments: { 0: "right", 1: "left" },
    });
  });

  test("changing a track to background removes it from active practice tracks", () => {
    const setActiveTracks = vi.fn();
    const setHandAssignments = vi.fn();

    applyTrackHandAssignmentChangeForSong(
      {
        song: song(),
        activeTracks: new Set([0, 1]),
        currentMode: "wait",
        currentSpeed: 0.75,
        handAssignments: { 0: "right", 1: "left" },
        trackPreferences: {},
        setActiveTracks,
        setHandAssignments,
      },
      1,
      "background",
    );

    expect(setActiveTracks).toHaveBeenCalledWith(new Set([0]));
    expect(setHandAssignments).toHaveBeenCalledWith({
      0: "right",
      1: "background",
    });
    expect(loadSongPracticeSetupSnapshot("name:duet.mid")).toMatchObject({
      activeTracks: [0],
      defaultMode: "wait",
      defaultSpeed: 0.75,
      handAssignments: { 0: "right", 1: "background" },
    });
  });

  test("changing a background track back to a hand restores it to active practice", () => {
    const setActiveTracks = vi.fn();
    const setHandAssignments = vi.fn();

    applyTrackHandAssignmentChangeForSong(
      {
        song: song(),
        activeTracks: new Set([0]),
        currentMode: "free",
        currentSpeed: 1,
        handAssignments: { 0: "right", 1: "background" },
        trackPreferences: { 1: { muted: false, backgroundVisible: false } },
        setActiveTracks,
        setHandAssignments,
      },
      1,
      "left",
    );

    expect(setActiveTracks).toHaveBeenCalledWith(new Set([0, 1]));
    expect(setHandAssignments).toHaveBeenCalledWith({
      0: "right",
      1: "left",
    });
    expect(loadSongPracticeSetupSnapshot("name:duet.mid")).toMatchObject({
      activeTracks: [0, 1],
      defaultMode: "free",
      defaultSpeed: 1,
      handAssignments: { 0: "right", 1: "left" },
      trackPreferences: { 1: { muted: false, backgroundVisible: false } },
    });
  });

  test("changing a track preference persists mute, visibility, and color without changing active tracks", () => {
    const setTrackPreferences = vi.fn();

    applyTrackPreferenceChangeForSong(
      {
        song: song(),
        activeTracks: new Set([0]),
        currentMode: "wait",
        currentSpeed: 0.5,
        handAssignments: { 0: "right", 1: "background" },
        trackPreferences: { 1: { muted: false } },
        setTrackPreferences,
      },
      1,
      { muted: true, backgroundVisible: false, color: "#44cc88" },
    );

    expect(setTrackPreferences).toHaveBeenCalledWith({
      1: { muted: true, backgroundVisible: false, color: "#44cc88" },
    });
    expect(loadSongPracticeSetupSnapshot("name:duet.mid")).toMatchObject({
      activeTracks: [0],
      defaultMode: "wait",
      defaultSpeed: 0.5,
      handAssignments: { 0: "right", 1: "background" },
      trackPreferences: {
        1: { muted: true, backgroundVisible: false, color: "#44cc88" },
      },
    });
  });
});
