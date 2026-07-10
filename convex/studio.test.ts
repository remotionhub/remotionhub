import { getAuthUserId } from '@convex-dev/auth/server'
import { convexTest } from 'convex-test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
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

const modules = import.meta.glob('./**/*.*s')
const composition = {
  aspectRatio: '16:9' as const,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
}

function useIdentityAuthMock() {
  vi.mocked(getAuthUserId).mockImplementation(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return (identity?.subject as Id<'users'> | undefined) ?? null
  })
}

async function seedStudio() {
  const t = convexTest(schema, modules)
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert('users', {
      name: 'Owner',
      role: 'user',
      createdAt: 1,
      updatedAt: 1,
    })
    const otherUserId = await ctx.db.insert('users', {
      name: 'Other User',
      role: 'user',
      createdAt: 1,
      updatedAt: 1,
    })
    const projectId = await ctx.db.insert('studioProjects', {
      ownerId,
      title: 'Launch animation',
      status: 'active',
      source: { kind: 'prompt' },
      composition,
      createdAt: 10,
      updatedAt: 20,
    })
    const firstRevisionId = await ctx.db.insert('studioRevisions', {
      projectId,
      sequence: 1,
      origin: 'prompt',
      code: 'export const First = () => null',
      codeHash: 'first-hash',
      composition,
      assistantSummary: 'Created the first revision',
      createdAt: 11,
    })
    const secondRevisionId = await ctx.db.insert('studioRevisions', {
      projectId,
      sequence: 2,
      parentRevisionId: firstRevisionId,
      previousRunnableRevisionId: firstRevisionId,
      origin: 'follow-up',
      code: 'export const Second = () => null',
      codeHash: 'second-hash',
      composition,
      assistantSummary: 'Created the second revision',
      createdAt: 12,
    })
    await ctx.db.patch(projectId, {
      currentRevisionId: secondRevisionId,
      lastRunnableRevisionId: secondRevisionId,
    })
    await ctx.db.insert('studioMessages', {
      projectId,
      role: 'user',
      kind: 'prompt',
      content: 'Create a launch animation',
      createdAt: 13,
    })
    await ctx.db.insert('studioMessages', {
      projectId,
      role: 'assistant',
      kind: 'response',
      content: 'Created the animation',
      revisionId: secondRevisionId,
      createdAt: 14,
    })

    const missingProjectId = await ctx.db.insert('studioProjects', {
      ownerId,
      title: 'Deleted project',
      status: 'active',
      source: { kind: 'prompt' },
      composition,
      createdAt: 1,
      updatedAt: 1,
    })
    await ctx.db.delete(missingProjectId)

    return {
      ownerId,
      otherUserId,
      projectId,
      missingProjectId,
      firstRevisionId,
      secondRevisionId,
    }
  })

  return { t, ...fixture }
}

