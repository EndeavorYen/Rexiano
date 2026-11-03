import type { KeyPointerHandlers } from "../fallingNotes/keyPointerTracker";

interface OnScreenKeyInputDeps {
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  /** The chord Wait mode is waiting for, or null when it is not waiting */
  waitTargets: () => ReadonlySet<number> | null;
  /**
   * False while a real keyboard is connected. On-screen and MIDI notes share
   * one held-note set, so letting both drive it would release notes that are
   * still physically held.
   */
  enabled: () => boolean;
}

export interface OnScreenKeyInput extends KeyPointerHandlers {
  /** Release latched notes that are no longer part of the waited chord */
  releaseStale: () => void;
}

/**
 * Wait mode needs every note of a chord held at once, and a mouse can hold
 * only one key. While Wait is waiting on a chord, lifting a key that belongs
 * to it keeps the note down until the chord is complete (#305).
 */
export function createOnScreenKeyInput(
  deps: OnScreenKeyInputDeps,
): OnScreenKeyInput {
  /** Notes this input turned on and has not turned off yet */
  const sounding = new Set<number>();
  /** Subset of `sounding` whose key was lifted but is held for a chord */
  const latched = new Set<number>();

  const release = (midi: number): void => {
    latched.delete(midi);
    sounding.delete(midi);
    deps.noteOff(midi);
  };

  const releaseStale = (): void => {
    if (!deps.enabled()) {
      // A keyboard took over: drop every note this input still holds.
      for (const midi of [...sounding]) release(midi);
      return;
    }
    const targets = deps.waitTargets();
    for (const midi of [...latched]) {
      if (!targets?.has(midi)) release(midi);
    }
  };

  return {
    noteOn(midi) {
      if (!deps.enabled()) return;
      sounding.add(midi);
      deps.noteOn(midi);
      releaseStale();
    },
    noteOff(midi) {
      if (!sounding.has(midi) || latched.has(midi)) return;
      const targets = deps.enabled() ? deps.waitTargets() : null;
      if (targets && targets.size > 1 && targets.has(midi)) {
        latched.add(midi);
        return;
      }
      release(midi);
      releaseStale();
    },
    releaseStale,
  };
}
