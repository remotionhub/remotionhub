import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const runtime = v.union(v.literal('remotion'), v.literal('hyperframes'))
const status = v.union(
  v.literal('draft'),
  v.literal('published'),
  v.literal('unlisted'),
  v.literal('removed'),
)

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

const studioAspectRatio = v.union(
  v.literal('16:9'),
  v.literal('9:16'),
  v.literal('1:1'),
)

const studioComposition = v.object({
  aspectRatio: studioAspectRatio,
  width: v.number(),
  height: v.number(),
  fps: v.number(),
  durationInFrames: v.number(),
})

const studioSource = v.union(
  v.object({ kind: v.literal('prompt') }),
  v.object({
    kind: v.literal('catalog-remix'),
    componentId: v.id('components'),
    componentVersionId: v.id('componentVersions'),
    ownerHandle: v.string(),
    slug: v.string(),
    version: v.string(),
    commit: v.string(),
    entryPoint: v.string(),
    bundleHash: v.string(),
  }),
)

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    handle: v.optional(v.string()),
    displayName: v.optional(v.string()),
    role: v.optional(v.union(v.literal('admin'), v.literal('user'))),
    personalPublisherId: v.optional(v.id('publishers')),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_handle', ['handle']),

  publishers: defineTable({
    handle: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    kind: v.optional(
      v.union(v.literal('user'), v.literal('org'), v.literal('system')),
    ),
    linkedUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_handle', ['handle'])
    .index('by_linked_user', ['linkedUserId']),

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

  studioProjects: defineTable({
    ownerId: v.id('users'),
    title: v.string(),
    status: v.union(v.literal('active'), v.literal('archived')),
    source: studioSource,
    currentRevisionId: v.optional(v.id('studioRevisions')),
    lastRunnableRevisionId: v.optional(v.id('studioRevisions')),
    currentRunId: v.optional(v.id('studioGenerationRuns')),
    composition: studioComposition,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_updated', ['ownerId', 'updatedAt'])
    .index('by_owner_status_updated', ['ownerId', 'status', 'updatedAt']),

  studioRevisions: defineTable({
    projectId: v.id('studioProjects'),
    sequence: v.number(),
    parentRevisionId: v.optional(v.id('studioRevisions')),
    previousRunnableRevisionId: v.optional(v.id('studioRevisions')),
    origin: v.union(
      v.literal('prompt'),
      v.literal('catalog-remix'),
      v.literal('follow-up'),
      v.literal('correction'),
      v.literal('rollback'),
    ),
    code: v.string(),
    codeHash: v.string(),
    composition: studioComposition,
    promptMessageId: v.optional(v.id('studioMessages')),
    assistantSummary: v.string(),
    createdAt: v.number(),
  }).index('by_project_sequence', ['projectId', 'sequence']),

  studioMessages: defineTable({
    projectId: v.id('studioProjects'),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system'),
    ),
    kind: v.union(
      v.literal('prompt'),
      v.literal('response'),
      v.literal('status'),
      v.literal('error'),
    ),
    content: v.string(),
    generationRunId: v.optional(v.id('studioGenerationRuns')),
    revisionId: v.optional(v.id('studioRevisions')),
    createdAt: v.number(),
  }).index('by_project_created', ['projectId', 'createdAt']),

  studioGenerationRuns: defineTable({
    projectId: v.id('studioProjects'),
    ownerId: v.id('users'),
    status: v.union(
      v.literal('queued'),
      v.literal('validating'),
      v.literal('selecting-skills'),
      v.literal('generating'),
      v.literal('compiling'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('cancelled'),
    ),
    inputRevisionId: v.optional(v.id('studioRevisions')),
    promptMessageId: v.id('studioMessages'),
    modelAlias: v.string(),
    detectedSkills: v.array(v.string()),
    correctionAttempt: v.number(),
    candidateCode: v.optional(v.string()),
    candidateComposition: v.optional(studioComposition),
    candidateFingerprint: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    tokenUsage: v.optional(
      v.object({ inputTokens: v.number(), outputTokens: v.number() }),
    ),
    durationMs: v.optional(v.number()),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_updated', ['projectId', 'updatedAt'])
    .index('by_owner_idempotency', ['ownerId', 'idempotencyKey']),

  studioBundles: defineTable({
    componentVersionId: v.id('componentVersions'),
    entryPoint: v.string(),
    code: v.string(),
    allowedDependencies: v.array(v.string()),
    composition: studioComposition,
    commit: v.string(),
    sourcePath: v.string(),
    contentHash: v.string(),
    status: v.union(v.literal('validated'), v.literal('removed')),
    createdAt: v.number(),
  }).index('by_version', ['componentVersionId']),
})
