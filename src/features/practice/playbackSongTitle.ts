import {
  displayTitleForName,
  songDisplayTitle,
} from "../songLibrary/songTitle";

interface BuiltinLike {
  title: string;
  titleZhTW?: string;
}

interface ImportedLike {
  sourcePath: string;
  title: string;
}

const MIDI_EXTENSION = /\.(midi?|kar|musicxml|xml)$/i;

function baseName(path: string): string {
  return path.replaceAll("\\", "/").split("/").pop()?.trim() ?? "";
}

/**
 * The name the player shows for the loaded song: the same one the shelf
 * shows. Built-in songs follow the UI language; imported songs use the title
 * the shelf holds (including a rename); anything else loses its extension.
 */
export function playbackSongTitle(
  fileName: string,
  builtin: readonly BuiltinLike[],
  imported: readonly ImportedLike[],
  lang: string,
): string {
  const builtinHit = builtin.find((song) => song.title === fileName);
  if (builtinHit) return songDisplayTitle(builtinHit, lang).primary;
  const importedHit = imported.find(
    (song) => baseName(song.sourcePath) === fileName,
  );
  if (importedHit?.title.trim()) return importedHit.title.trim();
  const stripped = fileName.replace(MIDI_EXTENSION, "").trim();
  return stripped || displayTitleForName(fileName, builtin, lang);
}
