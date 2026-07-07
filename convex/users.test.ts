import { convexTest } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
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

    await expect(t.query(api.users.me, {})).resolves.toBeNull()
  })

  it('returns the current active user from me', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'WeChat User',
        handle: 'wechat-user',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const me = await t.query(api.users.me, {})

    expect(me?._id).toBe(userId)
    expect(me?.handle).toBe('wechat-user')
  })

  it('ensures one personal publisher for the authenticated user', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'WeChat User',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })
    vi.mocked(getAuthUserId).mockResolvedValue(userId)

    const first = await t.mutation(api.users.ensure, {})
    const second = await t.mutation(api.users.ensure, {})

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
        handle: 'wechat-user',
        displayName: 'Existing Publisher',
        createdAt: 1,
        updatedAt: 1,
      })
      return await ctx.db.insert('users', {
        name: 'WeChat User',
        handle: 'wechat-user',
        role: 'user',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await t.mutation(internal.users.ensurePersonalPublisherInternal, { userId })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    const publisher = await t.run(
      async (ctx) =>
        await ctx.db.get(user?.personalPublisherId as Id<'publishers'>),
    )
    expect(publisher?.handle).toMatch(/^wechat-user-[a-z0-9]{8}$/)
    expect(publisher?.linkedUserId).toBe(userId)
  })
})
