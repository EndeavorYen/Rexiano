import { useState, useRef, useEffect, useCallback } from "react";
import { X, Settings, Palette, Volume2, Music, Globe } from "lucide-react";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useMuteController } from "@renderer/hooks/useMuteController";
import type { Language, UiScale } from "@renderer/stores/useSettingsStore";
import type { TranslationKey } from "@renderer/i18n/types";
import { themes, type ThemeId } from "@renderer/themes/tokens";
import { getAvailableLanguages } from "@renderer/i18n";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { PracticeMode } from "@shared/types";

const themeList: ThemeId[] = ["lavender", "ocean", "peach", "midnight"];
const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const uiScaleOptions: { value: UiScale; key: TranslationKey }[] = [
  { value: "normal", key: "settings.uiScale.normal" },
  { value: "large", key: "settings.uiScale.large" },
  { value: "xlarge", key: "settings.uiScale.xlarge" },
];

type SettingsTab = "appearance" | "sound" | "practice";

const tabs: { id: SettingsTab; key: TranslationKey; icon: React.ReactNode }[] =
  [
    {
      id: "appearance",
      key: "settings.tab.appearance",
      icon: <Palette size={14} />,
    },
    { id: "sound", key: "settings.tab.sound", icon: <Volume2 size={14} /> },
    { id: "practice", key: "settings.tab.practice", icon: <Music size={14} /> },
  ];

