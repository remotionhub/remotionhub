import { getAuthUserId } from '@convex-dev/auth/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function getOptionalAuthUserId(ctx: QueryCtx | MutationCtx) {
  try {
    return await getAuthUserId(ctx)
  } catch {
    return null
  }
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ userId: Id<'users'>; user: Doc<'users'> }> {
  const userId = await getOptionalAuthUserId(ctx)
  if (!userId) throw new Error('Unauthorized')

  const user = await ctx.db.get(userId)
  if (!user) throw new Error('User not found')

  return { userId, user }
}

export async function requireStudioProjectOwner(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'studioProjects'>,
) {
  const { userId } = await requireUser(ctx)
  const project = await ctx.db.get(projectId)
  if (!project || project.ownerId !== userId) {
    throw new Error('Studio project unavailable')
  }
  return { project, userId }
}
