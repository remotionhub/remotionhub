import { createFileRoute } from '@tanstack/react-router'
import CatalogGrid from '#/components/catalog/CatalogGrid'
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t('remotion.eyebrow')}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {t('remotion.title')}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {t('remotion.description')}
        </p>
      </header>
      <CatalogGrid runtime="remotion" />
    </main>
  )
}
