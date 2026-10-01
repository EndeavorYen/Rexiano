import { useEffect, useMemo, useCallback, useState } from "react";
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
import { groupSongsByCategory } from "./songCardUtils";
import { openBuiltinSong, recentOpenTarget } from "./openBuiltinSong";
import { pickLibraryHeroEntry } from "./libraryEntryPoints";
import { queueRecentFile } from "./pendingRecent";
import {
  buildImportedSongActivity,
  buildImportedSongSelectionPreviewModel,
  buildPracticeRecommendationModel,
  buildSongActivity,
  buildSongSelectionPreviewModel,
  filterSongsForLibrary,
  sortSongsForLibrary,
  type SongActivity,
  type SongSelectionPreviewModel,
} from "./songLibrarySelectors";
import {
  getRecentFileRecovery,
  type RecentFileRecovery,
} from "./recentFileRecovery";
import {
  importedSongMatchesQuery,
  type ImportedSongRecord,
} from "./importedSongMetadata";
import { buildLessonProgression } from "./lessonProgression";
import { useTranslation } from "../../i18n/useTranslation";
import { buildDailyGoalStatus } from "../practice/nextPracticeAction";
import type { PracticeSessionIntent } from "../practice/sessionIntent";
import type { RecentFile } from "../../../../shared/types";
import { SongLibraryHeader } from "./SongLibraryHeader";
import { PracticeRecommendationBanner } from "./PracticeRecommendationBanner";
import { LessonProgressionSection } from "./LessonProgressionSection";
import { SongSelectionPreviewPanel } from "./SongSelectionPreviewPanel";
import { RecentSongsSection } from "./RecentSongsSection";
import { ImportedSongsSection } from "./ImportedSongsSection";
import { SongCatalogSection } from "./SongCatalogSection";
import { SongLibraryMidiDrawer } from "./SongLibraryMidiDrawer";
import {
  useLibraryReturnFocus,
  rememberLibraryReturnFocus,
} from "./useLibraryReturnFocus";
import {
  usePreviewTrackCounts,
  previewTrackCountKey,
} from "./usePreviewTrackCounts";
import {
  createImportedMetadataDraft,
  createImportedMetadataPatch,
  type ImportedSongMetadataDraft,
} from "./importedSongMetadata";

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
  onBack?: () => void;
  onSessionIntentSelected?: (intent: PracticeSessionIntent) => void;
  recentFiles: RecentFile[];
  onRefreshRecentFiles: () => void;
  onRemoveRecentFile: (filePath: string) => Promise<boolean>;
}

const emptyActivity: SongActivity = {
  isFavorite: false,
  lastPlayedAt: null,
  playCount: 0,
  bestAccuracy: null,
};

function previewSourceTestId(preview: SongSelectionPreviewModel): string {
  return preview.kind === "builtin"
    ? `song-select-${preview.song.id}`
    : `imported-song-select-${preview.importedSong.id}`;
}

