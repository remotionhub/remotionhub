import { afterEach, describe, expect, it } from 'vitest'
import { p0StudioTemplateSeed } from '../convex/lib/studio/templates'
import { createStubRenderPlan } from './studio-planner'
import { renderStudioArtifact } from './studio-renderer'

const ORIGINAL_RENDER_MODE = process.env.STUDIO_RENDER_MODE
const ORIGINAL_THUMBNAIL_MODE = process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE

describe('renderStudioArtifact', () => {
  afterEach(() => {
    if (ORIGINAL_RENDER_MODE === undefined) {
      delete process.env.STUDIO_RENDER_MODE
    } else {
      process.env.STUDIO_RENDER_MODE = ORIGINAL_RENDER_MODE
    }

    if (ORIGINAL_THUMBNAIL_MODE === undefined) {
      delete process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE
    } else {
      process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE = ORIGINAL_THUMBNAIL_MODE
    }
  })

  it('returns the fake remotion artifact metadata for the MVP output profile', async () => {
    process.env.STUDIO_RENDER_MODE = 'fake'
    delete process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE

    const artifact = await renderStudioArtifact(
      'job-1',
      createStubRenderPlan('Launch an AI analytics dashboard', p0StudioTemplateSeed),
    )

    expect(artifact).toEqual({
      storageKey: 'studio/job-1/artifact.mp4',
      thumbnailStorageKey: 'studio/job-1/artifact-thumbnail.jpg',
      fileSizeBytes: 1024,
      mimeType: 'video/mp4',
      width: 1280,
      height: 720,
      fps: 30,
      durationSeconds: 15,
      aspectRatio: '16:9',
      runtime: 'remotion',
    })
  })

  it('keeps the mp4 artifact when fake thumbnail generation fails', async () => {
    process.env.STUDIO_RENDER_MODE = 'fake'
    process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE = 'fail'

    const artifact = await renderStudioArtifact(
      'job-2',
      createStubRenderPlan('Launch an AI analytics dashboard', p0StudioTemplateSeed),
    )

    expect(artifact.storageKey).toBe('studio/job-2/artifact.mp4')
    expect(artifact.thumbnailStorageKey).toBeUndefined()
    expect(artifact.mimeType).toBe('video/mp4')
  })

  it('fails fast when the remotion renderer handoff is requested before wiring exists', async () => {
    process.env.STUDIO_RENDER_MODE = 'remotion'

    await expect(
      renderStudioArtifact(
        'job-3',
        createStubRenderPlan('Launch an AI analytics dashboard', p0StudioTemplateSeed),
      ),
    ).rejects.toThrowError('RENDER_FAILED')
  })
})

