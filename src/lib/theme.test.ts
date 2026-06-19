import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_MODE, resolveThemeMode } from './theme'

describe('theme helpers', () => {
  it('defaults to light for missing or unsupported values', () => {
    expect(DEFAULT_THEME_MODE).toBe('light')
    expect(resolveThemeMode(null)).toBe('light')
    expect(resolveThemeMode(undefined)).toBe('light')
    expect(resolveThemeMode('auto')).toBe('light')
    expect(resolveThemeMode('system')).toBe('light')
  })

  it('accepts only light and dark values', () => {
    expect(resolveThemeMode('light')).toBe('light')
    expect(resolveThemeMode('dark')).toBe('dark')
  })
})
