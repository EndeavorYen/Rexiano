const FIRST_NOTE = 21;
const LAST_NOTE = 108;

const IS_BLACK: boolean[] = [
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

const BLACK_WIDTH_RATIO = 0.58;

/** Smallest keyboard the song-fitted range may shrink to (3 octaves). */
export const MIN_KEY_RANGE_SEMITONES = 36;

export interface KeyPosition {
  x: number;
  width: number;
}

/** Inclusive MIDI range shown on the keyboard and the falling-notes lane. */
export interface KeyRange {
  first: number;
  last: number;
}

/** The standard 88-key piano, A0 (21) to C8 (108). */
export const FULL_KEY_RANGE: KeyRange = { first: FIRST_NOTE, last: LAST_NOTE };

export function isBlackKey(midi: number): boolean {
  return IS_BLACK[((midi % 12) + 12) % 12];
}

/**
 * Keyboard range that fits a song: whole octaves (C…B) around its notes,
 * grown to at least `minSemitones`, clamped to the 88 keys.
 *
 * Both ends always land on white keys, so the keyboard never starts or ends
 * on half a black key. With no notes, the full keyboard is returned.
 */
export function computeKeyRange(
  midiNotes: Iterable<number>,
  minSemitones = MIN_KEY_RANGE_SEMITONES,
): KeyRange {
  let low = Infinity;
  let high = -Infinity;
  for (const midi of midiNotes) {
    if (!Number.isFinite(midi)) continue;
    if (midi < low) low = midi;
    if (midi > high) high = midi;
  }
  if (low === Infinity) return FULL_KEY_RANGE;

  let first = Math.max(FIRST_NOTE, low - (((low % 12) + 12) % 12));
  let last = Math.min(LAST_NOTE, high - (((high % 12) + 12) % 12) + 11);

  // Grow one octave at a time, alternating below and above, so the song
  // stays roughly centred. A clamped end grows the other way instead.
  let growBelow = true;
  while (
    last - first + 1 < minSemitones &&
    (first > FIRST_NOTE || last < LAST_NOTE)
  ) {
    if ((growBelow && first > FIRST_NOTE) || last >= LAST_NOTE) {
      first = Math.max(FIRST_NOTE, first - 12);
    } else {
      last = Math.min(LAST_NOTE, last + 12);
    }
    growBelow = !growBelow;
  }

  return { first, last };
}

export function buildKeyPositions(
  canvasWidth: number,
  range: KeyRange = FULL_KEY_RANGE,
): Map<number, KeyPosition> {
  const map = new Map<number, KeyPosition>();

  const whiteKeyIndices = new Map<number, number>();
  let whiteCount = 0;
  for (let midi = range.first; midi <= range.last; midi++) {
    if (!IS_BLACK[midi % 12]) {
      whiteKeyIndices.set(midi, whiteCount);
      whiteCount++;
    }
  }
  if (whiteCount === 0) return map;

  const whiteKeyWidth = canvasWidth / whiteCount;

  let lastWhiteIndex = -1;
  for (let midi = range.first; midi <= range.last; midi++) {
    const isBlack = IS_BLACK[midi % 12];
    if (!isBlack) {
      const idx = whiteKeyIndices.get(midi)!;
      lastWhiteIndex = idx;
      map.set(midi, { x: idx * whiteKeyWidth, width: whiteKeyWidth });
    } else {
      const bw = whiteKeyWidth * BLACK_WIDTH_RATIO;
      const centerX = (lastWhiteIndex + 1) * whiteKeyWidth;
      map.set(midi, { x: centerX - bw / 2, width: bw });
    }
  }

  return map;
}
