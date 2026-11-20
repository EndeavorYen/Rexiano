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

/**
 * The line under a song name in the preview: who wrote it. In Chinese the
 * English title is left out (a child cannot read it) and "Traditional" is
 * said in words; in English the English title stays as before.
 */
export function songByline(
  song: { secondary: string | null; composer: string },
  lang: string,
  t: (key: "songbook.composer.traditional") => string,
): string {
  const composer =
    song.composer.trim().toLowerCase() === "traditional"
      ? t("songbook.composer.traditional")
      : song.composer;
  const parts = lang === "zh-TW" ? [composer] : [song.secondary, composer];
  return parts.filter(Boolean).join(" · ");
}
