import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import * as studioModule from './studio'

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

const safeGenerationJobKeys = [
  'artifactId',
  'aspectRatio',
  'canceledAt',
  'completedAt',
  'createdAt',
  'durationSeconds',
  'errorCode',
  'errorMessage',
  'failedAt',
  'id',
  'progress',
  'prompt',
  'runtime',
  'startedAt',
  'status',
  'templateId',
  'templateVersion',
  'updatedAt',
] as const

describe('studio queries and mutations', () => {
  it('does not expose a public arbitrary refund mutation', () => {
    expect('refundGenerationJob' in studioModule).toBe(false)
  })

  it('rejects missing or wrong import secrets and accepts the correct one', async () => {
    const t = convexTest(schema, modules)
    const { importSecret: _ignoredImportSecret, ...templateWithoutSecret } =
      approvedTemplate

    await expect(
      t.mutation(api.studio.upsertStudioTemplate, {
        ...approvedTemplate,
        importSecret: 'wrong-secret',
      }),
    ).rejects.toThrowError('Invalid studio template import secret.')

    await expect(
      t.mutation(api.studio.upsertStudioTemplate, {
        ...approvedTemplate,
        importSecret: studioTemplateImportSecret,
      }),
    ).resolves.toEqual({ created: true })

    await expect(
      t.mutation(api.studio.upsertStudioTemplate, templateWithoutSecret as never),
    ).rejects.toBeTruthy()
  })

  it('lists only remotion active approved templates in priority order and returns the default template', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)
    await t.mutation(api.studio.upsertStudioTemplate, inactiveApprovedTemplate)
    await t.mutation(api.studio.upsertStudioTemplate, pendingTemplate)
    await t.mutation(api.studio.upsertStudioTemplate, {
      ...approvedTemplate,
      templateId: 'lower-priority-template',
      priority: 10,
    })
    const { importSecret: _ignoredHyperframesSecret, ...hyperframesTemplateDoc } = hyperframesTemplate
    await t.run(async (ctx) => {
      await ctx.db.insert('studioTemplates', {
        ...hyperframesTemplateDoc,
        createdAt: 5,
        updatedAt: 5,
      })
    })

    const templates = await t.query(api.studio.listStudioTemplates, {})
    const defaultTemplate = await t.query(api.studio.getDefaultStudioTemplate, {})

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

    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)
    await t.mutation(api.studio.upsertStudioTemplate, {
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
    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const firstJob = await authed.mutation(api.studio.createGenerationJob, createGenerationArgs)
    const repeatedJob = await authed.mutation(api.studio.createGenerationJob, createGenerationArgs)

    expect(firstJob.id).toBe(repeatedJob.id)
    expect(firstJob.status).toBe('queued')
    expect(repeatedJob.status).toBe('queued')

    const storedJob = await authed.query(api.studio.getGenerationJob, {
      jobId: firstJob.id,
    })
    expect(storedJob?.id).toBe(firstJob.id)
    expect(Object.keys(storedJob ?? {}).sort()).toEqual([...safeGenerationJobKeys].sort())

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
      `consume:${firstJob.id}`,
      `initial-grant-v1:${studioIdentity.subject}`,
    ])

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('generationJobEvents')
        .withIndex('by_job_created', (q) => q.eq('jobId', firstJob.id))
        .collect(),
    )
    expect(events.map((event) => event.type)).toEqual([
      'job_created',
      'credits_consumed',
    ])
  })

  it('blocks a second active job with a distinct idempotency key', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    await authed.mutation(api.studio.createGenerationJob, createGenerationArgs)

    await expect(
      authed.mutation(api.studio.createGenerationJob, {
        ...createGenerationArgs,
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toThrowError('ACTIVE_JOB_LIMIT')
  })

  it('cancels queued jobs with a refund and keeps the refund idempotent across repeated cancellation', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const job = await authed.mutation(api.studio.createGenerationJob, createGenerationArgs)

    const canceledJob = await authed.mutation(api.studio.cancelGenerationJob, {
      jobId: job.id,
      reason: 'Changed my mind.',
    })

    expect(canceledJob.status).toBe('canceled')
    expect(canceledJob.canceledAt).toEqual(expect.any(Number))
    expect(canceledJob).not.toHaveProperty('refundedAt')

    const storedCanceledJob = await t.run(async (ctx) => ctx.db.get(job.id))
    expect(storedCanceledJob?.refundedAt).toEqual(expect.any(Number))

    const secondCancel = await authed.mutation(api.studio.cancelGenerationJob, {
      jobId: job.id,
      reason: 'Changed my mind again.',
    })
    expect(secondCancel.id).toBe(job.id)
    expect(secondCancel.status).toBe('canceled')
    expect(secondCancel).not.toHaveProperty('refundedAt')

    const ledger = await t.run(async (ctx) =>
      ctx.db
        .query('usageLedger')
        .withIndex('by_user_created', (q) =>
          q.eq('userId', studioIdentity.subject),
        )
        .collect(),
    )
    expect(ledger.map((entry) => entry.idempotencyKey).sort()).toEqual([
      `consume:${job.id}`,
      `initial-grant-v1:${studioIdentity.subject}`,
      `refund:${job.id}`,
    ])
  })

  it('refunds planning cancellations only before model start', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const job = await authed.mutation(api.studio.createGenerationJob, createGenerationArgs)
    const secondAuthed = t.withIdentity(secondStudioIdentity)
    await t.mutation(api.studio.upsertStudioTemplate, {
      ...approvedTemplate,
      templateId: 'approved-template-2',
    })
    const otherJob = await secondAuthed.mutation(api.studio.createGenerationJob, {
      ...createGenerationArgs,
      templateId: 'approved-template-2',
      idempotencyKey: 'idem-other',
    })

    await t.run(async (ctx) => {
      await ctx.db.patch(job.id, {
        status: 'planning',
        updatedAt: Date.now(),
      })
      await ctx.db.patch(otherJob.id, {
        status: 'planning',
        modelStartedAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    const refundedPlanningJob = await authed.mutation(api.studio.cancelGenerationJob, {
      jobId: job.id,
      reason: 'Cancel before model start.',
    })
    const nonRefundedPlanningJob = await secondAuthed.mutation(
      api.studio.cancelGenerationJob,
      {
        jobId: otherJob.id,
        reason: 'Cancel after model start.',
      },
    )

    const storedRefundedPlanningJob = await t.run(async (ctx) => ctx.db.get(job.id))
    const storedNonRefundedPlanningJob = await t.run(async (ctx) =>
      ctx.db.get(otherJob.id),
    )

    expect(storedRefundedPlanningJob?.refundedAt).toEqual(expect.any(Number))
    expect(storedNonRefundedPlanningJob?.refundedAt).toBeUndefined()
    expect(refundedPlanningJob).not.toHaveProperty('refundedAt')
    expect(nonRefundedPlanningJob).not.toHaveProperty('refundedAt')
  })

  it('rejects cancellation for completed and failed jobs without rewriting them', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)

    const authed = t.withIdentity(studioIdentity)
    const completedJobId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobs', {
        userId: studioIdentity.subject,
        status: 'completed',
        prompt: 'Completed prompt',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 30,
        templateId: approvedTemplate.templateId,
        templateVersion: approvedTemplate.templateVersion,
        propsSchemaVersion: approvedTemplate.propsSchemaVersion,
        assetIds: [],
        attemptCount: 1,
        progress: 100,
        idempotencyKey: 'completed-job',
        createdAt: 2_000,
        updatedAt: 2_000,
        completedAt: 2_000,
      }),
    )
    const failedJobId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobs', {
        userId: studioIdentity.subject,
        status: 'failed',
        prompt: 'Failed prompt',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 30,
        templateId: approvedTemplate.templateId,
        templateVersion: approvedTemplate.templateVersion,
        propsSchemaVersion: approvedTemplate.propsSchemaVersion,
        assetIds: [],
        progress: 100,
        attemptCount: 1,
        idempotencyKey: 'failed-job',
        createdAt: 3_000,
        updatedAt: 3_000,
        failedAt: 3_000,
        errorCode: 'FAILED',
        errorMessage: 'Render failed',
      }),
    )

    await expect(
      authed.mutation(api.studio.cancelGenerationJob, {
        jobId: completedJobId,
        reason: 'Too late.',
      }),
    ).rejects.toThrowError('INVALID_CANCEL_STATE')
    await expect(
      authed.mutation(api.studio.cancelGenerationJob, {
        jobId: failedJobId,
        reason: 'Already failed.',
      }),
    ).rejects.toThrowError('INVALID_CANCEL_STATE')

    const [storedCompleted, storedFailed] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(completedJobId), ctx.db.get(failedJobId)]),
    )

    expect(storedCompleted?.status).toBe('completed')
    expect(storedCompleted?.canceledAt).toBeUndefined()
    expect(storedFailed?.status).toBe('failed')
    expect(storedFailed?.canceledAt).toBeUndefined()
  })

  it('returns only user-safe generation job fields for detail and history', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(api.studio.upsertStudioTemplate, approvedTemplate)

    const detailJobId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobs', {
        userId: studioIdentity.subject,
        status: 'rendering',
        prompt: 'Private detail prompt',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 45,
        templateId: approvedTemplate.templateId,
        templateVersion: approvedTemplate.templateVersion,
        propsSchemaVersion: approvedTemplate.propsSchemaVersion,
        assetIds: ['asset-1'],
        attemptCount: 1,
        progress: 60,
        plannerOutput: { secret: true },
        workerId: 'worker-1',
        lockedAt: 4_000,
        heartbeatAt: 4_001,
        lockExpiresAt: 4_002,
        modelStartedAt: 4_003,
        refundedAt: 4_004,
        idempotencyKey: 'private-detail-job',
        createdAt: 4_000,
        updatedAt: 4_005,
        startedAt: 4_003,
      }),
    )

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
          attemptCount: 1,
          progress: 100,
          plannerOutput: { index },
          workerId: `worker-${index}`,
          idempotencyKey: `history-${index}`,
          createdAt: 10_000 + index,
          updatedAt: 10_000 + index,
          completedAt: 10_000 + index,
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
        attemptCount: 1,
        progress: 100,
        plannerOutput: { other: true },
        workerId: 'worker-other',
        idempotencyKey: 'other-user-history',
        createdAt: 99_999,
        updatedAt: 99_999,
        completedAt: 99_999,
      })
    })

    const authed = t.withIdentity(studioIdentity)
    const detail = await authed.query(api.studio.getGenerationJob, {
      jobId: detailJobId,
    })
    const history = await authed.query(api.studio.getMyStudioHistory, {})

    expect(detail.id).toBe(detailJobId)
    expect(Object.keys(detail).sort()).toEqual([...safeGenerationJobKeys].sort())
    expect(detail).not.toHaveProperty('plannerOutput')
    expect(detail).not.toHaveProperty('workerId')
    expect(detail).not.toHaveProperty('lockedAt')
    expect(detail).not.toHaveProperty('heartbeatAt')
    expect(detail).not.toHaveProperty('lockExpiresAt')
    expect(detail).not.toHaveProperty('modelStartedAt')
    expect(detail).not.toHaveProperty('refundedAt')
    expect(detail).not.toHaveProperty('idempotencyKey')

    expect(history).toHaveLength(10)
    expect(history[0]?.prompt).toBe('Prompt 11')
    expect(history[9]?.prompt).toBe('Prompt 2')
    expect(history.some((job) => job.prompt === 'Other user prompt')).toBe(false)
    expect(history.every((job) => !('plannerOutput' in job))).toBe(true)
    expect(history.every((job) => !('workerId' in job))).toBe(true)
    expect(history.every((job) => !('idempotencyKey' in job))).toBe(true)
    expect(history.every((job) => !('userId' in job))).toBe(true)
  })
})
