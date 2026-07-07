export type StudioTemplateSeed = {
  templateId: string
  templateVersion: string
  runtime: 'remotion'
  status: 'active' | 'inactive'
  priority: number
  supportedAspectRatios: string[]
  supportedResolutions: Array<{ width: number; height: number }>
  fps: number
  propsSchema: Record<string, unknown>
  propsSchemaVersion: string
  agentPrompt: string
  tags: string[]
  previewStorageKey?: string
  licenseStatus: 'pending' | 'approved' | 'blocked'
}

type StudioTemplateCandidate = {
  templateId: string
  templateVersion: string
  runtime: 'remotion' | 'hyperframes'
  status: 'active' | 'inactive'
  priority: number
  licenseStatus: 'pending' | 'approved' | 'blocked'
}

export const p0StudioTemplateSeed: StudioTemplateSeed = {
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
}

function isActiveApprovedStudioTemplate(template: StudioTemplateCandidate) {
  return (
    template.runtime === 'remotion' &&
    template.status === 'active' &&
    template.licenseStatus === 'approved'
  )
}

function compareStudioTemplates(
  left: StudioTemplateCandidate,
  right: StudioTemplateCandidate,
) {
  return (
    left.priority - right.priority ||
    left.templateId.localeCompare(right.templateId) ||
    left.templateVersion.localeCompare(right.templateVersion)
  )
}

export function listActiveApprovedStudioTemplates(
  templates: readonly StudioTemplateCandidate[],
) {
  return [...templates].filter(isActiveApprovedStudioTemplate).sort(compareStudioTemplates)
}

export function getDefaultStudioTemplate(
  templates: readonly StudioTemplateCandidate[],
) {
  return listActiveApprovedStudioTemplates(templates)[0] ?? null
}
