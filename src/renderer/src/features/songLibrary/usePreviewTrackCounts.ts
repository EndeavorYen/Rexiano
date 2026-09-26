import { useState, useEffect } from "react";
import { parseImportedPracticeFile } from "../../engines/score/decodeImportedPracticeFile";
import type { BuiltinSongMeta } from "../../../../shared/types";
import type { ImportedSongRecord } from "./importedSongMetadata";

export function previewTrackCountKey(
  kind: "builtin" | "imported",
  sourceId: string,
): string {
  return `${kind}:${sourceId}`;
}

export function usePreviewTrackCounts(
  selectedSong: BuiltinSongMeta | null,
  selectedImportedSong: ImportedSongRecord | null,
): Record<string, number> {
  const [previewTrackCounts, setPreviewTrackCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const previewSource =
      selectedSong !== null
        ? {
            kind: "builtin" as const,
            sourceId: selectedSong.id,
            load: () => window.api.loadBuiltinSong(selectedSong.id),
          }
        : selectedImportedSong !== null
          ? {
              kind: "imported" as const,
              sourceId: selectedImportedSong.id,
              load: () =>
                window.api.loadMidiPath(selectedImportedSong.sourcePath),
            }
          : null;

    if (!previewSource) return;
    const source = previewSource;

    const key = previewTrackCountKey(source.kind, source.sourceId);
    if (previewTrackCounts[key] !== undefined) return;

    let cancelled = false;

    async function loadPreviewTrackCount(): Promise<void> {
      try {
        const result = await source.load();
        if (!result || cancelled) return;
        const parsed = parseImportedPracticeFile(result.fileName, result.data);
        if (cancelled) return;
        setPreviewTrackCounts((current) =>
          current[key] !== undefined
            ? current
            : { ...current, [key]: parsed.tracks.length },
        );
      } catch (e) {
        console.error("Failed to load song preview metadata:", e);
      }
    }

    void loadPreviewTrackCount();

    return () => {
      cancelled = true;
    };
  }, [previewTrackCounts, selectedImportedSong, selectedSong]);

  return previewTrackCounts;
}
