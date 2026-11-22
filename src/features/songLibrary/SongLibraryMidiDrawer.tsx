import { useRef, useCallback, type RefObject } from "react";
import { Piano, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import { getBluetoothConnectedLabel } from "../midiDevice/bluetoothDeviceDisplay";

export interface SongLibraryPianoButtonProps {
  onClick: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The piano entry in the top bar: a square icon button with a status dot
 * (green when a piano is connected). It used to float over the covers.
 */
export function SongLibraryPianoButton({
  onClick,
  buttonRef,
}: SongLibraryPianoButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);
  const bleDeviceName = useMidiDeviceStore((s) => s.bleDeviceName);
  const connected = getBluetoothConnectedLabel(
    bleStatus === "connected",
    bleDeviceName,
    t("midi.bleConnectedDevice"),
  );
  const label = connected
    ? t("piano.connectedTo", { name: connected })
    : t("piano.title");

  return (
    <button
      ref={buttonRef}
      type="button"
      className="icon-btn songbook-piano"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid="library-device-drawer-trigger"
      data-connected={connected ? "true" : "false"}
    >
      <Piano size={20} aria-hidden="true" />
      <span className="status-dot" aria-hidden="true" />
    </button>
  );
}

export interface SongLibraryMidiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function SongLibraryMidiDrawer({
  isOpen,
  onClose,
  returnFocusRef,
}: SongLibraryMidiDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useDialogFocus({
    active: isOpen,
    containerRef: drawerRef,
    initialFocusRef: closeRef,
    returnFocusRef,
    onDismiss: close,
  });

  if (!isOpen) return null;

  return (
    <div className="app-overlay-backdrop" onClick={close}>
      <aside
        ref={drawerRef}
        className="app-side-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("piano.title")}
        tabIndex={-1}
        data-testid="library-midi-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-side-drawer-header">
          <h2 className="m-0 font-display text-xl font-extrabold">
            {t("piano.title")}
          </h2>
          <button
            ref={closeRef}
            onClick={close}
            className="icon-btn"
            aria-label={t("settings.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="app-side-drawer-body">
          <DeviceSelector />
        </div>
      </aside>
    </div>
  );
}
