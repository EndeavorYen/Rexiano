import { useState, useRef, useEffect } from 'react'
import { useThemeStore } from '@renderer/stores/useThemeStore'
import { themes, type ThemeId } from '@renderer/themes/tokens'

const themeList: ThemeId[] = ['lavender', 'ocean', 'peach']

export function ThemePicker(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const currentId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
        style={{ background: 'var(--color-surface-alt)' }}
        title="Change theme"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="var(--color-text-muted)" strokeWidth="1.5" fill="none" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 flex gap-2 p-2 rounded-lg shadow-lg"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {themeList.map((id) => (
            <button
              key={id}
              onClick={() => { setTheme(id); setOpen(false) }}
              className="w-7 h-7 rounded-full relative cursor-pointer transition-transform hover:scale-110"
              style={{
                background: themes[id].dot,
                boxShadow: id === currentId ? '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent)' : 'none',
              }}
              title={themes[id].label}
            >
              {id === currentId && (
                <svg className="absolute inset-0 m-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
