import { readFile, stat } from "fs/promises";
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
  isFile(): boolean;
}

export interface MidiFileReadOperations {
  stat(path: string): Promise<FileStats>;
  readFile(path: string): Promise<Buffer>;
}

const defaultOperations: MidiFileReadOperations = { stat, readFile };

export async function readBoundedMidiFile(
  filePath: string,
  operations: MidiFileReadOperations = defaultOperations,
): Promise<Buffer> {
  const fileStats = await operations.stat(filePath);
  if (!fileStats.isFile()) throw new MidiFileReadError("not-regular");
  if (fileStats.size > MAX_MIDI_FILE_BYTES) {
    throw new MidiFileReadError("too-large");
  }

  const buffer = await operations.readFile(filePath);
  // Recheck actual bytes in case the target was replaced between stat/read.
  if (buffer.byteLength > MAX_MIDI_FILE_BYTES) {
    throw new MidiFileReadError("too-large");
  }
  return buffer;
}
