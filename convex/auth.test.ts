import { describe, expect, it } from 'vitest'
import { createGitHubAuthProvider, normalizeGitHubProfileId } from './auth'

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

describe('createGitHubAuthProvider', () => {
  const provider = createGitHubAuthProvider()

  it('fails closed when the GitHub profile id is missing', () => {
    expect(() =>
      provider.profile({
        login: 'octocat',
        email: 'octocat@example.com',
        avatar_url: 'https://example.com/avatar.png',
      } as never),
    ).toThrow(/missing a valid numeric id/)
  })

  it('fails closed when the GitHub profile id is malformed', () => {
    expect(() =>
      provider.profile({
        id: 'octocat',
        login: 'octocat',
        email: 'octocat@example.com',
        avatar_url: 'https://example.com/avatar.png',
      } as never),
    ).toThrow(/missing a valid numeric id/)
  })

  it('normalizes valid numeric GitHub profile ids', () => {
    expect(
      provider.profile({
        id: 123456,
        login: 'octocat',
        email: 'octocat@example.com',
        avatar_url: 'https://example.com/avatar.png',
      } as never),
    ).toEqual({
      id: '123456',
      name: 'octocat',
      email: 'octocat@example.com',
      image: 'https://example.com/avatar.png',
    })
  })
})
