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
  DEFAULT_STUDIO_THUMBNAIL_URL,
  createStudioSignedArtifactUrl,
} from './lib/studio/artifacts'
import {
  canCancelGenerationJob,
  defaultProgressForStatus,
} from './lib/studio/jobs'
import { consumeKey, initialGrantKey, refundKey } from './lib/studio/ledger'
import { validateRenderPlan } from './lib/studio/renderPlan'
import {
  getDefaultStudioTemplate as getDefaultStudioTemplateFromList,
  listActiveApprovedStudioTemplates,
  type StudioTemplateSeed,
} from './lib/studio/templates'

const STUDIO_INITIAL_GRANT_CREDITS = 2
const STUDIO_JOB_COST = 1
const MIN_PROMPT_LENGTH = 10
const BLOCKED_PROMPT_KEYWORDS = ['terrorist', 'bomb', 'kill myself', 'suicide']
const DEFAULT_STUDIO_WORKER_LOCK_TTL_MS = 30_000
const STUDIO_MVP_RUNTIME = 'remotion'
const STUDIO_MVP_MIME_TYPE = 'video/mp4'
const STUDIO_MVP_ASPECT_RATIO = '16:9'
const STUDIO_MVP_WIDTH = 1280
const STUDIO_MVP_HEIGHT = 720
const STUDIO_MVP_FPS = 30
const STUDIO_MVP_MIN_DURATION_SECONDS = 10
const STUDIO_MVP_MAX_DURATION_SECONDS = 30
const STUDIO_DEFAULT_DURATION_SECONDS = STUDIO_MVP_MAX_DURATION_SECONDS

const studioTokenUsageValidator = v.object({
  inputTokens: v.number(),
  outputTokens: v.number(),
  totalTokens: v.number(),
})

const studioRenderPlanValidator = v.object({
  schemaVersion: v.literal(1),
  templateId: v.string(),
  templateVersion: v.string(),
  propsSchemaVersion: v.string(),
  runtime: v.literal('remotion'),
  output: v.object({
    aspectRatio: v.literal('16:9'),
    width: v.literal(1280),
    height: v.literal(720),
    fps: v.literal(30),
    durationSeconds: v.number(),
    format: v.literal('mp4'),
  }),
  intentSummary: v.string(),
  style: v.object({
    tone: v.string(),
    primaryColor: v.string(),
    backgroundStyle: v.string(),
  }),
  scenes: v.array(
    v.object({
      id: v.string(),
      durationSeconds: v.number(),
      headline: v.string(),
      subtitle: v.string(),
      body: v.string(),
      visualHint: v.string(),
    }),
  ),
  props: v.record(v.string(), v.string()),
  assetIds: v.array(v.string()),
})

const studioModelRunValidator = v.object({
  provider: v.string(),
  model: v.string(),
  attemptIndex: v.number(),
  runType: v.union(v.literal('plan'), v.literal('repair')),
  inputDigest: v.string(),
  outputDigest: v.optional(v.string()),
  inputSnapshotRef: v.string(),
  outputSnapshotRef: v.optional(v.string()),
  validationErrors: v.optional(v.array(v.string())),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  promptVersion: v.string(),
  schemaVersion: v.string(),
  tokenUsage: v.optional(studioTokenUsageValidator),
  estimatedCost: v.optional(v.number()),
  latencyMs: v.optional(v.number()),
})

