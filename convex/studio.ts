import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from './_generated/server'
import { ACTIVE_JOB_STATUSES } from './lib/studio/constants'
import {
  canCancelGenerationJob,
  canRefundCancellation,
  defaultProgressForStatus,
} from './lib/studio/jobs'
import { consumeKey, initialGrantKey, refundKey } from './lib/studio/ledger'
import {
  getDefaultStudioTemplate as getDefaultStudioTemplateFromList,
  listActiveApprovedStudioTemplates,
  type StudioTemplateSeed,
} from './lib/studio/templates'

const STUDIO_INITIAL_GRANT_CREDITS = 2
const STUDIO_JOB_COST = 1
const MIN_PROMPT_LENGTH = 10
const BLOCKED_PROMPT_KEYWORDS = ['terrorist', 'bomb', 'kill myself', 'suicide']

const studioTemplateSeedValidator = v.object({
  importSecret: v.string(),
  templateId: v.string(),
  templateVersion: v.string(),
  runtime: v.literal('remotion'),
  status: v.union(v.literal('active'), v.literal('inactive')),
  priority: v.number(),
  supportedAspectRatios: v.array(v.string()),
  supportedResolutions: v.array(
    v.object({
      width: v.number(),
      height: v.number(),
    }),
  ),
  fps: v.number(),
  propsSchema: v.any(),
  propsSchemaVersion: v.string(),
  agentPrompt: v.string(),
  tags: v.array(v.string()),
  previewStorageKey: v.optional(v.string()),
  licenseStatus: v.union(
    v.literal('pending'),
    v.literal('approved'),
    v.literal('blocked'),
  ),
})

function toSeedRecord(args: StudioTemplateSeed) {
  return {
    templateId: args.templateId,
    templateVersion: args.templateVersion,
    runtime: args.runtime,
    status: args.status,
    priority: args.priority,
    supportedAspectRatios: args.supportedAspectRatios,
    supportedResolutions: args.supportedResolutions,
    fps: args.fps,
    propsSchemaVersion: args.propsSchemaVersion,
    propsSchema: args.propsSchema,
    agentPrompt: args.agentPrompt,
    tags: args.tags,
    previewStorageKey: args.previewStorageKey,
    licenseStatus: args.licenseStatus,
  }
}

function studioError(code: string) {
  throw new ConvexError(code)
}

function toPublicGenerationJob(job: Doc<'generationJobs'>) {
  return {
    id: job._id,
    status: job.status,
    prompt: job.prompt,
    runtime: job.runtime,
    aspectRatio: job.aspectRatio,
    durationSeconds: job.durationSeconds,
    templateId: job.templateId,
    templateVersion: job.templateVersion,
    progress: job.progress,
    artifactId: job.artifactId ?? null,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    failedAt: job.failedAt ?? null,
    canceledAt: job.canceledAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  const userId = identity?.subject?.trim()
  if (!userId) {
    studioError('AUTH_REQUIRED')
  }
  return userId
}

async function getLatestLedgerBalance(db: DatabaseReader, userId: string) {
  const latestEntry = await db
    .query('usageLedger')
    .withIndex('by_user_created', (q) => q.eq('userId', userId))
    .order('desc')
    .first()

  return latestEntry?.balanceAfter ?? 0
}

async function ensureInitialGrant(ctx: MutationCtx, userId: string) {
  const idempotencyKey = initialGrantKey(userId)
  const existing = await ctx.db
    .query('usageLedger')
    .withIndex('by_idempotency', (q) => q.eq('idempotencyKey', idempotencyKey))
    .unique()

  if (existing) {
    return existing
  }

  const now = Date.now()
  const balanceBefore = await getLatestLedgerBalance(ctx.db, userId)
  const ledgerId = await ctx.db.insert('usageLedger', {
    userId,
    kind: 'grant',
    amount: STUDIO_INITIAL_GRANT_CREDITS,
    balanceAfter: balanceBefore + STUDIO_INITIAL_GRANT_CREDITS,
    reason: 'Initial studio credit grant.',
    idempotencyKey,
    createdAt: now,
  })

  const created = await ctx.db.get(ledgerId)
  if (!created) {
    throw new ConvexError('Initial studio grant creation failed.')
  }
  return created
}

function validatePrompt(prompt: string) {
  const normalizedPrompt = prompt.trim()
  if (normalizedPrompt.length < MIN_PROMPT_LENGTH) {
    studioError('PROMPT_INCOMPLETE')
  }

  const lowerPrompt = normalizedPrompt.toLowerCase()
  if (
    BLOCKED_PROMPT_KEYWORDS.some((keyword) => lowerPrompt.includes(keyword))
  ) {
    studioError('CONTENT_BLOCKED')
  }

  return normalizedPrompt
}

async function getTemplateByIdentity(
  db: DatabaseReader,
  templateId: string,
  templateVersion: string,
) {
  const templates = await db.query('studioTemplates').collect()
  const exactMatch =
    templates.find(
      (template) =>
        template.templateId === templateId &&
        template.templateVersion === templateVersion,
    ) ?? null

  if (exactMatch) {
    return exactMatch
  }

  const sameTemplate = templates.find((template) => template.templateId === templateId)
  if (sameTemplate) {
    studioError('TEMPLATE_VERSION_MISMATCH')
  }

  studioError('TEMPLATE_NOT_FOUND')
}

function validateTemplate(template: Doc<'studioTemplates'>) {
  if (template.runtime !== 'remotion') {
    studioError('TEMPLATE_NOT_ALLOWED')
  }
  if (template.status !== 'active') {
    studioError('TEMPLATE_INACTIVE')
  }
  if (template.licenseStatus !== 'approved') {
    studioError('TEMPLATE_LICENSE_BLOCKED')
  }
}

async function hasActiveJob(db: DatabaseReader, userId: string) {
  for (const status of ACTIVE_JOB_STATUSES) {
    const activeJob = await db
      .query('generationJobs')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', status),
      )
      .first()
    if (activeJob) {
      return true
    }
  }

  return false
}

