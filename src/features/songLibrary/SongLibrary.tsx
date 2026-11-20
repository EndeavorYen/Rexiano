import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { parseImportedPracticeFile } from "../../engines/score/decodeImportedPracticeFile";
import { useSongStore } from "../../stores/useSongStore";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { usePracticeStore } from "../../stores/usePracticeStore";
import {
  preferredDisplayModeForSource,
  practiceSourceFromFileName,
} from "../../engines/score/builtinScoreSource";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";
import { useProgressStore } from "../../stores/useProgressStore";
import { openBuiltinSong, recentOpenTarget } from "./openBuiltinSong";
import { queueRecentFile } from "./pendingRecent";
import {
  buildImportedSongActivity,
  buildImportedSongSelectionPreviewModel,
  buildSongActivity,
  buildSongSelectionPreviewModel,
  type SongSelectionPreviewModel,
} from "./songLibrarySelectors";
import {
  getRecentFileRecovery,
  type RecentFileRecovery,
} from "./recentFileRecovery";
import type { ImportedSongRecord } from "./importedSongMetadata";
import { useTranslation } from "../../i18n/useTranslation";
import type { PracticeSessionIntent } from "../practice/sessionIntent";
import type { RecentFile } from "../../shared/types";
import { SongLibraryHeader } from "./SongLibraryHeader";
import { SongSelectionPreviewPanel } from "./SongSelectionPreviewPanel";
import { RecentSongsSection } from "./RecentSongsSection";
import { SongbookView } from "./SongbookView";
import { SongLibraryFilters } from "./SongLibraryFilters";
import {
  buildSongbook,
  selectLooseRecentFiles,
  type Songbook,
} from "./songShelves";
import {
  SongLibraryMidiDrawer,
  SongLibraryPianoButton,
} from "./SongLibraryMidiDrawer";
import {
  useLibraryReturnFocus,
  rememberLibraryReturnFocus,
} from "./useLibraryReturnFocus";
import {
  createImportedMetadataDraft,
  createImportedMetadataPatch,
  type ImportedSongMetadataDraft,
} from "./importedSongMetadata";

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
  onBack?: () => void;
  onOpenSettings?: () => void;
  onSessionIntentSelected?: (intent: PracticeSessionIntent) => void;
  recentFiles: RecentFile[];
  onRefreshRecentFiles: () => void;
  onRemoveRecentFile: (filePath: string) => Promise<boolean>;
}

function findByTestId(testId: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-testid]")).find(
      (element) => element.dataset.testid === testId,
    ) ?? null
  );
}

function previewSourceTestId(preview: SongSelectionPreviewModel): string {
  return preview.kind === "builtin"
    ? `song-select-${preview.song.id}`
    : `imported-song-select-${preview.importedSong.id}`;
}

