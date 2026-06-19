import { createFileRoute } from '@tanstack/react-router'
import CatalogGrid from '#/components/catalog/CatalogGrid'
import CatalogPageShell from '#/components/catalog/CatalogPageShell'
import { useI18n } from '#/components/I18nProvider'

export const Route = createFileRoute('/hyperframes/')({
  head: () => ({
    meta: [
      { title: 'HyperFrames Components | RemotionHub' },
      {
        name: 'description',
        content:
          'Browse HyperFrames components with previews, GitHub source links, and agent prompts.',
      },
    ],
  }),
  component: HyperFramesCatalog,
})

function HyperFramesCatalog() {
  const { t } = useI18n()

  return (
    <CatalogPageShell title={t('hyperframes.title')}>
      <CatalogGrid runtime="hyperframes" />
    </CatalogPageShell>
  )
}