async function getOwnedJobOrThrow(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  jobId: Id<'generationJobs'>,
) {
  const job = await ctx.db.get(jobId)
  if (!job || job.userId !== userId) {
    studioError('TEMPLATE_NOT_FOUND')
  }
  return job
}

async function refundGenerationJobInMutation(
  ctx: MutationCtx,
  args: {
    job: Doc<'generationJobs'>
    reason: string
  },
) {
  if (args.job.refundedAt) {
    return { refunded: false, refundedAt: args.job.refundedAt }
  }

  const key = refundKey(args.job._id)
  const existingRefund = await ctx.db
    .query('usageLedger')
    .withIndex('by_idempotency', (q) => q.eq('idempotencyKey', key))
    .unique()

  if (existingRefund) {
    if (!args.job.refundedAt) {
      await ctx.db.patch(args.job._id, {
        refundedAt: existingRefund.createdAt,
        updatedAt: existingRefund.createdAt,
      })
    }
    return { refunded: false, refundedAt: existingRefund.createdAt }
  }

  const now = Date.now()
  const balanceBefore = await getLatestLedgerBalance(ctx.db, args.job.userId)
  await ctx.db.insert('usageLedger', {
    userId: args.job.userId,
    kind: 'refund',
    amount: 1,
    balanceAfter: balanceBefore + 1,
    jobId: args.job._id,
    reason: args.reason,
    idempotencyKey: key,
    createdAt: now,
  })
  await ctx.db.patch(args.job._id, {
    refundedAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('generationJobEvents', {
    jobId: args.job._id,
    type: 'credits_refunded',
    message: args.reason,
    metadata: {
      idempotencyKey: key,
    },
    createdAt: now,
  })

  return { refunded: true, refundedAt: now }
}

export const upsertStudioTemplate = mutation({
  args: studioTemplateSeedValidator,
  handler: async (ctx, args) => {
    const expectedSecret = process.env.STUDIO_TEMPLATE_IMPORT_SECRET
    if (!expectedSecret || args.importSecret !== expectedSecret) {
      throw new ConvexError('Invalid studio template import secret.')
    }

    const now = Date.now()
    const templateRecord = toSeedRecord(args)
    const existing = await ctx.db
      .query('studioTemplates')
      .collect()
      .then((templates) =>
        templates.find(
          (template) =>
            template.templateId === args.templateId &&
            template.templateVersion === args.templateVersion,
        ),
      )

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...templateRecord,
        updatedAt: now,
      })
      return { created: false }
    }

    await ctx.db.insert('studioTemplates', {
      ...templateRecord,
      createdAt: now,
      updatedAt: now,
    })
    return { created: true }
  },
})

export const listStudioTemplates = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query('studioTemplates')
      .withIndex('by_status_priority', (q) => q.eq('status', 'active'))
      .order('asc')
      .collect()

    return listActiveApprovedStudioTemplates(
      templates.filter((template) => template.runtime === 'remotion'),
    )
  },
})

