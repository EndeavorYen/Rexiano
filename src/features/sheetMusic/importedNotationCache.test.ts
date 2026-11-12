import { describe, expect, it, vi } from "vitest";
import {
  rememberImportedNotation,
  getCachedImportedNotation,
  subscribeImportedNotation,
  beginImportedNotationWait,
  isAwaitingImportedNotation,
} from "./importedNotationCache";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { NotationData } from "./types";

function song(fileName: string): ParsedSong {
  return {
    fileName,
    duration: 10,
    tracks: [
      {
        name: "Piano",
        instrument: "acoustic_grand_piano",
        channel: 0,
        notes: [],
      },
    ],
    tempos: [{ time: 0, ticks: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, ticks: 0, numerator: 4, denominator: 4 }],
    noteCount: 0,
  };
}

const notation: NotationData = {
  measures: [],
  bpm: 120,
  ticksPerQuarter: 480,
};

describe("importedNotationCache", () => {
  it("returns the conversion that arrived off the main thread", () => {
    const parsed = song("chopin-nocturne.mid");
    rememberImportedNotation(parsed, notation);
    expect(getCachedImportedNotation(parsed)).toBe(notation);
  });

  it("keys on the parsed song object, not on the file name", () => {
    const first = song("same-name.mid");
    const second = song("same-name.mid");
    rememberImportedNotation(first, notation);
    expect(getCachedImportedNotation(second)).toBeNull();
  });

  it("has nothing for a song that was never converted off the main thread", () => {
    expect(getCachedImportedNotation(song("builtin-song.mid"))).toBeNull();
  });

  it("wakes the sheet layer when a conversion arrives late", () => {
    const heard = vi.fn();
    const unsubscribe = subscribeImportedNotation(heard);

    rememberImportedNotation(song("late-a.mid"), notation);
    expect(heard).toHaveBeenCalledTimes(1);

    unsubscribe();
    rememberImportedNotation(song("late-b.mid"), notation);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("wakes the sheet layer when a wait starts or ends", () => {
    const heard = vi.fn();
    const unsubscribe = subscribeImportedNotation(heard);

    const release = beginImportedNotationWait("wake.mid");
    expect(heard).toHaveBeenCalledTimes(1);
    release();
    expect(heard).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("tells the sheet layer a conversion is still running off-thread", () => {
    const release = beginImportedNotationWait("piece.mid");
    expect(isAwaitingImportedNotation("piece.mid")).toBe(true);
    release();
    expect(isAwaitingImportedNotation("piece.mid")).toBe(false);
  });

  it("keeps waiting while another import of the same file runs", () => {
    const first = beginImportedNotationWait("same.mid");
    const second = beginImportedNotationWait("same.mid");
    first();
    expect(isAwaitingImportedNotation("same.mid")).toBe(true);
    second();
    expect(isAwaitingImportedNotation("same.mid")).toBe(false);
  });

  it("releasing twice does not end another import's wait", () => {
    const first = beginImportedNotationWait("twice.mid");
    const second = beginImportedNotationWait("twice.mid");
    first();
    first();
    expect(isAwaitingImportedNotation("twice.mid")).toBe(true);
    second();
    expect(isAwaitingImportedNotation("twice.mid")).toBe(false);
  });
});