describe('studio ownership and revision history', () => {
  beforeEach(() => {
    useIdentityAuthMock()
  })

  it('lists only projects owned by the authenticated user', async () => {
    const { t, ownerId, otherUserId, projectId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })
    const other = t.withIdentity({ subject: otherUserId })

    const projects = await owner.query(api.studio.listRecentProjects, {
      limit: 10,
    })
    const otherProjects = await other.query(api.studio.listRecentProjects, {
      limit: 10,
    })

    expect(projects.map((project) => project._id)).toEqual([projectId])
    expect(otherProjects).toEqual([])
  })

  it('rejects project reads when unauthenticated', async () => {
    const { t, projectId } = await seedStudio()

    await expect(
      t.query(api.studio.getProject, { projectId }),
    ).rejects.toThrow('Unauthorized')
  })

  it('returns the same unavailable error for missing and foreign projects', async () => {
    const { t, otherUserId, projectId, missingProjectId } = await seedStudio()
    const other = t.withIdentity({ subject: otherUserId })

    await expect(
      other.query(api.studio.getProject, { projectId }),
    ).rejects.toThrow('Studio project unavailable')
    await expect(
      other.query(api.studio.getProject, { projectId: missingProjectId }),
    ).rejects.toThrow('Studio project unavailable')
  })

  it('returns the current project revision', async () => {
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.query(api.studio.getProject, { projectId })

    expect(result.project._id).toBe(projectId)
    expect(result.revision?._id).toBe(secondRevisionId)
    expect(result.run).toBeNull()
  })

  it('returns messages chronologically and revisions newest first', async () => {
    const { t, ownerId, projectId } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const messages = await owner.query(api.studio.listMessages, {
      projectId,
      limit: 1000,
    })
    const revisions = await owner.query(api.studio.listRevisions, {
      projectId,
      limit: 1000,
    })

    expect(messages.map((message) => message.createdAt)).toEqual([13, 14])
    expect(revisions.map((revision) => revision.sequence)).toEqual([2, 1])
  })

  it('protects message and revision history with project ownership', async () => {
    const { t, otherUserId, projectId } = await seedStudio()
    const other = t.withIdentity({ subject: otherUserId })

    await expect(
      other.query(api.studio.listMessages, { projectId, limit: 10 }),
    ).rejects.toThrow('Studio project unavailable')
    await expect(
      other.query(api.studio.listRevisions, { projectId, limit: 10 }),
    ).rejects.toThrow('Studio project unavailable')
  })

  it('rolls back by appending a revision instead of deleting history', async () => {
    const {
      t,
      ownerId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    const result = await owner.mutation(api.studio.rollbackRevision, {
      projectId,
      revisionId: firstRevisionId,
      expectedCurrentRevisionId: secondRevisionId,
    })

    expect(result?.sequence).toBe(3)
    expect(result?.origin).toBe('rollback')
    expect(result?.parentRevisionId).toBe(secondRevisionId)
    expect(result?.previousRunnableRevisionId).toBe(secondRevisionId)
    expect(result?.code).toBe('export const First = () => null')

    const history = await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId)
      const revisions = await ctx.db
        .query('studioRevisions')
        .withIndex('by_project_sequence', (q) => q.eq('projectId', projectId))
        .collect()
      return { project, revisions }
    })
    expect(history.revisions.map((revision) => revision.sequence)).toEqual([
      1, 2, 3,
    ])
    expect(history.project?.currentRevisionId).toBe(result?._id)
    expect(history.project?.lastRunnableRevisionId).toBe(result?._id)
  })

  it('rejects a rollback based on a stale current revision', async () => {
    const {
      t,
      ownerId,
      projectId,
      firstRevisionId,
      secondRevisionId,
    } = await seedStudio()
    const owner = t.withIdentity({ subject: ownerId })

    await expect(
      owner.mutation(api.studio.rollbackRevision, {
        projectId,
        revisionId: firstRevisionId,
        expectedCurrentRevisionId: firstRevisionId,
      }),
    ).rejects.toThrow('Studio project changed')

    const revisions = await owner.query(api.studio.listRevisions, {
      projectId,
      limit: 10,
    })
    expect(revisions.map((revision) => revision._id)).toEqual([
      secondRevisionId,
      firstRevisionId,
    ])
  })

  it('rejects rollback of a revision owned by another project', async () => {
    const { t, ownerId, projectId, secondRevisionId } = await seedStudio()
    const foreignRevisionId = await t.run(async (ctx) => {
      const foreignProjectId = await ctx.db.insert('studioProjects', {
        ownerId,
        title: 'Another project',
        status: 'active',
        source: { kind: 'prompt' },
        composition,
        createdAt: 30,
        updatedAt: 30,
      })
      return await ctx.db.insert('studioRevisions', {
        projectId: foreignProjectId,
        sequence: 1,
        origin: 'prompt',
        code: 'export const Foreign = () => null',
        codeHash: 'foreign-hash',
        composition,
        assistantSummary: 'Created a foreign revision',
        createdAt: 31,
      })
    })
    const owner = t.withIdentity({ subject: ownerId })

    await expect(
      owner.mutation(api.studio.rollbackRevision, {
        projectId,
        revisionId: foreignRevisionId,
        expectedCurrentRevisionId: secondRevisionId,
      }),
    ).rejects.toThrow('Studio revision unavailable')
  })
})
