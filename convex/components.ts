import semver from 'semver'
import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { DatabaseReader, DatabaseWriter } from './_generated/server'
import {
  buildDigestDoc,
  buildLatestVersionSummary,
  chooseLatestVersionDoc,
  isActiveStatus,
  isPrereleaseVersion,
} from './lib/catalog'

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
  entryPoint: v.string(),
  aspectRatios: v.array(v.string()),
  durationFrames: v.optional(v.number()),
  fps: v.optional(v.number()),
})

const artifact = v.object({
  kind: v.literal('github-source'),
  githubSource: v.object({
    repo: v.string(),
    ref: v.string(),
    commit: v.string(),
    path: v.string(),
    pinned: v.boolean(),
  }),
  license: v.string(),
  usageMarkdown: v.string(),
  agentPrompt: v.string(),
})

const importVersion = v.object({
  version: v.string(),
  changelog: v.string(),
  preview,
  metadata,
  tags: v.array(v.string()),
  fingerprint: v.string(),
  artifact,
})

type Runtime = 'remotion' | 'hyperframes'
type DbReader = DatabaseReader | DatabaseWriter
type CatalogDigest = Doc<'componentSearchDigest'>

async function getPublisherByHandle(db: DbReader, handle: string) {
  return await db
    .query('publishers')
    .withIndex('by_handle', (q) => q.eq('handle', handle))
    .unique()
}

async function getComponentByIdentity(
  db: DbReader,
  runtimeValue: Runtime,
  publisherId: Id<'publishers'>,
  slug: string,
) {
  return await db
    .query('components')
    .withIndex('by_runtime_publisher_slug', (q) =>
      q.eq('runtime', runtimeValue).eq('publisherId', publisherId).eq('slug', slug),
    )
    .unique()
}

async function getVersionByNumber(
  db: DbReader,
  componentId: Id<'components'>,
  version: string,
) {
  return await db
    .query('componentVersions')
    .withIndex('by_component_version', (q) =>
      q.eq('componentId', componentId).eq('version', version),
    )
    .unique()
}

async function syncComponentSearchDigest(
  db: DatabaseWriter,
  componentId: Id<'components'>,
) {
  const component = await db.get(componentId)
  if (!component?.latestVersionId) {
    return
  }

  const publisher = await db.get(component.publisherId)
  const latestVersion = await db.get(component.latestVersionId)
  if (!publisher || !latestVersion) {
    return
  }

  const existing = await db
    .query('componentSearchDigest')
    .withIndex('by_component', (q) => q.eq('componentId', componentId))
    .unique()

  const digest = buildDigestDoc({ component, publisher, latestVersion })
  if (existing) {
    await db.patch(existing._id, digest)
    return
  }

  await db.insert('componentSearchDigest', digest)
}

