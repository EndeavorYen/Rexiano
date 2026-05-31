import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import {
  Upload,
  AlertCircle,
  Music,
  Trophy,
  Flame,
  ArrowLeft,
  PanelRightOpen,
  X,
  PlayCircle,
  Star,
  Target,
  FolderPlus,
  FolderOpen,
  Pencil,
  Check,
  Volume2,
  Square,
  Loader2,
} from "lucide-react";
import { parseMidiFile } from "../../engines/midi/MidiFileParser";
import { AudioEngine } from "../../engines/audio/AudioEngine";
import { useSongStore } from "../../stores/useSongStore";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";
import { useProgressStore } from "../../stores/useProgressStore";
import { useRecentFiles } from "../../hooks/useRecentFiles";
import { formatRelativeTime } from "../../utils/relativeTime";
import { SongCard } from "./SongCard";
import { SongLibraryFilters } from "./SongLibraryFilters";
import { ThemePicker } from "../settings/ThemePicker";
import {
  categoryLabels,
  getGradeColor,
  gradeLabelShort,
  groupSongsByCategory,
} from "./songCardUtils";
import {
  buildImportedSongActivity,
  buildImportedSongSelectionPreviewModel,
  buildPracticeRecommendationModel,
  buildSongActivity,
  buildSongSelectionPreviewModel,
  filterSongsForLibrary,
  sortSongsForLibrary,
  type PracticeRecommendationReason,
  type SongActivity,
  type SongSelectionPreviewModel,
} from "./songLibrarySelectors";
import {
  getRecentFileRecovery,
  type RecentFileRecovery,
} from "./recentFileRecovery";
import {
  importedSongMatchesQuery,
  type ImportedSongCategory,
  type ImportedSongMetadataPatch,
  type ImportedSongRecord,
} from "./importedSongMetadata";
import { SongAudioPreviewPlayer } from "./songPreviewPlayback";
import {
  buildLessonProgression,
  type LessonRecommendationReason,
} from "./lessonProgression";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import { useTranslation } from "../../i18n/useTranslation";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { buildDailyGoalStatus } from "../practice/nextPracticeAction";
import appIcon from "../../../../../docs/figure/Rexiano_icon.png";
import type { BuiltinSongMeta, RecentFile } from "../../../../shared/types";
import type { TranslationKey } from "../../i18n/types";

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
  onBack?: () => void;
}

type PreviewAudioStatus = "idle" | "loading" | "playing";

interface PreviewAudioState {
  status: PreviewAudioStatus;
  sourceKey: string | null;
}

const emptyActivity: SongActivity = {
  isFavorite: false,
  lastPlayedAt: null,
  playCount: 0,
  bestAccuracy: null,
};

function previewTrackCountKey(
  kind: "builtin" | "imported",
  sourceId: string,
): string {
  return `${kind}:${sourceId}`;
}

function previewAudioSourceKey(preview: SongSelectionPreviewModel): string {
  return previewTrackCountKey(preview.kind, preview.sourceId);
}

const recommendationReasonKeys: Record<
  PracticeRecommendationReason,
  TranslationKey
> = {
  "new-song": "library.recommendation.reason.newSong",
  "improve-score": "library.recommendation.reason.improveScore",
  "continue-progress": "library.recommendation.reason.continueProgress",
};

const lessonRecommendationReasonKeys: Record<
  LessonRecommendationReason,
  TranslationKey
> = {
  "new-song": "library.recommendation.reason.newSong",
  "improve-score": "library.recommendation.reason.improveScore",
  "continue-progress": "library.recommendation.reason.continueProgress",
};

type ImportedGradeDraft =
  | ""
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8";
type ImportedCategoryDraft = "" | ImportedSongCategory;

interface ImportedSongMetadataDraft {
  title: string;
  composer: string;
  tags: string;
  grade: ImportedGradeDraft;
  category: ImportedCategoryDraft;
}

const importedGradeOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const importedCategoryOptions = [
  "exercise",
  "popular",
  "holiday",
  "classical",
] as const satisfies readonly ImportedSongCategory[];

function createImportedMetadataDraft(
  record: ImportedSongRecord,
): ImportedSongMetadataDraft {
  return {
    title: record.title,
    composer: record.composer ?? "",
    tags: record.tags.join(", "),
    grade:
      record.grade === undefined
        ? ""
        : (`${record.grade}` as ImportedGradeDraft),
    category: record.category ?? "",
  };
}

function createImportedMetadataPatch(
  draft: ImportedSongMetadataDraft,
): ImportedSongMetadataPatch {
  const tags = draft.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    title: draft.title.trim(),
    composer: draft.composer.trim() || undefined,
    tags,
    grade:
      draft.grade === ""
        ? undefined
        : (Number(draft.grade) as NonNullable<ImportedSongRecord["grade"]>),
    category: draft.category || undefined,
  };
}

