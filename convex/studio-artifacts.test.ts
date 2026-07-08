import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import schema from './schema'
import { completeGenerationJob, getGenerationArtifactAccess } from './studio'

const modules = import.meta.glob('./**/*.*s')
const ORIGINAL_SIGNING_SECRET = process.env.STUDIO_ARTIFACT_SIGNING_SECRET
const ORIGINAL_WORKER_SECRET = process.env.STUDIO_WORKER_SECRET

const studioIdentity = {
  subject: 'studio-user-1',
  issuer: 'https://example.test',
  tokenIdentifier: 'https://example.test|studio-user-1',
}

const otherIdentity = {
  subject: 'studio-user-2',
  issuer: 'https://example.test',
  tokenIdentifier: 'https://example.test|studio-user-2',
}

const workerId = 'studio-worker-1'
const workerSecret = 'studio-worker-secret'

async function seedUploadingFixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    await ctx.db.insert('studioTemplates', {
      templateId: 'approved-template',
      templateVersion: '1.0.0',
      runtime: 'remotion',
      status: 'active',
      priority: 1,
      supportedAspectRatios: ['16:9'],
      supportedResolutions: [{ width: 1280, height: 720 }],
      fps: 30,
      propsSchemaVersion: '1',
      propsSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      agentPrompt: 'Create a concise product launch video.',
      tags: ['launch'],
      licenseStatus: 'approved',
      createdAt: 1,
      updatedAt: 1,
    })

    const jobId = await ctx.db.insert('generationJobs', {
      userId: studioIdentity.subject,
      status: 'uploading',
      prompt: 'Launch an AI analytics dashboard',
      runtime: 'remotion',
      aspectRatio: '16:9',
      durationSeconds: 15,
      templateId: 'approved-template',
      templateVersion: '1.0.0',
      propsSchemaVersion: '1',
      assetIds: [],
      attemptCount: 1,
      progress: 90,
      idempotencyKey: 'uploading-artifact-job',
      workerId,
      plannerOutput: {
        schemaVersion: 1,
        templateId: 'approved-template',
        templateVersion: '1.0.0',
        propsSchemaVersion: '1',
        runtime: 'remotion',
        output: {
          aspectRatio: '16:9',
          width: 1280,
          height: 720,
          fps: 30,
          durationSeconds: 15,
          format: 'mp4',
        },
        intentSummary: 'Launch video',
        style: {
          tone: 'confident',
          primaryColor: '#0f172a',
          backgroundStyle: 'gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch fast',
            subtitle: 'A short product film',
            body: 'Automate analytics and reporting.',
            visualHint: 'Black background',
          },
        ],
        props: {},
        assetIds: [],
      },
      createdAt: 10,
      updatedAt: 10,
      lockedAt: 10,
      heartbeatAt: 10,
      lockExpiresAt: 60_000,
      startedAt: 10,
    })

    await ctx.db.insert('renderRuns', {
      jobId,
      workerId,
      runtime: 'remotion',
      templateId: 'approved-template',
      templateVersion: '1.0.0',
      rendererVersion: 'test-renderer',
      remotionVersion: '4.0.0',
      workerVersion: 'test-worker',
      startedAt: 10,
      renderInputSnapshotRef: 'snapshots/input.json',
      createdAt: 10,
    })

    return { jobId }
  })
}