export const importCatalogComponent = mutation({
  args: {
    importSecret: v.string(),
    publisher: v.string(),
    publisherDisplayName: v.string(),
    runtime,
    slug: v.string(),
    displayName: v.string(),
    displayNameZh: v.optional(v.string()),
    summary: v.string(),
    summaryZh: v.optional(v.string()),
    categories: v.array(v.string()),
    tags: v.array(v.string()),
    status,
    catalogFile: v.string(),
    versions: v.array(importVersion),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.CATALOG_IMPORT_SECRET
    if (!expectedSecret || args.importSecret !== expectedSecret) {
      throw new ConvexError('Invalid catalog import secret.')
    }

    const now = Date.now()

    let publisher = await getPublisherByHandle(ctx.db, args.publisher)
    if (!publisher) {
      const publisherId = await ctx.db.insert('publishers', {
        handle: args.publisher,
        displayName: args.publisherDisplayName,
        createdAt: now,
        updatedAt: now,
      })
      publisher = await ctx.db.get(publisherId)
    }
    if (!publisher) {
      throw new ConvexError('Publisher creation failed.')
    }

    let component = await getComponentByIdentity(
      ctx.db,
      args.runtime,
      publisher._id,
      args.slug,
    )
    if (!component) {
      const componentId = await ctx.db.insert('components', {
        runtime: args.runtime,
        publisherId: publisher._id,
        slug: args.slug,
        displayName: args.displayName,
        displayNameZh: args.displayNameZh,
        summary: args.summary,
        summaryZh: args.summaryZh,
        categories: args.categories,
        tags: args.tags,
        status: args.status,
        isActive: isActiveStatus(args.status),
        stats: { views: 0, downloads: 0, stars: 0 },
        createdAt: now,
        updatedAt: now,
      })
      component = await ctx.db.get(componentId)
    } else {
      await ctx.db.patch(component._id, {
        displayName: args.displayName,
        displayNameZh: args.displayNameZh,
        summary: args.summary,
        summaryZh: args.summaryZh,
        categories: args.categories,
        tags: args.tags,
        status: args.status,
        isActive: isActiveStatus(args.status),
        updatedAt: now,
      })
      component = await ctx.db.get(component._id)
    }
    if (!component) {
      throw new ConvexError('Component creation failed.')
    }

    let createdVersions = 0
    let skippedVersions = 0

    for (const versionInput of args.versions) {
      if (!semver.valid(versionInput.version)) {
        throw new ConvexError(`Invalid semver version ${versionInput.version}.`)
      }

      const existing = await getVersionByNumber(
        ctx.db,
        component._id,
        versionInput.version,
      )
      if (existing) {
        if (existing.fingerprint !== versionInput.fingerprint) {
          throw new ConvexError(
            `Immutable version conflict for ${versionInput.version}.`,
          )
        }
        skippedVersions += 1
        continue
      }

      const versionId = await ctx.db.insert('componentVersions', {
        componentId: component._id,
        version: versionInput.version,
        changelog: versionInput.changelog,
        preview: versionInput.preview,
        metadata: versionInput.metadata,
        sourceProvenance: {
          catalogFile: args.catalogFile,
          importedAt: now,
          fingerprint: versionInput.fingerprint,
        },
        tags: versionInput.tags,
        isPrerelease: isPrereleaseVersion(versionInput.version),
        fingerprint: versionInput.fingerprint,
        createdAt: now,
        updatedAt: now,
      })

      await ctx.db.insert('artifacts', {
        componentVersionId: versionId,
        ...versionInput.artifact,
        createdAt: now,
      })
      createdVersions += 1
    }

    const versions = await ctx.db
      .query('componentVersions')
      .withIndex('by_component_created', (q) =>
        q.eq('componentId', component._id),
      )
      .collect()
    const latest = chooseLatestVersionDoc(versions)
    if (!latest) {
      throw new ConvexError('Imported component has no valid versions.')
    }

    const latestVersion = await ctx.db.get(latest.versionId)
    if (!latestVersion) {
      throw new ConvexError('Latest version lookup failed.')
    }

    await ctx.db.patch(component._id, {
      latestVersionId: latest.versionId,
      latestVersionSummary: buildLatestVersionSummary(latestVersion),
      latestIsPrerelease: latest.latestIsPrerelease,
      updatedAt: now,
    })
    await syncComponentSearchDigest(ctx.db, component._id)

    return { createdVersions, skippedVersions }
  },
})

