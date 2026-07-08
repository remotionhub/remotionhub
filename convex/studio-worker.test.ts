import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { p0StudioTemplateSeed } from './lib/studio/templates'
import { createStubRenderPlan } from '../scripts/studio-planner'

const modules = import.meta.glob('./**/*.*s')
const WORKER_SECRET = 'studio-worker-secret'
const ORIGINAL_WORKER_SECRET = process.env.STUDIO_WORKER_SECRET

function createModelRun(attemptIndex = 0) {
  return {
    provider: 'openai',
    model: 'gpt-4.1',
    attemptIndex,
    runType: 'plan' as const,
    inputDigest: 'input-digest',
    outputDigest: 'output-digest',
    inputSnapshotRef: 'studio/jobs/job_1/model-input.json',
    outputSnapshotRef: 'studio/jobs/job_1/model-output.json',
    promptVersion: '1',
    schemaVersion: '1',
    tokenUsage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
    estimatedCost: 0.12,
    latencyMs: 1000,
  }
}

function createRenderRun() {
  return {
    runtime: 'remotion' as const,
    templateId: p0StudioTemplateSeed.templateId,
    templateVersion: p0StudioTemplateSeed.templateVersion,
    rendererVersion: '1.0.0',
    remotionVersion: '4.0.0',
    workerVersion: '1.0.0',
    startedAt: 100,
    renderInputSnapshotRef: 'studio/jobs/job_1/render-input.json',
  }
}

function createWorkerRenderPlan(prompt: string) {
  const plan = createStubRenderPlan(prompt, p0StudioTemplateSeed)

  return {
    ...plan,
    props: Object.fromEntries(
      Object.entries(plan.props).map(([key, value]) => [key, String(value)]),
    ),
  }
}

function createArtifact(durationSeconds: number) {
  return {
    storageKey: 'studio/job-1/artifact.mp4',
    thumbnailStorageKey: 'studio/job-1/artifact-thumbnail.jpg',
    fileSizeBytes: 1_024,
    mimeType: 'video/mp4',
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds,
    aspectRatio: '16:9',
    runtime: 'remotion' as const,
  }
}

async function seedStudioTemplate(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert('studioTemplates', {
      ...p0StudioTemplateSeed,
      createdAt: 1,
      updatedAt: 1,
    })
  })
}

async function seedQueuedJob(t: ReturnType<typeof convexTest>, jobIdempotencyKey: string) {
  return t.run(async (ctx) =>
    ctx.db.insert('generationJobs', {
      userId: 'studio-user-1',
      status: 'queued',
      prompt: 'Launch an AI analytics dashboard',
      runtime: 'remotion',
      aspectRatio: '16:9',
      durationSeconds: 15,
      templateId: p0StudioTemplateSeed.templateId,
      templateVersion: p0StudioTemplateSeed.templateVersion,
      propsSchemaVersion: p0StudioTemplateSeed.propsSchemaVersion,
      assetIds: [],
      attemptCount: 0,
      progress: 5,
      idempotencyKey: jobIdempotencyKey,
      createdAt: 10,
      updatedAt: 10,
    }),
  )
}

async function seedConsumedCredit(
  t: ReturnType<typeof convexTest>,
  jobId: string,
  userId = 'studio-user-1',
) {
  await t.run(async (ctx) => {
    await ctx.db.insert('usageLedger', {
      userId,
      kind: 'consume',
      amount: -1,
      balanceAfter: 0,
      jobId: jobId as never,
      reason: 'Seeded studio consume entry.',
      idempotencyKey: `consume:${jobId}`,
      createdAt: 9,
    })
  })
}

