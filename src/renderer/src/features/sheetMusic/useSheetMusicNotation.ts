import { useState, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import {
  resolveBuiltinNotationMetadata,
  type BuiltinNotationMetadata,
} from "./builtinNotationMetadata";
import { convertSongToNotation } from "./MidiToNotation";
import { TempoMap } from "@renderer/engines/midi/TempoMap";
import type { NotationData } from "./types";

export interface UseSheetMusicNotationOptions {
  song: ParsedSong | null;
}

export function buildNotationData(
  song: ParsedSong | null,
  fixtureData: NotationData | null,
  builtinMeta: BuiltinNotationMetadata | null,
): NotationData | null {
  if (fixtureData) return fixtureData;
  if (!song) return null;

  return convertSongToNotation(song, {
    keySignature: builtinMeta?.keySignature ?? 0,
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
      ),
    [builtinNotationMetadata, sheetFixtureNotationData, song],
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