const practiceModeKeys: {
  value: PracticeMode;
  key: "practice.watch" | "practice.wait" | "practice.free" | "practice.step";
}[] = [
  { value: "watch", key: "practice.watch" },
  { value: "wait", key: "practice.wait" },
  { value: "free", key: "practice.free" },
  { value: "step", key: "practice.step" },
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

interface SettingsPanelProps {
  inline?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({
  inline = false,
  onClose,
}: SettingsPanelProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(inline);
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentThemeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const showFingering = useSettingsStore((s) => s.showFingering);
  const compactKeyLabels = useSettingsStore((s) => s.compactKeyLabels);
  const language = useSettingsStore((s) => s.language);
  const muted = useSettingsStore((s) => s.muted);
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const playbackVolume = usePlaybackStore((s) => s.volume);

  const { setMuted: muteControllerSetMuted } = useMuteController();

  const setShowNoteLabels = useSettingsStore((s) => s.setShowNoteLabels);
  const setShowFallingNoteLabels = useSettingsStore(
    (s) => s.setShowFallingNoteLabels,
  );
  const setShowFingering = useSettingsStore((s) => s.setShowFingering);
  const setCompactKeyLabels = useSettingsStore((s) => s.setCompactKeyLabels);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setSettingsVolume = useSettingsStore((s) => s.setVolume);
  const setPlaybackVolume = usePlaybackStore((s) => s.setVolume);
  // R3-01 fix: debounce settings persistence during slider drag.
  // Live audio volume updates instantly; localStorage write fires 200ms after last drag.
  const volumePersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (volumePersistTimer.current) clearTimeout(volumePersistTimer.current);
    },
    [],
  );
  const setDefaultSpeed = useSettingsStore((s) => s.setDefaultSpeed);
  const setDefaultMode = useSettingsStore((s) => s.setDefaultMode);
  const kidMode = useSettingsStore((s) => s.kidMode);
  const setKidMode = useSettingsStore((s) => s.setKidMode);
  const setUiScale = useSettingsStore((s) => s.setUiScale);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const handleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent): void => {
      const target = e.target as Node;
      // Exclude clicks on the trigger button to prevent close+reopen flicker
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        handleClose();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open, handleClose]);

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
      } else if (!e.shiftKey && active === last) {
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

  return (
    <>
      {!inline && (
        <button
          ref={triggerRef}
          onClick={handleOpen}
          className="btn-surface-themed flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer"
          style={{ border: "1px solid var(--color-border)" }}
          title={t("settings.title")}
          data-testid="settings-trigger"
        >
          <Settings size={16} style={{ color: "var(--color-text-muted)" }} />
          <span
            className="text-xs font-body font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("app.openSettings")}
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic">
          <div
            ref={panelRef}
            className="w-[92vw] min-w-[280px] max-w-[560px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl modal-card-cinematic overflow-hidden"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 90%, transparent)",
              border: "1px solid var(--color-border)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            data-testid="settings-panel"
            tabIndex={-1}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2
                id="settings-dialog-title"
                className="text-base font-display font-bold"
                style={{ color: "var(--color-text)" }}
              >
                {t("settings.title")}
              </h2>
              <button
                onClick={handleClose}
                className="btn-surface-themed w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                title={t("settings.close")}
                aria-label={t("settings.close")}
                data-testid="settings-close"
              >
                <X size={14} style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>

            <div
              className="flex shrink-0 px-2 pt-2 gap-1 overflow-x-auto"
              role="tablist"
              aria-label={t("settings.title")}
              style={{
                borderBottom: "1px solid var(--color-border)",
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 30%, var(--color-surface))",
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-body font-medium rounded-t-lg cursor-pointer transition-colors relative whitespace-nowrap"
                  style={{
                    color:
                      activeTab === tab.id
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)",
                    background:
                      activeTab === tab.id
                        ? "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface))"
                        : "transparent",
                  }}
                  data-testid={`settings-tab-${tab.id}`}
                >
                  {tab.icon}
                  {t(tab.key)}
                  {activeTab === tab.id && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ background: "var(--color-accent)" }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div
              className="flex-1 overflow-y-auto px-5 py-4"
              style={{ minHeight: 340 }}
            >
              {activeTab === "appearance" && (
                <TabContent>
                  <SectionTitle>{t("settings.chooseTheme")}</SectionTitle>
                  <div className="flex gap-4 mt-3 flex-wrap">
                    {themeList.map((id) => {
                      const isActive = currentThemeId === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setTheme(id)}
                          aria-label={themes[id].label}
                          aria-pressed={isActive}
                          className="flex flex-col items-center gap-2 cursor-pointer"
                        >
                          <div
                            className="w-12 h-12 rounded-full border-2"
                            style={{
                              borderColor: isActive
                                ? "var(--color-accent)"
                                : "var(--color-border)",
                              background: themes[id].colors.bg,
                            }}
                          />
                          <span
                            className="text-xs font-body"
                            style={{
                              color: isActive
                                ? "var(--color-accent)"
                                : "var(--color-text-muted)",
                            }}
                          >
                            {themes[id].label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    <SectionTitle>{t("settings.displayOptions")}</SectionTitle>
                    <div className="flex flex-col gap-3 mt-3">
                      <ToggleRow
                        label={t("settings.showNoteLabels")}
                        checked={showNoteLabels}
                        onChange={setShowNoteLabels}
                        testId="toggle-note-labels"
                      />
                      <ToggleRow
                        label={t("settings.showFallingLabels")}
                        checked={showFallingNoteLabels}
                        onChange={setShowFallingNoteLabels}
                        testId="toggle-falling-labels"
                      />
                      <ToggleRow
                        label={t("settings.showFingering")}
                        checked={showFingering}
                        onChange={setShowFingering}
                        testId="toggle-fingering"
                      />
                      <ToggleRow
                        label={t("settings.compactKeyLabels")}
                        checked={compactKeyLabels}
                        onChange={setCompactKeyLabels}
                        testId="toggle-compact-labels"
                      />

                      <div>
                        <span
                          className="text-xs font-body block mb-1.5"
                          style={{ color: "var(--color-text)" }}
                        >
                          {t("settings.uiScale")}
                        </span>
                        <div
                          className="flex gap-1.5"
                          role="radiogroup"
                          aria-label={t("settings.uiScale")}
                        >
                          {uiScaleOptions.map((option) => (
                            <button
                              key={option.value}
                              role="radio"
                              aria-checked={uiScale === option.value}
                              onClick={() => setUiScale(option.value)}
                              className="px-2.5 py-1 text-[11px] font-body rounded-lg cursor-pointer transition-colors"
                              style={{
                                background:
                                  uiScale === option.value
                                    ? "var(--color-accent)"
                                    : "var(--color-surface-alt)",
                                color:
                                  uiScale === option.value
                                    ? "#fff"
                                    : "var(--color-text-muted)",
                              }}
                              data-testid={`ui-scale-${option.value}`}
                            >
                              {t(option.key)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <SectionTitle>
                      <span className="inline-flex items-center gap-1.5">
                        <Globe size={12} />
                        {t("settings.language")}
                      </span>
                    </SectionTitle>
                    <div
                      className="flex flex-col gap-2 mt-3"
                      role="radiogroup"
                      aria-label={t("settings.language")}
                    >
                      {getAvailableLanguages().map((lang) => (
                        <button
                          key={lang.code}
                          role="radio"
                          aria-checked={language === lang.code}
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
                        </button>
                      ))}
                    </div>
                  </div>
                </TabContent>
              )}

              {activeTab === "sound" && (
                <TabContent>
                  <SectionTitle>{t("settings.audioSettings")}</SectionTitle>
                  <div className="flex flex-col gap-3 mt-3">
                    <ToggleRow
                      label={t("settings.muteAudio")}
                      checked={muted}
                      onChange={muteControllerSetMuted}
                      testId="toggle-muted"
                    />

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
                          data-testid="settings-volume-label"
                        >
                          {Math.round(playbackVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(playbackVolume * 100)}
                        onChange={(e) => {
                          const next = Number(e.target.value) / 100;
                          // Live audio: instant (no I/O)
                          setPlaybackVolume(next);
                          // R3-01 fix: debounce persist — fire 200ms after last drag
                          if (volumePersistTimer.current)
                            clearTimeout(volumePersistTimer.current);
                          volumePersistTimer.current = setTimeout(() => {
                            setSettingsVolume(Math.round(next * 100));
                          }, 200);
                          // R2-01 fix: mute guard
                          if (next === 0 && !muted)
                            muteControllerSetMuted(true);
                          else if (next > 0 && muted)
                            muteControllerSetMuted(false);
                        }}
                        className="w-full"
                        data-testid="settings-volume-slider"
                        aria-label={t("settings.volume")}
                      />
                    </div>
                  </div>
                </TabContent>
              )}

              {activeTab === "practice" && (
                <TabContent>
                  <div className="mb-4">
                    <ToggleRow
                      label={t("settings.kidMode")}
                      description={t("settings.kidModeDesc")}
                      checked={kidMode}
                      onChange={setKidMode}
                      testId="toggle-kid-mode"
                      highlight={kidMode}
                    />
                  </div>

                  <SectionTitle>{t("settings.practiceDefaults")}</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    <div>
                      <span
                        className="text-xs font-body block mb-1.5"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("settings.defaultMode")}
                      </span>
                      <div
                        className="flex gap-1.5"
                        role="radiogroup"
                        aria-label={t("settings.defaultMode")}
                      >
                        {practiceModeKeys.map((m) => (
                          <button
                            key={m.value}
                            role="radio"
                            aria-checked={defaultMode === m.value}
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

                    <div>
                      <span
                        className="text-xs font-body block mb-1.5"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("settings.defaultSpeed")}
                      </span>
                      <div
                        className="flex gap-1 flex-wrap"
                        role="radiogroup"
                        aria-label={t("settings.defaultSpeed")}
                      >
                        {speedPresets.map((s) => (
                          <button
                            key={s}
                            role="radio"
                            aria-checked={defaultSpeed === s}
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
  highlight,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
  highlight?: boolean;
}): React.JSX.Element {
  return (
    <div
      role="group"
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: highlight
          ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface-alt) 52%, var(--color-surface))",
        border: highlight
          ? "1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))"
          : "1px solid var(--color-border)",
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className="text-xs font-body"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </span>
        {description && (
          <span
            className="text-[10px] font-body"
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
        className="w-12 h-7 rounded-full relative transition-colors shrink-0 cursor-pointer"
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
          className="absolute top-[3px] w-5 h-5 rounded-full transition-all duration-150 subtle-shadow"
          style={{
            background: checked ? "var(--color-bg)" : "var(--color-text-muted)",
            left: checked ? "calc(100% - 24px)" : "3px",
          }}
        />
      </button>
    </div>
  );
}
