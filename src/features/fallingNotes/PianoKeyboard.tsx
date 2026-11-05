import { useEffect, useMemo, useState } from "react";
import {
  createKeyPointerTracker,
  type KeyPointerHandlers,
} from "./keyPointerTracker";
import {
  FULL_KEY_RANGE,
  type KeyRange,
} from "@renderer/engines/fallingNotes/keyPositions";

/** MIDI range for a standard 88-key piano: A0 (21) to C8 (108) */
const FIRST_NOTE = 21;
const LAST_NOTE = 108;

/** For each chromatic note (0-11), whether it is a black key. */
const IS_BLACK_NOTE = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];

/** White key note names indexed by noteInOctave (only for non-black keys). */
const WHITE_NOTE_NAMES = ["C", "D", "E", "F", "G", "A", "B"] as const;
/** Black key sharp names indexed by noteInOctave (only for black keys). */
const BLACK_NOTE_NAMES: Record<number, string> = {
  1: "C#",
  3: "D#",
  6: "F#",
  8: "G#",
  10: "A#",
};

/**
 * Get the display label for a white key MIDI note.
 * C keys include the octave number (e.g. "C4"), others show just the letter.
 */
function getWhiteKeyLabel(midi: number): string {
  const noteInOctave = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  // Map noteInOctave to white key index: C=0, D=1, E=2, F=3, G=4, A=5, B=6
  const whiteIndex = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6][noteInOctave];
  const name = WHITE_NOTE_NAMES[whiteIndex];
  // Only C keys show octave number
  return noteInOctave === 0 ? `${name}${octave}` : name;
}

function getCompactWhiteKeyLabel(midi: number): string {
  const noteInOctave = midi % 12;
  if (noteInOctave !== 0) return "";
  return getWhiteKeyLabel(midi);
}

/**
 * Get the display label for a black key MIDI note (e.g. "C#", "D#").
 */
function getBlackKeyLabel(midi: number): string {
  const noteInOctave = midi % 12;
  return BLACK_NOTE_NAMES[noteInOctave] ?? "";
}

/** Black key width as a fraction of white key width (a real piano: ~0.6) */
const BLACK_KEY_WIDTH_RATIO = 0.6;
/** Black key length as a fraction of the white key length (real: ~0.63) */
const BLACK_KEY_HEIGHT_RATIO = 0.63;
/** Gap between neighbouring white keys, in px. */
const WHITE_KEY_GAP = 2;

interface WhiteKeyInfo {
  midi: number;
  index: number;
}

interface BlackKeyInfo {
  midi: number;
  leftWhiteIndex: number;
}

interface Layout {
  whiteKeys: WhiteKeyInfo[];
  blackKeys: BlackKeyInfo[];
  whiteKeyCount: number;
}

function buildLayout(range: KeyRange): Layout {
  const whiteKeys: WhiteKeyInfo[] = [];
  const blackKeys: BlackKeyInfo[] = [];
  let whiteIndex = 0;

  for (let midi = range.first; midi <= range.last; midi++) {
    const noteInOctave = midi % 12;
    if (IS_BLACK_NOTE[noteInOctave]) {
      blackKeys.push({ midi, leftWhiteIndex: whiteIndex - 1 });
    } else {
      whiteKeys.push({ midi, index: whiteIndex });
      whiteIndex++;
    }
  }

  return { whiteKeys, blackKeys, whiteKeyCount: whiteIndex };
}

interface PianoKeyboardProps {
  /** Notes highlighted by the falling notes hit line */
  activeNotes?: Set<number>;
  /** Notes highlighted by live MIDI input */
  midiActiveNotes?: Set<number>;
  /** Notes the player hit correctly (practice mode) */
  hitNotes?: Set<number>;
  /** Notes the player missed (practice mode) */
  missedNotes?: Set<number>;
  height?: number;
  /** Whether to show note name labels on keys (default: true) */
  showLabels?: boolean;
  /** Show simplified key names to reduce crowding on narrow layouts */
  compactLabels?: boolean;
  /** Keys to show; must match the falling-notes renderer's range */
  range?: KeyRange;
  /** When set, pressing a key with mouse or touch plays it like a MIDI key */
  onKeyPress?: KeyPointerHandlers;
}

function midiFromPointerTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const key = target.closest<HTMLElement>("[data-midi]");
  const midi = Number(key?.dataset.midi);
  return Number.isInteger(midi) ? midi : null;
}

