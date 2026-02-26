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

function buildLayout(): Layout {
  const whiteKeys: WhiteKeyInfo[] = [];
  const blackKeys: BlackKeyInfo[] = [];
  let whiteIndex = 0;

  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
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
    return `0 1px ${isBlack ? 6 : 8}px color-mix(in srgb, ${MIDI_HIGHLIGHT} 50%, transparent)`;
  }
  if (songActive) {
    return `0 1px ${isBlack ? 6 : 8}px color-mix(in srgb, var(--color-accent) ${isBlack ? 40 : 30}%, transparent)`;
  }
  return isBlack
    ? "0 2px 3px rgba(0,0,0,0.25), inset 0 -1px 1px rgba(255,255,255,0.05)"
    : "0 2px 4px rgba(0,0,0,0.08)";
}

export function PianoKeyboard({
  activeNotes,
  midiActiveNotes,
  hitNotes,
  missedNotes,
  height = 120,
}: PianoKeyboardProps): React.JSX.Element {
  const layout = useMemo(() => buildLayout(), []);
  const wPct = 100 / layout.whiteKeyCount;

  return (
    <div
      className="relative w-full select-none overflow-hidden"
      style={{ height, background: "var(--color-surface)" }}
    >
      {/* White keys */}
      {layout.whiteKeys.map((key) => {
        const songActive = activeNotes?.has(key.midi) ?? false;
        const midiActive = midiActiveNotes?.has(key.midi) ?? false;
        const practiceClass = getPracticeClass(key.midi, hitNotes, missedNotes);
        return (
          <div
            key={key.midi}
            className={`absolute top-0 transition-all duration-75 ${practiceClass}`}
            style={{
              left: `${key.index * wPct}%`,
              width: `${wPct}%`,
              height: "100%",
              boxSizing: "border-box",
              background: getWhiteKeyBackground(songActive, midiActive),
              borderRight: "1px solid var(--color-border)",
              borderRadius: "0 0 4px 4px",
              boxShadow: getKeyShadow(songActive, midiActive, false),
            }}
          />
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
            className={`absolute top-0 transition-all duration-75 ${practiceClass}`}
            style={{
              left: `${centerX - bWidth / 2}%`,
              width: `${bWidth}%`,
              height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
              zIndex: 1,
              background: getBlackKeyBackground(songActive, midiActive),
              borderRadius: "0 0 3px 3px",
              boxShadow: getKeyShadow(songActive, midiActive, true),
            }}
          />
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
};
/* eslint-enable react-refresh/only-export-components */
