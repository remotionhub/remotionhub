import GitHub from '@auth/core/providers/github'
import WeChat from '@auth/core/providers/wechat'
import { convexAuth } from '@convex-dev/auth/server'
import { anyApi, type GenericMutationCtx } from 'convex/server'
import type { DataModel } from './_generated/dataModel'
import type { Id } from './_generated/dataModel'

type AuthProfile = Record<string, unknown> & {
  email?: string
  phone?: string
  emailVerified?: boolean
  phoneVerified?: boolean
}

export type WeChatProfileLike = {
  openid?: unknown
  unionid?: unknown
  nickname?: unknown
  headimgurl?: unknown
}

function normalizedString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeWeChatProviderAccountId(
  profile: WeChatProfileLike,
  options: { appId?: string } = {},
) {
  const openid = normalizedString(profile.openid)
  if (!openid) {
    throw new Error(
      'WeChat OAuth profile is missing a stable WebsiteApp openid',
    )
  }

  const appId = normalizedString(options.appId)
  if (!appId) {
    throw new Error('WeChat WebsiteApp openid requires a WeChat app id')
  }
  return `wechat:web:${appId}:${openid}`
}

export function normalizeGitHubProfileId(profileId: unknown) {
  const id =
    typeof profileId === 'number' && Number.isSafeInteger(profileId)
      ? String(profileId)
      : typeof profileId === 'string'
        ? profileId.trim()
        : null

  if (!id || !/^\d+$/.test(id)) {
    throw new Error('GitHub OAuth profile is missing a valid numeric id')
  }

  return id
}

export function createGitHubAuthProvider() {
  const provider = GitHub({
    clientId: process.env.AUTH_GITHUB_ID ?? '',
    clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    allowDangerousEmailAccountLinking: false,
  })

  return {
    ...provider,
    profile(profile: { id?: unknown; login: string; email?: string | null; avatar_url: string }) {
      return {
        id: normalizeGitHubProfileId(profile.id),
        name: profile.login,
        email: profile.email ?? undefined,
        image: profile.avatar_url,
      }
    },
  }
}

export function createWeChatAuthProvider() {
  const appId = process.env.AUTH_WECHAT_ID ?? ''
  return WeChat({
    clientId: appId,
    clientSecret: process.env.AUTH_WECHAT_SECRET ?? '',
    allowDangerousEmailAccountLinking: false,
    platformType: 'WebsiteApp',
    profile(profile) {
      return {
        id: normalizeWeChatProviderAccountId(profile, {
          appId,
        }),
        name: normalizedString(profile.nickname) ?? 'WeChat User',
        email: null,
        image: normalizedString(profile.headimgurl) ?? undefined,
      }
    },
  })
}

export function normalizeRelativeRedirectTo(redirectTo: string) {
  const trimmed = redirectTo.trim()
  if (!trimmed) return '/'
  if (/[\\\u0000-\u001F\u007F]/.test(trimmed)) return '/'
  if (/%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i.test(trimmed)) return '/'
  if (trimmed.startsWith('?')) return trimmed
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  return '/'
}

function getAuthSiteUrl() {
  const siteUrl = normalizedString(process.env.SITE_URL)
  if (!siteUrl) {
    throw new Error('Convex Auth redirect callback requires SITE_URL')
  }
  return siteUrl
}

export function createAbsoluteRedirectUrl(
  redirectTo: string,
  options: { siteUrl?: string } = {},
) {
  return new URL(
    normalizeRelativeRedirectTo(redirectTo),
    options.siteUrl ?? getAuthSiteUrl(),
  ).toString()
}

export function userDataFromAuthProfile(args: {
  provider: { type: string; allowDangerousEmailAccountLinking?: boolean }
  profile: AuthProfile
}) {
  const {
    name,
    email,
    image,
    phone,
    emailVerified: profileEmailVerified,
    phoneVerified: profilePhoneVerified,
  } = args.profile
  const emailVerified = profileEmailVerified === true
  const phoneVerified = profilePhoneVerified === true

  return {
    ...(typeof name === 'string' ? { name } : null),
    ...(typeof email === 'string' ? { email } : null),
    ...(typeof image === 'string' ? { image } : null),
    ...(typeof phone === 'string' ? { phone } : null),
    ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
  }
}

async function schedulePostUserCreatedOrUpdated(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<'users'>,
) {
  await ctx.scheduler.runAfter(0, anyApi.users.ensurePersonalPublisherInternal, {
    userId,
  })
}

type ConvexAuthCallbacks = NonNullable<
  Parameters<typeof convexAuth>[0]['callbacks']
>

export const authCallbacks = {
  async redirect({ redirectTo }: { redirectTo: string }) {
    return createAbsoluteRedirectUrl(redirectTo)
  },
  async createOrUpdateUser(ctx, args) {
    const userData = userDataFromAuthProfile(args)
    if (args.existingUserId !== null) {
      const userId = args.existingUserId as Id<'users'>
      await ctx.db.patch(userId, { ...userData, updatedAt: Date.now() })
      await schedulePostUserCreatedOrUpdated(ctx, userId)
      return userId
    }

    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      ...userData,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    })
    await schedulePostUserCreatedOrUpdated(ctx, userId)
    return userId
  },
} satisfies ConvexAuthCallbacks

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createGitHubAuthProvider(), createWeChatAuthProvider()],
  callbacks: authCallbacks,
})
