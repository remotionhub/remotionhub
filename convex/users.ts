import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import { getOptionalAuthUserId, requireUser } from './lib/access'
import {
  fallbackHandleForUserId,
  normalizeHandleCandidate,
} from './lib/handles'

type UserDoc = Doc<'users'>

async function getPublisherByHandle(
  ctx: Pick<QueryCtx | MutationCtx, 'db'>,
  handle: string,
) {
  return await ctx.db
    .query('publishers')
    .withIndex('by_handle', (q) => q.eq('handle', handle))
    .unique()
}

async function getPublisherByLinkedUser(
  ctx: Pick<QueryCtx | MutationCtx, 'db'>,
  userId: Id<'users'>,
) {
  return await ctx.db
    .query('publishers')
    .withIndex('by_linked_user', (q) => q.eq('linkedUserId', userId))
    .unique()
}

function displayNameForUser(user: UserDoc) {
  return user.displayName?.trim() || user.name?.trim() || user.handle || 'User'
}

function imageUrlForUser(user: UserDoc) {
  return user.image?.trim() || undefined
}

function shortUserSuffix(userId: Id<'users'>) {
  return fallbackHandleForUserId(userId.toString()).replace(/^user-/, '')
}

async function choosePersonalPublisherHandle(
  ctx: Pick<MutationCtx, 'db'>,
  user: UserDoc,
) {
  const base =
    normalizeHandleCandidate(user.handle) ??
    normalizeHandleCandidate(user.name) ??
    fallbackHandleForUserId(user._id.toString())

  const existing = await getPublisherByHandle(ctx, base)
  if (!existing) return base
  if (existing.linkedUserId === user._id) return base

  const fallbackBase = `${base}-${shortUserSuffix(user._id)}`
  const fallback = fallbackBase.slice(0, 39).replace(/-+$/g, '')
  const fallbackExisting = await getPublisherByHandle(ctx, fallback)
  if (!fallbackExisting || fallbackExisting.linkedUserId === user._id) {
    return fallback
  }

  return fallbackHandleForUserId(user._id.toString())
}

async function ensurePersonalPublisher(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  if (user.personalPublisherId) {
    const existing = await ctx.db.get(user.personalPublisherId)
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: displayNameForUser(user),
        imageUrl: imageUrlForUser(user),
        updatedAt: Date.now(),
      })
      return existing._id
    }
  }

  const linkedPublisher = await getPublisherByLinkedUser(ctx, userId)
  if (linkedPublisher) {
    await ctx.db.patch(userId, {
      personalPublisherId: linkedPublisher._id,
      updatedAt: Date.now(),
    })
    return linkedPublisher._id
  }

  const now = Date.now()
  const handle = await choosePersonalPublisherHandle(ctx, user)
  const publisherId = await ctx.db.insert('publishers', {
    handle,
    displayName: displayNameForUser(user),
    imageUrl: imageUrlForUser(user),
    kind: 'user',
    linkedUserId: userId,
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.patch(userId, {
    handle,
    personalPublisherId: publisherId,
    updatedAt: now,
  })

  return publisherId
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalAuthUserId(ctx)
    if (!userId) return null
    return await ctx.db.get(userId)
  },
})

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const publisherId = await ensurePersonalPublisher(ctx, userId)
    return { publisherId }
  },
})

export const ensurePersonalPublisherInternal = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const publisherId = await ensurePersonalPublisher(ctx, args.userId)
    return { publisherId }
  },
})
