import { describe, test, expect, beforeEach } from "vitest";
import { useSongStore } from "./useSongStore";
import type { ParsedSong } from "@renderer/engines/midi/types";

const mockSong: ParsedSong = {
  fileName: "test.mid",
  duration: 120,
  tracks: [],
  tempos: [{ time: 0, bpm: 120 }],
  timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
  noteCount: 0,
};

describe("useSongStore", () => {
  beforeEach(() => {
    useSongStore.setState({ song: null });
  });

  test("initial state has no song", () => {
    expect(useSongStore.getState().song).toBeNull();
  });

  test("loadSong sets the song", () => {
    useSongStore.getState().loadSong(mockSong);
    expect(useSongStore.getState().song).toEqual(mockSong);
  });

  test("clearSong resets song to null", () => {
    useSongStore.getState().loadSong(mockSong);
    useSongStore.getState().clearSong();
    expect(useSongStore.getState().song).toBeNull();
  });

  test("loadSong replaces existing song", () => {
    useSongStore.getState().loadSong(mockSong);
    const newSong = { ...mockSong, fileName: "other.mid", duration: 60 };
    useSongStore.getState().loadSong(newSong);
    expect(useSongStore.getState().song?.fileName).toBe("other.mid");
  });
});
