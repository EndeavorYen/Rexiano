import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Settings,
  Palette,
  Monitor,
  Volume2,
  Music,
  Keyboard,
  Globe,
  Info,
  Database,
  Download,
  ExternalLink,
  PackageOpen,
  RefreshCw,
  Upload,
  RotateCcw,
} from "lucide-react";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import type { Language } from "@renderer/stores/useSettingsStore";
import { themes, type ThemeId } from "@renderer/themes/tokens";
import { getAvailableLanguages } from "@renderer/i18n";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import type {
  AppUpdateAvailable,
  AppUpdateStatus,
  PracticeMode,
} from "@shared/types";
import {
  applyUserDataBackupToRuntime,
  createUserDataBackupFromRuntime,
  parseUserDataBackupText,
  resetUserDataBackupRuntime,
  type UserDataResetSelection,
} from "./userDataBackup";
import {
  createAppUpdateViewModel,
  type AppUpdateUiState,
} from "./appUpdateViewModel";

const themeList: ThemeId[] = ["lavender", "ocean", "peach", "midnight"];

const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

type SettingsTab =
  | "theme"
  | "display"
  | "audio"
  | "practice"
  | "shortcuts"
  | "language"
  | "backup"
  | "about";

const tabKeys = [
  "settings.tab.theme",
  "settings.tab.display",
  "settings.tab.audio",
  "settings.tab.practice",
  "settings.tab.keys",
  "settings.tab.lang",
  "settings.tab.backup",
  "settings.tab.about",
] as const;

const tabIds: SettingsTab[] = [
  "theme",
  "display",
  "audio",
  "practice",
  "shortcuts",
  "language",
  "backup",
  "about",
];

const basicTabIds: SettingsTab[] = ["theme", "language"];

const tabIcons = [
  <Palette size={14} key="theme" />,
  <Monitor size={14} key="display" />,
  <Volume2 size={14} key="audio" />,
  <Music size={14} key="practice" />,
  <Keyboard size={14} key="shortcuts" />,
  <Globe size={14} key="lang" />,
  <Database size={14} key="backup" />,
  <Info size={14} key="about" />,
];

const practiceModeKeys: {
  value: PracticeMode;
  key: "practice.watch" | "practice.wait" | "practice.free";
}[] = [
  { value: "watch", key: "practice.watch" },
  { value: "wait", key: "practice.wait" },
  { value: "free", key: "practice.free" },
];

/**
 * Full settings modal with tabbed navigation.
 * Covers Theme, Display, Audio, Practice, and Keyboard Shortcuts.
 */
interface SettingsPanelProps {
  /** When true, the panel renders pre-opened with no gear trigger button */
  inline?: boolean;
  /** Called when the inline panel is closed */
  onClose?: () => void;
}

