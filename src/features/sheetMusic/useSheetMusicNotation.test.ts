import { describe, it, expect } from "vitest";
import {
  buildNotationData,
  buildNotationTempoMap,
} from "./useSheetMusicNotation";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { NotationData } from "./types";

describe("useSheetMusicNotation helper functions", () => {
  const dummySong: ParsedSong = {
    fileName: "twinkle.mid",
    duration: 10,
    noteCount: 1,
    tracks: [
      {
        name: "Piano",
        instrument: "acoustic_grand_piano",
        channel: 0,
        notes: [{ name: "C4", midi: 60, time: 0, duration: 1, velocity: 80 }],
      },
    ],
    tempos: [{ ticks: 0, bpm: 120, time: 0 }],
    timeSignatures: [{ ticks: 0, numerator: 4, denominator: 4, time: 0 }],
  };

  it("returns fixtureData if provided", () => {
    const fixtureData: NotationData = {
      measures: [],
      bpm: 120,
      ticksPerQuarter: 480,
    };

    const result = buildNotationData(dummySong, fixtureData, null);
    expect(result).toBe(fixtureData);
  });

  it("returns null if no song and no fixtureData", () => {
    expect(buildNotationData(null, null, null)).toBeNull();
  });

  it("converts song to notation data using builtin metadata", () => {
    const result = buildNotationData(dummySong, null, {
      keySignature: 2,
      timeSignatureTop: 3,
      timeSignatureBottom: 4,
    });

    expect(result).not.toBeNull();
    expect(result?.measures[0]?.keySignature).toBe(2);
    expect(result?.measures[0]?.timeSignatureTop).toBe(3);
    expect(result?.measures[0]?.timeSignatureBottom).toBe(4);
  });

  it("buildNotationTempoMap returns null if fixtureData is present or song is null", () => {
    expect(buildNotationTempoMap(dummySong, true)).toBeNull();
    expect(buildNotationTempoMap(null, false)).toBeNull();
  });

  it("buildNotationTempoMap returns TempoMap instance from song", () => {
    const map = buildNotationTempoMap(dummySong, false);
    expect(map).not.toBeNull();
  });
});
