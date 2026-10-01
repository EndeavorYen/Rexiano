/**
 * Turns pointer presses on the on-screen keyboard into note-on / note-off
 * calls, so a child without a MIDI keyboard can still play Wait mode (#305).
 * Each pointer (mouse or finger) holds at most one key; a key held by two
 * fingers is released only when the last one lifts.
 */
export interface KeyPointerHandlers {
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
}

export interface KeyPointerTracker {
  down: (pointerId: number, midi: number) => void;
  up: (pointerId: number) => void;
  releaseAll: () => void;
}

export function createKeyPointerTracker(
  handlers: KeyPointerHandlers,
): KeyPointerTracker {
  const heldByPointer = new Map<number, number>();

  const holders = (midi: number): number => {
    let count = 0;
    for (const held of heldByPointer.values()) if (held === midi) count++;
    return count;
  };

  const release = (pointerId: number): void => {
    const midi = heldByPointer.get(pointerId);
    if (midi === undefined) return;
    heldByPointer.delete(pointerId);
    if (holders(midi) === 0) handlers.noteOff(midi);
  };

  return {
    down(pointerId, midi) {
      if (heldByPointer.get(pointerId) === midi) return;
      release(pointerId);
      const alreadyDown = holders(midi) > 0;
      heldByPointer.set(pointerId, midi);
      if (!alreadyDown) handlers.noteOn(midi);
    },
    up: release,
    releaseAll() {
      for (const pointerId of [...heldByPointer.keys()]) release(pointerId);
    },
  };
}