export function SettingsPanel({
  inline = false,
  onClose,
}: SettingsPanelProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(inline);
  const [activeTab, setActiveTab] = useState<SettingsTab>("theme");
  const [isBasicMode, setIsBasicMode] = useState(true);
  const [settingsSearch, setSettingsSearch] = useState("");
  const visibleTabIds = isBasicMode ? basicTabIds : tabIds;
  const normalizedSettingsSearch = settingsSearch.trim().toLowerCase();
  const filteredTabIds =
    normalizedSettingsSearch.length === 0
      ? visibleTabIds
      : visibleTabIds.filter((id) => {
          const i = tabIds.indexOf(id);
          return t(tabKeys[i]).toLowerCase().includes(normalizedSettingsSearch);
        });
  const resolvedActiveTab = useMemo<SettingsTab>(() => {
    if (filteredTabIds.includes(activeTab)) return activeTab;
    return filteredTabIds[0] ?? "theme";
  }, [activeTab, filteredTabIds]);
  const panelRef = useRef<HTMLDivElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Theme state
  const currentThemeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Settings state
  const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const showFingering = useSettingsStore((s) => s.showFingering);
  const compactKeyLabels = useSettingsStore((s) => s.compactKeyLabels);
  const language = useSettingsStore((s) => s.language);
  const volume = useSettingsStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);
  const countInBeats = useSettingsStore((s) => s.countInBeats);
  const latencyCompensation = useSettingsStore((s) => s.latencyCompensation);
  const audioCompatibilityMode = useSettingsStore(
    (s) => s.audioCompatibilityMode,
  );
  const childFocusMode = useSettingsStore((s) => s.childFocusMode);

  const setShowNoteLabels = useSettingsStore((s) => s.setShowNoteLabels);
  const setShowFallingNoteLabels = useSettingsStore(
    (s) => s.setShowFallingNoteLabels,
  );
  const setShowFingering = useSettingsStore((s) => s.setShowFingering);
  const setCompactKeyLabels = useSettingsStore((s) => s.setCompactKeyLabels);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const setDefaultSpeed = useSettingsStore((s) => s.setDefaultSpeed);
  const setDefaultMode = useSettingsStore((s) => s.setDefaultMode);
  const setMetronomeEnabled = useSettingsStore((s) => s.setMetronomeEnabled);
  const setCountInBeats = useSettingsStore((s) => s.setCountInBeats);
  const setLatencyCompensation = useSettingsStore(
    (s) => s.setLatencyCompensation,
  );
  const setAudioCompatibilityMode = useSettingsStore(
    (s) => s.setAudioCompatibilityMode,
  );
  const setChildFocusMode = useSettingsStore((s) => s.setChildFocusMode);

  // First-visit pulse
  const [isFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem("rexiano-theme-picker-seen");
    } catch {
      return false;
    }
  });

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const handleOpen = useCallback(() => {
    setOpen((prev) => !prev);
    if (isFirstVisit) {
      try {
        localStorage.setItem("rexiano-theme-picker-seen", "1");
      } catch {
        /* noop */
      }
    }
  }, [isFirstVisit]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({
    active: open,
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef: inline ? undefined : triggerRef,
    onDismiss: handleClose,
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  const [backupBusyAction, setBackupBusyAction] = useState<
    "export" | "import" | "reset" | null
  >(null);
  const [backupStatus, setBackupStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const handleExportUserData = useCallback(async () => {
    setBackupBusyAction("export");
    setBackupStatus(null);

    try {
      const result = await createUserDataBackupFromRuntime(
        localStorage,
        window.api,
      );
      if (!result.ok) {
        setBackupStatus({ kind: "error", message: result.errors.join("\n") });
        return;
      }

      const fileText = JSON.stringify(result.manifest, null, 2);
      const blob = new Blob([fileText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rexiano-backup-${result.manifest.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setBackupStatus({
        kind: "success",
        message: t("settings.backupExportSuccess", {
          count: result.manifest.scopes.length,
        }),
      });
    } catch (error) {
      setBackupStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : t("settings.backupUnknownError"),
      });
    } finally {
      setBackupBusyAction(null);
    }
  }, [t]);

  const handleImportUserDataFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setBackupBusyAction("import");
      setBackupStatus(null);

      try {
        const parsed = parseUserDataBackupText(await file.text());
        if (!parsed.ok) {
          setBackupStatus({
            kind: "error",
            message: parsed.errors.join("\n"),
          });
          return;
        }

        const result = await applyUserDataBackupToRuntime(
          parsed.manifest,
          localStorage,
          window.api,
        );
        if (!result.ok) {
          setBackupStatus({
            kind: "error",
            message: result.errors.join("\n"),
          });
          return;
        }

        setBackupStatus({
          kind: "success",
          message: t("settings.backupImportSuccess", {
            count: result.appliedScopes.length,
          }),
        });
      } catch (error) {
        setBackupStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : t("settings.backupUnknownError"),
        });
      } finally {
        setBackupBusyAction(null);
      }
    },
    [t],
  );

  const handleResetUserData = useCallback(
    async (
      selection: UserDataResetSelection,
      confirmMessage = t("settings.backupResetConfirmGeneric"),
    ) => {
      if (!window.confirm(confirmMessage)) return;

      setBackupBusyAction("reset");
      setBackupStatus(null);

      try {
        const result = await resetUserDataBackupRuntime(
          localStorage,
          window.api,
          selection,
        );
        if (!result.ok) {
          setBackupStatus({
            kind: "error",
            message: result.errors.join("\n"),
          });
          return;
        }

        setBackupStatus({
          kind: "success",
          message: t("settings.backupResetSuccess", {
            count: result.appliedScopes.length,
          }),
        });
      } catch (error) {
        setBackupStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : t("settings.backupUnknownError"),
        });
      } finally {
        setBackupBusyAction(null);
      }
    },
    [t],
  );

  // About tab: lazy-load app info
  const [appInfo, setAppInfo] = useState<{
    version: string;
    changelog: string;
  } | null>(null);

  useEffect(() => {
    if (resolvedActiveTab === "about" && !appInfo) {
      window.api.getAppInfo().then(setAppInfo);
    }
  }, [resolvedActiveTab, appInfo]);

  const [updateStatus, setUpdateStatus] = useState<AppUpdateUiState>({
    status: "idle",
  });
  const updateViewModel = createAppUpdateViewModel(updateStatus);
  const updateReleaseUrl =
    "releaseUrl" in updateStatus ? updateStatus.releaseUrl : null;
  const availableUpdate: AppUpdateAvailable | null =
    updateStatus.status === "available" ? updateStatus : null;
  const downloadedPath =
    updateStatus.status === "ready" ? updateStatus.downloadedPath : null;
  const updateDetail =
    updateStatus.status === "available" || updateStatus.status === "ready"
      ? `v${updateStatus.latestVersion} · ${updateStatus.artifactName}`
      : updateStatus.status === "not-available"
        ? `v${updateStatus.latestVersion}`
        : updateStatus.status === "failed"
          ? updateStatus.message
          : updateStatus.status === "downloading"
            ? `${updateStatus.progress.percent}% · ${updateStatus.artifactName}`
            : t(updateViewModel.headingKey);

  useEffect(() => {
    return window.api.onUpdateProgress((status: AppUpdateStatus) => {
      setUpdateStatus(status);
    });
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    setUpdateStatus({ status: "checking" });

    try {
      setUpdateStatus(await window.api.checkForUpdates());
    } catch (error) {
      setUpdateStatus({
        status: "failed",
        currentVersion: appInfo?.version ?? "unknown",
        message:
          error instanceof Error ? error.message : t("about.updateFailed"),
      });
    }
  }, [appInfo?.version, t]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!availableUpdate) return;

    setUpdateStatus({
      status: "downloading",
      currentVersion: availableUpdate.currentVersion,
      latestVersion: availableUpdate.latestVersion,
      artifactName: availableUpdate.artifactName,
      progress: {
        percent: 0,
        transferredBytes: 0,
        totalBytes: availableUpdate.artifactSize,
      },
    });
    try {
      setUpdateStatus(await window.api.downloadUpdate(availableUpdate));
    } catch (error) {
      setUpdateStatus({
        status: "failed",
        currentVersion: availableUpdate.currentVersion,
        message:
          error instanceof Error ? error.message : t("about.updateFailed"),
      });
    }
  }, [availableUpdate, t]);

  const handleOpenRelease = useCallback(() => {
    if (updateReleaseUrl) void window.api.openUpdateRelease(updateReleaseUrl);
  }, [updateReleaseUrl]);

  const handleOpenDownloaded = useCallback(() => {
    if (downloadedPath) void window.api.openDownloadedUpdate(downloadedPath);
  }, [downloadedPath]);

  return (
    <>
      {/* Trigger button — gear icon (hidden in inline mode) */}
      {!inline && (
        <button
          ref={triggerRef}
          onClick={handleOpen}
          className={`btn-surface-themed w-8 h-8 flex items-center justify-center rounded-full cursor-pointer ${isFirstVisit ? "animate-gentle-pulse" : ""}`}
          style={{
            border: "1px solid var(--color-border)",
          }}
          title={t("settings.title")}
          aria-label={t("settings.title")}
          data-testid="settings-trigger"
        >
          <Settings size={16} style={{ color: "var(--color-text-muted)" }} />
        </button>
      )}

      {/* Modal backdrop + panel */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic">
          <div
            ref={panelRef}
            className="w-[92vw] max-w-[560px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl modal-card-cinematic overflow-hidden"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 90%, transparent)",
              border: "1px solid var(--color-border)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t("settings.title")}
            tabIndex={-1}
            data-testid="settings-panel"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <h2
                className="text-base font-display font-bold"
                style={{ color: "var(--color-text)" }}
              >
                {t("settings.title")}
              </h2>
              <div className="flex items-center gap-2">
                <input
                  value={settingsSearch}
                  onChange={(e) => setSettingsSearch(e.target.value)}
                  placeholder={t("settings.searchTabs")}
                  className="input-themed w-[120px] px-2 py-1 text-[11px] font-body"
                  aria-label={t("settings.searchTabsAria")}
                />
                <button
                  onClick={() => {
                    const goingBasic = !isBasicMode;
                    setIsBasicMode(goingBasic);
                    if (
                      goingBasic &&
                      !basicTabIds.includes(resolvedActiveTab)
                    ) {
                      setActiveTab("theme");
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-body rounded-full cursor-pointer transition-colors"
                  style={{
                    background: isBasicMode
                      ? "color-mix(in srgb, var(--color-surface-alt) 88%, var(--color-surface))"
                      : "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                    color: isBasicMode
                      ? "var(--color-text-muted)"
                      : "var(--color-accent)",
                    border: isBasicMode
                      ? "1px solid var(--color-border)"
                      : "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
                  }}
                  data-testid="settings-mode-toggle"
                >
                  {isBasicMode
                    ? t("settings.basicMode")
                    : t("settings.advancedMode")}
                </button>
                <button
                  ref={closeButtonRef}
                  onClick={() => handleClose()}
                  className="btn-surface-themed w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                  title={t("settings.close")}
                  aria-label={t("settings.close")}
                  data-testid="settings-close"
                >
                  <X size={14} style={{ color: "var(--color-text-muted)" }} />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div
              className="flex shrink-0 px-2 pt-2 gap-1 overflow-x-auto"
              style={{
                borderBottom: "1px solid var(--color-border)",
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 30%, var(--color-surface))",
              }}
            >
              {filteredTabIds.map((id) => {
                const i = tabIds.indexOf(id);
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-body font-medium rounded-t-lg cursor-pointer transition-colors relative whitespace-nowrap"
                    style={{
                      color:
                        resolvedActiveTab === id
                          ? "var(--color-accent)"
                          : "var(--color-text-muted)",
                      background:
                        resolvedActiveTab === id
                          ? "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface))"
                          : "transparent",
                    }}
                    data-testid={`settings-tab-${id}`}
                  >
                    {tabIcons[i]}
                    {t(tabKeys[i])}
                    {resolvedActiveTab === id && (
                      <div
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                        style={{ background: "var(--color-accent)" }}
                      />
                    )}
                  </button>
                );
              })}
              {filteredTabIds.length === 0 && (
                <span
                  className="px-3 py-2 text-xs font-body"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("settings.noMatchingTab")}
                </span>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                className="rounded-xl px-3 py-2.5 mb-4"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 38%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
                data-testid="settings-common-quick"
              >
                <div
                  className="text-[10px] font-mono uppercase tracking-wider mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("settings.common")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setMuted(!muted)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-body font-medium cursor-pointer"
                    style={{
                      color: muted ? "#fff" : "var(--color-text-muted)",
                      background: muted
                        ? "var(--color-accent)"
                        : "var(--color-surface-alt)",
                    }}
                  >
                    {t("settings.muteAudio")}
                  </button>
                  <button
                    onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-body font-medium cursor-pointer"
                    style={{
                      color: metronomeEnabled
                        ? "#fff"
                        : "var(--color-text-muted)",
                      background: metronomeEnabled
                        ? "var(--color-accent)"
                        : "var(--color-surface-alt)",
                    }}
                  >
                    {t("settings.metronome")}
                  </button>
                  <button
                    onClick={() => setShowNoteLabels(!showNoteLabels)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-body font-medium cursor-pointer"
                    style={{
                      color: showNoteLabels
                        ? "#fff"
                        : "var(--color-text-muted)",
                      background: showNoteLabels
                        ? "var(--color-accent)"
                        : "var(--color-surface-alt)",
                    }}
                  >
                    {t("settings.showNoteLabels")}
                  </button>
                </div>
              </div>

              {resolvedActiveTab === "theme" && (
                <TabContent>
                  <SectionTitle>{t("settings.chooseTheme")}</SectionTitle>
                  <div className="flex gap-4 mt-3">
                    {themeList.map((id) => (
                      <button
                        key={id}
                        onClick={() => setTheme(id)}
                        className="flex flex-col items-center gap-2 cursor-pointer group"
                        title={themes[id].label}
                        data-testid={`theme-dot-${id}`}
                      >
                        <div
                          className="w-10 h-10 rounded-full transition-transform group-hover:scale-110"
                          style={{
                            background: themes[id].dot,
                            boxShadow:
                              id === currentThemeId
                                ? `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent)`
                                : "0 1px 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          {id === currentThemeId && (
                            <svg
                              className="m-auto mt-[12px]"
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2.5 6L5 8.5L9.5 3.5"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <span
                          className="text-[11px] font-body font-medium"
                          style={{
                            color:
                              id === currentThemeId
                                ? "var(--color-accent)"
                                : "var(--color-text-muted)",
                          }}
                        >
                          {themes[id].label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p
                    className="text-[11px] font-body mt-4"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("settings.themeDesc")}
                  </p>
                </TabContent>
              )}

              {resolvedActiveTab === "display" && (
                <TabContent>
                  <SectionTitle>{t("settings.displayOptions")}</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    <ToggleRow
                      label={t("settings.showNoteLabels")}
                      description={t("settings.showNoteLabelsDesc")}
                      checked={showNoteLabels}
                      onChange={setShowNoteLabels}
                      testId="toggle-note-labels"
                    />
                    <ToggleRow
                      label={t("settings.showFallingLabels")}
                      description={t("settings.showFallingLabelsDesc")}
                      checked={showFallingNoteLabels}
                      onChange={setShowFallingNoteLabels}
                      testId="toggle-falling-labels"
                    />
                    <ToggleRow
                      label={t("settings.showFingering")}
                      description={t("settings.showFingeringDesc")}
                      checked={showFingering}
                      onChange={setShowFingering}
                      testId="toggle-fingering"
                    />
                    <ToggleRow
                      label={t("settings.compactKeyLabels")}
                      description={t("settings.compactKeyLabelsDesc")}
                      checked={compactKeyLabels}
                      onChange={setCompactKeyLabels}
                      testId="toggle-compact-key-labels"
                    />
                  </div>
                </TabContent>
              )}

              {resolvedActiveTab === "audio" && (
                <TabContent>
                  <SectionTitle>{t("settings.audioSettings")}</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    {/* Volume slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-xs font-body"
                          style={{ color: "var(--color-text)" }}
                        >
                          {t("settings.volume")}
                        </span>
                        <span
                          className="text-xs font-mono tabular-nums"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {muted ? t("settings.muted") : volume}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={muted ? 0 : volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-full"
                        disabled={muted}
                        data-testid="volume-slider"
                      />
                    </div>
                    <ToggleRow
                      label={t("settings.muteAudio")}
                      checked={muted}
                      onChange={setMuted}
                      testId="toggle-mute"
                    />
                    <ToggleRow
                      label={t("settings.audioCompatibilityMode")}
                      description={t("settings.audioCompatibilityModeDesc")}
                      checked={audioCompatibilityMode}
                      onChange={setAudioCompatibilityMode}
                      testId="toggle-audio-compatibility"
                    />
                  </div>
                </TabContent>
              )}

              {resolvedActiveTab === "practice" && (
                <TabContent>
                  <SectionTitle>{t("settings.practiceDefaults")}</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    <ToggleRow
                      label={t("settings.childFocusMode")}
                      description={t("settings.childFocusModeDesc")}
                      checked={childFocusMode}
                      onChange={setChildFocusMode}
                      testId="toggle-child-focus-mode"
                    />

                    {/* Default mode */}
                    <div>
                      <span
                        className="text-xs font-body block mb-1.5"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("settings.defaultMode")}
                      </span>
                      <div className="flex gap-1.5">
                        {practiceModeKeys.map((m) => (
                          <button
                            key={m.value}
                            onClick={() => setDefaultMode(m.value)}
                            className="px-3 py-1.5 text-xs font-body rounded-lg cursor-pointer transition-colors"
                            style={{
                              background:
                                defaultMode === m.value
                                  ? "var(--color-accent)"
                                  : "var(--color-surface-alt)",
                              color:
                                defaultMode === m.value
                                  ? "#fff"
                                  : "var(--color-text-muted)",
                            }}
                            data-testid={`mode-btn-${m.value}`}
                          >
                            {t(m.key)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Default speed */}
                    <div>
                      <span
                        className="text-xs font-body block mb-1.5"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("settings.defaultSpeed")}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {speedPresets.map((s) => (
                          <button
                            key={s}
                            onClick={() => setDefaultSpeed(s)}
                            className="px-2.5 py-1 text-[11px] font-mono rounded-lg cursor-pointer transition-colors"
                            style={{
                              background:
                                defaultSpeed === s
                                  ? "var(--color-accent)"
                                  : "var(--color-surface-alt)",
                              color:
                                defaultSpeed === s
                                  ? "#fff"
                                  : "var(--color-text-muted)",
                            }}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metronome */}
                    <ToggleRow
                      label={t("settings.metronome")}
                      description={t("settings.metronomeDesc")}
                      checked={metronomeEnabled}
                      onChange={setMetronomeEnabled}
                      testId="toggle-metronome"
                    />

                    {/* Count-in beats */}
                    <div>
                      <span
                        className="text-xs font-body block mb-1.5"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("settings.countInBeats")}
                      </span>
                      <div className="flex gap-1.5">
                        {[0, 2, 4, 8].map((n) => (
                          <button
                            key={n}
                            onClick={() => setCountInBeats(n)}
                            className="px-2.5 py-1 text-[11px] font-mono rounded-lg cursor-pointer transition-colors"
                            style={{
                              background:
                                countInBeats === n
                                  ? "var(--color-accent)"
                                  : "var(--color-surface-alt)",
                              color:
                                countInBeats === n
                                  ? "#fff"
                                  : "var(--color-text-muted)",
                            }}
                          >
                            {n === 0 ? t("settings.countInOff") : `${n}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Latency compensation */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-xs font-body"
                          style={{ color: "var(--color-text)" }}
                        >
                          {t("settings.latencyComp")}
                        </span>
                        <span
                          className="text-xs font-mono tabular-nums"
                          style={{ color: "var(--color-text-muted)" }}
                          data-testid="latency-value"
                        >
                          {latencyCompensation}ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={latencyCompensation}
                        onChange={(e) =>
                          setLatencyCompensation(Number(e.target.value))
                        }
                        className="w-full"
                        data-testid="latency-slider"
                        aria-label={t("settings.latencyComp")}
                      />
                      <span
                        className="text-[10px] font-body mt-1 block"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {t("settings.latencyDesc")}
                      </span>
                    </div>
                  </div>
                </TabContent>
              )}

              {resolvedActiveTab === "shortcuts" && (
                <TabContent>
                  <SectionTitle>{t("settings.keyboardShortcuts")}</SectionTitle>
                  <div className="flex flex-col gap-2.5 mt-3">
                    <ShortcutRow
                      keys="Space"
                      action={t("settings.shortcut.playPause")}
                    />
                    <ShortcutRow
                      keys="R"
                      action={t("settings.shortcut.restart")}
                    />
                    <ShortcutRow
                      keys="[ / ↓"
                      action={t("settings.shortcut.speedDown")}
                    />
                    <ShortcutRow
                      keys="] / ↑"
                      action={t("settings.shortcut.speedUp")}
                    />
                    <ShortcutRow
                      keys="A"
                      action={t("settings.shortcut.loopA")}
                    />
                    <ShortcutRow
                      keys="B"
                      action={t("settings.shortcut.loopB")}
                    />
                    <ShortcutRow
                      keys="Esc"
                      action={t("settings.shortcut.closeBack")}
                    />
                  </div>
                </TabContent>
              )}

              {resolvedActiveTab === "language" && (
                <TabContent>
                  <SectionTitle>{t("settings.language")}</SectionTitle>
                  <div className="flex flex-col gap-2 mt-3">
                    {getAvailableLanguages().map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code as Language)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors text-left"
                        style={{
                          background:
                            language === lang.code
                              ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
                              : "var(--color-surface-alt)",
                          border:
                            language === lang.code
                              ? "1.5px solid var(--color-accent)"
                              : "1.5px solid transparent",
                        }}
                        data-testid={`lang-btn-${lang.code}`}
                      >
                        <span
                          className="text-sm font-body font-medium"
                          style={{
                            color:
                              language === lang.code
                                ? "var(--color-accent)"
                                : "var(--color-text)",
                          }}
                        >
                          {lang.label}
                        </span>
                        {language === lang.code && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            className="ml-auto"
                          >
                            <path
                              d="M3 7L6 10L11 4"
                              stroke="var(--color-accent)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                  <p
                    className="text-[10px] font-body mt-3"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("settings.langDesc")}
                  </p>
                </TabContent>
              )}

              {resolvedActiveTab === "backup" && (
                <TabContent>
                  <SectionTitle>{t("settings.backupTitle")}</SectionTitle>
                  <p
                    className="text-[11px] font-body mt-2"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("settings.backupDesc")}
                  </p>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportUserDataFile}
                    data-testid="user-data-import-file"
                  />
                  <div className="flex flex-col gap-2.5 mt-3">
                    <BackupActionButton
                      icon={<Download size={15} />}
                      label={t("settings.backupExport")}
                      description={t("settings.backupExportDesc")}
                      disabled={backupBusyAction !== null}
                      onClick={handleExportUserData}
                      testId="user-data-export"
                    />
                    <BackupActionButton
                      icon={<Upload size={15} />}
                      label={t("settings.backupImport")}
                      description={t("settings.backupImportDesc")}
                      disabled={backupBusyAction !== null}
                      onClick={() => backupFileInputRef.current?.click()}
                      testId="user-data-import"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <BackupActionButton
                        icon={<RotateCcw size={15} />}
                        label={t("settings.backupResetSettings")}
                        description={t("settings.backupResetSettingsDesc")}
                        disabled={backupBusyAction !== null}
                        onClick={() => handleResetUserData(["settings"])}
                        danger
                        testId="user-data-reset-settings"
                      />
                      <BackupActionButton
                        icon={<RotateCcw size={15} />}
                        label={t("settings.backupResetProgress")}
                        description={t("settings.backupResetProgressDesc")}
                        disabled={backupBusyAction !== null}
                        onClick={() => handleResetUserData(["progress"])}
                        danger
                        testId="user-data-reset-progress"
                      />
                      <BackupActionButton
                        icon={<RotateCcw size={15} />}
                        label={t("settings.backupResetRecents")}
                        description={t("settings.backupResetRecentsDesc")}
                        disabled={backupBusyAction !== null}
                        onClick={() => handleResetUserData(["recents"])}
                        danger
                        testId="user-data-reset-recents"
                      />
                      <BackupActionButton
                        icon={<RotateCcw size={15} />}
                        label={t("settings.backupReset")}
                        description={t("settings.backupResetDesc")}
                        disabled={backupBusyAction !== null}
                        onClick={() =>
                          handleResetUserData(
                            "all",
                            t("settings.backupResetConfirm"),
                          )
                        }
                        danger
                        testId="user-data-reset"
                      />
                    </div>
                  </div>
                  {backupStatus && (
                    <div
                      className="mt-3 rounded-lg px-3 py-2 text-[11px] font-body whitespace-pre-wrap"
                      style={{
                        color:
                          backupStatus.kind === "success"
                            ? "var(--color-accent)"
                            : "#b42318",
                        background:
                          backupStatus.kind === "success"
                            ? "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface))"
                            : "color-mix(in srgb, #f04438 10%, var(--color-surface))",
                        border:
                          backupStatus.kind === "success"
                            ? "1px solid color-mix(in srgb, var(--color-accent) 28%, transparent)"
                            : "1px solid color-mix(in srgb, #f04438 28%, transparent)",
                      }}
                      role="status"
                      data-testid="user-data-backup-status"
                    >
                      {backupStatus.message}
                    </div>
                  )}
                </TabContent>
              )}

              {resolvedActiveTab === "about" && (
                <TabContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("about.version")}
                      </span>
                      <span
                        className="font-mono text-sm px-2 py-0.5 rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                          color: "var(--color-accent)",
                        }}
                      >
                        {appInfo ? `v${appInfo.version}` : "…"}
                      </span>
                    </div>

                    <div
                      className="rounded-xl p-3 space-y-3"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-surface-alt) 52%, var(--color-surface))",
                        border: "1px solid var(--color-border)",
                      }}
                      data-testid="app-update-panel"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-xs font-display font-bold"
                            style={{ color: "var(--color-text)" }}
                          >
                            {t("about.updateTitle")}
                          </p>
                          <p
                            className="mt-1 text-[11px] font-body leading-relaxed"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            {t("about.updateIntro")}
                          </p>
                          {childFocusMode && (
                            <p
                              className="mt-1 text-[11px] font-body leading-relaxed"
                              style={{ color: "var(--color-accent)" }}
                            >
                              {t("about.updateFocusModeNote")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-body font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            color: "var(--color-accent)",
                            background:
                              "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                            border:
                              "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
                          }}
                          disabled={!updateViewModel.canCheck}
                          onClick={handleCheckForUpdates}
                          data-testid="app-update-check"
                        >
                          <RefreshCw size={14} />
                          {updateStatus.status === "checking"
                            ? t("about.updateChecking")
                            : t("about.updateCheck")}
                        </button>
                      </div>

                      <div
                        className="rounded-lg px-3 py-2"
                        style={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <p
                          className="text-xs font-body font-semibold"
                          style={{ color: "var(--color-text)" }}
                          data-testid="app-update-status"
                        >
                          {t(updateViewModel.headingKey)}
                        </p>
                        <p
                          className="mt-1 text-[11px] font-body"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {updateDetail}
                        </p>
                        {updateViewModel.progressPercent !== null && (
                          <div
                            className="mt-2 h-1.5 overflow-hidden rounded-full"
                            style={{ background: "var(--color-surface-alt)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(0, Math.min(100, updateViewModel.progressPercent))}%`,
                                background: "var(--color-accent)",
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {updateViewModel.canDownload && (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-body font-semibold"
                            style={{
                              color: "var(--color-accent)",
                              background:
                                "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                              border:
                                "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
                            }}
                            onClick={handleDownloadUpdate}
                            data-testid="app-update-download"
                          >
                            <Download size={14} />
                            {t("about.updateDownload")}
                          </button>
                        )}
                        {updateViewModel.canOpenDownloaded && (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-body font-semibold"
                            style={{
                              color: "var(--color-accent)",
                              background:
                                "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                              border:
                                "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
                            }}
                            onClick={handleOpenDownloaded}
                            data-testid="app-update-open-installer"
                          >
                            <PackageOpen size={14} />
                            {t("about.updateOpenInstaller")}
                          </button>
                        )}
                        {updateViewModel.canOpenRelease && updateReleaseUrl && (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-body font-semibold"
                            style={{
                              color: "var(--color-text-muted)",
                              background: "var(--color-surface)",
                              border: "1px solid var(--color-border)",
                            }}
                            onClick={handleOpenRelease}
                            data-testid="app-update-open-release"
                          >
                            <ExternalLink size={14} />
                            {t("about.updateReleaseNotes")}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <p
                        className="text-xs font-mono uppercase tracking-widest mb-2"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {t("about.changelog")}
                      </p>
                      <pre
                        className="text-xs leading-relaxed rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap"
                        style={{
                          background:
                            "color-mix(in srgb, var(--color-surface) 70%, transparent)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {appInfo
                          ? appInfo.changelog || t("about.noChangelog")
                          : "…"}
                      </pre>
                    </div>
                  </div>
                </TabContent>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Sub-components ─── */

function TabContent({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="animate-page-enter">{children}</div>;
}

function SectionTitle({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h3
      className="text-[11px] font-display font-bold uppercase tracking-wider"
      style={{ color: "var(--color-text-muted)" }}
    >
      {children}
    </h3>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}): React.JSX.Element {
  return (
    <label
      className="flex items-center justify-between cursor-pointer gap-3 rounded-xl px-3 py-2.5"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 52%, var(--color-surface))",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex flex-col">
        <span
          className="text-xs font-body"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </span>
        {description && (
          <span
            className="text-[10px] font-body mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            {description}
          </span>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-10 h-[22px] rounded-full relative transition-colors shrink-0"
        style={{
          background: checked
            ? "var(--color-accent)"
            : "var(--color-surface-alt)",
          border: checked
            ? "1px solid transparent"
            : "1px solid var(--color-border)",
        }}
        data-testid={testId}
      >
        <span
          className="absolute top-[2px] w-4 h-4 rounded-full transition-all duration-150"
          style={{
            background: checked ? "#fff" : "var(--color-text-muted)",
            left: checked ? "calc(100% - 19px)" : "2px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
          }}
        />
      </button>
    </label>
  );
}

function BackupActionButton({
  icon,
  label,
  description,
  disabled,
  onClick,
  danger = false,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
  danger?: boolean;
  testId: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: danger
          ? "color-mix(in srgb, #f04438 7%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface-alt) 52%, var(--color-surface))",
        border: danger
          ? "1px solid color-mix(in srgb, #f04438 22%, var(--color-border))"
          : "1px solid var(--color-border)",
      }}
      data-testid={testId}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          color: danger ? "#b42318" : "var(--color-accent)",
          background: danger
            ? "color-mix(in srgb, #f04438 12%, var(--color-surface))"
            : "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className="block text-xs font-body font-semibold"
          style={{ color: danger ? "#b42318" : "var(--color-text)" }}
        >
          {label}
        </span>
        <span
          className="block text-[10px] font-body mt-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          {description}
        </span>
      </span>
    </button>
  );
}

function ShortcutRow({
  keys,
  action,
}: {
  keys: string;
  action: string;
}): React.JSX.Element {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 52%, var(--color-surface))",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="text-xs font-body"
        style={{ color: "var(--color-text-muted)" }}
      >
        {action}
      </span>
      <kbd
        className="text-[11px] font-mono px-2 py-0.5 rounded"
        style={{
          background: "var(--color-surface-alt)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
        }}
      >
        {keys}
      </kbd>
    </div>
  );
}
