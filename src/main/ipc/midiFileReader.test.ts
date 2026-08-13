import { describe, expect, test, vi } from "vitest";
import { MAX_MIDI_FILE_BYTES } from "../../shared/midiFileLimits";
import {
  MidiFileReadError,
  readBoundedMidiFile,
  type MidiFileReadOperations,
} from "./midiFileReader";

function operationsFor(
  size: number,
  data = Buffer.from([77, 84, 104, 100]),
  regular = true,
): MidiFileReadOperations {
  return {
    stat: vi.fn(async () => ({ size, isFile: () => regular })),
    readFile: vi.fn(async () => data),
  };
}

describe("bounded MIDI file reads", () => {
  test.each([MAX_MIDI_FILE_BYTES - 1, MAX_MIDI_FILE_BYTES])(
    "accepts a regular file at %i bytes",
    async (size) => {
      const operations = operationsFor(size);

      await expect(
        readBoundedMidiFile("/approved/song.mid", operations),
      ).resolves.toEqual(Buffer.from([77, 84, 104, 100]));
      expect(operations.readFile).toHaveBeenCalledOnce();
    },
  );

  test("rejects limit + 1 before reading or IPC expansion", async () => {
    const operations = operationsFor(MAX_MIDI_FILE_BYTES + 1);

    await expect(
      readBoundedMidiFile("/approved/huge.mid", operations),
    ).rejects.toMatchObject({
      name: "MidiFileReadError",
      reason: "too-large",
    });
    expect(operations.readFile).not.toHaveBeenCalled();
  });

  test("rejects non-regular paths before reading", async () => {
    const operations = operationsFor(1, Buffer.alloc(0), false);

    await expect(
      readBoundedMidiFile("/approved/folder.mid", operations),
    ).rejects.toMatchObject({ reason: "not-regular" });
    expect(operations.readFile).not.toHaveBeenCalled();
  });

  test("catches a forged small stat when the read races to oversized content", async () => {
    const operations = operationsFor(1, Buffer.alloc(MAX_MIDI_FILE_BYTES + 1));

    await expect(
      readBoundedMidiFile("/approved/replaced.mid", operations),
    ).rejects.toBeInstanceOf(MidiFileReadError);
  });

  test("propagates stat and read failures without retrying an unsafe path", async () => {
    const statFailure = new Error("stat failed");
    const statOperations = operationsFor(1);
    vi.mocked(statOperations.stat).mockRejectedValue(statFailure);
    await expect(
      readBoundedMidiFile("/approved/song.mid", statOperations),
    ).rejects.toBe(statFailure);
    expect(statOperations.readFile).not.toHaveBeenCalled();

    const readFailure = new Error("read failed");
    const readOperations = operationsFor(1);
    vi.mocked(readOperations.readFile).mockRejectedValue(readFailure);
    await expect(
      readBoundedMidiFile("/approved/song.mid", readOperations),
    ).rejects.toBe(readFailure);
  });
});