export const listCatalog = query({
  args: {
    runtime: v.optional(runtime),
    tags: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    aspectRatio: v.optional(v.string()),
    sort: v.optional(v.union(v.literal('updated'), v.literal('newest'), v.literal('name'))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts.numItems
    const cursor = args.paginationOpts.cursor

    let allItems: CatalogDigest[] = []
    if (args.sort === 'name') {
      if (args.runtime) {
        const runtimeValue = args.runtime
        allItems = await ctx.db
          .query('componentSearchDigest')
          .withIndex('by_active_runtime_name', (q) =>
            q.eq('isActive', true).eq('runtime', runtimeValue),
          )
          .order('asc')
          .collect()
      } else {
        allItems = await ctx.db
          .query('componentSearchDigest')
          .withIndex('by_active_name', (q) => q.eq('isActive', true))
          .order('asc')
          .collect()
      }
    } else {
      if (args.runtime) {
        const runtimeValue = args.runtime
        allItems = await ctx.db
          .query('componentSearchDigest')
          .withIndex('by_active_runtime_updated', (q) =>
            q.eq('isActive', true).eq('runtime', runtimeValue),
          )
          .order('desc')
          .collect()
      } else {
        allItems = await ctx.db
          .query('componentSearchDigest')
          .withIndex('by_active_updated', (q) => q.eq('isActive', true))
          .order('desc')
          .collect()
      }
    }

    function matchesFilters(item: CatalogDigest) {
      if (args.tags?.length && !args.tags.every((tag) => item.tags.includes(tag))) {
        return false
      }
      if (
        args.categories?.length &&
        !args.categories.some((category) => item.categories.includes(category))
      ) {
        return false
      }
      if (
        args.aspectRatio &&
        !item.latestVersionSummary.metadata.aspectRatios.includes(args.aspectRatio)
      ) {
        return false
      }
      return true
    }

    const filtered = allItems.filter(matchesFilters)

    let startIndex = 0
    if (cursor) {
      const parsed = parseInt(cursor, 10)
      if (!isNaN(parsed)) {
        startIndex = parsed
      }
    }

    const page = filtered.slice(startIndex, startIndex + numItems)
    const nextIndex = startIndex + page.length
    const isDone = nextIndex >= filtered.length
    const continueCursor = isDone ? '' : String(nextIndex)

    return {
      page,
      isDone,
      continueCursor,
    }
  },
})

export const getCatalogDetail = query({
  args: {
    runtime,
    owner: v.string(),
    slug: v.string(),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const publisher = await getPublisherByHandle(ctx.db, args.owner)
    if (!publisher) {
      return null
    }

    const component = await getComponentByIdentity(
      ctx.db,
      args.runtime,
      publisher._id,
      args.slug,
    )
    if (
      !component ||
      component.status === 'removed' ||
      component.status === 'draft'
    ) {
      return null
    }

    const versions = await ctx.db
      .query('componentVersions')
      .withIndex('by_component_created', (q) =>
        q.eq('componentId', component._id),
      )
      .collect()
    const selectedVersion = args.version
      ? versions.find((item) => item.version === args.version)
      : component.latestVersionId
        ? await ctx.db.get(component.latestVersionId)
        : null
    if (!selectedVersion) {
      return null
    }

    const artifactDoc = await ctx.db
      .query('artifacts')
      .withIndex('by_version', (q) =>
        q.eq('componentVersionId', selectedVersion._id),
      )
      .unique()
    if (!artifactDoc) {
      return null
    }

    return {
      publisher,
      component,
      versions: versions.sort((left, right) =>
        semver.rcompare(left.version, right.version),
      ),
      selectedVersion,
      artifact: artifactDoc,
    }
  },
})

export const getCatalogFacets = query({
  args: {
    runtime: v.optional(runtime),
  },
  handler: async (ctx, args) => {
    let allItems: CatalogDigest[] = []
    if (args.runtime) {
      const runtimeValue = args.runtime
      allItems = await ctx.db
        .query('componentSearchDigest')
        .withIndex('by_active_runtime_updated', (q) =>
          q.eq('isActive', true).eq('runtime', runtimeValue),
        )
        .collect()
    } else {
      allItems = await ctx.db
        .query('componentSearchDigest')
        .withIndex('by_active_updated', (q) => q.eq('isActive', true))
        .collect()
    }

    const categories: Record<string, number> = {}
    const tags: Record<string, number> = {}

    for (const item of allItems) {
      for (const cat of item.categories) {
        categories[cat] = (categories[cat] ?? 0) + 1
      }
      for (const tag of item.tags) {
        tags[tag] = (tags[tag] ?? 0) + 1
      }
    }

    return {
      categories,
      tags,
    }
  },
})
