import { useEffect, useMemo, useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { parseMidiFile } from '../../engines/midi/MidiFileParser'
import { useSongStore } from '../../stores/useSongStore'
import { usePlaybackStore } from '../../stores/usePlaybackStore'
import { useSongLibraryStore } from '../../stores/useSongLibraryStore'
import { SongCard } from './SongCard'
import { SongLibraryFilters } from './SongLibraryFilters'
import { ThemePicker } from '../settings/ThemePicker'
import appIcon from '../../assets/icon.png'

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
      <div className="flex items-center gap-3 mb-2">
        <img src={appIcon} alt="" width={48} height={48} className="rounded-xl" />
        <h1
          className="text-5xl font-extrabold font-display"
          style={{ color: 'var(--color-accent)' }}
        >
          Rexiano
        </h1>
      </div>
      <p className="text-base mb-8 font-body" style={{ color: 'var(--color-text-muted)' }}>
        Pick a song to start practicing
      </p>

      {/* Filters */}
      <SongLibraryFilters />

      {/* Song grid */}
      <div className="w-full max-w-2xl mt-6">
        {isLoading ? (
          /* Skeleton loading cards */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <div className="skeleton h-10" />
                <div className="p-4 space-y-3">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="flex justify-between mt-3">
                    <div className="skeleton h-4 w-16 rounded-full" />
                    <div className="skeleton h-3 w-10 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSongs.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-4 opacity-40">
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
              <path d="M24 36V28L36 32L24 36Z" fill="currentColor" opacity="0.3" />
              <path d="M24 36V28L36 32L24 36Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-body">
              {songs.length === 0 ? 'No built-in songs found' : 'No songs match your filter'}
            </p>
            {songs.length === 0 && (
              <p className="text-xs mt-2 font-body opacity-70">
                Try importing a MIDI file to get started
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredSongs.map((song, i) => (
              <div key={song.id} className="relative">
                <SongCard song={song} onSelect={handleSelectSong} colorIndex={i} />
                {loadingId === song.id && (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--color-surface) 70%, transparent)' }}
                  >
                    <div
                      className="w-5 h-5 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: 'var(--color-border)',
                        borderTopColor: 'var(--color-accent)',
                      }}
                    />
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
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-body font-medium cursor-pointer btn-ghost-themed"
        >
          <Upload size={15} />
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
