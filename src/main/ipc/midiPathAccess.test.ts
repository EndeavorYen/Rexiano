import { beforeEach, describe, expect, test } from "vitest";
import {
  approveMidiFilePath,
  approveMidiFolderPath,
  clearApprovedMidiPathAccessForTests,
  isApprovedMidiFilePath,
} from "./midiPathAccess";

describe("midiPathAccess", () => {
  beforeEach(() => {
    clearApprovedMidiPathAccessForTests();
  });

  test("rejects safe-looking MIDI paths until the user approves them", () => {
    expect(isApprovedMidiFilePath("/Users/rex/Music/Scale.mid")).toBe(false);

    approveMidiFilePath("/Users/rex/Music/Scale.mid");

    expect(isApprovedMidiFilePath("/Users/rex/Music/Scale.mid")).toBe(true);
  });

  test("allows MIDI files inside an approved watched folder", () => {
    approveMidiFolderPath("/Users/rex/Music");

    expect(isApprovedMidiFilePath("/Users/rex/Music/Sub/Etude.kar")).toBe(true);
    expect(isApprovedMidiFilePath("/Users/rex/Secrets/Etude.mid")).toBe(false);
  });

  test("rejects non-MIDI paths and traversal-adjacent prefixes", () => {
    approveMidiFolderPath("/Users/rex/Music");

    expect(isApprovedMidiFilePath("/Users/rex/Music/notes.txt")).toBe(false);
    expect(isApprovedMidiFilePath("/Users/rex/MusicEvil/Scale.mid")).toBe(
      false,
    );
  });
});
