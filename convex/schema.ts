import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const runtime = v.union(v.literal('remotion'), v.literal('hyperframes'))
const status = v.union(
  v.literal('draft'),
  v.literal('published'),
  v.literal('unlisted'),
  v.literal('removed'),
)
const studioRuntime = v.union(v.literal('remotion'), v.literal('hyperframes'))
const studioJobStatus = v.union(
  v.literal('queued'),
  v.literal('planning'),
  v.literal('rendering'),
  v.literal('uploading'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('canceled'),
)
const studioTemplateStatus = v.union(v.literal('active'), v.literal('inactive'))
const studioLicenseStatus = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('blocked'),
)
const studioEventType = v.union(
  v.literal('job_created'),
  v.literal('credits_consumed'),
  v.literal('planning_started'),
  v.literal('model_started'),
  v.literal('plan_validation_failed'),
  v.literal('plan_repaired'),
  v.literal('rendering_started'),
  v.literal('uploading_started'),
  v.literal('job_completed'),
  v.literal('job_failed'),
  v.literal('job_canceled'),
  v.literal('credits_refunded'),
)
const studioLedgerKind = v.union(
  v.literal('grant'),
  v.literal('consume'),
  v.literal('refund'),
)
const studioModelRunType = v.union(v.literal('plan'), v.literal('repair'))
const studioResolution = v.object({
  width: v.number(),
  height: v.number(),
})

const preview = v.object({
  thumbnailUrl: v.optional(v.string()),
  previewVideoUrl: v.optional(v.string()),
  demoUrl: v.optional(v.string()),
})

const metadata = v.object({
  runtime,
  entryPoint: v.optional(v.string()),
  aspectRatios: v.array(v.string()),
  durationFrames: v.optional(v.number()),
  fps: v.optional(v.number()),
})

const latestVersionSummary = v.object({
  version: v.string(),
  createdAt: v.number(),
  changelog: v.string(),
  preview,
  metadata,
})

const githubSource = v.object({
  repo: v.string(),
  ref: v.string(),
  commit: v.string(),
  path: v.string(),
  pinned: v.boolean(),
})

