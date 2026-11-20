import { useEffect, useState } from "react";
import { Piano } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { shouldShowWaitInputHint } from "./waitInputHintVisibility";
import "./play-feedback.css";

interface WaitInputHintProps {
  /** Opens the playback drawer, which holds the MIDI connection controls */
  onConnectKeyboard: () => void;
}

/**
 * Tells a child what to do when Wait mode has no keyboard to listen to. A thin
 * strip between the stage and the controls, never over the falling notes.
 */
export function WaitInputHint({
  onConnectKeyboard,
}: WaitInputHintProps): React.JSX.Element {
  const { t } = useTranslation();
  const mode = usePracticeStore((s) => s.mode);
  const isConnected = useMidiDeviceStore((s) => s.isConnected);
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);
  // Once the child plays an on-screen key the hint has done its job; keep it
  // from covering the falling notes for the rest of the session.
  const [played, setPlayed] = useState(false);
  useEffect(
    () =>
      useMidiDeviceStore.subscribe((state) => {
        // Only a note played while the hint is showing came from the
        // on-screen keys; real keyboard notes must not retire it.
        if (
          state.activeNotes.size > 0 &&
          shouldShowWaitInputHint({
            mode: usePracticeStore.getState().mode,
            isConnected: state.isConnected,
            bleStatus: state.bleStatus,
          })
        ) {
          setPlayed(true);
        }
      }),
    [],
  );

  const visible =
    !played && shouldShowWaitInputHint({ mode, isConnected, bleStatus });

  // The live region stays mounted so screen readers announce the hint when
  // it appears; only its content comes and goes.
  return (
    <div role="status" aria-live="polite">
      {visible && (
        <div
          data-testid="wait-input-hint"
          className="play-hint-bar animate-page-enter"
        >
          <Piano size={20} aria-hidden="true" className="play-hint-icon" />
          <p className="play-hint-text">
            <strong>{t("practice.waitInputHintTitle")}</strong>
            <span>{t("practice.waitInputHintBody")}</span>
          </p>
          <button
            type="button"
            onClick={onConnectKeyboard}
            className="btn-surface-themed play-hint-connect"
          >
            {t("practice.waitInputHintConnect")}
          </button>
        </div>
      )}
    </div>
  );
}
