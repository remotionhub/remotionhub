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

function canReuseAsPersonalPublisher(
  publisher: Doc<'publishers'>,
  userId: Id<'users'>,
) {
  if (publisher.linkedUserId !== userId) return false
  return publisher.kind === 'user' || publisher.kind === undefined
}

async function syncPersonalPublisherFromUser(
  ctx: MutationCtx,
  user: UserDoc,
  publisher: Doc<'publishers'>,
) {
  const now = Date.now()

  await ctx.db.patch(publisher._id, {
    displayName: displayNameForUser(user),
    imageUrl: imageUrlForUser(user),
    kind: 'user',
    linkedUserId: user._id,
    updatedAt: now,
  })

  if (user.personalPublisherId !== publisher._id) {
    await ctx.db.patch(user._id, {
      personalPublisherId: publisher._id,
      updatedAt: now,
    })
  }

  return publisher._id
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
  const suffix = userIdText
    .replace(/^[^:]+:/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase()
  const candidates = [
    base,
    ...buildHandleVariants(base, suffix),
  ]

  for (const candidate of candidates) {
    const existing = await getPublisherByHandle(ctx, candidate)
    if (!existing || existing.linkedUserId === user._id) {
      return candidate
    }
  }

  throw new Error('Could not choose a unique personal publisher handle')
}

function buildHandleVariants(base: string, suffix: string) {
  const variants = new Set<string>()
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const tail = attempt === 1 ? suffix : `${suffix}-${attempt}`
    const maxBaseLength = Math.max(2, 39 - tail.length - 1)
    const candidate = `${base.slice(0, maxBaseLength)}-${tail}`
    const normalized = normalizeHandleCandidate(candidate)
    if (normalized) {
      variants.add(normalized)
    }
  }
  return [...variants]
}

async function ensurePersonalPublisher(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  if (user.personalPublisherId) {
    const publisher = await ctx.db.get(user.personalPublisherId)
    if (publisher && canReuseAsPersonalPublisher(publisher, userId)) {
      return await syncPersonalPublisherFromUser(ctx, user, publisher)
    }
  }

  const linkedPublisher = await getPublisherByLinkedUser(ctx, userId)
  if (linkedPublisher && canReuseAsPersonalPublisher(linkedPublisher, userId)) {
    return await syncPersonalPublisherFromUser(ctx, user, linkedPublisher)
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
