import { useState, useRef, useCallback } from "react";
import { PanelRightOpen, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { DeviceSelector } from "../midiDevice/DeviceSelector";

export function SongLibraryMidiDrawer(): React.JSX.Element {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useDialogFocus({
    active: isOpen,
    containerRef: drawerRef,
    initialFocusRef: closeRef,
    returnFocusRef: triggerRef,
    onDismiss: close,
  });

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        className="fixed right-5 bottom-5 z-30 btn-surface-themed rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-body cursor-pointer subtle-shadow"
        data-testid="library-device-drawer-trigger"
      >
        <PanelRightOpen size={14} />
        MIDI
      </button>

      {isOpen && (
        <div className="app-overlay-backdrop" onClick={close}>
          <aside
            ref={drawerRef}
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
                ref={closeRef}
                onClick={close}
                className="btn-surface-themed w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                aria-label={t("settings.close")}
              >
                <X size={14} />
              </button>
            </div>
            <div className="app-side-drawer-body">
              <section className="app-side-section">
                <DeviceSelector onBeforeBluetoothConnect={close} />
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
