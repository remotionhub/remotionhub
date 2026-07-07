import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  getDefaultStudioTemplate as getDefaultStudioTemplateFromList,
  listActiveApprovedStudioTemplates,
  type StudioTemplateSeed,
} from './lib/studio/templates'

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
