import { convexTest } from 'convex-test'
import { anyApi } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { Id } from './_generated/dataModel'
import schema from './schema'

vi.mock('@convex-dev/auth/server', async () => {
  const actual = await vi.importActual<typeof import('@convex-dev/auth/server')>(
    '@convex-dev/auth/server',
  )
  return {
    ...actual,
    getAuthUserId: vi.fn(),
  }
})

const { getAuthUserId } = await import('@convex-dev/auth/server')
const modules = import.meta.glob('./**/*.*s')

describe('users auth queries and publisher bootstrap', () => {
  it('returns null from me when signed out', async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null)
    const t = convexTest(schema, modules)

    await expect(t.query(anyApi.users.me, {})).resolves.toBeNull()
  })

  it('returns the current active user from me', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Octocat',
        handle: 'octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const me = await t.query(anyApi.users.me, {})

    expect(me?._id).toBe(userId)
    expect(me?.handle).toBe('octocat')
  })

  it('ensures one personal publisher for the authenticated user', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const first = await t.mutation(anyApi.users.ensure, {})
    const second = await t.mutation(anyApi.users.ensure, {})

    expect(first.publisherId).toBe(second.publisherId)
    const publishers = await t.run(async (ctx) => {
      return await ctx.db.query('publishers').collect()
    })
    expect(publishers).toHaveLength(1)
    expect(publishers[0]?.kind).toBe('user')
    expect(publishers[0]?.linkedUserId).toBe(userId)
  })

  it('uses a fallback handle when the preferred handle is taken', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      await ctx.db.insert('publishers', {
        handle: 'octocat',
        displayName: 'Existing Octocat',
        createdAt: 1,
        updatedAt: 1,
      })
      return await ctx.db.insert('users', {
        name: 'Octocat',
        handle: 'octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    const publisher = await t.run(
      async (ctx) =>
        await ctx.db.get(user?.personalPublisherId as Id<'publishers'>),
    )
    expect(publisher?.handle).toMatch(/^octocat-[a-z0-9]{8}$/)
    expect(publisher?.linkedUserId).toBe(userId)
    expect(user?.handle).toBe(publisher?.handle)
  })

  it('keeps searching when the first fallback handle is also taken', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Octocat',
        handle: 'octocat',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    const suffix = userId
      .toString()
      .replace(/^[^:]+:/, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8)
      .toLowerCase()

    await t.run(async (ctx) => {
      await ctx.db.insert('publishers', {
        handle: 'octocat',
        displayName: 'Existing Octocat',
        createdAt: 1,
        updatedAt: 1,
      })
      await ctx.db.insert('publishers', {
        handle: `octocat-${suffix}`,
        displayName: 'Existing Suffixed Octocat',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    const publisher = await t.run(
      async (ctx) =>
        await ctx.db.get(user?.personalPublisherId as Id<'publishers'>),
    )

    expect(publisher?.handle).toBe(`octocat-${suffix}-2`)
    expect(publisher?.linkedUserId).toBe(userId)
    expect(user?.handle).toBe(publisher?.handle)
  })

  it('uses the fallback handle when the preferred handle is reserved', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'API',
        handle: 'api',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    const publisher = await t.run(
      async (ctx) =>
        await ctx.db.get(user?.personalPublisherId as Id<'publishers'>),
    )

    expect(publisher?.handle).toMatch(/^user-[a-z0-9]{8}$/)
    expect(publisher?.linkedUserId).toBe(userId)
    expect(user?.handle).toBe(publisher?.handle)
  })

  it('does not reuse a non-personal publisher handle linked to the user', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        name: 'Team Owner',
        handle: 'team-owner',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
      await ctx.db.insert('publishers', {
        handle: 'team-owner',
        displayName: 'Team Owner Org',
        kind: 'org',
        linkedUserId: userId,
        createdAt: 1,
        updatedAt: 1,
      })
      return userId
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const { user, publishers } = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const publishers = await ctx.db.query('publishers').collect()
      return { user, publishers }
    })

    expect(publishers.map((publisher) => publisher.handle)).toContain(
      'team-owner',
    )
    expect(
      publishers.find((publisher) => publisher.kind === 'user')?.handle,
    ).toMatch(/^team-owner-[a-z0-9]{8}$/)
    expect(user?.handle).toMatch(/^team-owner-[a-z0-9]{8}$/)
  })

  it("does not patch another user's personal publisher", async () => {
    const t = convexTest(schema, modules)
    const { currentUserId, otherPublisherId } = await t.run(async (ctx) => {
      const otherUserId = await ctx.db.insert('users', {
        name: 'Other User',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
      const otherPublisherId = await ctx.db.insert('publishers', {
        handle: 'other-user',
        displayName: 'Other User',
        imageUrl: 'https://example.com/other.png',
        kind: 'user',
        linkedUserId: otherUserId,
        createdAt: 1,
        updatedAt: 1,
      })
      const currentUserId = await ctx.db.insert('users', {
        name: 'Current User',
        image: 'https://example.com/current.png',
        role: 'user',
        personalPublisherId: otherPublisherId,
        createdAt: 1,
        updatedAt: 1,
      })
      return { currentUserId, otherPublisherId }
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, {
      userId: currentUserId,
    })

    const { currentUser, currentPublisher, otherPublisher, publishers } =
      await t.run(async (ctx) => {
        const currentUser = await ctx.db.get(currentUserId)
        const currentPublisher = currentUser?.personalPublisherId
          ? await ctx.db.get(currentUser.personalPublisherId)
          : null
        const otherPublisher = await ctx.db.get(otherPublisherId)
        const publishers = await ctx.db.query('publishers').collect()
        return { currentUser, currentPublisher, otherPublisher, publishers }
      })

    expect(currentUser?.personalPublisherId).not.toBe(otherPublisherId)
    expect(currentPublisher?.linkedUserId).toBe(currentUserId)
    expect(currentPublisher?.kind).toBe('user')
    expect(currentPublisher?.displayName).toBe('Current User')
    expect(currentPublisher?.imageUrl).toBe('https://example.com/current.png')
    expect(otherPublisher).toMatchObject({
      _id: otherPublisherId,
      linkedUserId: otherPublisher?.linkedUserId,
      kind: 'user',
      displayName: 'Other User',
      imageUrl: 'https://example.com/other.png',
    })
    expect(publishers).toHaveLength(2)
  })

  it.each(['org', 'system'] as const)(
    'does not reuse a %s publisher as a personal publisher',
    async (publisherKind) => {
      const t = convexTest(schema, modules)
      const { userId, existingPublisherId } = await t.run(async (ctx) => {
        const existingPublisherId = await ctx.db.insert('publishers', {
          handle: `${publisherKind}-publisher`,
          displayName: `${publisherKind} publisher`,
          kind: publisherKind,
          createdAt: 1,
          updatedAt: 1,
        })
        const userId = await ctx.db.insert('users', {
          name: 'Current User',
          role: 'user',
          personalPublisherId: existingPublisherId,
          createdAt: 1,
          updatedAt: 1,
        })
        return { userId, existingPublisherId }
      })

      await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

      const { user, personalPublisher, existingPublisher, publishers } =
        await t.run(async (ctx) => {
          const user = await ctx.db.get(userId)
          const personalPublisher = user?.personalPublisherId
            ? await ctx.db.get(user.personalPublisherId)
            : null
          const existingPublisher = await ctx.db.get(existingPublisherId)
          const publishers = await ctx.db.query('publishers').collect()
          return { user, personalPublisher, existingPublisher, publishers }
        })

      expect(user?.personalPublisherId).not.toBe(existingPublisherId)
      expect(personalPublisher?.linkedUserId).toBe(userId)
      expect(personalPublisher?.kind).toBe('user')
      expect(existingPublisher?.kind).toBe(publisherKind)
      expect(existingPublisher?.linkedUserId).toBeUndefined()
      expect(publishers).toHaveLength(2)
    },
  )

  it('repairs linked personal publisher profile fields and kind', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        name: 'Current User',
        displayName: 'Current Display Name',
        image: 'https://example.com/current.png',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
      await ctx.db.insert('publishers', {
        handle: 'current-user',
        displayName: 'Stale Publisher Name',
        imageUrl: 'https://example.com/stale.png',
        linkedUserId: userId,
        createdAt: 1,
        updatedAt: 1,
      })
      return userId
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const { user, publisher } = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const publisher = user?.personalPublisherId
        ? await ctx.db.get(user.personalPublisherId)
        : null
      return { user, publisher }
    })

    expect(publisher?.linkedUserId).toBe(userId)
    expect(publisher?.kind).toBe('user')
    expect(publisher?.displayName).toBe('Current Display Name')
    expect(publisher?.imageUrl).toBe('https://example.com/current.png')
    expect(user?.personalPublisherId).toBe(publisher?._id)
  })

  it('repairs unlinked legacy personal publisher fields through personalPublisherId', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        name: 'Current User',
        displayName: 'Current Display Name',
        image: 'https://example.com/current.png',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
      const publisherId = await ctx.db.insert('publishers', {
        handle: 'current-user',
        displayName: 'Stale Publisher Name',
        imageUrl: 'https://example.com/stale.png',
        createdAt: 1,
        updatedAt: 1,
      })
      await ctx.db.patch(userId, {
        personalPublisherId: publisherId,
      })
      return userId
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const { user, publisher } = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const publisher = user?.personalPublisherId
        ? await ctx.db.get(user.personalPublisherId)
        : null
      return { user, publisher }
    })

    expect(publisher?.linkedUserId).toBe(userId)
    expect(publisher?.kind).toBe('user')
    expect(publisher?.displayName).toBe('Current Display Name')
    expect(publisher?.imageUrl).toBe('https://example.com/current.png')
    expect(user?.personalPublisherId).toBe(publisher?._id)
  })

  it('does not write an already synchronized personal publisher', async () => {
    const t = convexTest(schema, modules)
    const { userId, publisherId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        name: 'Current User',
        displayName: 'Current User',
        handle: 'current-user',
        image: 'https://example.com/current.png',
        role: 'user',
        createdAt: 1,
        updatedAt: 10,
      })
      const publisherId = await ctx.db.insert('publishers', {
        handle: 'current-user',
        displayName: 'Current User',
        imageUrl: 'https://example.com/current.png',
        kind: 'user',
        linkedUserId: userId,
        createdAt: 1,
        updatedAt: 10,
      })
      await ctx.db.patch(userId, {
        personalPublisherId: publisherId,
      })
      return { userId, publisherId }
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const { user, publisher } = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const publisher = await ctx.db.get(publisherId)
      return { user, publisher }
    })

    expect(user?.updatedAt).toBe(10)
    expect(publisher?.updatedAt).toBe(10)
  })

  it("does not patch another user's personal publisher", async () => {
    const t = convexTest(schema, modules)
    const { currentUserId, otherPublisherId } = await t.run(async (ctx) => {
      const otherUserId = await ctx.db.insert('users', {
        name: 'Other User',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
      const otherPublisherId = await ctx.db.insert('publishers', {
        handle: 'other-user',
        displayName: 'Other User',
        imageUrl: 'https://example.com/other.png',
        kind: 'user',
        linkedUserId: otherUserId,
        createdAt: 1,
        updatedAt: 1,
      })
      const currentUserId = await ctx.db.insert('users', {
        name: 'Current User',
        image: 'https://example.com/current.png',
        role: 'user',
        personalPublisherId: otherPublisherId,
        createdAt: 1,
        updatedAt: 1,
      })
      return { currentUserId, otherPublisherId }
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, {
      userId: currentUserId,
    })

    const { currentUser, currentPublisher, otherPublisher, publishers } =
      await t.run(async (ctx) => {
        const currentUser = await ctx.db.get(currentUserId)
        const currentPublisher = currentUser?.personalPublisherId
          ? await ctx.db.get(currentUser.personalPublisherId)
          : null
        const otherPublisher = await ctx.db.get(otherPublisherId)
        const publishers = await ctx.db.query('publishers').collect()
        return { currentUser, currentPublisher, otherPublisher, publishers }
      })

    expect(currentUser?.personalPublisherId).not.toBe(otherPublisherId)
    expect(currentPublisher?.linkedUserId).toBe(currentUserId)
    expect(currentPublisher?.kind).toBe('user')
    expect(currentPublisher?.displayName).toBe('Current User')
    expect(currentPublisher?.imageUrl).toBe('https://example.com/current.png')
    expect(otherPublisher).toMatchObject({
      _id: otherPublisherId,
      linkedUserId: otherPublisher?.linkedUserId,
      kind: 'user',
      displayName: 'Other User',
      imageUrl: 'https://example.com/other.png',
    })
    expect(publishers).toHaveLength(2)
  })

  it.each(['org', 'system'] as const)(
    'does not reuse a %s publisher as a personal publisher',
    async (publisherKind) => {
      const t = convexTest(schema, modules)
      const { userId, existingPublisherId } = await t.run(async (ctx) => {
        const existingPublisherId = await ctx.db.insert('publishers', {
          handle: `${publisherKind}-publisher`,
          displayName: `${publisherKind} publisher`,
          kind: publisherKind,
          createdAt: 1,
          updatedAt: 1,
        })
        const userId = await ctx.db.insert('users', {
          name: 'Current User',
          role: 'user',
          personalPublisherId: existingPublisherId,
          createdAt: 1,
          updatedAt: 1,
        })
        return { userId, existingPublisherId }
      })

      await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

      const { user, personalPublisher, existingPublisher, publishers } =
        await t.run(async (ctx) => {
          const user = await ctx.db.get(userId)
          const personalPublisher = user?.personalPublisherId
            ? await ctx.db.get(user.personalPublisherId)
            : null
          const existingPublisher = await ctx.db.get(existingPublisherId)
          const publishers = await ctx.db.query('publishers').collect()
          return { user, personalPublisher, existingPublisher, publishers }
        })

      expect(user?.personalPublisherId).not.toBe(existingPublisherId)
      expect(personalPublisher?.linkedUserId).toBe(userId)
      expect(personalPublisher?.kind).toBe('user')
      expect(existingPublisher?.kind).toBe(publisherKind)
      expect(existingPublisher?.linkedUserId).toBeUndefined()
      expect(publishers).toHaveLength(2)
    },
  )

  it('repairs linked personal publisher profile fields and kind', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        name: 'Current User',
        displayName: 'Current Display Name',
        image: 'https://example.com/current.png',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
      await ctx.db.insert('publishers', {
        handle: 'current-user',
        displayName: 'Stale Publisher Name',
        imageUrl: 'https://example.com/stale.png',
        linkedUserId: userId,
        createdAt: 1,
        updatedAt: 1,
      })
      return userId
    })

    await t.mutation(anyApi.users.ensurePersonalPublisherInternal, { userId })

    const { user, publisher } = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const publisher = user?.personalPublisherId
        ? await ctx.db.get(user.personalPublisherId)
        : null
      return { user, publisher }
    })

    expect(publisher?.linkedUserId).toBe(userId)
    expect(publisher?.kind).toBe('user')
    expect(publisher?.displayName).toBe('Current Display Name')
    expect(publisher?.imageUrl).toBe('https://example.com/current.png')
    expect(user?.personalPublisherId).toBe(publisher?._id)
  })
})
