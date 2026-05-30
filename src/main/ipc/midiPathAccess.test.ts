import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const mocks = vi.hoisted(() => ({
  userDataPath: "",
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => mocks.userDataPath),
  },
}));

import {
  approveMidiFilePath,
  approveMidiFolderPath,
  clearApprovedMidiPathAccessForTests,
  isApprovedMidiFilePath,
} from "./midiPathAccess";

describe("midiPathAccess", () => {
  let tempUserDataPath: string;

  beforeEach(() => {
    tempUserDataPath = mkdtempSync(join(tmpdir(), "rexiano-midi-access-"));
    mocks.userDataPath = tempUserDataPath;
    clearApprovedMidiPathAccessForTests();
  });

  afterEach(() => {
    rmSync(tempUserDataPath, { recursive: true, force: true });
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

  test("keeps approved MIDI files available after in-memory access resets", () => {
    approveMidiFilePath("/Users/rex/Music/Scale.mid");
    clearApprovedMidiPathAccessForTests();

    expect(isApprovedMidiFilePath("/Users/rex/Music/Scale.mid")).toBe(true);
  });

  test("keeps approved watched folders available after in-memory access resets", () => {
    approveMidiFolderPath("/Users/rex/Music");
    clearApprovedMidiPathAccessForTests();

    expect(isApprovedMidiFilePath("/Users/rex/Music/Sub/Etude.kar")).toBe(true);
  });

  test("rejects non-MIDI paths and traversal-adjacent prefixes", () => {
    approveMidiFolderPath("/Users/rex/Music");

    expect(isApprovedMidiFilePath("/Users/rex/Music/notes.txt")).toBe(false);
    expect(isApprovedMidiFilePath("/Users/rex/MusicEvil/Scale.mid")).toBe(
      false,
    );
  });
});
