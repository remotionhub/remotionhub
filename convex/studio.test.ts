import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import schema from './schema'
import {
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
  getMyStudioHistory,
  getDefaultStudioTemplate,
  listStudioTemplates,
  refundGenerationJob,
  upsertStudioTemplate,
} from './studio'

const modules = import.meta.glob('./**/*.*s')
const studioTemplateImportSecret = 'test-studio-template-secret'

process.env.STUDIO_TEMPLATE_IMPORT_SECRET = studioTemplateImportSecret

const approvedTemplate = {
  importSecret: studioTemplateImportSecret,
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

const hyperframesTemplate = {
  ...approvedTemplate,
  templateId: 'hyperframes-template',
  runtime: 'hyperframes' as const,
  priority: 1,
}

const studioIdentity = {
  subject: 'studio-user-1',
  issuer: 'https://example.test',
  tokenIdentifier: 'https://example.test|studio-user-1',
}

const secondStudioIdentity = {
  subject: 'studio-user-2',
  issuer: 'https://example.test',
  tokenIdentifier: 'https://example.test|studio-user-2',
}

const createGenerationArgs = {
  idempotencyKey: 'idem-1',
  prompt: 'Create a concise launch video for a new AI product.',
  templateId: approvedTemplate.templateId,
  templateVersion: approvedTemplate.templateVersion,
  aspectRatio: '16:9',
  durationSeconds: 30,
  assetIds: [] as string[],
}

describe('studio queries and mutations', () => {
  it('rejects missing or wrong import secrets and accepts the correct one', async () => {
    const t = convexTest(schema, modules)
    const { importSecret: _ignoredImportSecret, ...templateWithoutSecret } =
      approvedTemplate

    await expect(
      t.mutation(upsertStudioTemplate, {
        ...approvedTemplate,
        importSecret: 'wrong-secret',
      }),
    ).rejects.toThrowError('Invalid studio template import secret.')

    await expect(
      t.mutation(upsertStudioTemplate, {
        ...approvedTemplate,
        importSecret: studioTemplateImportSecret,
      }),
    ).resolves.toEqual({ created: true })

    await expect(
      t.mutation(upsertStudioTemplate, templateWithoutSecret as never),
    ).rejects.toBeTruthy()
  })

  it('lists only remotion active approved templates in priority order and returns the default template', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(upsertStudioTemplate, approvedTemplate)
    await t.mutation(upsertStudioTemplate, inactiveApprovedTemplate)
    await t.mutation(upsertStudioTemplate, pendingTemplate)
    await t.mutation(upsertStudioTemplate, {
      ...approvedTemplate,
      templateId: 'lower-priority-template',
      priority: 10,
    })
    await t.mutation(upsertStudioTemplate, hyperframesTemplate)

    const templates = await t.query(listStudioTemplates, {})
    const defaultTemplate = await t.query(getDefaultStudioTemplate, {})

    expect(templates.map((template) => template.templateId)).toEqual([
      'lower-priority-template',
      'approved-template',
    ])
    expect(templates.every((template) => template.status === 'active')).toBe(
      true,
    )
    expect(
      templates.every((template) => template.licenseStatus === 'approved'),
    ).toBe(true)
    expect(templates.every((template) => template.runtime === 'remotion')).toBe(
      true,
    )
    expect(defaultTemplate?.templateId).toBe('lower-priority-template')
    expect(defaultTemplate?.runtime).toBe('remotion')
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

  it('creates one queued generation job per user and idempotency key and consumes credits once', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const firstJob = await authed.mutation(createGenerationJob, createGenerationArgs)
    const repeatedJob = await authed.mutation(createGenerationJob, createGenerationArgs)

    expect(firstJob._id).toBe(repeatedJob._id)
    expect(firstJob.status).toBe('queued')
    expect(repeatedJob.status).toBe('queued')

    const storedJob = await authed.query(getGenerationJob, {
      jobId: firstJob._id,
    })
    expect(storedJob?._id).toBe(firstJob._id)

    const ledger = await t.run(async (ctx) =>
      ctx.db
        .query('usageLedger')
        .withIndex('by_user_created', (q) =>
          q.eq('userId', studioIdentity.subject),
        )
        .collect(),
    )
    expect(ledger).toHaveLength(2)
    expect(ledger.map((entry) => entry.idempotencyKey).sort()).toEqual([
      `consume:${firstJob._id}`,
      `initial-grant-v1:${studioIdentity.subject}`,
    ])

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('generationJobEvents')
        .withIndex('by_job_created', (q) => q.eq('jobId', firstJob._id))
        .collect(),
    )
    expect(events.map((event) => event.type)).toEqual([
      'job_created',
      'credits_consumed',
    ])
  })

  it('blocks a second active job with a distinct idempotency key', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    await authed.mutation(createGenerationJob, createGenerationArgs)

    await expect(
      authed.mutation(createGenerationJob, {
        ...createGenerationArgs,
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toThrowError('ACTIVE_JOB_LIMIT')
  })

  it('cancels queued jobs with a refund and keeps the refund idempotent', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const job = await authed.mutation(createGenerationJob, createGenerationArgs)

    const canceledJob = await authed.mutation(cancelGenerationJob, {
      jobId: job._id,
      reason: 'Changed my mind.',
    })

    expect(canceledJob.status).toBe('canceled')
    expect(canceledJob.canceledAt).toEqual(expect.any(Number))
    expect(canceledJob.canceledBy).toBe(studioIdentity.subject)
    expect(canceledJob.cancelReason).toBe('Changed my mind.')
    expect(canceledJob.refundedAt).toEqual(expect.any(Number))

    const secondRefund = await authed.mutation(refundGenerationJob, {
      jobId: job._id,
      reason: 'Retry refund.',
    })
    expect(secondRefund.refunded).toBe(false)

    const ledger = await t.run(async (ctx) =>
      ctx.db
        .query('usageLedger')
        .withIndex('by_user_created', (q) =>
          q.eq('userId', studioIdentity.subject),
        )
        .collect(),
    )
    expect(ledger.map((entry) => entry.idempotencyKey).sort()).toEqual([
      `consume:${job._id}`,
      `initial-grant-v1:${studioIdentity.subject}`,
      `refund:${job._id}`,
    ])
  })

  it('refunds planning cancellations only before model start', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const job = await authed.mutation(createGenerationJob, createGenerationArgs)
    const secondAuthed = t.withIdentity(secondStudioIdentity)
    await t.mutation(upsertStudioTemplate, {
      ...approvedTemplate,
      templateId: 'approved-template-2',
    })
    const otherJob = await secondAuthed.mutation(createGenerationJob, {
      ...createGenerationArgs,
      templateId: 'approved-template-2',
      idempotencyKey: 'idem-other',
    })

    await t.run(async (ctx) => {
      await ctx.db.patch(job._id, {
        status: 'planning',
        updatedAt: Date.now(),
      })
      await ctx.db.patch(otherJob._id, {
        status: 'planning',
        modelStartedAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    const refundedPlanningJob = await authed.mutation(cancelGenerationJob, {
      jobId: job._id,
      reason: 'Cancel before model start.',
    })
    const nonRefundedPlanningJob = await secondAuthed.mutation(
      cancelGenerationJob,
      {
        jobId: otherJob._id,
        reason: 'Cancel after model start.',
      },
    )

    expect(refundedPlanningJob.refundedAt).toEqual(expect.any(Number))
    expect(nonRefundedPlanningJob.refundedAt).toBeUndefined()
  })

  it('returns only the current user history ordered by newest first and limited to ten', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(upsertStudioTemplate, approvedTemplate)

    await t.run(async (ctx) => {
      for (let index = 0; index < 12; index += 1) {
        await ctx.db.insert('generationJobs', {
          userId: studioIdentity.subject,
          status: 'completed',
          prompt: `Prompt ${index}`,
          runtime: 'remotion',
          aspectRatio: '16:9',
          durationSeconds: 30,
          templateId: approvedTemplate.templateId,
          templateVersion: approvedTemplate.templateVersion,
          propsSchemaVersion: approvedTemplate.propsSchemaVersion,
          assetIds: [],
          progress: 100,
          idempotencyKey: `history-${index}`,
          createdAt: 1_000 + index,
          updatedAt: 1_000 + index,
          completedAt: 1_000 + index,
        })
      }

      await ctx.db.insert('generationJobs', {
        userId: secondStudioIdentity.subject,
        status: 'completed',
        prompt: 'Other user prompt',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 30,
        templateId: approvedTemplate.templateId,
        templateVersion: approvedTemplate.templateVersion,
        propsSchemaVersion: approvedTemplate.propsSchemaVersion,
        assetIds: [],
        progress: 100,
        idempotencyKey: 'other-user-history',
        createdAt: 9_999,
        updatedAt: 9_999,
        completedAt: 9_999,
      })
    })

    const history = await t
      .withIdentity(studioIdentity)
      .query(getMyStudioHistory, {})

    expect(history).toHaveLength(10)
    expect(history[0]?.prompt).toBe('Prompt 11')
    expect(history[9]?.prompt).toBe('Prompt 2')
    expect(history.every((job) => job.userId === studioIdentity.subject)).toBe(
      true,
    )
  })
})
