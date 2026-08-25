import { describe, expect, test, vi } from "vitest";
import {
  reduceImportErrorForEvent,
  getMidiFileExtension,
  getUnsupportedMidiDropError,
  getFileNameFromPath,
  removeRecentForRecovery,
  getOversizedMidiImportError,
  getMidiReadFailureError,
} from "./useMidiImportActions";
import {
  MAX_MIDI_FILE_BYTES,
  MIDI_FILE_TOO_LARGE_DIAGNOSTIC,
} from "@shared/midiFileLimits";

describe("useMidiImportActions helpers", () => {
  test("drag hover preserves recovery while explicit resolution clears it", () => {
    const current = { message: "recover me" };

    expect(reduceImportErrorForEvent(current, "drag-enter")).toBe(current);
    expect(reduceImportErrorForEvent(current, "drag-leave")).toBe(current);
    expect(reduceImportErrorForEvent(current, "dismiss")).toBeNull();
    expect(reduceImportErrorForEvent(current, "recovery-start")).toBeNull();
    expect(reduceImportErrorForEvent(current, "import-succeeded")).toBeNull();
  });

  test("a failed recovery can replace the cleared alert with its new error", () => {
    const replacement = { message: "retry failed differently" };

    expect(
      reduceImportErrorForEvent(null, {
        type: "show",
        error: replacement,
      }),
    ).toBe(replacement);
  });

  test("normalizes MIDI file extensions for drag-and-drop", () => {
    expect(getMidiFileExtension("song.MID")).toBe(".mid");
    expect(getMidiFileExtension("score.midi")).toBe(".midi");
    expect(getMidiFileExtension("untitled")).toBe("");
  });

  test("builds unsupported-type errors for non-MIDI drops", () => {
    expect(getUnsupportedMidiDropError("notes.txt")).toEqual({
      kind: "unsupported-type",
      ext: ".txt",
      fileName: "notes.txt",
    });
    expect(getUnsupportedMidiDropError("song.mid")).toBeNull();
    expect(getUnsupportedMidiDropError("au-clair.musicxml")).toBeNull();
  });

  test("rejects oversized drops before FileReader allocation", () => {
    expect(
      getOversizedMidiImportError({
        name: "huge.mid",
        size: MAX_MIDI_FILE_BYTES + 1,
      }),
    ).toEqual({
      kind: "oversized",
      fileName: "huge.mid",
    });
    expect(
      getOversizedMidiImportError({
        name: "exact.mid",
        size: MAX_MIDI_FILE_BYTES,
      }),
    ).toBeNull();
  });

  test("routes main-process size rejection into persistent oversized recovery", () => {
    const diagnostic = new Error(
      `${MIDI_FILE_TOO_LARGE_DIAGNOSTIC}: 8 MiB limit`,
    );
    expect(
      getMidiReadFailureError(diagnostic, "huge.mid", "/huge.mid"),
    ).toEqual({
      kind: "oversized",
      fileName: "huge.mid",
      path: "/huge.mid",
      diagnostic,
    });
    expect(
      getMidiReadFailureError(new Error("EACCES"), "locked.mid"),
    ).toMatchObject({ kind: "read-failed", fileName: "locked.mid" });
  });

  test("extracts filenames from native paths", () => {
    expect(getFileNameFromPath("/tmp/song.mid")).toBe("song.mid");
    expect(getFileNameFromPath("C:\\Users\\Simon\\song.midi")).toBe(
      "song.midi",
    );
    expect(getFileNameFromPath("")).toBeUndefined();
  });

  test("awaits confirmed recent removal before reporting recovery success", async () => {
    let confirmRemoval: ((removed: boolean) => void) | undefined;
    const remove = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          confirmRemoval = resolve;
        }),
    );

    const recovery = removeRecentForRecovery("/stale.mid", remove);
    let settled = false;
    void recovery.finally(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    confirmRemoval?.(true);
    await expect(recovery).resolves.toEqual({ ok: true });
  });

  test("keeps recovery active when recent removal is declined or rejects", async () => {
    await expect(
      removeRecentForRecovery("/stale.mid", async () => false),
    ).resolves.toEqual({ ok: false });

    const diagnostic = new Error("recents file is read-only");
    await expect(
      removeRecentForRecovery("/stale.mid", async () => {
        throw diagnostic;
      }),
    ).resolves.toEqual({ ok: false, diagnostic });

    await expect(
      removeRecentForRecovery(undefined, async () => true),
    ).resolves.toEqual({ ok: false });
  });
});
