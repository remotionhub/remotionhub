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
      async mutation<TArgs, TResult>(_mutation: unknown, args: TArgs): Promise<TResult> {
        const sequence = [
          'claim',
          'markModelStarted',
          'completePlanning',
          'startRendering',
          'startUploading',
          'completeGenerationJob',
        ]
        const step =
          'expectedStatus' in (args as Record<string, unknown>)
            ? 'heartbeatGenerationJob'
            : sequence[calls.length]
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
          } as TResult
        }

        return null as TResult
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

  it('returns idle when no queued studio job is available', async () => {
    const env = {
      CONVEX_URL: 'https://example.convex.cloud',
      STUDIO_WORKER_ID: 'worker-1',
      STUDIO_WORKER_SECRET: 'studio-worker-secret',
      STUDIO_RENDER_MODE: 'fake',
    }

    const result = await runStudioWorkerOnce(env, () => ({
      async mutation<TArgs, TResult>(_mutation: unknown, args: TArgs): Promise<TResult> {
        expect(args).toMatchObject({
          workerId: 'worker-1',
          workerSecret: 'studio-worker-secret',
        })

        return null as TResult
      },
    }))

    expect(result).toEqual({ status: 'idle' })
  })

  it('stops after planning when the worker runs in planner-only mode', async () => {
    const calls: Array<{ step: string; args: Record<string, unknown> }> = []
    const env = {
      CONVEX_URL: 'https://example.convex.cloud',
      STUDIO_WORKER_ID: 'worker-1',
      STUDIO_WORKER_SECRET: 'studio-worker-secret',
      STUDIO_RENDER_MODE: 'fake',
      STUDIO_WORKER_MODE: 'planner-only',
    }

    const result = await runStudioWorkerOnce(env, () => ({
      async mutation<TArgs, TResult>(_mutation: unknown, args: TArgs): Promise<TResult> {
        const sequence = ['claim', 'markModelStarted', 'completePlanning']
        const step = sequence[calls.length]
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
          } as TResult
        }

        return null as TResult
      },
    }))

    expect(result).toEqual({
      status: 'planned',
      jobId: 'job-1',
    })
    expect(calls.map((call) => call.step)).toEqual([
      'claim',
      'markModelStarted',
      'completePlanning',
    ])
  })

  it('falls back to a model provider error for unsupported worker failures', async () => {
    const calls: Array<{ step: string; args: Record<string, unknown> }> = []
    const env = {
      CONVEX_URL: 'https://example.convex.cloud',
      STUDIO_WORKER_ID: 'worker-1',
      STUDIO_WORKER_SECRET: 'studio-worker-secret',
      STUDIO_RENDER_MODE: 'fake',
    }

    const result = await runStudioWorkerOnce(env, () => ({
      async mutation<TArgs, TResult>(_mutation: unknown, args: TArgs): Promise<TResult> {
        const sequence = ['claim', 'markModelStarted', 'failGenerationJob']
        const step = sequence[calls.length]
        calls.push({
          step,
          args: args as Record<string, unknown>,
        })

        if (step === 'claim') {
          return {
            id: 'job-1',
            prompt: 'Launch an AI analytics dashboard',
            templateId: 'unsupported-template',
            templateVersion: '1.0.0',
          } as TResult
        }

        return null as TResult
      },
    }))

    expect(result).toEqual({
      status: 'failed',
      jobId: 'job-1',
    })
    expect(calls.at(-1)).toMatchObject({
      step: 'failGenerationJob',
      args: {
        errorCode: 'MODEL_PROVIDER_ERROR',
      },
    })
  })

  it('preserves backend validation error codes when worker failure handling runs', async () => {
    const calls: Array<{ step: string; args: Record<string, unknown> }> = []
    const env = {
      CONVEX_URL: 'https://example.convex.cloud',
      STUDIO_WORKER_ID: 'worker-1',
      STUDIO_WORKER_SECRET: 'studio-worker-secret',
      STUDIO_RENDER_MODE: 'fake',
    }

    const result = await runStudioWorkerOnce(env, () => ({
      async mutation<TArgs, TResult>(_mutation: unknown, args: TArgs): Promise<TResult> {
        const sequence = [
          'claim',
          'markModelStarted',
          'completePlanning',
          'failGenerationJob',
        ]
        const step = sequence[calls.length]
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
          } as TResult
        }

        if (step === 'completePlanning') {
          throw new Error('ConvexError: PROPS_VALIDATION_FAILED')
        }

        return null as TResult
      },
    }))

    expect(result).toEqual({
      status: 'failed',
      jobId: 'job-1',
    })
    expect(calls.at(-1)).toMatchObject({
      step: 'failGenerationJob',
      args: {
        errorCode: 'PROPS_VALIDATION_FAILED',
      },
    })
  })

  it('treats already-canceled planning jobs as terminal during failure handling', async () => {
    const calls: Array<{ step: string; args: Record<string, unknown> }> = []
    const env = {
      CONVEX_URL: 'https://example.convex.cloud',
      STUDIO_WORKER_ID: 'worker-1',
      STUDIO_WORKER_SECRET: 'studio-worker-secret',
      STUDIO_RENDER_MODE: 'fake',
    }

    const result = await runStudioWorkerOnce(env, () => ({
      async mutation<TArgs, TResult>(_mutation: unknown, args: TArgs): Promise<TResult> {
        const sequence = [
          'claim',
          'markModelStarted',
          'completePlanning',
          'failGenerationJob',
        ]
        const step = sequence[calls.length]
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
          } as TResult
        }

        if (step === 'completePlanning' || step === 'failGenerationJob') {
          throw new Error('ConvexError: INVALID_WORKER_STATE')
        }

        return null as TResult
      },
    }))

    expect(result).toEqual({
      status: 'canceled',
      jobId: 'job-1',
    })
    expect(calls.map((call) => call.step)).toEqual([
      'claim',
      'markModelStarted',
      'completePlanning',
      'failGenerationJob',
    ])
  })
})
