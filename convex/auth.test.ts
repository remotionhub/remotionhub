import { convexTest } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import {
  authCallbacks,
  createAbsoluteRedirectUrl,
  createGitHubAuthProvider,
  createWeChatAuthProvider,
  normalizeGitHubProfileId,
  normalizeRelativeRedirectTo,
  normalizeWeChatProviderAccountId,
  userDataFromAuthProfile,
} from './auth'

const modules = import.meta.glob('./**/*.ts')

describe('create auth providers', () => {
  it('keeps GitHub and WeChat as independent providers', () => {
    expect(createGitHubAuthProvider().id).toBe('github')
    expect(createWeChatAuthProvider().id).toBe('wechat')
  })
})

describe('OAuth account isolation', () => {
  it('keeps same-email GitHub and WeChat accounts independent', async () => {
    const t = convexTest(schema, modules)
    const email = 'shared@example.com'

    for (const provider of ['github', 'wechat'] as const) {
      const verifier = await t.mutation(internal.auth.store, {
        args: { type: 'verifier' },
      })
      if (typeof verifier !== 'string') {
        throw new Error('Expected an OAuth verifier id')
      }
      const signature = `signature-${provider}`
      await t.mutation(internal.auth.store, {
        args: {
          type: 'verifierSignature',
          verifier,
          signature,
        },
      })
      await t.mutation(internal.auth.store, {
        args: {
          type: 'userOAuth',
          provider,
          providerAccountId: `${provider}-account`,
          profile: { email, emailVerified: true },
          signature,
        },
      })
    }

    const records = await t.run(async (ctx) => ({
      users: await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', email))
        .collect(),
      accounts: await ctx.db.query('authAccounts').collect(),
    }))

    expect(records.users).toHaveLength(2)
    expect(records.accounts).toHaveLength(2)
    expect(new Set(records.accounts.map((account) => account.userId)).size).toBe(
      2,
    )
    expect(records.accounts.map((account) => account.provider).sort()).toEqual([
      'github',
      'wechat',
    ])
  })
})

describe('normalizeWeChatProviderAccountId', () => {
  it('keeps the WebsiteApp openid stable when unionid later appears', () => {
    expect(
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123', unionid: 'unionid-456' },
        { appId: 'wx-test-app' },
      ),
    ).toBe('wechat:web:wx-test-app:openid-123')
  })

  it('rejects unionid-only profiles to prevent identity switching', () => {
    expect(() =>
      normalizeWeChatProviderAccountId(
        { unionid: 'unionid-456' },
        { appId: 'wx-test-app' },
      ),
    ).toThrow(/missing a stable WebsiteApp openid/)
  })

  it('rejects openid without an app namespace', () => {
    expect(() =>
      normalizeWeChatProviderAccountId(
        { openid: 'openid-123' },
      ),
    ).toThrow(/requires a WeChat app id/)
  })

  it('rejects profiles without a stable WebsiteApp openid', () => {
    expect(() => normalizeWeChatProviderAccountId({})).toThrow(
      /missing a stable WebsiteApp openid/,
    )
  })
})

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

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

describe('userDataFromAuthProfile verification', () => {
  it('does not infer verification from an OAuth provider', () => {
    expect(
      userDataFromAuthProfile({
        provider: { type: 'oauth', allowDangerousEmailAccountLinking: true },
        profile: { email: 'user@example.com' },
      }),
    ).toEqual({ email: 'user@example.com' })
  })
})

describe('normalizeRelativeRedirectTo', () => {
  it('keeps safe relative redirects', () => {
    expect(normalizeRelativeRedirectTo('/remotion?tag=card#top')).toBe(
      '/remotion?tag=card#top',
    )
    expect(normalizeRelativeRedirectTo('?tab=security')).toBe('?tab=security')
  })

  it('rejects external and escaped redirects', () => {
    expect(normalizeRelativeRedirectTo('https://evil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('//evil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('/\\\\evil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('/%2f%2fevil.example/path')).toBe('/')
    expect(normalizeRelativeRedirectTo('/safe\ndanger')).toBe('/')
  })
})

describe('authCallbacks.redirect', () => {
  it('uses SITE_URL and rejects external redirect targets', async () => {
    const previous = process.env.SITE_URL
    process.env.SITE_URL = 'https://remotionhub.ai'

    await expect(
      authCallbacks.redirect({ redirectTo: '/account/settings' }),
    ).resolves.toBe('https://remotionhub.ai/account/settings')
    await expect(
      authCallbacks.redirect({ redirectTo: 'https://evil.example/path' }),
    ).resolves.toBe('https://remotionhub.ai/')

    restoreEnv('SITE_URL', previous)
  })

  it('requires SITE_URL for final app redirects', async () => {
    const previous = process.env.SITE_URL
    delete process.env.SITE_URL

    await expect(
      authCallbacks.redirect({ redirectTo: '/account/settings' }),
    ).rejects.toThrow(/requires SITE_URL/)

    restoreEnv('SITE_URL', previous)
  })
})

describe('createAbsoluteRedirectUrl', () => {
  it('supports an explicit site URL in tests', () => {
    expect(
      createAbsoluteRedirectUrl('/account/settings', {
        siteUrl: 'https://preview.remotionhub.ai/base',
      }),
    ).toBe('https://preview.remotionhub.ai/account/settings')
  })
})
