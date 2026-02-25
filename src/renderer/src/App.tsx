import { useState } from 'react'
import { parseMidiFile } from './engines/midi/MidiFileParser'
import type { ParsedSong } from './engines/midi/types'
import { PianoKeyboard } from './features/fallingNotes/PianoKeyboard'
import { ThemePicker } from './features/settings/ThemePicker'

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function App(): React.JSX.Element {
  const [song, setSong] = useState<ParsedSong | null>(null)

  const handleOpenFile = async (): Promise<void> => {
    const result = await window.api.openMidiFile()
    if (result) {
      const parsed = parseMidiFile(result.fileName, result.data)
      setSong(parsed)
    }
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {!song ? (
          <>
            <h1
              className="text-5xl font-extrabold mb-3 font-display"
              style={{ color: 'var(--color-accent)' }}
            >
              Rexiano
            </h1>
            <p className="text-lg mb-10" style={{ color: 'var(--color-text-muted)' }}>
              A modern, open-source piano practice application
            </p>
            <button
              onClick={handleOpenFile}
              className="px-8 py-3.5 text-white rounded-full font-body font-medium text-base transition-colors cursor-pointer"
              style={{ background: 'var(--color-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
            >
              Open MIDI File
            </button>
            <div className="absolute bottom-6 right-6">
              <ThemePicker />
            </div>
          </>
        ) : (
          <>
            {/* Song info header */}
            <div
              className="flex items-center justify-between px-4 py-2 w-full"
              style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="min-w-0">
                <h2 className="text-sm font-semibold font-body truncate">{song.fileName}</h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDuration(song.duration)} &middot; {song.noteCount} notes &middot;{' '}
                  {song.tracks.length} track{song.tracks.length > 1 ? 's' : ''}
                  {song.tempos.length > 0 && ` \u00B7 ${song.tempos[0].bpm} BPM`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <ThemePicker />
                <button
                  onClick={handleOpenFile}
                  className="px-3 py-1.5 text-xs rounded-lg font-body transition-colors cursor-pointer"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
                >
                  Open Another
                </button>
              </div>
            </div>

            {/* Placeholder for FallingNotesCanvas (Phase 3 Task 7 will replace this) */}
            <div
              className="flex-1 w-full"
              style={{ background: 'var(--color-canvas-bg)' }}
            />
          </>
        )}
      </div>

      {/* Piano keyboard (always visible at bottom) */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <PianoKeyboard height={100} />
      </div>
    </div>
  )
}

export default App