export default defineSchema({
  studioTemplates: defineTable({
    templateId: v.string(),
    templateVersion: v.string(),
    runtime: studioRuntime,
    status: studioTemplateStatus,
    priority: v.number(),
    supportedAspectRatios: v.array(v.string()),
    supportedResolutions: v.array(studioResolution),
    fps: v.number(),
    propsSchemaVersion: v.string(),
    propsSchema: v.any(),
    agentPrompt: v.string(),
    tags: v.array(v.string()),
    previewStorageKey: v.optional(v.string()),
    licenseStatus: studioLicenseStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_status_priority', ['status', 'priority']),

  generationJobs: defineTable({
    userId: v.string(),
    status: studioJobStatus,
    prompt: v.string(),
    runtime: studioRuntime,
    aspectRatio: v.string(),
    durationSeconds: v.number(),
    templateId: v.string(),
    templateVersion: v.string(),
    propsSchemaVersion: v.string(),
    assetIds: v.array(v.string()),
    plannerOutput: v.optional(v.any()),
    artifactId: v.optional(v.id('generationArtifacts')),
    progress: v.number(),
    idempotencyKey: v.string(),
    workerId: v.optional(v.string()),
    lockedAt: v.optional(v.number()),
    heartbeatAt: v.optional(v.number()),
    lockExpiresAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
    modelStartedAt: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
    canceledBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_created', ['userId', 'createdAt'])
    .index('by_user_idempotency', ['userId', 'idempotencyKey'])
    .index('by_status_lock', ['status', 'lockExpiresAt'])
    .index('by_user_status', ['userId', 'status']),

  generationJobEvents: defineTable({
    jobId: v.id('generationJobs'),
    type: studioEventType,
    message: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index('by_job_created', ['jobId', 'createdAt']),

  generationArtifacts: defineTable({
    userId: v.string(),
    jobId: v.id('generationJobs'),
    storageKey: v.string(),
    thumbnailStorageKey: v.optional(v.string()),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    width: v.number(),
    height: v.number(),
    fps: v.number(),
    durationSeconds: v.number(),
    aspectRatio: v.string(),
    runtime: studioRuntime,
    createdAt: v.number(),
  }).index('by_user_job', ['userId', 'jobId']),

  usageLedger: defineTable({
    userId: v.string(),
    kind: studioLedgerKind,
    amount: v.number(),
    balanceAfter: v.number(),
    jobId: v.optional(v.id('generationJobs')),
    reason: v.string(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index('by_idempotency', ['idempotencyKey'])
    .index('by_user_created', ['userId', 'createdAt']),

  modelRuns: defineTable({
    jobId: v.id('generationJobs'),
    provider: v.string(),
    model: v.string(),
    attemptIndex: v.number(),
    runType: studioModelRunType,
    inputDigest: v.string(),
    outputDigest: v.optional(v.string()),
    inputSnapshotRef: v.string(),
    outputSnapshotRef: v.optional(v.string()),
    validationErrors: v.optional(v.any()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    promptVersion: v.string(),
    schemaVersion: v.string(),
    tokenUsage: v.optional(v.any()),
    estimatedCost: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_job_created', ['jobId', 'createdAt']),

  renderRuns: defineTable({
    jobId: v.id('generationJobs'),
    workerId: v.string(),
    runtime: studioRuntime,
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
    createdAt: v.number(),
  }).index('by_job_created', ['jobId', 'createdAt']),

  publishers: defineTable({
    handle: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_handle', ['handle']),

  components: defineTable({
    runtime,
    publisherId: v.id('publishers'),
    slug: v.string(),
    displayName: v.string(),
    displayNameZh: v.optional(v.string()),
    summary: v.string(),
    summaryZh: v.optional(v.string()),
    categories: v.array(v.string()),
    tags: v.array(v.string()),
    status,
    isActive: v.boolean(),
    latestVersionId: v.optional(v.id('componentVersions')),
    latestVersionSummary: v.optional(latestVersionSummary),
    latestIsPrerelease: v.optional(v.boolean()),
    stats: v.object({
      views: v.number(),
      downloads: v.number(),
      stars: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_runtime_publisher_slug', ['runtime', 'publisherId', 'slug'])
    .index('by_active_updated', ['isActive', 'updatedAt'])
    .index('by_status_updated', ['status', 'updatedAt']),

  componentVersions: defineTable({
    componentId: v.id('components'),
    version: v.string(),
    changelog: v.string(),
    preview,
    metadata,
    sourceProvenance: v.object({
      catalogFile: v.string(),
      importedAt: v.number(),
      fingerprint: v.string(),
    }),
    tags: v.array(v.string()),
    isPrerelease: v.boolean(),
    fingerprint: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_component_version', ['componentId', 'version'])
    .index('by_component_created', ['componentId', 'createdAt']),

  artifacts: defineTable({
    componentVersionId: v.id('componentVersions'),
    kind: v.union(v.literal('github-source'), v.literal('none')),
    githubSource: v.optional(githubSource),
    license: v.string(),
    usageMarkdown: v.string(),
    agentPrompt: v.string(),
    createdAt: v.number(),
  }).index('by_version', ['componentVersionId']),

  componentSearchDigest: defineTable({
    componentId: v.id('components'),
    runtime,
    ownerHandle: v.string(),
    slug: v.string(),
    displayName: v.string(),
    displayNameZh: v.optional(v.string()),
    summary: v.string(),
    summaryZh: v.optional(v.string()),
    latestVersionSummary,
    latestIsPrerelease: v.boolean(),
    tags: v.array(v.string()),
    categories: v.array(v.string()),
    preview,
    status,
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_component', ['componentId'])
    .index('by_active_updated', ['isActive', 'updatedAt'])
    .index('by_status_updated', ['status', 'updatedAt'])
    .index('by_active_name', ['isActive', 'displayName'])
    .index('by_active_runtime_updated', ['isActive', 'runtime', 'updatedAt'])
    .index('by_active_runtime_name', ['isActive', 'runtime', 'displayName']),
})
