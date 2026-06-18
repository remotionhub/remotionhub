import { createFileRoute, notFound } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import DetailPage from '#/components/catalog/DetailPage'
import { createConvexHttpClient } from '#/lib/convex'

export const Route = createFileRoute('/hyperframes/$owner/$slug')({
  loader: async ({ params }) => {
    const client = createConvexHttpClient()
    const detail = await client.query(api.components.getCatalogDetail, {
      runtime: 'hyperframes',
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
          : 'HyperFrames Component | RemotionHub',
      },
      {
        name: 'description',
        content:
          loaderData?.component.summary ??
          'Browse HyperFrames components on RemotionHub.',
      },
    ],
  }),
  component: HyperFramesDetail,
})

function HyperFramesDetail() {
  return <DetailPage detail={Route.useLoaderData()} />
}
