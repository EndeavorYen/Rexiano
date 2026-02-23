import { useMemo } from 'react'

/** MIDI range for a standard 88-key piano: A0 (21) to C8 (108) */
const FIRST_NOTE = 21
const LAST_NOTE = 108

/** For each chromatic note (0-11), whether it is a black key. */
const IS_BLACK_NOTE = [false, true, false, true, false, false, true, false, true, false, true, false]

/** Black key width as a fraction of white key width */
const BLACK_KEY_WIDTH_RATIO = 0.58
/** Black key height as a fraction of total keyboard height */
const BLACK_KEY_HEIGHT_RATIO = 0.64

interface WhiteKeyInfo {
  midi: number
  index: number
}

interface BlackKeyInfo {
  midi: number
  /** Index of the white key immediately to the left */
  leftWhiteIndex: number
}

interface Layout {
  whiteKeys: WhiteKeyInfo[]
  blackKeys: BlackKeyInfo[]
  whiteKeyCount: number
}

function buildLayout(): Layout {
  const whiteKeys: WhiteKeyInfo[] = []
  const blackKeys: BlackKeyInfo[] = []
  let whiteIndex = 0

  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    const noteInOctave = midi % 12
    if (IS_BLACK_NOTE[noteInOctave]) {
      blackKeys.push({ midi, leftWhiteIndex: whiteIndex - 1 })
    } else {
      whiteKeys.push({ midi, index: whiteIndex })
      whiteIndex++
    }
  }

  return { whiteKeys, blackKeys, whiteKeyCount: whiteIndex }
}

interface PianoKeyboardProps {
  activeNotes?: Set<number>
  height?: number
}

export function PianoKeyboard({ activeNotes, height = 120 }: PianoKeyboardProps): React.JSX.Element {
  const layout = useMemo(() => buildLayout(), [])
  const wPct = 100 / layout.whiteKeyCount

  return (
    <div className="relative w-full select-none overflow-hidden bg-white" style={{ height }}>
      {/* White keys — bottom layer */}
      {layout.whiteKeys.map((key) => {
        const active = activeNotes?.has(key.midi)
        return (
          <div
            key={key.midi}
            className={`absolute top-0 border-r border-stone-300 transition-colors ${
              active ? 'bg-sky-400' : 'bg-white hover:bg-stone-50'
            }`}
            style={{
              left: `${key.index * wPct}%`,
              width: `${wPct}%`,
              height: '100%',
              boxSizing: 'border-box'
            }}
          />
        )
      })}

      {/* Black keys — top layer, overlaid on white keys */}
      {layout.blackKeys.map((key) => {
        const active = activeNotes?.has(key.midi)
        const bWidth = wPct * BLACK_KEY_WIDTH_RATIO
        const centerX = (key.leftWhiteIndex + 1) * wPct
        return (
          <div
            key={key.midi}
            className={`absolute top-0 rounded-b-sm transition-colors ${
              active ? 'bg-sky-500' : 'bg-stone-900'
            }`}
            style={{
              left: `${centerX - bWidth / 2}%`,
              width: `${bWidth}%`,
              height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
              zIndex: 1
            }}
          />
        )
      })}

      {/* Bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-400" />
    </div>
  )
}
