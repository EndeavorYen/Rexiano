import { useState, useCallback, useRef, useEffect } from 'react'
import { parseMidiFile } from './engines/midi/MidiFileParser'
import { useSongStore } from './stores/useSongStore'
import { usePlaybackStore } from './stores/usePlaybackStore'
import { AudioEngine } from './engines/audio/AudioEngine'
import { AudioScheduler } from './engines/audio/AudioScheduler'
import { FallingNotesCanvas } from './features/fallingNotes/FallingNotesCanvas'
import { PianoKeyboard } from './features/fallingNotes/PianoKeyboard'
import { TransportBar } from './features/fallingNotes/TransportBar'
import { ThemePicker } from './features/settings/ThemePicker'
import { SongLibrary } from './features/songLibrary/SongLibrary'
import { useMidiDeviceStore } from './stores/useMidiDeviceStore'

function App(): React.JSX.Element {
  const song = useSongStore((s) => s.song)
  const loadSong = useSongStore((s) => s.loadSong)
  const reset = usePlaybackStore((s) => s.reset)

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes)

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes)
  }, [])

  // ─── Phase 4: Audio Engine lifecycle ─────────────────
  const audioRef = useRef<{ engine: AudioEngine | null; scheduler: AudioScheduler | null }>({
    engine: null,
    scheduler: null,
  })

  // Init audio engine when a song is loaded
  useEffect(() => {
    if (!song) return

    const init = async (): Promise<void> => {
      if (audioRef.current.engine) {
        // Engine already exists, just bind the new song
        audioRef.current.scheduler?.setSong(song)
        return
      }

      const engine = new AudioEngine()
      const scheduler = new AudioScheduler(engine)
      audioRef.current = { engine, scheduler }

      usePlaybackStore.getState().setAudioStatus('loading')
      try {
        await engine.init()
        engine.setVolume(usePlaybackStore.getState().volume)
        scheduler.setSong(song)
        usePlaybackStore.getState().setAudioStatus('ready')
      } catch (err) {
        console.error('Audio init failed:', err)
        usePlaybackStore.getState().setAudioStatus('error')
      }
    }

    init()
  }, [song])

  // Sync playback state → AudioScheduler
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { engine, scheduler } = audioRef.current
      if (!engine || !scheduler) return

      // Volume sync
      if (state.volume !== prev.volume) {
        engine.setVolume(state.volume)
      }

      // Play / pause
      if (state.isPlaying && !prev.isPlaying) {
        // Resume AudioContext (Chrome suspends until user gesture)
        void engine.resume().then(() => scheduler.start(state.currentTime))
      } else if (!state.isPlaying && prev.isPlaying) {
        scheduler.stop()
      }

      // Seek detection while playing (user dragged slider → large time jump)
      // Debounced to avoid rapid seek calls during slider drag
      if (state.isPlaying && prev.isPlaying) {
        const audioTime = scheduler.getCurrentTime()
        if (audioTime !== null && Math.abs(state.currentTime - audioTime) > 0.5) {
          if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
          seekTimeoutRef.current = setTimeout(() => {
            scheduler.seek(usePlaybackStore.getState().currentTime)
            seekTimeoutRef.current = null
          }, 50)
        }
      }
    })
    return () => {
      unsub()
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
    }
  }, [])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current.scheduler?.dispose()
      audioRef.current.engine?.dispose()
    }
  }, [])

  // Callback for FallingNotesCanvas to sync visual with audio time
  const getAudioCurrentTime = useCallback((): number | null => {
    return audioRef.current.scheduler?.getCurrentTime() ?? null
  }, [])
  // ─── End Phase 4 ─────────────────────────────────────

  const handleOpenFile = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.openMidiFile()
      if (result) {
        const parsed = parseMidiFile(result.fileName, result.data)
        loadSong(parsed)
        reset()
      }
    } catch (e) {
      console.error('Failed to parse MIDI file:', e)
    }
  }, [loadSong, reset])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {!song ? (
        <SongLibrary onOpenFile={handleOpenFile} />
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
                onClick={() => { useSongStore.getState().clearSong(); usePlaybackStore.getState().reset() }}
                className="px-3 py-1.5 text-xs rounded-lg font-body transition-colors cursor-pointer"
                style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-alt)'}
              >
                ← Library
              </button>
            </div>
          </div>

          {/* Falling notes canvas (fills remaining space) */}
          <FallingNotesCanvas
            onActiveNotesChange={handleActiveNotesChange}
            getAudioCurrentTime={getAudioCurrentTime}
          />

          {/* Transport bar */}
          <TransportBar />

          {/* Piano keyboard */}
          <PianoKeyboard activeNotes={activeNotes} midiActiveNotes={midiActiveNotes} height={100} />
        </>
      )}
    </div>
  )
}

export default App
