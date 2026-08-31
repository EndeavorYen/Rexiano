import { musicXmlToMidi } from "./musicXmlToMidi";
import { parseMidiFile } from "../midi/MidiFileParser";
import type { ParsedSong } from "../midi/types";
import { isScoreImportPath } from "@shared/practiceImportFile";

export function decodeImportedPracticeFile(
  fileName: string,
  data: number[],
): number[] {
  if (!isScoreImportPath(fileName)) return data;
  const xml = new TextDecoder().decode(Uint8Array.from(data));
  return Array.from(musicXmlToMidi(xml).toArray());
}

export function parseImportedPracticeFile(
  fileName: string,
  data: number[],
): ParsedSong {
  return parseMidiFile(fileName, decodeImportedPracticeFile(fileName, data));
}
