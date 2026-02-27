import { useState, useRef, useEffect, useCallback } from "react";
import { X, Settings } from "lucide-react";
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

/**
 * Full settings modal. Replaces the old ThemePicker popover with a richer
 * panel covering Display, Audio, Practice, and Theme configuration.
 */
export function SettingsPanel(): React.JSX.Element {
  const [open, setOpen] = useState(false);
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
            className="w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl animate-page-enter"
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
              className="flex items-center justify-between px-5 py-4"
              style={{
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <h2 className="text-base font-display font-bold">Settings</h2>
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

            <div className="px-5 py-4 flex flex-col gap-6">
              {/* ─── Theme section ─── */}
              <section>
                <SectionTitle>Theme</SectionTitle>
                <div className="flex gap-3 mt-2">
                  {themeList.map((id) => (
                    <button
                      key={id}
                      onClick={() => setTheme(id)}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group"
                      title={themes[id].label}
                      data-testid={`theme-dot-${id}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full transition-transform group-hover:scale-110"
                        style={{
                          background: themes[id].dot,
                          boxShadow:
                            id === currentThemeId
                              ? `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent)`
                              : "none",
                        }}
                      >
                        {id === currentThemeId && (
                          <svg
                            className="m-auto mt-[10px]"
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
                        className="text-[10px] font-body"
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
              </section>

              {/* ─── Display section ─── */}
              <section>
                <SectionTitle>Display</SectionTitle>
                <div className="flex flex-col gap-3 mt-2">
                  <ToggleRow
                    label="Show note labels on keyboard"
                    checked={showNoteLabels}
                    onChange={setShowNoteLabels}
                    testId="toggle-note-labels"
                  />
                  <ToggleRow
                    label="Show labels on falling notes"
                    checked={showFallingNoteLabels}
                    onChange={setShowFallingNoteLabels}
                    testId="toggle-falling-labels"
                  />
                </div>
              </section>

              {/* ─── Audio section ─── */}
              <section>
                <SectionTitle>Audio</SectionTitle>
                <div className="flex flex-col gap-3 mt-2">
                  {/* Volume slider */}
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-body w-16 shrink-0"
                      style={{ color: "var(--color-text)" }}
                    >
                      Volume
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={muted ? 0 : volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="flex-1"
                      disabled={muted}
                      data-testid="volume-slider"
                    />
                    <span
                      className="text-xs font-mono w-8 text-right tabular-nums"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {muted ? "0" : volume}
                    </span>
                  </div>
                  <ToggleRow
                    label="Mute audio"
                    checked={muted}
                    onChange={setMuted}
                    testId="toggle-mute"
                  />
                </div>
              </section>

              {/* ─── Practice section ─── */}
              <section>
                <SectionTitle>Practice Defaults</SectionTitle>
                <div className="flex flex-col gap-3 mt-2">
                  {/* Default mode */}
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-body w-16 shrink-0"
                      style={{ color: "var(--color-text)" }}
                    >
                      Mode
                    </span>
                    <div className="flex gap-1.5">
                      {practiceModes.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => setDefaultMode(m.value)}
                          className="px-3 py-1 text-xs font-body rounded-md cursor-pointer transition-colors"
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
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-body w-16 shrink-0"
                      style={{ color: "var(--color-text)" }}
                    >
                      Speed
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {speedPresets.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDefaultSpeed(s)}
                          className="px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-colors"
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
                    checked={metronomeEnabled}
                    onChange={setMetronomeEnabled}
                    testId="toggle-metronome"
                  />

                  {/* Count-in beats */}
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-body w-16 shrink-0"
                      style={{ color: "var(--color-text)" }}
                    >
                      Count-in
                    </span>
                    <div className="flex gap-1">
                      {[0, 2, 4, 8].map((n) => (
                        <button
                          key={n}
                          onClick={() => setCountInBeats(n)}
                          className="px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-colors"
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
                </div>
              </section>

              {/* ─── Keyboard shortcuts ─── */}
              <section>
                <SectionTitle>Keyboard Shortcuts</SectionTitle>
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-xs font-body"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <ShortcutRow keys="Space" action="Play / Pause" />
                  <ShortcutRow keys="R" action="Restart" />
                  <ShortcutRow keys="[ / ]" action="Speed down / up" />
                  <ShortcutRow keys="A" action="Set loop A point" />
                  <ShortcutRow keys="B" action="Set loop B point" />
                  <ShortcutRow keys="Esc" action="Close settings" />
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Sub-components ─── */

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
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span
        className="text-xs font-body"
        style={{ color: "var(--color-text)" }}
      >
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-9 h-5 rounded-full relative transition-colors"
        style={{
          background: checked
            ? "var(--color-accent)"
            : "var(--color-surface-alt)",
        }}
        data-testid={testId}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{
            background: checked ? "#fff" : "var(--color-text-muted)",
            left: checked ? "calc(100% - 18px)" : "2px",
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
    <>
      <span
        className="font-mono text-[11px]"
        style={{ color: "var(--color-text)" }}
      >
        {keys}
      </span>
      <span>{action}</span>
    </>
  );
}
