import { describe, expect, it } from 'vitest'
import { sanitizeRelativeRedirect } from './authRedirect'

describe('sanitizeRelativeRedirect', () => {
  it('keeps relative redirects', () => {
    expect(sanitizeRelativeRedirect('/remotion?tag=card#top')).toBe(
      '/remotion?tag=card#top',
    )
    expect(
      sanitizeRelativeRedirect('  /remotion?tag=card#top  '),
    ).toBe('/remotion?tag=card#top')
  })

  it('falls back to root for absolute or dangerous urls', () => {
    expect(sanitizeRelativeRedirect('https://example.com/evil')).toBe('/')
    expect(sanitizeRelativeRedirect('//example.com/evil')).toBe('/')
    expect(sanitizeRelativeRedirect('/\\\\evil.example/path')).toBe('/')
    expect(sanitizeRelativeRedirect('\\\\evil.example/path')).toBe('/')
    expect(sanitizeRelativeRedirect('/%2f%2fevil.example/path')).toBe('/')
    expect(sanitizeRelativeRedirect('/safe\tdanger')).toBe('/')
  })

  it('falls back to root for empty values', () => {
    expect(sanitizeRelativeRedirect(undefined)).toBe('/')
    expect(sanitizeRelativeRedirect('')).toBe('/')
  })
})
