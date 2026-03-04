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
} from "lucide-react";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import type { Language, UiScale } from "@renderer/stores/useSettingsStore";
import type { TranslationKey } from "@renderer/i18n/types";
import { themes, type ThemeId } from "@renderer/themes/tokens";
import { getAvailableLanguages } from "@renderer/i18n";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { PracticeMode } from "@shared/types";

const themeList: ThemeId[] = ["lavender", "ocean", "peach", "midnight"];

const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

type SettingsTab =
  | "theme"
  | "display"
  | "audio"
  | "practice"
  | "shortcuts"
  | "language"
  | "about";

const tabs: { id: SettingsTab; key: TranslationKey; icon: React.ReactNode }[] =
  [
    { id: "theme", key: "settings.tab.theme", icon: <Palette size={14} /> },
    { id: "display", key: "settings.tab.display", icon: <Monitor size={14} /> },
    { id: "audio", key: "settings.tab.audio", icon: <Volume2 size={14} /> },
    { id: "practice", key: "settings.tab.practice", icon: <Music size={14} /> },
    { id: "shortcuts", key: "settings.tab.keys", icon: <Keyboard size={14} /> },
    { id: "language", key: "settings.tab.lang", icon: <Globe size={14} /> },
    { id: "about", key: "settings.tab.about", icon: <Info size={14} /> },
  ];

const tabIds: SettingsTab[] = tabs.map((t) => t.id);

const basicTabIds: SettingsTab[] = ["theme", "language"];

