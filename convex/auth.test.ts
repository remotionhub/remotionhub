import { describe, expect, it } from 'vitest'
import { normalizeGitHubProfileId } from './auth'

describe('normalizeGitHubProfileId', () => {
  it('accepts a numeric GitHub profile id', () => {
    expect(normalizeGitHubProfileId(123456)).toBe('123456')
  })

  it('accepts a numeric string GitHub profile id', () => {
    expect(normalizeGitHubProfileId(' 123456 ')).toBe('123456')
  })

  it('rejects missing and malformed GitHub profile ids', () => {
    expect(() => normalizeGitHubProfileId(undefined)).toThrow(
      /missing a valid numeric id/,
    )
    expect(() => normalizeGitHubProfileId('octocat')).toThrow(
      /missing a valid numeric id/,
    )
    expect(() => normalizeGitHubProfileId(1.5)).toThrow(
      /missing a valid numeric id/,
    )
  })
})
