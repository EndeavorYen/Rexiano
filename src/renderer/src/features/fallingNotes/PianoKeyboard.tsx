import { useMemo } from "react";

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

/** Black key width as a fraction of white key width */
const BLACK_KEY_WIDTH_RATIO = 0.58;
/** Black key height as a fraction of total keyboard height */
const BLACK_KEY_HEIGHT_RATIO = 0.64;

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

function buildLayout(
  rangeFirst: number = FIRST_NOTE,
  rangeLast: number = LAST_NOTE,
): Layout {
  const whiteKeys: WhiteKeyInfo[] = [];
  const blackKeys: BlackKeyInfo[] = [];
  let whiteIndex = 0;

  for (let midi = rangeFirst; midi <= rangeLast; midi++) {
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
  /** First MIDI note to display (default: 21 = A0) */
  firstNote?: number;
  /** Last MIDI note to display (default: 108 = C8) */
  lastNote?: number;
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

/** MIDI input highlight — uses theme token so it adapts across all themes */
const MIDI_HIGHLIGHT = "var(--color-midi-highlight)";

function getWhiteKeyBackground(
  songActive: boolean,
  midiActive: boolean,
): string {
  if (midiActive) return MIDI_HIGHLIGHT;
  if (songActive) return "var(--color-key-active)";
  return "linear-gradient(to bottom, var(--color-key-white), var(--color-key-white-bottom))";
}

function getBlackKeyBackground(
  songActive: boolean,
  midiActive: boolean,
): string {
  if (midiActive) return MIDI_HIGHLIGHT;
  if (songActive) return "var(--color-key-active)";
  return "linear-gradient(to bottom, var(--color-key-black-top), var(--color-key-black))";
}

function getKeyShadow(
  songActive: boolean,
  midiActive: boolean,
  isBlack: boolean,
): string {
  if (midiActive) {
    return `0 0 ${isBlack ? 8 : 10}px color-mix(in srgb, ${MIDI_HIGHLIGHT} 50%, transparent), inset 0 0 6px color-mix(in srgb, ${MIDI_HIGHLIGHT} 25%, transparent)`;
  }
  if (songActive) {
    return `0 0 ${isBlack ? 8 : 10}px color-mix(in srgb, var(--color-accent) ${isBlack ? 45 : 35}%, transparent), inset 0 0 6px color-mix(in srgb, var(--color-accent) 15%, transparent)`;
  }
  return isBlack
    ? "0 2px 3px rgba(0,0,0,0.25), inset 0 -1px 1px rgba(255,255,255,0.05)"
    : "0 2px 4px rgba(0,0,0,0.08)";
}

/** Get translateY for key press effect */
function getKeyTransform(
  songActive: boolean,
  midiActive: boolean,
  isBlack: boolean,
): string {
  if (midiActive || songActive) {
    return isBlack ? "translateY(2px)" : "translateY(1px)";
  }
  return "translateY(0)";
}

/** Shared label style for key note names.
 * Uses var(--font-mono) to stay in sync with the Tailwind theme token. */
const KEY_LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: 4,
  left: 0,
  right: 0,
  textAlign: "center",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  lineHeight: 1,
  opacity: 0.6,
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
  firstNote = FIRST_NOTE,
  lastNote = LAST_NOTE,
}: PianoKeyboardProps): React.JSX.Element {
  const layout = useMemo(
    () => buildLayout(firstNote, lastNote),
    [firstNote, lastNote],
  );
  const wPct = 100 / layout.whiteKeyCount;

  return (
    <div
      className="relative w-full select-none overflow-hidden"
      style={{ height, background: "var(--color-surface)" }}
      role="img"
      aria-label="Piano keyboard"
      data-testid="piano-keyboard"
    >
      {/* White keys */}
      {layout.whiteKeys.map((key) => {
        const songActive = activeNotes?.has(key.midi) ?? false;
        const midiActive = midiActiveNotes?.has(key.midi) ?? false;
        const practiceClass = getPracticeClass(key.midi, hitNotes, missedNotes);
        return (
          <div
            key={key.midi}
            className={`absolute top-0 ${practiceClass}`}
            style={{
              left: `${key.index * wPct}%`,
              width: `${wPct}%`,
              height: "100%",
              boxSizing: "border-box",
              background: getWhiteKeyBackground(songActive, midiActive),
              borderRight: "1px solid var(--color-border)",
              borderRadius: "0 0 4px 4px",
              boxShadow: getKeyShadow(songActive, midiActive, false),
              transform: getKeyTransform(songActive, midiActive, false),
              transition:
                "transform 0.06s ease-out, box-shadow 0.08s ease-out, background 0.06s ease-out",
              contain: "layout paint",
            }}
          >
            {showLabels && (
              <span
                aria-hidden="true"
                style={{
                  ...KEY_LABEL_STYLE,
                  color: "var(--color-text-muted)",
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
            className={`absolute top-0 ${practiceClass}`}
            style={{
              left: `${centerX - bWidth / 2}%`,
              width: `${bWidth}%`,
              height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
              zIndex: 1,
              background: getBlackKeyBackground(songActive, midiActive),
              borderRadius: "0 0 3px 3px",
              boxShadow: getKeyShadow(songActive, midiActive, true),
              transform: getKeyTransform(songActive, midiActive, true),
              transition:
                "transform 0.06s ease-out, box-shadow 0.08s ease-out, background 0.06s ease-out",
              contain: "layout paint",
            }}
          >
            {showLabels && !compactLabels && (
              <span
                aria-hidden="true"
                style={{
                  ...KEY_LABEL_STYLE,
                  color:
                    "color-mix(in srgb, var(--color-key-white) 70%, transparent)",
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
