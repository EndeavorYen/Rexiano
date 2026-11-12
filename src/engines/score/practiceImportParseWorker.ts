/**
 * Turns an imported practice file into a song and its notation, off the main
 * thread.
 *
 * Both steps are pure (`parseImportedPracticeFile` for the file, quantization
 * and voice splitting in `MidiToNotation`), and together they are what makes
 * opening a large import freeze the page for most of a second.
 *
 * The song is posted as soon as it is parsed so the practice view can open; the
 * notation follows when the conversion is done. If that conversion throws, the
 * main thread still gets the song and converts it the way it always did.
 */
import { parseImportedPracticeFile } from "./decodeImportedPracticeFile";
import { convertSongToNotation } from "@renderer/features/sheetMusic/MidiToNotation";
import type { NotationData } from "@renderer/features/sheetMusic/types";
import type {
  PracticeImportParseRequest,
  PracticeImportParseResponse,
} from "./practiceImportWorkerClient";

interface ImportParseWorkerScope {
  onmessage: ((event: MessageEvent<PracticeImportParseRequest>) => void) | null;
  postMessage: (message: PracticeImportParseResponse) => void;
}

declare const self: ImportParseWorkerScope;

self.onmessage = (event: MessageEvent<PracticeImportParseRequest>) => {
  const { id, fileName, data } = event.data;
  try {
    // `parseImportedPracticeFile` takes bytes as a plain number list, the shape
    // `window.api` already hands the app; boxing it here keeps that cost off-thread.
    const song = parseImportedPracticeFile(fileName, Array.from(data));
    self.postMessage({ id, kind: "song", song });

    let notation: NotationData | null = null;
    try {
      notation = convertSongToNotation(song);
    } catch {
      notation = null;
    }
    self.postMessage({ id, kind: "notation", notation });
  } catch (error) {
    self.postMessage({
      id,
      kind: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
