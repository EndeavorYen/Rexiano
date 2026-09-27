import { X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { DeviceSelector } from "@renderer/features/midiDevice/DeviceSelector";
import { SettingsPanel } from "@renderer/features/settings/SettingsPanel";

export interface PlaybackDrawerProps {
  show: boolean;
  drawerRef: React.RefObject<HTMLElement | null>;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export function PlaybackDrawer({
  show,
  drawerRef,
  closeRef,
  onClose,
}: PlaybackDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!show) return null;

  return (
    <div className="app-overlay-backdrop" onClick={onClose}>
      <aside
        ref={drawerRef}
        className="app-side-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        tabIndex={-1}
        data-testid="playback-settings-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-side-drawer-header">
          <span className="kicker-label">{t("settings.title")}</span>
          <button
            ref={closeRef}
            onClick={onClose}
            className="btn-surface-themed w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
            aria-label={t("settings.close")}
          >
            <X size={14} />
          </button>
        </div>
        <div className="app-side-drawer-body">
          <section className="app-side-section">
            <DeviceSelector onBeforeBluetoothConnect={onClose} />
          </section>
          <section className="app-side-section">
            <SettingsPanel />
          </section>
        </div>
      </aside>
    </div>
  );
}
