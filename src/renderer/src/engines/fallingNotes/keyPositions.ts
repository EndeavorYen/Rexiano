const FIRST_NOTE = 21
const LAST_NOTE = 108

/** Same array as PianoKeyboard.tsx — marks which chromatic notes are black keys */
const IS_BLACK: boolean[] = [false, true, false, true, false, false, true, false, true, false, true, false]

const BLACK_WIDTH_RATIO = 0.58

export interface KeyPosition {
  /** Left edge in pixels */
  x: number
  /** Width in pixels */
  width: number
}

/**
 * Build a lookup table mapping MIDI note number → { x, width } in pixels.
 * Mirrors the PianoKeyboard layout exactly.
 *
 * @param canvasWidth Total canvas width in pixels
 */
export function buildKeyPositions(canvasWidth: number): Map<number, KeyPosition> {
  const map = new Map<number, KeyPosition>()

  // First pass: count white keys and assign each note a whiteKeyIndex
  const whiteKeyIndices = new Map<number, number>()
  let whiteCount = 0
  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    if (!IS_BLACK[midi % 12]) {
      whiteKeyIndices.set(midi, whiteCount)
      whiteCount++
    }
  }

  const whiteKeyWidth = canvasWidth / whiteCount

  // Second pass: compute positions
  let lastWhiteIndex = -1
  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    const isBlack = IS_BLACK[midi % 12]
    if (!isBlack) {
      const idx = whiteKeyIndices.get(midi)!
      lastWhiteIndex = idx
      map.set(midi, { x: idx * whiteKeyWidth, width: whiteKeyWidth })
    } else {
      // Black key: center on the boundary between the white key to the left
      // and the next white key (same logic as PianoKeyboard: leftWhiteIndex + 1)
      const bw = whiteKeyWidth * BLACK_WIDTH_RATIO
      const centerX = (lastWhiteIndex + 1) * whiteKeyWidth
      map.set(midi, { x: centerX - bw / 2, width: bw })
    }
  }

  return map
}
