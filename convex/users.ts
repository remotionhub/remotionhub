import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
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

async function choosePersonalPublisherHandle(
  ctx: Pick<MutationCtx, 'db'>,
  user: UserDoc,
) {
  const userIdText = user._id.toString()
  const preferredBase =
    normalizeHandleCandidate(user.handle) ??
    normalizeHandleCandidate(user.name)
  const fallback = fallbackHandleForUserId(userIdText)
  const base = preferredBase ?? fallback
  const existingBase = await getPublisherByHandle(ctx, base)
  if (!existingBase || existingBase.linkedUserId === user._id) return base

  const suffix = userIdText
    .replace(/^[^:]+:/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase()
  const suffixedBase =
    preferredBase ?? fallback.slice(0, Math.max(2, 30 - suffix.length))
  return `${suffixedBase.slice(0, Math.max(2, 30 - suffix.length))}-${suffix}`
}

async function ensurePersonalPublisher(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  if (user.personalPublisherId) {
    const publisher = await ctx.db.get(user.personalPublisherId)
    if (publisher) {
      await ctx.db.patch(publisher._id, {
        displayName: displayNameForUser(user),
        imageUrl: imageUrlForUser(user),
        kind: publisher.kind ?? 'user',
        linkedUserId: publisher.linkedUserId ?? userId,
        updatedAt: Date.now(),
      })
      return publisher._id
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
    kind: 'user',
    linkedUserId: userId,
    handle,
    displayName: displayNameForUser(user),
    imageUrl: imageUrlForUser(user),
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.patch(userId, {
    handle: user.handle ?? handle,
    displayName: user.displayName ?? displayNameForUser(user),
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

export const getByIdInternal = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})
