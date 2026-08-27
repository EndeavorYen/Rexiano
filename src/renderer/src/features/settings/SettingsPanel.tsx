import { useState, useRef, useCallback } from "react";
import { X, Settings, Volume2, Globe } from "lucide-react";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";

type SettingsTab = "language" | "audio";

const tabIds: SettingsTab[] = ["language", "audio"];

const tabKeys = ["settings.tab.lang", "settings.tab.audio"] as const;

const tabIcons = [
  <Globe size={14} key="lang" />,
  <Volume2 size={14} key="audio" />,
];

/**
 * Live-path settings: language + volume/mute.
 * Theme, display, backup, updates, and latency stay off this surface.
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("language");
  const panelRef = useRef<HTMLDivElement>(null);

  const volume = useSettingsStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setMuted = useSettingsStore((s) => s.setMuted);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const handleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus({
    active: open,
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef: inline ? undefined : triggerRef,
    onDismiss: handleClose,
  });

  return (
    <>
      {!inline && (
        <button
          ref={triggerRef}
          onClick={handleOpen}
          className="btn-surface-themed w-8 h-8 flex items-center justify-center rounded-full cursor-pointer"
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

            <div
              className="flex shrink-0 px-2 pt-2 gap-1 overflow-x-auto"
              style={{
                borderBottom: "1px solid var(--color-border)",
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 30%, var(--color-surface))",
              }}
            >
              {tabIds.map((id, i) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-body font-medium rounded-t-lg cursor-pointer transition-colors relative whitespace-nowrap"
                  style={{
                    color:
                      activeTab === id
                        ? "var(--color-accent-text)"
                        : "var(--color-text)",
                    background:
                      activeTab === id
                        ? "color-mix(in srgb, var(--color-accent) 9%, var(--color-surface))"
                        : "transparent",
                  }}
                  data-testid={`settings-tab-${id}`}
                >
                  {tabIcons[i]}
                  {t(tabKeys[i])}
                  {activeTab === id && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ background: "var(--color-accent)" }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {activeTab === "language" && (
                <div className="animate-page-enter">
                  <h3
                    className="text-[11px] font-display font-bold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("settings.language")}
                  </h3>
                  <LanguageSwitcher />
                  <p
                    className="text-[10px] font-body mt-3"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("settings.langDesc")}
                  </p>
                </div>
              )}

              {activeTab === "audio" && (
                <div className="animate-page-enter">
                  <h3
                    className="text-[11px] font-display font-bold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("settings.audioSettings")}
                  </h3>
                  <div className="flex flex-col gap-4 mt-3">
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
                    <label
                      className="flex items-center justify-between cursor-pointer gap-3 rounded-xl px-3 py-2.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-surface-alt) 52%, var(--color-surface))",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <span
                        className="text-xs font-body"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t("settings.muteAudio")}
                      </span>
                      <button
                        role="switch"
                        aria-checked={muted}
                        onClick={() => setMuted(!muted)}
                        className="w-10 h-[22px] rounded-full relative transition-colors shrink-0"
                        style={{
                          background: muted
                            ? "var(--color-accent)"
                            : "var(--color-surface-alt)",
                          border: muted
                            ? "1px solid transparent"
                            : "1px solid var(--color-border)",
                        }}
                        data-testid="toggle-mute"
                      >
                        <span
                          className="absolute top-[2px] w-4 h-4 rounded-full transition-all duration-150"
                          style={{
                            background: muted
                              ? "var(--color-on-accent)"
                              : "var(--color-text-muted)",
                            left: muted ? "calc(100% - 19px)" : "2px",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                          }}
                        />
                      </button>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
