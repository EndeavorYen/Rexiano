import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import { PianoQuickConnect } from "../midiDevice/PianoQuickConnect";

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
      <PianoQuickConnect
        variant="pill"
        onOpenDetails={() => setIsOpen(true)}
        testId="library-device-drawer-trigger"
        triggerRef={triggerRef}
      />

      {isOpen && (
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
                <X size={14} />
              </button>
            </div>
            <div className="app-side-drawer-body">
              <DeviceSelector />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