export const getDefaultStudioTemplate = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query('studioTemplates')
      .withIndex('by_status_priority', (q) => q.eq('status', 'active'))
      .order('asc')
      .collect()

    return getDefaultStudioTemplateFromList(
      templates.filter((template) => template.runtime === 'remotion'),
    )
  },
})

export const createGenerationJob = mutation({
  args: {
    idempotencyKey: v.string(),
    prompt: v.string(),
    templateId: v.string(),
    templateVersion: v.string(),
    aspectRatio: v.string(),
    durationSeconds: v.number(),
    assetIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const existing = await ctx.db
      .query('generationJobs')
      .withIndex('by_user_idempotency', (q) =>
        q.eq('userId', userId).eq('idempotencyKey', args.idempotencyKey),
      )
      .unique()

    if (existing) {
      return toPublicGenerationJob(existing)
    }

    await ensureInitialGrant(ctx, userId)

    const prompt = validatePrompt(args.prompt)
    const template = await getTemplateByIdentity(
      ctx.db,
      args.templateId,
      args.templateVersion,
    )
    validateTemplate(template)

    if (await hasActiveJob(ctx.db, userId)) {
      studioError('ACTIVE_JOB_LIMIT')
    }

    const balanceBefore = await getLatestLedgerBalance(ctx.db, userId)
    if (balanceBefore < STUDIO_JOB_COST) {
      studioError('INSUFFICIENT_CREDITS')
    }

    const now = Date.now()
    const jobId = await ctx.db.insert('generationJobs', {
      userId,
      status: 'queued',
      prompt,
      runtime: template.runtime,
      aspectRatio: args.aspectRatio,
      durationSeconds: args.durationSeconds,
      templateId: template.templateId,
      templateVersion: template.templateVersion,
      propsSchemaVersion: template.propsSchemaVersion,
      assetIds: args.assetIds,
      progress: defaultProgressForStatus('queued'),
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })

    const consumeIdempotencyKey = consumeKey(jobId)
    await ctx.db.insert('usageLedger', {
      userId,
      kind: 'consume',
      amount: -STUDIO_JOB_COST,
      balanceAfter: balanceBefore - STUDIO_JOB_COST,
      jobId,
      reason: 'Studio generation job created.',
      idempotencyKey: consumeIdempotencyKey,
      createdAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId,
      type: 'job_created',
      metadata: {
        status: 'queued',
      },
      createdAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId,
      type: 'credits_consumed',
      metadata: {
        amount: STUDIO_JOB_COST,
        idempotencyKey: consumeIdempotencyKey,
      },
      createdAt: now,
    })

    const createdJob = await ctx.db.get(jobId)
    if (!createdJob) {
      throw new ConvexError('Generation job creation failed.')
    }
    return toPublicGenerationJob(createdJob)
  },
})

export const getGenerationJob = query({
  args: {
    jobId: v.id('generationJobs'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const job = await getOwnedJobOrThrow(ctx, userId, args.jobId)
    return toPublicGenerationJob(job)
  },
})

export const getMyStudioHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const jobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_user_created', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()

    return jobs.slice(0, 10).map(toPublicGenerationJob)
  },
})

export const cancelGenerationJob = mutation({
  args: {
    jobId: v.id('generationJobs'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const job = await getOwnedJobOrThrow(ctx, userId, args.jobId)

    if (job.status === 'canceled') {
      return toPublicGenerationJob(job)
    }

    if (!canCancelGenerationJob(job.status)) {
      studioError('INVALID_CANCEL_STATE')
    }

    const now = Date.now()
    await ctx.db.patch(job._id, {
      status: 'canceled',
      canceledAt: now,
      canceledBy: userId,
      cancelReason: args.reason,
      updatedAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId: job._id,
      type: 'job_canceled',
      message: args.reason,
      createdAt: now,
    })

    if (
      canRefundCancellation({
        status: job.status,
        modelStartedAt: job.modelStartedAt,
      })
    ) {
      await refundGenerationJobInMutation(ctx, {
        job,
        reason: `Refund for canceled job: ${args.reason}`,
      })
    }

    const canceledJob = await ctx.db.get(job._id)
    if (!canceledJob) {
      throw new ConvexError('Canceled job lookup failed.')
    }

    return toPublicGenerationJob(canceledJob)
  },
})