describe('studio worker mutations', () => {
  beforeEach(() => {
    process.env.STUDIO_WORKER_SECRET = WORKER_SECRET
  })

  afterEach(() => {
    if (ORIGINAL_WORKER_SECRET === undefined) {
      delete process.env.STUDIO_WORKER_SECRET
      return
    }

    process.env.STUDIO_WORKER_SECRET = ORIGINAL_WORKER_SECRET
  })

  it('claims and completes a generation job through the worker state machine', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await seedQueuedJob(t, 'worker-happy-path')
    const renderPlan = createWorkerRenderPlan('Launch an AI analytics dashboard')

    const claimedJob = await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    expect(claimedJob?.id).toBe(jobId)
    expect(claimedJob?.attemptCount).toBe(1)
    expect(claimedJob?.status).toBe('planning')
    expect(claimedJob?.workerId).toBe('worker-1')
    expect(claimedJob?.startedAt).toEqual(expect.any(Number))

    await t.mutation(api.studio.markModelStarted, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
    })

    await t.mutation(api.studio.completePlanning, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      renderPlan,
      modelRun: createModelRun(),
    })

    await t.mutation(api.studio.startRendering, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      renderRun: createRenderRun(),
    })

    await t.mutation(api.studio.startUploading, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
    })

    const completedJob = await t.mutation(api.studio.completeGenerationJob, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      artifact: createArtifact(renderPlan.output.durationSeconds),
      renderRun: {
        completedAt: 200,
        durationMs: 100,
        exitCode: 0,
        outputStorageKey: 'studio/job-1/artifact.mp4',
      },
    })

    expect(completedJob.status).toBe('completed')
    expect(completedJob.progress).toBe(100)
    expect(completedJob.attemptCount).toBe(1)

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    const storedArtifact = storedJob?.artifactId
      ? await t.run(async (ctx) => ctx.db.get(storedJob.artifactId!))
      : null
    const modelRuns = await t.run(async (ctx) =>
      ctx.db
        .query('modelRuns')
        .withIndex('by_job_created', (q) => q.eq('jobId', jobId))
        .collect(),
    )
    const renderRuns = await t.run(async (ctx) =>
      ctx.db
        .query('renderRuns')
        .withIndex('by_job_created', (q) => q.eq('jobId', jobId))
        .collect(),
    )
    const events = await t.run(async (ctx) =>
      ctx.db
        .query('generationJobEvents')
        .withIndex('by_job_created', (q) => q.eq('jobId', jobId))
        .collect(),
    )

    expect(storedJob?.plannerOutput).toEqual(
      renderPlan,
    )
    expect(storedJob?.attemptCount).toBe(1)
    expect(storedArtifact?.storageKey).toBe('studio/job-1/artifact.mp4')
    expect(modelRuns).toHaveLength(1)
    expect(renderRuns).toHaveLength(1)
    expect(renderRuns[0]?.completedAt).toBe(200)
    expect(events.map((event) => event.type)).toEqual([
      'planning_started',
      'model_started',
      'rendering_started',
      'uploading_started',
      'job_completed',
    ])
  })

  it('rejects worker state transitions when worker ownership does not match', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await seedQueuedJob(t, 'worker-mismatch')

    await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    await expect(
      t.mutation(api.studio.markModelStarted, {
        jobId,
        workerId: 'worker-2',
        workerSecret: WORKER_SECRET,
      }),
    ).rejects.toThrowError('INVALID_WORKER_STATE')
  })

  it('rejects missing or incorrect worker secrets before worker reads or mutations', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await seedQueuedJob(t, 'worker-secret-guard')
    const renderPlan = createWorkerRenderPlan(
      'Launch an AI analytics dashboard',
    )

    delete process.env.STUDIO_WORKER_SECRET
    await expect(
      t.mutation(api.studio.claimNextGenerationJob, {
        workerId: 'worker-1',
        workerSecret: WORKER_SECRET,
        lockTtlMs: 30_000,
      }),
    ).rejects.toThrowError('INVALID_WORKER_SECRET')

    process.env.STUDIO_WORKER_SECRET = WORKER_SECRET

    await expect(
      t.mutation(api.studio.claimNextGenerationJob, {
        workerId: 'worker-1',
        workerSecret: 'wrong-secret',
        lockTtlMs: 30_000,
      }),
    ).rejects.toThrowError('INVALID_WORKER_SECRET')

    const unclaimedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(unclaimedJob?.status).toBe('queued')
    expect(unclaimedJob?.workerId).toBeUndefined()

    await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    const invalidSecretMutations = [
      () =>
        t.mutation(api.studio.markModelStarted, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
        }),
      () =>
        t.mutation(api.studio.completePlanning, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          renderPlan,
          modelRun: createModelRun(),
        }),
      () =>
        t.mutation(api.studio.startRendering, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          renderRun: createRenderRun(),
        }),
      () =>
        t.mutation(api.studio.startUploading, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
        }),
      () =>
        t.mutation(api.studio.completeGenerationJob, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          artifact: createArtifact(renderPlan.output.durationSeconds),
          renderRun: {
            completedAt: 200,
            durationMs: 100,
            exitCode: 0,
            outputStorageKey: 'studio/job-1/artifact.mp4',
          },
        }),
      () =>
        t.mutation(api.studio.failGenerationJob, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          errorCode: 'MODEL_PROVIDER_ERROR',
          errorMessage: 'Planner backend unavailable.',
        }),
    ]

    for (const runMutation of invalidSecretMutations) {
      await expect(runMutation()).rejects.toThrowError('INVALID_WORKER_SECRET')
    }

    const guardedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(guardedJob?.status).toBe('planning')
    expect(guardedJob?.workerId).toBe('worker-1')
    expect(guardedJob?.plannerOutput).toBeUndefined()
  })

  it('fails an active claimed generation job and records the terminal error', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await seedQueuedJob(t, 'worker-failure')
    await seedConsumedCredit(t, jobId)

    await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    const failedJob = await t.mutation(api.studio.failGenerationJob, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      errorCode: 'MODEL_PROVIDER_ERROR',
      errorMessage: 'Planner backend unavailable.',
    })

    expect(failedJob.status).toBe('failed')
    expect(failedJob.workerId).toBe('worker-1')

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    const ledger = await t.run(async (ctx) =>
      ctx.db
        .query('usageLedger')
        .withIndex('by_user_created', (q) => q.eq('userId', 'studio-user-1'))
        .collect(),
    )
    const events = await t.run(async (ctx) =>
      ctx.db
        .query('generationJobEvents')
        .withIndex('by_job_created', (q) => q.eq('jobId', jobId))
        .collect(),
    )

    expect(storedJob?.errorCode).toBe('MODEL_PROVIDER_ERROR')
    expect(storedJob?.errorMessage).toBe('Planner backend unavailable.')
    expect(storedJob?.failedAt).toEqual(expect.any(Number))
    expect(storedJob?.refundedAt).toEqual(expect.any(Number))
    expect(ledger.map((entry) => entry.idempotencyKey).sort()).toEqual([
      `consume:${jobId}`,
      `refund:${jobId}`,
    ])
    expect(events.map((event) => event.type)).toEqual([
      'planning_started',
      'job_failed',
      'credits_refunded',
    ])
  })

  it('updates the stored job summary from the validated render plan output', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobs', {
        userId: 'studio-user-1',
        status: 'queued',
        prompt: 'Launch an AI analytics dashboard',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 30,
        templateId: p0StudioTemplateSeed.templateId,
        templateVersion: p0StudioTemplateSeed.templateVersion,
        propsSchemaVersion: p0StudioTemplateSeed.propsSchemaVersion,
        assetIds: [],
        attemptCount: 0,
        progress: 5,
        idempotencyKey: 'planning-summary-sync',
        createdAt: 10,
        updatedAt: 10,
      }),
    )
    const renderPlan = createWorkerRenderPlan('Launch an AI analytics dashboard')

    await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })
    await t.mutation(api.studio.markModelStarted, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
    })
    await t.mutation(api.studio.completePlanning, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      renderPlan,
      modelRun: createModelRun(),
    })

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(storedJob?.aspectRatio).toBe(renderPlan.output.aspectRatio)
    expect(storedJob?.durationSeconds).toBe(renderPlan.output.durationSeconds)
  })

  it.each([
    {
      label: 'exceeds',
      scenes: [
        {
          id: 'scene-1',
          durationSeconds: 10,
          headline: 'Scene one',
          subtitle: 'Part one',
          body: 'Body one',
          visualHint: 'Hint one',
        },
        {
          id: 'scene-2',
          durationSeconds: 6,
          headline: 'Scene two',
          subtitle: 'Part two',
          body: 'Body two',
          visualHint: 'Hint two',
        },
      ],
    },
    {
      label: 'falls short',
      scenes: [
        {
          id: 'scene-1',
          durationSeconds: 10,
          headline: 'Scene one',
          subtitle: 'Part one',
          body: 'Body one',
          visualHint: 'Hint one',
        },
        {
          id: 'scene-2',
          durationSeconds: 4,
          headline: 'Scene two',
          subtitle: 'Part two',
          body: 'Body two',
          visualHint: 'Hint two',
        },
      ],
    },
  ])(
    'rejects planning completion when multi-scene duration $label output duration',
    async ({ scenes }) => {
      const t = convexTest(schema, modules)
      await seedStudioTemplate(t)
      const jobId = await seedQueuedJob(t, 'invalid-scene-duration')
      const renderPlan = createWorkerRenderPlan(
        'Launch an AI analytics dashboard',
      )

      renderPlan.scenes = scenes

      await t.mutation(api.studio.claimNextGenerationJob, {
        workerId: 'worker-1',
        workerSecret: WORKER_SECRET,
        lockTtlMs: 30_000,
      })

      await expect(
        t.mutation(api.studio.completePlanning, {
          jobId,
          workerId: 'worker-1',
          workerSecret: WORKER_SECRET,
          renderPlan,
          modelRun: createModelRun(),
        }),
      ).rejects.toThrowError('PLAN_VALIDATION_FAILED')

      const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
      const modelRuns = await t.run(async (ctx) =>
        ctx.db
          .query('modelRuns')
          .withIndex('by_job_created', (q) => q.eq('jobId', jobId))
          .collect(),
      )

      expect(storedJob?.plannerOutput).toBeUndefined()
      expect(modelRuns).toHaveLength(0)
    },
  )

  it('reclaims an expired planning lock and increments the attempt count', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobs', {
        userId: 'studio-user-1',
        status: 'planning',
        prompt: 'Launch an AI analytics dashboard',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 15,
        templateId: p0StudioTemplateSeed.templateId,
        templateVersion: p0StudioTemplateSeed.templateVersion,
        propsSchemaVersion: p0StudioTemplateSeed.propsSchemaVersion,
        assetIds: [],
        attemptCount: 1,
        progress: 20,
        idempotencyKey: 'stale-planning-job',
        workerId: 'worker-stale',
        lockedAt: 10,
        heartbeatAt: 20,
        lockExpiresAt: 30,
        startedAt: 10,
        createdAt: 10,
        updatedAt: 30,
      }),
    )

    const claimedJob = await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-2',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    expect(claimedJob?.id).toBe(jobId)
    expect(claimedJob?.workerId).toBe('worker-2')
    expect(claimedJob?.status).toBe('planning')
    expect(claimedJob?.attemptCount).toBe(2)

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(storedJob?.attemptCount).toBe(2)
    expect(storedJob?.workerId).toBe('worker-2')
    expect(storedJob?.status).toBe('planning')
  })

  it('reclaims an expired planning lock with stale modelStartedAt and allows the next attempt to start', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobs', {
        userId: 'studio-user-1',
        status: 'planning',
        prompt: 'Launch an AI analytics dashboard',
        runtime: 'remotion',
        aspectRatio: '16:9',
        durationSeconds: 15,
        templateId: p0StudioTemplateSeed.templateId,
        templateVersion: p0StudioTemplateSeed.templateVersion,
        propsSchemaVersion: p0StudioTemplateSeed.propsSchemaVersion,
        assetIds: [],
        attemptCount: 1,
        progress: 20,
        idempotencyKey: 'stale-planning-model-started',
        workerId: 'worker-stale',
        lockedAt: 10,
        heartbeatAt: 20,
        lockExpiresAt: 30,
        startedAt: 10,
        modelStartedAt: 25,
        createdAt: 10,
        updatedAt: 30,
      }),
    )

    const claimedJob = await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-2',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    expect(claimedJob?.id).toBe(jobId)
    expect(claimedJob?.attemptCount).toBe(2)

    await t.mutation(api.studio.markModelStarted, {
      jobId,
      workerId: 'worker-2',
      workerSecret: WORKER_SECRET,
    })

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(storedJob?.attemptCount).toBe(2)
    expect(storedJob?.workerId).toBe('worker-2')
    expect(storedJob?.status).toBe('planning')
    expect(storedJob?.modelStartedAt).toEqual(expect.any(Number))
  })

  it.each([
    ['rendering', 'RENDER_TIMEOUT'],
    ['uploading', 'UPLOAD_FAILED'],
  ] as const)(
    'fails stale %s locks before claiming the next queued job',
    async (status, errorCode) => {
      const t = convexTest(schema, modules)
      await seedStudioTemplate(t)
      const staleJobId = await t.run(async (ctx) =>
        ctx.db.insert('generationJobs', {
          userId: 'studio-user-1',
          status,
          prompt: 'Launch an AI analytics dashboard',
          runtime: 'remotion',
          aspectRatio: '16:9',
          durationSeconds: 15,
          templateId: p0StudioTemplateSeed.templateId,
          templateVersion: p0StudioTemplateSeed.templateVersion,
          propsSchemaVersion: p0StudioTemplateSeed.propsSchemaVersion,
          assetIds: [],
          attemptCount: 1,
          progress: status === 'rendering' ? 60 : 90,
          idempotencyKey: `stale-${status}-job`,
          workerId: 'worker-stale',
          lockedAt: 10,
          heartbeatAt: 20,
          lockExpiresAt: 30,
          startedAt: 10,
          modelStartedAt: 15,
          createdAt: 10,
          updatedAt: 30,
        }),
      )
      await seedConsumedCredit(t, staleJobId)
      const queuedJobId = await seedQueuedJob(t, `queued-after-${status}`)

      const claimedJob = await t.mutation(api.studio.claimNextGenerationJob, {
        workerId: 'worker-2',
        workerSecret: WORKER_SECRET,
        lockTtlMs: 30_000,
      })

      expect(claimedJob?.id).toBe(queuedJobId)
      expect(claimedJob?.attemptCount).toBe(1)

      const staleJob = await t.run(async (ctx) => ctx.db.get(staleJobId))
      const staleJobEvents = await t.run(async (ctx) =>
        ctx.db
          .query('generationJobEvents')
          .withIndex('by_job_created', (q) => q.eq('jobId', staleJobId))
          .collect(),
      )
      const ledger = await t.run(async (ctx) =>
        ctx.db
          .query('usageLedger')
          .withIndex('by_user_created', (q) => q.eq('userId', 'studio-user-1'))
          .collect(),
      )
      expect(staleJob?.status).toBe('failed')
      expect(staleJob?.errorCode).toBe(errorCode)
      expect(staleJob?.workerId).toBe('worker-stale')
      expect(staleJob?.refundedAt).toEqual(expect.any(Number))
      expect(
        ledger.filter((entry) => entry.idempotencyKey === `refund:${staleJobId}`),
      ).toHaveLength(1)
      expect(staleJobEvents.map((event) => event.type)).toEqual([
        'job_failed',
        'credits_refunded',
      ])
    },
  )

  it('rejects invalid phase transitions and preserves terminal job immutability', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await seedQueuedJob(t, 'invalid-transition')

    await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    await expect(
      t.mutation(api.studio.startUploading, {
        jobId,
        workerId: 'worker-1',
        workerSecret: WORKER_SECRET,
      }),
    ).rejects.toThrowError('INVALID_WORKER_STATE')

    await t.mutation(api.studio.failGenerationJob, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      errorCode: 'MODEL_PROVIDER_ERROR',
      errorMessage: 'Planner backend unavailable.',
    })

    await expect(
      t.mutation(api.studio.markModelStarted, {
        jobId,
        workerId: 'worker-1',
        workerSecret: WORKER_SECRET,
      }),
    ).rejects.toThrowError('INVALID_WORKER_STATE')
  })

  it('rejects duplicate planning completion once planning output already exists', async () => {
    const t = convexTest(schema, modules)
    await seedStudioTemplate(t)
    const jobId = await seedQueuedJob(t, 'duplicate-planning')
    const renderPlan = createWorkerRenderPlan(
      'Launch an AI analytics dashboard',
    )

    await t.mutation(api.studio.claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    await t.mutation(api.studio.completePlanning, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      renderPlan,
      modelRun: createModelRun(),
    })

    await expect(
      t.mutation(api.studio.completePlanning, {
        jobId,
        workerId: 'worker-1',
        workerSecret: WORKER_SECRET,
        renderPlan,
        modelRun: createModelRun(1),
      }),
    ).rejects.toThrowError('INVALID_WORKER_STATE')

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(storedJob?.plannerOutput).toEqual(renderPlan)
    expect(storedJob?.status).toBe('planning')
  })
})
