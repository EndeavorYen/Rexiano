// ─── useMetronomeBeat — Poll MetronomeEngine for visual beat tracking ───
//
// Returns the current beat index, beats per measure, and whether the
// metronome is running. Polls the engine at ~60 Hz (16 ms interval) to
// keep React state in sync without coupling the engine to React directly.

import { useState, useEffect } from "react";
import { getMetronome } from "@renderer/engines/metronome/metronomeManager";

/** Polling interval in milliseconds — 16ms ≈ 1 frame at 60fps for tight visual sync */
const POLL_INTERVAL = 16;

export interface MetronomeBeatState {
  currentBeat: number;
  beatsPerMeasure: number;
  isRunning: boolean;
}

/**
 * Custom hook that polls the MetronomeEngine singleton for the current beat.
 * Returns defaults when the engine is not initialised.
 */
export function useMetronomeBeat(): MetronomeBeatState {
  const [state, setState] = useState<MetronomeBeatState>({
    currentBeat: 0,
    beatsPerMeasure: 4,
    isRunning: false,
  });

  useEffect(() => {
    const id = setInterval(() => {
      const engine = getMetronome();
      if (!engine) {
        setState((prev) =>
          prev.isRunning
            ? { currentBeat: 0, beatsPerMeasure: 4, isRunning: false }
            : prev,
        );
        return;
      }

      const currentBeat = engine.currentBeat;
      const beatsPerMeasure = engine.beatsPerMeasure;
      const isRunning = engine.isRunning;

      setState((prev) => {
        if (
          prev.currentBeat === currentBeat &&
          prev.beatsPerMeasure === beatsPerMeasure &&
          prev.isRunning === isRunning
        ) {
          return prev; // avoid unnecessary re-renders
        }
        return { currentBeat, beatsPerMeasure, isRunning };
      });
    }, POLL_INTERVAL);

    return () => clearInterval(id);
  }, []);

  return state;
}
