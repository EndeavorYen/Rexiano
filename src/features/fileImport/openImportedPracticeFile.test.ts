import { describe, expect, it, vi } from "vitest";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { NotationData } from "@renderer/features/sheetMusic/types";

vi.mock("@renderer/engines/score/practiceImportWorkerClient", () => ({
  startImportedPracticeFileOffMainThread: vi.fn(),
}));

import { openImportedPracticeFile } from "./openImportedPracticeFile";
import { startImportedPracticeFileOffMainThread } from "@renderer/engines/score/practiceImportWorkerClient";
import {
  getCachedImportedNotation,
  isAwaitingImportedNotation,
} from "@renderer/features/sheetMusic/importedNotationCache";

const mockStart = vi.mocked(startImportedPracticeFileOffMainThread);

function song(fileName: string): ParsedSong {
  return {
    fileName,
    duration: 30,
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

const notation: NotationData = { measures: [], bpm: 120, ticksPerQuarter: 480 };

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("openImportedPracticeFile", () => {
  it("hands back the song the worker parsed", async () => {
    const parsed = song("nocturne.mid");
    mockStart.mockReturnValue({
      song: Promise.resolve(parsed),
      notation: Promise.resolve(null),
    });

    const result = await openImportedPracticeFile(
      "nocturne.mid",
      new Uint8Array([1]),
    );

    expect(mockStart).toHaveBeenCalledWith(
      "nocturne.mid",
      expect.any(Uint8Array),
    );
    expect(result).toBe(parsed);
  });

  it("accepts the number arrays the web api hands back", async () => {
    const parsed = song("web-api.mid");
    mockStart.mockReturnValue({
      song: Promise.resolve(parsed),
      notation: Promise.resolve(null),
    });

    const result = await openImportedPracticeFile("web-api.mid", [1, 2, 3]);

    expect(mockStart).toHaveBeenCalledWith(
      "web-api.mid",
      new Uint8Array([1, 2, 3]),
    );
    expect(result).toBe(parsed);
  });

  it("keeps the sheet layer from converting the same song again", async () => {
    const parsed = song("with-notation.mid");
    mockStart.mockReturnValue({
      song: Promise.resolve(parsed),
      notation: Promise.resolve({ song: parsed, notation }),
    });

    const result = await openImportedPracticeFile(
      "with-notation.mid",
      new Uint8Array([1]),
    );
    await flush();

    expect(getCachedImportedNotation(result)).toBe(notation);
  });

  it("holds the sheet back until the worker's conversion lands", async () => {
    const parsed = song("still-working.mid");
    let landConversion!: (result: {
      song: ParsedSong;
      notation: NotationData;
    }) => void;
    const conversion = new Promise<{
      song: ParsedSong;
      notation: NotationData;
    }>((resolve) => {
      landConversion = resolve;
    });
    mockStart.mockReturnValue({
      song: Promise.resolve(parsed),
      notation: conversion,
    });

    const result = await openImportedPracticeFile(
      "still-working.mid",
      new Uint8Array([1]),
    );
    expect(isAwaitingImportedNotation("still-working.mid")).toBe(true);
    expect(getCachedImportedNotation(result)).toBeNull();

    landConversion({ song: parsed, notation });
    await flush();

    expect(isAwaitingImportedNotation("still-working.mid")).toBe(false);
    expect(getCachedImportedNotation(result)).toBe(notation);
  });

  it("lets the sheet convert here when the worker cannot convert", async () => {
    const parsed = song("no-conversion.mid");
    mockStart.mockReturnValue({
      song: Promise.resolve(parsed),
      notation: Promise.resolve(null),
    });

    await openImportedPracticeFile("no-conversion.mid", new Uint8Array([1]));
    await flush();

    expect(isAwaitingImportedNotation("no-conversion.mid")).toBe(false);
  });

  it("lets the sheet convert here when the import fails", async () => {
    const failure = new Error("MIDI file has no notes.");
    mockStart.mockReturnValue({
      song: Promise.reject(failure),
      notation: Promise.reject(failure),
    });

    await expect(
      openImportedPracticeFile("broken.mid", new Uint8Array([1])),
    ).rejects.toThrow("MIDI file has no notes.");
    await flush();

    expect(isAwaitingImportedNotation("broken.mid")).toBe(false);
  });
});
