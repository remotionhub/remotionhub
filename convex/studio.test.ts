import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import schema from './schema'
import {
  getDefaultStudioTemplate,
  listStudioTemplates,
  upsertStudioTemplate,
} from './studio'

const modules = import.meta.glob('./**/*.*s')

const approvedTemplate = {
  templateId: 'approved-template',
  templateVersion: '1.0.0',
  runtime: 'remotion' as const,
  status: 'active' as const,
  priority: 20,
  supportedAspectRatios: ['16:9'],
  supportedResolutions: [{ width: 1280, height: 720 }],
  fps: 30,
  propsSchemaVersion: '1',
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline'],
    properties: {
      headline: { type: 'string', minLength: 1, maxLength: 120 },
    },
  },
  agentPrompt: 'Create a concise product launch video.',
  tags: ['launch'],
  previewStorageKey: 'studio/templates/approved-template/preview.mp4',
  licenseStatus: 'approved' as const,
}

const inactiveApprovedTemplate = {
  ...approvedTemplate,
  templateId: 'inactive-template',
  status: 'inactive' as const,
  priority: 5,
}

const pendingTemplate = {
  ...approvedTemplate,
  templateId: 'pending-template',
  priority: 10,
  licenseStatus: 'pending' as const,
}

describe('studio queries and mutations', () => {
  it('lists active approved templates in priority order and returns the default template', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(upsertStudioTemplate, approvedTemplate)
    await t.mutation(upsertStudioTemplate, inactiveApprovedTemplate)
    await t.mutation(upsertStudioTemplate, pendingTemplate)
    await t.mutation(upsertStudioTemplate, {
      ...approvedTemplate,
      templateId: 'lower-priority-template',
      priority: 10,
    })

    const templates = await t.query(listStudioTemplates, {})
    const defaultTemplate = await t.query(getDefaultStudioTemplate, {})

    expect(templates.map((template) => template.templateId)).toEqual([
      'lower-priority-template',
      'approved-template',
    ])
    expect(templates.every((template) => template.status === 'active')).toBe(true)
    expect(
      templates.every((template) => template.licenseStatus === 'approved'),
    ).toBe(true)
    expect(defaultTemplate?.templateId).toBe('lower-priority-template')
  })

  it('updates an existing studio template instead of creating a duplicate', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(upsertStudioTemplate, approvedTemplate)
    await t.mutation(upsertStudioTemplate, {
      ...approvedTemplate,
      agentPrompt: 'Updated prompt.',
    })

    const templates = await t.run(async (ctx) =>
      ctx.db.query('studioTemplates').collect(),
    )

    expect(templates).toHaveLength(1)
    expect(templates[0]?.agentPrompt).toBe('Updated prompt.')
  })
})