export function SongLibrary({
  onOpenFile,
  onBack,
  onOpenSettings,
  onSessionIntentSelected,
  recentFiles,
  onRefreshRecentFiles: refreshRecents,
  onRemoveRecentFile: removeRecent,
}: SongLibraryProps): React.JSX.Element {
  const { t } = useTranslation();

  const songs = useSongLibraryStore((s) => s.songs);
  const importedSongs = useSongLibraryStore((s) => s.importedSongs);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const gradeFilter = useSongLibraryStore((s) => s.gradeFilter);
  const favoriteSongIds = useSongLibraryStore((s) => s.favoriteSongIds);
  const setSearchQuery = useSongLibraryStore((s) => s.setSearchQuery);
  const setDifficultyFilter = useSongLibraryStore((s) => s.setDifficultyFilter);
  const setGradeFilter = useSongLibraryStore((s) => s.setGradeFilter);
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);
  const refreshImportedSongs = useSongLibraryStore(
    (s) => s.refreshImportedSongs,
  );
  const updateImportedSongMetadata = useSongLibraryStore(
    (s) => s.updateImportedSongMetadata,
  );
  const removeImportedSong = useSongLibraryStore((s) => s.removeImportedSong);
  const toggleFavoriteSong = useSongLibraryStore((s) => s.toggleFavoriteSong);

  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);

  const sessions = useProgressStore((s) => s.sessions);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadSessions = useProgressStore((s) => s.loadSessions);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRecovery, setRecentRecovery] =
    useState<RecentFileRecovery | null>(null);
  const [loadingRecentPath, setLoadingRecentPath] = useState<string | null>(
    null,
  );
  const [loadingImportedPath, setLoadingImportedPath] = useState<string | null>(
    null,
  );
  const [editingImportedSongId, setEditingImportedSongId] = useState<
    string | null
  >(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedImportedSongId, setSelectedImportedSongId] = useState<
    string | null
  >(null);
  const previewReturnFocusRef = useRef<HTMLElement | null>(null);
  const pianoButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isPianoDrawerOpen, setIsPianoDrawerOpen] = useState(false);
  const [importedMetadataDraft, setImportedMetadataDraft] =
    useState<ImportedSongMetadataDraft | null>(null);

  useLibraryReturnFocus();

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    void refreshImportedSongs();
  }, [refreshImportedSongs]);

  useEffect(() => {
    if (!isProgressLoaded) {
      loadSessions();
    }
  }, [isProgressLoaded, loadSessions]);

  const songActivity = useMemo(
    () => buildSongActivity(songs, sessions, recentFiles, favoriteSongIds),
    [songs, sessions, recentFiles, favoriteSongIds],
  );

  const importedSongActivity = useMemo(
    () => buildImportedSongActivity(importedSongs, sessions, recentFiles),
    [importedSongs, sessions, recentFiles],
  );

  const songbook = useMemo<Songbook>(() => {
    const built = buildSongbook({
      songs,
      importedSongs,
      songActivity,
      importedActivity: importedSongActivity,
      filters: { searchQuery, difficultyFilter, gradeFilter },
    });
    // No songs at all reads as an empty result, not as zero shelves.
    return built.mode === "shelves" && built.shelves.length === 0
      ? { mode: "results", items: [] }
      : built;
  }, [
    songs,
    importedSongs,
    songActivity,
    importedSongActivity,
    searchQuery,
    difficultyFilter,
    gradeFilter,
  ]);

  const looseRecentFiles = useMemo(
    () => selectLooseRecentFiles(recentFiles, importedSongs),
    [recentFiles, importedSongs],
  );

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === selectedSongId) ?? null,
    [songs, selectedSongId],
  );

  const selectedImportedSong = useMemo(
    () =>
      importedSongs.find((song) => song.id === selectedImportedSongId) ?? null,
    [importedSongs, selectedImportedSongId],
  );

  const selectedSongPreview = useMemo(() => {
    if (selectedSong) {
      return buildSongSelectionPreviewModel(
        selectedSong,
        songActivity.get(selectedSong.id),
      );
    }

    if (selectedImportedSong) {
      return buildImportedSongSelectionPreviewModel(
        selectedImportedSong,
        importedSongActivity.get(selectedImportedSong.id),
      );
    }

    return null;
  }, [importedSongActivity, selectedImportedSong, selectedSong, songActivity]);

  const isFilteringSongs =
    searchQuery.trim() !== "" ||
    difficultyFilter !== "all" ||
    gradeFilter !== "all";

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDifficultyFilter("all");
    setGradeFilter("all");
  }, [setDifficultyFilter, setGradeFilter, setSearchQuery]);

  const handleSelectSong = useCallback(
    async (songId: string, intent: PracticeSessionIntent = "practice") => {
      onSessionIntentSelected?.(intent);
      setError(null);
      setLoadingId(songId);
      try {
        const title = await openBuiltinSong(songId, {
          loadSong,
          resetPlayback: reset,
        });
        if (title) refreshRecents();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setError(msg);
        console.error("Failed to load built-in song:", e);
      } finally {
        setLoadingId(null);
      }
    },
    [loadSong, onSessionIntentSelected, reset, refreshRecents, t],
  );

  const handlePreviewSong = useCallback((songId: string) => {
    setError(null);
    previewReturnFocusRef.current = findByTestId(`song-select-${songId}`);
    setSelectedSongId(songId);
    setSelectedImportedSongId(null);
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedSongId(null);
    setSelectedImportedSongId(null);
    setEditingImportedSongId(null);
    setImportedMetadataDraft(null);
  }, []);

  const handleSelectRecent = useCallback(
    async (file: RecentFile) => {
      onSessionIntentSelected?.("practice");
      setRecentRecovery(null);
      setLoadingRecentPath(file.path);
      try {
        const target = recentOpenTarget(file.path);
        if (target.kind === "builtin") {
          // Built-in songs never suggest re-importing a file (#304).
          let title: string | null = null;
          let diagnostic: unknown;
          try {
            title = await openBuiltinSong(target.songId, {
              loadSong,
              resetPlayback: reset,
            });
          } catch (error) {
            diagnostic = error;
            console.error("Failed to open built-in recent song:", error);
          }
          if (!title) {
            setRecentRecovery(
              getRecentFileRecovery(
                file,
                { kind: "builtin-unavailable", diagnostic },
                t,
              ),
            );
            return;
          }
          refreshRecents();
          return;
        }
        const result = await window.api.loadMidiPath(file.path);

        if (!result) {
          setRecentRecovery(
            getRecentFileRecovery(file, { kind: "missing" }, t),
          );
          return;
        }
        let parsed;
        try {
          parsed = parseImportedPracticeFile(result.fileName, result.data);
        } catch (e) {
          setRecentRecovery(
            getRecentFileRecovery(
              file,
              { kind: "parse-failed", diagnostic: e },
              t,
            ),
          );
          console.error("Failed to parse recent file:", e);
          return;
        }
        loadSong(parsed);
        usePracticeStore
          .getState()
          .setDisplayMode(
            preferredDisplayModeForSource(
              practiceSourceFromFileName(result.fileName),
            ),
          );
        reset();
        queueRecentFile({ path: file.path, name: file.name });
      } catch (e) {
        setRecentRecovery(
          getRecentFileRecovery(
            file,
            { kind: "read-failed", diagnostic: e },
            t,
          ),
        );
        console.error("Failed to load recent file:", e);
      } finally {
        setLoadingRecentPath(null);
      }
    },
    [loadSong, onSessionIntentSelected, reset, refreshRecents, t],
  );

  const handleRemoveRecent = useCallback(
    async (filePath: string) => {
      try {
        const removed = await removeRecent(filePath);
        if (removed) setRecentRecovery(null);
      } catch (error) {
        console.error("Failed to remove recent MIDI file:", error);
      }
    },
    [removeRecent],
  );

  const handlePreviewImportedSong = useCallback(
    (record: ImportedSongRecord) => {
      setError(null);
      previewReturnFocusRef.current = findByTestId(
        `imported-song-select-${record.id}`,
      );
      setSelectedSongId(null);
      setSelectedImportedSongId(record.id);
    },
    [],
  );

  const handlePracticeImportedSong = useCallback(
    async (
      record: ImportedSongRecord,
      intent: PracticeSessionIntent = "practice",
    ) => {
      if (record.missing) {
        setError(t("library.importedMissing"));
        return;
      }

      onSessionIntentSelected?.(intent);
      setError(null);
      setLoadingImportedPath(record.sourcePath);
      try {
        const result = await window.api.loadMidiPath(record.sourcePath);
        if (!result) {
          setError(t("library.importedMissing"));
          return;
        }
        const parsed = parseImportedPracticeFile(result.fileName, result.data);
        loadSong(parsed);
        usePracticeStore
          .getState()
          .setDisplayMode(
            preferredDisplayModeForSource(
              practiceSourceFromFileName(result.fileName),
            ),
          );
        reset();
        queueRecentFile({ path: record.sourcePath, name: record.title });
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setError(msg);
        console.error("Failed to load imported song:", e);
      } finally {
        setLoadingImportedPath(null);
      }
    },
    [loadSong, onSessionIntentSelected, reset, t],
  );

  const handleStartPreviewSession = useCallback(
    (preview: SongSelectionPreviewModel, intent: PracticeSessionIntent) => {
      rememberLibraryReturnFocus(previewSourceTestId(preview));
      if (preview.kind === "builtin") {
        void handleSelectSong(preview.song.id, intent);
        return;
      }

      void handlePracticeImportedSong(preview.importedSong, intent);
    },
    [handlePracticeImportedSong, handleSelectSong],
  );

  const selectedPreviewIsLoading =
    selectedSongPreview?.kind === "builtin"
      ? loadingId === selectedSongPreview.song.id
      : selectedSongPreview?.kind === "imported"
        ? loadingImportedPath === selectedSongPreview.importedSong.sourcePath
        : false;

  const handleEditImportedMetadata = useCallback(
    (record: ImportedSongRecord) => {
      setError(null);
      setEditingImportedSongId(record.id);
      setImportedMetadataDraft(createImportedMetadataDraft(record));
    },
    [],
  );

  const handleRemoveImportedSong = useCallback(
    (record: ImportedSongRecord) => {
      setError(null);
      if (selectedImportedSongId === record.id) setSelectedImportedSongId(null);
      if (editingImportedSongId === record.id) {
        setEditingImportedSongId(null);
        setImportedMetadataDraft(null);
      }
      void removeImportedSong(record.id).then(async () => {
        // its "recently played" trace goes with it
        await handleRemoveRecent(record.sourcePath);
        refreshRecents();
      });
      // the dialog is gone with the cover: focus goes to the search box
      window.setTimeout(() => {
        findByTestId("song-library-search")?.focus({ preventScroll: true });
      }, 60);
    },
    [
      editingImportedSongId,
      handleRemoveRecent,
      refreshRecents,
      removeImportedSong,
      selectedImportedSongId,
    ],
  );

  const handleCancelImportedMetadata = useCallback(() => {
    setEditingImportedSongId(null);
    setImportedMetadataDraft(null);
  }, []);

  const handleUpdateImportedMetadataDraft = useCallback(
    (patch: Partial<ImportedSongMetadataDraft>) => {
      setImportedMetadataDraft((current) =>
        current ? { ...current, ...patch } : current,
      );
    },
    [],
  );

  const handleSaveImportedMetadata = useCallback(() => {
    if (!editingImportedSongId || !importedMetadataDraft) return;
    if (!importedMetadataDraft.title.trim()) return;

    updateImportedSongMetadata(
      editingImportedSongId,
      createImportedMetadataPatch(importedMetadataDraft),
    );
    setEditingImportedSongId(null);
    setImportedMetadataDraft(null);
  }, [
    editingImportedSongId,
    importedMetadataDraft,
    updateImportedSongMetadata,
  ]);

  return (
    <div className="flex-1 min-h-0 app-shell overflow-y-auto overflow-x-hidden songbook">
      <SongLibraryHeader
        onBack={onBack}
        onOpenFile={onOpenFile}
        onOpenSettings={onOpenSettings}
        trailing={
          <SongLibraryPianoButton
            buttonRef={pianoButtonRef}
            onClick={() => setIsPianoDrawerOpen(true)}
          />
        }
      />

      <main className="songbook-main">
        <SongLibraryFilters />

        {!isFilteringSongs && (
          <RecentSongsSection
            recentFiles={looseRecentFiles}
            loadingRecentPath={loadingRecentPath}
            recentRecovery={recentRecovery}
            onSelectRecent={(file) => void handleSelectRecent(file)}
            onRemoveRecent={(filePath) => void handleRemoveRecent(filePath)}
            rememberReturnFocus={rememberLibraryReturnFocus}
          />
        )}

        <SongbookView
          songbook={songbook}
          isLoading={isLoading}
          catalogueEmpty={songs.length === 0 && importedSongs.length === 0}
          loadingId={loadingId}
          loadingImportedPath={loadingImportedPath}
          onPreviewSong={handlePreviewSong}
          onPreviewImported={handlePreviewImportedSong}
          onClearSearch={handleClearSearch}
        />

        {error && (
          <p className="songbook-error" role="alert">
            {error}
          </p>
        )}
      </main>

      {selectedSongPreview && (
        <SongSelectionPreviewPanel
          preview={selectedSongPreview}
          isLoading={selectedPreviewIsLoading}
          returnFocusRef={previewReturnFocusRef}
          onClose={handleClosePreview}
          onStartSession={handleStartPreviewSession}
          onToggleFavorite={toggleFavoriteSong}
          isEditing={
            selectedImportedSong !== null &&
            editingImportedSongId === selectedImportedSong.id
          }
          metadataDraft={importedMetadataDraft}
          onEditImported={() => {
            if (selectedImportedSong)
              handleEditImportedMetadata(selectedImportedSong);
          }}
          onRemoveImported={() => {
            if (selectedImportedSong)
              handleRemoveImportedSong(selectedImportedSong);
          }}
          onUpdateDraft={handleUpdateImportedMetadataDraft}
          onSaveMetadata={handleSaveImportedMetadata}
          onCancelMetadata={handleCancelImportedMetadata}
        />
      )}

      <SongLibraryMidiDrawer
        isOpen={isPianoDrawerOpen}
        onClose={() => setIsPianoDrawerOpen(false)}
        returnFocusRef={pianoButtonRef}
      />
    </div>
  );
}
