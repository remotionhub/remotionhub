import { createFileRoute } from '@tanstack/react-router'
import StudioPage from '#/components/studio/StudioPage'

export const Route = createFileRoute('/studio')({
  head: () => ({
    meta: [
      { title: 'AI Studio | RemotionHub' },
      {
        name: 'description',
        content: 'Generate 16:9 Remotion product demo videos from prompts.',
      },
    ],
  }),
  component: StudioPage,
})
