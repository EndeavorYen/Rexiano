import { songDisplayTitle } from "../songLibrary/songTitle";
import type { WeekSong } from "./weekReport";

/** Whole minutes for display; a short practice still reads as 1, not 0. */
export function displayMinutes(minutes: number): number {
  return minutes > 0 ? Math.max(1, Math.floor(minutes + 1e-9)) : 0;
}

export function songLabel(song: WeekSong, lang: string): string {
  return song.song ? songDisplayTitle(song.song, lang).primary : song.title;
}

/** "11/17" from "2026-11-17". */
export function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}
