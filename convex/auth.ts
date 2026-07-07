import WeChat from '@auth/core/providers/wechat'
import { convexAuth } from '@convex-dev/auth/server'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'

type AuthProfile = Record<string, unknown> & {
  email?: string | null
  phone?: string | null
  emailVerified?: boolean
  phoneVerified?: boolean
}

type UserProfileData = {
  name?: string
  image?: string
  email?: string
  phone?: string
  isAnonymous?: boolean
  handle?: string
  displayName?: string
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

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
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

function sanitizeUserProfile(profile: AuthProfile): UserProfileData {
  const userData: UserProfileData = {}

  const name = normalizedString(profile.name)
  if (name) userData.name = name

  const image = normalizedString(profile.image)
  if (image) userData.image = image

  const email = normalizedString(profile.email)
  if (email) userData.email = email

  const phone = normalizedString(profile.phone)
  if (phone) userData.phone = phone

  const handle = normalizedString(profile.handle)
  if (handle) userData.handle = handle

  const displayName = normalizedString(profile.displayName)
  if (displayName) userData.displayName = displayName

  const isAnonymous = optionalBoolean(profile.isAnonymous)
  if (isAnonymous !== undefined) userData.isAnonymous = isAnonymous

  return userData
}

export function userDataFromAuthProfile(args: {
  provider: { type: string; allowDangerousEmailAccountLinking?: boolean }
  profile: AuthProfile
}) {
  const {
    emailVerified: profileEmailVerified,
    phoneVerified: profilePhoneVerified,
  } = args.profile
  const emailVerified = profileEmailVerified === true
  const phoneVerified = profilePhoneVerified === true
  const userProfile = sanitizeUserProfile(args.profile)

  return {
    ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
    ...userProfile,
  }
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

export const authCallbacks = {
  async redirect({ redirectTo }: { redirectTo: string }) {
    return normalizeRelativeRedirectTo(redirectTo)
  },
  async createOrUpdateUser(
    ctx: Parameters<
      NonNullable<
        NonNullable<Parameters<typeof convexAuth>[0]['callbacks']>['createOrUpdateUser']
      >
    >[0],
    args: Parameters<
      NonNullable<
        NonNullable<Parameters<typeof convexAuth>[0]['callbacks']>['createOrUpdateUser']
      >
    >[1],
  ) {
    const userData = userDataFromAuthProfile(args)
    if (args.existingUserId !== null) {
      const userId = args.existingUserId as Id<'users'>
      await ctx.db.patch(userId, {
        ...userData,
        updatedAt: Date.now(),
      })
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
}

async function schedulePostUserCreatedOrUpdated(
  ctx: {
    scheduler: {
      runAfter: (
        delayMs: number,
        functionReference: typeof internal.users.ensurePersonalPublisherInternal,
        args: { userId: Id<'users'> },
      ) => Promise<unknown>
    }
  },
  userId: Id<'users'>,
) {
  await ctx.scheduler.runAfter(0, internal.users.ensurePersonalPublisherInternal, {
    userId,
  })
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createWeChatAuthProvider()],
  callbacks: authCallbacks,
})
