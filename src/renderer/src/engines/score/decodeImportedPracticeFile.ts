import { musicXmlToMidi } from "./musicXmlToMidi";
import { isScoreImportPath } from "@shared/practiceImportFile";

export function decodeImportedPracticeFile(
  fileName: string,
  data: number[],
): number[] {
  if (!isScoreImportPath(fileName)) return data;
  const xml = new TextDecoder().decode(Uint8Array.from(data));
  return Array.from(musicXmlToMidi(xml).toArray());
}
