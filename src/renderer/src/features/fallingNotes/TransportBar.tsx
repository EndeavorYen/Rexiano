import { Play, Pause, SkipBack } from 'lucide-react'
import { usePlaybackStore } from '@renderer/stores/usePlaybackStore'
import { useSongStore } from '@renderer/stores/useSongStore'
import { VolumeControl } from '@renderer/features/audio/VolumeControl'

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function TransportBar(): React.JSX.Element {
  const song = useSongStore((s) => s.song)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const setPlaying = usePlaybackStore((s) => s.setPlaying)
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime)
  const reset = usePlaybackStore((s) => s.reset)

  const duration = song?.duration ?? 0

  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
    >
      {/* Play / Pause */}
      <button
        onClick={() => setPlaying(!isPlaying)}
        disabled={!song}
        className="w-8 h-8 flex items-center justify-center rounded text-white disabled:opacity-40 transition-colors cursor-pointer"
        style={{ background: 'var(--color-accent)' }}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>

      {/* Reset */}
      <button
        onClick={reset}
        disabled={!song}
        className="w-8 h-8 flex items-center justify-center rounded disabled:opacity-40 transition-colors cursor-pointer"
        style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)' }}
        title="Back to start (Home)"
        aria-label="Reset to beginning"
      >
        <SkipBack size={14} fill="currentColor" />
      </button>

      {/* Time display */}
      <span className="text-xs tabular-nums w-20 text-center" style={{ color: 'var(--color-text-muted)' }}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Seek slider */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
        disabled={!song}
        className="flex-1 h-1"
        style={{ accentColor: 'var(--color-accent)' }}
        aria-label="Seek position"
      />

      {/* Volume */}
      <VolumeControl />
    </div>
  )
}
