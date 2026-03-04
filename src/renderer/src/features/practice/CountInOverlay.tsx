/**
 * Phase 6.5: Count-in overlay — shows "3… 2… 1… Go!" before playback starts.
 * Each beat is timed to the song's BPM so the visual rhythm matches the music.
 * Uses CSS keyframe animations for a bounce-in effect per beat number.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";

export interface CountInOverlayProps {
  visible: boolean;
  bpm: number;
  countInBeats: number;
  onComplete: () => void;
}

/**
 * Inner component that runs the count-in sequence. Mounted only when visible
 * is true, so React handles the reset via mount/unmount lifecycle.
 */
function CountInSequence({
  bpm,
  countInBeats,
  onComplete,
}: Omit<CountInOverlayProps, "visible">): React.JSX.Element {
  const { t } = useTranslation();
  // currentBeat: 1..countInBeats = beat numbers, countInBeats+1 = "Go!"
  const [currentBeat, setCurrentBeat] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Interval = one beat duration in ms, clamped to a sane range
    const intervalMs = Math.max(
      200,
      Math.min(2000, (60 / Math.max(1, bpm)) * 1000),
    );
    let beat = 1;

    timerRef.current = setInterval(() => {
      beat += 1;
      if (beat > countInBeats + 1) {
        // Past the "Go!" beat — finish
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        onCompleteRef.current();
      } else {
        setCurrentBeat(beat);
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [bpm, countInBeats]);

  const isGo = currentBeat > countInBeats;
  // For beat N out of countInBeats, display (countInBeats - N + 1) so it counts down
  const displayNumber = countInBeats - currentBeat + 1;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center pointer-events-none"
      data-testid="count-in-overlay"
      aria-live="assertive"
      role="status"
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0, 0, 0, 0.35)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Beat number or "Go!" */}
      <span
        key={currentBeat}
        className="relative font-mono font-bold select-none count-in-beat"
        data-testid="count-in-beat"
        style={{
          fontSize: isGo ? "6rem" : "8rem",
          color: isGo ? "var(--color-accent)" : "var(--color-text)",
          textShadow: "0 4px 24px rgba(0,0,0,0.4)",
          animation:
            "count-in-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {isGo ? t("countIn.go") : displayNumber}
      </span>

      {/* Inline keyframes — scoped to this component */}
      <style>{`
        @keyframes count-in-bounce {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Full-screen count-in overlay. Shows descending beat numbers (e.g. 3, 2, 1)
 * followed by a translated "Go!" label, then calls `onComplete`.
 *
 * When `visible` is false the inner sequence is unmounted, which naturally
 * resets all state without calling setState inside an effect.
 */
export function CountInOverlay({
  visible,
  bpm,
  countInBeats,
  onComplete,
}: CountInOverlayProps): React.JSX.Element {
  if (!visible) return <></>;
  return (
    <CountInSequence
      bpm={bpm}
      countInBeats={countInBeats}
      onComplete={onComplete}
    />
  );
}
