import { open as fsOpen, realpath as fsRealpath } from "fs/promises";
import {
  MAX_MIDI_FILE_BYTES,
  MIDI_FILE_TOO_LARGE_DIAGNOSTIC,
} from "../../shared/midiFileLimits";

export type MidiFileReadErrorReason = "not-regular" | "too-large";

export class MidiFileReadError extends Error {
  readonly reason: MidiFileReadErrorReason;

  constructor(reason: MidiFileReadErrorReason) {
    super(
      reason === "too-large"
        ? `${MIDI_FILE_TOO_LARGE_DIAGNOSTIC}: MIDI file exceeds the supported 8 MiB limit.`
        : "MIDI path is not a regular file.",
    );
    this.name = "MidiFileReadError";
    this.reason = reason;
  }
}

interface FileStats {
  size: number;
  identity: string;
  isFile(): boolean;
}

export interface MidiFileHandle {
  stat(): Promise<FileStats>;
  read(maxBytes: number): Promise<Buffer>;
  realpath(): Promise<string>;
  close(): Promise<void>;
}

export interface MidiFileReadOperations {
  open(path: string): Promise<MidiFileHandle>;
}

const defaultOperations: MidiFileReadOperations = {
  async open(path: string): Promise<MidiFileHandle> {
    const file = await fsOpen(path, "r");
    const openedPath = await fsRealpath(path);
    return {
      async stat() {
        const stats = await file.stat();
        return {
          size: stats.size,
          identity: `${stats.dev}:${stats.ino}`,
          isFile: () => stats.isFile(),
        };
      },
      async read(maxBytes: number) {
        const buffer = Buffer.alloc(maxBytes);
        const { bytesRead } = await file.read(buffer, 0, maxBytes, 0);
        return buffer.subarray(0, bytesRead);
      },
      async realpath() {
        return openedPath;
      },
      async close() {
        await file.close();
      },
    };
  },
};

export { defaultOperations as midiFileReadOperations };

export async function readBoundedMidiFile(
  filePath: string,
  operations: MidiFileReadOperations = defaultOperations,
): Promise<Buffer> {
  const handle = await operations.open(filePath);
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile()) throw new MidiFileReadError("not-regular");
    if (fileStats.size > MAX_MIDI_FILE_BYTES) {
      throw new MidiFileReadError("too-large");
    }

    const buffer = await handle.read(fileStats.size);
    if (buffer.byteLength > MAX_MIDI_FILE_BYTES) {
      throw new MidiFileReadError("too-large");
    }
    return buffer;
  } finally {
    await handle.close();
  }
}
