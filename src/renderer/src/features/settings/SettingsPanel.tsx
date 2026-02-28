import { useState, useRef, useEffect, useCallback } from "react";
import { X, Settings, Palette, Monitor, Volume2, Music, Keyboard } from "lucide-react";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { themes, type ThemeId } from "@renderer/themes/tokens";
import type { PracticeMode } from "@shared/types";

const themeList: ThemeId[] = ["lavender", "ocean", "peach", "midnight"];

const practiceModes: { value: PracticeMode; label: string }[] = [
  { value: "watch", label: "Watch" },
  { value: "wait", label: "Wait" },
  { value: "free", label: "Free" },
];

const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

type SettingsTab = "theme" | "display" | "audio" | "practice" | "shortcuts";

const tabDefs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "theme", label: "Theme", icon: <Palette size={14} /> },
  { id: "display", label: "Display", icon: <Monitor size={14} /> },
  { id: "audio", label: "Audio", icon: <Volume2 size={14} /> },
  { id: "practice", label: "Practice", icon: <Music size={14} /> },
  { id: "shortcuts", label: "Keys", icon: <Keyboard size={14} /> },
];

/**
 * Full settings modal with tabbed navigation.
 * Covers Theme, Display, Audio, Practice, and Keyboard Shortcuts.
 */
export function SettingsPanel(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("theme");
  const panelRef = useRef<HTMLDivElement>(null);

  // Theme state
  const currentThemeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Settings state
  const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const volume = useSettingsStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const defaultMode = useSettingsStore((s) => s.defaultMode);
  const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);
  const countInBeats = useSettingsStore((s) => s.countInBeats);
  const latencyCompensation = useSettingsStore((s) => s.latencyCompensation);

  const setShowNoteLabels = useSettingsStore((s) => s.setShowNoteLabels);
  const setShowFallingNoteLabels = useSettingsStore(
    (s) => s.setShowFallingNoteLabels,
  );
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const setDefaultSpeed = useSettingsStore((s) => s.setDefaultSpeed);
  const setDefaultMode = useSettingsStore((s) => s.setDefaultMode);
  const setMetronomeEnabled = useSettingsStore((s) => s.setMetronomeEnabled);
  const setCountInBeats = useSettingsStore((s) => s.setCountInBeats);
  const setLatencyCompensation = useSettingsStore(
    (s) => s.setLatencyCompensation,
  );

  // First-visit pulse
  const [isFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem("rexiano-theme-picker-seen");
    } catch {
      return false;
    }
  });

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {/* Trigger button — gear icon */}
      <button
        onClick={handleOpen}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${isFirstVisit ? "animate-gentle-pulse" : ""}`}
        style={{ background: "var(--color-surface-alt)" }}
        title="Settings"
        data-testid="settings-trigger"
      >
        <Settings size={16} style={{ color: "var(--color-text-muted)" }} />
      </button>

      {/* Modal backdrop + panel */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div
            ref={panelRef}
            className="w-[460px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl animate-page-enter overflow-hidden"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
            role="dialog"
            aria-label="Settings"
            data-testid="settings-panel"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <h2 className="text-base font-display font-bold" style={{ color: "var(--color-text)" }}>
                Settings
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                style={{ background: "var(--color-surface-alt)" }}
                title="Close"
                data-testid="settings-close"
              >
                <X size={14} style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>

            {/* Tab bar */}
            <div
              className="flex shrink-0 px-2 pt-2 gap-1"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              {tabDefs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-body font-medium rounded-t-lg cursor-pointer transition-colors relative"
                  style={{
                    color:
                      activeTab === tab.id
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)",
                    background:
                      activeTab === tab.id
                        ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"
                        : "transparent",
                  }}
                  data-testid={`settings-tab-${tab.id}`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ background: "var(--color-accent)" }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {activeTab === "theme" && (
                <TabContent>
                  <SectionTitle>Choose a Theme</SectionTitle>
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
                    Themes change all colors across the app, including the
                    falling notes and keyboard.
                  </p>
                </TabContent>
              )}

              {activeTab === "display" && (
                <TabContent>
                  <SectionTitle>Display Options</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    <ToggleRow
                      label="Show note labels on keyboard"
                      description="Display note names (C, D, E...) on piano keys"
                      checked={showNoteLabels}
                      onChange={setShowNoteLabels}
                      testId="toggle-note-labels"
                    />
                    <ToggleRow
                      label="Show labels on falling notes"
                      description="Display note names on the falling note blocks"
                      checked={showFallingNoteLabels}
                      onChange={setShowFallingNoteLabels}
                      testId="toggle-falling-labels"
                    />
                  </div>
                </TabContent>
              )}

              {activeTab === "audio" && (
                <TabContent>
                  <SectionTitle>Audio Settings</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    {/* Volume slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-xs font-body"
                          style={{ color: "var(--color-text)" }}
                        >
                          Volume
                        </span>
                        <span
                          className="text-xs font-mono tabular-nums"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {muted ? "Muted" : volume}
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
                      label="Mute audio"
                      checked={muted}
                      onChange={setMuted}
                      testId="toggle-mute"
                    />
                  </div>
                </TabContent>
              )}

              {activeTab === "practice" && (
                <TabContent>
                  <SectionTitle>Practice Defaults</SectionTitle>
                  <div className="flex flex-col gap-4 mt-3">
                    {/* Default mode */}
                    <div>
                      <span
                        className="text-xs font-body block mb-1.5"
                        style={{ color: "var(--color-text)" }}
                      >
                        Default Mode
                      </span>
                      <div className="flex gap-1.5">
                        {practiceModes.map((m) => (
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
                            {m.label}
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
                        Default Speed
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
                      label="Metronome"
                      description="Play a click track along with the music"
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
                        Count-in Beats
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
                            {n === 0 ? "Off" : `${n}`}
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
                          Latency Compensation
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
                        aria-label="Latency compensation"
                      />
                      <span
                        className="text-[10px] font-body mt-1 block"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Adjust timing offset for MIDI keyboard input
                      </span>
                    </div>
                  </div>
                </TabContent>
              )}

              {activeTab === "shortcuts" && (
                <TabContent>
                  <SectionTitle>Keyboard Shortcuts</SectionTitle>
                  <div className="flex flex-col gap-2.5 mt-3">
                    <ShortcutRow keys="Space" action="Play / Pause" />
                    <ShortcutRow keys="R" action="Restart" />
                    <ShortcutRow keys="[" action="Speed down" />
                    <ShortcutRow keys="]" action="Speed up" />
                    <ShortcutRow keys="A" action="Set loop A point" />
                    <ShortcutRow keys="B" action="Set loop B point" />
                    <ShortcutRow keys="Esc" action="Close / Back" />
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
    <label className="flex items-center justify-between cursor-pointer gap-3">
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

function ShortcutRow({
  keys,
  action,
}: {
  keys: string;
  action: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
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
