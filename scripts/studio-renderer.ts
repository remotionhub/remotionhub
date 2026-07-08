import type { StudioRenderPlan } from '../convex/lib/studio/renderPlan'
import { writeStudioLocalArtifact } from '../lib/studio/artifact-store'

export type RenderedStudioArtifact = {
  storageKey: string
  thumbnailStorageKey?: string
  fileSizeBytes: number
  mimeType: 'video/mp4'
  width: 1280
  height: 720
  fps: 30
  durationSeconds: number
  aspectRatio: '16:9'
  runtime: 'remotion'
}

const FAKE_MP4_BYTES = (() => {
  const bytes = new Uint8Array(1024)
  bytes.set(new TextEncoder().encode('FAKE_MP4_FIXTURE'))
  return bytes
})()

const FAKE_JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])

async function createFakeStudioArtifact(
  jobId: string,
  plan: StudioRenderPlan,
): Promise<RenderedStudioArtifact> {
  const shouldFailThumbnail = process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE === 'fail'
  const storageKey = `studio/${jobId}/artifact.mp4`
  const thumbnailStorageKey = shouldFailThumbnail
    ? undefined
    : `studio/${jobId}/artifact-thumbnail.jpg`

  await writeStudioLocalArtifact({
    storageKey,
    bytes: FAKE_MP4_BYTES,
  })

  if (thumbnailStorageKey) {
    await writeStudioLocalArtifact({
      storageKey: thumbnailStorageKey,
      bytes: FAKE_JPEG_BYTES,
    })
  }

  return {
    storageKey,
    thumbnailStorageKey,
    fileSizeBytes: FAKE_MP4_BYTES.byteLength,
    mimeType: 'video/mp4',
    width: plan.output.width,
    height: plan.output.height,
    fps: plan.output.fps,
    durationSeconds: plan.output.durationSeconds,
    aspectRatio: plan.output.aspectRatio,
    runtime: plan.runtime,
  }
}

export async function renderStudioArtifact(
  jobId: string,
  plan: StudioRenderPlan,
): Promise<RenderedStudioArtifact> {
  const renderMode = process.env.STUDIO_RENDER_MODE ?? 'fake'

  if (renderMode === 'fake') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'RENDER_FAILED: STUDIO_RENDER_MODE=fake is disabled in production.',
      )
    }
    return createFakeStudioArtifact(jobId, plan)
  }

  if (renderMode === 'remotion') {
    throw new Error(
      'RENDER_FAILED: STUDIO_RENDER_MODE=remotion is reserved until the Remotion renderer command is wired.',
    )
  }

  throw new Error(`RENDER_FAILED: Unsupported STUDIO_RENDER_MODE "${renderMode}".`)
}
