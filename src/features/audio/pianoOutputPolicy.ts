// What sounds where when a piano is connected.
//
//   Sound source "piano" + a piano connected → the song plays on the piano
//   and the computer stays silent. Otherwise the computer plays as before.
//
//   Watch: the piano plays every (unmuted) track.
//   Wait:  the piano plays only what the learner is NOT practising; the
//          learner's own hand comes from their fingers.
//   Free:  the piano plays nothing.
//
// The learner's key presses are never sent back to the piano: the piano
// already sounds them, so echoing would double every note.

import type { PracticeMode } from "@shared/types";

export type SoundSource = "computer" | "piano";

export interface PianoOutputInputs {
  soundSource: SoundSource;
  hasPiano: boolean;
  mode: PracticeMode;
  /** Tracks the learner is practising (Wait mode targets). */
  activeTracks: ReadonlySet<number>;
  trackCount: number;
}

export interface PianoOutputPlan {
  /** The piano receives the song and the computer is silent. */
  pianoIsSource: boolean;
  /** Tracks never sent to the piano. */
  excludedTracks: Set<number>;
}

export function planPianoOutput(input: PianoOutputInputs): PianoOutputPlan {
  const pianoIsSource = input.soundSource === "piano" && input.hasPiano;
  const allTracks = new Set(
    Array.from({ length: Math.max(0, input.trackCount) }, (_, i) => i),
  );

  if (!pianoIsSource) return { pianoIsSource, excludedTracks: allTracks };

  switch (input.mode) {
    case "watch":
      return { pianoIsSource, excludedTracks: new Set() };
    case "wait": {
      // No explicit practice tracks means the learner plays everything.
      const excluded =
        input.activeTracks.size === 0
          ? allTracks
          : new Set([...input.activeTracks].filter((t) => allTracks.has(t)));
      return { pianoIsSource, excludedTracks: excluded };
    }
    default:
      return { pianoIsSource, excludedTracks: allTracks };
  }
}
