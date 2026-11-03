import { useState, useCallback, useRef, useEffect } from "react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";

export const WRONG_NOTE_DISPLAY_DURATION_MS = 420;

export function addNoteToSet(notes: Set<number>, midi: number): Set<number> {
  const next = new Set(notes);
  next.add(midi);
  return next;
}

export function removeNoteFromSet(
  notes: Set<number>,
  midi: number,
): Set<number> {
  const next = new Set(notes);
  next.delete(midi);
  return next;
}

export interface UsePracticeNotesResult {
  activeNotes: Set<number>;
  midiActiveNotes: Set<number>;
  wrongNotes: Set<number>;
  splitFocusPanel: "sheet" | "falling";
  setSplitFocusPanel: (panel: "sheet" | "falling") => void;
  handleActiveNotesChange: (notes: Set<number>) => void;
  handleWrongPracticeInput: (midi: number) => void;
}

export function usePracticeNotes(): UsePracticeNotesResult {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);
  const [wrongNotes, setWrongNotes] = useState<Set<number>>(new Set());
  const wrongNoteTimersRef = useRef(
    new Map<number, ReturnType<typeof setTimeout>>(),
  );
  const [splitFocusPanel, setSplitFocusPanel] = useState<"sheet" | "falling">(
    "sheet",
  );

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes);
  }, []);

  const handleWrongPracticeInput = useCallback((midi: number): void => {
    const existingTimer = wrongNoteTimersRef.current.get(midi);
    if (existingTimer) clearTimeout(existingTimer);
    setWrongNotes((notes) => addNoteToSet(notes, midi));
    const timer = setTimeout(() => {
      setWrongNotes((notes) => removeNoteFromSet(notes, midi));
      wrongNoteTimersRef.current.delete(midi);
    }, WRONG_NOTE_DISPLAY_DURATION_MS);
    wrongNoteTimersRef.current.set(midi, timer);
  }, []);

  useEffect(() => {
    const timers = wrongNoteTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return {
    activeNotes,
    midiActiveNotes,
    wrongNotes,
    splitFocusPanel,
    setSplitFocusPanel,
    handleActiveNotesChange,
    handleWrongPracticeInput,
  };
}
