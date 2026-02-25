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
    <div
      className="relative w-full select-none overflow-hidden"
      style={{ height, background: 'var(--color-surface)' }}
    >
      {/* White keys */}
      {layout.whiteKeys.map((key) => {
        const active = activeNotes?.has(key.midi)
        return (
          <div
            key={key.midi}
            className="absolute top-0 transition-all duration-75"
            style={{
              left: `${key.index * wPct}%`,
              width: `${wPct}%`,
              height: '100%',
              boxSizing: 'border-box',
              background: active
                ? 'var(--color-key-active)'
                : `linear-gradient(to bottom, var(--color-key-white), var(--color-key-white-bottom))`,
              borderRight: '1px solid var(--color-border)',
              borderRadius: '0 0 4px 4px',
              boxShadow: active
                ? '0 1px 8px color-mix(in srgb, var(--color-accent) 30%, transparent)'
                : '0 2px 4px rgba(0,0,0,0.08)',
            }}
          />
        )
      })}

      {/* Black keys */}
      {layout.blackKeys.map((key) => {
        const active = activeNotes?.has(key.midi)
        const bWidth = wPct * BLACK_KEY_WIDTH_RATIO
        const centerX = (key.leftWhiteIndex + 1) * wPct
        return (
          <div
            key={key.midi}
            className="absolute top-0 transition-all duration-75"
            style={{
              left: `${centerX - bWidth / 2}%`,
              width: `${bWidth}%`,
              height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
              zIndex: 1,
              background: active
                ? 'var(--color-key-active)'
                : `linear-gradient(to bottom, var(--color-key-black-top), var(--color-key-black))`,
              borderRadius: '0 0 3px 3px',
              boxShadow: active
                ? '0 1px 6px color-mix(in srgb, var(--color-accent) 40%, transparent)'
                : '0 2px 3px rgba(0,0,0,0.25), inset 0 -1px 1px rgba(255,255,255,0.05)',
            }}
          />
        )
      })}
    </div>
  )
}
