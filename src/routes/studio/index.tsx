import { createFileRoute } from '@tanstack/react-router'
import StudioLanding from '#/components/studio/StudioLanding'

export const Route = createFileRoute('/studio/')({
  head: () => ({
    meta: [
      { title: 'Studio · RemotionHub' },
      {
        name: 'description',
        content: 'Create motion graphics from a prompt with RemotionHub Studio.',
      },
    ],
  }),
  component: StudioLanding,
})
