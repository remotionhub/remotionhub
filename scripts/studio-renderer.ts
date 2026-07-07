import type { StudioRenderPlan } from '../convex/lib/studio/renderPlan'

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

function createFakeStudioArtifact(
  jobId: string,
  plan: StudioRenderPlan,
): RenderedStudioArtifact {
  const shouldFailThumbnail = process.env.STUDIO_FAKE_RENDER_THUMBNAIL_MODE === 'fail'

  return {
    storageKey: `studio/${jobId}/artifact.mp4`,
    thumbnailStorageKey: shouldFailThumbnail
      ? undefined
      : `studio/${jobId}/artifact-thumbnail.jpg`,
    fileSizeBytes: 1024,
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
    return createFakeStudioArtifact(jobId, plan)
  }

  if (renderMode === 'remotion') {
    throw new Error(
      'RENDER_FAILED: STUDIO_RENDER_MODE=remotion is reserved until the Remotion renderer command is wired.',
    )
  }

  throw new Error(`RENDER_FAILED: Unsupported STUDIO_RENDER_MODE "${renderMode}".`)
}

