import { useEffect, useState } from 'react'
import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  applyThemeMode,
  resolveThemeMode,
  type ThemeMode,
} from '#/lib/theme'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE
  }

  try {
    return resolveThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME_MODE
  }
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE)

  useEffect(() => {
    const initialMode = getInitialMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
  }, [])

  function toggleMode() {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(nextMode)
    applyThemeMode(nextMode)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    } catch {
      // Keep the in-memory theme even when persistence is unavailable.
    }
  }

  const nextMode = mode === 'light' ? 'dark' : 'light'
  const label = `Theme mode: ${mode}. Click to switch to ${nextMode} mode.`

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="rounded-md border border-[var(--chip-line)] bg-transparent px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
    >
      {mode === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
