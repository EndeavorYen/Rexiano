import { useState, useCallback } from 'react'
import { parseMidiFile } from './engines/midi/MidiFileParser'
import { useSongStore } from './stores/useSongStore'
import { usePlaybackStore } from './stores/usePlaybackStore'
import { FallingNotesCanvas } from './features/fallingNotes/FallingNotesCanvas'
import { PianoKeyboard } from './features/fallingNotes/PianoKeyboard'
import { TransportBar } from './features/fallingNotes/TransportBar'
import { ThemePicker } from './features/settings/ThemePicker'

function App(): React.JSX.Element {
  const song = useSongStore((s) => s.song)
  const loadSong = useSongStore((s) => s.loadSong)
  const reset = usePlaybackStore((s) => s.reset)

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes)
  }, [])

  const [error, setError] = useState<string | null>(null)

  const handleOpenFile = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const result = await window.api.openMidiFile()
      if (result) {
        const parsed = parseMidiFile(result.fileName, result.data)
        loadSong(parsed)
        reset()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to open MIDI file'
      setError(msg)
      console.error('Failed to parse MIDI file:', e)
    }
  }, [loadSong, reset])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {!song ? (
        /* Welcome screen */
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
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
          {error && (
            <p className="mt-4 text-sm" style={{ color: 'var(--color-accent)' }}>
              {error}
            </p>
          )}
          <div className="absolute bottom-6 right-6">
            <ThemePicker />
          </div>
        </div>
      ) : (
        /* Song loaded: header + falling notes + transport + keyboard */
        <>
          {/* Song info header */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold font-body truncate">{song.fileName}</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {song.tracks.length} track{song.tracks.length > 1 ? 's' : ''} &middot;{' '}
                {song.noteCount} notes
                {song.tempos.length > 0 && ` \u00B7 ${Math.round(song.tempos[0].bpm)} BPM`}
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

          {/* Falling notes canvas (fills remaining space) */}
          <FallingNotesCanvas onActiveNotesChange={handleActiveNotesChange} />

          {/* Transport bar */}
          <TransportBar />

          {/* Piano keyboard */}
          <PianoKeyboard activeNotes={activeNotes} height={100} />
        </>
      )}
    </div>
  )
}

export default App
