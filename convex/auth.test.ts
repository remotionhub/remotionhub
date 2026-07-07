import { describe, expect, it } from 'vitest'
import {
  authCallbacks,
  normalizeRelativeRedirectTo,
  normalizeWeChatProviderAccountId,
  userDataFromAuthProfile,
} from './auth'

describe('normalizeWeChatProviderAccountId', () => {
  it('prefers unionid when present', () => {
    expect(
      normalizeWeChatProviderAccountId({
        openid: 'openid-123',
        unionid: 'unionid-456',
      }),
    ).toBe('unionid-456')
  })

  it('uses a namespaced openid fallback when explicitly allowed', () => {
    expect(
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true, appId: 'wxabc123' },
      ),
    ).toBe('wechat:web:wxabc123:openid-123')
  })

  it('rejects missing stable identifiers', () => {
    expect(() => normalizeWeChatProviderAccountId({})).toThrow(
      /missing a stable WeChat account id/,
    )
  })

  it('rejects openid fallback without an app id namespace', () => {
    expect(() =>
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
        { allowOpenIdFallback: true },
      ),
    ).toThrow(/requires a WeChat app id/)
  })
})

describe('userDataFromAuthProfile', () => {
  it('keeps only user fields and excludes provider account ids', () => {
    expect(
      userDataFromAuthProfile({
        provider: { type: 'oauth', allowDangerousEmailAccountLinking: true },
        profile: {
          id: 'provider-account-id',
          name: 'WeChat User',
          image: 'https://example.com/avatar.png',
          email: 'user@example.com',
          nickname: 'ignored',
        },
      }),
    ).toEqual({
      name: 'WeChat User',
      image: 'https://example.com/avatar.png',
      email: 'user@example.com',
    })
  })

  it('marks email verified only when the profile explicitly says so', () => {
    const now = Date.now()
    const verified = userDataFromAuthProfile({
      provider: { type: 'oauth', allowDangerousEmailAccountLinking: true },
      profile: {
        email: 'verified@example.com',
        emailVerified: true,
      },
    })
    const linkedButUnverified = userDataFromAuthProfile({
      provider: { type: 'oauth', allowDangerousEmailAccountLinking: true },
      profile: {
        email: 'linked@example.com',
      },
    })

    expect(verified).toEqual({
      email: 'verified@example.com',
      emailVerificationTime: expect.any(Number),
    })
    expect(verified.emailVerificationTime).toBeGreaterThanOrEqual(now)
    expect(linkedButUnverified).toEqual({
      email: 'linked@example.com',
    })
  })
})

describe('normalizeRelativeRedirectTo', () => {
  it('keeps safe relative redirects', () => {
    expect(normalizeRelativeRedirectTo('/dashboard')).toBe('/dashboard')
    expect(normalizeRelativeRedirectTo('?tab=security')).toBe('?tab=security')
  })

  it('falls back to root for absolute or protocol-relative redirects', () => {
    expect(normalizeRelativeRedirectTo('https://remotionhub.ai/dashboard')).toBe(
      '/',
    )
    expect(normalizeRelativeRedirectTo('https://evil.example/phish')).toBe('/')
    expect(normalizeRelativeRedirectTo('//evil.example/phish')).toBe('/')
  })
})

describe('authCallbacks.redirect', () => {
  it('enforces relative-only redirects', async () => {
    await expect(
      authCallbacks.redirect({ redirectTo: '/account/settings' }),
    ).resolves.toBe('/account/settings')
    await expect(
      authCallbacks.redirect({
        redirectTo: 'https://remotionhub.ai/account/settings',
      }),
    ).resolves.toBe('/')
  })
})
