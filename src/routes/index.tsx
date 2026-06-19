import { createFileRoute } from '@tanstack/react-router'
import CatalogGrid from '#/components/catalog/CatalogGrid'
import CatalogPageShell from '#/components/catalog/CatalogPageShell'
import { useI18n } from '#/components/I18nProvider'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'RemotionHub' },
      {
        name: 'description',
        content:
          'Browse Remotion and HyperFrames assets with previews, source links, and agent prompts.',
      },
    ],
  }),
  component: Home,
})

function Home() {
  const { t } = useI18n()

  return (
    <CatalogPageShell title={t('home.title')}>
      <CatalogGrid />
    </CatalogPageShell>
  )
}
