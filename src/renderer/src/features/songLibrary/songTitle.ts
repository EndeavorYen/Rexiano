/**
 * Built-in songs carry an English title (also their stored identity: recents,
 * sessions and the player header use it) and, for well-known songs, the name
 * a child in Taiwan knows (#308). Display picks by UI language; identity
 * never changes.
 */
interface TitledSong {
  title: string;
  titleZhTW?: string;
}

export interface SongDisplayTitle {
  primary: string;
  /** The English title, shown smaller when the primary one is Chinese */
  secondary: string | null;
}

export function songDisplayTitle(
  song: TitledSong,
  /** UI language code, e.g. "en" or "zh-TW" */
  lang: string,
): SongDisplayTitle {
  if (lang === "zh-TW" && song.titleZhTW) {
    return { primary: song.titleZhTW, secondary: song.title };
  }
  return { primary: song.title, secondary: null };
}

/** Display a stored English title (recents, player header) in the UI language. */
export function displayTitleForName(
  name: string,
  songs: readonly TitledSong[],
  lang: string,
): string {
  const song = songs.find((candidate) => candidate.title === name);
  return song ? songDisplayTitle(song, lang).primary : name;
}
