import { describe, expect, it } from 'vitest'
import {
  fallbackHandleForUserId,
  normalizeHandleCandidate,
} from './handles'

describe('normalizeHandleCandidate', () => {
  it('normalizes GitHub-style handles', () => {
    expect(normalizeHandleCandidate(' Terence.Dev_01 ')).toBe('terence-dev-01')
  })

  it('rejects empty, non-ascii, and too-short candidates', () => {
    expect(normalizeHandleCandidate('')).toBeNull()
    expect(normalizeHandleCandidate('用户')).toBeNull()
    expect(normalizeHandleCandidate('a')).toBeNull()
  })

  it('trims repeated separators and caps length', () => {
    expect(normalizeHandleCandidate('---Alpha___Beta---')).toBe('alpha-beta')
    expect(normalizeHandleCandidate('a'.repeat(80))).toHaveLength(39)
  })
})

describe('fallbackHandleForUserId', () => {
  it('creates a deterministic public fallback handle', () => {
    expect(fallbackHandleForUserId('users:abcdef1234567890')).toBe(
      'user-abcdef12',
    )
  })
})
