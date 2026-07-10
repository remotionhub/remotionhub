import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireStudioProjectOwner, requireUser } from './lib/access'

export const listRecentProjects = query({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const { userId } = await requireUser(ctx)
    return await ctx.db
      .query('studioProjects')
      .withIndex('by_owner_status_updated', (q) =>
        q.eq('ownerId', userId).eq('status', 'active'),
      )
      .order('desc')
      .take(Math.min(Math.max(limit, 1), 20))
  },
})

export const getProject = query({
  args: { projectId: v.id('studioProjects') },
  handler: async (ctx, { projectId }) => {
    const { project } = await requireStudioProjectOwner(ctx, projectId)
    const revision = project.currentRevisionId
      ? await ctx.db.get(project.currentRevisionId)
      : null
    const run = project.currentRunId
      ? await ctx.db.get(project.currentRunId)
      : null
    return { project, revision, run }
  },
})

export const listMessages = query({
  args: { projectId: v.id('studioProjects'), limit: v.number() },
  handler: async (ctx, { projectId, limit }) => {
    await requireStudioProjectOwner(ctx, projectId)
    return await ctx.db
      .query('studioMessages')
      .withIndex('by_project_created', (q) => q.eq('projectId', projectId))
      .order('desc')
      .take(Math.min(Math.max(limit, 1), 100))
      .then((messages) => messages.reverse())
  },
})

export const listRevisions = query({
  args: { projectId: v.id('studioProjects'), limit: v.number() },
  handler: async (ctx, { projectId, limit }) => {
    await requireStudioProjectOwner(ctx, projectId)
    return await ctx.db
      .query('studioRevisions')
      .withIndex('by_project_sequence', (q) => q.eq('projectId', projectId))
      .order('desc')
      .take(Math.min(Math.max(limit, 1), 100))
  },
})

export const rollbackRevision = mutation({
  args: {
    projectId: v.id('studioProjects'),
    revisionId: v.id('studioRevisions'),
    expectedCurrentRevisionId: v.id('studioRevisions'),
  },
  handler: async (ctx, args) => {
    const { project } = await requireStudioProjectOwner(ctx, args.projectId)
    if (project.currentRevisionId !== args.expectedCurrentRevisionId) {
      throw new Error('Studio project changed')
    }
    if (project.currentRunId) throw new Error('Studio generation in progress')

    const target = await ctx.db.get(args.revisionId)
    if (!target || target.projectId !== args.projectId) {
      throw new Error('Studio revision unavailable')
    }

    const latest = await ctx.db
      .query('studioRevisions')
      .withIndex('by_project_sequence', (q) =>
        q.eq('projectId', args.projectId),
      )
      .order('desc')
      .first()
    const now = Date.now()
    const revisionId = await ctx.db.insert('studioRevisions', {
      projectId: args.projectId,
      sequence: (latest?.sequence ?? 0) + 1,
      parentRevisionId: args.expectedCurrentRevisionId,
      previousRunnableRevisionId: project.lastRunnableRevisionId,
      origin: 'rollback',
      code: target.code,
      codeHash: target.codeHash,
      composition: target.composition,
      assistantSummary: `Restored revision ${target.sequence}`,
      createdAt: now,
    })
    await ctx.db.patch(args.projectId, {
      currentRevisionId: revisionId,
      lastRunnableRevisionId: revisionId,
      composition: target.composition,
      updatedAt: now,
    })
    return await ctx.db.get(revisionId)
  },
})