/** Returns the CSS animation class for practice mode hit/miss feedback. */
function getPracticeClass(
  midi: number,
  hitNotes?: Set<number>,
  missedNotes?: Set<number>,
): string {
  if (hitNotes?.has(midi)) return "practice-key-hit";
  if (missedNotes?.has(midi)) return "practice-key-miss";
  return "";
}

/** MIDI input highlight — a distinct warm cyan to contrast the theme accent */
const MIDI_HIGHLIGHT = "#38bdf8";

// Keys are drawn like an instrument: a shadow under the fallboard at the top,
// a slightly lighter front lip on white keys, and a bevelled front face on
// black keys. Pressed keys sink and glow.

function getWhiteKeyBackground(
  songActive: boolean,
  midiActive: boolean,
): string {
  if (midiActive) {
    return `linear-gradient(to bottom, color-mix(in srgb, ${MIDI_HIGHLIGHT} 70%, #fff), ${MIDI_HIGHLIGHT})`;
  }
  if (songActive) {
    return "linear-gradient(to bottom, color-mix(in srgb, var(--color-key-active) 55%, #fff), var(--color-key-active))";
  }
  return [
    "linear-gradient(to bottom, rgba(0,0,0,0.10), rgba(0,0,0,0) 14px)",
    "linear-gradient(to bottom, var(--color-key-white) 70%, var(--color-key-white-bottom))",
  ].join(", ");
}

function getBlackKeyBackground(
  songActive: boolean,
  midiActive: boolean,
): string {
  if (midiActive) {
    return `linear-gradient(to bottom, ${MIDI_HIGHLIGHT}, color-mix(in srgb, ${MIDI_HIGHLIGHT} 70%, #000))`;
  }
  if (songActive) {
    return "linear-gradient(to bottom, var(--color-key-active), color-mix(in srgb, var(--color-key-active) 72%, #000))";
  }
  // Body, then a lighter front face across the bottom 12%.
  return [
    "linear-gradient(to bottom, var(--color-key-black-top) 0%, var(--color-key-black) 86%, color-mix(in srgb, var(--color-key-black-top) 80%, #fff) 88%, var(--color-key-black-top) 100%)",
  ].join(", ");
}

function getKeyShadow(
  songActive: boolean,
  midiActive: boolean,
  isBlack: boolean,
): string {
  if (midiActive) {
    return `0 0 ${isBlack ? 10 : 14}px color-mix(in srgb, ${MIDI_HIGHLIGHT} 55%, transparent), inset 0 -2px 0 rgba(0,0,0,0.15)`;
  }
  if (songActive) {
    return `0 0 ${isBlack ? 10 : 14}px color-mix(in srgb, var(--color-accent) ${isBlack ? 55 : 45}%, transparent), inset 0 -2px 0 rgba(0,0,0,0.12)`;
  }
  return isBlack
    ? "1px 3px 4px rgba(0,0,0,0.38), inset 1px 0 0 rgba(255,255,255,0.08), inset -1px 0 0 rgba(0,0,0,0.4)"
    : "inset 0 -6px 0 rgba(0,0,0,0.045), inset 0 -7px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(0,0,0,0.12)";
}

/** Pressed keys sink a little, black keys a little more. */
function getKeyTransform(
  songActive: boolean,
  midiActive: boolean,
  isBlack: boolean,
): string {
  if (midiActive || songActive) {
    return isBlack ? "translateY(2px)" : "translateY(1.5px)";
  }
  return "translateY(0)";
}

/** Shared label style for key note names */
const KEY_LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: 10,
  left: 0,
  right: 0,
  textAlign: "center",
  fontFamily: "var(--font-display)",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  opacity: 0.7,
  pointerEvents: "none",
  userSelect: "none",
};

