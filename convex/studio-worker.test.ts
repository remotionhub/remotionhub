import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import schema from './schema'
import {
  claimNextGenerationJob,
  completeGenerationJob,
  completePlanning,
  failGenerationJob,
  markModelStarted,
  startRendering,
  startUploading,
} from './studio'
import { p0StudioTemplateSeed } from './lib/studio/templates'
import { createStubRenderPlan } from '../scripts/studio-planner'

const modules = import.meta.glob('./**/*.*s')
const WORKER_SECRET = 'studio-worker-secret'
const ORIGINAL_WORKER_SECRET = process.env.STUDIO_WORKER_SECRET

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
      progress: 5,
      idempotencyKey: jobIdempotencyKey,
      createdAt: 10,
      updatedAt: 10,
    }),
  )
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

    const claimedJob = await t.mutation(claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    expect(claimedJob?.id).toBe(jobId)
    expect(claimedJob?.status).toBe('planning')
    expect(claimedJob?.workerId).toBe('worker-1')
    expect(claimedJob?.startedAt).toEqual(expect.any(Number))

    await t.mutation(markModelStarted, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
    })

    await t.mutation(completePlanning, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      renderPlan: createStubRenderPlan(
        'Launch an AI analytics dashboard',
        p0StudioTemplateSeed,
      ),
      modelRun: {
        provider: 'openai',
        model: 'gpt-4.1',
        attemptIndex: 0,
        runType: 'plan',
        inputDigest: 'input-digest',
        outputDigest: 'output-digest',
        inputSnapshotRef: 'studio/jobs/job_1/model-input.json',
        outputSnapshotRef: 'studio/jobs/job_1/model-output.json',
        promptVersion: '1',
        schemaVersion: '1',
        tokenUsage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
        estimatedCost: 0.12,
        latencyMs: 1000,
      },
    })

    await t.mutation(startRendering, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      renderRun: {
        runtime: 'remotion',
        templateId: p0StudioTemplateSeed.templateId,
        templateVersion: p0StudioTemplateSeed.templateVersion,
        rendererVersion: '1.0.0',
        remotionVersion: '4.0.0',
        workerVersion: '1.0.0',
        startedAt: 100,
        renderInputSnapshotRef: 'studio/jobs/job_1/render-input.json',
      },
    })

    await t.mutation(startUploading, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
    })

    const completedJob = await t.mutation(completeGenerationJob, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      artifact: {
        storageKey: 'studio/jobs/job_1/render-output.mp4',
        thumbnailStorageKey: 'studio/jobs/job_1/render-output.jpg',
        fileSizeBytes: 1_024,
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'remotion',
      },
      renderRun: {
        completedAt: 200,
        durationMs: 100,
        exitCode: 0,
        outputStorageKey: 'studio/jobs/job_1/render-output.mp4',
      },
    })

    expect(completedJob.status).toBe('completed')
    expect(completedJob.progress).toBe(100)

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
      createStubRenderPlan('Launch an AI analytics dashboard', p0StudioTemplateSeed),
    )
    expect(storedArtifact?.storageKey).toBe('studio/jobs/job_1/render-output.mp4')
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

    await t.mutation(claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    await expect(
      t.mutation(markModelStarted, {
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
    const renderPlan = createStubRenderPlan(
      'Launch an AI analytics dashboard',
      p0StudioTemplateSeed,
    )

    delete process.env.STUDIO_WORKER_SECRET
    await expect(
      t.mutation(claimNextGenerationJob, {
        workerId: 'worker-1',
        workerSecret: WORKER_SECRET,
        lockTtlMs: 30_000,
      }),
    ).rejects.toThrowError('INVALID_WORKER_SECRET')

    process.env.STUDIO_WORKER_SECRET = WORKER_SECRET

    await expect(
      t.mutation(claimNextGenerationJob, {
        workerId: 'worker-1',
        workerSecret: 'wrong-secret',
        lockTtlMs: 30_000,
      }),
    ).rejects.toThrowError('INVALID_WORKER_SECRET')

    const unclaimedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    expect(unclaimedJob?.status).toBe('queued')
    expect(unclaimedJob?.workerId).toBeUndefined()

    await t.mutation(claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    const invalidSecretMutations = [
      () =>
        t.mutation(markModelStarted, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
        }),
      () =>
        t.mutation(completePlanning, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          renderPlan,
          modelRun: {
            provider: 'openai',
            model: 'gpt-4.1',
            attemptIndex: 0,
            runType: 'plan',
            inputDigest: 'input-digest',
            outputDigest: 'output-digest',
            inputSnapshotRef: 'studio/jobs/job_1/model-input.json',
            outputSnapshotRef: 'studio/jobs/job_1/model-output.json',
            promptVersion: '1',
            schemaVersion: '1',
            tokenUsage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
            estimatedCost: 0.12,
            latencyMs: 1000,
          },
        }),
      () =>
        t.mutation(startRendering, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          renderRun: {
            runtime: 'remotion',
            templateId: p0StudioTemplateSeed.templateId,
            templateVersion: p0StudioTemplateSeed.templateVersion,
            rendererVersion: '1.0.0',
            remotionVersion: '4.0.0',
            workerVersion: '1.0.0',
            startedAt: 100,
            renderInputSnapshotRef: 'studio/jobs/job_1/render-input.json',
          },
        }),
      () =>
        t.mutation(startUploading, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
        }),
      () =>
        t.mutation(completeGenerationJob, {
          jobId,
          workerId: 'worker-1',
          workerSecret: 'wrong-secret',
          artifact: {
            storageKey: 'studio/jobs/job_1/render-output.mp4',
            thumbnailStorageKey: 'studio/jobs/job_1/render-output.jpg',
            fileSizeBytes: 1_024,
            mimeType: 'video/mp4',
            width: 1280,
            height: 720,
            fps: 30,
            durationSeconds: 15,
            aspectRatio: '16:9',
            runtime: 'remotion',
          },
          renderRun: {
            completedAt: 200,
            durationMs: 100,
            exitCode: 0,
            outputStorageKey: 'studio/jobs/job_1/render-output.mp4',
          },
        }),
      () =>
        t.mutation(failGenerationJob, {
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

    await t.mutation(claimNextGenerationJob, {
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      lockTtlMs: 30_000,
    })

    const failedJob = await t.mutation(failGenerationJob, {
      jobId,
      workerId: 'worker-1',
      workerSecret: WORKER_SECRET,
      errorCode: 'MODEL_PROVIDER_ERROR',
      errorMessage: 'Planner backend unavailable.',
    })

    expect(failedJob.status).toBe('failed')
    expect(failedJob.workerId).toBe('worker-1')

    const storedJob = await t.run(async (ctx) => ctx.db.get(jobId))
    const events = await t.run(async (ctx) =>
      ctx.db
        .query('generationJobEvents')
        .withIndex('by_job_created', (q) => q.eq('jobId', jobId))
        .collect(),
    )

    expect(storedJob?.errorCode).toBe('MODEL_PROVIDER_ERROR')
    expect(storedJob?.errorMessage).toBe('Planner backend unavailable.')
    expect(storedJob?.failedAt).toEqual(expect.any(Number))
    expect(events.map((event) => event.type)).toEqual([
      'planning_started',
      'job_failed',
    ])
  })
})
