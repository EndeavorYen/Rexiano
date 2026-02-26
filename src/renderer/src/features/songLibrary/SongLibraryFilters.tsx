import { useCallback } from 'react'
import { useSongLibraryStore, type DifficultyFilter } from '../../stores/useSongLibraryStore'

const difficulties: { value: DifficultyFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export function SongLibraryFilters(): React.JSX.Element {
  const searchQuery = useSongLibraryStore((s) => s.searchQuery)
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter)
  const setSearchQuery = useSongLibraryStore((s) => s.setSearchQuery)
  const setDifficultyFilter = useSongLibraryStore((s) => s.setDifficultyFilter)

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    [setSearchQuery],
  )

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-2xl mx-auto">
      {/* Search */}
      <div className="flex-1 relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          &#x2315;
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search songs..."
          className="w-full pl-8 pr-3 py-2 rounded-lg text-sm font-body outline-none transition-colors"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
      </div>

      {/* Difficulty pills */}
      <div className="flex gap-1.5">
        {difficulties.map((d) => (
          <button
            key={d.value}
            onClick={() => setDifficultyFilter(d.value)}
            className="px-3 py-1.5 rounded-full text-xs font-body font-medium transition-colors cursor-pointer"
            style={{
              background: difficultyFilter === d.value ? 'var(--color-accent)' : 'var(--color-surface)',
              color: difficultyFilter === d.value ? '#fff' : 'var(--color-text-muted)',
              border:
                difficultyFilter === d.value
                  ? '1px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
}
