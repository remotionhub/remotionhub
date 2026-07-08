import { describe, expect, it } from 'vitest'
import { validateRenderPlan } from '../convex/lib/studio/renderPlan'
import { p0StudioTemplateSeed } from '../convex/lib/studio/templates'
import { createStubRenderPlan } from './studio-planner'
import { runStudioWorkerOnce } from './studio-worker'

describe('createStubRenderPlan', () => {
  it('returns the expected P0 remotion render plan', () => {
    const prompt = 'Launch an AI analytics dashboard'
    const plan = createStubRenderPlan(prompt, p0StudioTemplateSeed)

    expect(plan.templateId).toBe('yt-simple-ai-product')
    expect(plan.runtime).toBe('remotion')
    expect(plan.output.width).toBe(1280)
    expect(plan.output.height).toBe(720)
    expect(plan.output.fps).toBe(30)
    expect(plan.output.durationSeconds).toBeGreaterThanOrEqual(10)
    expect(plan.output.durationSeconds).toBeLessThanOrEqual(30)
    expect(plan.props).toEqual({
      headline: 'Launch an AI analytics dashboard',
      subtitle: 'A concise product demo generated from your prompt',
      body: 'Show the problem, the product promise, and the call to action.',
    })

    expect(
      validateRenderPlan(
        plan,
        {
          templateId: p0StudioTemplateSeed.templateId,
          templateVersion: p0StudioTemplateSeed.templateVersion,
          propsSchemaVersion: p0StudioTemplateSeed.propsSchemaVersion,
        },
        {
          allowedAssetIds: [],
          propsSchema: p0StudioTemplateSeed.propsSchema,
        },
      ),
    ).toEqual({
      ok: true,
      value: plan,
    })
  })

  it('moves the claimed job through planning, rendering, uploading, and completion in fake mode', async () => {
    const calls: Array<{ step: string; args: Record<string, unknown> }> = []
    const env = {
      CONVEX_URL: 'https://example.convex.cloud',
      STUDIO_WORKER_ID: 'worker-1',
      STUDIO_WORKER_SECRET: 'studio-worker-secret',
      STUDIO_RENDER_MODE: 'fake',
    }

    const result = await runStudioWorkerOnce(env, () => ({
      async mutation(_mutation, args) {
        const step = [
          'claim',
          'markModelStarted',
          'completePlanning',
          'startRendering',
          'startUploading',
          'completeGenerationJob',
        ][calls.length]
        calls.push({
          step,
          args: args as Record<string, unknown>,
        })

        if (step === 'claim') {
          return {
            id: 'job-1',
            prompt: 'Launch an AI analytics dashboard',
            templateId: p0StudioTemplateSeed.templateId,
            templateVersion: p0StudioTemplateSeed.templateVersion,
          }
        }

        return null
      },
    }))

    expect(result).toEqual({
      status: 'completed',
      jobId: 'job-1',
    })
    expect(calls.map((call) => call.step)).toEqual([
      'claim',
      'markModelStarted',
      'completePlanning',
      'startRendering',
      'startUploading',
      'completeGenerationJob',
    ])
    expect(calls[3]?.args).toMatchObject({
      jobId: 'job-1',
      workerId: 'worker-1',
      workerSecret: 'studio-worker-secret',
      renderRun: {
        runtime: 'remotion',
        templateId: p0StudioTemplateSeed.templateId,
        templateVersion: p0StudioTemplateSeed.templateVersion,
      },
    })
    expect(calls[5]?.args).toMatchObject({
      jobId: 'job-1',
      workerId: 'worker-1',
      workerSecret: 'studio-worker-secret',
      artifact: {
        storageKey: 'studio/job-1/artifact.mp4',
        mimeType: 'video/mp4',
        width: 1280,
        height: 720,
        fps: 30,
      },
    })
  })
})
