import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '../../../convex/_generated/dataModel'
import StudioWorkspace from '../../components/studio/StudioWorkspace'

export const Route = createFileRoute('/studio/$projectId')({
  head: () => ({
    meta: [{ title: 'Studio · RemotionHub' }],
  }),
  component: StudioProjectRoute,
})

function StudioProjectRoute() {
  const { projectId } = Route.useParams()
  return <StudioWorkspace projectId={projectId as Id<'studioProjects'>} />
}
