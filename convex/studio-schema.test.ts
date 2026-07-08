import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import schema from './schema'

const modules = import.meta.glob('./**/*.*s')

const baseTemplate = {
  templateId: 'yt-simple-ai-product',
  templateVersion: '1.0.0',
  runtime: 'remotion' as const,
  status: 'active' as const,
  priority: 10,
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
  previewStorageKey: 'studio/templates/yt-simple-ai-product/preview.mp4',
  licenseStatus: 'approved' as const,
  createdAt: 1,
  updatedAt: 1,
}

async function seedGenerationJob(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) =>
    ctx.db.insert('generationJobs', {
      userId: 'user_1',
      status: 'queued',
      prompt: 'Launch the product faster',
      runtime: 'remotion',
      aspectRatio: '16:9',
      durationSeconds: 15,
      templateId: 'yt-simple-ai-product',
      templateVersion: '1.0.0',
      propsSchemaVersion: '1',
      assetIds: ['template:yt-simple-ai-product:hero-bg'],
      attemptCount: 0,
      progress: 5,
      idempotencyKey: 'test-job',
      createdAt: 1,
      updatedAt: 1,
    }),
  )
}

describe('studio schema', () => {
  it('accepts approved studio templates', async () => {
    const t = convexTest(schema, modules)

    const templateId = await t.run(async (ctx) =>
      ctx.db.insert('studioTemplates', baseTemplate),
    )
    const template = await t.run(async (ctx) => ctx.db.get(templateId))

    expect(template?.licenseStatus).toBe('approved')
  })

  it('stores queued generation jobs with idempotency keys', async () => {
    const t = convexTest(schema, modules)

    const jobId = await seedGenerationJob(t)
    const job = await t.run(async (ctx) => ctx.db.get(jobId))

    expect(job?.status).toBe('queued')
    expect(job?.idempotencyKey).toBe('test-job')
  })

  it('accepts usage ledger idempotency keys', async () => {
    const t = convexTest(schema, modules)
    const jobId = await seedGenerationJob(t)

    const ledgerId = await t.run(async (ctx) =>
      ctx.db.insert('usageLedger', {
        userId: 'user_1',
        kind: 'consume',
        amount: 1,
        balanceAfter: 0,
        jobId,
        reason: 'consume generation credits',
        idempotencyKey: 'consume:test-job',
        createdAt: 1,
      }),
    )
    const ledger = await t.run(async (ctx) => ctx.db.get(ledgerId))

    expect(ledger?.idempotencyKey).toBe('consume:test-job')
  })

  it('stores generation artifacts without persisted signed urls', async () => {
    const t = convexTest(schema, modules)
    const jobId = await seedGenerationJob(t)

    const artifactId = await t.run(async (ctx) =>
      ctx.db.insert('generationArtifacts', {
        userId: 'user_1',
        jobId,
        storageKey: 'studio/jobs/job_1/artifact.mp4',
        fileSizeBytes: 1024,
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'remotion',
        createdAt: 1,
      }),
    )
    const artifact = await t.run(async (ctx) => ctx.db.get(artifactId))

    expect(artifact?.storageKey).toBe('studio/jobs/job_1/artifact.mp4')
    expect(artifact).not.toHaveProperty('videoUrl')
    expect(artifact).not.toHaveProperty('thumbnailUrl')
  })

  it('accepts generation job events', async () => {
    const t = convexTest(schema, modules)
    const jobId = await seedGenerationJob(t)

    const eventId = await t.run(async (ctx) =>
      ctx.db.insert('generationJobEvents', {
        jobId,
        type: 'job_created',
        message: 'Job created',
        metadata: { source: 'test' },
        createdAt: 1,
      }),
    )
    const event = await t.run(async (ctx) => ctx.db.get(eventId))

    expect(event?.type).toBe('job_created')
  })

  it('accepts model runs', async () => {
    const t = convexTest(schema, modules)
    const jobId = await seedGenerationJob(t)

    const modelRunId = await t.run(async (ctx) =>
      ctx.db.insert('modelRuns', {
        jobId,
        provider: 'openai',
        model: 'gpt-4.1',
        attemptIndex: 0,
        runType: 'plan',
        inputDigest: 'input-digest',
        outputDigest: 'output-digest',
        inputSnapshotRef: 'studio/jobs/job_1/model-input.json',
        outputSnapshotRef: 'studio/jobs/job_1/model-output.json',
        validationErrors: [],
        errorCode: 'PLAN_VALIDATION_FAILED',
        errorMessage: 'Plan validation failed',
        promptVersion: '1',
        schemaVersion: '1',
        tokenUsage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
        estimatedCost: 0.12,
        latencyMs: 1000,
        createdAt: 1,
      }),
    )
    const modelRun = await t.run(async (ctx) => ctx.db.get(modelRunId))

    expect(modelRun?.runType).toBe('plan')
  })

  it('accepts render runs', async () => {
    const t = convexTest(schema, modules)
    const jobId = await seedGenerationJob(t)

    const renderRunId = await t.run(async (ctx) =>
      ctx.db.insert('renderRuns', {
        jobId,
        workerId: 'worker-1',
        runtime: 'remotion',
        templateId: 'yt-simple-ai-product',
        templateVersion: '1.0.0',
        rendererVersion: '1.0.0',
        remotionVersion: '4.0.0',
        workerVersion: '1.0.0',
        startedAt: 1,
        durationMs: 2000,
        exitCode: 0,
        logsRef: 'studio/jobs/job_1/render.log',
        renderInputSnapshotRef: 'studio/jobs/job_1/render-input.json',
        outputStorageKey: 'studio/jobs/job_1/render-output.mp4',
        createdAt: 1,
      }),
    )
    const renderRun = await t.run(async (ctx) => ctx.db.get(renderRunId))

    expect(renderRun?.workerId).toBe('worker-1')
  })
})
