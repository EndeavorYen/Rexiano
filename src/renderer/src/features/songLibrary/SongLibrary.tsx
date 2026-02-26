import { useEffect, useMemo, useCallback, useState } from 'react'
import { parseMidiFile } from '../../engines/midi/MidiFileParser'
import { useSongStore } from '../../stores/useSongStore'
import { usePlaybackStore } from '../../stores/usePlaybackStore'
import { useSongLibraryStore } from '../../stores/useSongLibraryStore'
import { SongCard } from './SongCard'
import { SongLibraryFilters } from './SongLibraryFilters'
import { ThemePicker } from '../settings/ThemePicker'

interface SongLibraryProps {
  onOpenFile: () => Promise<void>
}

export function SongLibrary({ onOpenFile }: SongLibraryProps): React.JSX.Element {
  const songs = useSongLibraryStore((s) => s.songs)
  const isLoading = useSongLibraryStore((s) => s.isLoading)
  const searchQuery = useSongLibraryStore((s) => s.searchQuery)
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter)
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs)

  const loadSong = useSongStore((s) => s.loadSong)
  const reset = usePlaybackStore((s) => s.reset)

  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  const filteredSongs = useMemo(() => {
    let result = songs
    if (difficultyFilter !== 'all') {
      result = result.filter((s) => s.difficulty === difficultyFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.composer.toLowerCase().includes(q),
      )
    }
    return result
  }, [songs, difficultyFilter, searchQuery])

  const handleSelectSong = useCallback(
    async (songId: string) => {
      setError(null)
      setLoadingId(songId)
      try {
        const result = await window.api.loadBuiltinSong(songId)
        if (result) {
          const parsed = parseMidiFile(result.fileName, result.data)
          loadSong(parsed)
          reset()
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load song'
        setError(msg)
        console.error('Failed to load built-in song:', e)
      } finally {
        setLoadingId(null)
      }
    },
    [loadSong, reset],
  )

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-8 overflow-y-auto relative">
      {/* Header */}
      <h1
        className="text-5xl font-extrabold mb-2 font-display"
        style={{ color: 'var(--color-accent)' }}
      >
        Rexiano
      </h1>
      <p className="text-base mb-8 font-body" style={{ color: 'var(--color-text-muted)' }}>
        Pick a song to start practicing
      </p>

      {/* Filters */}
      <SongLibraryFilters />

      {/* Song grid */}
      <div className="w-full max-w-2xl mt-6">
        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <span className="text-sm font-body">Loading songs...</span>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <span className="text-sm font-body">
              {songs.length === 0 ? 'No built-in songs found' : 'No songs match your filter'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredSongs.map((song, i) => (
              <div key={song.id} className="relative">
                <SongCard song={song} onSelect={handleSelectSong} colorIndex={i} />
                {loadingId === song.id && (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  >
                    <span className="text-xs font-body" style={{ color: '#fff' }}>
                      Loading...
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm font-body" style={{ color: 'var(--color-accent)' }}>
          {error}
        </p>
      )}

      {/* Secondary action: import custom file */}
      <div className="mt-8 mb-4">
        <button
          onClick={onOpenFile}
          className="px-5 py-2 rounded-lg text-sm font-body font-medium transition-colors cursor-pointer"
          style={{
            background: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent)'
            e.currentTarget.style.color = 'var(--color-accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          Import your own MIDI file
        </button>
      </div>

      {/* Theme picker */}
      <div className="absolute bottom-6 right-6">
        <ThemePicker />
      </div>
    </div>
  )
}
