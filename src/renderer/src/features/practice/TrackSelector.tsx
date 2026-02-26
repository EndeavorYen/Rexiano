import { useCallback } from 'react'
import { useSongStore } from '@renderer/stores/useSongStore'
import { usePracticeStore } from '@renderer/stores/usePracticeStore'

export function TrackSelector(): React.JSX.Element {
  const song = useSongStore((s) => s.song)
  const activeTracks = usePracticeStore((s) => s.activeTracks)
  const setActiveTracks = usePracticeStore((s) => s.setActiveTracks)

  const tracks = song?.tracks ?? []

  const handleToggle = useCallback(
    (index: number) => {
      const next = new Set(activeTracks)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      setActiveTracks(next)
    },
    [activeTracks, setActiveTracks]
  )

  if (tracks.length === 0) return <></>

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Tracks
      </span>

      <div className="flex flex-col gap-0.5">
        {tracks.map((track, i) => {
          const isActive = activeTracks.has(i)
          return (
            <label
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors duration-100"
              style={{
                background: isActive
                  ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                  : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => handleToggle(i)}
                className="accent-[var(--color-accent)] cursor-pointer"
                aria-label={`Toggle track ${track.name || `Track ${i + 1}`}`}
              />
              <span
                className="text-xs font-body truncate"
                style={{ color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              >
                {track.name || `Track ${i + 1}`}
              </span>
              <span
                className="text-[10px] font-mono ml-auto shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {track.notes.length} notes
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
