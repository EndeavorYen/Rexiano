import { describe, expect, test, vi } from "vitest";
import {
  AssociatedMidiFileOpenQueue,
  findAssociatedMidiArgument,
} from "./associatedMidiFileOpen";

describe("associated MIDI file-open lifecycle", () => {
  test.each([
    [
      "win32",
      ["C:\\Rexiano\\Rexiano.exe", "--flag", "C:\\Music\\Lesson.MID"],
      "C:\\Music\\Lesson.MID",
    ],
    [
      "linux",
      ["/opt/rexiano/rexiano", ".", "/home/rex/music/lesson.midi"],
      "/home/rex/music/lesson.midi",
    ],
    ["darwin", ["/Applications/Rexiano", "--inspect"], null],
  ] as const)(
    "parses %s argv without treating flags as files",
    (platform, argv, expected) => {
      expect(findAssociatedMidiArgument(argv, platform)).toBe(expected);
    },
  );

  test("ignores nonexistent, non-regular, and unrelated candidates", async () => {
    const authorize = vi.fn(async (candidate: string) =>
      candidate === "/music/valid.mid" ? candidate : null,
    );
    const queue = new AssociatedMidiFileOpenQueue(authorize);

    await expect(queue.enqueue("/music/notes.txt")).resolves.toBe(false);
    await expect(queue.enqueue("/music/missing.mid")).resolves.toBe(false);
    await expect(queue.enqueue("/music/valid.mid")).resolves.toBe(true);
    expect(queue.take()).toBe("/music/valid.mid");
  });

  test("serializes validation and routes only the latest valid pending file once", async () => {
    let releaseFirst: ((path: string | null) => void) | undefined;
    const authorize = vi.fn((candidate: string) =>
      candidate.endsWith("first.mid")
        ? new Promise<string | null>((resolve) => {
            releaseFirst = resolve;
          })
        : Promise.resolve(candidate),
    );
    const queue = new AssociatedMidiFileOpenQueue(authorize);

    const first = queue.enqueue("/music/first.mid");
    const second = queue.enqueue("/music/second.mid");
    await Promise.resolve();
    releaseFirst?.("/music/first.mid");

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(queue.take()).toBe("/music/second.mid");
    expect(queue.take()).toBeNull();
  });

  test("deduplicates the same pending canonical target", async () => {
    const queue = new AssociatedMidiFileOpenQueue(async () =>
      Promise.resolve("/canonical/song.mid"),
    );

    await expect(queue.enqueue("/alias/song.mid")).resolves.toBe(true);
    await expect(queue.enqueue("/canonical/song.mid")).resolves.toBe(false);
    expect(queue.take()).toBe("/canonical/song.mid");
  });
});
