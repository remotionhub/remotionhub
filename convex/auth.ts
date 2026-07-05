import GitHub from '@auth/core/providers/github'
import { convexAuth } from '@convex-dev/auth/server'
import type { GenericMutationCtx } from 'convex/server'
import { internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import type { Id } from './_generated/dataModel'

type AuthProfile = Record<string, unknown> & {
  email?: string
  phone?: string
  emailVerified?: boolean
  phoneVerified?: boolean
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

function userDataFromAuthProfile(args: {
  provider: { type: string; allowDangerousEmailAccountLinking?: boolean }
  profile: AuthProfile
}) {
  const profile = { ...args.profile }
  delete profile.id

  const {
    emailVerified: profileEmailVerified,
    phoneVerified: profilePhoneVerified,
    ...profileData
  } = profile
  const emailVerified =
    profileEmailVerified ??
    ((args.provider.type === 'oauth' || args.provider.type === 'oidc') &&
      args.provider.allowDangerousEmailAccountLinking !== false)
  const phoneVerified = profilePhoneVerified ?? false

  return {
    ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
    ...profileData,
  }
}

async function schedulePostUserCreatedOrUpdated(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<'users'>,
) {
  await ctx.scheduler.runAfter(0, internal.users.ensurePersonalPublisherInternal, {
    userId,
  })
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createGitHubAuthProvider()],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
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
  },
})
