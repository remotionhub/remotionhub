import { createFileRoute, notFound } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import DetailPage from '#/components/catalog/DetailPage'
import { createConvexHttpClient } from '#/lib/convex'

export const Route = createFileRoute('/remotion/$owner/$slug')({
  loader: async ({ params }) => {
    const client = createConvexHttpClient()
    const detail = await client.query(api.components.getCatalogDetail, {
      runtime: 'remotion',
      owner: params.owner,
      slug: params.slug,
    })
    if (!detail) {
      throw notFound()
    }
    return detail
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.component.displayName} | RemotionHub`
          : 'Remotion Component | RemotionHub',
      },
      {
        name: 'description',
        content:
          loaderData?.component.summary ??
          'Browse Remotion components on RemotionHub.',
      },
    ],
  }),
  component: RemotionDetail,
})

function RemotionDetail() {
  return <DetailPage detail={Route.useLoaderData()} />
}
