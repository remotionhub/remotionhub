import type { StudioRenderPlan } from '../convex/lib/studio/renderPlan'
import type { StudioTemplateSeed } from '../convex/lib/studio/templates'

export function createStubRenderPlan(
  prompt: string,
  template: StudioTemplateSeed,
): StudioRenderPlan {
  const headline = prompt.trim().slice(0, 90) || 'Launch your product faster'

  return {
    schemaVersion: 1,
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    propsSchemaVersion: template.propsSchemaVersion,
    runtime: 'remotion',
    output: {
      aspectRatio: '16:9',
      width: 1280,
      height: 720,
      fps: 30,
      durationSeconds: 15,
      format: 'mp4',
    },
    intentSummary: headline,
    style: {
      tone: 'modern',
      primaryColor: '#0F766E',
      backgroundStyle: 'clean product gradient',
    },
    scenes: [
      {
        id: 'scene-1',
        durationSeconds: 15,
        headline,
        subtitle: 'A concise product demo generated from your prompt',
        body: 'Show the problem, the product promise, and the call to action.',
        visualHint: 'Product cards and dashboard panels animate in sequence',
      },
    ],
    props: {
      headline,
      subtitle: 'A concise product demo generated from your prompt',
      body: 'Show the problem, the product promise, and the call to action.',
    },
    assetIds: [],
  }
}