export function SongLibrary({
  onOpenFile,
  onBack,
  onSessionIntentSelected,
  recentFiles,
  onRefreshRecentFiles: refreshRecents,
  onRemoveRecentFile: removeRecent,
}: SongLibraryProps): React.JSX.Element {
  const { t } = useTranslation();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("library.greeting.morning");
    if (hour < 17) return t("library.greeting.afternoon");
    return t("library.greeting.evening");
  }, [t]);

  const songs = useSongLibraryStore((s) => s.songs);
  const importedSongs = useSongLibraryStore((s) => s.importedSongs);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const gradeFilter = useSongLibraryStore((s) => s.gradeFilter);
  const sortMode = useSongLibraryStore((s) => s.sortMode);
  const viewMode = useSongLibraryStore((s) => s.viewMode);
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);
  const refreshWatchedFolders = useSongLibraryStore(
    (s) => s.refreshWatchedFolders,
  );
  const updateImportedSongMetadata = useSongLibraryStore(
    (s) => s.updateImportedSongMetadata,
  );
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
  const [focusPreviewPrimary, setFocusPreviewPrimary] = useState(false);
  const [importedMetadataDraft, setImportedMetadataDraft] =
    useState<ImportedSongMetadataDraft | null>(null);

  useLibraryReturnFocus();

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    void refreshWatchedFolders();
  }, [refreshWatchedFolders]);

  useEffect(() => {
    if (!isProgressLoaded) {
      loadSessions();
    }
  }, [isProgressLoaded, loadSessions]);

  const filteredSongs = useMemo(() => {
    return filterSongsForLibrary(songs, {
      difficultyFilter,
      gradeFilter,
      searchQuery,
    });
  }, [songs, difficultyFilter, gradeFilter, searchQuery]);

  const filteredImportedSongs = useMemo(() => {
    return importedSongs.filter((song) => {
      if (gradeFilter !== "all" && song.grade !== gradeFilter) return false;
      return importedSongMatchesQuery(song, searchQuery);
    });
  }, [importedSongs, gradeFilter, searchQuery]);

  const songActivity = useMemo(
    () => buildSongActivity(songs, sessions, recentFiles, []),
    [songs, sessions, recentFiles],
  );

  const importedSongActivity = useMemo(
    () => buildImportedSongActivity(importedSongs, sessions, recentFiles),
    [importedSongs, sessions, recentFiles],
  );

  const sortedSongs = useMemo(
    () => sortSongsForLibrary(filteredSongs, songActivity, sortMode),
    [filteredSongs, songActivity, sortMode],
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

  const previewTrackCounts = usePreviewTrackCounts(
    selectedSong,
    selectedImportedSong,
  );

  const selectedSongPreview = useMemo(() => {
    if (selectedSong) {
      const key = previewTrackCountKey("builtin", selectedSong.id);
      return buildSongSelectionPreviewModel(
        selectedSong,
        songActivity.get(selectedSong.id),
        previewTrackCounts[key] ?? null,
      );
    }

    if (selectedImportedSong) {
      const key = previewTrackCountKey("imported", selectedImportedSong.id);
      return buildImportedSongSelectionPreviewModel(
        selectedImportedSong,
        importedSongActivity.get(selectedImportedSong.id),
        previewTrackCounts[key] ?? null,
      );
    }

    return null;
  }, [
    importedSongActivity,
    previewTrackCounts,
    selectedImportedSong,
    selectedSong,
    songActivity,
  ]);

  const practiceRecommendation = useMemo(
    () => buildPracticeRecommendationModel(filteredSongs, songActivity),
    [filteredSongs, songActivity],
  );

  const lessonProgression = useMemo(
    () => buildLessonProgression(songs, songActivity),
    [songs, songActivity],
  );

  const dailyGoalStatus = useMemo(
    () =>
      buildDailyGoalStatus(sessions, {
        dayTimestamp: Date.now(),
        targetMinutes: 10,
      }),
    [sessions],
  );

  const categoryGroups = useMemo(
    () => groupSongsByCategory(sortedSongs),
    [sortedSongs],
  );

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

  const handlePreviewSong = useCallback(
    (songId: string, viaKeyboard: boolean) => {
      setError(null);
      setFocusPreviewPrimary(viaKeyboard);
      setSelectedSongId(songId);
      setSelectedImportedSongId(null);
    },
    [],
  );

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
    (record: ImportedSongRecord, viaKeyboard: boolean) => {
      if (record.missing) {
        setError(t("library.importedMissing"));
        return;
      }

      setError(null);
      setFocusPreviewPrimary(viaKeyboard);
      setSelectedSongId(null);
      setSelectedImportedSongId(record.id);
    },
    [t],
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
    <div className="flex-1 min-h-0 app-shell overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-6xl px-6 py-6 pb-24">
        <SongLibraryHeader
          onBack={onBack}
          onOpenFile={onOpenFile}
          greeting={greeting}
          dailyGoalStatus={dailyGoalStatus}
        />

        {/* One big "play this next" entry: the lesson path leads (#307). */}
        {practiceRecommendation &&
          pickLibraryHeroEntry({
            nextLessonSongId: lessonProgression.nextLesson?.song.id ?? null,
            recommendationSongId: practiceRecommendation.song.id,
          }) === "recommendation" && (
            <PracticeRecommendationBanner
              recommendation={practiceRecommendation}
              isLoading={loadingId === practiceRecommendation.song.id}
              onSelectSong={(songId) => void handleSelectSong(songId)}
              rememberReturnFocus={rememberLibraryReturnFocus}
            />
          )}

        {lessonProgression.groups.length > 0 && (
          <LessonProgressionSection
            lessonProgression={lessonProgression}
            loadingId={loadingId}
            onSelectSong={(songId) => void handleSelectSong(songId)}
            rememberReturnFocus={rememberLibraryReturnFocus}
          />
        )}

        {selectedSongPreview && (
          <SongSelectionPreviewPanel
            preview={selectedSongPreview}
            focusPrimaryAction={focusPreviewPrimary}
            isLoading={selectedPreviewIsLoading}
            onStartSession={handleStartPreviewSession}
          />
        )}

        <RecentSongsSection
          recentFiles={recentFiles}
          loadingRecentPath={loadingRecentPath}
          recentRecovery={recentRecovery}
          onSelectRecent={(file) => void handleSelectRecent(file)}
          onRemoveRecent={(filePath) => void handleRemoveRecent(filePath)}
          rememberReturnFocus={rememberLibraryReturnFocus}
        />

        <ImportedSongsSection
          songs={filteredImportedSongs}
          loadingImportedPath={loadingImportedPath}
          editingImportedSongId={editingImportedSongId}
          importedMetadataDraft={importedMetadataDraft}
          onSelectSong={handlePreviewImportedSong}
          onEditSong={handleEditImportedMetadata}
          onUpdateDraft={handleUpdateImportedMetadataDraft}
          onSaveMetadata={handleSaveImportedMetadata}
          onCancelMetadata={handleCancelImportedMetadata}
        />

        <SongCatalogSection
          songs={songs}
          sortedSongs={sortedSongs}
          categoryGroups={categoryGroups}
          songActivity={songActivity}
          emptyActivity={emptyActivity}
          isLoading={isLoading}
          viewMode={viewMode}
          loadingId={loadingId}
          selectedSongId={selectedSongId}
          onSelectSong={handlePreviewSong}
          onToggleFavorite={toggleFavoriteSong}
        />

        {error && (
          <p
            className="mt-4 text-sm font-body"
            style={{ color: "var(--color-danger-text)" }}
          >
            {error}
          </p>
        )}

        <SongLibraryMidiDrawer />
      </div>
    </div>
  );
}
