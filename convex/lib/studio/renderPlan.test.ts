import { describe, expect, it } from 'vitest'
import { validateRenderPlan } from './renderPlan'
import type { StudioErrorCode } from './constants'

const job = {
  templateId: 'yt-simple-ai-product',
  templateVersion: '1.0.0',
  propsSchemaVersion: '1',
}

function expectErrors(
  result: ReturnType<typeof validateRenderPlan>,
): StudioErrorCode[] {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('Expected validation to fail.')
  }
  return result.errors
}

const template = {
  allowedAssetIds: ['template:yt-simple-ai-product:hero-bg'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline'],
    properties: {
      headline: { type: 'string', minLength: 1, maxLength: 120 },
    },
  },
}

describe('validateRenderPlan', () => {
  it('accepts a strict Remotion render plan locked to the selected template', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster' },
        assetIds: ['template:yt-simple-ai-product:hero-bg'],
      },
      job,
      template,
    )

    expect(result.ok).toBe(true)
  })

  it('returns PLAN_VALIDATION_FAILED for malformed structural input', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'different-template',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [],
        props: { headline: 'Launch faster', shellCommand: 'rm -rf .' },
        assetIds: [],
      },
      job,
      template,
    )

    expect(expectErrors(result)).toContain('PLAN_VALIDATION_FAILED')
  })

  it('returns TEMPLATE_VERSION_MISMATCH for a structurally valid plan locked to a different template', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'different-template',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster' },
        assetIds: ['template:yt-simple-ai-product:hero-bg'],
      },
      job,
      template,
    )

    expect(expectErrors(result)).toContain('TEMPLATE_VERSION_MISMATCH')
  })

  it('rejects catalog asset ids that are not in the server-derived allowlist', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster' },
        assetIds: ['catalog:arbitrary-asset'],
      },
      job,
      template,
    )

    expect(expectErrors(result)).toContain('PROPS_VALIDATION_FAILED')
  })

  it.each([
    'https://evil.example/asset.png',
    '../artifact.mp4',
    'npm:react',
  ])('rejects unsafe asset id %s', (assetId) => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster' },
        assetIds: [assetId],
      },
      job,
      template,
    )

    expect(expectErrors(result)).toContain('PROPS_VALIDATION_FAILED')
  })

  it('rejects props that are not allowed by the template schema', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: 'Launch faster', shellCommand: 'rm -rf .' },
        assetIds: [],
      },
      job,
      template,
    )

    expect(expectErrors(result)).toContain('PROPS_VALIDATION_FAILED')
  })

  it('rejects props that fail required and length constraints', () => {
    const result = validateRenderPlan(
      {
        schemaVersion: 1,
        templateId: 'yt-simple-ai-product',
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
        intentSummary: 'Product launch explainer',
        style: {
          tone: 'modern',
          primaryColor: '#0F766E',
          backgroundStyle: 'clean gradient',
        },
        scenes: [
          {
            id: 'scene-1',
            durationSeconds: 15,
            headline: 'Launch faster',
            subtitle: 'AI workflow for product teams',
            body: 'Turn scattered notes into polished product demos.',
            visualHint: 'Dashboard panels slide into view',
          },
        ],
        props: { headline: '' },
        assetIds: [],
      },
      job,
      template,
    )

    expect(expectErrors(result)).toContain('PROPS_VALIDATION_FAILED')
  })
})