const studioRenderRunValidator = v.object({
  runtime: v.union(v.literal('remotion'), v.literal('hyperframes')),
  templateId: v.string(),
  templateVersion: v.string(),
  rendererVersion: v.string(),
  remotionVersion: v.string(),
  workerVersion: v.string(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  exitCode: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  logsRef: v.optional(v.string()),
  renderInputSnapshotRef: v.string(),
  outputStorageKey: v.optional(v.string()),
})

const studioRenderRunPatchValidator = v.object({
  completedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  exitCode: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  logsRef: v.optional(v.string()),
  outputStorageKey: v.optional(v.string()),
})

const studioArtifactValidator = v.object({
  storageKey: v.string(),
  thumbnailStorageKey: v.optional(v.string()),
  fileSizeBytes: v.number(),
  mimeType: v.string(),
  width: v.number(),
  height: v.number(),
  fps: v.number(),
  durationSeconds: v.number(),
  aspectRatio: v.string(),
  runtime: v.union(v.literal('remotion'), v.literal('hyperframes')),
})

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

function studioError(code: string): never {
  throw new ConvexError(code)
}

function assertStudioArtifactProfile(job: Doc<'generationJobs'>, artifact: {
  storageKey: string
  thumbnailStorageKey?: string
  fileSizeBytes: number
  mimeType: string
  width: number
  height: number
  fps: number
  durationSeconds: number
  aspectRatio: string
  runtime: 'remotion' | 'hyperframes'
}) {
  const plannedOutput = job.plannerOutput?.output
  const expectedDurationSeconds = plannedOutput?.durationSeconds ?? job.durationSeconds
  const matchesMvpProfile =
    job.runtime === STUDIO_MVP_RUNTIME &&
    artifact.runtime === STUDIO_MVP_RUNTIME &&
    artifact.mimeType === STUDIO_MVP_MIME_TYPE &&
    artifact.aspectRatio === STUDIO_MVP_ASPECT_RATIO &&
    artifact.width === STUDIO_MVP_WIDTH &&
    artifact.height === STUDIO_MVP_HEIGHT &&
    artifact.fps === STUDIO_MVP_FPS &&
    artifact.durationSeconds >= 0 &&
    artifact.durationSeconds <= STUDIO_MVP_MAX_DURATION_SECONDS

  if (!matchesMvpProfile) {
    studioError('ARTIFACT_PROFILE_MISMATCH')
  }

  const expectedArtifactPrefix = `studio/${job._id}/`
  const hasValidStorageKey =
    artifact.storageKey === `${expectedArtifactPrefix}artifact.mp4`

  if (!hasValidStorageKey || artifact.fileSizeBytes <= 0) {
    studioError('ARTIFACT_PROFILE_MISMATCH')
  }

  if (
    artifact.thumbnailStorageKey &&
    !new RegExp(
      `^${expectedArtifactPrefix}artifact-thumbnail\\.(jpg|jpeg|png|webp)$`,
    ).test(artifact.thumbnailStorageKey)
  ) {
    studioError('ARTIFACT_PROFILE_MISMATCH')
  }

  if (!plannedOutput) {
    studioError('PLAN_VALIDATION_FAILED')
  }

  const matchesPlannedOutput =
    artifact.runtime === job.runtime &&
    artifact.aspectRatio === plannedOutput.aspectRatio &&
    artifact.width === plannedOutput.width &&
    artifact.height === plannedOutput.height &&
    artifact.fps === plannedOutput.fps &&
    artifact.durationSeconds === expectedDurationSeconds

  if (!matchesPlannedOutput) {
    studioError('ARTIFACT_PROFILE_MISMATCH')
  }
}

type StudioWorkerClaimResult = {
  id: Id<'generationJobs'>
  status: Doc<'generationJobs'>['status']
  prompt: string
  runtime: Doc<'generationJobs'>['runtime']
  aspectRatio: string
  durationSeconds: number
  templateId: string
  templateVersion: string
  propsSchemaVersion: string
  assetIds: string[]
  attemptCount: number
  workerId: string
  progress: number
  startedAt: number | null
  createdAt: number
  updatedAt: number
  lockExpiresAt: number | null
}

type StudioWorkerModelRunInput = Omit<
  Doc<'modelRuns'>,
  '_id' | '_creationTime' | 'jobId' | 'createdAt'
>

type StudioWorkerRenderRunInput = Omit<
  Doc<'renderRuns'>,
  '_id' | '_creationTime' | 'jobId' | 'workerId' | 'createdAt'
>

type StudioWorkerArtifactInput = Omit<
  Doc<'generationArtifacts'>,
  '_id' | '_creationTime' | 'jobId' | 'userId' | 'createdAt'
>

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

function toWorkerGenerationJob(job: Doc<'generationJobs'>): StudioWorkerClaimResult {
  return {
    id: job._id,
    status: job.status,
    prompt: job.prompt,
    runtime: job.runtime,
    aspectRatio: job.aspectRatio,
    durationSeconds: job.durationSeconds,
    templateId: job.templateId,
    templateVersion: job.templateVersion,
    propsSchemaVersion: job.propsSchemaVersion,
    assetIds: job.assetIds,
    attemptCount: job.attemptCount,
    workerId: job.workerId ?? '',
    progress: job.progress,
    startedAt: job.startedAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lockExpiresAt: job.lockExpiresAt ?? null,
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

  const supportsMvpProfile =
    template.supportedAspectRatios.includes(STUDIO_MVP_ASPECT_RATIO) &&
    template.supportedResolutions.some(
      (resolution) =>
        resolution.width === STUDIO_MVP_WIDTH &&
        resolution.height === STUDIO_MVP_HEIGHT,
    ) &&
    template.fps === STUDIO_MVP_FPS

  if (!supportsMvpProfile) {
    studioError('TEMPLATE_NOT_ALLOWED')
  }
}

function normalizeStudioRequestedDurationSeconds(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds)) {
    return STUDIO_DEFAULT_DURATION_SECONDS
  }

  const normalized = Math.trunc(durationSeconds)
  if (
    normalized < STUDIO_MVP_MIN_DURATION_SECONDS ||
    normalized > STUDIO_MVP_MAX_DURATION_SECONDS
  ) {
    return STUDIO_DEFAULT_DURATION_SECONDS
  }

  return normalized
}