export function PianoKeyboard({
  activeNotes,
  midiActiveNotes,
  hitNotes,
  missedNotes,
  height = 120,
  showLabels = true,
  compactLabels = false,
  range = FULL_KEY_RANGE,
  onKeyPress,
}: PianoKeyboardProps): React.JSX.Element {
  const layout = useMemo(() => buildLayout(range), [range]);
  const wPct = 100 / layout.whiteKeyCount;

  // The tracker holds pressed-key state, so it lives in state, not a memo
  // cache. `onKeyPress` must be a stable object (App passes a module constant).
  const [tracker] = useState(() =>
    onKeyPress ? createKeyPointerTracker(onKeyPress) : null,
  );
  useEffect(() => () => tracker?.releaseAll(), [tracker]);

  const pointerHandlers = tracker
    ? {
        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
          // Only the primary mouse button plays; touch and pen always do.
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const midi = midiFromPointerTarget(event.target);
          if (midi === null) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          tracker.down(event.pointerId, midi);
        },
        onPointerUp: (event: React.PointerEvent<HTMLDivElement>) =>
          tracker.up(event.pointerId),
        onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) =>
          tracker.up(event.pointerId),
        onLostPointerCapture: (event: React.PointerEvent<HTMLDivElement>) =>
          tracker.up(event.pointerId),
      }
    : {};

  return (
    <div
      className={`piano-keyboard relative w-full select-none overflow-hidden ${tracker ? "cursor-pointer touch-none" : ""}`}
      style={{ height }}
      data-testid="piano-keyboard"
      {...pointerHandlers}
    >
      {/* Felt strip and the shadow the fallboard casts on the keys. */}
      <div className="piano-keyboard-felt" aria-hidden="true" />
      {/* White keys */}
      {layout.whiteKeys.map((key) => {
        const songActive = activeNotes?.has(key.midi) ?? false;
        const midiActive = midiActiveNotes?.has(key.midi) ?? false;
        const practiceClass = getPracticeClass(key.midi, hitNotes, missedNotes);
        return (
          <div
            key={key.midi}
            data-midi={key.midi}
            className={`absolute top-0 ${practiceClass}`}
            style={{
              left: `calc(${key.index * wPct}% + ${WHITE_KEY_GAP / 2}px)`,
              width: `calc(${wPct}% - ${WHITE_KEY_GAP}px)`,
              height: "100%",
              boxSizing: "border-box",
              background: getWhiteKeyBackground(songActive, midiActive),
              borderRadius: "0 0 7px 7px",
              boxShadow: getKeyShadow(songActive, midiActive, false),
              transform: getKeyTransform(songActive, midiActive, false),
              transition:
                "transform 0.06s ease-out, box-shadow 0.08s ease-out, background 0.06s ease-out",
            }}
          >
            {showLabels && (
              <span
                style={{
                  ...KEY_LABEL_STYLE,
                  // Keep the name readable on the highlighted key.
                  ...(songActive || midiActive
                    ? { color: "var(--color-on-accent)", opacity: 0.95 }
                    : { color: "var(--color-text-muted)" }),
                }}
              >
                {compactLabels
                  ? getCompactWhiteKeyLabel(key.midi)
                  : getWhiteKeyLabel(key.midi)}
              </span>
            )}
          </div>
        );
      })}

      {/* Black keys */}
      {layout.blackKeys.map((key) => {
        const songActive = activeNotes?.has(key.midi) ?? false;
        const midiActive = midiActiveNotes?.has(key.midi) ?? false;
        const practiceClass = getPracticeClass(key.midi, hitNotes, missedNotes);
        const bWidth = wPct * BLACK_KEY_WIDTH_RATIO;
        const centerX = (key.leftWhiteIndex + 1) * wPct;
        return (
          <div
            key={key.midi}
            data-midi={key.midi}
            className={`absolute top-0 ${practiceClass}`}
            style={{
              left: `${centerX - bWidth / 2}%`,
              width: `${bWidth}%`,
              height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
              zIndex: 3,
              background: getBlackKeyBackground(songActive, midiActive),
              borderRadius: "0 0 4px 4px",
              boxShadow: getKeyShadow(songActive, midiActive, true),
              transform: getKeyTransform(songActive, midiActive, true),
              transition:
                "transform 0.06s ease-out, box-shadow 0.08s ease-out, background 0.06s ease-out",
            }}
          >
            {showLabels && !compactLabels && (
              <span
                style={{
                  ...KEY_LABEL_STYLE,
                  color: "rgba(255, 255, 255, 0.7)",
                }}
              >
                {getBlackKeyLabel(key.midi)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Exported for testing
/* eslint-disable react-refresh/only-export-components */
export {
  MIDI_HIGHLIGHT,
  getWhiteKeyBackground,
  getBlackKeyBackground,
  getKeyShadow,
  getPracticeClass,
  getWhiteKeyLabel,
  getBlackKeyLabel,
  FIRST_NOTE,
  LAST_NOTE,
  IS_BLACK_NOTE,
};
/* eslint-enable react-refresh/only-export-components */
