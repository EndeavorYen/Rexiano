import { Piano } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { shouldShowWaitInputHint } from "./waitInputHintVisibility";

interface WaitInputHintProps {
  /** Opens the playback drawer, which holds the MIDI connection controls */
  onConnectKeyboard: () => void;
}

/** Tells a child what to do when Wait mode has no keyboard to listen to. */
export function WaitInputHint({
  onConnectKeyboard,
}: WaitInputHintProps): React.JSX.Element {
  const { t } = useTranslation();
  const mode = usePracticeStore((s) => s.mode);
  const isConnected = useMidiDeviceStore((s) => s.isConnected);
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);

  const visible = shouldShowWaitInputHint({ mode, isConnected, bleStatus });

  // The live region stays mounted so screen readers announce the hint when
  // it appears; only its content comes and goes.
  return (
    <div role="status" aria-live="polite">
      {visible && (
        <div
          data-testid="wait-input-hint"
          className="absolute left-1/2 top-3 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-2.5 subtle-shadow animate-page-enter"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <Piano
            size={22}
            aria-hidden="true"
            style={{ color: "var(--color-accent)", flexShrink: 0 }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {t("practice.waitInputHintTitle")}
            </p>
            <p
              className="text-xs leading-snug"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("practice.waitInputHintBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={onConnectKeyboard}
            className="btn-surface-themed shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            {t("practice.waitInputHintConnect")}
          </button>
        </div>
      )}
    </div>
  );
}