export function SongLibrary({
  onOpenFile,
  onBack,
}: SongLibraryProps): React.JSX.Element {
  const { t } = useTranslation();

  /** Warm greetings that rotate based on time of day */
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("library.greeting.morning");
    if (hour < 17) return t("library.greeting.afternoon");
    return t("library.greeting.evening");
  }, [t]);
  const songs = useSongLibraryStore((s) => s.songs);
  const importedSongs = useSongLibraryStore((s) => s.importedSongs);
  const watchedFolders = useSongLibraryStore((s) => s.watchedFolders);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const gradeFilter = useSongLibraryStore((s) => s.gradeFilter);
  const sortMode = useSongLibraryStore((s) => s.sortMode);
  const viewMode = useSongLibraryStore((s) => s.viewMode);
  const favoriteSongIds = useSongLibraryStore((s) => s.favoriteSongIds);
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);
  const addWatchedFolder = useSongLibraryStore((s) => s.addWatchedFolder);
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

  const {
    recentFiles,
    refresh: refreshRecents,
    remove: removeRecent,
  } = useRecentFiles();

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
  const [isAddingWatchedFolder, setIsAddingWatchedFolder] = useState(false);
  const [editingImportedSongId, setEditingImportedSongId] = useState<
    string | null
  >(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedImportedSongId, setSelectedImportedSongId] = useState<
    string | null
  >(null);
  const [previewTrackCounts, setPreviewTrackCounts] = useState<
    Record<string, number>
  >({});
  const [previewAudioState, setPreviewAudioState] = useState<PreviewAudioState>(
    {
      status: "idle",
      sourceKey: null,
    },
  );
  const [importedMetadataDraft, setImportedMetadataDraft] =
    useState<ImportedSongMetadataDraft | null>(null);
  const [showDeviceDrawer, setShowDeviceDrawer] = useState(false);
  const deviceDrawerRef = useRef<HTMLElement>(null);
  const deviceDrawerTriggerRef = useRef<HTMLButtonElement>(null);
  const deviceDrawerCloseRef = useRef<HTMLButtonElement>(null);
  const previewPlayerRef = useRef<SongAudioPreviewPlayer | null>(null);
  const previewPlaybackTokenRef = useRef(0);
  const closeDeviceDrawer = useCallback(() => {
    setShowDeviceDrawer(false);
  }, []);

  const getPreviewPlayer = useCallback(() => {
    if (!previewPlayerRef.current) {
      previewPlayerRef.current = new SongAudioPreviewPlayer(
        new AudioEngine({
          onRuntimeError: (runtimeError) => {
            console.error("Song preview audio runtime error:", runtimeError);
          },
        }),
      );
    }
    return previewPlayerRef.current;
  }, []);

  const stopAudioPreview = useCallback(() => {
    previewPlaybackTokenRef.current += 1;
    previewPlayerRef.current?.stop();
    setPreviewAudioState({ status: "idle", sourceKey: null });
  }, []);

  useEffect(() => {
    return () => {
      previewPlaybackTokenRef.current += 1;
      previewPlayerRef.current?.dispose();
      previewPlayerRef.current = null;
    };
  }, []);

  useDialogFocus({
    active: showDeviceDrawer,
    containerRef: deviceDrawerRef,
    initialFocusRef: deviceDrawerCloseRef,
    returnFocusRef: deviceDrawerTriggerRef,
    onDismiss: closeDeviceDrawer,
  });

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
    () => buildSongActivity(songs, sessions, recentFiles, favoriteSongIds),
    [songs, sessions, recentFiles, favoriteSongIds],
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

  const selectedPreviewSourceKey = selectedSongPreview
    ? previewAudioSourceKey(selectedSongPreview)
    : null;
  const selectedPreviewAudioStatus =
    previewAudioState.sourceKey === selectedPreviewSourceKey
      ? previewAudioState.status
      : "idle";

  useEffect(() => {
    if (previewAudioState.status === "idle") return;
    if (previewAudioState.sourceKey === selectedPreviewSourceKey) return;
    stopAudioPreview();
  }, [
    previewAudioState.sourceKey,
    previewAudioState.status,
    selectedPreviewSourceKey,
    stopAudioPreview,
  ]);

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
        const parsed = parseMidiFile(result.fileName, result.data);
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

  const practiceRecommendation = useMemo(
    () => buildPracticeRecommendationModel(filteredSongs, songActivity),
    [filteredSongs, songActivity],
  );

  const lessonProgression = useMemo(
    () => buildLessonProgression(songs, songActivity),
    [songs, songActivity],
  );
  const nextLesson = lessonProgression.nextLesson;

  const dailyGoalStatus = useMemo(
    () =>
      buildDailyGoalStatus(sessions, {
        dayTimestamp: Date.now(),
        targetMinutes: 10,
      }),
    [sessions],
  );

  /** Songs grouped by category for section display */
  const categoryGroups = useMemo(
    () => groupSongsByCategory(sortedSongs),
    [sortedSongs],
  );

  /** Progress stats derived from sessions */
  const progressStats = useMemo(() => {
    const uniqueSongs = new Set(sessions.map((s) => s.songId)).size;
    const totalSessions = sessions.length;
    const bestAccuracy =
      sessions.length > 0
        ? Math.round(Math.max(...sessions.map((s) => s.score.accuracy)))
        : 0;
    return { uniqueSongs, totalSessions, bestAccuracy };
  }, [sessions]);

  const handleSelectSong = useCallback(
    async (songId: string) => {
      setError(null);
      setLoadingId(songId);
      try {
        const result = await window.api.loadBuiltinSong(songId);
        if (result) {
          const parsed = parseMidiFile(result.fileName, result.data);
          loadSong(parsed);
          reset();
          await window.api.saveRecentFile({
            path: `builtin:${songId}`,
            name: result.fileName,
            timestamp: Date.now(),
          });
          refreshRecents();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setError(msg);
        console.error("Failed to load built-in song:", e);
      } finally {
        setLoadingId(null);
      }
    },
    [loadSong, reset, refreshRecents, t],
  );

  const handlePreviewSong = useCallback((songId: string) => {
    setError(null);
    setSelectedSongId(songId);
    setSelectedImportedSongId(null);
  }, []);

  /** Max recent files shown in the quick-access strip */
  const RECENT_DISPLAY_LIMIT = 5;
  const visibleRecents = recentFiles.slice(0, RECENT_DISPLAY_LIMIT);
  const continueRecent = recentFiles[0] ?? null;

  const handleSelectRecent = useCallback(
    async (file: RecentFile) => {
      setRecentRecovery(null);
      setLoadingRecentPath(file.path);
      try {
        let result;
        if (file.path.startsWith("builtin:")) {
          // Built-in song — extract the songId and load via library API
          const songId = file.path.slice("builtin:".length);
          result = await window.api.loadBuiltinSong(songId);
        } else {
          // User-imported file — load by absolute path
          result = await window.api.loadMidiPath(file.path);
        }

        if (!result) {
          setRecentRecovery(
            getRecentFileRecovery(file, { kind: "missing" }, t),
          );
          return;
        }
        let parsed;
        try {
          parsed = parseMidiFile(result.fileName, result.data);
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
        reset();
        await window.api.saveRecentFile({
          path: file.path,
          name: file.name,
          timestamp: Date.now(),
        });
        refreshRecents();
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
    [loadSong, reset, refreshRecents, t],
  );

  const handleRemoveRecent = useCallback(
    async (filePath: string) => {
      await removeRecent(filePath);
      setRecentRecovery(null);
    },
    [removeRecent],
  );

  const handleAddWatchedFolder = useCallback(async () => {
    setError(null);
    setIsAddingWatchedFolder(true);
    try {
      await addWatchedFolder();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("general.error");
      setError(msg);
      console.error("Failed to add watched MIDI folder:", e);
    } finally {
      setIsAddingWatchedFolder(false);
    }
  }, [addWatchedFolder, t]);

  const handlePreviewImportedSong = useCallback(
    (record: ImportedSongRecord) => {
      if (record.missing) {
        setError(t("library.importedMissing"));
        return;
      }

      setError(null);
      setSelectedSongId(null);
      setSelectedImportedSongId(record.id);
    },
    [t],
  );

  const handlePracticeImportedSong = useCallback(
    async (record: ImportedSongRecord) => {
      if (record.missing) {
        setError(t("library.importedMissing"));
        return;
      }

      setError(null);
      setLoadingImportedPath(record.sourcePath);
      try {
        const result = await window.api.loadMidiPath(record.sourcePath);
        if (!result) {
          setError(t("library.importedMissing"));
          return;
        }
        const parsed = parseMidiFile(result.fileName, result.data);
        loadSong(parsed);
        reset();
        await window.api.saveRecentFile({
          path: record.sourcePath,
          name: record.title,
          timestamp: Date.now(),
        });
        refreshRecents();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setError(msg);
        console.error("Failed to load imported song:", e);
      } finally {
        setLoadingImportedPath(null);
      }
    },
    [loadSong, refreshRecents, reset, t],
  );

  const handlePracticePreview = useCallback(
    (preview: SongSelectionPreviewModel) => {
      stopAudioPreview();
      if (preview.kind === "builtin") {
        void handleSelectSong(preview.song.id);
        return;
      }

      void handlePracticeImportedSong(preview.importedSong);
    },
    [handlePracticeImportedSong, handleSelectSong, stopAudioPreview],
  );

  const handleToggleAudioPreview = useCallback(
    async (preview: SongSelectionPreviewModel) => {
      const sourceKey = previewAudioSourceKey(preview);
      if (
        previewAudioState.sourceKey === sourceKey &&
        previewAudioState.status !== "idle"
      ) {
        stopAudioPreview();
        return;
      }

      const token = previewPlaybackTokenRef.current + 1;
      previewPlaybackTokenRef.current = token;
      previewPlayerRef.current?.stop();
      setError(null);
      setPreviewAudioState({ status: "loading", sourceKey });

      try {
        if (preview.kind === "imported" && preview.importedSong.missing) {
          setError(t("library.importedMissing"));
          setPreviewAudioState({ status: "idle", sourceKey: null });
          return;
        }

        const result =
          preview.kind === "builtin"
            ? await window.api.loadBuiltinSong(preview.song.id)
            : await window.api.loadMidiPath(preview.importedSong.sourcePath);

        if (previewPlaybackTokenRef.current !== token) return;

        if (!result) {
          setError(
            preview.kind === "imported"
              ? t("library.importedMissing")
              : t("library.preview.audioPreviewError"),
          );
          setPreviewAudioState({ status: "idle", sourceKey: null });
          return;
        }

        const parsed = parseMidiFile(result.fileName, result.data);
        const { muted } = useSettingsStore.getState();
        const volume = muted ? 0 : usePlaybackStore.getState().volume;

        await getPreviewPlayer().play(parsed, {
          volume,
          onEnded: () => {
            if (previewPlaybackTokenRef.current === token) {
              setPreviewAudioState({ status: "idle", sourceKey: null });
            }
          },
        });

        if (previewPlaybackTokenRef.current === token) {
          setPreviewAudioState({ status: "playing", sourceKey });
        }
      } catch (e) {
        if (previewPlaybackTokenRef.current !== token) return;
        setError(t("library.preview.audioPreviewError"));
        setPreviewAudioState({ status: "idle", sourceKey: null });
        console.error("Failed to play song preview:", e);
      }
    },
    [
      getPreviewPlayer,
      previewAudioState.sourceKey,
      previewAudioState.status,
      stopAudioPreview,
      t,
    ],
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
        <header className="surface-panel subtle-shadow mb-5 p-4 animate-page-enter sm:sticky sm:top-4 sm:z-20 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="btn-surface-themed flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
                  aria-label={t("settings.shortcut.closeBack")}
                >
                  <ArrowLeft size={13} />
                </button>
              )}
              <img
                src={appIcon}
                alt=""
                width={42}
                height={42}
                className="rounded-xl subtle-shadow"
              />
              <div className="min-w-0">
                <span className="kicker-label">{t("app.subtitle")}</span>
                <h1
                  className="text-3xl font-display font-bold tracking-tight leading-none"
                  style={{ color: "var(--color-text)" }}
                >
                  Rexiano
                </h1>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {greeting}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenFile}
                className="btn-primary-themed flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer"
              >
                <Upload size={15} />
                {t("library.importMidi")}
              </button>
              <button
                onClick={() => void handleAddWatchedFolder()}
                disabled={isAddingWatchedFolder}
                className="btn-surface-themed flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer disabled:cursor-wait disabled:opacity-60"
                data-testid="library-add-folder"
              >
                <FolderPlus size={15} />
                {t("library.addFolder")}
              </button>
              <ThemePicker />
            </div>
          </div>

          {isProgressLoaded && sessions.length > 0 && (
            <div
              className="mt-4 grid gap-3 rounded-xl px-4 py-3 sm:grid-cols-3"
              style={{
                background:
                  "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                border:
                  "1px solid color-mix(in srgb, var(--color-accent) 16%, var(--color-border))",
              }}
            >
              <StatBadge
                icon={<Music size={14} />}
                value={progressStats.uniqueSongs}
                label={
                  progressStats.uniqueSongs === 1
                    ? t("library.songPracticed")
                    : t("library.songsPracticed")
                }
              />
              <StatBadge
                icon={<Flame size={14} />}
                value={progressStats.totalSessions}
                label={
                  progressStats.totalSessions === 1
                    ? t("library.session")
                    : t("library.sessions")
                }
              />
              <StatBadge
                icon={<Trophy size={14} />}
                value={`${progressStats.bestAccuracy}%`}
                label={t("library.bestScore")}
              />
            </div>
          )}

          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{
              background:
                "color-mix(in srgb, var(--color-note2) 8%, var(--color-surface))",
              border:
                "1px solid color-mix(in srgb, var(--color-note2) 18%, var(--color-border))",
            }}
            data-testid="library-daily-goal"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className="flex items-center gap-2 text-xs font-body font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Target size={14} style={{ color: "var(--color-note2)" }} />
                {t("library.dailyGoal.label")}
              </span>
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: "var(--color-text)" }}
              >
                {t("library.dailyGoal.minutes", {
                  practiced: dailyGoalStatus.practicedMinutes,
                  target: dailyGoalStatus.targetMinutes,
                })}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--color-surface-alt)" }}
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(dailyGoalStatus.completionRatio * 100)}%`,
                  background: "var(--color-note2)",
                }}
              />
            </div>
            <p
              className="mt-1.5 text-[11px] font-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              {dailyGoalStatus.isComplete
                ? t("library.dailyGoal.complete")
                : t("library.dailyGoal.remaining", {
                    remaining: dailyGoalStatus.remainingMinutes,
                  })}
            </p>
          </div>
        </header>

        {practiceRecommendation && (
          <section className="surface-elevated mb-5 p-4 animate-page-enter">
            <button
              type="button"
              onClick={() => handleSelectSong(practiceRecommendation.song.id)}
              disabled={loadingId === practiceRecommendation.song.id}
              className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-wait"
              style={{
                background:
                  "color-mix(in srgb, var(--color-note1) 10%, var(--color-surface))",
                border:
                  "1px solid color-mix(in srgb, var(--color-note1) 20%, var(--color-border))",
              }}
              data-testid="song-library-recommendation"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--color-note1)",
                    color: "#fff",
                  }}
                >
                  {loadingId === practiceRecommendation.song.id ? (
                    <span
                      className="h-4 w-4 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: "rgba(255,255,255,0.45)",
                        borderTopColor: "#fff",
                      }}
                    />
                  ) : (
                    <PlayCircle size={20} />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-xs font-body font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-note1)" }}
                  >
                    {t("library.recommendation.title")}
                  </span>
                  <span
                    className="block truncate text-base font-display font-bold"
                    style={{ color: "var(--color-text)" }}
                    data-testid="song-library-recommendation-title"
                  >
                    {practiceRecommendation.song.title}
                  </span>
                  <span
                    className="block text-xs font-body"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t(recommendationReasonKeys[practiceRecommendation.reason])}
                    {" · "}
                    {practiceRecommendation.bestAccuracy !== null
                      ? `${Math.round(practiceRecommendation.bestAccuracy)}%`
                      : t("library.neverPracticed")}
                  </span>
                </span>
              </span>
              <span
                className="hidden shrink-0 rounded-lg px-3 py-1.5 text-xs font-body font-semibold sm:inline-flex"
                style={{
                  color: "#fff",
                  background: "var(--color-note1)",
                }}
              >
                {t("library.recommendation.cta")}
              </span>
            </button>
          </section>
        )}

        {lessonProgression.groups.length > 0 && (
          <section
            className="surface-elevated mb-5 p-4 animate-page-enter"
            data-testid="lesson-progression-panel"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target size={14} style={{ color: "var(--color-note2)" }} />
                <span
                  className="text-xs font-body font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-note2)" }}
                >
                  {t("library.lessonPath.title")}
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-body font-medium"
                style={{
                  color: "var(--color-text-muted)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("library.lessonPath.free")}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)]">
              {nextLesson && (
                <button
                  type="button"
                  onClick={() => handleSelectSong(nextLesson.song.id)}
                  disabled={loadingId === nextLesson.song.id}
                  className="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left cursor-pointer transition-all disabled:cursor-wait disabled:opacity-60"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-note2) 10%, var(--color-surface))",
                    border:
                      "1px solid color-mix(in srgb, var(--color-note2) 24%, var(--color-border))",
                  }}
                  data-testid="lesson-progression-next"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "var(--color-note2)",
                      color: "#fff",
                    }}
                  >
                    <PlayCircle size={18} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-[10px] font-body font-semibold uppercase tracking-wide"
                      style={{ color: "var(--color-note2)" }}
                    >
                      {t("library.lessonPath.next")}
                    </span>
                    <span
                      className="block truncate text-sm font-display font-bold"
                      style={{ color: "var(--color-text)" }}
                    >
                      {nextLesson.song.title}
                    </span>
                    <span
                      className="block truncate text-xs font-body"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {t(lessonRecommendationReasonKeys[nextLesson.reason])}
                      {" · "}
                      {t("library.lessonPath.mastery", {
                        accuracy: lessonProgression.masteryAccuracy,
                      })}
                    </span>
                  </span>
                </button>
              )}

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {lessonProgression.groups.map((group) => {
                  const progressPercent =
                    group.totalSongCount > 0
                      ? Math.round(
                          (group.completedSongCount / group.totalSongCount) *
                            100,
                        )
                      : 0;

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-surface) 84%, transparent)",
                        border: "1px solid var(--color-border)",
                      }}
                      data-testid={`lesson-group-${group.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="truncate text-xs font-body font-semibold"
                          style={{ color: "var(--color-text)" }}
                        >
                          {group.title}
                        </span>
                        <span
                          className="shrink-0 text-[10px] font-mono tabular-nums"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {t("library.lessonPath.completed", {
                            completed: group.completedSongCount,
                            total: group.totalSongCount,
                          })}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--color-border) 70%, transparent)",
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${progressPercent}%`,
                            background: group.completed
                              ? "var(--color-success, #22c55e)"
                              : "var(--color-note2)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {selectedSongPreview && (
          <SongSelectionPreviewPanel
            preview={selectedSongPreview}
            isLoading={selectedPreviewIsLoading}
            audioStatus={selectedPreviewAudioStatus}
            onPractice={handlePracticePreview}
            onToggleAudioPreview={handleToggleAudioPreview}
          />
        )}

        {continueRecent && (
          <section
            className="surface-elevated mb-5 p-4 animate-page-enter"
            data-testid="song-library-continue"
          >
            <button
              onClick={() => handleSelectRecent(continueRecent)}
              disabled={loadingRecentPath === continueRecent.path}
              className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-wait"
              style={{
                background:
                  "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                border:
                  "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
              }}
              title={continueRecent.path}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                  }}
                >
                  {loadingRecentPath === continueRecent.path ? (
                    <span
                      className="h-4 w-4 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: "rgba(255,255,255,0.45)",
                        borderTopColor: "#fff",
                      }}
                    />
                  ) : (
                    <PlayCircle size={20} />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-xs font-body font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {t("library.continuePractice")}
                  </span>
                  <span
                    className="block truncate text-base font-display font-bold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {continueRecent.name}
                  </span>
                  <span
                    className="block text-xs font-body"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("library.continueHint")} ·{" "}
                    {formatRelativeTime(continueRecent.timestamp)}
                  </span>
                </span>
              </div>
            </button>

            {visibleRecents.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleRecents.slice(1).map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => handleSelectRecent(file)}
                    disabled={loadingRecentPath === file.path}
                    className="card-hover animate-page-enter group relative min-w-[170px] max-w-[260px] flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-xs font-body font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-wait"
                    style={{
                      background:
                        "color-mix(in srgb, var(--color-surface) 82%, transparent)",
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                      animationDelay: `${idx * 40}ms`,
                    }}
                    title={file.path}
                  >
                    <span
                      className="w-full text-left leading-tight"
                      style={{
                        color: "var(--color-text)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {file.name}
                    </span>
                    <span
                      className="shrink-0 opacity-70 font-mono tabular-nums text-[11px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {formatRelativeTime(file.timestamp)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {recentRecovery && (
              <div
                className="flex flex-wrap items-center gap-2 mt-2 text-xs font-body"
                style={{ color: "#dc2626" }}
                title={recentRecovery.guidance.diagnostic || undefined}
                data-testid="recent-file-recovery"
              >
                <AlertCircle size={12} />
                <span className="min-w-0">
                  <span className="font-semibold">
                    {recentRecovery.guidance.title}
                  </span>
                  <span className="ml-1">
                    {recentRecovery.guidance.guidance}
                  </span>
                </span>
                {recentRecovery.canRemove && (
                  <button
                    onClick={() =>
                      void handleRemoveRecent(recentRecovery.removePath)
                    }
                    className="btn-surface-themed rounded-md px-2 py-0.5 text-[10px] font-body cursor-pointer"
                    style={{ color: "var(--color-text)" }}
                    data-testid="recent-file-remove-stale"
                  >
                    {recentRecovery.actionLabel}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {filteredImportedSongs.length > 0 && (
          <section
            className="surface-elevated mb-5 p-4 animate-page-enter"
            data-testid="imported-song-library"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderOpen size={14} style={{ color: "var(--color-note3)" }} />
                <span
                  className="text-xs font-body font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-note3)" }}
                >
                  {t("library.importedSongs")}
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-body font-medium"
                style={{
                  color: "var(--color-text-muted)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("library.watchedFolderCount", {
                  count: watchedFolders.length,
                })}
              </span>
            </div>
            <div className="grid gap-2">
              {filteredImportedSongs.map((record, index) => (
                <div key={record.id} className="grid gap-2">
                  <ImportedSongRow
                    record={record}
                    isLoading={loadingImportedPath === record.sourcePath}
                    isEditing={editingImportedSongId === record.id}
                    onSelect={handlePreviewImportedSong}
                    onEdit={handleEditImportedMetadata}
                    animationDelay={index * 24}
                  />
                  {editingImportedSongId === record.id &&
                    importedMetadataDraft && (
                      <ImportedSongMetadataEditor
                        draft={importedMetadataDraft}
                        onChange={handleUpdateImportedMetadataDraft}
                        onSave={handleSaveImportedMetadata}
                        onCancel={handleCancelImportedMetadata}
                      />
                    )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="surface-panel p-4 sm:p-5 animate-page-enter">
          <SongLibraryFilters />

          <div className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--color-border)" }}
                  >
                    <div className="skeleton h-10" />
                    <div className="p-4 space-y-3">
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                      <div className="flex justify-between mt-3">
                        <div className="skeleton h-4 w-16 rounded-full" />
                        <div className="skeleton h-3 w-10 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedSongs.length === 0 ? (
              <div
                className="text-center py-16 px-4"
                style={{ color: "var(--color-text-muted)" }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                  }}
                >
                  <Music
                    size={28}
                    style={{ color: "var(--color-accent)", opacity: 0.6 }}
                  />
                </div>
                {songs.length === 0 ? (
                  <>
                    <p
                      className="text-sm font-body font-medium mb-1"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t("library.noSongsYet")}
                    </p>
                    <p className="text-xs font-body opacity-70">
                      {t("library.noSongsHint")}
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      className="text-sm font-body font-medium mb-1"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t("library.noMatchSearch")}
                    </p>
                    <p className="text-xs font-body opacity-70">
                      {t("library.noMatchHint")}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {viewMode === "list" ? (
                  <div className="space-y-2" data-testid="song-library-list">
                    <div
                      className="mb-2 flex items-center justify-between gap-3"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <span className="text-xs font-body font-semibold uppercase tracking-wider">
                        {t("library.allSongs")}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums">
                        {sortedSongs.length}
                      </span>
                    </div>
                    {sortedSongs.map((song, i) => (
                      <SongListRow
                        key={song.id}
                        song={song}
                        activity={songActivity.get(song.id) ?? emptyActivity}
                        isLoading={loadingId === song.id}
                        isSelected={selectedSongId === song.id}
                        onSelect={handlePreviewSong}
                        onToggleFavorite={toggleFavoriteSong}
                        animationDelay={i * 24}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-7">
                    {categoryGroups.map((group, groupIdx) => (
                      <section
                        key={group.category}
                        className="surface-elevated p-3 sm:p-4 animate-page-enter"
                        style={{ animationDelay: `${groupIdx * 60}ms` }}
                      >
                        <div
                          className="flex items-center gap-2 mb-3"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <span className="text-xs font-body font-semibold uppercase tracking-wider">
                            {group.label}
                          </span>
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "var(--color-surface-alt)",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {group.songs.length}
                          </span>
                          <div
                            className="flex-1 h-px ml-1"
                            style={{ background: "var(--color-border)" }}
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                          {group.songs.map((song, i) => (
                            <div
                              key={song.id}
                              className="relative animate-stagger-child"
                              style={{
                                animationDelay: `${(groupIdx * 4 + i) * 30}ms`,
                              }}
                            >
                              <SongCard
                                song={song}
                                onSelect={handlePreviewSong}
                                colorIndex={groupIdx * 4 + i}
                              />
                              <FavoriteButton
                                song={song}
                                activity={
                                  songActivity.get(song.id) ?? emptyActivity
                                }
                                onToggleFavorite={toggleFavoriteSong}
                                className="absolute right-2 top-2"
                              />
                              {loadingId === song.id && (
                                <LoadingOverlay radiusClass="rounded-xl" />
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {error && (
          <p
            className="mt-4 text-sm font-body"
            style={{ color: "var(--color-accent)" }}
          >
            {error}
          </p>
        )}

        <button
          ref={deviceDrawerTriggerRef}
          onClick={() => setShowDeviceDrawer(true)}
          className="fixed right-5 bottom-5 z-30 btn-surface-themed rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-body cursor-pointer subtle-shadow"
          data-testid="library-device-drawer-trigger"
        >
          <PanelRightOpen size={14} />
          MIDI
        </button>

        {showDeviceDrawer && (
          <div className="app-overlay-backdrop" onClick={closeDeviceDrawer}>
            <aside
              ref={deviceDrawerRef}
              className="app-side-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="MIDI"
              tabIndex={-1}
              data-testid="library-midi-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="app-side-drawer-header">
                <span className="kicker-label">MIDI</span>
                <button
                  ref={deviceDrawerCloseRef}
                  onClick={closeDeviceDrawer}
                  className="btn-surface-themed w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                  aria-label={t("settings.close")}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="app-side-drawer-body">
                <section className="app-side-section">
                  <DeviceSelector />
                </section>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function formatSongDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SongSelectionPreviewPanel({
  preview,
  isLoading,
  audioStatus,
  onPractice,
  onToggleAudioPreview,
}: {
  preview: SongSelectionPreviewModel;
  isLoading: boolean;
  audioStatus: PreviewAudioStatus;
  onPractice: (preview: SongSelectionPreviewModel) => void;
  onToggleAudioPreview: (preview: SongSelectionPreviewModel) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const grade =
    preview.grade !== undefined ? gradeLabelShort[preview.grade] : "--";
  const category = preview.category ? categoryLabels[preview.category] : "--";
  const bestScore =
    preview.bestAccuracy !== null
      ? `${Math.round(preview.bestAccuracy)}%`
      : t("library.neverPracticed");
  const ctaLabel =
    preview.primaryCta === "continue-practice"
      ? t("library.continuePractice")
      : t("library.recommendation.cta");
  const audioPreviewLabel =
    audioStatus === "loading"
      ? t("library.preview.audioPreviewLoading")
      : audioStatus === "playing"
        ? t("library.preview.audioPreviewStop")
        : t("library.preview.audioPreview");

  return (
    <section
      className="surface-elevated mb-5 p-4 animate-page-enter"
      data-testid="song-selection-preview"
      aria-label={t("library.preview.title")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_auto] lg:items-center">
        <div className="min-w-0">
          <span
            className="kicker-label"
            style={{ color: "var(--color-accent)" }}
          >
            {t("library.preview.title")}
          </span>
          <h2
            className="mt-1 truncate text-xl font-display font-bold"
            style={{ color: "var(--color-text)" }}
            data-testid="song-selection-preview-title"
          >
            {preview.title}
          </h2>
          <p
            className="mt-1 truncate text-sm font-body"
            style={{ color: "var(--color-text-muted)" }}
          >
            {preview.composer}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <button
            type="button"
            onClick={() => onToggleAudioPreview(preview)}
            disabled={audioStatus === "loading"}
            className="btn-surface-themed flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-body font-semibold cursor-pointer disabled:cursor-wait disabled:opacity-60"
            data-testid="song-selection-preview-audio"
          >
            {audioStatus === "loading" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : audioStatus === "playing" ? (
              <Square size={15} />
            ) : (
              <Volume2 size={16} />
            )}
            {audioPreviewLabel}
          </button>
          <button
            type="button"
            onClick={() => onPractice(preview)}
            disabled={isLoading}
            className="btn-primary-themed flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-body font-semibold cursor-pointer disabled:cursor-wait disabled:opacity-60"
            data-testid="song-selection-preview-practice"
          >
            {isLoading ? (
              <span
                className="h-4 w-4 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "rgba(255,255,255,0.45)",
                  borderTopColor: "#fff",
                }}
              />
            ) : (
              <PlayCircle size={16} />
            )}
            {ctaLabel}
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <PreviewMetric
          label={t("library.preview.length")}
          value={
            preview.durationSeconds !== null
              ? formatSongDuration(preview.durationSeconds)
              : "--"
          }
        />
        <PreviewMetric label={t("library.preview.grade")} value={grade} />
        <PreviewMetric label={t("library.preview.category")} value={category} />
        <PreviewMetric
          label={t("library.preview.bestScore")}
          value={bestScore}
        />
        <PreviewMetric
          label={t("library.preview.tracks")}
          value={
            preview.trackCount !== null
              ? String(preview.trackCount)
              : t("library.preview.tracksAfterPractice")
          }
        />
      </dl>

      {preview.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {preview.tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="rounded-md px-2 py-1 text-[10px] font-body font-medium"
              style={{
                color: "var(--color-text-muted)",
                background: "var(--color-surface-alt)",
                border: "1px solid var(--color-border)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div
      className="min-w-0 rounded-lg px-3 py-2"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 82%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <dt
        className="truncate text-[10px] font-body font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 truncate text-sm font-body font-semibold"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </dd>
    </div>
  );
}

function ImportedSongRow({
  record,
  isLoading,
  isEditing,
  onSelect,
  onEdit,
  animationDelay,
}: {
  record: ImportedSongRecord;
  isLoading: boolean;
  isEditing: boolean;
  onSelect: (record: ImportedSongRecord) => void;
  onEdit: (record: ImportedSongRecord) => void;
  animationDelay: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const gradeColor =
    record.grade !== undefined
      ? getGradeColor(record.grade)
      : "var(--color-border)";

  return (
    <div
      className="relative flex items-stretch gap-2 rounded-lg animate-stagger-child"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: "1px solid var(--color-border)",
        animationDelay: `${animationDelay}ms`,
      }}
      title={record.sourcePath}
    >
      <button
        type="button"
        onClick={() => onSelect(record)}
        disabled={record.missing || isLoading}
        className="grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-2.5 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 md:grid-cols-[minmax(0,1.5fr)_auto_auto]"
        data-testid={`imported-song-select-${record.id}`}
      >
        <span className="min-w-0">
          <span
            className="block truncate text-sm font-body font-semibold"
            style={{ color: "var(--color-text)" }}
            data-testid="imported-song-title"
          >
            {record.title}
          </span>
          <span
            className="mt-0.5 block truncate text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {record.composer ?? t("library.importedUnknownComposer")}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold"
            style={{
              color: gradeColor,
              background: `color-mix(in srgb, ${gradeColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${gradeColor} 30%, transparent)`,
            }}
          >
            {record.grade !== undefined ? gradeLabelShort[record.grade] : "--"}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-body font-medium"
            style={{
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
            }}
          >
            {record.category ? categoryLabels[record.category] : "--"}
          </span>
        </span>

        <span
          className="flex items-center gap-2 text-[11px] font-body md:justify-end"
          style={{
            color: record.missing
              ? "var(--color-accent)"
              : "var(--color-text-muted)",
          }}
        >
          {record.missing ? (
            <>
              <AlertCircle size={12} />
              {t("library.importedMissingBadge")}
            </>
          ) : (
            t("library.importedAvailable")
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onEdit(record)}
        className="mr-2 self-center flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer"
        aria-label={`${t("library.editImportedMetadata")}: ${record.title}`}
        aria-pressed={isEditing}
        title={`${t("library.editImportedMetadata")}: ${record.title}`}
        data-testid="imported-song-edit"
        style={{
          background: isEditing
            ? "color-mix(in srgb, var(--color-note3) 18%, var(--color-surface))"
            : "color-mix(in srgb, var(--color-surface) 90%, transparent)",
          color: isEditing ? "var(--color-note3)" : "var(--color-text-muted)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Pencil size={14} />
      </button>

      {isLoading && <LoadingOverlay radiusClass="rounded-lg" />}
    </div>
  );
}

function ImportedSongMetadataEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: ImportedSongMetadataDraft;
  onChange: (patch: Partial<ImportedSongMetadataDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const canSave = draft.title.trim().length > 0;

  return (
    <div
      className="grid gap-2 rounded-lg px-3 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto_auto_auto]"
      style={{
        background: "color-mix(in srgb, var(--color-note3) 7%, transparent)",
        border:
          "1px solid color-mix(in srgb, var(--color-note3) 22%, var(--color-border))",
      }}
      data-testid="imported-song-metadata-editor"
    >
      <input
        value={draft.title}
        onChange={(event) => onChange({ title: event.target.value })}
        className="min-w-0 rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataTitle")}
        placeholder={t("library.importedMetadataTitle")}
        data-testid="imported-song-title-input"
      />
      <input
        value={draft.composer}
        onChange={(event) => onChange({ composer: event.target.value })}
        className="min-w-0 rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataComposer")}
        placeholder={t("library.importedMetadataComposer")}
        data-testid="imported-song-composer-input"
      />
      <input
        value={draft.tags}
        onChange={(event) => onChange({ tags: event.target.value })}
        className="min-w-0 rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataTags")}
        placeholder={t("library.importedMetadataTags")}
        data-testid="imported-song-tags-input"
      />
      <select
        value={draft.grade}
        onChange={(event) =>
          onChange({ grade: event.target.value as ImportedGradeDraft })
        }
        className="rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataGrade")}
        data-testid="imported-song-grade-select"
      >
        <option value="">--</option>
        {importedGradeOptions.map((grade) => (
          <option key={grade} value={`${grade}`}>
            {gradeLabelShort[grade]}
          </option>
        ))}
      </select>
      <select
        value={draft.category}
        onChange={(event) =>
          onChange({ category: event.target.value as ImportedCategoryDraft })
        }
        className="rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataCategory")}
        data-testid="imported-song-category-select"
      >
        <option value="">--</option>
        {importedCategoryOptions.map((category) => (
          <option key={category} value={category}>
            {categoryLabels[category]}
          </option>
        ))}
      </select>
      <span className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="btn-primary-themed flex h-8 w-8 items-center justify-center rounded-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("library.saveImportedMetadata")}
          title={t("library.saveImportedMetadata")}
          data-testid="imported-song-metadata-save"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-surface-themed flex h-8 w-8 items-center justify-center rounded-md cursor-pointer"
          aria-label={t("library.cancelImportedMetadata")}
          title={t("library.cancelImportedMetadata")}
        >
          <X size={14} />
        </button>
      </span>
    </div>
  );
}

function SongListRow({
  song,
  activity,
  isLoading,
  isSelected,
  onSelect,
  onToggleFavorite,
  animationDelay,
}: {
  song: BuiltinSongMeta;
  activity: SongActivity;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: (songId: string) => void;
  onToggleFavorite: (songId: string) => void;
  animationDelay: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const gradeColor =
    song.grade !== undefined
      ? getGradeColor(song.grade)
      : "var(--color-border)";
  const category = song.category ?? "popular";
  const practicedLabel =
    activity.playCount > 0
      ? t("library.practicedTimes", { count: activity.playCount })
      : t("library.neverPracticed");

  return (
    <div
      className="relative flex items-stretch gap-2 rounded-lg animate-stagger-child"
      style={{
        background: isSelected
          ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: isSelected
          ? "1px solid color-mix(in srgb, var(--color-accent) 32%, var(--color-border))"
          : "1px solid var(--color-border)",
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <button
        data-testid={`song-select-${song.id}`}
        onClick={() => onSelect(song.id)}
        disabled={isLoading}
        className="grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-2.5 text-left cursor-pointer disabled:cursor-wait disabled:opacity-60 md:grid-cols-[minmax(0,1.5fr)_auto_auto_auto]"
      >
        <span className="min-w-0">
          <h3
            className="truncate text-sm font-body font-semibold"
            data-testid="song-list-row-title"
            style={{ color: "var(--color-text)" }}
          >
            {song.title}
          </h3>
          <span
            className="mt-0.5 block truncate text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {song.composer}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold"
            style={{
              color: gradeColor,
              background: `color-mix(in srgb, ${gradeColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${gradeColor} 30%, transparent)`,
            }}
          >
            {song.grade !== undefined ? gradeLabelShort[song.grade] : "--"}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-body font-medium"
            style={{
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
            }}
          >
            {categoryLabels[category]}
          </span>
        </span>

        <span
          className="flex items-center gap-2 text-[11px] font-mono tabular-nums md:justify-end"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>
            {activity.bestAccuracy !== null
              ? `${Math.round(activity.bestAccuracy)}%`
              : "--"}
          </span>
          <span>{practicedLabel}</span>
        </span>

        <span
          className="text-[11px] font-mono tabular-nums md:text-right"
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatSongDuration(song.durationSeconds)}
        </span>
      </button>

      <FavoriteButton
        song={song}
        activity={activity}
        onToggleFavorite={onToggleFavorite}
        className="mr-2 self-center"
      />

      {isLoading && <LoadingOverlay radiusClass="rounded-lg" />}
    </div>
  );
}

function FavoriteButton({
  song,
  activity,
  onToggleFavorite,
  className = "",
}: {
  song: BuiltinSongMeta;
  activity: SongActivity;
  onToggleFavorite: (songId: string) => void;
  className?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const label = activity.isFavorite
    ? t("library.unfavorite")
    : t("library.favorite");

  return (
    <button
      type="button"
      data-testid="song-favorite-toggle"
      onClick={() => onToggleFavorite(song.id)}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors cursor-pointer ${className}`}
      aria-label={`${label}: ${song.title}`}
      aria-pressed={activity.isFavorite}
      title={`${label}: ${song.title}`}
      style={{
        background: activity.isFavorite
          ? "color-mix(in srgb, var(--color-streak-gold) 18%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface) 90%, transparent)",
        color: activity.isFavorite
          ? "var(--color-streak-gold)"
          : "var(--color-text-muted)",
        border: "1px solid var(--color-border)",
      }}
    >
      <Star size={15} fill={activity.isFavorite ? "currentColor" : "none"} />
    </button>
  );
}

function LoadingOverlay({
  radiusClass,
}: {
  radiusClass: string;
}): React.JSX.Element {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${radiusClass}`}
      style={{
        background: "color-mix(in srgb, var(--color-surface) 70%, transparent)",
      }}
    >
      <div
        className="w-5 h-5 border-2 rounded-full animate-spin"
        style={{
          borderColor: "var(--color-border)",
          borderTopColor: "var(--color-accent)",
        }}
      />
    </div>
  );
}

function StatBadge({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 75%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span style={{ color: "var(--color-accent)" }}>{icon}</span>
      <div className="min-w-0">
        <span
          className="text-sm font-display font-bold leading-tight block"
          style={{ color: "var(--color-text)" }}
        >
          {value}
        </span>
        <span
          className="text-[10px] font-body leading-tight truncate block"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