async function seedArtifactFixture(t: ReturnType<typeof convexTest>, args?: {
  thumbnailStorageKey?: string
  previewStorageKey?: string
}) {
  return t.run(async (ctx) => {
    await ctx.db.insert('studioTemplates', {
      templateId: 'approved-template',
      templateVersion: '1.0.0',
      runtime: 'remotion',
      status: 'active',
      priority: 1,
      supportedAspectRatios: ['16:9'],
      supportedResolutions: [{ width: 1280, height: 720 }],
      fps: 30,
      propsSchemaVersion: '1',
      propsSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      agentPrompt: 'Create a concise product launch video.',
      tags: ['launch'],
      previewStorageKey: args?.previewStorageKey,
      licenseStatus: 'approved',
      createdAt: 1,
      updatedAt: 1,
    })

    const jobId = await ctx.db.insert('generationJobs', {
      userId: studioIdentity.subject,
      status: 'completed',
      prompt: 'Launch an AI analytics dashboard',
      runtime: 'remotion',
      aspectRatio: '16:9',
      durationSeconds: 15,
      templateId: 'approved-template',
      templateVersion: '1.0.0',
      propsSchemaVersion: '1',
      assetIds: [],
      attemptCount: 1,
      progress: 100,
      idempotencyKey: 'artifact-job',
      createdAt: 10,
      updatedAt: 10,
      completedAt: 10,
    })

    const artifactId = await ctx.db.insert('generationArtifacts', {
      userId: studioIdentity.subject,
      jobId,
      storageKey: 'studio/job-1/artifact.mp4',
      thumbnailStorageKey: args?.thumbnailStorageKey,
      fileSizeBytes: 1024,
      mimeType: 'video/mp4',
      width: 1280,
      height: 720,
      fps: 30,
      durationSeconds: 15,
      aspectRatio: '16:9',
      runtime: 'remotion',
      createdAt: 10,
    })

    await ctx.db.patch(jobId, {
      artifactId,
      updatedAt: 11,
    })

    return { jobId, artifactId }
  })
}

