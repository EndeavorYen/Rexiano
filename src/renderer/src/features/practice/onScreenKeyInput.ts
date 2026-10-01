import type { KeyPointerHandlers } from "../fallingNotes/keyPointerTracker";

interface OnScreenKeyInputDeps {
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  /** The chord Wait mode is waiting for, or null when it is not waiting */
  waitTargets: () => ReadonlySet<number> | null;
}

export interface OnScreenKeyInput extends KeyPointerHandlers {
  /** Release latched notes that are no longer part of the waited chord */
  releaseStale: () => void;
}

/**
 * Wait mode needs every note of a chord held at once, and a mouse can hold
 * only one key. While Wait is waiting on a chord, lifting a key that belongs
 * to it keeps the note down until the chord is complete (#305). A real MIDI
 * keyboard does not go through here, so its chords still have to be played
 * together.
 */
export function createOnScreenKeyInput(
  deps: OnScreenKeyInputDeps,
): OnScreenKeyInput {
  const latched = new Set<number>();

  const releaseStale = (): void => {
    const targets = deps.waitTargets();
    for (const midi of [...latched]) {
      if (targets?.has(midi)) continue;
      latched.delete(midi);
      deps.noteOff(midi);
    }
  };

  return {
    noteOn(midi) {
      deps.noteOn(midi);
      releaseStale();
    },
    noteOff(midi) {
      const targets = deps.waitTargets();
      if (targets && targets.size > 1 && targets.has(midi)) {
        latched.add(midi);
        return;
      }
      deps.noteOff(midi);
      releaseStale();
    },
    releaseStale,
  };
}
