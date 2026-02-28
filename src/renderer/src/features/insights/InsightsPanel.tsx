/**
 * InsightsPanel — Practice analytics dashboard.
 *
 * Displays:
 * - Accuracy trend chart (SVG line chart via ProgressChart)
 * - Top 5 weak spots with miss rates
 * - Practice statistics (total time, sessions, best accuracy, improvement)
 * - Warm empty state for first-time users
 *
 * Can be opened from SongLibrary or PracticeToolbar.
 * Uses CSS custom properties for theming.
 */

import { ProgressChart } from './ProgressChart'
import type { PracticeInsight, WeakSpot } from './WeakSpotAnalyzer'

interface InsightsPanelProps {
  /** Analysis results from WeakSpotAnalyzer */
  insight: PracticeInsight | null
  /** Called when user wants to close the panel */
  onClose?: () => void
}

export function InsightsPanel({ insight, onClose }: InsightsPanelProps): React.JSX.Element {
  // Empty state: no data yet
  if (!insight || insight.sessionsCount === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          minHeight: 280,
        }}
      >
        {/* Friendly piano icon */}
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
          <rect x="8" y="12" width="40" height="32" rx="4" stroke="var(--color-accent)" strokeWidth="2" opacity="0.5" />
          <rect x="16" y="12" width="6" height="18" rx="1" fill="var(--color-accent)" opacity="0.2" />
          <rect x="25" y="12" width="6" height="18" rx="1" fill="var(--color-accent)" opacity="0.2" />
          <rect x="34" y="12" width="6" height="18" rx="1" fill="var(--color-accent)" opacity="0.2" />
        </svg>

        <div className="text-center">
          <h3
            className="text-base font-display font-bold mb-1"
            style={{ color: 'var(--color-text)' }}
          >
            No practice data yet
          </h3>
          <p
            className="text-sm font-body"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Start practicing to see your insights here!
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-body font-medium cursor-pointer btn-ghost-themed"
          >
            Close
          </button>
        )}
      </div>
    )
  }

  const { weakSpots, accuracyTrend, totalPracticeMinutes, sessionsCount, bestAccuracy, recentImprovement } = insight

  return (
    <div
      className="flex flex-col gap-5 p-5 rounded-2xl"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-lg font-display font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          Practice Insights
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
            aria-label="Close insights panel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Statistics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Sessions" value={String(sessionsCount)} />
        <StatCard label="Practice time" value={formatMinutes(totalPracticeMinutes)} />
        <StatCard label="Best accuracy" value={`${bestAccuracy.toFixed(1)}%`} accent />
        <StatCard
          label="Improvement"
          value={formatImprovement(recentImprovement)}
          positive={recentImprovement > 0}
          negative={recentImprovement < 0}
        />
      </div>

      {/* Accuracy trend chart */}
      <div className="flex flex-col gap-2">
        <h3
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Accuracy Trend
        </h3>
        <div
          className="rounded-xl p-3 overflow-hidden"
          style={{ background: 'var(--color-surface-alt)' }}
        >
          <ProgressChart data={accuracyTrend} width={380} height={180} />
        </div>
      </div>

      {/* Weak spots */}
      {weakSpots.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Weak Spots
          </h3>
          <div className="flex flex-col gap-1">
            {weakSpots.map((spot) => (
              <WeakSpotRow key={spot.midi} spot={spot} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  accent?: boolean
  positive?: boolean
  negative?: boolean
}

function StatCard({ label, value, accent, positive, negative }: StatCardProps): React.JSX.Element {
  let valueColor = 'var(--color-text)'
  if (accent) valueColor = 'var(--color-accent)'
  if (positive) valueColor = '#22c55e'
  if (negative) valueColor = '#ef4444'

  return (
    <div
      className="flex flex-col gap-0.5 p-3 rounded-lg"
      style={{ background: 'var(--color-surface-alt)' }}
    >
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <span
        className="text-base font-display font-bold tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  )
}

function WeakSpotRow({ spot }: { spot: WeakSpot }): React.JSX.Element {
  const barWidth = Math.round(spot.missRate * 100)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ background: 'var(--color-surface-alt)' }}
    >
      {/* Note name */}
      <span
        className="text-sm font-mono font-bold w-10 shrink-0"
        style={{ color: 'var(--color-text)' }}
      >
        {spot.noteName}
      </span>

      {/* Miss rate bar */}
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${barWidth}%`,
            background: barWidth > 50 ? '#ef4444' : barWidth > 25 ? '#f59e0b' : 'var(--color-accent)',
          }}
        />
      </div>

      {/* Stats */}
      <span
        className="text-[11px] font-mono tabular-nums w-16 text-right shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {(spot.missRate * 100).toFixed(0)}% miss
      </span>
      <span
        className="text-[10px] font-mono tabular-nums w-12 text-right shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {spot.totalAttempts}x
      </span>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatImprovement(value: number): string {
  if (value === 0) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
