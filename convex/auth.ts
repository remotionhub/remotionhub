import WeChat from '@auth/core/providers/wechat'
import { convexAuth } from '@convex-dev/auth/server'
import type { Id } from './_generated/dataModel'

type AuthProfile = Record<string, unknown> & {
  email?: string | null
  phone?: string | null
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
  options: { allowOpenIdFallback?: boolean; appId?: string } = {},
) {
  const unionid = normalizedString(profile.unionid)
  if (unionid) return unionid

  const openid = normalizedString(profile.openid)
  if (openid && options.allowOpenIdFallback) {
    const appId = normalizedString(options.appId)
    if (!appId) {
      throw new Error('WeChat openid fallback requires a WeChat app id')
    }
    return `wechat:web:${appId}:${openid}`
  }

  throw new Error('WeChat OAuth profile is missing a stable WeChat account id')
}

function profileName(profile: WeChatProfileLike) {
  return normalizedString(profile.nickname) ?? 'WeChat User'
}

function profileImage(profile: WeChatProfileLike) {
  return normalizedString(profile.headimgurl) ?? undefined
}

export function createWeChatAuthProvider() {
  const appId = process.env.AUTH_WECHAT_ID ?? ''
  return WeChat({
    clientId: appId,
    clientSecret: process.env.AUTH_WECHAT_SECRET ?? '',
    platformType: 'WebsiteApp',
    profile(profile) {
      return {
        id: normalizeWeChatProviderAccountId(profile, {
          allowOpenIdFallback: true,
          appId,
        }),
        name: profileName(profile),
        email: null,
        image: profileImage(profile),
      }
    },
  })
}

function userDataFromAuthProfile(args: {
  provider: { type: string; allowDangerousEmailAccountLinking?: boolean }
  profile: AuthProfile
}) {
  const {
    emailVerified: profileEmailVerified,
    phoneVerified: profilePhoneVerified,
    ...profile
  } = args.profile
  const emailVerified =
    profileEmailVerified ??
    ((args.provider.type === 'oauth' || args.provider.type === 'oidc') &&
      args.provider.allowDangerousEmailAccountLinking !== false)
  const phoneVerified = profilePhoneVerified ?? false

  return {
    ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
    ...profile,
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createWeChatAuthProvider()],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const userData = userDataFromAuthProfile(args)
      if (args.existingUserId !== null) {
        const userId = args.existingUserId as Id<'users'>
        await ctx.db.patch(userId, {
          ...userData,
          updatedAt: Date.now(),
        })
        return userId
      }

      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        ...userData,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      })
      return userId
    },
  },
})
