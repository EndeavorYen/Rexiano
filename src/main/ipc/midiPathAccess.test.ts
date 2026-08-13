import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
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
  resolveApprovedMidiFilePath,
} from "./midiPathAccess";

describe("midiPathAccess", () => {
  let tempUserDataPath: string;
  let musicPath: string;
  let outsidePath: string;

  beforeEach(() => {
    tempUserDataPath = mkdtempSync(join(tmpdir(), "rexiano-midi-access-"));
    musicPath = join(tempUserDataPath, "Music");
    outsidePath = join(tempUserDataPath, "Secrets");
    mkdirSync(join(musicPath, "Sub"), { recursive: true });
    mkdirSync(outsidePath, { recursive: true });
    writeFileSync(join(musicPath, "Scale.mid"), "midi");
    writeFileSync(join(musicPath, "Sub", "Etude.kar"), "midi");
    writeFileSync(join(musicPath, "notes.txt"), "private");
    writeFileSync(join(outsidePath, "Private.mid"), "private");
    mocks.userDataPath = tempUserDataPath;
    clearApprovedMidiPathAccessForTests();
  });

  afterEach(() => {
    rmSync(tempUserDataPath, { recursive: true, force: true });
  });

  test("rejects safe-looking MIDI paths until the user approves them", async () => {
    const filePath = join(musicPath, "Scale.mid");
    await expect(isApprovedMidiFilePath(filePath)).resolves.toBe(false);

    await approveMidiFilePath(filePath);

    await expect(isApprovedMidiFilePath(filePath)).resolves.toBe(true);
  });

  test("allows regular MIDI files inside an approved canonical folder", async () => {
    await approveMidiFolderPath(musicPath);

    await expect(
      isApprovedMidiFilePath(join(musicPath, "Sub", "Etude.kar")),
    ).resolves.toBe(true);
    await expect(
      isApprovedMidiFilePath(join(outsidePath, "Private.mid")),
    ).resolves.toBe(false);
  });

  test("keeps an approved MIDI file available after an in-memory reset", async () => {
    const filePath = join(musicPath, "Scale.mid");
    await approveMidiFilePath(filePath);
    clearApprovedMidiPathAccessForTests();

    await expect(isApprovedMidiFilePath(filePath)).resolves.toBe(true);
  });

  test("requires watched folders to be reauthorized after restore/restart", async () => {
    const nestedPath = join(musicPath, "Sub", "Etude.kar");
    await approveMidiFolderPath(musicPath);
    clearApprovedMidiPathAccessForTests();

    await expect(isApprovedMidiFilePath(nestedPath)).resolves.toBe(false);
  });

  test("blocks a symlink that escapes an approved folder", async () => {
    const escapePath = join(musicPath, "escape.mid");
    symlinkSync(join(outsidePath, "Private.mid"), escapePath);
    await approveMidiFolderPath(musicPath);

    await expect(resolveApprovedMidiFilePath(escapePath)).resolves.toBeNull();
    await expect(isApprovedMidiFilePath(escapePath)).resolves.toBe(false);
  });

  test("does not transfer one-file approval to a replaced filesystem object", async () => {
    const filePath = join(musicPath, "Scale.mid");
    await approveMidiFilePath(filePath);
    rmSync(filePath);
    writeFileSync(filePath, "replacement");

    await expect(isApprovedMidiFilePath(filePath)).resolves.toBe(false);
  });

  test("rejects non-MIDI paths and traversal-adjacent prefixes", async () => {
    const adjacentFolder = join(tempUserDataPath, "MusicEvil");
    mkdirSync(adjacentFolder);
    writeFileSync(join(adjacentFolder, "Scale.mid"), "midi");
    await approveMidiFolderPath(musicPath);

    await expect(
      isApprovedMidiFilePath(join(musicPath, "notes.txt")),
    ).resolves.toBe(false);
    await expect(
      isApprovedMidiFilePath(join(adjacentFolder, "Scale.mid")),
    ).resolves.toBe(false);
  });
});
