import { describe, expect, it } from 'vitest'
import { validateRenderPlan } from '../convex/lib/studio/renderPlan'
import { p0StudioTemplateSeed } from '../convex/lib/studio/templates'
import { createStubRenderPlan } from './studio-planner'

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
})
