import { describe, expect, it } from 'vitest'
import {
  getDefaultStudioTemplate,
  p0StudioTemplateSeed,
} from './templates'

describe('studio template helpers', () => {
  it('ignores inactive templates when selecting the default', () => {
    const template = getDefaultStudioTemplate([
      {
        templateId: 'inactive-template',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'inactive',
        priority: 1,
        licenseStatus: 'approved',
      },
      {
        templateId: 'active-template',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 2,
        licenseStatus: 'approved',
      },
    ])

    expect(template?.templateId).toBe('active-template')
  })

  it('ignores unapproved templates when selecting the default', () => {
    const template = getDefaultStudioTemplate([
      {
        templateId: 'pending-template',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 1,
        licenseStatus: 'pending',
      },
      {
        templateId: 'approved-template',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 2,
        licenseStatus: 'approved',
      },
    ])

    expect(template?.templateId).toBe('approved-template')
  })

  it('selects the lowest numeric priority active approved template', () => {
    const template = getDefaultStudioTemplate([
      {
        templateId: 'priority-20',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 20,
        licenseStatus: 'approved',
      },
      {
        templateId: 'priority-10',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 10,
        licenseStatus: 'approved',
      },
      {
        templateId: 'priority-30',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 30,
        licenseStatus: 'approved',
      },
    ])

    expect(template?.templateId).toBe('priority-10')
  })

  it('ignores hyperframes templates when selecting the default', () => {
    const template = getDefaultStudioTemplate([
      {
        templateId: 'hyperframes-template',
        templateVersion: '1.0.0',
        runtime: 'hyperframes',
        status: 'active',
        priority: 1,
        licenseStatus: 'approved',
      },
      {
        templateId: 'remotion-template',
        templateVersion: '1.0.0',
        runtime: 'remotion',
        status: 'active',
        priority: 2,
        licenseStatus: 'approved',
      },
    ])

    expect(template?.templateId).toBe('remotion-template')
  })

  it('exports the p0 studio template seed payload', () => {
    expect(p0StudioTemplateSeed).toEqual({
      templateId: 'yt-simple-ai-product',
      templateVersion: '1.0.0',
      runtime: 'remotion',
      status: 'active',
      priority: 10,
      supportedAspectRatios: ['16:9'],
      supportedResolutions: [{ width: 1280, height: 720 }],
      fps: 30,
      propsSchemaVersion: '1',
      propsSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'subtitle', 'body'],
        properties: {
          headline: { type: 'string', minLength: 1, maxLength: 120 },
          subtitle: { type: 'string', minLength: 1, maxLength: 180 },
          body: { type: 'string', minLength: 1, maxLength: 500 },
        },
      },
      agentPrompt:
        'Create a concise 16:9 product explainer using a clean SaaS launch style.',
      tags: ['product-demo', 'hero', 'launch'],
      previewStorageKey: undefined,
      licenseStatus: 'approved',
    })
  })
})
