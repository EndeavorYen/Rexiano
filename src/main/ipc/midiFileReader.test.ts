import { describe, expect, test, vi } from "vitest";
import { MAX_MIDI_FILE_BYTES } from "../../shared/midiFileLimits";
import {
  MidiFileReadError,
  readBoundedMidiFile,
  type MidiFileHandle,
  type MidiFileReadOperations,
} from "./midiFileReader";

function operationsFor(
  size: number,
  data = Buffer.from([77, 84, 104, 100]),
  regular = true,
): MidiFileReadOperations & { handle: MidiFileHandle } {
  const handle: MidiFileHandle = {
    stat: vi.fn(async () => ({
      size,
      identity: "1:1",
      isFile: () => regular,
    })),
    read: vi.fn(async () => data),
    realpath: vi.fn(async () => "/approved/song.mid"),
    close: vi.fn(async () => undefined),
  };
  return {
    handle,
    open: vi.fn(async () => handle),
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
      expect(operations.open).toHaveBeenCalledWith("/approved/song.mid");
      expect(operations.handle.read).toHaveBeenCalledWith(size);
      expect(operations.handle.close).toHaveBeenCalledOnce();
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
    expect(operations.handle.read).not.toHaveBeenCalled();
    expect(operations.handle.close).toHaveBeenCalledOnce();
  });

  test("rejects non-regular paths before reading", async () => {
    const operations = operationsFor(1, Buffer.alloc(0), false);

    await expect(
      readBoundedMidiFile("/approved/folder.mid", operations),
    ).rejects.toMatchObject({ reason: "not-regular" });
    expect(operations.handle.read).not.toHaveBeenCalled();
    expect(operations.handle.close).toHaveBeenCalledOnce();
  });

  test("reads through the opened fd so a later path swap cannot enlarge the payload", async () => {
    const operations = operationsFor(4, Buffer.from([1, 2, 3, 4]));

    await expect(
      readBoundedMidiFile("/approved/replaced.mid", operations),
    ).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
    expect(operations.open).toHaveBeenCalledOnce();
    expect(operations.handle.read).toHaveBeenCalledWith(4);
  });

  test("catches a forged small stat when the fd read is oversized", async () => {
    const operations = operationsFor(1, Buffer.alloc(MAX_MIDI_FILE_BYTES + 1));

    await expect(
      readBoundedMidiFile("/approved/replaced.mid", operations),
    ).rejects.toBeInstanceOf(MidiFileReadError);
    expect(operations.handle.close).toHaveBeenCalledOnce();
  });

  test("propagates open, stat, and read failures without retrying an unsafe path", async () => {
    const openFailure = new Error("open failed");
    await expect(
      readBoundedMidiFile("/approved/song.mid", {
        open: vi.fn(async () => {
          throw openFailure;
        }),
      }),
    ).rejects.toBe(openFailure);

    const statFailure = new Error("stat failed");
    const statOperations = operationsFor(1);
    vi.mocked(statOperations.handle.stat).mockRejectedValue(statFailure);
    await expect(
      readBoundedMidiFile("/approved/song.mid", statOperations),
    ).rejects.toBe(statFailure);
    expect(statOperations.handle.read).not.toHaveBeenCalled();
    expect(statOperations.handle.close).toHaveBeenCalledOnce();

    const readFailure = new Error("read failed");
    const readOperations = operationsFor(1);
    vi.mocked(readOperations.handle.read).mockRejectedValue(readFailure);
    await expect(
      readBoundedMidiFile("/approved/song.mid", readOperations),
    ).rejects.toBe(readFailure);
    expect(readOperations.handle.close).toHaveBeenCalledOnce();
  });
});