function getServerApprovedAssetIds(_template: Doc<'studioTemplates'>) {
  // Current MVP templates do not expose a server-managed asset manifest yet.
  return [] as string[]
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

function getStudioArtifactSigningSecret() {
  const secret = process.env.STUDIO_ARTIFACT_SIGNING_SECRET?.trim()
  if (!secret) {
    studioError('ARTIFACT_ACCESS_NOT_CONFIGURED')
  }
  return secret
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

async function getWorkerOwnedJobOrThrow(
  ctx: MutationCtx,
  args: {
    jobId: Id<'generationJobs'>
    workerId: string
    expectedStatus:
      | 'planning'
      | 'rendering'
      | 'uploading'
  },
) {
  const job = await ctx.db.get(args.jobId)
  if (!job) {
    studioError('JOB_NOT_FOUND')
  }
  if (job.workerId !== args.workerId || job.status !== args.expectedStatus) {
    studioError('INVALID_WORKER_STATE')
  }
  return job
}

function requireStudioWorkerSecret(workerSecret: string) {
  const expectedSecret = process.env.STUDIO_WORKER_SECRET
  if (!expectedSecret || workerSecret !== expectedSecret) {
    studioError('INVALID_WORKER_SECRET')
  }
}

function getWorkerLockTtlMs(
  job: Pick<Doc<'generationJobs'>, 'lockExpiresAt' | 'heartbeatAt' | 'lockedAt'>,
  fallbackTtlMs = DEFAULT_STUDIO_WORKER_LOCK_TTL_MS,
) {
  if (job.lockExpiresAt !== undefined) {
    const base = job.heartbeatAt ?? job.lockedAt ?? job.lockExpiresAt
    const ttlMs = job.lockExpiresAt - base
    if (ttlMs > 0) {
      return ttlMs
    }
  }

  return fallbackTtlMs
}

function getLockExpiryTime(
  job: Pick<Doc<'generationJobs'>, 'lockExpiresAt' | 'heartbeatAt' | 'lockedAt'>,
  fallbackTtlMs = DEFAULT_STUDIO_WORKER_LOCK_TTL_MS,
) {
  if (job.lockExpiresAt !== undefined) {
    return job.lockExpiresAt
  }

  const heartbeatBase = job.heartbeatAt ?? job.lockedAt
  if (heartbeatBase !== undefined) {
    return heartbeatBase + fallbackTtlMs
  }

  return null
}

function isExpiredWorkerLock(
  job: Pick<
    Doc<'generationJobs'>,
    'lockExpiresAt' | 'heartbeatAt' | 'lockedAt' | 'workerId'
  >,
  now: number,
  fallbackTtlMs: number,
) {
  if (!job.workerId) {
    return false
  }

  const expiryTime = getLockExpiryTime(job, fallbackTtlMs)
  return expiryTime !== null && expiryTime <= now
}

async function claimPlanningJob(
  ctx: MutationCtx,
  job: Doc<'generationJobs'>,
  args: {
    workerId: string
    lockTtlMs: number
    now: number
    recovered: boolean
  },
) {
  await ctx.db.patch(job._id, {
    status: 'planning',
    workerId: args.workerId,
    lockedAt: args.now,
    heartbeatAt: args.now,
    lockExpiresAt: args.now + args.lockTtlMs,
    startedAt: job.startedAt ?? args.now,
    modelStartedAt:
      args.recovered && job.status === 'planning' && !job.plannerOutput
        ? undefined
        : job.modelStartedAt,
    attemptCount: job.attemptCount + 1,
    progress: defaultProgressForStatus('planning'),
    updatedAt: args.now,
  })
  await ctx.db.insert('generationJobEvents', {
    jobId: job._id,
    type: 'planning_started',
    metadata: {
      workerId: args.workerId,
      recovered: args.recovered,
      previousWorkerId: job.workerId,
    },
    createdAt: args.now,
  })

  const claimedJob = await ctx.db.get(job._id)
  if (!claimedJob) {
    throw new ConvexError('Claimed generation job lookup failed.')
  }

  return toWorkerGenerationJob(claimedJob)
}

async function failExpiredWorkerJob(
  ctx: MutationCtx,
  job: Doc<'generationJobs'>,
  now: number,
) {
  const errorCode =
    job.status === 'rendering'
      ? 'RENDER_TIMEOUT'
      : job.status === 'uploading'
        ? 'UPLOAD_FAILED'
        : 'RENDER_FAILED'
  const errorMessage =
    job.status === 'rendering'
      ? 'Rendering worker lock expired before completion.'
      : job.status === 'uploading'
        ? 'Upload worker lock expired before completion.'
        : 'Planning worker lock expired before completion.'

  await ctx.db.patch(job._id, {
    status: 'failed',
    errorCode,
    errorMessage,
    failedAt: now,
    heartbeatAt: now,
    lockExpiresAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('generationJobEvents', {
    jobId: job._id,
    type: 'job_failed',
    message: errorMessage,
    metadata: {
      workerId: job.workerId ?? 'system',
      errorCode,
      recovery: 'expired_lock',
    },
    createdAt: now,
  })
  await refundGenerationJobInMutation(ctx, {
    job,
    reason: `Refund for system failure: ${errorCode}`,
  })
}

async function findExpiredActiveJobs(
  ctx: MutationCtx,
  now: number,
  fallbackTtlMs: number,
) {
  const activeJobs = await Promise.all(
    ACTIVE_JOB_STATUSES.filter((status) => status !== 'queued').map((status) =>
      ctx.db
        .query('generationJobs')
        .withIndex('by_status_lock', (q) => q.eq('status', status))
        .collect(),
    ),
  )

  return activeJobs
    .flat()
    .filter((job) => isExpiredWorkerLock(job, now, fallbackTtlMs))
    .sort((left, right) => left.createdAt - right.createdAt)
}

async function recoverExpiredActiveJobsForUser(
  ctx: MutationCtx,
  userId: string,
  now: number,
  fallbackTtlMs: number,
) {
  const activeJobs = await Promise.all(
    ACTIVE_JOB_STATUSES.filter((status) => status !== 'queued').map((status) =>
      ctx.db
        .query('generationJobs')
        .withIndex('by_user_status', (q) =>
          q.eq('userId', userId).eq('status', status),
        )
        .collect(),
    ),
  )

  const expiredJobs = activeJobs
    .flat()
    .filter((job) => isExpiredWorkerLock(job, now, fallbackTtlMs))
    .sort((left, right) => left.createdAt - right.createdAt)

  for (const job of expiredJobs) {
    await failExpiredWorkerJob(ctx, job, now)
  }
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

export const getStudioViewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    return {
      userId: identity.subject,
    }
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

    await recoverExpiredActiveJobsForUser(
      ctx,
      userId,
      Date.now(),
      DEFAULT_STUDIO_WORKER_LOCK_TTL_MS,
    )

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
      aspectRatio: STUDIO_MVP_ASPECT_RATIO,
      durationSeconds: normalizeStudioRequestedDurationSeconds(
        args.durationSeconds,
      ),
      templateId: template.templateId,
      templateVersion: template.templateVersion,
      propsSchemaVersion: template.propsSchemaVersion,
      assetIds: getServerApprovedAssetIds(template),
      attemptCount: 0,
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

export const getGenerationArtifactAccess = query({
  args: {
    jobId: v.id('generationJobs'),
    refresh: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const job = await getOwnedJobOrThrow(ctx, userId, args.jobId)
    const artifact = await ctx.db
      .query('generationArtifacts')
      .withIndex('by_user_job', (q) =>
        q.eq('userId', userId).eq('jobId', args.jobId),
      )
      .unique()

    if (!artifact) {
      studioError('ARTIFACT_NOT_READY')
    }

    const signingSecret = getStudioArtifactSigningSecret()
    const issuedAt = Date.now()
    const [playback, download] = await Promise.all([
      createStudioSignedArtifactUrl({
        storageKey: artifact.storageKey,
        kind: 'playback',
        secret: signingSecret,
        now: issuedAt,
      }),
      createStudioSignedArtifactUrl({
        storageKey: artifact.storageKey,
        kind: 'download',
        secret: signingSecret,
        now: issuedAt,
      }),
    ])

    const thumbnail = artifact.thumbnailStorageKey
      ? {
          ...(await createStudioSignedArtifactUrl({
            storageKey: artifact.thumbnailStorageKey,
            kind: 'thumbnail',
            secret: signingSecret,
            now: issuedAt,
          })),
          source: 'artifact' as const,
        }
      : (() => null)()

    if (thumbnail) {
      return {
        artifactId: artifact._id,
        jobId: job._id,
        playback,
        download,
        thumbnail,
        mimeType: artifact.mimeType,
        fileSizeBytes: artifact.fileSizeBytes,
        width: artifact.width,
        height: artifact.height,
        fps: artifact.fps,
        durationSeconds: artifact.durationSeconds,
        aspectRatio: artifact.aspectRatio,
        runtime: artifact.runtime,
      }
    }

    const template = await getTemplateByIdentity(
      ctx.db,
      job.templateId,
      job.templateVersion,
    )

    if (template.previewStorageKey) {
      return {
        artifactId: artifact._id,
        jobId: job._id,
        playback,
        download,
        thumbnail: {
          ...(await createStudioSignedArtifactUrl({
            storageKey: template.previewStorageKey,
            kind: 'preview',
            secret: signingSecret,
            now: issuedAt,
          })),
          source: 'template-preview' as const,
        },
        mimeType: artifact.mimeType,
        fileSizeBytes: artifact.fileSizeBytes,
        width: artifact.width,
        height: artifact.height,
        fps: artifact.fps,
        durationSeconds: artifact.durationSeconds,
        aspectRatio: artifact.aspectRatio,
        runtime: artifact.runtime,
      }
    }

    return {
      artifactId: artifact._id,
      jobId: job._id,
      playback,
      download,
      thumbnail: {
        url: DEFAULT_STUDIO_THUMBNAIL_URL,
        expiresAt: null,
        source: 'default' as const,
      },
      mimeType: artifact.mimeType,
      fileSizeBytes: artifact.fileSizeBytes,
      width: artifact.width,
      height: artifact.height,
      fps: artifact.fps,
      durationSeconds: artifact.durationSeconds,
      aspectRatio: artifact.aspectRatio,
      runtime: artifact.runtime,
    }
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

    const canceledJob = await ctx.db.get(job._id)
    if (!canceledJob) {
      throw new ConvexError('Canceled job lookup failed.')
    }

    return toPublicGenerationJob(canceledJob)
  },
})

export const claimNextGenerationJob = mutation({
  args: {
    workerId: v.string(),
    workerSecret: v.string(),
    lockTtlMs: v.number(),
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const now = Date.now()
    const expiredActiveJobs = await findExpiredActiveJobs(ctx, now, args.lockTtlMs)
    for (const expiredJob of expiredActiveJobs) {
      if (expiredJob.status === 'planning' && !expiredJob.plannerOutput) {
        return claimPlanningJob(ctx, expiredJob, {
          workerId: args.workerId,
          lockTtlMs: args.lockTtlMs,
          now,
          recovered: true,
        })
      }

      await failExpiredWorkerJob(ctx, expiredJob, now)
    }

    const queuedJobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_status_lock', (q) => q.eq('status', 'queued'))
      .collect()

    const nextJob =
      queuedJobs.sort((left, right) => left.createdAt - right.createdAt)[0] ?? null

    if (!nextJob) {
      return null
    }

    return claimPlanningJob(ctx, nextJob, {
      workerId: args.workerId,
      lockTtlMs: args.lockTtlMs,
      now,
      recovered: false,
    })
  },
})

export const markModelStarted = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await getWorkerOwnedJobOrThrow(ctx, {
      ...args,
      expectedStatus: 'planning',
    })

    const now = Date.now()
    if (job.modelStartedAt) {
      studioError('INVALID_WORKER_STATE')
    }

    await ctx.db.patch(job._id, {
      modelStartedAt: now,
      heartbeatAt: now,
      lockExpiresAt: now + getWorkerLockTtlMs(job),
      updatedAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId: job._id,
      type: 'model_started',
      metadata: {
        workerId: args.workerId,
      },
      createdAt: now,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Updated generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})

export const completePlanning = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
    renderPlan: studioRenderPlanValidator,
    modelRun: studioModelRunValidator,
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await getWorkerOwnedJobOrThrow(ctx, {
      jobId: args.jobId,
      workerId: args.workerId,
      expectedStatus: 'planning',
    })

    if (job.plannerOutput) {
      studioError('INVALID_WORKER_STATE')
    }

    const template = await getTemplateByIdentity(
      ctx.db,
      job.templateId,
      job.templateVersion,
    )
    const planResult = validateRenderPlan(
      args.renderPlan,
      {
        templateId: job.templateId,
        templateVersion: job.templateVersion,
        propsSchemaVersion: job.propsSchemaVersion,
      },
      {
        allowedAssetIds: job.assetIds,
        propsSchema: template.propsSchema,
      },
    )
    if (!planResult.ok) {
      const now = Date.now()
      const errorCode = planResult.errors[0] ?? 'PLAN_VALIDATION_FAILED'
      await ctx.db.insert('modelRuns', {
        ...(args.modelRun as StudioWorkerModelRunInput),
        jobId: job._id,
        validationErrors: planResult.errors,
        errorCode,
        errorMessage: planResult.errors.join('\n'),
        createdAt: now,
      })
      await ctx.db.insert('generationJobEvents', {
        jobId: job._id,
        type: 'plan_validation_failed',
        message: errorCode,
        metadata: {
          workerId: args.workerId,
          errors: planResult.errors,
        },
        createdAt: now,
      })
      await ctx.db.patch(job._id, {
        heartbeatAt: now,
        lockExpiresAt: now + getWorkerLockTtlMs(job),
        updatedAt: now,
      })
      const updatedJob = await ctx.db.get(job._id)
      if (!updatedJob) {
        throw new ConvexError('Invalid planned generation job lookup failed.')
      }

      return toWorkerGenerationJob(updatedJob)
    }

    const now = Date.now()
    await ctx.db.insert('modelRuns', {
      ...(args.modelRun as StudioWorkerModelRunInput),
      jobId: job._id,
      createdAt: now,
    })
    await ctx.db.patch(job._id, {
      plannerOutput: planResult.value,
      aspectRatio: planResult.value.output.aspectRatio,
      durationSeconds: planResult.value.output.durationSeconds,
      heartbeatAt: now,
      lockExpiresAt: now + getWorkerLockTtlMs(job),
      updatedAt: now,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Planned generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})

export const startRendering = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
    renderRun: studioRenderRunValidator,
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await getWorkerOwnedJobOrThrow(ctx, {
      jobId: args.jobId,
      workerId: args.workerId,
      expectedStatus: 'planning',
    })

    if (!job.plannerOutput) {
      studioError('PLAN_VALIDATION_FAILED')
    }

    const now = Date.now()
    await ctx.db.insert('renderRuns', {
      ...(args.renderRun as StudioWorkerRenderRunInput),
      jobId: job._id,
      workerId: args.workerId,
      createdAt: now,
    })
    await ctx.db.patch(job._id, {
      status: 'rendering',
      progress: defaultProgressForStatus('rendering'),
      heartbeatAt: now,
      lockExpiresAt: now + getWorkerLockTtlMs(job),
      updatedAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId: job._id,
      type: 'rendering_started',
      metadata: {
        workerId: args.workerId,
      },
      createdAt: now,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Rendering generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})

export const startUploading = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await getWorkerOwnedJobOrThrow(ctx, {
      ...args,
      expectedStatus: 'rendering',
    })

    const now = Date.now()
    await ctx.db.patch(job._id, {
      status: 'uploading',
      progress: defaultProgressForStatus('uploading'),
      heartbeatAt: now,
      lockExpiresAt: now + getWorkerLockTtlMs(job),
      updatedAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId: job._id,
      type: 'uploading_started',
      metadata: {
        workerId: args.workerId,
      },
      createdAt: now,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Uploading generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})

export const heartbeatGenerationJob = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
    expectedStatus: v.optional(
      v.union(
        v.literal('planning'),
        v.literal('rendering'),
        v.literal('uploading'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await ctx.db.get(args.jobId)
    if (!job) {
      studioError('JOB_NOT_FOUND')
    }

    if (
      !ACTIVE_JOB_STATUSES.includes(job.status as (typeof ACTIVE_JOB_STATUSES)[number]) ||
      job.workerId !== args.workerId ||
      (args.expectedStatus && job.status !== args.expectedStatus)
    ) {
      studioError('INVALID_WORKER_STATE')
    }

    const now = Date.now()
    await ctx.db.patch(job._id, {
      heartbeatAt: now,
      lockExpiresAt: now + getWorkerLockTtlMs(job),
      updatedAt: now,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Heartbeat generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})

export const completeGenerationJob = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
    artifact: studioArtifactValidator,
    renderRun: studioRenderRunPatchValidator,
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await getWorkerOwnedJobOrThrow(ctx, {
      jobId: args.jobId,
      workerId: args.workerId,
      expectedStatus: 'uploading',
    })

    assertStudioArtifactProfile(job, args.artifact)

    const now = Date.now()
    const latestRenderRun = await ctx.db
      .query('renderRuns')
      .withIndex('by_job_created', (q) => q.eq('jobId', job._id))
      .order('desc')
      .first()

    if (!latestRenderRun || latestRenderRun.workerId !== args.workerId) {
      studioError('INVALID_WORKER_STATE')
    }

    if (args.renderRun.outputStorageKey !== args.artifact.storageKey) {
      studioError('ARTIFACT_PROFILE_MISMATCH')
    }

    const artifactId = await ctx.db.insert('generationArtifacts', {
      ...(args.artifact as StudioWorkerArtifactInput),
      jobId: job._id,
      userId: job.userId,
      createdAt: now,
    })

    await ctx.db.patch(latestRenderRun._id, {
      ...(args.renderRun as Partial<StudioWorkerRenderRunInput>),
    })
    await ctx.db.patch(job._id, {
      status: 'completed',
      artifactId,
      progress: defaultProgressForStatus('completed'),
      completedAt: now,
      heartbeatAt: now,
      lockExpiresAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId: job._id,
      type: 'job_completed',
      metadata: {
        workerId: args.workerId,
        artifactId,
      },
      createdAt: now,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Completed generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})

export const failGenerationJob = mutation({
  args: {
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    workerSecret: v.string(),
    errorCode: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    requireStudioWorkerSecret(args.workerSecret)

    const job = await ctx.db.get(args.jobId)
    if (!job) {
      studioError('JOB_NOT_FOUND')
    }

    if (
      !ACTIVE_JOB_STATUSES.includes(job.status as (typeof ACTIVE_JOB_STATUSES)[number]) ||
      job.workerId !== args.workerId
    ) {
      studioError('INVALID_WORKER_STATE')
    }

    const now = Date.now()
    if (job.status === 'rendering' || job.status === 'uploading') {
      const latestRenderRun = await ctx.db
        .query('renderRuns')
        .withIndex('by_job_created', (q) => q.eq('jobId', job._id))
        .order('desc')
        .first()

      if (latestRenderRun && !latestRenderRun.completedAt) {
        await ctx.db.patch(latestRenderRun._id, {
          completedAt: now,
          durationMs: Math.max(0, now - latestRenderRun.startedAt),
          exitCode: 1,
          errorCode: args.errorCode,
          errorMessage: args.errorMessage,
        })
      }
    }

    await ctx.db.patch(job._id, {
      status: 'failed',
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      failedAt: now,
      heartbeatAt: now,
      lockExpiresAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('generationJobEvents', {
      jobId: job._id,
      type: 'job_failed',
      message: args.errorMessage,
      metadata: {
        workerId: args.workerId,
        errorCode: args.errorCode,
      },
      createdAt: now,
    })
    await refundGenerationJobInMutation(ctx, {
      job,
      reason: `Refund for system failure: ${args.errorCode}`,
    })

    const updatedJob = await ctx.db.get(job._id)
    if (!updatedJob) {
      throw new ConvexError('Failed generation job lookup failed.')
    }

    return toWorkerGenerationJob(updatedJob)
  },
})
