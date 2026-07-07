import { describe, expect, it, vi } from 'vitest'
import {
  createGitHubAuthProvider,
  normalizeGitHubProfileId,
  userDataFromAuthProfile,
} from './auth'

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

describe('userDataFromAuthProfile', () => {
  it('allowlists only business user fields from the auth profile', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T00:00:00Z'))

    expect(
      userDataFromAuthProfile({
        provider: {
          type: 'oauth',
          allowDangerousEmailAccountLinking: false,
        },
        profile: {
          id: '123456',
          name: 'Octocat',
          email: 'octocat@example.com',
          image: 'https://example.com/avatar.png',
          phone: '+1234567890',
          emailVerified: true,
          phoneVerified: true,
          role: 'admin',
          isAnonymous: true,
          customClaim: 'ignored',
        },
      }),
    ).toEqual({
      name: 'Octocat',
      email: 'octocat@example.com',
      image: 'https://example.com/avatar.png',
      phone: '+1234567890',
      emailVerificationTime: Date.now(),
      phoneVerificationTime: Date.now(),
    })

    vi.useRealTimers()
  })
})