describe('getGenerationArtifactAccess', () => {
  beforeEach(() => {
    process.env.STUDIO_ARTIFACT_SIGNING_SECRET = 'studio-artifact-signing-secret'
    process.env.STUDIO_WORKER_SECRET = workerSecret
  })

  afterEach(() => {
    if (ORIGINAL_SIGNING_SECRET === undefined) {
      delete process.env.STUDIO_ARTIFACT_SIGNING_SECRET
    } else {
      process.env.STUDIO_ARTIFACT_SIGNING_SECRET = ORIGINAL_SIGNING_SECRET
    }

    if (ORIGINAL_WORKER_SECRET === undefined) {
      delete process.env.STUDIO_WORKER_SECRET
    } else {
      process.env.STUDIO_WORKER_SECRET = ORIGINAL_WORKER_SECRET
    }
  })

  it('requires the artifact owner and returns short-lived playback and download urls', async () => {
    const t = convexTest(schema, modules)
    const { jobId, artifactId } = await seedArtifactFixture(t, {
      previewStorageKey: 'studio/templates/approved-template/preview.mp4',
    })

    const access = await t.withIdentity(studioIdentity).query(getGenerationArtifactAccess, {
      jobId,
    })

    expect(access.artifactId).toBe(artifactId)
    expect(access.playback.url).toContain('/api/studio/artifacts/playback?')
    expect(access.playback.url).toContain('key=studio%2Fjob-1%2Fartifact.mp4')
    expect(access.download.url).toContain('/api/studio/artifacts/download?')
    expect(access.thumbnail.source).toBe('template-preview')
    expect(access.thumbnail.url).toContain('/api/studio/artifacts/preview?')
    expect(access.playback.expiresAt - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000)
    expect(access.playback.expiresAt).toBe(access.download.expiresAt)
    expect(access.mimeType).toBe('video/mp4')
  })

  it('falls back to the default thumbnail url when neither artifact nor template preview exists', async () => {
    const t = convexTest(schema, modules)
    const { jobId } = await seedArtifactFixture(t)

    const access = await t.withIdentity(studioIdentity).query(getGenerationArtifactAccess, {
      jobId,
    })

    expect(access.thumbnail.source).toBe('default')
    expect(access.thumbnail.url.startsWith('data:image/svg+xml,')).toBe(true)
    expect(access.thumbnail.expiresAt).toBeNull()
  })

  it('rejects artifact reads for non-owners', async () => {
    const t = convexTest(schema, modules)
    const { jobId } = await seedArtifactFixture(t, {
      thumbnailStorageKey: 'studio/job-1/artifact-thumbnail.jpg',
    })

    await expect(
      t.withIdentity(otherIdentity).query(getGenerationArtifactAccess, {
        jobId,
      }),
    ).rejects.toThrowError('TEMPLATE_NOT_FOUND')
  })

  it.each([
    {
      label: 'hyperframes runtime',
      artifact: {
        storageKey: 'studio/job-2/artifact.mp4',
        fileSizeBytes: 3291,
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'hyperframes',
      },
    },
    {
      label: 'non-mp4 mime type',
      artifact: {
        storageKey: 'studio/job-2/artifact.webm',
        fileSizeBytes: 3291,
        mimeType: 'video/webm',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'remotion',
      },
    },
    {
      label: 'out-of-profile dimensions',
      artifact: {
        storageKey: 'studio/job-2/artifact.mp4',
        fileSizeBytes: 3291,
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'remotion',
      },
    },
    {
      label: 'out-of-profile duration',
      artifact: {
        storageKey: 'studio/job-2/artifact.mp4',
        fileSizeBytes: 3291,
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 45,
        aspectRatio: '16:9',
        runtime: 'remotion',
      },
    },
    {
      label: 'non-positive file size',
      artifact: {
        storageKey: 'studio/job-2/artifact.mp4',
        fileSizeBytes: 0,
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'remotion',
      },
    },
    {
      label: 'invalid storage key shape',
      artifact: {
        storageKey: 'uploads/job-2/artifact.mp4',
        fileSizeBytes: 3291,
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
        durationSeconds: 15,
        aspectRatio: '16:9',
        runtime: 'remotion',
      },
    },
  ])('rejects completed artifacts with $label before persisting them', async ({ artifact }) => {
    const t = convexTest(schema, modules)
    const { jobId } = await seedUploadingFixture(t)

    await expect(
      t.mutation(completeGenerationJob, {
        jobId,
        workerId,
        workerSecret,
        artifact,
        renderRun: {
          completedAt: 20,
          durationMs: 10,
          exitCode: 0,
          outputStorageKey: artifact.storageKey,
        },
      }),
    ).rejects.toThrowError('ARTIFACT_PROFILE_MISMATCH')

    const persistedArtifacts = await t.run(async (ctx) =>
      ctx.db
        .query('generationArtifacts')
        .withIndex('by_user_job', (q) =>
          q.eq('userId', studioIdentity.subject).eq('jobId', jobId),
        )
        .collect(),
    )
    const job = await t.run(async (ctx) => ctx.db.get(jobId))

    expect(persistedArtifacts).toHaveLength(0)
    expect(job?.status).toBe('uploading')
    expect(job?.artifactId).toBeUndefined()
  })

  it('rejects completed artifacts when the render output key does not match the artifact key', async () => {
    const t = convexTest(schema, modules)
    const { jobId } = await seedUploadingFixture(t)
    const artifact = {
      storageKey: 'studio/job-2/artifact.mp4',
      fileSizeBytes: 3291,
      mimeType: 'video/mp4',
      width: 1280,
      height: 720,
      fps: 30,
      durationSeconds: 15,
      aspectRatio: '16:9',
      runtime: 'remotion' as const,
    }

    await expect(
      t.mutation(completeGenerationJob, {
        jobId,
        workerId,
        workerSecret,
        artifact,
        renderRun: {
          completedAt: 20,
          durationMs: 10,
          exitCode: 0,
          outputStorageKey: 'studio/job-2/other.mp4',
        },
      }),
    ).rejects.toThrowError('ARTIFACT_PROFILE_MISMATCH')

    const persistedArtifacts = await t.run(async (ctx) =>
      ctx.db
        .query('generationArtifacts')
        .withIndex('by_user_job', (q) =>
          q.eq('userId', studioIdentity.subject).eq('jobId', jobId),
        )
        .collect(),
    )
    const job = await t.run(async (ctx) => ctx.db.get(jobId))

    expect(persistedArtifacts).toHaveLength(0)
    expect(job?.status).toBe('uploading')
    expect(job?.artifactId).toBeUndefined()
  })
})
