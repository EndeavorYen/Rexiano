import { usePracticeStore } from '@renderer/stores/usePracticeStore'

export function ScoreOverlay(): React.JSX.Element {
  const score = usePracticeStore((s) => s.score)
  const mode = usePracticeStore((s) => s.mode)

  // In watch mode there's no scoring
  if (mode === 'watch') return <></>
  // Don't show overlay until practice begins
  if (score.totalNotes === 0) return <></>

  return (
    <div
      className="fixed top-3 right-3 z-50 flex flex-col items-end gap-0.5 px-3 py-2 rounded-lg backdrop-blur-sm pointer-events-none select-none"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
      role="status"
      aria-label="Practice score"
    >
      {/* Accuracy */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Acc
        </span>
        <span
          className="text-lg font-display font-bold tabular-nums leading-none"
          style={{ color: 'var(--color-accent)' }}
        >
          {score.accuracy.toFixed(1)}%
        </span>
      </div>

      {/* Combo streak */}
      {score.currentStreak > 1 && (
        <div className="flex items-baseline gap-1">
          <span
            className="text-xs font-mono font-bold tabular-nums"
            style={{ color: 'var(--color-text)' }}
          >
            {score.currentStreak}
          </span>
          <span
            className="text-[10px] font-body"
            style={{ color: 'var(--color-text-muted)' }}
          >
            combo
          </span>
        </div>
      )}
    </div>
  )
}
