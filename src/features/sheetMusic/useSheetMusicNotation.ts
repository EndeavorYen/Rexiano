import { useState, useMemo, useSyncExternalStore } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import {
  resolveBuiltinNotationMetadata,
  type BuiltinNotationMetadata,
} from "./builtinNotationMetadata";
import { convertSongToNotation } from "./MidiToNotation";
import {
  getCachedImportedNotation,
  isAwaitingImportedNotation,
  subscribeImportedNotation,
} from "./importedNotationCache";
import { TempoMap } from "@renderer/engines/midi/TempoMap";
import type { NotationData } from "./types";

export interface UseSheetMusicNotationOptions {
  song: ParsedSong | null;
}

export function buildNotationData(
  song: ParsedSong | null,
  fixtureData: NotationData | null,
  builtinMeta: BuiltinNotationMetadata | null,
  offThread = song ? getCachedImportedNotation(song) : null,
  awaitingNotation = false,
): NotationData | null {
  if (fixtureData) return fixtureData;
  if (!song) return null;

  // An import may already have been quantized and voice-split in a worker. That
  // result is only reusable when no built-in key/meter tags change the answer.
  if (!builtinMeta) {
    if (offThread) return offThread;
    // Still running there: repeating it here would block the page twice.
    if (awaitingNotation) return null;
  }

  return convertSongToNotation(song, {
    keySignature: builtinMeta?.keySignature,
    timeSignatureTop: builtinMeta?.timeSignatureTop,
    timeSignatureBottom: builtinMeta?.timeSignatureBottom,
  });
}

export function buildNotationTempoMap(
  song: ParsedSong | null,
  hasFixtureData: boolean,
): TempoMap | null {
  if (hasFixtureData || !song) return null;
  return TempoMap.fromSong(song);
}

export interface UseSheetMusicNotationResult {
  sheetFixtureNotationData: NotationData | null;
  setSheetFixtureNotationData: (data: NotationData | null) => void;
  builtinNotationMetadata: BuiltinNotationMetadata | null;
  notationData: NotationData | null;
  notationTempoMap: TempoMap | null;
}

export function useSheetMusicNotation({
  song,
}: UseSheetMusicNotationOptions): UseSheetMusicNotationResult {
  const builtinSongs = useSongLibraryStore((s) => s.songs);
  const [sheetFixtureNotationData, setSheetFixtureNotationData] =
    useState<NotationData | null>(null);
  // An import's notation can land after the song has already opened.
  const offThreadNotation = useSyncExternalStore(
    subscribeImportedNotation,
    () => (song ? getCachedImportedNotation(song) : null),
    () => null,
  );
  const awaitingOffThreadNotation = useSyncExternalStore(
    subscribeImportedNotation,
    () => (song ? isAwaitingImportedNotation(song.fileName) : false),
    () => false,
  );

  const builtinNotationMetadata = useMemo(() => {
    if (!song) return null;
    return resolveBuiltinNotationMetadata(song.fileName, builtinSongs);
  }, [builtinSongs, song]);

  const notationData = useMemo(
    () =>
      buildNotationData(
        song,
        sheetFixtureNotationData,
        builtinNotationMetadata,
        offThreadNotation,
        awaitingOffThreadNotation,
      ),
    [
      offThreadNotation,
      awaitingOffThreadNotation,
      builtinNotationMetadata,
      sheetFixtureNotationData,
      song,
    ],
  );

  const notationTempoMap = useMemo(
    () => buildNotationTempoMap(song, sheetFixtureNotationData !== null),
    [sheetFixtureNotationData, song],
  );

  return {
    sheetFixtureNotationData,
    setSheetFixtureNotationData,
    builtinNotationMetadata,
    notationData,
    notationTempoMap,
  };
}
