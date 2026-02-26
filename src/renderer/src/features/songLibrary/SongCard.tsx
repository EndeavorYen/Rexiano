import { useCallback, useState } from 'react'
import type { BuiltinSongMeta } from '../../../../shared/types'

interface SongCardProps {
  song: BuiltinSongMeta
  onSelect: (songId: string) => void
  colorIndex: number
}

const difficultyLabels: Record<BuiltinSongMeta['difficulty'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SongCard({ song, onSelect, colorIndex }: SongCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)

  const noteColors = ['var(--color-note1)', 'var(--color-note2)', 'var(--color-note3)', 'var(--color-note4)']
  const stripeColor = noteColors[colorIndex % noteColors.length]

  const handleClick = useCallback(() => {
    onSelect(song.id)
  }, [song.id, onSelect])

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-left rounded-xl overflow-hidden transition-all duration-200 cursor-pointer w-full"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Colored accent stripe */}
      <div style={{ height: 4, background: stripeColor }} />

      <div className="p-4">
        <h3 className="font-body font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
          {song.title}
        </h3>
        <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
          {song.composer}
        </p>

        <div className="flex items-center justify-between mt-3">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text-muted)',
            }}
          >
            {difficultyLabels[song.difficulty]}
          </span>
          <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {formatDuration(song.durationSeconds)}
          </span>
        </div>
      </div>
    </button>
  )
}
