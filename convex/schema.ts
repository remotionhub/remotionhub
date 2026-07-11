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

const users = defineTable({
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
  .index('by_handle', ['handle'])
  .index('by_email', ['email'])
  .index('email', ['email'])
  .index('phone', ['phone'])

export default defineSchema({
  ...authTables,
  users,

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
})
