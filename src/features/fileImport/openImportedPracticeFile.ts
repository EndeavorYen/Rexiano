import { startImportedPracticeFileOffMainThread } from "@renderer/engines/score/practiceImportWorkerClient";
import {
  beginImportedNotationWait,
  rememberImportedNotation,
} from "@renderer/features/sheetMusic/importedNotationCache";
import type { ParsedSong } from "@renderer/engines/midi/types";

/**
 * Opens an imported practice file, keeping the page responsive.
 *
 * Resolves as soon as the song is parsed off the main thread; its notation
 * follows from the same worker and is remembered for the sheet panel, which
 * picks it up when the conversion lands. If no worker is available the song is
 * parsed here and the sheet converts it as before.
 */
export function openImportedPracticeFile(
  fileName: string,
  data: Uint8Array | number[],
): Promise<ParsedSong> {
  const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data);
  const releaseWait = beginImportedNotationWait(fileName);
  const { song, notation } = startImportedPracticeFileOffMainThread(
    fileName,
    bytes,
  );
  void notation.then((result) => {
    if (result) rememberImportedNotation(result.song, result.notation);
    releaseWait();
  }, releaseWait);
  return song;
}
