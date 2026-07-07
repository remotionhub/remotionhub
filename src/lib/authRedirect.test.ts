import { describe, expect, it } from 'vitest'
import { sanitizeRelativeRedirect } from './authRedirect'

describe('sanitizeRelativeRedirect', () => {
  it('keeps relative redirects', () => {
    expect(sanitizeRelativeRedirect('/remotion?tag=card#top')).toBe(
      '/remotion?tag=card#top',
    )
  })

  it('falls back to root for absolute urls', () => {
    expect(sanitizeRelativeRedirect('https://example.com/evil')).toBe('/')
    expect(sanitizeRelativeRedirect('//example.com/evil')).toBe('/')
  })

  it('falls back to root for empty values', () => {
    expect(sanitizeRelativeRedirect(undefined)).toBe('/')
    expect(sanitizeRelativeRedirect('')).toBe('/')
  })
})
