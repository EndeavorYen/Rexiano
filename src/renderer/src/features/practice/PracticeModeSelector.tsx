import { usePracticeStore } from '@renderer/stores/usePracticeStore'
import type { PracticeMode } from '@shared/types'

const modes: { id: PracticeMode; label: string; icon: React.JSX.Element }[] = [
  {
    id: 'watch',
    label: 'Watch',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'wait',
    label: 'Wait',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="5.5" y="4.5" width="2" height="7" rx="0.5" fill="currentColor" />
        <rect x="8.5" y="4.5" width="2" height="7" rx="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'free',
    label: 'Free',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 8C3 5.5 5 3 8 3C11 3 12 5 12.5 6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M10.5 4.5L12.5 6.5L14 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13 8C13 10.5 11 13 8 13C5 13 4 11 3.5 9.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M5.5 11.5L3.5 9.5L2 11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export function PracticeModeSelector(): React.JSX.Element {
  const currentMode = usePracticeStore((s) => s.mode)
  const setMode = usePracticeStore((s) => s.setMode)

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Practice mode">
      {modes.map(({ id, label, icon }) => {
        const isActive = currentMode === id
        return (
          <button
            key={id}
            role="radio"
            aria-checked={isActive}
            onClick={() => setMode(id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-body font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: isActive ? 'var(--color-accent)' : 'var(--color-surface-alt)',
              color: isActive ? '#fff' : 'var(--color-text-muted)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
            }}
            title={`${label} mode`}
          >
            {icon}
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