const practiceModeKeys: {
  value: PracticeMode;
  key: "practice.watch" | "practice.wait" | "practice.free";
}[] = [
  { value: "watch", key: "practice.watch" },
  { value: "wait", key: "practice.wait" },
  { value: "free", key: "practice.free" },
];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

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
          const tab = tabs.find((tb) => tb.id === id);
          return tab
            ? t(tab.key).toLowerCase().includes(normalizedSettingsSearch)
            : false;
        });
  const resolvedActiveTab = useMemo<SettingsTab>(() => {
    if (filteredTabIds.includes(activeTab)) return activeTab;
    return filteredTabIds[0] ?? "theme";
  }, [activeTab, filteredTabIds]);
  const panelRef = useRef<HTMLDivElement>(null);

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
  // Live volume comes from usePlaybackStore (0-1 scale); settings store holds persisted default only
  const playbackVolume = usePlaybackStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);
  /** Ref to remember volume before muting, so we can restore on unmute */
  const preMuteVolumeRef = useRef(playbackVolume > 0 ? playbackVolume : 0.8);
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);
  const countInBeats = useSettingsStore((s) => s.countInBeats);
  const latencyCompensation = useSettingsStore((s) => s.latencyCompensation);
  const audioCompatibilityMode = useSettingsStore(
    (s) => s.audioCompatibilityMode,
  );

  const setShowNoteLabels = useSettingsStore((s) => s.setShowNoteLabels);
  const setShowFallingNoteLabels = useSettingsStore(
    (s) => s.setShowFallingNoteLabels,
  );
  const setShowFingering = useSettingsStore((s) => s.setShowFingering);
  const setCompactKeyLabels = useSettingsStore((s) => s.setCompactKeyLabels);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setSettingsVolume = useSettingsStore((s) => s.setVolume);
  const setSettingsMuted = useSettingsStore((s) => s.setMuted);
  const setPlaybackVolume = usePlaybackStore((s) => s.setVolume);
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
  const uiScale = useSettingsStore((s) => s.uiScale);
  const setUiScale = useSettingsStore((s) => s.setUiScale);

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

  // Close on outside click (pointerdown covers mouse, touch, and pen)
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }

      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        focusables[0].focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
        return;
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = getFocusableElements(panel);
    if (focusables.length > 0) {
      focusables[0].focus();
      return;
    }
    panel.focus();
  }, [open]);

  // About tab: lazy-load app info (fetch only once)
  const [appInfo, setAppInfo] = useState<{
    version: string;
    changelog: string;
  } | null>(null);
  const appInfoFetchedRef = useRef(false);

  useEffect(() => {
    if (resolvedActiveTab === "about" && !appInfoFetchedRef.current) {
      appInfoFetchedRef.current = true;
      window.api
        .getAppInfo()
        .then(setAppInfo)
        .catch(() => setAppInfo(null));
    }
  }, [resolvedActiveTab]);

  return (
    <>
      {/* Trigger button — gear icon (hidden in inline mode) */}
      {!inline && (
        <button
          onClick={handleOpen}
          className={`btn-surface-themed w-8 h-8 flex items-center justify-center rounded-full cursor-pointer ${isFirstVisit ? "animate-gentle-pulse" : ""}`}
          style={{
            border: "1px solid var(--color-border)",
          }}
          title={t("settings.title")}
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
            data-testid="settings-panel"
            tabIndex={-1}
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
                  autoFocus
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
                  onClick={() => handleClose()}
                  className="btn-surface-themed w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                  title={t("settings.close")}
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
                const tab = tabs.find((tb) => tb.id === id)!;
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
                    {tab.icon}
                    {t(tab.key)}
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
                    onClick={() => {
                      const newMuted = !muted;
                      setSettingsMuted(newMuted);
                      if (newMuted) {
                        preMuteVolumeRef.current =
                          playbackVolume > 0
                            ? playbackVolume
                            : preMuteVolumeRef.current;
                        setPlaybackVolume(0);
                      } else {
                        setPlaybackVolume(preMuteVolumeRef.current);
                      }
                    }}
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

                    {/* UI Scale selector */}
                    <div
                      className="rounded-xl px-3 py-2.5"
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
                          {t("settings.uiScale")}
                        </span>
                        <span
                          className="text-[10px] font-body mt-0.5"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {t("settings.uiScaleDesc")}
                        </span>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {(
                          [
                            { value: "normal", key: "settings.uiScale.normal" },
                            { value: "large", key: "settings.uiScale.large" },
                            { value: "xlarge", key: "settings.uiScale.xlarge" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setUiScale(opt.value as UiScale)
                            }
                            className="px-3 py-1.5 text-xs font-body rounded-lg cursor-pointer transition-colors"
                            style={{
                              background:
                                uiScale === opt.value
                                  ? "var(--color-accent)"
                                  : "var(--color-surface-alt)",
                              color:
                                uiScale === opt.value
                                  ? "#fff"
                                  : "var(--color-text-muted)",
                            }}
                            data-testid={`ui-scale-btn-${opt.value}`}
                          >
                            {t(opt.key)}
                          </button>
                        ))}
                      </div>
                    </div>
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
                          {muted
                            ? t("settings.muted")
                            : Math.round(playbackVolume * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={muted ? 0 : Math.round(playbackVolume * 100)}
                        onChange={(e) => {
                          const normalized = Number(e.target.value) / 100;
                          setPlaybackVolume(normalized);
                          setSettingsVolume(Number(e.target.value));
                        }}
                        className="w-full"
                        disabled={muted}
                        data-testid="volume-slider"
                      />
                    </div>
                    <ToggleRow
                      label={t("settings.muteAudio")}
                      checked={muted}
                      onChange={(newMuted) => {
                        setSettingsMuted(newMuted);
                        if (newMuted) {
                          // Save current volume before muting
                          preMuteVolumeRef.current =
                            playbackVolume > 0
                              ? playbackVolume
                              : preMuteVolumeRef.current;
                          setPlaybackVolume(0);
                        } else {
                          // Restore volume on unmute
                          setPlaybackVolume(preMuteVolumeRef.current);
                        }
                      }}
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

/** Toggle switch row with label and optional description. */
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
    <div
      role="group"
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
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
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="w-10 h-[22px] rounded-full relative transition-colors shrink-0 cursor-pointer"
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
    </div>
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
