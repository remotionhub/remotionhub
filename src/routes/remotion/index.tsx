import { createFileRoute } from '@tanstack/react-router'
import CatalogGrid from '#/components/catalog/CatalogGrid'
import CatalogPageShell from '#/components/catalog/CatalogPageShell'
import { useI18n } from '#/components/I18nProvider'

export const Route = createFileRoute('/remotion/')({
  head: () => ({
    meta: [
      { title: 'Remotion Components | RemotionHub' },
      {
        name: 'description',
        content:
          'Browse Remotion components with previews, GitHub source links, and agent prompts.',
      },
    ],
  }),
  component: RemotionCatalog,
})

function RemotionCatalog() {
  const { t } = useI18n()

  return (
    <CatalogPageShell title={t('remotion.title')}>
      <CatalogGrid runtime="remotion" />
    </CatalogPageShell>
  )
}
